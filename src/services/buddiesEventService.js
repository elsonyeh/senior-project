/**
 * Buddies 事件記錄服務
 *
 * 功能:
 * - 記錄所有 Buddies 模式的關鍵事件
 * - 支援事件查詢和分析
 * - 完整審計追蹤
 *
 * 相關文檔:
 * - docs/DATA-LIFECYCLE-MANAGEMENT.md
 * - docs/DATABASE-AUDIT-REPORT.md
 *
 * @module services/buddiesEventService
 */

import { supabase } from './supabaseService.js';

/**
 * 事件類型定義
 */
export const EVENT_TYPES = {
  // 房間生命週期
  ROOM_CREATED: 'room_created',
  ROOM_STARTED: 'room_started',
  ROOM_COMPLETED: 'room_completed',
  ROOM_ABANDONED: 'room_abandoned',

  // 成員操作
  MEMBER_JOINED: 'member_joined',
  MEMBER_LEFT: 'member_left',
  MEMBER_KICKED: 'member_kicked',

  // 問題回答
  QUESTION_ANSWERED: 'question_answered',
  ALL_MEMBERS_COMPLETED: 'all_members_completed',

  // 推薦生成
  RECOMMENDATIONS_GENERATED: 'recommendations_generated',
  RECOMMENDATIONS_REFRESHED: 'recommendations_refreshed',

  // 投票操作
  VOTE_CAST: 'vote_cast',
  VOTE_CHANGED: 'vote_changed',
  VOTE_REMOVED: 'vote_removed',

  // 最終決策
  FINAL_SELECTION_MADE: 'final_selection_made',
  FINAL_SELECTION_CHANGED: 'final_selection_changed',

  // 系統事件
  ROOM_ARCHIVED: 'room_archived',
  ROOM_CLEANED: 'room_cleaned',

  // 錯誤事件
  ERROR_OCCURRED: 'error_occurred'
};

/**
 * Buddies 事件服務類
 */
class BuddiesEventService {
  /**
   * 記錄事件（通用方法）
   *
   * @param {Object} params - 事件參數
   * @param {string} params.roomId - 房間 ID
   * @param {string} params.eventType - 事件類型
   * @param {string} [params.userId] - 用戶 ID（可選）
   * @param {Object} [params.eventData] - 事件數據（可選）
   * @returns {Promise<{success: boolean, eventId?: string, message?: string}>}
   */
  async logEvent({ roomId, eventType, userId = null, eventData = null }) {
    try {
      // 使用資料庫函數記錄事件
      const { data, error } = await supabase
        .rpc('log_buddies_event', {
          p_room_id: roomId,
          p_event_type: eventType,
          p_user_id: userId,
          p_event_data: eventData
        });

      if (error) {
        // 如果 RPC 函數不可用，降級到直接插入
        return await this._logEventDirect({ roomId, eventType, userId, eventData });
      }

      return {
        success: true,
        eventId: data
      };
    } catch (error) {
      console.error('❌ 記錄事件失敗:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 直接插入事件（降級方案）
   * @private
   */
  async _logEventDirect({ roomId, eventType, userId, eventData }) {
    const { data, error } = await supabase
      .from('buddies_events')
      .insert({
        room_id: roomId,
        event_type: eventType,
        user_id: userId,
        event_data: eventData,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) throw error;

    return {
      success: true,
      eventId: data.id
    };
  }

  // ========================================================================
  // 具體事件記錄方法
  // ========================================================================

  /**
   * 記錄房間創建事件
   */
  async logRoomCreated(roomId, hostId, roomCode, hostName) {
    return this.logEvent({
      roomId,
      eventType: EVENT_TYPES.ROOM_CREATED,
      userId: hostId,
      eventData: {
        room_code: roomCode,
        host_name: hostName
      }
    });
  }

  /**
   * 記錄房間開始答題事件
   */
  async logRoomStarted(roomId, hostId, questionsCount) {
    return this.logEvent({
      roomId,
      eventType: EVENT_TYPES.ROOM_STARTED,
      userId: hostId,
      eventData: {
        questions_count: questionsCount
      }
    });
  }

  /**
   * 記錄房間完成事件
   */
  async logRoomCompleted(roomId, finalRestaurantId, finalRestaurantData, memberCount, totalVotes) {
    return this.logEvent({
      roomId,
      eventType: EVENT_TYPES.ROOM_COMPLETED,
      userId: null,
      eventData: {
        final_restaurant_id: finalRestaurantId,
        final_restaurant_name: finalRestaurantData?.name,
        member_count: memberCount,
        total_votes: totalVotes
      }
    });
  }

  /**
   * 記錄房間放棄事件
   */
  async logRoomAbandoned(roomId, reason = null) {
    return this.logEvent({
      roomId,
      eventType: EVENT_TYPES.ROOM_ABANDONED,
      userId: null,
      eventData: {
        reason
      }
    });
  }

  /**
   * 記錄成員加入事件
   */
  async logMemberJoined(roomId, userId, username, isHost = false) {
    return this.logEvent({
      roomId,
      eventType: EVENT_TYPES.MEMBER_JOINED,
      userId,
      eventData: {
        username,
        is_host: isHost
      }
    });
  }

  /**
   * 記錄成員離開事件
   */
  async logMemberLeft(roomId, userId, username, reason = 'voluntary') {
    return this.logEvent({
      roomId,
      eventType: EVENT_TYPES.MEMBER_LEFT,
      userId,
      eventData: {
        username,
        reason
      }
    });
  }

  /**
   * 記錄成員被踢出事件
   */
  async logMemberKicked(roomId, kickedUserId, kickedUsername, kickedByUserId) {
    return this.logEvent({
      roomId,
      eventType: EVENT_TYPES.MEMBER_KICKED,
      userId: kickedUserId,
      eventData: {
        kicked_username: kickedUsername,
        kicked_by_user_id: kickedByUserId
      }
    });
  }

  /**
   * 記錄問題回答事件
   */
  async logQuestionAnswered(roomId, userId, questionIndex, answer) {
    return this.logEvent({
      roomId,
      eventType: EVENT_TYPES.QUESTION_ANSWERED,
      userId,
      eventData: {
        question_index: questionIndex,
        answer
      }
    });
  }

  /**
   * 記錄所有成員完成答題事件
   */
  async logAllMembersCompleted(roomId, memberCount, totalQuestions) {
    return this.logEvent({
      roomId,
      eventType: EVENT_TYPES.ALL_MEMBERS_COMPLETED,
      userId: null,
      eventData: {
        member_count: memberCount,
        total_questions: totalQuestions
      }
    });
  }

  /**
   * 記錄生成推薦事件
   */
  async logRecommendationsGenerated(roomId, recommendationsCount, algorithm = 'enhanced') {
    return this.logEvent({
      roomId,
      eventType: EVENT_TYPES.RECOMMENDATIONS_GENERATED,
      userId: null,
      eventData: {
        recommendations_count: recommendationsCount,
        algorithm
      }
    });
  }

  /**
   * 記錄重新生成推薦事件
   */
  async logRecommendationsRefreshed(roomId, userId, newCount) {
    return this.logEvent({
      roomId,
      eventType: EVENT_TYPES.RECOMMENDATIONS_REFRESHED,
      userId,
      eventData: {
        new_recommendations_count: newCount
      }
    });
  }

  /**
   * 記錄投票事件
   */
  async logVoteCast(roomId, userId, restaurantId, restaurantName) {
    return this.logEvent({
      roomId,
      eventType: EVENT_TYPES.VOTE_CAST,
      userId,
      eventData: {
        restaurant_id: restaurantId,
        restaurant_name: restaurantName
      }
    });
  }

  /**
   * 記錄修改投票事件
   */
  async logVoteChanged(roomId, userId, oldRestaurantId, newRestaurantId) {
    return this.logEvent({
      roomId,
      eventType: EVENT_TYPES.VOTE_CHANGED,
      userId,
      eventData: {
        old_restaurant_id: oldRestaurantId,
        new_restaurant_id: newRestaurantId
      }
    });
  }

  /**
   * 記錄取消投票事件
   */
  async logVoteRemoved(roomId, userId, restaurantId) {
    return this.logEvent({
      roomId,
      eventType: EVENT_TYPES.VOTE_REMOVED,
      userId,
      eventData: {
        restaurant_id: restaurantId
      }
    });
  }

  /**
   * 記錄最終選擇事件
   */
  async logFinalSelectionMade(roomId, userId, restaurantId, restaurantName, votesCount) {
    return this.logEvent({
      roomId,
      eventType: EVENT_TYPES.FINAL_SELECTION_MADE,
      userId,
      eventData: {
        restaurant_id: restaurantId,
        restaurant_name: restaurantName,
        votes_count: votesCount
      }
    });
  }

  /**
   * 記錄修改最終選擇事件
   */
  async logFinalSelectionChanged(roomId, userId, oldRestaurantId, newRestaurantId) {
    return this.logEvent({
      roomId,
      eventType: EVENT_TYPES.FINAL_SELECTION_CHANGED,
      userId,
      eventData: {
        old_restaurant_id: oldRestaurantId,
        new_restaurant_id: newRestaurantId
      }
    });
  }

  /**
   * 記錄房間歸檔事件
   */
  async logRoomArchived(roomId, archivedBy = 'system') {
    return this.logEvent({
      roomId,
      eventType: EVENT_TYPES.ROOM_ARCHIVED,
      userId: null,
      eventData: {
        archived_by: archivedBy
      }
    });
  }

  /**
   * 記錄錯誤事件
   */
  async logError(roomId, userId, errorType, errorMessage, errorStack = null) {
    return this.logEvent({
      roomId,
      eventType: EVENT_TYPES.ERROR_OCCURRED,
      userId,
      eventData: {
        error_type: errorType,
        error_message: errorMessage,
        error_stack: errorStack
      }
    });
  }

  // ========================================================================
  // 查詢方法
  // ========================================================================

  /**
   * 獲取房間事件日誌
   *
   * @param {string} roomId - 房間 ID
   * @param {Object} options - 選項
   * @param {string[]} options.eventTypes - 過濾事件類型
   * @param {number} options.limit - 限制數量
   * @returns {Promise<Object>}
   */
  async getRoomEvents(roomId, options = {}) {
    try {
      let query = supabase
        .from('buddies_events')
        .select('*')
        .eq('room_id', roomId);

      if (options.eventTypes && options.eventTypes.length > 0) {
        query = query.in('event_type', options.eventTypes);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      query = query.order('created_at', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        events: data || [],
        count: data?.length || 0
      };
    } catch (error) {
      console.error('獲取房間事件失敗:', error);
      return {
        success: false,
        message: error.message,
        events: []
      };
    }
  }

  /**
   * 獲取房間事件時間線
   */
  async getRoomTimeline(roomId) {
    try {
      const { data, error } = await supabase
        .from('buddies_room_timeline')
        .select('*')
        .eq('room_id', roomId);

      if (error) throw error;

      return {
        success: true,
        timeline: data || []
      };
    } catch (error) {
      console.error('獲取房間時間線失敗:', error);
      return {
        success: false,
        message: error.message,
        timeline: []
      };
    }
  }

  /**
   * 獲取用戶參與的所有房間事件
   */
  async getUserEvents(userId, options = {}) {
    try {
      let query = supabase
        .from('buddies_events')
        .select('*')
        .eq('user_id', userId);

      if (options.eventTypes) {
        query = query.in('event_type', options.eventTypes);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        events: data || [],
        count: data?.length || 0
      };
    } catch (error) {
      console.error('獲取用戶事件失敗:', error);
      return {
        success: false,
        message: error.message,
        events: []
      };
    }
  }

  /**
   * 分析用戶 Buddies 行為
   */
  async analyzeUserBehavior(userId) {
    try {
      const { data, error } = await supabase
        .rpc('analyze_user_buddies_behavior', { p_user_id: userId });

      if (error) throw error;

      return {
        success: true,
        analysis: data[0] || {}
      };
    } catch (error) {
      console.error('分析用戶行為失敗:', error);

      // 降級方案：基礎統計
      const { events } = await this.getUserEvents(userId);

      return {
        success: true,
        analysis: {
          total_events: events.length,
          rooms_participated: new Set(events.map(e => e.room_id)).size,
          votes_cast: events.filter(e => e.event_type === EVENT_TYPES.VOTE_CAST).length,
          questions_answered: events.filter(e => e.event_type === EVENT_TYPES.QUESTION_ANSWERED).length
        }
      };
    }
  }

  /**
   * 獲取事件統計
   */
  async getEventStats() {
    try {
      const { data, error } = await supabase
        .from('buddies_event_stats')
        .select('*');

      if (error) throw error;

      return {
        success: true,
        stats: data || []
      };
    } catch (error) {
      console.error('獲取事件統計失敗:', error);
      return {
        success: false,
        message: error.message,
        stats: []
      };
    }
  }
}

// 創建單例
const buddiesEventService = new BuddiesEventService();

export default buddiesEventService;
export { BuddiesEventService };
