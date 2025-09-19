// 優化後的選擇紀錄服務 - 避免與現有 Buddies 系統重複
import { supabase } from './supabaseService.js';
import { authService } from './authService.js';

class OptimizedSelectionHistoryService {
  constructor() {
    this.sessionId = this.getOrCreateSessionId();
  }

  // 獲取或創建會話ID（用於匿名用戶）
  getOrCreateSessionId() {
    let sessionId = localStorage.getItem('swifttaste_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      localStorage.setItem('swifttaste_session_id', sessionId);
    }
    return sessionId;
  }

  // 開始選擇會話（優化版）
  async startSession(mode, initialData = {}) {
    try {
      console.log(`Starting ${mode} session...`);

      const currentUser = await authService.getCurrentUser();
      const userId = currentUser.success ? currentUser.user?.id : null;

      // 根據模式決定資料儲存策略
      if (mode === 'buddies' && initialData.buddiesRoomId) {
        // Buddies 模式：主要依賴現有 Buddies 系統，只記錄個人體驗
        const sessionData = {
          user_id: userId,
          session_id: this.sessionId,
          mode: mode,
          source_type: 'buddies_room',
          started_at: new Date().toISOString(),
          buddies_room_id: initialData.buddiesRoomId,
          buddies_role: initialData.isHost ? 'host' : 'member',
          user_location: initialData.user_location,
          swipe_count: 0,
          liked_restaurants: []
        };

        const { data, error } = await supabase
          .from('user_selection_history')
          .insert(sessionData)
          .select()
          .single();

        if (error) throw error;

        console.log('Buddies session started (lightweight):', data.id);
        return {
          success: true,
          sessionId: data.id,
          data,
          mode: 'buddies_lightweight' // 標示為輕量版
        };

      } else {
        // SwiftTaste 模式：完整記錄所有資料
        const sessionData = {
          user_id: userId,
          session_id: this.sessionId,
          mode: mode,
          source_type: 'direct',
          started_at: new Date().toISOString(),
          basic_answers: [],
          fun_answers: [],
          swipe_count: 0,
          liked_restaurants: [],
          user_location: initialData.user_location
        };

        const { data, error } = await supabase
          .from('user_selection_history')
          .insert(sessionData)
          .select()
          .single();

        if (error) throw error;

        console.log('SwiftTaste session started (full):', data.id);
        return {
          success: true,
          sessionId: data.id,
          data,
          mode: 'swifttaste_full' // 標示為完整版
        };
      }
    } catch (error) {
      console.error('Failed to start session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 更新會話數據
  async updateSession(sessionId, updates) {
    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('user_selection_history')
        .update(updateData)
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Failed to update session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 完成會話
  async completeSession(sessionId, finalData = {}) {
    try {
      const completionData = {
        completed_at: new Date().toISOString(),
        ...finalData
      };

      // 計算會話持續時間
      if (finalData.started_at) {
        const startTime = new Date(finalData.started_at);
        const endTime = new Date();
        completionData.session_duration = Math.round((endTime - startTime) / 1000);
      }

      return await this.updateSession(sessionId, completionData);
    } catch (error) {
      console.error('Failed to complete session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 記錄基本答案（僅 SwiftTaste 模式）
  async saveBasicAnswers(sessionId, answers) {
    try {
      // 檢查會話模式
      const { data: session } = await supabase
        .from('user_selection_history')
        .select('mode, source_type')
        .eq('id', sessionId)
        .single();

      if (session?.source_type === 'buddies_room') {
        // Buddies 模式：答案已經存儲在 buddies_answers 表格中
        console.log('Buddies mode: answers stored in buddies_answers table');
        return { success: true, message: 'Buddies answers handled by existing system' };
      }

      // SwiftTaste 模式：直接存儲
      return await this.updateSession(sessionId, {
        basic_answers: Array.isArray(answers) ? answers : []
      });
    } catch (error) {
      console.error('Failed to save basic answers:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 記錄趣味問題答案（僅 SwiftTaste 模式）
  async saveFunAnswers(sessionId, answers) {
    try {
      // 檢查會話模式
      const { data: session } = await supabase
        .from('user_selection_history')
        .select('mode, source_type')
        .eq('id', sessionId)
        .single();

      if (session?.source_type === 'buddies_room') {
        // Buddies 模式：答案已經存儲在現有系統中
        console.log('Buddies mode: fun answers handled by existing system');
        return { success: true, message: 'Buddies fun answers handled by existing system' };
      }

      // SwiftTaste 模式：直接存儲
      return await this.updateSession(sessionId, {
        fun_answers: Array.isArray(answers) ? answers : []
      });
    } catch (error) {
      console.error('Failed to save fun answers:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 記錄推薦結果（僅 SwiftTaste 模式）
  async saveRecommendations(sessionId, restaurants) {
    try {
      // 檢查會話模式
      const { data: session } = await supabase
        .from('user_selection_history')
        .select('mode, source_type')
        .eq('id', sessionId)
        .single();

      if (session?.source_type === 'buddies_room') {
        // Buddies 模式：推薦已經存儲在 buddies_recommendations 表格中
        console.log('Buddies mode: recommendations stored in buddies_recommendations table');
        return { success: true, message: 'Buddies recommendations handled by existing system' };
      }

      // SwiftTaste 模式：直接存儲
      return await this.updateSession(sessionId, {
        recommended_restaurants: Array.isArray(restaurants) ? restaurants : []
      });
    } catch (error) {
      console.error('Failed to save recommendations:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 記錄最終選擇的餐廳
  async saveFinalRestaurant(sessionId, restaurant) {
    try {
      return await this.updateSession(sessionId, {
        final_restaurant: restaurant
      });
    } catch (error) {
      console.error('Failed to save final restaurant:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 增加滑動次數（所有模式通用）
  async incrementSwipeCount(sessionId) {
    try {
      // 先獲取當前的滑動次數
      const { data: currentSession } = await supabase
        .from('user_selection_history')
        .select('swipe_count')
        .eq('id', sessionId)
        .single();

      const newCount = (currentSession?.swipe_count || 0) + 1;

      return await this.updateSession(sessionId, {
        swipe_count: newCount
      });
    } catch (error) {
      console.error('Failed to increment swipe count:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 記錄用戶喜歡的餐廳（所有模式通用）
  async addLikedRestaurant(sessionId, restaurant) {
    try {
      // 先獲取當前的喜歡列表
      const { data: currentSession } = await supabase
        .from('user_selection_history')
        .select('liked_restaurants')
        .eq('id', sessionId)
        .single();

      const currentLiked = currentSession?.liked_restaurants || [];

      // 避免重複添加
      const alreadyLiked = currentLiked.some(liked =>
        (liked.id && liked.id === restaurant.id) ||
        (liked.name && liked.name === restaurant.name)
      );

      if (!alreadyLiked) {
        const newLiked = [...currentLiked, restaurant];
        return await this.updateSession(sessionId, {
          liked_restaurants: newLiked
        });
      }

      return { success: true, data: currentSession };
    } catch (error) {
      console.error('Failed to add liked restaurant:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 獲取用戶的完整歷史（使用視圖）
  async getUserHistory(limit = 20, offset = 0) {
    try {
      const currentUser = await authService.getCurrentUser();
      let query = supabase
        .from('user_complete_history') // 使用整合視圖
        .select('*')
        .order('started_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (currentUser.success && currentUser.user) {
        // 已登入用戶：查詢用戶ID的紀錄
        query = query.eq('user_id', currentUser.user.id);
      } else {
        // 未登入用戶：查詢會話ID的紀錄
        query = query.eq('session_id', this.sessionId).is('user_id', null);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: data || []
      };
    } catch (error) {
      console.error('Failed to get user history:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  // 獲取用戶統計數據（使用視圖）
  async getUserStats() {
    try {
      const currentUser = await authService.getCurrentUser();
      let query = supabase
        .from('user_selection_stats') // 使用統計視圖
        .select('*');

      if (currentUser.success && currentUser.user) {
        query = query.eq('user_id', currentUser.user.id);
      } else {
        query = query.eq('session_id', this.sessionId).is('user_id', null);
      }

      const { data, error } = await query;

      if (error) throw error;

      // 合併多個記錄的統計數據
      if (data && data.length > 0) {
        const aggregatedStats = data.reduce((acc, record) => {
          return {
            totalSessions: (acc.totalSessions || 0) + (record.total_sessions || 0),
            completedSessions: (acc.completedSessions || 0) + (record.completed_sessions || 0),
            swiftTasteSessions: (acc.swiftTasteSessions || 0) + (record.swifttaste_sessions || 0),
            buddiesSessions: (acc.buddiesSessions || 0) + (record.buddies_sessions || 0),
            totalSwipes: (acc.totalSwipes || 0) + (record.total_swipes || 0),
            averageDuration: record.avg_duration || acc.averageDuration || 0,
            averageSatisfaction: record.avg_satisfaction || acc.averageSatisfaction || 0,
            uniqueBuddiesRooms: (acc.uniqueBuddiesRooms || 0) + (record.unique_buddies_rooms || 0),
            timesAsHost: (acc.timesAsHost || 0) + (record.times_as_host || 0),
            timesAsMember: (acc.timesAsMember || 0) + (record.times_as_member || 0)
          };
        }, {});

        return {
          success: true,
          stats: aggregatedStats
        };
      }

      return {
        success: true,
        stats: {
          totalSessions: 0,
          completedSessions: 0,
          swiftTasteSessions: 0,
          buddiesSessions: 0,
          totalSwipes: 0,
          averageDuration: 0
        }
      };
    } catch (error) {
      console.error('Failed to get user stats:', error);
      return {
        success: false,
        error: error.message,
        stats: null
      };
    }
  }

  // 設置 Buddies 房間 ID（輕量版）
  async setBuddiesRoomId(sessionId, roomId) {
    try {
      return await this.updateSession(sessionId, {
        buddies_room_id: roomId
      });
    } catch (error) {
      console.error('Failed to set buddies room ID:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 記錄用戶滿意度評價
  async setUserSatisfaction(sessionId, satisfaction, notes = '') {
    try {
      return await this.updateSession(sessionId, {
        user_satisfaction: satisfaction,
        feedback_notes: notes
      });
    } catch (error) {
      console.error('Failed to set user satisfaction:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 設置用戶位置
  async setUserLocation(sessionId, location) {
    try {
      return await this.updateSession(sessionId, {
        user_location: location
      });
    } catch (error) {
      console.error('Failed to set user location:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 同步現有 Buddies 資料到歷史記錄
  async syncBuddiesHistory() {
    try {
      const { data, error } = await supabase.rpc('sync_buddies_to_history');

      if (error) throw error;

      return {
        success: true,
        syncedCount: data
      };
    } catch (error) {
      console.error('Failed to sync buddies history:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 刪除選擇紀錄
  async deleteSession(sessionId) {
    try {
      const { error } = await supabase
        .from('user_selection_history')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Failed to delete session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 清除所有歷史紀錄
  async clearAllHistory() {
    try {
      const currentUser = await authService.getCurrentUser();
      let query = supabase
        .from('user_selection_history')
        .delete();

      if (currentUser.success && currentUser.user) {
        query = query.eq('user_id', currentUser.user.id);
      } else {
        query = query.eq('session_id', this.sessionId).is('user_id', null);
      }

      const { error } = await query;

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Failed to clear all history:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 轉換 Buddies 資料到顯示格式
  getBuddiesDataFromExistingTables(historyRecord) {
    if (historyRecord.mode !== 'buddies' || !historyRecord.buddies_room_id) {
      return null;
    }

    return {
      roomId: historyRecord.buddies_room_id,
      role: historyRecord.buddies_role,
      hostName: historyRecord.buddies_host_name,
      roomStatus: historyRecord.buddies_room_status,
      // 答案和推薦從現有 Buddies 表格中獲取
      effectiveAnswers: historyRecord.effective_answers,
      effectiveRecommendations: historyRecord.effective_recommendations
    };
  }
}

// 創建單例實例
export const optimizedSelectionHistoryService = new OptimizedSelectionHistoryService();

// 導出類別以供測試使用
export { OptimizedSelectionHistoryService };

export default optimizedSelectionHistoryService;