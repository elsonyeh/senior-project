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
          }
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      return {
        success: true,
        user: data.user,
        session: data.session,
        message: '登入成功！'
      };
    } catch (error) {
      console.error('登入失敗:', error);
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
          redirectTo: window.location.origin
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
          redirectTo: window.location.origin
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
      if (error) throw error;

      return {
        success: true,
        message: '已安全登出'
      };
    } catch (error) {
      console.error('登出失敗:', error);
      return {
        success: false,
        error: this.getErrorMessage(error)
      };
    }
  },

  // 獲取當前用戶
  async getCurrentUser() {
    try {
      // 先檢查是否有有效的會話
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        return {
          success: false,
          user: null,
          error: 'No active session'
        };
      }

      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) throw error;

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
        redirectTo: `${window.location.origin}/reset-password`
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
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

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
      'Network error': '網路連線錯誤，請檢查網路連線'
    };

    return errorMessages[error.message] || error.message || '操作失敗，請稍後再試';
  }
};

export default authService;