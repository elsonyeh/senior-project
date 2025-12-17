/**
 * Buddies 房間歸檔服務
 *
 * 功能:
 * - 自動歸檔已完成的房間到 buddies_rooms_archive
 * - 預計算統計數據，加速分析查詢
 * - 支援手動和自動歸檔
 *
 * 相關文檔:
 * - docs/DATA-LIFECYCLE-MANAGEMENT.md
 * - docs/DATABASE-AUDIT-REPORT.md
 *
 * @module services/archiveService
 */

import { supabase } from './supabaseService.js';

/**
 * 歸檔服務類
 */
class ArchiveService {
  /**
   * 歸檔單個已完成的房間
   *
   * @param {string} roomId - 房間 ID
   * @returns {Promise<{success: boolean, message: string, data?: object}>}
   */
  async archiveCompletedRoom(roomId) {
    try {
      // 1. 獲取完整房間數據
      const { data: room, error: fetchError } = await supabase
        .from('buddies_rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (fetchError) {
        throw new Error(`獲取房間數據失敗: ${fetchError.message}`);
      }

      if (!room) {
        return {
          success: false,
          message: `房間 ${roomId} 不存在`
        };
      }

      if (room.status !== 'completed') {
        return {
          success: false,
          message: `房間 ${room.room_code} 尚未完成 (狀態: ${room.status})`
        };
      }

      // 2. 計算統計數據
      // 從 buddies_members 表查詢成員數量
      const { data: members } = await supabase
        .from('buddies_members')
        .select('id')
        .eq('room_id', roomId)
        .eq('status', 'active');

      const memberCount = members?.length || 0;

      const totalVotes = room.votes
        ? Object.values(room.votes).reduce((sum, v) => sum + (v.count || 0), 0)
        : 0;

      const decisionTimeSeconds = room.completed_at && room.created_at
        ? Math.floor((new Date(room.completed_at) - new Date(room.created_at)) / 1000)
        : null;

      const questionsCount = room.questions?.length || 0;

      const recommendationsCount = room.recommendations?.length || 0;

      // 3. 插入或更新歸檔表（使用 UPSERT 避免主鍵衝突）
      const { data: archived, error: archiveError } = await supabase
        .from('buddies_rooms_archive')
        .upsert({
          // 基本資訊
          id: room.id,
          room_code: room.room_code,
          host_id: room.host_id,
          host_name: room.host_name,
          status: room.status,

          // JSONB 數據
          members_data: [], // 不再使用 room.members_data，成員數據在 buddies_members 表
          member_answers: room.member_answers,
          collective_answers: room.collective_answers,
          recommendations: room.recommendations,
          votes: room.votes,
          questions: room.questions,

          // 最終選擇
          final_restaurant_id: room.final_restaurant_id,
          final_restaurant_data: room.final_restaurant_data,

          // 統計數據
          member_count: memberCount,
          total_votes: totalVotes,
          decision_time_seconds: decisionTimeSeconds,
          questions_count: questionsCount,
          recommendations_count: recommendationsCount,

          // 時間戳
          created_at: room.created_at,
          questions_started_at: room.questions_started_at,
          voting_started_at: room.voting_started_at,
          completed_at: room.completed_at,
          archived_at: new Date().toISOString(),

          // 元數據
          schema_version: '1.0',
          archived_by: 'app_service'
        }, {
          onConflict: 'id', // 指定衝突時使用 id 欄位判斷
          ignoreDuplicates: false // 發生衝突時更新而不是忽略
        })
        .select()
        .single();

      if (archiveError) {
        throw new Error(`歸檔失敗: ${archiveError.message}`);
      }

      console.log(`✅ 房間 ${room.room_code} 已成功歸檔`);

      return {
        success: true,
        message: `房間 ${room.room_code} 已成功歸檔`,
        data: {
          roomId: archived.id,
          roomCode: archived.room_code,
          memberCount,
          totalVotes,
          decisionTimeSeconds,
          archivedAt: archived.archived_at
        }
      };

    } catch (error) {
      console.error('❌ 歸檔房間失敗:', error);
      return {
        success: false,
        message: error.message,
        error
      };
    }
  }

  /**
   * 批次歸檔多個房間
   *
   * @param {string[]} roomIds - 房間 ID 陣列
   * @returns {Promise<{success: boolean, results: Array}>}
   */
  async archiveMultipleRooms(roomIds) {
    const results = [];

    for (const roomId of roomIds) {
      const result = await this.archiveCompletedRoom(roomId);
      results.push({
        roomId,
        ...result
      });
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return {
      success: failCount === 0,
      message: `成功歸檔 ${successCount} 個房間，失敗 ${failCount} 個`,
      results
    };
  }

  /**
   * 歸檔所有符合條件的已完成房間
   *
   * @param {Object} options - 選項
   * @param {number} options.olderThanHours - 完成超過多少小時的房間（預設 24）
   * @returns {Promise<{success: boolean, archivedCount: number, results: Array}>}
   */
  async archiveOldCompletedRooms(options = {}) {
    const { olderThanHours = 24 } = options;

    try {
      // 1. 查詢符合條件的房間
      const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();

      const { data: rooms, error: fetchError } = await supabase
        .from('buddies_rooms')
        .select('id, room_code, completed_at')
        .eq('status', 'completed')
        .lt('completed_at', cutoffTime);

      if (fetchError) {
        throw new Error(`查詢房間失敗: ${fetchError.message}`);
      }

      if (!rooms || rooms.length === 0) {
        return {
          success: true,
          message: `沒有符合條件的房間需要歸檔`,
          archivedCount: 0,
          results: []
        };
      }

      console.log(`找到 ${rooms.length} 個需要歸檔的房間`);

      // 2. 批次歸檔
      const roomIds = rooms.map(r => r.id);
      const archiveResult = await this.archiveMultipleRooms(roomIds);

      return {
        ...archiveResult,
        archivedCount: archiveResult.results.filter(r => r.success).length
      };

    } catch (error) {
      console.error('❌ 批次歸檔失敗:', error);
      return {
        success: false,
        message: error.message,
        archivedCount: 0,
        results: [],
        error
      };
    }
  }

  /**
   * 檢查房間是否已歸檔
   *
   * @param {string} roomId - 房間 ID
   * @returns {Promise<boolean>}
   */
  async isRoomArchived(roomId) {
    try {
      const { data, error } = await supabase
        .from('buddies_rooms_archive')
        .select('id')
        .eq('id', roomId)
        .maybeSingle();

      if (error) throw error;

      return !!data;
    } catch (error) {
      console.error('檢查歸檔狀態失敗:', error);
      return false;
    }
  }

  /**
   * 獲取歸檔統計
   *
   * @returns {Promise<Object>}
   */
  async getArchiveStats() {
    try {
      // 使用資料庫函數獲取統計
      const { data, error } = await supabase
        .rpc('get_archive_stats');

      if (error) throw error;

      return {
        success: true,
        stats: data[0] || {}
      };
    } catch (error) {
      console.error('獲取歸檔統計失敗:', error);

      // 降級方案：手動計算
      try {
        const { count: totalArchived } = await supabase
          .from('buddies_rooms_archive')
          .select('*', { count: 'exact', head: true });

        const today = new Date().toISOString().split('T')[0];

        const { count: archivedToday } = await supabase
          .from('buddies_rooms_archive')
          .select('*', { count: 'exact', head: true })
          .gte('archived_at', today);

        return {
          success: true,
          stats: {
            total_archived: totalArchived,
            archived_today: archivedToday
          }
        };
      } catch (fallbackError) {
        return {
          success: false,
          message: fallbackError.message
        };
      }
    }
  }

  /**
   * 查詢歸檔記錄
   *
   * @param {Object} filters - 查詢條件
   * @param {string} filters.roomId - 房間 ID
   * @param {string} filters.roomCode - 房間碼
   * @param {Date} filters.archivedAfter - 歸檔時間晚於
   * @param {Date} filters.archivedBefore - 歸檔時間早於
   * @param {number} filters.limit - 限制數量
   * @returns {Promise<Object>}
   */
  async queryArchive(filters = {}) {
    try {
      let query = supabase
        .from('buddies_rooms_archive')
        .select('*');

      if (filters.roomId) {
        query = query.eq('id', filters.roomId);
      }

      if (filters.roomCode) {
        query = query.eq('room_code', filters.roomCode);
      }

      if (filters.archivedAfter) {
        query = query.gte('archived_at', filters.archivedAfter.toISOString());
      }

      if (filters.archivedBefore) {
        query = query.lte('archived_at', filters.archivedBefore.toISOString());
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      query = query.order('archived_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: data || [],
        count: data?.length || 0
      };
    } catch (error) {
      console.error('查詢歸檔記錄失敗:', error);
      return {
        success: false,
        message: error.message,
        data: []
      };
    }
  }

  /**
   * 從歸檔中恢復房間（僅供緊急情況使用）
   *
   * @param {string} roomId - 房間 ID
   * @returns {Promise<Object>}
   */
  async restoreRoom(roomId) {
    try {
      // 1. 從歸檔表獲取數據
      const { data: archivedRoom, error: fetchError } = await supabase
        .from('buddies_rooms_archive')
        .select('*')
        .eq('id', roomId)
        .single();

      if (fetchError) throw new Error(`獲取歸檔數據失敗: ${fetchError.message}`);

      // 2. 插入回主表
      const { data: restored, error: restoreError } = await supabase
        .from('buddies_rooms')
        .insert({
          id: archivedRoom.id,
          room_code: archivedRoom.room_code,
          host_id: archivedRoom.host_id,
          host_name: archivedRoom.host_name,
          status: archivedRoom.status,
          // members_data 不再使用，成員數據在 buddies_members 表
          member_answers: archivedRoom.member_answers,
          collective_answers: archivedRoom.collective_answers,
          recommendations: archivedRoom.recommendations,
          votes: archivedRoom.votes,
          questions: archivedRoom.questions,
          final_restaurant_id: archivedRoom.final_restaurant_id,
          final_restaurant_data: archivedRoom.final_restaurant_data,
          created_at: archivedRoom.created_at,
          questions_started_at: archivedRoom.questions_started_at,
          voting_started_at: archivedRoom.voting_started_at,
          completed_at: archivedRoom.completed_at
        })
        .select()
        .single();

      if (restoreError) {
        throw new Error(`恢復房間失敗: ${restoreError.message}`);
      }

      console.log(`✅ 房間 ${archivedRoom.room_code} 已從歸檔恢復`);

      return {
        success: true,
        message: `房間 ${archivedRoom.room_code} 已成功恢復`,
        data: restored
      };

    } catch (error) {
      console.error('❌ 恢復房間失敗:', error);
      return {
        success: false,
        message: error.message,
        error
      };
    }
  }
}

// 創建單例
const archiveService = new ArchiveService();

export default archiveService;
