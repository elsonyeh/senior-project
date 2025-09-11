// supabaseService.js
// Supabase 服務 - 替代 Firebase Realtime Database

import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase 配置缺失，請檢查環境變數');
}

// 創建 Supabase 客戶端
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10, // 限制每秒事件數量
    },
  },
});

// 監聽器管理 - 防止重複監聽和內存洩漏
const activeSubscriptions = new Map();

/**
 * 安全地添加 Supabase 訂閱
 * @param {String} table - 表格名稱
 * @param {String} filter - 篩選條件
 * @param {Function} callback - 回調函數
 * @param {String} subscriptionId - 訂閱ID
 * @return {Function} 清理函數
 */
const addSubscription = (table, filter, callback, subscriptionId) => {
  // 如果已經有相同ID的訂閱，先清理
  if (activeSubscriptions.has(subscriptionId)) {
    const existingSubscription = activeSubscriptions.get(subscriptionId);
    existingSubscription.unsubscribe();
  }

  const subscription = supabase
    .channel(subscriptionId)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: table,
      filter: filter,
    }, callback)
    .subscribe();

  activeSubscriptions.set(subscriptionId, subscription);

  const cleanup = () => {
    subscription.unsubscribe();
    activeSubscriptions.delete(subscriptionId);
  };

  return cleanup;
};

/**
 * 清理所有訂閱
 */
export const cleanupAllSubscriptions = () => {
  activeSubscriptions.forEach((subscription) => subscription.unsubscribe());
  activeSubscriptions.clear();
};

// 房間相關功能
export const roomService = {
  /**
   * 創建房間
   * @param {String} hostName - 房主名稱
   * @return {Promise<Object>} 創建結果
   */
  async createRoom(hostName) {
    try {
      if (!hostName) return { success: false, error: '請輸入房主名稱' };

      // 生成房間ID
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const userId = this.getOrCreateUserId();

      const { data, error } = await supabase
        .from('buddies_rooms')
        .insert({
          id: roomId,
          host_id: userId,
          host_name: hostName,
          status: 'waiting',
          created_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error) throw error;

      // 添加房主為成員
      await this.addMember(roomId, userId, hostName, true);

      return { success: true, roomId, userId, data };
    } catch (error) {
      console.error('創建房間失敗:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 獲取房間信息
   * @param {String} roomId - 房間ID
   * @return {Promise<Object>} 房間信息
   */
  async getRoomInfo(roomId) {
    try {
      if (!roomId) return { success: false, error: '參數不完整' };

      const { data, error } = await supabase
        .from('buddies_rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('獲取房間信息失敗:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 監聽房間狀態變化
   * @param {String} roomId - 房間ID
   * @param {Function} callback - 回調函數
   * @return {Function} 清理函數
   */
  listenRoomStatus(roomId, callback) {
    if (!roomId || typeof callback !== 'function') return () => {};

    const subscriptionId = `roomStatus_${roomId}`;
    return addSubscription(
      'buddies_rooms',
      `id=eq.${roomId}`,
      (payload) => {
        if (payload.new) {
          callback(payload.new.status || 'waiting');
        }
      },
      subscriptionId
    );
  },

  /**
   * 獲取或創建用戶ID
   * @return {String} 用戶ID
   */
  getOrCreateUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = `user_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('userId', userId);
    }
    return userId;
  },
};

// 成員相關功能
export const memberService = {
  /**
   * 添加成員到房間
   * @param {String} roomId - 房間ID
   * @param {String} userId - 用戶ID
   * @param {String} userName - 用戶名稱
   * @param {Boolean} isHost - 是否為房主
   * @return {Promise<Object>} 添加結果
   */
  async addMember(roomId, userId, userName, isHost = false) {
    try {
      const { data, error } = await supabase
        .from('buddies_members')
        .insert({
          room_id: roomId,
          user_id: userId,
          user_name: userName,
          is_host: isHost,
          joined_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('添加成員失敗:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 監聽房間成員變化
   * @param {String} roomId - 房間ID
   * @param {Function} callback - 回調函數
   * @return {Function} 清理函數
   */
  listenRoomMembers(roomId, callback) {
    if (!roomId || typeof callback !== 'function') return () => {};

    const subscriptionId = `roomMembers_${roomId}`;
    return addSubscription(
      'buddies_members',
      oom_`id=eq.${roomId}`,
      (payload) => {
        // 重新獲取所有成員
        this.getRoomMembers(roomId).then(({ data }) => {
          if (data) {
            const membersObj = {};
            data.forEach(member => {
              membersObj[member.user_id] = {
                id: member.user_id,
                name: member.user_name,
                isHost: member.is_host,
                joinedAt: member.joined_at,
              };
            });
            callback(membersObj);
          }
        });
      },
      subscriptionId
    );
  },

  /**
   * 獲取房間成員
   * @param {String} roomId - 房間ID
   * @return {Promise<Object>} 成員列表
   */
  async getRoomMembers(roomId) {
    try {
      const { data, error } = await supabase
        .from('buddies_members')
        .select('*')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('獲取房間成員失敗:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 離開房間
   * @param {String} roomId - 房間ID
   * @param {String} userId - 用戶ID
   * @return {Promise<Object>} 離開結果
   */
  async leaveRoom(roomId, userId) {
    try {
      const { error } = await supabase
        .from('buddies_members')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', userId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('離開房間失敗:', error);
      return { success: false, error: error.message };
    }
  },
};

// 推薦相關功能
export const recommendationService = {
  /**
   * 保存推薦結果
   * @param {String} roomId - 房間ID
   * @param {Array} recommendations - 推薦餐廳列表
   * @return {Promise<Object>} 保存結果
   */
  async saveRecommendations(roomId, recommendations) {
    try {
      if (!roomId || !recommendations) return { success: false, error: '參數不完整' };

      const { data, error } = await supabase
        .from('buddies_recommendations')
        .upsert({
          room_id: roomId,
          restaurants: recommendations,
          created_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error) throw error;

      // 更新房間狀態
      await supabase
        .from('buddies_rooms')
        .update({ 
          status: 'recommend',
          last_updated: new Date().toISOString(),
        })
        .eq('id', roomId);

      return { success: true, data };
    } catch (error) {
      console.error('保存推薦結果失敗:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 獲取推薦結果
   * @param {String} roomId - 房間ID
   * @return {Promise<Array>} 推薦列表
   */
  async getRecommendations(roomId) {
    try {
      if (!roomId) return [];

      const { data, error } = await supabase
        .from('buddies_recommendations')
        .select('restaurants')
        .eq('room_id', roomId)
        .single();

      if (error) throw error;

      return data?.restaurants || [];
    } catch (error) {
      console.error('獲取推薦結果失敗:', error);
      return [];
    }
  },

  /**
   * 監聽推薦變化
   * @param {String} roomId - 房間ID
   * @param {Function} callback - 回調函數
   * @return {Function} 清理函數
   */
  listenRecommendations(roomId, callback) {
    if (!roomId || typeof callback !== 'function') return () => {};

    const subscriptionId = `roomRecommendations_${roomId}`;
    return addSubscription(
      'buddies_recommendations',
      oom_`id=eq.${roomId}`,
      (payload) => {
        if (payload.new && payload.new.restaurants) {
          callback(payload.new.restaurants);
        } else {
          callback([]);
        }
      },
      subscriptionId
    );
  },
};

// 投票相關功能
export const voteService = {
  /**
   * 為餐廳投票
   * @param {String} roomId - 房間ID
   * @param {String} restaurantId - 餐廳ID
   * @param {String} userId - 用戶ID
   * @return {Promise<Object>} 投票結果
   */
  async voteForRestaurant(roomId, restaurantId, userId) {
    try {
      if (!roomId || !restaurantId || !userId) {
        return { success: false, error: '參數不完整' };
      }

      // 記錄用戶投票
      const { error: voteError } = await supabase
        .from('buddies_votes')
        .upsert({
          room_id: roomId,
          user_id: userId,
          restaurant_id: restaurantId,
          voted_at: new Date().toISOString(),
        });

      if (voteError) throw voteError;

      // 更新餐廳票數
      const { data: existingVote, error: getError } = await supabase
        .from('buddies_restaurant_votes')
        .select('vote_count')
        .eq('room_id', roomId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (getError && getError.code !== 'PGRST116') throw getError;

      const currentVotes = existingVote?.vote_count || 0;

      const { error: updateError } = await supabase
        .from('buddies_restaurant_votes')
        .upsert({
          room_id: roomId,
          restaurant_id: restaurantId,
          vote_count: currentVotes + 1,
          updated_at: new Date().toISOString(),
        });

      if (updateError) throw updateError;

      // 標記本地投票狀態
      localStorage.setItem(`voted_${roomId}_${userId}`, 'true');

      return { success: true };
    } catch (error) {
      console.error('餐廳投票失敗:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 監聽投票結果
   * @param {String} roomId - 房間ID
   * @param {Function} callback - 回調函數
   * @return {Function} 清理函數
   */
  listenVotes(roomId, callback) {
    if (!roomId || typeof callback !== 'function') return () => {};

    const subscriptionId = `roomVotes_${roomId}`;
    return addSubscription(
      'buddies_restaurant_votes',
      oom_`id=eq.${roomId}`,
      (payload) => {
        // 重新獲取所有投票數據
        this.getVotes(roomId).then(({ data }) => {
          if (data) {
            const votesObj = {};
            data.forEach(vote => {
              votesObj[vote.restaurant_id] = vote.vote_count;
            });
            callback(votesObj);
          }
        });
      },
      subscriptionId
    );
  },

  /**
   * 獲取投票結果
   * @param {String} roomId - 房間ID
   * @return {Promise<Object>} 投票結果
   */
  async getVotes(roomId) {
    try {
      const { data, error } = await supabase
        .from('buddies_restaurant_votes')
        .select('restaurant_id, vote_count')
        .eq('room_id', roomId);

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('獲取投票結果失敗:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 檢查用戶是否已投票
   * @param {String} roomId - 房間ID
   * @param {String} userId - 用戶ID
   * @return {Promise<Boolean>} 是否已投票
   */
  async hasUserVoted(roomId, userId) {
    try {
      // 首先檢查本地存儲
      if (localStorage.getItem(`voted_${roomId}_${userId}`)) {
        return true;
      }

      const { data, error } = await supabase
        .from('buddies_votes')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .single();

      return !error && data;
    } catch (error) {
      console.error('檢查用戶投票狀態失敗:', error);
      return false;
    }
  },
};

// 最終結果相關功能
export const finalResultService = {
  /**
   * 確認最終選擇的餐廳
   * @param {String} roomId - 房間ID
   * @param {Object} restaurant - 餐廳資料
   * @param {String} userId - 用戶ID
   * @return {Promise<Object>} 選擇結果
   */
  async finalizeRestaurant(roomId, restaurant, userId) {
    try {
      if (!roomId || !restaurant || !userId) {
        return { success: false, error: '參數不完整' };
      }

      const { data, error } = await supabase
        .from('buddies_final_results')
        .upsert({
          room_id: roomId,
          restaurant_id: restaurant.id,
          restaurant_name: restaurant.name,
          restaurant_address: restaurant.address,
          restaurant_photo_url: restaurant.photoURL,
          restaurant_rating: restaurant.rating,
          restaurant_type: restaurant.type,
          selected_at: new Date().toISOString(),
          selected_by: userId,
        })
        .select('*')
        .single();

      if (error) throw error;

      // 更新房間狀態
      await supabase
        .from('buddies_rooms')
        .update({
          status: 'completed',
          last_updated: new Date().toISOString(),
        })
        .eq('id', roomId);

      return { success: true, data };
    } catch (error) {
      console.error('確認餐廳選擇失敗:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 監聽最終選擇的餐廳
   * @param {String} roomId - 房間ID
   * @param {Function} callback - 回調函數
   * @return {Function} 清理函數
   */
  listenFinalRestaurant(roomId, callback) {
    if (!roomId || typeof callback !== 'function') return () => {};

    const subscriptionId = `roomFinal_${roomId}`;
    return addSubscription(
      'buddies_final_results',
      oom_`id=eq.${roomId}`,
      (payload) => {
        if (payload.new) {
          callback(payload.new);
        } else {
          callback(null);
        }
      },
      subscriptionId
    );
  },
};

// 管理員功能
export const adminService = {
  /**
   * 獲取所有房間列表
   * @return {Promise<Object>} 房間列表
   */
  async getAllRooms() {
    try {
      const { data, error } = await supabase
        .from('buddies_rooms')
        .select(`
          id,
          host_id,
          host_name,
          status,
          created_at,
          last_updated,
          buddies_members(count)`
        )
        .order('created_at', { ascending: false });

      if (error) throw error;

      const roomsList = data.map(room => ({
        id: room.id,
        hostId: room.host_id,
        hostName: room.host_name,
        status: room.status,
        createdAt: room.created_at,
        lastUpdated: room.last_updated,
        memberCount: room.buddies_members?.[0]?.count || 0,
      }));

      return { success: true, rooms: roomsList };
    } catch (error) {
      console.error('獲取所有房間失敗:', error);
      return { success: false, error: error.message, rooms: [] };
    }
  },

  /**
   * 刪除房間
   * @param {String} roomId - 房間ID
   * @return {Promise<Object>} 刪除結果
   */
  async deleteRoom(roomId) {
    try {
      if (!roomId) return { success: false, error: '房間ID不能為空' };

      // 刪除相關數據（級聯刪除）
      const { error } = await supabase
        .from('buddies_rooms')
        .delete()
        .eq('id', roomId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('刪除房間失敗:', error);
      return { success: false, error: error.message };
    }
  },
};

// 導出所有服務
export default {
  supabase,
  cleanupAllSubscriptions,
  roomService,
  memberService,
  recommendationService,
  voteService,
  finalResultService,
  adminService,
};
