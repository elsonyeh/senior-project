// 本地用戶數據服務 - 使用 localStorage 暫時替代數據庫
// 這是數據庫問題的臨時解決方案

export const userDataServiceLocal = {
  // 獲取用戶的收藏清單 (本地版本)
  getFavoriteLists(userId) {
    try {
      const listsData = localStorage.getItem(`favorite_lists_${userId}`);
      const lists = listsData ? JSON.parse(listsData) : [];
      
      return {
        success: true,
        lists: lists
      };
    } catch (error) {
      console.error('獲取本地收藏清單失敗:', error);
      return {
        success: false,
        error: '獲取收藏清單失敗',
        lists: []
      };
    }
  },

  // 創建新的收藏清單 (本地版本)
  createFavoriteList(userId, listData) {
    try {
      const newList = {
        id: `list_${Date.now()}`,
        user_id: userId,
        name: listData.name,
        description: listData.description || '',
        color: listData.color || '#ff6b35',
        is_public: listData.is_public || false,
        places_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        favorite_list_places: []
      };

      // 獲取現有清單
      const { lists } = this.getFavoriteLists(userId);
      lists.unshift(newList);

      // 保存到 localStorage
      localStorage.setItem(`favorite_lists_${userId}`, JSON.stringify(lists));

      return {
        success: true,
        list: newList,
        message: '收藏清單已創建'
      };
    } catch (error) {
      console.error('創建本地收藏清單失敗:', error);
      return {
        success: false,
        error: '創建收藏清單失敗'
      };
    }
  },

  // 更新收藏清單 (本地版本)
  updateFavoriteList(userId, listId, updates) {
    try {
      const { lists } = this.getFavoriteLists(userId);
      const listIndex = lists.findIndex(list => list.id === listId);
      
      if (listIndex === -1) {
        return {
          success: false,
          error: '收藏清單不存在'
        };
      }

      // 更新清單
      lists[listIndex] = {
        ...lists[listIndex],
        ...updates,
        updated_at: new Date().toISOString()
      };

      // 保存到 localStorage
      localStorage.setItem(`favorite_lists_${userId}`, JSON.stringify(lists));

      return {
        success: true,
        list: lists[listIndex],
        message: '收藏清單已更新'
      };
    } catch (error) {
      console.error('更新本地收藏清單失敗:', error);
      return {
        success: false,
        error: '更新收藏清單失敗'
      };
    }
  },

  // 刪除收藏清單 (本地版本)
  deleteFavoriteList(userId, listId) {
    try {
      const { lists } = this.getFavoriteLists(userId);
      const filteredLists = lists.filter(list => list.id !== listId);

      // 保存到 localStorage
      localStorage.setItem(`favorite_lists_${userId}`, JSON.stringify(filteredLists));

      return {
        success: true,
        message: '收藏清單已刪除'
      };
    } catch (error) {
      console.error('刪除本地收藏清單失敗:', error);
      return {
        success: false,
        error: '刪除收藏清單失敗'
      };
    }
  },

  // 添加地點到收藏清單 (本地版本)
  addPlaceToList(userId, listId, placeData) {
    try {
      const { lists } = this.getFavoriteLists(userId);
      const listIndex = lists.findIndex(list => list.id === listId);
      
      if (listIndex === -1) {
        return {
          success: false,
          error: '收藏清單不存在'
        };
      }

      // 檢查地點是否已存在
      const existingPlace = lists[listIndex].favorite_list_places.find(
        place => place.place_id === placeData.place_id
      );

      if (existingPlace) {
        return {
          success: false,
          error: '此餐廳已在收藏清單中'
        };
      }

      // 添加新地點
      const newPlace = {
        id: `place_${Date.now()}`,
        list_id: listId,
        place_id: placeData.place_id,
        name: placeData.name,
        address: placeData.address || '',
        rating: placeData.rating || null,
        photo_url: placeData.photo_url || null,
        notes: placeData.notes || '',
        added_at: new Date().toISOString()
      };

      lists[listIndex].favorite_list_places.unshift(newPlace);
      lists[listIndex].places_count = lists[listIndex].favorite_list_places.length;
      lists[listIndex].updated_at = new Date().toISOString();

      // 保存到 localStorage
      localStorage.setItem(`favorite_lists_${userId}`, JSON.stringify(lists));

      return {
        success: true,
        place: newPlace,
        message: '餐廳已加入收藏清單'
      };
    } catch (error) {
      console.error('添加地點到本地清單失敗:', error);
      return {
        success: false,
        error: '添加地點失敗'
      };
    }
  },

  // 從收藏清單移除地點 (本地版本)
  removePlaceFromList(userId, listId, placeId) {
    try {
      const { lists } = this.getFavoriteLists(userId);
      const listIndex = lists.findIndex(list => list.id === listId);
      
      if (listIndex === -1) {
        return {
          success: false,
          error: '收藏清單不存在'
        };
      }

      // 移除地點
      lists[listIndex].favorite_list_places = lists[listIndex].favorite_list_places.filter(
        place => place.id !== placeId
      );
      lists[listIndex].places_count = lists[listIndex].favorite_list_places.length;
      lists[listIndex].updated_at = new Date().toISOString();

      // 保存到 localStorage
      localStorage.setItem(`favorite_lists_${userId}`, JSON.stringify(lists));

      return {
        success: true,
        message: '餐廳已從收藏清單移除'
      };
    } catch (error) {
      console.error('從本地清單移除地點失敗:', error);
      return {
        success: false,
        error: '移除地點失敗'
      };
    }
  },

  // 獲取 SwiftTaste 歷史記錄 (本地版本)
  getSwiftTasteHistory(userId, limit = 20) {
    try {
      const historyData = localStorage.getItem(`swifttaste_history_${userId}`);
      const allHistory = historyData ? JSON.parse(historyData) : [];
      const history = allHistory.slice(0, limit);
      
      return {
        success: true,
        history: history
      };
    } catch (error) {
      console.error('獲取本地歷史記錄失敗:', error);
      return {
        success: false,
        error: '獲取歷史記錄失敗',
        history: []
      };
    }
  },

  // 添加 SwiftTaste 歷史記錄 (本地版本)
  addSwiftTasteHistory(userId, historyData) {
    try {
      const newHistory = {
        id: `history_${Date.now()}`,
        user_id: userId,
        session_type: historyData.session_type || 'swift',
        answers: historyData.answers,
        recommended_restaurant: historyData.recommended_restaurant,
        satisfied: historyData.satisfied || null,
        notes: historyData.notes || '',
        created_at: new Date().toISOString()
      };

      // 獲取現有歷史記錄
      const { history } = this.getSwiftTasteHistory(userId, 100);
      history.unshift(newHistory);

      // 保存到 localStorage
      localStorage.setItem(`swifttaste_history_${userId}`, JSON.stringify(history));

      return {
        success: true,
        history: newHistory,
        message: 'SwiftTaste 記錄已保存'
      };
    } catch (error) {
      console.error('保存本地 SwiftTaste 記錄失敗:', error);
      return {
        success: false,
        error: '保存記錄失敗'
      };
    }
  },

  // 獲取用戶統計數據 (本地版本)
  getUserStats(userId) {
    try {
      const { lists } = this.getFavoriteLists(userId);
      const { history } = this.getSwiftTasteHistory(userId, 1000);
      
      const stats = {
        favorite_lists_count: lists.length,
        swifttaste_count: history.length,
        buddies_count: history.filter(h => h.session_type === 'buddies').length
      };

      return {
        success: true,
        stats: stats
      };
    } catch (error) {
      console.error('獲取本地用戶統計失敗:', error);
      return {
        success: false,
        error: '獲取統計數據失敗',
        stats: {
          favorite_lists_count: 0,
          swifttaste_count: 0,
          buddies_count: 0
        }
      };
    }
  },

  // 生成範例數據
  generateSampleData(userId) {
    // 創建範例收藏清單
    const sampleList = {
      id: `sample_${Date.now()}`,
      user_id: userId,
      name: '我的最愛',
      description: '收藏的精選餐廳',
      color: '#ff6b35',
      is_public: false,
      places_count: 2,
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

    // 保存範例收藏清單
    localStorage.setItem(`favorite_lists_${userId}`, JSON.stringify([sampleList]));

    // 創建範例歷史記錄
    const sampleHistory = [
      {
        id: `history_${Date.now()}_1`,
        user_id: userId,
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
      }
    ];

    // 保存範例歷史記錄
    localStorage.setItem(`swifttaste_history_${userId}`, JSON.stringify(sampleHistory));

    return {
      success: true,
      message: '範例數據已生成'
    };
  }
};

export default userDataServiceLocal;