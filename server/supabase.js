// server/supabase.js
// Railway 後端 Supabase 服務

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase 配置
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(' Supabase 配置缺失，請檢查環境變數');
  console.error('需要設定：SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY');
}

// 創建 Supabase 客戶端（使用 Service Role Key 以獲得完整權限）
const supabase = supabaseUrl && supabaseServiceKey ? 
  createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }) : null;

// 房間相關功能
const roomService = {
  /**
   * 創建房間
   * @param {String} roomId - 房間ID
   * @param {String} hostId - 房主ID
   * @param {String} hostName - 房主名稱
   * @return {Promise<Object>} 創建結果
   */
  async createRoom(roomId, hostId, hostName) {
    try {
      if (!supabase) {
        return { success: false, error: 'Supabase 未配置' };
      }
      
      const { data, error } = await supabase
        .from('buddies_rooms')
        .insert({
          id: roomId,
          host_id: hostId,
          host_name: hostName,
          status: 'waiting',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
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
   * 更新房間狀態
   * @param {String} roomId - 房間ID
   * @param {String} status - 新狀態
   * @return {Promise<Object>} 更新結果
   */
  async updateRoomStatus(roomId, status) {
    try {
      const { error } = await supabase
        .from('buddies_rooms')
        .update({
          status: status,
          last_updated: new Date().toISOString(),
        })
        .eq('id', roomId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('更新房間狀態失敗:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 獲取所有房間（管理員功能）
   * @return {Promise<Object>} 房間列表
   */
  async getAllRooms() {
    try {
      const { data, error } = await supabase
        .from('buddies_rooms')
        .select(
          id,
          host_id,
          host_name,
          status,
          created_at,
          last_updated,
          buddies_members(count)
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

// 成員相關功能
const memberService = {
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
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('添加成員失敗:', error);
      return { success: false, error: error.message };
    }
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
const recommendationService = {
  /**
   * 保存推薦結果
   * @param {String} roomId - 房間ID
   * @param {Array} recommendations - 推薦餐廳列表
   * @return {Promise<Object>} 保存結果
   */
  async saveRecommendations(roomId, recommendations) {
    try {
      const { data, error } = await supabase
        .from('buddies_recommendations')
        .upsert({
          room_id: roomId,
          restaurants: recommendations,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // 更新房間狀態
      await roomService.updateRoomStatus(roomId, 'recommend');

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
};

// 投票相關功能
const voteService = {
  /**
   * 為餐廳投票
   * @param {String} roomId - 房間ID
   * @param {String} restaurantId - 餐廳ID
   * @param {String} userId - 用戶ID
   * @return {Promise<Object>} 投票結果
   */
  async voteForRestaurant(roomId, restaurantId, userId) {
    try {
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

      return { success: true };
    } catch (error) {
      console.error('餐廳投票失敗:', error);
      return { success: false, error: error.message };
    }
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
const finalResultService = {
  /**
   * 確認最終選擇的餐廳
   * @param {String} roomId - 房間ID
   * @param {Object} restaurant - 餐廳資料
   * @param {String} userId - 用戶ID
   * @return {Promise<Object>} 選擇結果
   */
  async finalizeRestaurant(roomId, restaurant, userId) {
    try {
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
        .select()
        .single();

      if (error) throw error;

      // 更新房間狀態
      await roomService.updateRoomStatus(roomId, 'completed');

      return { success: true, data };
    } catch (error) {
      console.error('確認餐廳選擇失敗:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 獲取最終選擇的餐廳
   * @param {String} roomId - 房間ID
   * @return {Promise<Object>} 最終結果
   */
  async getFinalRestaurant(roomId) {
    try {
      const { data, error } = await supabase
        .from('buddies_final_results')
        .select('*')
        .eq('room_id', roomId)
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('獲取最終結果失敗:', error);
      return { success: false, error: error.message };
    }
  },
};

// 導出所有服務
module.exports = {
  supabase,
  roomService,
  memberService,
  recommendationService,
  voteService,
  finalResultService,
};
