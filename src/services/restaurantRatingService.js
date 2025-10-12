// restaurantRatingService.js
// 餐廳評分更新服務 - 使用 Google Places API 更新資料庫餐廳評分

import googleMapsLoader from '../utils/googleMapsLoader';
import { supabase, getSupabaseAdmin } from './supabaseService';

class RestaurantRatingService {
  constructor() {
    this.isProcessing = false;
    this.updateQueue = [];
    this.results = {
      processed: 0,
      updated: 0,
      failed: 0,
      skipped: 0,
      details: [],
      unmatched: [] // 新增無法匹配的餐廳列表
    };
    this.STORAGE_KEY = 'restaurant_unmatched_list';
    this.PLACE_ID_CACHE_KEY = 'restaurant_place_id_cache';
  }

  /**
   * 批次更新所有餐廳評分
   * @param {Array} restaurants - 餐廳列表
   * @param {Function} onProgress - 進度回調函數
   * @param {Object} options - 更新選項
   * @returns {Promise<Object>} 更新結果
   */
  async updateRestaurantRatings(restaurants, onProgress = null, options = {}) {
    const {
      batchSize = 5, // 每批處理數量
      delay = 1000,   // 每批之間的延遲（毫秒）
      forceUpdate = false, // 是否強制更新（忽略最後更新時間）
      maxAge = 7 * 24 * 60 * 60 * 1000, // 最大過期時間（7天）
      limitCount = 0, // 限制更新數量，0 = 全部
      priorityMode = 'oldest' // 'oldest' | 'never' | 'all'
    } = options;

    if (this.isProcessing) {
      throw new Error('已有更新任務在進行中，請稍後再試');
    }

    this.isProcessing = true;
    this.results = {
      processed: 0,
      updated: 0,
      failed: 0,
      skipped: 0,
      details: [],
      unmatched: [] // 重置無法匹配的餐廳列表
    };

    try {
      // 載入 Google Maps API
      await googleMapsLoader.load();

      if (!window.google?.maps?.places) {
        throw new Error('Google Places API 無法使用');
      }

      console.log(`開始批次更新 ${restaurants.length} 間餐廳的評分資訊`);

      // 過濾需要更新的餐廳
      const restaurantsToUpdate = this.filterRestaurantsForUpdate(restaurants, forceUpdate, maxAge, limitCount, priorityMode);
      console.log(`需要更新的餐廳數量: ${restaurantsToUpdate.length}`);

      // 分批處理
      for (let i = 0; i < restaurantsToUpdate.length; i += batchSize) {
        const batch = restaurantsToUpdate.slice(i, i + batchSize);

        // 並行處理當前批次
        const batchPromises = batch.map(restaurant =>
          this.updateSingleRestaurantRating(restaurant)
        );

        try {
          const batchResults = await Promise.allSettled(batchPromises);

          // 處理批次結果
          batchResults.forEach((result, index) => {
            const restaurant = batch[index];
            this.results.processed++;

            if (result.status === 'fulfilled') {
              if (result.value.updated) {
                this.results.updated++;
                this.results.details.push({
                  id: restaurant.id,
                  name: restaurant.name,
                  status: 'updated',
                  oldRating: restaurant.rating,
                  newRating: result.value.newRating,
                  userRatingsTotal: result.value.userRatingsTotal
                });
              } else {
                this.results.skipped++;
                this.results.details.push({
                  id: restaurant.id,
                  name: restaurant.name,
                  status: 'skipped',
                  reason: result.value.reason
                });
              }
            } else {
              this.results.failed++;
              this.results.details.push({
                id: restaurant.id,
                name: restaurant.name,
                status: 'failed',
                error: result.reason?.message || '未知錯誤'
              });
            }

            // 調用進度回調
            if (onProgress) {
              onProgress({
                processed: this.results.processed,
                total: restaurantsToUpdate.length,
                updated: this.results.updated,
                failed: this.results.failed,
                skipped: this.results.skipped,
                currentRestaurant: restaurant.name
              });
            }
          });

        } catch (error) {
          console.error(`批次 ${Math.floor(i/batchSize) + 1} 處理失敗:`, error);
        }

        // 延遲以避免 API 限制
        if (i + batchSize < restaurantsToUpdate.length) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      console.log('批次更新完成:', this.results);

      // 自動儲存無法匹配的餐廳
      if (this.results.unmatched.length > 0) {
        this.saveUnmatchedToStorage();
      }

      return this.results;

    } catch (error) {
      console.error('批次更新評分失敗:', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 過濾需要更新的餐廳
   */
  filterRestaurantsForUpdate(restaurants, forceUpdate, maxAge, limitCount = 0, priorityMode = 'oldest') {
    console.log(`📊 過濾參數: forceUpdate=${forceUpdate}, maxAge=${maxAge}ms (${maxAge/1000/60/60/24}天), limitCount=${limitCount}, priorityMode=${priorityMode}`);
    console.log(`📊 總餐廳數: ${restaurants.length}`);

    // 先過濾基本條件
    let filteredRestaurants;
    let skipCount = 0;

    if (forceUpdate) {
      console.log('🔄 強制更新模式：只檢查基本資訊');
      filteredRestaurants = restaurants.filter(r => r.name && (r.latitude && r.longitude));
    } else {
      console.log('⏰ 一般更新模式：檢查更新時間');
      const now = new Date();
      console.log(`🕐 當前時間: ${now.toISOString()}`);

      filteredRestaurants = restaurants.filter(restaurant => {
        // 必須有基本資訊
        if (!restaurant.name || (!restaurant.latitude || !restaurant.longitude)) {
          return false;
        }

        // 檢查最後更新時間
        if (restaurant.rating_updated_at) {
          const lastUpdate = new Date(restaurant.rating_updated_at);
          const timeDiff = now - lastUpdate;
          const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

          // 調試：顯示前5個餐廳的更新狀態
          if (skipCount < 5) {
            console.log(`  📍 ${restaurant.name}: 上次更新 ${daysDiff.toFixed(2)} 天前 (${lastUpdate.toISOString()})`);
          }

          // 如果在指定天數內已更新過，跳過更新
          if (maxAge > 0 && timeDiff < maxAge) {
            skipCount++;
            if (skipCount <= 5) {
              console.log(`  ⏭️  跳過 ${restaurant.name}: ${daysDiff.toFixed(2)} 天 < ${maxAge/1000/60/60/24} 天`);
            }
            return false;
          }
        } else {
          // 沒有更新時間 = 從未更新
          if (skipCount < 5) {
            console.log(`  🆕 ${restaurant.name}: 從未更新過`);
          }
        }

        return true;
      });

      console.log(`⏭️  總共跳過: ${skipCount} 間餐廳`);
    }

    console.log(`📋 基本過濾後數量: ${filteredRestaurants.length}`);

    // 根據優先模式排序
    switch (priorityMode) {
      case 'no_rating':
        console.log('⭐ 排序模式：無評分優先');
        // 沒有評分的優先（rating 為 null、0 或 undefined）
        filteredRestaurants.sort((a, b) => {
          const aHasRating = !!a.rating && a.rating > 0;
          const bHasRating = !!b.rating && b.rating > 0;

          if (!aHasRating && bHasRating) return -1;
          if (aHasRating && !bHasRating) return 1;

          // 如果都沒評分或都有評分，優先選擇從未更新過的
          const aHasUpdate = !!a.rating_updated_at;
          const bHasUpdate = !!b.rating_updated_at;

          if (!aHasUpdate && bHasUpdate) return -1;
          if (aHasUpdate && !bHasUpdate) return 1;

          // 最後按名稱排序
          return a.name.localeCompare(b.name);
        });

        // 統計無評分的餐廳數量
        const noRatingCount = filteredRestaurants.filter(r => !r.rating || r.rating === 0).length;
        console.log(`  📊 無評分: ${noRatingCount} 間, 有評分: ${filteredRestaurants.length - noRatingCount} 間`);
        console.log(`  🔝 前5間: ${filteredRestaurants.slice(0, 5).map(r => {
          const hasRating = r.rating && r.rating > 0;
          const hasUpdate = r.rating_updated_at;
          return `${r.name}(${hasRating ? '★'+r.rating : '無評分'}${hasUpdate ? '' : ',未檢查'})`;
        }).join(', ')}`);
        break;

      case 'never':
        console.log('🆕 排序模式：從未更新優先');
        // 從未更新過的優先
        filteredRestaurants.sort((a, b) => {
          const aHasUpdate = !!a.rating_updated_at;
          const bHasUpdate = !!b.rating_updated_at;

          if (!aHasUpdate && bHasUpdate) return -1;
          if (aHasUpdate && !bHasUpdate) return 1;

          // 如果都沒更新過或都更新過，按名稱排序
          return a.name.localeCompare(b.name);
        });

        // 統計從未更新的餐廳數量
        const neverUpdatedCount = filteredRestaurants.filter(r => !r.rating_updated_at).length;
        console.log(`  📊 從未更新: ${neverUpdatedCount} 間, 已更新: ${filteredRestaurants.length - neverUpdatedCount} 間`);
        console.log(`  🔝 前5間: ${filteredRestaurants.slice(0, 5).map(r => `${r.name}(${r.rating_updated_at ? '已更新' : '未更新'})`).join(', ')}`);
        break;

      case 'oldest':
        console.log('⏳ 排序模式：最久未更新優先');
        // 最久沒更新的優先
        filteredRestaurants.sort((a, b) => {
          const aTime = a.rating_updated_at ? new Date(a.rating_updated_at).getTime() : 0;
          const bTime = b.rating_updated_at ? new Date(b.rating_updated_at).getTime() : 0;
          return aTime - bTime;
        });

        console.log(`  🔝 前5間: ${filteredRestaurants.slice(0, 5).map(r => {
          if (!r.rating_updated_at) return `${r.name}(未更新)`;
          const daysDiff = (Date.now() - new Date(r.rating_updated_at).getTime()) / (1000 * 60 * 60 * 24);
          return `${r.name}(${daysDiff.toFixed(1)}天前)`;
        }).join(', ')}`);
        break;

      case 'all':
      default:
        console.log('📦 排序模式：保持原始順序');
        // 保持原始順序，不排序
        break;
    }

    // 限制數量
    if (limitCount > 0) {
      console.log(`🔢 應用數量限制: ${limitCount}`);
      filteredRestaurants = filteredRestaurants.slice(0, limitCount);
      console.log(`✂️ 限制後數量: ${filteredRestaurants.length}`);
    } else {
      console.log('♾️ 無數量限制');
    }

    console.log(`🎯 最終要更新的餐廳數量: ${filteredRestaurants.length}`);
    return filteredRestaurants;
  }

  /**
   * 更新單一餐廳評分
   * @param {Object} restaurant - 餐廳資料
   * @returns {Promise<Object>} 更新結果
   */
  async updateSingleRestaurantRating(restaurant) {
    try {
      console.log(`正在更新餐廳: ${restaurant.name}`);

      // 先嘗試使用資料庫中的 Google Place ID
      let placeId = restaurant.google_place_id;
      let placeData = null;

      if (placeId) {
        try {
          console.log(`🎯 使用資料庫中的 Place ID: ${placeId} (${restaurant.name})`);
          // 使用現有的 Place ID 獲取詳細資訊
          placeData = await this.getPlaceDetailsByPlaceId(placeId);
        } catch (error) {
          console.warn(`❌ 使用資料庫 Place ID 失敗: ${restaurant.name}`, error);
          placeId = null; // 重置以進行搜尋
        }
      } else {
        console.log(`🔍 資料庫中沒有 Place ID，需要搜尋: ${restaurant.name}`);
      }

      // 如果沒有 Place ID 或使用失敗，進行搜尋
      if (!placeData) {
        placeData = await this.searchPlaceByNameAndLocation(restaurant);
        if (placeData) {
          placeId = placeData.place_id;
          // 儲存新找到的 Place ID 到資料庫
          await this.savePlaceIdToDatabase(restaurant.id, placeId);
          console.log(`💾 已將新的 Place ID 存入資料庫: ${restaurant.name} -> ${placeId}`);
        }
      }

      if (!placeData) {
        // 將無法匹配的餐廳加入列表
        this.results.unmatched.push({
          ...restaurant,
          reason: '無法在 Google Places 中找到此餐廳'
        });

        return {
          updated: false,
          reason: '無法在 Google Places 中找到此餐廳'
        };
      }

      // 準備更新資料
      // 重要：即使沒有評分資料，也要更新 rating_updated_at 和 google_place_id
      // 這樣可以記錄「已經檢查過這間餐廳」，避免重複檢查
      const updateData = {
        rating_updated_at: new Date().toISOString()
      };

      // 更新評分（如果有的話）
      if (placeData.rating !== undefined) {
        updateData.rating = placeData.rating;
      }

      // 更新評分數（如果有的話）
      if (placeData.user_ratings_total !== undefined) {
        updateData.user_ratings_total = placeData.user_ratings_total;
      }

      // 如果新獲得了 Place ID，也一併更新
      if (placeId && !restaurant.google_place_id) {
        updateData.google_place_id = placeId;
      }

      // 檢查是否有實質性更新（評分或評分數）
      const hasNewRating = placeData.rating !== undefined && placeData.rating !== restaurant.rating;
      const hasUserRatingsTotal = placeData.user_ratings_total !== undefined;

      console.log(`🔍 更新餐廳 ID: ${restaurant.id}, 類型: ${typeof restaurant.id}`);
      console.log('📝 更新資料:', updateData);

      // 嘗試使用管理員客戶端進行更新
      const adminClient = getSupabaseAdmin();
      let updateResult, error;

      if (adminClient) {
        console.log('🔧 使用管理員客戶端更新');
        const result = await adminClient
          .from('restaurants')
          .update(updateData)
          .eq('id', restaurant.id)
          .select();
        updateResult = result.data;
        error = result.error;
      } else {
        console.log('⚠️ 管理員客戶端不可用，使用一般客戶端');
        const result = await supabase
          .from('restaurants')
          .update(updateData)
          .eq('id', restaurant.id)
          .select();
        updateResult = result.data;
        error = result.error;
      }

      if (error) {
        throw new Error(`資料庫更新失敗: ${error.message}`);
      }

      if (!updateResult || updateResult.length === 0) {
        throw new Error(`更新失敗：找不到餐廳 ID ${restaurant.id}`);
      }

      console.log(`✅ 餐廳 ${restaurant.name} 更新成功，影響 ${updateResult.length} 筆記錄`);

      // 記錄更新詳情
      if (hasNewRating || hasUserRatingsTotal) {
        console.log(`✅ 成功更新餐廳: ${restaurant.name} -> 評分: ${placeData.rating || 'N/A'}, 評分數: ${placeData.user_ratings_total || 0}`);
      } else {
        console.log(`✅ 成功更新時間戳: ${restaurant.name} (Google Places 無評分資料)`);
      }

      return {
        updated: true,
        newRating: placeData.rating,
        userRatingsTotal: placeData.user_ratings_total,
        placeId: placeId,
        hasRatingData: hasNewRating || hasUserRatingsTotal
      };

    } catch (error) {
      console.error(`更新餐廳評分失敗: ${restaurant.name}`, error);
      throw error;
    }
  }

  /**
   * 根據 Place ID 獲取地點詳細資訊
   */
  async getPlaceDetailsByPlaceId(placeId) {
    const { Place } = await window.google.maps.importLibrary("places");

    const place = new Place({
      id: placeId,
      requestedLanguage: 'zh-TW'
    });

    await place.fetchFields({
      fields: ['displayName', 'rating', 'userRatingCount', 'id']
    });

    return {
      place_id: place.id,
      name: place.displayName,
      rating: place.rating,
      user_ratings_total: place.userRatingCount
    };
  }

  /**
   * 根據餐廳名稱和位置搜尋 Google Places
   */
  async searchPlaceByNameAndLocation(restaurant) {
    try {
      const { Place } = await window.google.maps.importLibrary("places");

      // 建構搜尋查詢
      const searchQuery = `${restaurant.name} ${restaurant.address || ''} 台灣 餐廳`.trim();

      const request = {
        textQuery: searchQuery,
        fields: ['displayName', 'formattedAddress', 'rating', 'userRatingCount', 'location', 'id'],
        locationBias: {
          center: {
            lat: parseFloat(restaurant.latitude),
            lng: parseFloat(restaurant.longitude)
          },
          radius: 500 // 500公尺範圍內
        },
        maxResultCount: 5
      };

      const { places } = await Place.searchByText(request);

      if (!places || places.length === 0) {
        console.warn(`Google Places 搜尋無結果: ${restaurant.name}`);
        return null;
      }

      // 尋找最相符的餐廳
      const bestMatch = this.findBestMatchingPlace(restaurant, places);

      if (!bestMatch) {
        console.warn(`無法找到相符的餐廳: ${restaurant.name}`);
        return null;
      }

      return {
        place_id: bestMatch.id,
        name: bestMatch.displayName,
        rating: bestMatch.rating,
        user_ratings_total: bestMatch.userRatingCount,
        formatted_address: bestMatch.formattedAddress
      };

    } catch (error) {
      console.error(`搜尋餐廳失敗: ${restaurant.name}`, error);
      return null;
    }
  }

  /**
   * 從搜尋結果中找到最相符的餐廳
   */
  findBestMatchingPlace(restaurant, places) {
    // 計算餐廳名稱相似度和距離
    let bestMatch = null;
    let bestScore = 0;

    for (const place of places) {
      try {
        // 提取坐標
        let lat, lng;
        if (place.location) {
          if (typeof place.location.lat === 'number') {
            lat = place.location.lat;
            lng = place.location.lng;
          } else if (typeof place.location.lat === 'function') {
            lat = place.location.lat();
            lng = place.location.lng();
          } else if (place.location.toJSON) {
            const coords = place.location.toJSON();
            lat = coords.lat;
            lng = coords.lng;
          }
        }

        if (!lat || !lng) continue;

        // 計算距離（公里）
        const distance = this.calculateDistance(
          parseFloat(restaurant.latitude),
          parseFloat(restaurant.longitude),
          lat,
          lng
        );

        // 如果距離超過 1 公里，跳過
        if (distance > 1.0) continue;

        // 計算名稱相似度
        const nameSimilarity = this.calculateStringSimilarity(
          restaurant.name.toLowerCase(),
          place.displayName.toLowerCase()
        );

        // 綜合評分：名稱相似度 70% + 距離評分 30%
        const distanceScore = Math.max(0, 1 - distance); // 距離越近分數越高
        const totalScore = nameSimilarity * 0.7 + distanceScore * 0.3;

        if (totalScore > bestScore && nameSimilarity > 0.6) { // 名稱相似度至少要 60%
          bestScore = totalScore;
          bestMatch = place;
        }
      } catch (error) {
        console.warn('處理搜尋結果時出錯:', error);
        continue;
      }
    }

    return bestMatch;
  }

  /**
   * 計算兩個字串的相似度
   */
  calculateStringSimilarity(str1, str2) {
    // 簡單的字串相似度算法
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.calculateEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * 計算編輯距離
   */
  calculateEditDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * 計算兩點之間的距離（公里）
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // 地球半徑（公里）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * 獲取更新進度
   */
  getProgress() {
    return {
      isProcessing: this.isProcessing,
      results: this.results
    };
  }

  /**
   * 停止更新（如果正在進行）
   */
  stopUpdate() {
    // 這裡可以實作停止邏輯，但由於是異步操作，只能設置標誌
    this.shouldStop = true;
  }

  /**
   * 儲存無法匹配的餐廳到本地儲存
   */
  saveUnmatchedToStorage() {
    try {
      const existingData = this.loadUnmatchedFromStorage();
      const combined = [...existingData];

      // 新增新的無法匹配餐廳，避免重複
      this.results.unmatched.forEach(newItem => {
        const exists = combined.find(existing => existing.id === newItem.id);
        if (!exists) {
          combined.push({
            ...newItem,
            addedAt: new Date().toISOString()
          });
        }
      });

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(combined));
      console.log(`💾 已儲存 ${combined.length} 間無法匹配的餐廳到本地儲存`);
    } catch (error) {
      console.error('儲存無法匹配餐廳失敗:', error);
    }
  }

  /**
   * 從本地儲存載入無法匹配的餐廳
   */
  loadUnmatchedFromStorage() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('載入無法匹配餐廳失敗:', error);
      return [];
    }
  }

  /**
   * 從無法匹配列表中移除餐廳
   */
  removeFromUnmatchedList(restaurantId) {
    try {
      const stored = this.loadUnmatchedFromStorage();
      const filtered = stored.filter(item => item.id !== restaurantId);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));

      // 同時從當前結果中移除
      this.results.unmatched = this.results.unmatched.filter(item => item.id !== restaurantId);

      console.log(`🗑️ 已從無法匹配列表中移除餐廳 ID: ${restaurantId}`);
      return filtered;
    } catch (error) {
      console.error('移除餐廳失敗:', error);
      return [];
    }
  }

  /**
   * 清空所有無法匹配的餐廳
   */
  clearUnmatchedList() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      this.results.unmatched = [];
      console.log('🧹 已清空所有無法匹配的餐廳');
    } catch (error) {
      console.error('清空無法匹配餐廳失敗:', error);
    }
  }

  /**
   * 儲存餐廳與 Google Place ID 的對應關係
   */
  savePlaceIdCache(restaurantId, placeId, placeName) {
    try {
      const cache = this.loadPlaceIdCache();
      cache[restaurantId] = {
        placeId: placeId,
        placeName: placeName,
        cachedAt: new Date().toISOString()
      };
      localStorage.setItem(this.PLACE_ID_CACHE_KEY, JSON.stringify(cache));
      console.log(`💾 已快取餐廳 ${restaurantId} 的 Place ID: ${placeId}`);
    } catch (error) {
      console.error('儲存 Place ID 快取失敗:', error);
    }
  }

  /**
   * 載入餐廳與 Google Place ID 的對應關係
   */
  loadPlaceIdCache() {
    try {
      const cached = localStorage.getItem(this.PLACE_ID_CACHE_KEY);
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      console.error('載入 Place ID 快取失敗:', error);
      return {};
    }
  }

  /**
   * 獲取餐廳的快取 Place ID
   */
  getCachedPlaceId(restaurantId) {
    const cache = this.loadPlaceIdCache();
    return cache[restaurantId] || null;
  }

  /**
   * 清空 Place ID 快取
   */
  clearPlaceIdCache() {
    try {
      localStorage.removeItem(this.PLACE_ID_CACHE_KEY);
      console.log('🧹 已清空 Place ID 快取');
    } catch (error) {
      console.error('清空 Place ID 快取失敗:', error);
    }
  }

  /**
   * 重置指定數量餐廳的更新時間（測試用）
   * @param {Array} restaurants - 餐廳列表
   * @param {number} count - 要重置的數量
   * @returns {Promise<number>} 實際重置的數量
   */
  async resetUpdateTimestamps(restaurants, count = 10) {
    try {
      const adminClient = getSupabaseAdmin();
      if (!adminClient) {
        throw new Error('管理員客戶端不可用');
      }

      // 隨機選擇餐廳
      const shuffled = [...restaurants].sort(() => Math.random() - 0.5);
      const toReset = shuffled.slice(0, count);

      console.log(`🔄 準備重置 ${toReset.length} 間餐廳的更新時間...`);

      let successCount = 0;
      for (const restaurant of toReset) {
        const { error } = await adminClient
          .from('restaurants')
          .update({ rating_updated_at: null })
          .eq('id', restaurant.id);

        if (error) {
          console.error(`❌ 重置失敗: ${restaurant.name}`, error);
        } else {
          console.log(`✅ 已重置: ${restaurant.name}`);
          successCount++;
        }
      }

      console.log(`✅ 成功重置 ${successCount} 間餐廳的更新時間`);
      return successCount;
    } catch (error) {
      console.error('重置更新時間失敗:', error);
      throw error;
    }
  }

  /**
   * 批次補充缺少座標的餐廳
   * @param {Array} restaurants - 缺少座標的餐廳列表
   * @returns {Promise<{success: number, failed: number}>} 補充結果
   */
  async fillMissingCoordinates(restaurants) {
    try {
      const adminClient = getSupabaseAdmin();
      if (!adminClient) {
        throw new Error('管理員客戶端不可用');
      }

      // 確保 Google Maps API 已載入
      const googleMapsLoader = (await import('../utils/googleMapsLoader')).default;
      await googleMapsLoader.load();

      // 動態載入 restaurantService
      const { restaurantService } = await import('./restaurantService');

      console.log(`🗺️ 準備為 ${restaurants.length} 間餐廳補充座標...`);

      let successCount = 0;
      let failedCount = 0;

      for (const restaurant of restaurants) {
        if (!restaurant.address) {
          console.warn(`⚠️ ${restaurant.name}: 沒有地址，跳過`);
          failedCount++;
          continue;
        }

        try {
          console.log(`📍 正在處理: ${restaurant.name} (${restaurant.address})`);

          // 使用 restaurantService 的 geocodeAddress 方法
          const coords = await restaurantService.geocodeAddress(restaurant.address);

          if (coords) {
            const { error } = await adminClient
              .from('restaurants')
              .update({
                latitude: coords.lat,
                longitude: coords.lng
              })
              .eq('id', restaurant.id);

            if (error) {
              console.error(`❌ 更新座標失敗: ${restaurant.name}`, error);
              failedCount++;
            } else {
              console.log(`✅ 已補充座標: ${restaurant.name} (${coords.lat}, ${coords.lng})`);
              successCount++;
            }
          } else {
            console.warn(`⚠️ 無法獲取座標: ${restaurant.name}`);
            failedCount++;
          }

          // 延遲以避免 API 限制
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`❌ 處理失敗: ${restaurant.name}`, error);
          failedCount++;
        }
      }

      console.log(`✅ 座標補充完成：成功 ${successCount} 間，失敗 ${failedCount} 間`);
      return { success: successCount, failed: failedCount };
    } catch (error) {
      console.error('批次補充座標失敗:', error);
      throw error;
    }
  }

  /**
   * 將 Place ID 儲存到資料庫
   * @param {string} restaurantId - 餐廳 ID
   * @param {string} placeId - Google Place ID
   */
  async savePlaceIdToDatabase(restaurantId, placeId) {
    try {
      const adminClient = getSupabaseAdmin();
      let result, error;

      if (adminClient) {
        const updateResult = await adminClient
          .from('restaurants')
          .update({ google_place_id: placeId })
          .eq('id', restaurantId)
          .select();
        result = updateResult.data;
        error = updateResult.error;
      } else {
        const updateResult = await supabase
          .from('restaurants')
          .update({ google_place_id: placeId })
          .eq('id', restaurantId)
          .select();
        result = updateResult.data;
        error = updateResult.error;
      }

      if (error) {
        console.error(`儲存 Place ID 到資料庫失敗: ${error.message}`);
        // 如果資料庫儲存失敗，回退到快取儲存
        this.savePlaceIdCache(restaurantId, placeId, 'Unknown');
        return false;
      }

      if (!result || result.length === 0) {
        console.warn(`找不到餐廳 ID ${restaurantId}，無法儲存 Place ID`);
        return false;
      }

      console.log(`✅ 成功將 Place ID ${placeId} 儲存到餐廳 ${restaurantId}`);
      return true;
    } catch (error) {
      console.error('儲存 Place ID 到資料庫時發生錯誤:', error);
      // 如果發生錯誤，回退到快取儲存
      this.savePlaceIdCache(restaurantId, placeId, 'Unknown');
      return false;
    }
  }

  /**
   * 獲取無法自動匹配的餐廳列表（優化版本，不重複API調用）
   * @param {Array} restaurants - 餐廳列表
   * @returns {Promise<Array>} 無法匹配的餐廳列表
   */
  async getUnmatchedRestaurants(restaurants) {
    // 優先從本地儲存載入
    const storedUnmatched = this.loadUnmatchedFromStorage();
    if (storedUnmatched.length > 0) {
      console.log(`📋 從本地儲存載入無法匹配餐廳: ${storedUnmatched.length} 間`);
      this.results.unmatched = storedUnmatched;
      return storedUnmatched;
    }

    // 如果最近有執行過批次更新，直接返回收集到的無法匹配餐廳
    if (this.results.unmatched.length > 0) {
      console.log(`📋 使用最近更新收集到的無法匹配餐廳: ${this.results.unmatched.length} 間`);
      return this.results.unmatched;
    }

    // 如果沒有現成的資料，執行輕量級檢測
    console.log(`🔍 執行輕量級檢測...`);

    const unmatchedRestaurants = [];

    // 只檢查明顯無法匹配的情況（避免 API 調用）
    for (const restaurant of restaurants.slice(0, 100)) {
      // 檢查基本資訊
      if (!restaurant.name || (!restaurant.latitude || !restaurant.longitude)) {
        unmatchedRestaurants.push({
          ...restaurant,
          reason: '缺少基本資訊（名稱或座標）'
        });
        continue;
      }

      // 檢查是否有明顯的問題（例如：名稱太短、座標異常等）
      if (restaurant.name.length < 2) {
        unmatchedRestaurants.push({
          ...restaurant,
          reason: '餐廳名稱過短'
        });
        continue;
      }

      // 檢查座標是否合理（台灣範圍）
      const lat = parseFloat(restaurant.latitude);
      const lng = parseFloat(restaurant.longitude);
      if (lat < 21.8 || lat > 25.4 || lng < 119.5 || lng > 122.1) {
        unmatchedRestaurants.push({
          ...restaurant,
          reason: '座標超出台灣範圍'
        });
        continue;
      }
    }

    console.log(`📊 輕量級檢測完成，發現 ${unmatchedRestaurants.length} 間可能有問題的餐廳`);
    console.log(`💡 提示：執行批次更新後將獲得更準確的無法匹配餐廳列表`);

    return unmatchedRestaurants;
  }

  /**
   * 手動搜尋 Google Places 來匹配餐廳
   * @param {Object} restaurant - 餐廳資料
   * @param {string} searchQuery - 自訂搜尋查詢
   * @returns {Promise<Array>} 搜尋結果列表
   */
  async manualSearchPlaces(restaurant, searchQuery = null) {
    try {
      // 載入 Google Maps API
      await googleMapsLoader.load();

      if (!window.google?.maps?.places) {
        throw new Error('Google Places API 無法使用');
      }

      const { Place } = await window.google.maps.importLibrary("places");

      // 使用自訂查詢或預設查詢
      const query = searchQuery || `${restaurant.name} ${restaurant.address || ''} 台灣 餐廳`.trim();

      const request = {
        textQuery: query,
        fields: ['displayName', 'formattedAddress', 'rating', 'userRatingCount', 'location', 'id'],
        locationBias: {
          center: {
            lat: parseFloat(restaurant.latitude),
            lng: parseFloat(restaurant.longitude)
          },
          radius: 2000 // 擴大搜尋範圍到 2 公里
        },
        maxResultCount: 10 // 返回更多結果供選擇
      };

      const { places } = await Place.searchByText(request);

      if (!places || places.length === 0) {
        return [];
      }

      // 計算每個結果的相似度和距離
      return places.map(place => {
        let lat, lng;
        if (place.location) {
          if (typeof place.location.lat === 'number') {
            lat = place.location.lat;
            lng = place.location.lng;
          } else if (typeof place.location.lat === 'function') {
            lat = place.location.lat();
            lng = place.location.lng();
          } else if (place.location.toJSON) {
            const coords = place.location.toJSON();
            lat = coords.lat;
            lng = coords.lng;
          }
        }

        const distance = lat && lng ? this.calculateDistance(
          parseFloat(restaurant.latitude),
          parseFloat(restaurant.longitude),
          lat,
          lng
        ) : null;

        const nameSimilarity = this.calculateStringSimilarity(
          restaurant.name.toLowerCase(),
          place.displayName.toLowerCase()
        );

        return {
          place_id: place.id,
          name: place.displayName,
          address: place.formattedAddress,
          rating: place.rating,
          user_ratings_total: place.userRatingCount,
          latitude: lat,  // 新增：回傳座標
          longitude: lng, // 新增：回傳座標
          distance: distance,
          nameSimilarity: nameSimilarity,
          combinedScore: nameSimilarity * 0.7 + (distance ? Math.max(0, 1 - distance) * 0.3 : 0)
        };
      }).sort((a, b) => b.combinedScore - a.combinedScore); // 按相似度排序

    } catch (error) {
      console.error('手動搜尋失敗:', error);
      throw error;
    }
  }

  /**
   * 清除餐廳的 Google Places 綁定資料
   * @param {string} restaurantId - 餐廳 ID
   * @param {boolean} clearCoordinates - 是否同時清除座標
   * @returns {Promise<Object>} 清除結果
   */
  async clearRestaurantGoogleData(restaurantId, clearCoordinates = false) {
    try {
      const updateData = {
        google_place_id: null,
        rating: null,
        user_ratings_total: null,
        rating_updated_at: new Date().toISOString()
      };

      // 如果要清除座標
      if (clearCoordinates) {
        updateData.latitude = null;
        updateData.longitude = null;
        console.log('🗑️ 將清除座標資料');
      }

      console.log('🗑️ 清除 Google Places 資料:', updateData);

      // 嘗試使用管理員客戶端進行更新
      const adminClient = getSupabaseAdmin();
      let updateResult, error;

      if (adminClient) {
        const result = await adminClient
          .from('restaurants')
          .update(updateData)
          .eq('id', restaurantId)
          .select();
        updateResult = result.data;
        error = result.error;
      } else {
        const result = await supabase
          .from('restaurants')
          .update(updateData)
          .eq('id', restaurantId)
          .select();
        updateResult = result.data;
        error = result.error;
      }

      if (error) {
        throw new Error(`資料庫更新失敗: ${error.message}`);
      }

      if (!updateResult || updateResult.length === 0) {
        throw new Error(`清除失敗：找不到餐廳 ID ${restaurantId}`);
      }

      console.log(`✅ 成功清除餐廳 ${restaurantId} 的 Google Places 資料`);

      return {
        success: true,
        cleared: updateResult[0]
      };

    } catch (error) {
      console.error('清除 Google Places 資料失敗:', error);
      throw error;
    }
  }

  /**
   * 手動更新餐廳評分（使用選定的 Place）
   * @param {string} restaurantId - 餐廳 ID
   * @param {Object} selectedPlace - 選定的 Google Place 資料
   * @returns {Promise<Object>} 更新結果
   */
  async manualUpdateRestaurant(restaurantId, selectedPlace) {
    try {
      const updateData = {
        rating_updated_at: new Date().toISOString()
      };

      if (selectedPlace.rating !== undefined) {
        updateData.rating = selectedPlace.rating;
      }

      if (selectedPlace.user_ratings_total !== undefined) {
        updateData.user_ratings_total = selectedPlace.user_ratings_total;
      }

      // 儲存 Google Place ID 到資料庫
      if (selectedPlace.place_id) {
        updateData.google_place_id = selectedPlace.place_id;
      }

      // 新增：更新座標（如果有提供）
      if (selectedPlace.latitude !== undefined && selectedPlace.longitude !== undefined) {
        updateData.latitude = selectedPlace.latitude;
        updateData.longitude = selectedPlace.longitude;
        console.log(`📍 將更新座標: (${selectedPlace.latitude}, ${selectedPlace.longitude})`);
      }


      // 嘗試使用管理員客戶端進行更新
      const adminClient = getSupabaseAdmin();
      let updateResult, error;

      if (adminClient) {
        const result = await adminClient
          .from('restaurants')
          .update(updateData)
          .eq('id', restaurantId)
          .select();
        updateResult = result.data;
        error = result.error;
      } else {
        const result = await supabase
          .from('restaurants')
          .update(updateData)
          .eq('id', restaurantId)
          .select();
        updateResult = result.data;
        error = result.error;
      }

      if (error) {
        throw new Error(`資料庫更新失敗: ${error.message}`);
      }

      if (!updateResult || updateResult.length === 0) {
        throw new Error(`更新失敗：找不到餐廳 ID ${restaurantId}`);
      }

      // 儲存手動匹配的 Place ID 到資料庫
      if (selectedPlace.place_id) {
        await this.savePlaceIdToDatabase(restaurantId, selectedPlace.place_id);
        console.log(`💾 已將手動匹配的 Place ID 存入資料庫: ${selectedPlace.name} -> ${selectedPlace.place_id}`);
      }

      return {
        success: true,
        updated: updateResult[0],
        selectedPlace: selectedPlace
      };

    } catch (error) {
      console.error('手動更新餐廳失敗:', error);
      throw error;
    }
  }
}

// 創建單例
const restaurantRatingService = new RestaurantRatingService();

export { restaurantRatingService };
export default restaurantRatingService;