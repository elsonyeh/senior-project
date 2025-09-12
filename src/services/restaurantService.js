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
   * @param {boolean} filters.featured - 是否只顯示推薦餐廳
   * @returns {Promise<Array>} 餐廳列表
   */
  async getRestaurants(filters = {}) {
    try {
      let query = supabase
        .from('restaurants')
        .select(`
          *,
          restaurant_images!inner(
            image_url,
            alt_text,
            is_primary
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
      
      if (filters.featured) {
        query = query.eq('featured', true);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      // 處理餐廳圖片，確保每個餐廳都有主要圖片
      const processedData = data.map(restaurant => ({
        ...restaurant,
        primaryImage: restaurant.restaurant_images.find(img => img.is_primary) || restaurant.restaurant_images[0],
        allImages: restaurant.restaurant_images
      }));
      
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
          restaurant_images!inner(image_url, is_primary)
        `)
        .eq('is_active', true)
        .or(`name.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%`)
        .limit(20);

      if (error) throw error;
      
      return data.map(restaurant => ({
        ...restaurant,
        primaryImage: restaurant.restaurant_images.find(img => img.is_primary) || restaurant.restaurant_images[0]
      }));
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
      // 使用管理客戶端以繞過RLS限制
      const client = supabaseAdmin || supabase;
      
      const { data, error } = await client
        .from('restaurants')
        .insert([restaurantData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('新增餐廳失敗:', error);
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
      // 產生唯一檔案名稱
      const fileExt = file.name.split('.').pop();
      const fileName = `${restaurantId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      // 如果有進度回調，模擬上傳進度
      if (options.onProgress) {
        options.onProgress(0);
        // 模擬上傳進度
        const progressInterval = setInterval(() => {
          const currentProgress = Math.min(90, Math.random() * 50 + 30);
          options.onProgress(currentProgress);
        }, 200);
        
        // 上傳到 Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('restaurant-images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        clearInterval(progressInterval);
        if (options.onProgress) {
          options.onProgress(100);
        }

        if (uploadError) throw uploadError;
      } else {
        // 沒有進度回調的傳統上傳
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('restaurant-images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;
      }

      // 獲取公開 URL
      const { data: urlData } = supabase.storage
        .from('restaurant-images')
        .getPublicUrl(fileName);

      // 儲存圖片記錄到資料庫
      const imageData = {
        restaurant_id: restaurantId,
        image_url: urlData.publicUrl,
        image_path: fileName,
        source_type: 'upload',
        alt_text: options.altText || `${restaurantId} 照片`,
        image_type: options.imageType || 'general',
        is_primary: options.isPrimary || false,
        display_order: options.displayOrder || 0,
        file_size: file.size,
        width: options.width,
        height: options.height,
        uploaded_by: options.uploadedBy
      };

      const { data, error } = await supabase
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

      const { data, error } = await supabase
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
      // 先獲取圖片資訊
      const { data: imageData, error: fetchError } = await supabase
        .from('restaurant_images')
        .select('image_path, source_type')
        .eq('id', imageId)
        .single();

      if (fetchError) throw fetchError;

      // 如果是上傳的檔案，從 Storage 刪除
      if (imageData.source_type === 'upload' && imageData.image_path) {
        const { error: storageError } = await supabase.storage
          .from('restaurant-images')
          .remove([imageData.image_path]);

        if (storageError) {
          console.warn('Storage 刪除失敗，但繼續刪除資料庫記錄:', storageError);
        }
      }
      // 外部連結圖片不需要刪除檔案，只需刪除資料庫記錄

      // 從資料庫刪除記錄
      const { error: dbError } = await supabase
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
   * 設定主要照片
   * @param {string} imageId - 圖片 ID
   * @param {string} restaurantId - 餐廳 ID
   * @returns {Promise<boolean>} 是否成功
   */
  async setPrimaryImage(imageId, restaurantId) {
    try {
      // 先將該餐廳的所有圖片設為非主要
      await supabase
        .from('restaurant_images')
        .update({ is_primary: false })
        .eq('restaurant_id', restaurantId);

      // 設定指定圖片為主要
      const { error } = await supabase
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