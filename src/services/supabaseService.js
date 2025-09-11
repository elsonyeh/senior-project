// supabaseService.js
// Supabase 服務 - 替代 Firebase Realtime Database

import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key exists:', !!supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase 配置缺失，請檢查環境變數');
  console.error('VITE_SUPABASE_URL:', supabaseUrl);
  console.error('VITE_SUPABASE_ANON_KEY存在:', !!supabaseAnonKey);
}

// 創建 Supabase 客戶端
export const supabase = supabaseUrl && supabaseAnonKey ? 
  createClient(supabaseUrl, supabaseAnonKey, {
    realtime: {
      params: {
        eventsPerSecond: 10, // 限制每秒事件數量
      },
    },
  }) : null;

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
      if (!supabase) {
        return { success: false, error: 'Supabase 配置錯誤，請檢查環境變數' };
      }
      
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
        .select()
        .single();

      if (error) throw error;

      // 添加房主為成員
      await memberService.addMember(roomId, userId, hostName, true);

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

    const subscriptionId = `roomStatus_${roomId}`;
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
   * 更新房間狀態
   * @param {String} roomId - 房間ID
   * @param {String} status - 新狀態
   * @return {Promise<Object>} 更新結果
   */
  async updateRoomStatus(roomId, status) {
    try {
      const { data, error } = await supabase
        .from('buddies_rooms')
        .update({ 
          status,
          last_updated: new Date().toISOString(),
        })
        .eq('id', roomId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('更新房間狀態失敗:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 獲取或創建用戶ID
   * @return {String} 用戶ID
   */
  getOrCreateUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = `user_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
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
   * 監聽房間成員變化
   * @param {String} roomId - 房間ID
   * @param {Function} callback - 回調函數
   * @return {Function} 清理函數
   */
  listenRoomMembers(roomId, callback) {
    if (!roomId || typeof callback !== 'function') return () => {};

    const subscriptionId = `roomMembers_${roomId}`;
    return addSubscription(
      'buddies_members',
      `room_id=eq.${roomId}`,
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

  /**
   * 加入房間
   * @param {String} roomId - 房間ID
   * @param {String} userId - 用戶ID
   * @param {String} userName - 用戶名稱
   * @return {Promise<Object>} 加入結果
   */
  async joinRoom(roomId, userId, userName) {
    try {
      // 先檢查房間是否存在
      const roomInfo = await roomService.getRoomInfo(roomId);
      if (!roomInfo.success) {
        return { success: false, error: '房間不存在' };
      }

      // 檢查是否已經是成員
      const { data: existingMember } = await supabase
        .from('buddies_members')
        .select('*')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .single();

      if (existingMember) {
        return { success: true, isHost: existingMember.is_host };
      }

      // 添加為新成員
      const result = await this.addMember(roomId, userId, userName, false);
      if (result.success) {
        return { success: true, isHost: false };
      } else {
        return result;
      }
    } catch (error) {
      console.error('加入房間失敗:', error);
      return { success: false, error: error.message };
    }
  },
};

// 問題和答案相關功能
export const questionService = {
  /**
   * 保存問題集
   * @param {String} roomId - 房間ID
   * @param {Array} questions - 問題集
   * @return {Promise<Object>} 保存結果
   */
  async saveQuestions(roomId, questions) {
    try {
      const { data, error } = await supabase
        .from('buddies_questions')
        .upsert({
          room_id: roomId,
          questions: questions,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('保存問題集失敗:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 獲取問題集
   * @param {String} roomId - 房間ID
   * @return {Promise<Array>} 問題集
   */
  async getQuestions(roomId) {
    try {
      const { data, error } = await supabase
        .from('buddies_questions')
        .select('questions')
        .eq('room_id', roomId)
        .single();

      if (error) throw error;

      return data?.questions || [];
    } catch (error) {
      console.error('獲取問題集失敗:', error);
      return [];
    }
  },

  /**
   * 監聽問題集變化
   * @param {String} roomId - 房間ID
   * @param {Function} callback - 回調函數
   * @return {Function} 清理函數
   */
  listenQuestions(roomId, callback) {
    if (!roomId || typeof callback !== 'function') return () => {};

    const subscriptionId = `roomQuestions_${roomId}`;
    return addSubscription(
      'buddies_questions',
      `room_id=eq.${roomId}`,
      (payload) => {
        if (payload.new && payload.new.questions) {
          callback(payload.new.questions);
        }
      },
      subscriptionId
    );
  },

  /**
   * 提交答案
   * @param {String} roomId - 房間ID
   * @param {String} userId - 用戶ID
   * @param {Array} answers - 答案數組
   * @param {Array} questionTexts - 問題文本數組
   * @param {Array} questionSources - 問題來源數組
   * @return {Promise<Object>} 提交結果
   */
  async submitAnswers(roomId, userId, answers, questionTexts = [], questionSources = []) {
    try {
      const { data, error } = await supabase
        .from('buddies_answers')
        .upsert({
          room_id: roomId,
          user_id: userId,
          answers: answers,
          question_texts: questionTexts,
          question_sources: questionSources,
          submitted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('提交答案失敗:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 獲取所有答案
   * @param {String} roomId - 房間ID
   * @return {Promise<Object>} 答案列表
   */
  async getAllAnswers(roomId) {
    try {
      const { data, error } = await supabase
        .from('buddies_answers')
        .select('*')
        .eq('room_id', roomId);

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('獲取答案失敗:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 監聽答案變化
   * @param {String} roomId - 房間ID
   * @param {Function} callback - 回調函數
   * @return {Function} 清理函數
   */
  listenAnswers(roomId, callback) {
    if (!roomId || typeof callback !== 'function') return () => {};

    const subscriptionId = `roomAnswers_${roomId}`;
    return addSubscription(
      'buddies_answers',
      `room_id=eq.${roomId}`,
      (payload) => {
        // 重新獲取所有答案
        this.getAllAnswers(roomId).then(({ data }) => {
          if (data) {
            callback(data);
          }
        });
      },
      subscriptionId
    );
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

    const subscriptionId = `roomRecommendations_${roomId}`;
    return addSubscription(
      'buddies_recommendations',
      `room_id=eq.${roomId}`,
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
      localStorage.setItem(`voted_${roomId}_${userId}`, 'true');

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

    const subscriptionId = `roomVotes_${roomId}`;
    return addSubscription(
      'buddies_restaurant_votes',
      `room_id=eq.${roomId}`,
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
      if (localStorage.getItem(`voted_${roomId}_${userId}`)) {
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
   * 監聽最終選擇的餐廳
   * @param {String} roomId - 房間ID
   * @param {Function} callback - 回調函數
   * @return {Function} 清理函數
   */
  listenFinalRestaurant(roomId, callback) {
    if (!roomId || typeof callback !== 'function') return () => {};

    const subscriptionId = `roomFinal_${roomId}`;
    return addSubscription(
      'buddies_final_results',
      `room_id=eq.${roomId}`,
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
  // 管理員帳號清單（實際上應該存在資料庫中）
  adminAccounts: [
    { email: 'admin@swifttaste.com', password: 'admin123456' },
    { email: 'elson921121@gmail.com', password: '921121elson' }
  ],

  /**
   * 管理員登入
   * @param {String} email - 電子郵件
   * @param {String} password - 密碼
   * @return {Promise<Object>} 登入結果
   */
  async adminLogin(email, password) {
    try {
      console.log('AdminService: 嘗試登入:', email);
      
      // 檢查是否為授權管理員帳號
      const adminAccount = this.adminAccounts.find(
        account => account.email === email && account.password === password
      );

      if (!adminAccount) {
        console.log('AdminService: 管理員帳號驗證失敗');
        return { success: false, error: '管理員帳號或密碼錯誤' };
      }

      // 設定登入狀態
      const adminSession = {
        email: email,
        isAdmin: true,
        loginTime: new Date().toISOString(),
        sessionId: `admin_${Date.now()}_${Math.random().toString(36).substring(2)}`
      };

      localStorage.setItem('adminSession', JSON.stringify(adminSession));
      console.log('AdminService: 管理員登入成功');

      return { success: true, user: adminSession };
    } catch (error) {
      console.error('AdminService: 管理員登入失敗:', error);
      return { success: false, error: '登入過程發生錯誤' };
    }
  },

  /**
   * 檢查是否為管理員
   * @return {Promise<Boolean>} 是否為管理員
   */
  async isAdminUser() {
    try {
      console.log('AdminService: 檢查管理員權限...');
      
      const adminSession = localStorage.getItem('adminSession');
      if (!adminSession) {
        console.log('AdminService: 沒有管理員session');
        return false;
      }

      const session = JSON.parse(adminSession);
      
      // 檢查session是否有效（24小時過期）
      const loginTime = new Date(session.loginTime);
      const now = new Date();
      const hoursDiff = (now - loginTime) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        console.log('AdminService: 管理員session已過期');
        localStorage.removeItem('adminSession');
        return false;
      }

      // 驗證是否為授權管理員
      const isValidAdmin = this.adminAccounts.some(
        account => account.email === session.email
      );

      console.log('AdminService: 管理員權限檢查結果:', isValidAdmin);
      return isValidAdmin && session.isAdmin === true;
    } catch (error) {
      console.error('AdminService: 檢查管理員權限失敗:', error);
      return false;
    }
  },

  /**
   * 管理員登出
   * @return {Promise<Object>} 登出結果
   */
  async adminLogout() {
    try {
      localStorage.removeItem('adminSession');
      console.log('AdminService: 管理員登出成功');
      return { success: true };
    } catch (error) {
      console.error('AdminService: 管理員登出失敗:', error);
      return { success: false, error: '登出過程發生錯誤' };
    }
  },

  /**
   * 重設密碼（發送重設郵件）
   * @param {String} email - 電子郵件
   * @return {Promise<Object>} 重設結果
   */
  async resetPassword(email) {
    try {
      // 檢查是否為授權管理員帳號
      const adminAccount = this.adminAccounts.find(account => account.email === email);
      
      if (!adminAccount) {
        return { success: false, error: '此電子郵件不是授權的管理員帳號' };
      }

      // 模擬發送重設郵件（實際應用中應該整合真正的郵件服務）
      console.log('AdminService: 模擬發送密碼重設郵件到:', email);
      
      return { 
        success: true, 
        message: '密碼重設郵件已發送，請檢查您的信箱' 
      };
    } catch (error) {
      console.error('AdminService: 密碼重設失敗:', error);
      return { success: false, error: '密碼重設過程發生錯誤' };
    }
  },

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
          buddies_members(count)
        `)
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
  questionService,
  recommendationService,
  voteService,
  finalResultService,
  adminService,
};