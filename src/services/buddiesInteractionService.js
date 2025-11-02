// ==========================================
// Buddies 互動記錄服務
// ==========================================
// 用途：記錄用戶在 Buddies 模式中的所有互動行為
// 包括：查看、喜歡、跳過、投票等
// ==========================================

import { supabase } from './supabaseService.js';
import logger from '../utils/logger';

class BuddiesInteractionService {
  /**
   * 記錄互動行為
   * @param {string} roomId - 房間ID
   * @param {string} userId - 用戶ID
   * @param {string} restaurantId - 餐廳ID
   * @param {string} actionType - 互動類型：'view', 'like', 'skip', 'vote'
   * @param {object} metadata - 額外資訊（可選）
   */
  async recordInteraction(roomId, userId, restaurantId, actionType, metadata = {}) {
    try {
      const { data, error } = await supabase
        .from('buddies_interactions')
        .insert({
          room_id: roomId,
          user_id: userId,
          restaurant_id: restaurantId,
          action_type: actionType,
          metadata: metadata,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        // 如果是 UNIQUE 約束錯誤，表示已記錄過，可以忽略
        if (error.code === '23505') {
          logger.debug(`互動已記錄：${actionType} - ${restaurantId}`);
          return { success: true, duplicate: true };
        }
        throw error;
      }

      logger.debug(`✅ 記錄互動：${actionType} - ${restaurantId}`, data);
      return { success: true, data, duplicate: false };
    } catch (error) {
      console.error('記錄互動失敗:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 記錄查看餐廳
   */
  async recordView(roomId, userId, restaurantId) {
    return await this.recordInteraction(roomId, userId, restaurantId, 'view');
  }

  /**
   * 記錄喜歡餐廳
   */
  async recordLike(roomId, userId, restaurantId, restaurantData = null) {
    return await this.recordInteraction(roomId, userId, restaurantId, 'like', {
      restaurant_name: restaurantData?.name,
      restaurant_rating: restaurantData?.rating
    });
  }

  /**
   * 記錄跳過餐廳
   */
  async recordSkip(roomId, userId, restaurantId) {
    return await this.recordInteraction(roomId, userId, restaurantId, 'skip');
  }

  /**
   * 記錄投票
   */
  async recordVote(roomId, userId, restaurantId, restaurantData = null) {
    return await this.recordInteraction(roomId, userId, restaurantId, 'vote', {
      restaurant_name: restaurantData?.name,
      voted_at: new Date().toISOString()
    });
  }

  /**
   * 批次記錄互動（用於同步多個互動）
   */
  async recordBatchInteractions(interactions) {
    try {
      const { data, error } = await supabase
        .from('buddies_interactions')
        .insert(interactions)
        .select();

      if (error) throw error;

      logger.debug(`✅ 批次記錄 ${interactions.length} 個互動`);
      return { success: true, data };
    } catch (error) {
      console.error('批次記錄互動失敗:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 獲取房間的所有互動記錄
   */
  async getRoomInteractions(roomId) {
    try {
      const { data, error } = await supabase
        .from('buddies_interactions')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('獲取房間互動記錄失敗:', error);
      return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * 獲取用戶在房間中的互動記錄
   */
  async getUserInteractions(roomId, userId) {
    try {
      const { data, error } = await supabase
        .from('buddies_interactions')
        .select('*')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('獲取用戶互動記錄失敗:', error);
      return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * 獲取餐廳的互動統計
   */
  async getRestaurantInteractionStats(roomId, restaurantId) {
    try {
      const { data, error } = await supabase
        .from('buddies_interactions')
        .select('action_type, user_id')
        .eq('room_id', roomId)
        .eq('restaurant_id', restaurantId);

      if (error) throw error;

      // 統計各類互動數量
      const stats = {
        view_count: 0,
        like_count: 0,
        skip_count: 0,
        vote_count: 0,
        unique_users: new Set()
      };

      data.forEach(interaction => {
        stats.unique_users.add(interaction.user_id);
        switch (interaction.action_type) {
          case 'view':
            stats.view_count++;
            break;
          case 'like':
            stats.like_count++;
            break;
          case 'skip':
            stats.skip_count++;
            break;
          case 'vote':
            stats.vote_count++;
            break;
        }
      });

      stats.unique_users = stats.unique_users.size;

      return { success: true, stats };
    } catch (error) {
      console.error('獲取餐廳互動統計失敗:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 獲取房間的互動摘要
   */
  async getRoomInteractionSummary(roomId) {
    try {
      const { data, error } = await supabase
        .from('buddies_interactions')
        .select('*')
        .eq('room_id', roomId);

      if (error) throw error;

      // 統計各類互動
      const summary = {
        total_interactions: data.length,
        view_count: 0,
        like_count: 0,
        skip_count: 0,
        vote_count: 0,
        unique_users: new Set(),
        unique_restaurants: new Set(),
        restaurants: {}
      };

      data.forEach(interaction => {
        summary.unique_users.add(interaction.user_id);
        summary.unique_restaurants.add(interaction.restaurant_id);

        // 統計互動類型
        switch (interaction.action_type) {
          case 'view':
            summary.view_count++;
            break;
          case 'like':
            summary.like_count++;
            break;
          case 'skip':
            summary.skip_count++;
            break;
          case 'vote':
            summary.vote_count++;
            break;
        }

        // 統計每個餐廳的互動
        if (!summary.restaurants[interaction.restaurant_id]) {
          summary.restaurants[interaction.restaurant_id] = {
            view: 0,
            like: 0,
            skip: 0,
            vote: 0
          };
        }
        summary.restaurants[interaction.restaurant_id][interaction.action_type]++;
      });

      summary.unique_users = summary.unique_users.size;
      summary.unique_restaurants = summary.unique_restaurants.size;

      return { success: true, summary };
    } catch (error) {
      console.error('獲取房間互動摘要失敗:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新房間的時間戳記
   */
  async updateRoomTimestamp(roomId, timestampField, timestamp = new Date().toISOString()) {
    try {
      const updateData = {
        [timestampField]: timestamp,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('buddies_rooms')
        .update(updateData)
        .eq('id', roomId)
        .select()
        .single();

      if (error) throw error;

      logger.debug(`✅ 更新房間時間戳：${timestampField} = ${timestamp}`);
      return { success: true, data };
    } catch (error) {
      console.error('更新房間時間戳失敗:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新房間投票結果
   */
  async updateRoomVotes(roomId, votes) {
    try {
      const { data, error } = await supabase
        .from('buddies_rooms')
        .update({
          votes: votes,
          updated_at: new Date().toISOString()
        })
        .eq('id', roomId)
        .select()
        .single();

      if (error) throw error;

      logger.debug(`✅ 更新房間投票結果:`, votes);
      return { success: true, data };
    } catch (error) {
      console.error('更新房間投票結果失敗:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新房間最終結果
   */
  async updateRoomFinalResult(roomId, restaurantId, restaurantData) {
    try {
      const { data, error } = await supabase
        .from('buddies_rooms')
        .update({
          status: 'completed',
          final_restaurant_id: restaurantId,
          final_restaurant_data: restaurantData,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', roomId)
        .select()
        .single();

      if (error) throw error;

      logger.debug(`✅ 更新房間最終結果:`, restaurantData?.name);
      return { success: true, data };
    } catch (error) {
      console.error('更新房間最終結果失敗:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 獲取房間的完整會話數據（用於分析）
   */
  async getRoomSessionData(roomId) {
    try {
      // 獲取房間基本資料
      const { data: roomData, error: roomError } = await supabase
        .from('buddies_rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomError) throw roomError;

      // 獲取成員資料
      const { data: membersData, error: membersError } = await supabase
        .from('buddies_members')
        .select('*')
        .eq('room_id', roomId);

      if (membersError) throw membersError;

      // 獲取互動記錄
      const { data: interactionsData, error: interactionsError } = await supabase
        .from('buddies_interactions')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (interactionsError) throw interactionsError;

      // 計算會話時長
      const sessionDuration = {
        total_seconds: null,
        lobby_seconds: null,
        questions_seconds: null,
        voting_seconds: null
      };

      if (roomData.created_at && roomData.completed_at) {
        const start = new Date(roomData.created_at);
        const end = new Date(roomData.completed_at);
        sessionDuration.total_seconds = Math.round((end - start) / 1000);

        if (roomData.questions_started_at) {
          const questionsStart = new Date(roomData.questions_started_at);
          sessionDuration.lobby_seconds = Math.round((questionsStart - start) / 1000);
        }

        if (roomData.voting_started_at && roomData.questions_started_at) {
          const votingStart = new Date(roomData.voting_started_at);
          const questionsStart = new Date(roomData.questions_started_at);
          sessionDuration.questions_seconds = Math.round((votingStart - questionsStart) / 1000);
        }

        if (roomData.voting_started_at) {
          const votingStart = new Date(roomData.voting_started_at);
          sessionDuration.voting_seconds = Math.round((end - votingStart) / 1000);
        }
      }

      return {
        success: true,
        data: {
          room: roomData,
          members: membersData,
          interactions: interactionsData,
          session_duration: sessionDuration
        }
      };
    } catch (error) {
      console.error('獲取房間會話數據失敗:', error);
      return { success: false, error: error.message };
    }
  }
}

// 創建單例實例
export const buddiesInteractionService = new BuddiesInteractionService();

export default buddiesInteractionService;
