// 用戶數據服務 - 管理收藏清單和歷史記錄
import { supabase } from './supabaseService.js';

export const userDataService = {
  // 獲取用戶的收藏清單
  async getFavoriteLists(userId, userEmail = null) {
    try {
      // 確保用戶檔案存在
      if (userEmail) {
        await this.ensureUserProfile(userId, userEmail);
      }

      const { data, error } = await supabase
        .from('user_favorite_lists')
        .select(`
          id,
          name,
          description,
          color,
          is_public,
          is_default,
          is_deletable,
          places_count,
          created_at,
          updated_at,
          favorite_list_places (
            id,
            restaurant_id,
            notes,
            added_at,
            restaurants (
              id,
              name,
              address,
              rating,
              latitude,
              longitude,
              category,
              restaurant_images (
                image_url,
                is_primary,
                display_order
              )
            )
          )
        `)
        .eq('user_id', userId)
        .order('is_default', { ascending: false }) // 預設清單排在最前面
        .order('created_at', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        lists: data || []
      };
    } catch (error) {
      console.error('獲取收藏清單失敗:', error);
      return {
        success: false,
        error: this.getErrorMessage(error),
        lists: []
      };
    }
  },

  // 確保用戶檔案存在
  async ensureUserProfile(userId, userEmail, userName = null) {
    try {
      // 先檢查用戶檔案是否存在
      const { data: existingUser, error: selectError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle(); // 使用 maybeSingle() 代替 single()

      if (selectError) {
        console.error('查詢用戶檔案失敗:', selectError);
        return false;
      }

      // 如果用戶檔案已存在，直接返回成功
      if (existingUser) {
        return true;
      }

      // 用戶檔案不存在，嘗試創建
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          email: userEmail,
          name: userName || userEmail.split('@')[0],
          avatar_url: null,
          bio: '',
          favorite_lists_count: 0,
          swifttaste_count: 0,
          buddies_count: 0
        });

      if (insertError) {
        // 如果是因為用戶檔案已存在導致的錯誤，也算成功
        if (insertError.code === '23505') {
          console.log('用戶檔案已存在，跳過創建');
          return true;
        }
        console.error('創建用戶檔案失敗:', insertError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('檢查用戶檔案失敗:', error);
      return false;
    }
  },

  // 創建新的收藏清單
  async createFavoriteList(userId, listData, userEmail = null) {
    try {
      // 確保用戶檔案存在
      if (userEmail) {
        await this.ensureUserProfile(userId, userEmail);
      }

      const { data, error } = await supabase
        .from('user_favorite_lists')
        .insert([{
          user_id: userId,
          name: listData.name,
          description: listData.description || '',
          color: listData.color || '#ff6b35',
          is_public: listData.is_public || false
        }])
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        list: data,
        message: '收藏清單已創建'
      };
    } catch (error) {
      console.error('創建收藏清單失敗:', error);
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  },

  // 更新收藏清單
  async updateFavoriteList(listId, updates) {
    try {
      const { data, error } = await supabase
        .from('user_favorite_lists')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', listId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        list: data,
        message: '收藏清單已更新'
      };
    } catch (error) {
      console.error('更新收藏清單失敗:', error);
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  },

  // 刪除收藏清單
  async deleteFavoriteList(listId) {
    try {
      // 先檢查清單是否可刪除
      const { data: list, error: checkError } = await supabase
        .from('user_favorite_lists')
        .select('is_deletable, is_default, name')
        .eq('id', listId)
        .single();

      if (checkError) throw checkError;

      // 如果是不可刪除的清單（如預設清單），拒絕刪除
      if (list && list.is_deletable === false) {
        return {
          success: false,
          error: `「${list.name}」是預設清單，無法刪除`
        };
      }

      // 執行刪除
      const { error } = await supabase
        .from('user_favorite_lists')
        .delete()
        .eq('id', listId);

      if (error) throw error;

      return {
        success: true,
        message: '收藏清單已刪除'
      };
    } catch (error) {
      console.error('刪除收藏清單失敗:', error);
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  },

  // 添加地點到收藏清單
  async addPlaceToList(listId, placeData) {
    try {
      // 檢查地點是否已存在
      const { data: existingPlace, error: checkError } = await supabase
        .from('favorite_list_places')
        .select('id')
        .eq('list_id', listId)
        .eq('restaurant_id', placeData.place_id)
        .maybeSingle(); // 使用 maybeSingle() 避免 406 錯誤

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingPlace) {
        return {
          success: false,
          error: '此餐廳已在收藏清單中'
        };
      }

      // 首先確保餐廳資訊存在於 restaurants 表格中
      const restaurantData = {
        id: placeData.place_id,
        name: placeData.name || '未知餐廳',
        address: placeData.address || '',
        rating: placeData.rating || null,
        latitude: placeData.latitude || null,
        longitude: placeData.longitude || null,
        category: placeData.category || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // 使用 upsert 來插入或更新餐廳資訊
      const { error: restaurantError } = await supabase
        .from('restaurants')
        .upsert(restaurantData, {
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (restaurantError) {
        console.warn('餐廳資訊存儲失敗:', restaurantError);
        // 繼續執行，不要因為餐廳資訊存儲失敗而中斷
      }

      // 如果有照片 URL，嘗試存儲餐廳圖片
      if (placeData.photo_url) {
        // 先檢查是否已存在相同的圖片
        const { data: existingImage } = await supabase
          .from('restaurant_images')
          .select('id')
          .eq('restaurant_id', placeData.place_id)
          .eq('image_url', placeData.photo_url)
          .single();

        // 如果不存在，才插入
        if (!existingImage) {
          const { error: imageError } = await supabase
            .from('restaurant_images')
            .insert({
              restaurant_id: placeData.place_id,
              image_url: placeData.photo_url,
              is_primary: true,
              display_order: 1,
              created_at: new Date().toISOString()
            });

          if (imageError) {
            console.warn('餐廳圖片存儲失敗:', imageError);
          }
        }
      }

      // 添加到收藏清單
      const { data, error } = await supabase
        .from('favorite_list_places')
        .insert([{
          list_id: listId,
          restaurant_id: placeData.place_id,
          notes: placeData.notes || ''
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      return {
        success: true,
        place: data,
        message: '餐廳已加入收藏清單'
      };
    } catch (error) {
      console.error('添加地點失敗:', error);
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  },

  // 從收藏清單移除地點 (根據記錄ID)
  async removePlaceFromList(placeId) {
    try {
      const { error } = await supabase
        .from('favorite_list_places')
        .delete()
        .eq('id', placeId);

      if (error) throw error;

      return {
        success: true,
        message: '餐廳已從收藏清單移除'
      };
    } catch (error) {
      console.error('移除地點失敗:', error);
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  },

  // 從收藏清單移除地點 (根據清單ID和餐廳ID)
  async removePlaceFromListByRestaurant(listId, restaurantId) {
    try {
      const { error } = await supabase
        .from('favorite_list_places')
        .delete()
        .eq('list_id', listId)
        .eq('restaurant_id', restaurantId);

      if (error) throw error;

      return {
        success: true,
        message: '餐廳已從收藏清單移除'
      };
    } catch (error) {
      console.error('移除地點失敗:', error);
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  },

  // 從收藏清單移除地點 (根據清單ID和地點ID)
  async removePlaceFromListByPlaceId(listId, placeId) {
    try {
      const { error } = await supabase
        .from('favorite_list_places')
        .delete()
        .eq('list_id', listId)
        .eq('restaurant_id', placeId);

      if (error) throw error;

      return {
        success: true,
        message: '餐廳已從收藏清單移除'
      };
    } catch (error) {
      console.error('移除地點失敗:', error);
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  },

  // 更新用戶個人資料
  async updateUserProfile(userId, profileData) {
    try {
      // 確保用戶檔案存在
      await this.ensureUserProfile(userId, profileData.email, profileData.name);

      // 構建更新數據對象
      const updateData = {
        name: profileData.name,
        bio: profileData.bio,
        avatar_url: profileData.avatar_url,
        updated_at: new Date().toISOString()
      };

      // 添加基本個人資料欄位
      if (profileData.gender !== undefined) updateData.gender = profileData.gender;
      if (profileData.birth_date !== undefined) updateData.birth_date = profileData.birth_date;
      if (profileData.occupation !== undefined) updateData.occupation = profileData.occupation;
      if (profileData.location !== undefined) updateData.location = profileData.location;

      const { data, error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        profile: data,
        message: '個人資料已更新'
      };
    } catch (error) {
      console.error('更新用戶個人資料失敗:', error);
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  },

  // 獲取用戶個人資料
  async getUserProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // 如果用戶檔案不存在，返回預設值
        if (error.code === 'PGRST116') {
          return {
            success: true,
            profile: null
          };
        }
        throw error;
      }

      return {
        success: true,
        profile: data
      };
    } catch (error) {
      console.error('獲取用戶個人資料失敗:', error);
      return {
        success: false,
        error: this.getErrorMessage(error),
        profile: null
      };
    }
  },

  // 獲取用戶統計數據
  async getUserStats(userId) {
    try {
      // 從 selection_sessions 表動態計算使用次數
      const { data: sessions, error: sessionsError } = await supabase
        .from('selection_sessions')
        .select('mode')
        .eq('user_id', userId);

      if (sessionsError) {
        console.error('查詢 selection_sessions 失敗:', sessionsError);
      }

      // 計算各模式的使用次數
      const swifttaste_count = sessions?.filter(s => s.mode === 'swifttaste').length || 0;
      const buddies_count = sessions?.filter(s => s.mode === 'buddies').length || 0;

      // 獲取收藏清單數量（保持原有邏輯）
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('favorite_lists_count')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      const favorite_lists_count = profileData?.favorite_lists_count || 0;

      // 更新 user_profiles 表中的統計數據（異步更新，不阻塞返回）
      supabase
        .from('user_profiles')
        .update({
          swifttaste_count,
          buddies_count
        })
        .eq('id', userId)
        .then(({ error: updateError }) => {
          if (updateError) {
            console.error('更新統計數據失敗:', updateError);
          }
        });

      return {
        success: true,
        stats: {
          favorite_lists_count,
          swifttaste_count,
          buddies_count
        }
      };
    } catch (error) {
      console.error('獲取用戶統計失敗:', error);
      return {
        success: false,
        error: this.getErrorMessage(error),
        stats: {
          favorite_lists_count: 0,
          swifttaste_count: 0,
          buddies_count: 0
        }
      };
    }
  },

  // 錯誤訊息處理
  getErrorMessage(error) {
    const errorMessages = {
      '23505': '資料已存在',
      '23503': '相關資料不存在',
      '42501': '權限不足'
    };

    if (error.code && errorMessages[error.code]) {
      return errorMessages[error.code];
    }

    return error.message || '操作失敗，請稍後再試';
  }
};

export default userDataService;