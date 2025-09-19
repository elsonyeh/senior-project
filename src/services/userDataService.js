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
          places_count,
          created_at,
          updated_at,
          favorite_list_places (
            id,
            place_id,
            name,
            address,
            rating,
            photo_url,
            notes,
            added_at
          )
        `)
        .eq('user_id', userId)
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
      const { data: existingPlace } = await supabase
        .from('favorite_list_places')
        .select('id')
        .eq('list_id', listId)
        .eq('place_id', placeData.place_id)
        .single();

      if (existingPlace) {
        return {
          success: false,
          error: '此餐廳已在收藏清單中'
        };
      }

      const { data, error } = await supabase
        .from('favorite_list_places')
        .insert([{
          list_id: listId,
          place_id: placeData.place_id,
          name: placeData.name,
          address: placeData.address || '',
          rating: placeData.rating || null,
          photo_url: placeData.photo_url || null,
          notes: placeData.notes || ''
        }])
        .select()
        .single();

      if (error) throw error;

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

  // 從收藏清單移除地點 (根據清單ID和地點ID)
  async removePlaceFromListByPlaceId(listId, placeId) {
    try {
      const { error } = await supabase
        .from('favorite_list_places')
        .delete()
        .eq('list_id', listId)
        .eq('place_id', placeId);

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

  // 獲取 SwiftTaste 歷史記錄
  async getSwiftTasteHistory(userId, limit = 20, offset = 0) {
    try {
      const { data, error } = await supabase
        .from('swifttaste_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        success: true,
        history: data || []
      };
    } catch (error) {
      console.error('獲取歷史記錄失敗:', error);
      return {
        success: false,
        error: this.getErrorMessage(error),
        history: []
      };
    }
  },

  // 添加 SwiftTaste 歷史記錄
  async addSwiftTasteHistory(userId, historyData) {
    try {
      const { data, error } = await supabase
        .from('swifttaste_history')
        .insert([{
          user_id: userId,
          session_type: historyData.session_type || 'swift',
          answers: historyData.answers,
          recommended_restaurant: historyData.recommended_restaurant,
          satisfied: historyData.satisfied || null,
          notes: historyData.notes || ''
        }])
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        history: data,
        message: 'SwiftTaste 記錄已保存'
      };
    } catch (error) {
      console.error('保存 SwiftTaste 記錄失敗:', error);
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  },

  // 更新 SwiftTaste 歷史記錄 (例如滿意度評價)
  async updateSwiftTasteHistory(historyId, updates) {
    try {
      const { data, error } = await supabase
        .from('swifttaste_history')
        .update(updates)
        .eq('id', historyId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        history: data,
        message: '記錄已更新'
      };
    } catch (error) {
      console.error('更新歷史記錄失敗:', error);
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

      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          name: profileData.name,
          bio: profileData.bio,
          avatar_url: profileData.avatar_url,
          updated_at: new Date().toISOString()
        })
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
      const { data, error } = await supabase
        .from('user_profiles')
        .select('favorite_lists_count, swifttaste_count, buddies_count')
        .eq('id', userId)
        .single();

      if (error) throw error;

      return {
        success: true,
        stats: data || {
          favorite_lists_count: 0,
          swifttaste_count: 0,
          buddies_count: 0
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

  // 生成範例數據 (用於開發測試)
  generateSampleFavoriteList() {
    return {
      id: `sample_${Date.now()}`,
      name: '我的最愛',
      description: '收藏的精選餐廳',
      color: '#ff6b35',
      is_public: false,
      places_count: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      favorite_list_places: [
        {
          id: `place_${Date.now()}_1`,
          place_id: 'ChIJ_sample_1',
          name: '鼎泰豐',
          address: '台北市信義區市府路45號',
          rating: 4.5,
          photo_url: null,
          notes: '小籠包很讚！',
          added_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: `place_${Date.now()}_2`,
          place_id: 'ChIJ_sample_2',
          name: '阿宗麵線',
          address: '台北市萬華區峨眉街8-1號',
          rating: 4.2,
          photo_url: null,
          notes: '經典台灣小吃',
          added_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
        }
      ]
    };
  },

  // 生成範例 SwiftTaste 歷史記錄
  generateSampleHistory() {
    return [
      {
        id: `history_${Date.now()}_1`,
        session_type: 'swift',
        answers: {
          mood: '放鬆',
          budget: '中等價位',
          cuisine: '台式料理'
        },
        recommended_restaurant: {
          name: '永康牛肉麵',
          rating: 4.3,
          address: '台北市大安區永康街10巷17號'
        },
        satisfied: true,
        notes: '牛肉很嫩，湯頭濃郁',
        created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
      },
      {
        id: `history_${Date.now()}_2`,
        session_type: 'buddies',
        answers: {
          group_size: '4人',
          atmosphere: '熱鬧',
          budget: '高價位'
        },
        recommended_restaurant: {
          name: '君品酒店雲軒',
          rating: 4.7,
          address: '台北市中山區長春路200號'
        },
        satisfied: null,
        notes: '',
        created_at: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
      }
    ];
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