// ==========================================
// SwiftTaste 互動記錄服務
// ==========================================
// 用途：記錄用戶在 SwiftTaste 模式中的所有互動行為
// 包括：查看、喜歡、跳過、最終選擇等
// ==========================================

import { supabase } from './supabaseService.js';
import logger from '../utils/logger';

class SwiftTasteInteractionService {
  /**
   * 記錄互動行為
   * @param {string} sessionId - 會話ID
   * @param {string} userId - 用戶ID（可選）
   * @param {string} restaurantId - 餐廳ID
   * @param {string} actionType - 互動類型：'view', 'like', 'skip', 'final'
   * @param {object} metadata - 額外資訊（可選）
   */
  async recordInteraction(sessionId, userId, restaurantId, actionType, metadata = {}) {
    try {
      const { data, error } = await supabase
        .from('swifttaste_interactions')
        .insert({
          session_id: sessionId,
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
  async recordView(sessionId, userId, restaurantId) {
    return await this.recordInteraction(sessionId, userId, restaurantId, 'view');
  }

  /**
   * 記錄喜歡餐廳
   */
  async recordLike(sessionId, userId, restaurantId, restaurantData = null) {
    return await this.recordInteraction(sessionId, userId, restaurantId, 'like', {
      restaurant_name: restaurantData?.name,
      restaurant_rating: restaurantData?.rating
    });
  }

  /**
   * 記錄跳過餐廳
   */
  async recordSkip(sessionId, userId, restaurantId) {
    return await this.recordInteraction(sessionId, userId, restaurantId, 'skip');
  }

  /**
   * 記錄最終選擇
   */
  async recordFinalChoice(sessionId, userId, restaurantId, restaurantData = null) {
    return await this.recordInteraction(sessionId, userId, restaurantId, 'final', {
      restaurant_name: restaurantData?.name,
      selected_at: new Date().toISOString()
    });
  }

  /**
   * 更新會話時間戳
   */
  async updateSessionTimestamp(sessionId, timestampField, timestamp = new Date().toISOString()) {
    try {
      const updateData = {
        [timestampField]: timestamp
      };

      const { data, error } = await supabase
        .from('user_selection_history')
        .update(updateData)
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;

      logger.debug(`✅ 更新會話時間戳：${timestampField} = ${timestamp}`);
      return { success: true, data };
    } catch (error) {
      console.error('更新會話時間戳失敗:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 獲取會話的互動摘要
   */
  async getSessionInteractionSummary(sessionId) {
    try {
      const { data, error } = await supabase
        .rpc('get_session_interaction_summary', { p_session_id: sessionId });

      if (error) throw error;

      return { success: true, data: data[0] || {} };
    } catch (error) {
      console.error('獲取會話互動摘要失敗:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 獲取餐廳的互動統計
   */
  async getRestaurantInteractionStats(restaurantId) {
    try {
      const { data, error } = await supabase
        .rpc('get_restaurant_interaction_stats', { p_restaurant_id: restaurantId });

      if (error) throw error;

      return { success: true, data: data[0] || {} };
    } catch (error) {
      console.error('獲取餐廳互動統計失敗:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 獲取會話的完整數據（用於分析）
   */
  async getSessionData(sessionId) {
    try {
      // 獲取會話基本資料
      const { data: sessionData, error: sessionError } = await supabase
        .from('user_selection_history')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      // 獲取互動記錄
      const { data: interactionsData, error: interactionsError } = await supabase
        .from('swifttaste_interactions')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (interactionsError) throw interactionsError;

      // 計算會話時長
      const sessionDuration = {
        total_seconds: null,
        questions_seconds: null,
        fun_questions_seconds: null,
        restaurants_seconds: null
      };

      if (sessionData.started_at && sessionData.completed_at) {
        const start = new Date(sessionData.started_at);
        const end = new Date(sessionData.completed_at);
        sessionDuration.total_seconds = Math.round((end - start) / 1000);

        if (sessionData.questions_started_at) {
          const questionsStart = new Date(sessionData.questions_started_at);
          sessionDuration.questions_seconds = Math.round((questionsStart - start) / 1000);
        }

        if (sessionData.fun_questions_started_at && sessionData.questions_started_at) {
          const funQuestionsStart = new Date(sessionData.fun_questions_started_at);
          const questionsStart = new Date(sessionData.questions_started_at);
          sessionDuration.fun_questions_seconds = Math.round((funQuestionsStart - questionsStart) / 1000);
        }

        if (sessionData.restaurants_started_at) {
          const restaurantsStart = new Date(sessionData.restaurants_started_at);
          const previousTimestamp = sessionData.fun_questions_started_at || sessionData.questions_started_at || sessionData.started_at;
          sessionDuration.restaurants_seconds = Math.round((restaurantsStart - new Date(previousTimestamp)) / 1000);
        }
      }

      return {
        success: true,
        data: {
          session: sessionData,
          interactions: interactionsData,
          session_duration: sessionDuration
        }
      };
    } catch (error) {
      console.error('獲取會話數據失敗:', error);
      return { success: false, error: error.message };
    }
  }
}

// 創建單例實例
export const swiftTasteInteractionService = new SwiftTasteInteractionService();

export default swiftTasteInteractionService;
