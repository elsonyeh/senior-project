// 用戶認證服務 - 使用 Supabase Auth
import { supabase } from './supabaseService.js';

export const authService = {
  // 用戶註冊
  async signUp(email, password, userData = {}) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: userData.name || email.split('@')[0],
            bio: userData.bio || '',
            avatar_url: userData.avatar_url || null
          },
          emailRedirectTo: import.meta.env.DEV ?
            window.location.origin :
            'https://senior-project-ruby.vercel.app'
        }
      });

      if (error) throw error;

      return {
        success: true,
        user: data.user,
        message: '註冊成功！請檢查您的電子郵件以確認帳戶。'
      };
    } catch (error) {
      console.error('註冊失敗:', error);
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  },

  // 用戶登入
  async signIn(email, password) {
    try {
      console.log('嘗試登入:', { email, passwordLength: password?.length });

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      console.log('Supabase 登入回應:', { data, error });

      if (error) throw error;

      return {
        success: true,
        user: data.user,
        session: data.session,
        message: '登入成功！'
      };
    } catch (error) {
      // 對於常見的認證錯誤，只記錄基本訊息，避免過多的錯誤日誌
      if (error.message === 'Invalid login credentials') {
        console.log('登入失敗: 帳號或密碼錯誤');
      } else {
        console.error('登入失敗:', error);
        console.error('錯誤詳情:', {
          message: error.message,
          status: error.status,
          statusText: error.statusText
        });
      }

      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  },

  // Google 登入
  async signInWithGoogle() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: import.meta.env.DEV ?
            window.location.origin :
            'https://senior-project-ruby.vercel.app'
        }
      });

      if (error) throw error;

      return {
        success: true,
        data,
        message: 'Google 登入成功！'
      };
    } catch (error) {
      console.error('Google 登入失敗:', error);
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  },

  // Apple 登入（未來實現）
  async signInWithApple() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: import.meta.env.DEV ?
            window.location.origin :
            'https://senior-project-ruby.vercel.app'
        }
      });

      if (error) throw error;

      return {
        success: true,
        data,
        message: 'Apple 登入成功！'
      };
    } catch (error) {
      console.error('Apple 登入失敗:', error);
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  },

  // 用戶登出
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();

      // 無論 Supabase 登出是否成功，都清除本地儲存
      this.clearLocalStorage();

      if (error && !error.message?.includes('session_not_found')) {
        console.warn('登出時出現錯誤，但本地儲存已清除:', error);
      }

      return {
        success: true,
        message: '已安全登出'
      };
    } catch (error) {
      console.error('登出失敗:', error);
      // 即使登出失敗，也清除本地儲存
      this.clearLocalStorage();

      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  },

  // 清除本地儲存
  clearLocalStorage() {
    try {
      // 清除 Supabase 相關的本地儲存
      const keys = ['sb-ijgelbxfrahtrrcjijqf-auth-token', 'swifttaste-auth'];
      keys.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      console.log('本地認證資料已清除');
    } catch (error) {
      console.warn('清除本地儲存時出現錯誤:', error);
    }
  },

  // 獲取當前用戶
  async getCurrentUser() {
    try {
      // 先檢查是否有有效的會話
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      // 如果會話錯誤或不存在，清除可能損壞的本地儲存
      if (sessionError || !session) {
        // 檢查是否是 refresh token 錯誤
        if (sessionError?.message?.includes('refresh_token') || sessionError?.status === 400) {
          console.log('Refresh token 無效，正在清除會話...');
          await this.signOut();
        }

        return {
          success: false,
          user: null,
          error: 'No active session'
        };
      }

      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        // 如果獲取用戶資訊失敗，也清除會話
        if (error.status === 401 || error.status === 400) {
          console.log('用戶資訊無效，正在清除會話...');
          await this.signOut();
        }
        throw error;
      }

      return {
        success: true,
        user
      };
    } catch (error) {
      console.error('獲取用戶資訊失敗:', error);
      return {
        success: false,
        user: null,
        error: this.getErrorMessage(error)
      };
    }
  },

  // 獲取當前會話
  async getSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;

      return {
        success: true,
        session
      };
    } catch (error) {
      console.error('獲取會話失敗:', error);
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  },

  // 更新用戶資料
  async updateUser(updates) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: updates
      });

      if (error) throw error;

      return {
        success: true,
        user: data.user,
        message: '個人資料已更新'
      };
    } catch (error) {
      console.error('更新用戶資料失敗:', error);
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  },

  // 重設密碼
  async resetPassword(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${import.meta.env.DEV ?
          window.location.origin :
          'https://senior-project-ruby.vercel.app'}/reset-password`
      });

      if (error) throw error;

      return {
        success: true,
        message: '密碼重設郵件已發送，請檢查您的信箱'
      };
    } catch (error) {
      console.error('重設密碼失敗:', error);
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  },

  // 監聽認證狀態變化
  onAuthStateChange(callback) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        callback(event, session);
      }
    );

    return subscription;
  },

  // 上傳頭像
  async uploadAvatar(file, userId) {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/avatar.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // 更新用戶頭像URL
      const updateResult = await this.updateUser({
        avatar_url: data.publicUrl
      });

      if (!updateResult.success) throw new Error(updateResult.error);

      return {
        success: true,
        avatarUrl: data.publicUrl,
        message: '頭像已更新'
      };
    } catch (error) {
      console.error('上傳頭像失敗:', error);
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  },


  // 錯誤訊息處理
  getErrorMessage(error) {
    const errorMessages = {
      'Invalid login credentials': '帳號或密碼錯誤',
      'User already registered': '此電子郵件已註冊',
      'Password should be at least 6 characters': '密碼至少需要6個字元',
      'Invalid email': '電子郵件格式錯誤',
      'Email not confirmed': '請先確認您的電子郵件',
      'Too many requests': '請求過於頻繁，請稍後再試',
      'Network error': '網路連線錯誤，請檢查網路連線',
      'Invalid refresh token': '會話已過期，請重新登入',
      'refresh_token': '會話已過期，請重新登入'
    };

    // 檢查錯誤訊息中是否包含 refresh_token
    if (error.message && error.message.includes('refresh_token')) {
      return '會話已過期，請重新登入';
    }

    return errorMessages[error.message] || error.message || '操作失敗，請稍後再試';
  }
};

export default authService;