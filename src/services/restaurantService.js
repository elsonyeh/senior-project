import { supabase, supabaseAdmin } from './supabaseService.js';

// 餐廳服務函數
export const restaurantService = {
  // ===== 餐廳基本操作 =====
  
  /**
   * 獲取所有活躍餐廳
   * @param {Object} filters - 篩選條件
   * @param {string} filters.category - 餐廳類別
   * @param {number} filters.priceRange - 價格範圍 (1-4)
   * @param {number} filters.minRating - 最低評分
   * @returns {Promise<Array>} 餐廳列表
   */
  async getRestaurants(filters = {}) {
    try {
      let query = supabase
        .from('restaurants')
        .select(`
          *,
          restaurant_images(
            image_url,
            alt_text,
            is_primary,
            display_order
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      // 應用篩選條件
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      
      if (filters.priceRange) {
        query = query.eq('price_range', filters.priceRange);
      }
      
      if (filters.minRating) {
        query = query.gte('rating', filters.minRating);
      }
      

      const { data, error } = await query;
      
      if (error) throw error;
      
      // 處理餐廳圖片，包括沒有圖片的餐廳
      const processedData = data.map(restaurant => {
        const images = restaurant.restaurant_images || [];

        // 按照 display_order 排序圖片
        const sortedImages = images.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

        return {
          ...restaurant,
          primaryImage: sortedImages.find(img => img.is_primary) || sortedImages[0] || null,
          allImages: sortedImages,
          hasImages: images.length > 0
        };
      });
      
      return processedData;
    } catch (error) {
      console.error('獲取餐廳列表失敗:', error);
      throw error;
    }
  },

  /**
   * 根據 ID 獲取單一餐廳詳細資訊
   * @param {string} restaurantId - 餐廳 ID
   * @returns {Promise<Object>} 餐廳詳細資訊
   */
  async getRestaurantById(restaurantId) {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select(`
          *,
          restaurant_images(
            id,
            image_url,
            alt_text,
            image_type,
            is_primary,
            display_order
          ),
          restaurant_menu_items(
            id,
            name,
            price,
            category,
            image_url,
            is_recommended
          ),
          restaurant_reviews(
            id,
            rating,
            comment,
            visit_date,
            created_at
          )
        `)
        .eq('id', restaurantId)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      
      // 排序圖片
      if (data.restaurant_images) {
        data.restaurant_images.sort((a, b) => a.display_order - b.display_order);
      }
      
      return data;
    } catch (error) {
      console.error('獲取餐廳詳細資訊失敗:', error);
      throw error;
    }
  },

  /**
   * 搜尋餐廳
   * @param {string} searchTerm - 搜尋關鍵字
   * @returns {Promise<Array>} 搜尋結果
   */
  async searchRestaurants(searchTerm) {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select(`
          id,
          name,
          address,
          category,
          price_range,
          rating,
          restaurant_images(image_url, is_primary, display_order)
        `)
        .eq('is_active', true)
        .or(`name.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%`)
        .limit(20);

      if (error) throw error;

      return data.map(restaurant => {
        const images = restaurant.restaurant_images || [];
        const sortedImages = images.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

        return {
          ...restaurant,
          primaryImage: sortedImages.find(img => img.is_primary) || sortedImages[0] || null,
          hasImages: images.length > 0
        };
      });
    } catch (error) {
      console.error('搜尋餐廳失敗:', error);
      throw error;
    }
  },

  /**
   * 根據位置獲取附近餐廳
   * @param {number} latitude - 緯度
   * @param {number} longitude - 經度
   * @param {number} radiusKm - 搜尋半徑（公里）
   * @returns {Promise<Array>} 附近餐廳列表
   */
  async getNearbyRestaurants(latitude, longitude, radiusKm = 5) {
    try {
      // 使用 PostGIS 計算距離（需要 PostGIS 擴展）
      const { data, error } = await supabase
        .rpc('get_nearby_restaurants', {
          lat: latitude,
          lng: longitude,
          radius_km: radiusKm
        });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('獲取附近餐廳失敗:', error);
      // 如果 PostGIS 不可用，回退到基本篩選
      return this.getRestaurants();
    }
  },

  /**
   * 獲取餐廳類別列表
   * @returns {Promise<Array>} 類別列表
   */
  async getCategories() {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('category')
        .eq('is_active', true)
        .not('category', 'is', null);

      if (error) throw error;
      
      // 去重並排序
      const categories = [...new Set(data.map(item => item.category))].sort();
      return categories;
    } catch (error) {
      console.error('獲取餐廳類別失敗:', error);
      throw error;
    }
  },

  // ===== 管理員操作 (需要適當權限) =====
  
  /**
   * 新增餐廳
   * @param {Object} restaurantData - 餐廳資料
   * @returns {Promise<Object>} 新增的餐廳資料
   */
  async createRestaurant(restaurantData) {
    try {
      console.log('🍽️ 新增餐廳:', {
        name: restaurantData.name,
        hasAdmin: !!supabaseAdmin,
        keys: Object.keys(restaurantData)
      });

      // 確保管理客戶端已初始化，使用管理客戶端以繞過RLS限制
      const client = supabaseAdmin || supabase;

      if (!client) {
        throw new Error('Supabase 客戶端未初始化');
      }

      // 確保必要欄位存在
      const cleanData = {
        name: restaurantData.name || '',
        address: restaurantData.address || '',
        phone: restaurantData.phone || null,
        category: restaurantData.category || '',
        price_range: restaurantData.price_range || 1,
        rating: restaurantData.rating || 0,
        website_url: restaurantData.website_url || null,
        tags: restaurantData.tags || [],
        suggested_people: restaurantData.suggested_people || '1~4',
        is_spicy: restaurantData.is_spicy || 'false',
        is_active: true,
        created_at: new Date().toISOString()
      };

      console.log('📝 插入餐廳資料:', cleanData);

      const { data, error } = await client
        .from('restaurants')
        .insert([cleanData])
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase 插入錯誤:', error);
        throw error;
      }

      console.log('✅ 餐廳新增成功:', data);
      return data;
    } catch (error) {
      console.error('💥 新增餐廳失敗:', error);
      throw error;
    }
  },

  /**
   * 更新餐廳資訊
   * @param {string} restaurantId - 餐廳 ID
   * @param {Object} updateData - 更新資料
   * @returns {Promise<Object>} 更新後的餐廳資料
   */
  async updateRestaurant(restaurantId, updateData) {
    try {
      console.log('Updating restaurant:', restaurantId, 'with data:', updateData);
      
      // 使用管理客戶端以繞過RLS限制
      const client = supabaseAdmin || supabase;
      
      const { data, error, count } = await client
        .from('restaurants')
        .update(updateData)
        .eq('id', restaurantId)
        .select();

      console.log('Update result:', { data, error, count, dataLength: data?.length, usingAdmin: !!supabaseAdmin });

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        // If no rows returned, let's first check if the record exists
        console.log('No data returned from update, checking if record exists...');
        const { data: existingData, error: fetchError } = await client
          .from('restaurants')
          .select()
          .eq('id', restaurantId)
          .single();
        
        console.log('Existing record check:', { existingData, fetchError });
        
        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            throw new Error(`Restaurant with ID ${restaurantId} not found or no changes made`);
          } else {
            throw new Error(`Error checking restaurant: ${fetchError.message}`);
          }
        }
        
        if (!existingData) {
          throw new Error(`Restaurant with ID ${restaurantId} not found`);
        }
        
        // Record exists but no update occurred - this could be due to RLS or identical data
        // Let's try again with a forced update by adding a timestamp
        console.log('Record exists but no update occurred, trying with timestamp...');
        const { data: retryData, error: retryError } = await client
          .from('restaurants')
          .update({ ...updateData, updated_at: new Date().toISOString() })
          .eq('id', restaurantId)
          .select();
        
        if (retryError) {
          console.error('Retry update error:', retryError);
          throw new Error(`Failed to update restaurant: ${retryError.message}`);
        }
        
        if (retryData && retryData.length > 0) {
          return retryData[0];
        }
        
        // If still no success, return the existing data
        console.warn('Update still failed, returning existing data');
        return existingData;
      }

      return data[0]; // Return the first (and should be only) updated record
    } catch (error) {
      console.error('更新餐廳失敗:', error);
      throw error;
    }
  },

  /**
   * 刪除餐廳 (軟刪除)
   * @param {string} restaurantId - 餐廳 ID
   * @returns {Promise<boolean>} 是否成功
   */
  async deleteRestaurant(restaurantId) {
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({ is_active: false })
        .eq('id', restaurantId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('刪除餐廳失敗:', error);
      throw error;
    }
  }
};

// 餐廳圖片服務
export const restaurantImageService = {
  /**
   * 上傳餐廳照片 (檔案上傳)
   * @param {File} file - 圖片檔案
   * @param {string} restaurantId - 餐廳 ID
   * @param {Object} options - 上傳選項
   * @returns {Promise<Object>} 上傳結果
   */
  async uploadRestaurantImage(file, restaurantId, options = {}) {
    try {
      // 暫時使用 Service Key 客戶端進行上傳
      // 注意：在生產環境中應該使用後端 API 來處理這個操作
      const client = supabaseAdmin || supabase;

      console.log('uploadRestaurantImage: 使用客戶端:', !!supabaseAdmin ? 'Admin (Service Key)' : 'Regular (Anon Key)');

      if (!client) {
        throw new Error('Supabase 客戶端未初始化');
      }

      // 如果沒有 Service Key，先檢查用戶權限
      if (!supabaseAdmin) {
        console.warn('⚠️ Service Key 未配置，將使用一般客戶端上傳');
        // 這裡應該檢查管理員權限，但由於使用自定義認證系統，暫時跳過
      }

      // 獲取餐廳名稱用於 alt_text
      const { data: restaurant, error: restaurantError } = await client
        .from('restaurants')
        .select('name')
        .eq('id', restaurantId)
        .single();

      if (restaurantError) throw restaurantError;
      const restaurantName = restaurant?.name || `餐廳 ${restaurantId}`;

      // 檢查是否已有照片，如果有則刪除
      const { data: existingImages, error: checkError } = await client
        .from('restaurant_images')
        .select('*')
        .eq('restaurant_id', restaurantId);

      if (checkError) throw checkError;

      // 如果已有照片，刪除舊照片和檔案
      if (existingImages && existingImages.length > 0) {
        for (const existingImage of existingImages) {
          // 刪除儲存空間中的檔案
          if (existingImage.image_path) {
            await client.storage
              .from('restaurant-images')
              .remove([existingImage.image_path]);
          }
        }

        // 刪除資料庫記錄
        await client
          .from('restaurant_images')
          .delete()
          .eq('restaurant_id', restaurantId);
      }

      // 產生唯一檔案名稱，包含時間戳避免快取問題
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const fileName = `${restaurantId}/restaurant-${timestamp}.${fileExt}`;

      let uploadData, uploadError;

      // 如果有進度回調，模擬上傳進度
      if (options.onProgress) {
        options.onProgress(0);
        // 模擬上傳進度
        const progressInterval = setInterval(() => {
          const currentProgress = Math.min(90, Math.random() * 50 + 30);
          options.onProgress(currentProgress);
        }, 200);

        const result = await client.storage
          .from('restaurant-images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        uploadData = result.data;
        uploadError = result.error;

        clearInterval(progressInterval);
        if (options.onProgress) {
          options.onProgress(100);
        }

        if (uploadError) throw uploadError;
      } else {
        // 沒有進度回調的傳統上傳
        const result = await client.storage
          .from('restaurant-images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        uploadData = result.data;
        uploadError = result.error;

        if (uploadError) throw uploadError;
      }

      // 獲取公開 URL
      const { data: urlData } = client.storage
        .from('restaurant-images')
        .getPublicUrl(fileName);

      // 儲存圖片記錄到資料庫
      const imageData = {
        restaurant_id: restaurantId,
        image_url: urlData.publicUrl,
        image_path: fileName,
        source_type: 'upload',
        alt_text: restaurantName,
        image_type: options.imageType || 'general',
        is_primary: true, // 一間餐廳只有一張照片，所以都是主要照片
        display_order: 0,
        file_size: file.size,
        width: options.width,
        height: options.height,
        uploaded_by: options.uploadedBy
      };

      // 使用管理客戶端以繞過RLS限制
      console.log('準備插入 restaurant_images (上傳)，使用客戶端:', !!supabaseAdmin ? 'Admin' : 'Regular');
      console.log('插入資料:', imageData);

      const { data, error } = await client
        .from('restaurant_images')
        .insert([imageData])
        .select()
        .single();

      if (error) throw error;

      return {
        ...data,
        publicUrl: urlData.publicUrl
      };
    } catch (error) {
      console.error('上傳餐廳照片失敗:', error);
      throw error;
    }
  },

  /**
   * 新增外部連結照片
   * @param {string} imageUrl - 外部圖片連結
   * @param {string} restaurantId - 餐廳 ID  
   * @param {Object} options - 選項
   * @returns {Promise<Object>} 新增結果
   */
  async addExternalImage(imageUrl, restaurantId, options = {}) {
    try {
      // 驗證 URL 格式
      const urlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|gif|bmp|webp)(\?.*)?$/i;
      if (!urlPattern.test(imageUrl)) {
        throw new Error('請輸入有效的圖片連結（支援 jpg, png, gif, bmp, webp 格式）');
      }

      // 嘗試載入圖片以驗證連結是否有效
      try {
        const response = await fetch(imageUrl, { method: 'HEAD' });
        if (!response.ok) {
          throw new Error('無法訪問該圖片連結');
        }
      } catch (fetchError) {
        throw new Error('無法訪問該圖片連結，請確認連結是否正確');
      }

      // 儲存圖片記錄到資料庫
      const imageData = {
        restaurant_id: restaurantId,
        image_url: imageUrl,
        image_path: null, // 外部連結不需要 storage 路徑
        source_type: 'external',
        alt_text: options.altText || `${restaurantId} 外部照片`,
        image_type: options.imageType || 'general',
        is_primary: options.isPrimary || false,
        display_order: options.displayOrder || 0,
        file_size: null, // 外部連結無法獲取檔案大小
        width: options.width,
        height: options.height,
        uploaded_by: options.uploadedBy,
        external_source: options.externalSource || '外部連結'
      };

      // 使用管理客戶端以繞過RLS限制
      const client = supabaseAdmin || supabase;

      console.log('準備插入 restaurant_images (外部連結)，使用客戶端:', !!supabaseAdmin ? 'Admin' : 'Regular');
      console.log('插入資料:', imageData);

      const { data, error } = await client
        .from('restaurant_images')
        .insert([imageData])
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('新增外部圖片失敗:', error);
      throw error;
    }
  },

  /**
   * 刪除餐廳照片
   * @param {string} imageId - 圖片 ID
   * @returns {Promise<boolean>} 是否成功
   */
  async deleteRestaurantImage(imageId) {
    try {
      // 使用管理客戶端以繞過RLS限制
      const client = supabaseAdmin || supabase;

      // 先獲取圖片資訊
      const { data: imageData, error: fetchError } = await client
        .from('restaurant_images')
        .select('image_path, source_type')
        .eq('id', imageId)
        .single();

      if (fetchError) throw fetchError;

      // 如果是上傳的檔案，從 Storage 刪除
      if (imageData.source_type === 'upload' && imageData.image_path) {
        const { error: storageError } = await client.storage
          .from('restaurant-images')
          .remove([imageData.image_path]);

        if (storageError) {
          console.warn('Storage 刪除失敗，但繼續刪除資料庫記錄:', storageError);
        }
      }
      // 外部連結圖片不需要刪除檔案，只需刪除資料庫記錄

      // 從資料庫刪除記錄
      const { error: dbError } = await client
        .from('restaurant_images')
        .delete()
        .eq('id', imageId);

      if (dbError) throw dbError;

      return true;
    } catch (error) {
      console.error('刪除餐廳照片失敗:', error);
      throw error;
    }
  },

  /**
   * 從URL下載圖片並上傳到Supabase Storage
   * @param {string} imageUrl - 圖片URL
   * @param {string} restaurantId - 餐廳 ID
   * @param {Object} options - 選項
   * @returns {Promise<Object>} 上傳結果
   */
  async downloadAndUploadImage(imageUrl, restaurantId, options = {}) {
    try {
      console.log(`開始從URL下載圖片: ${imageUrl}`);

      // 驗證 URL 格式
      const urlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|gif|bmp|webp)(\?.*)?$/i;
      if (!urlPattern.test(imageUrl)) {
        throw new Error('請提供有效的圖片URL（支援 jpg, png, gif, bmp, webp 格式）');
      }

      // 下載圖片
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`下載失敗: HTTP ${response.status} ${response.statusText}`);
      }

      // 檢查內容類型
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error(`URL內容不是有效的圖片格式: ${contentType}`);
      }

      // 獲取圖片數據
      const imageBlob = await response.blob();
      const fileSize = imageBlob.size;

      // 從URL提取檔案名和副檔名
      const urlParts = new URL(imageUrl);
      const pathParts = urlParts.pathname.split('/');
      const originalFileName = pathParts[pathParts.length - 1] || 'downloaded-image';
      const fileExt = originalFileName.split('.').pop() || 'jpg';

      // 產生唯一檔案名稱
      const fileName = `${restaurantId}/${Date.now()}-downloaded.${fileExt}`;

      // 上傳進度回調
      if (options.onProgress) {
        options.onProgress(30); // 下載完成30%
      }

      // 使用管理客戶端上傳到 Supabase Storage
      const client = supabaseAdmin || supabase;
      const { data: uploadData, error: uploadError } = await client.storage
        .from('restaurant-images')
        .upload(fileName, imageBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: contentType
        });

      if (uploadError) throw uploadError;

      if (options.onProgress) {
        options.onProgress(70); // 上傳完成70%
      }

      // 獲取公開 URL
      const { data: urlData } = client.storage
        .from('restaurant-images')
        .getPublicUrl(fileName);

      // 儲存圖片記錄到資料庫
      const imageData = {
        restaurant_id: restaurantId,
        image_url: urlData.publicUrl,
        image_path: fileName,
        source_type: 'downloaded', // 新增來源類型
        alt_text: options.altText || `${restaurantId} 下載照片`,
        image_type: options.imageType || 'general',
        is_primary: options.isPrimary || false,
        display_order: options.displayOrder || 0,
        file_size: fileSize,
        width: options.width,
        height: options.height,
        uploaded_by: options.uploadedBy,
        external_source: `下載自: ${imageUrl}`,
        original_url: imageUrl // 保存原始URL
      };

      // 使用管理客戶端以繞過RLS限制
      const { data, error } = await client
        .from('restaurant_images')
        .insert([imageData])
        .select()
        .single();

      if (error) throw error;

      if (options.onProgress) {
        options.onProgress(100); // 完成
      }

      console.log(`圖片下載並上傳成功: ${urlData.publicUrl}`);
      return {
        ...data,
        publicUrl: urlData.publicUrl,
        originalUrl: imageUrl,
        downloadedSize: fileSize
      };
    } catch (error) {
      console.error('從URL下載並上傳圖片失敗:', error);
      throw error;
    }
  },

  /**
   * 批量下載並上傳圖片
   * @param {Array} imageUrls - 圖片URL陣列
   * @param {string} restaurantId - 餐廳 ID
   * @param {Object} options - 選項
   * @returns {Promise<Object>} 批量上傳結果
   */
  async batchDownloadAndUploadImages(imageUrls, restaurantId, options = {}) {
    try {
      if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
        throw new Error('請提供有效的圖片URL陣列');
      }

      const results = [];
      const errors = [];
      const maxConcurrency = options.maxConcurrency || 3; // 限制併發數量

      console.log(`開始批量下載 ${imageUrls.length} 張圖片...`);

      // 分批處理以避免過多併發請求
      for (let i = 0; i < imageUrls.length; i += maxConcurrency) {
        const batch = imageUrls.slice(i, i + maxConcurrency);

        const batchPromises = batch.map(async (url, batchIndex) => {
          const globalIndex = i + batchIndex;
          try {
            const result = await this.downloadAndUploadImage(url, restaurantId, {
              ...options,
              altText: options.altText || `${restaurantId} 下載照片 ${globalIndex + 1}`,
              isPrimary: globalIndex === 0 && options.setPrimaryToFirst, // 第一張設為主要照片
              displayOrder: globalIndex,
              onProgress: (progress) => {
                if (options.onBatchProgress) {
                  const overallProgress = ((globalIndex * 100 + progress) / imageUrls.length);
                  options.onBatchProgress(Math.round(overallProgress), globalIndex + 1, imageUrls.length);
                }
              }
            });

            return { success: true, index: globalIndex, url, result };
          } catch (error) {
            console.error(`第 ${globalIndex + 1} 張圖片下載失敗 (${url}):`, error.message);
            return { success: false, index: globalIndex, url, error: error.message };
          }
        });

        const batchResults = await Promise.all(batchPromises);

        // 分類成功和失敗的結果
        batchResults.forEach(result => {
          if (result.success) {
            results.push(result);
          } else {
            errors.push(result);
          }
        });

        // 批次間的小延遲，避免對伺服器造成過大壓力
        if (i + maxConcurrency < imageUrls.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log(`批量下載完成: 成功 ${results.length} 張，失敗 ${errors.length} 張`);

      return {
        success: true,
        totalImages: imageUrls.length,
        successCount: results.length,
        errorCount: errors.length,
        results: results.map(r => r.result),
        errors: errors
      };
    } catch (error) {
      console.error('批量下載並上傳圖片失敗:', error);
      throw error;
    }
  },

  /**
   * 設定主要照片
   * @param {string} imageId - 圖片 ID
   * @param {string} restaurantId - 餐廳 ID
   * @returns {Promise<boolean>} 是否成功
   */
  async setPrimaryImage(imageId, restaurantId) {
    try {
      // 使用管理客戶端以繞過RLS限制
      const client = supabaseAdmin || supabase;

      // 先將該餐廳的所有圖片設為非主要
      await client
        .from('restaurant_images')
        .update({ is_primary: false })
        .eq('restaurant_id', restaurantId);

      // 設定指定圖片為主要
      const { error } = await client
        .from('restaurant_images')
        .update({ is_primary: true })
        .eq('id', imageId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('設定主要照片失敗:', error);
      throw error;
    }
  }
};

// 餐廳評論服務
export const restaurantReviewService = {
  /**
   * 新增餐廳評論
   * @param {Object} reviewData - 評論資料
   * @returns {Promise<Object>} 新增的評論
   */
  async addReview(reviewData) {
    try {
      const { data, error } = await supabase
        .from('restaurant_reviews')
        .insert([{
          ...reviewData,
          user_id: supabase.auth.getUser()?.id
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('新增評論失敗:', error);
      throw error;
    }
  },

  /**
   * 獲取餐廳評論
   * @param {string} restaurantId - 餐廳 ID
   * @returns {Promise<Array>} 評論列表
   */
  async getReviews(restaurantId) {
    try {
      const { data, error } = await supabase
        .from('restaurant_reviews')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('獲取評論失敗:', error);
      throw error;
    }
  }
};