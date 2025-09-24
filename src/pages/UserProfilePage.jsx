import React, { useState, useEffect, useCallback } from 'react';
import AuthModal from '../components/profile/AuthModal';
import ProfileHeader from '../components/profile/ProfileHeader';
import MyLists from '../components/profile/MyLists';
import SwiftTasteHistory from '../components/profile/SwiftTasteHistory';
import SettingsPage from '../components/profile/SettingsPage';
import ProfileMenu from '../components/profile/ProfileMenu';
import PageWrapper from '../components/profile/PageWrapper';
import FAQPage from '../components/profile/FAQPage';
import ContactPage from '../components/profile/ContactPage';
import AboutPage from '../components/profile/AboutPage';
import UserProfileEditPage from '../components/profile/UserProfilePage';
import ConfirmDialog from '../components/common/ConfirmDialog';
import LoadingOverlay from '../components/LoadingOverlay';
import { authService } from '../services/authService';
import { useNavContext } from '../App';
import {
  IoLogInOutline,
  IoPersonOutline,
  IoSettingsOutline,
  IoListOutline,
  IoTimeOutline,
  IoCloseOutline
} from 'react-icons/io5';
import './UserProfilePage.css';

export default function UserProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { setIsAuthModalOpen } = useNavContext();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [currentView, setCurrentView] = useState('menu'); // menu, profile, lists, history, settings, faq, contact, about, profileEdit
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [lastScrollTop, setLastScrollTop] = useState(0);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);

  // 處理載入動畫的延遲邏輯
  useEffect(() => {
    let timer;

    if (loading) {
      // 延遲0.1秒後才顯示載入動畫
      timer = setTimeout(() => {
        setShowLoadingOverlay(true);
      }, 100);
    } else {
      // 立即隱藏載入動畫
      setShowLoadingOverlay(false);
      if (timer) {
        clearTimeout(timer);
      }
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [loading]);

  // 滾動檢測 hook
  useEffect(() => {
    // 在我的清單、選擇紀錄、設定頁面及其子頁面隱藏導航列（像地圖模式一樣）
    if (['lists', 'history', 'settings', 'faq', 'contact', 'about', 'profileEdit'].includes(currentView)) {
      setIsNavVisible(false);
      return;
    }

    // 只在主選單頁面和個人資料頁面啟用滾動檢測
    if (['menu', 'profile'].includes(currentView)) {
      if (currentView === 'menu') {
        setIsNavVisible(true);
        return;
      }
    }

    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      // 向下滾動超過50px時隱藏導航欄，向上滾動時顯示
      if (scrollTop > lastScrollTop && scrollTop > 50) {
        // 向下滾動
        setIsNavVisible(false);
      } else {
        // 向上滾動或接近頂部
        setIsNavVisible(true);
      }

      setLastScrollTop(scrollTop <= 0 ? 0 : scrollTop);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [currentView, lastScrollTop]);

  // 頁面切換時重置導航欄顯示狀態
  useEffect(() => {
    // 在我的清單、選擇紀錄、設定頁面及其子頁面隱藏導航列
    if (['lists', 'history', 'settings', 'faq', 'contact', 'about', 'profileEdit'].includes(currentView)) {
      setIsNavVisible(false);
    } else {
      setIsNavVisible(true);
    }
    setLastScrollTop(0);
  }, [currentView]);

  useEffect(() => {
    checkAuthStatus();

    // 處理郵件驗證回調
    const handleEmailVerification = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const type = urlParams.get('type');

      if (token && type === 'signup') {
        showNotificationMessage('郵件驗證成功！歡迎加入 SwiftTaste！', 'success');
        // 清除 URL 參數
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    handleEmailVerification();

    // 監聽認證狀態變化
    const subscription = authService.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setUser(session.user);
        showNotificationMessage('登入成功！', 'success');
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setCurrentView('menu');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 通知導航欄狀態變化
  useEffect(() => {
    // 設置全域變量供 App.jsx 使用
    window.profileNavVisible = isNavVisible;
    // 觸發自定義事件
    window.dispatchEvent(new CustomEvent('profileNavChange', { detail: { isVisible: isNavVisible } }));
  }, [isNavVisible]);

  // 同步AuthModal狀態到context
  useEffect(() => {
    setIsAuthModalOpen(showAuthModal);
  }, [showAuthModal, setIsAuthModalOpen]);

  // 檢查用戶登入狀態
  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      const result = await authService.getCurrentUser();
      
      if (result.success && result.user) {
        setUser(result.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // 處理登入
  const handleLogin = async (credentials) => {
    const result = await authService.signIn(credentials.email, credentials.password);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // 用戶狀態會透過 onAuthStateChange 自動更新
    setShowAuthModal(false);
  };

  // 處理註冊
  const handleRegister = async (userData) => {
    const result = await authService.signUp(userData.email, userData.password, {
      name: userData.name,
      bio: userData.bio || ''
    });
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    showNotificationMessage(result.message, 'success');
    setShowAuthModal(false);
  };

  // 處理 Google 登入
  const handleGoogleLogin = async () => {
    try {
      const result = await authService.signInWithGoogle();
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      // 用戶狀態會透過 onAuthStateChange 自動更新
      setShowAuthModal(false);
    } catch (error) {
      console.error('Google login error:', error);
      showNotificationMessage('Google 登入暂時不可用，請使用電子郵件登入', 'error');
    }
  };

  // 處理 Apple 登入
  const handleAppleLogin = async () => {
    showNotificationMessage('Apple 登入功能開發中...', 'info');
    // const result = await authService.signInWithApple();
    // 
    // if (!result.success) {
    //   throw new Error(result.error);
    // }
    // 
    // setShowAuthModal(false);
  };

  // 處理導航
  const handleNavigate = (view) => {
    setCurrentView(view);
  };

  // 處理返回主選單
  const handleBack = () => {
    setCurrentView('menu');
  };

  // 處理登出
  const handleLogout = () => {
    setShowLogoutDialog(true);
  };

  const confirmLogout = async () => {
    setShowLogoutDialog(false);
    const result = await authService.signOut();
    
    if (result.success) {
      showNotificationMessage('已安全登出', 'success');
    } else {
      showNotificationMessage('登出失敗', 'error');
    }
  };

  // 處理刪除帳號
  const handleDeleteAccount = () => {
    setShowDeleteDialog(true);
  };

  const confirmDeleteAccount = async () => {
    setShowDeleteDialog(false);
    try {
      // 這裡可以添加刪除帳號的邏輯
      showNotificationMessage('帳號刪除功能開發中...', 'info');
    } catch (error) {
      console.error('Delete account error:', error);
      showNotificationMessage('帳號刪除失敗', 'error');
    }
  };

  // 處理頭像更新
  const handleAvatarUpdate = useCallback(async (file) => {
    if (!user) return;
    
    try {
      const result = await authService.uploadAvatar(file, user.id);
      
      if (result.success) {
        setUser(prev => ({ ...prev, user_metadata: { ...prev.user_metadata, avatar_url: result.avatarUrl } }));
        showNotificationMessage('頭像已更新！', 'success');
      } else {
        showNotificationMessage(result.error, 'error');
      }
    } catch (error) {
      console.error('Avatar update error:', error);
      showNotificationMessage('頭像更新失敗', 'error');
    }
  }, [user]);

  // 處理個人資料更新
  const handleProfileUpdate = useCallback(async (profileData) => {
    try {
      const result = await authService.updateUser(profileData);
      
      if (result.success) {
        setUser(result.user);
        showNotificationMessage('個人資料已更新！', 'success');
      } else {
        showNotificationMessage(result.error, 'error');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      showNotificationMessage('資料更新失敗', 'error');
    }
  }, [user]);

  // 顯示通知消息
  const showNotificationMessage = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  // 渲染當前視圖內容
  const renderCurrentView = () => {
    if (!user) return null;

    switch (currentView) {
      case 'menu':
        return (
          <ProfileMenu
            user={user}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
          />
        );
      case 'profile':
        return (
          <PageWrapper title="個人資料" onBack={handleBack}>
            <ProfileHeader
              user={user}
              onAvatarUpdate={handleAvatarUpdate}
              onProfileUpdate={handleProfileUpdate}
              isEditing={isEditingProfile}
              onEditToggle={setIsEditingProfile}
            />
          </PageWrapper>
        );
      case 'lists':
        return (
          <PageWrapper title="我的清單" onBack={handleBack}>
            <MyLists user={user} />
          </PageWrapper>
        );
      case 'history':
        return (
          <PageWrapper title="選擇紀錄" onBack={handleBack}>
            <SwiftTasteHistory user={user} />
          </PageWrapper>
        );
      case 'settings':
        return (
          <PageWrapper title="設定" onBack={handleBack}>
            <SettingsPage
              user={user}
              onLogout={handleLogout}
              onDeleteAccount={handleDeleteAccount}
              onShowAuthModal={() => setShowAuthModal(true)}
              onNavigate={handleNavigate}
            />
          </PageWrapper>
        );
      case 'faq':
        return (
          <PageWrapper title="常見問題" onBack={handleBack}>
            <FAQPage />
          </PageWrapper>
        );
      case 'contact':
        return (
          <PageWrapper title="聯絡客服" onBack={handleBack}>
            <ContactPage />
          </PageWrapper>
        );
      case 'about':
        return (
          <PageWrapper title="關於我們" onBack={handleBack}>
            <AboutPage />
          </PageWrapper>
        );
      case 'profileEdit':
        return (
          <PageWrapper title="個人資料" onBack={handleBack}>
            <UserProfileEditPage />
          </PageWrapper>
        );
      default:
        return null;
    }
  };

  // 使用LoadingOverlay替代簡單的載入提示

  return (
    <div className="user-profile-page">
      {/* 通知消息 */}
      {notification.show && (
        <div className={`notification ${notification.type} show`}>
          <span>{notification.message}</span>
          <button
            className="notification-close"
            onClick={() => setNotification({ show: false, message: '', type: 'success' })}
          >
            <IoCloseOutline />
          </button>
        </div>
      )}

      {/* 只有在不載入時才顯示內容 */}
      {!loading && (
        <>
          {/* 未登入狀態 */}
          {!user ? (
            <div className="profile-auth-container">
              <div className="auth-welcome">
                <div className="welcome-icon">
                  <IoPersonOutline />
                </div>
                <h2 className="welcome-title">歡迎使用 SwiftTaste</h2>
                <p className="welcome-description">
                  登入後即可管理您的收藏清單、查看SwiftTaste歷史記錄，享受更個人化的美食探索體驗
                </p>
                <button
                  className="auth-action-btn"
                  onClick={() => setShowAuthModal(true)}
                >
                  <IoLogInOutline />
                  登入 / 註冊
                </button>
              </div>
            </div>
          ) : (
            /* 已登入狀態 */
            <div className="profile-main-container">
              {renderCurrentView()}
            </div>
          )}
        </>
      )}

      {/* 登入/註冊模態框 */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onGoogleLogin={null}
        onAppleLogin={null}
      />

      {/* 登出確認對話框 */}
      <ConfirmDialog
        isOpen={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        onConfirm={confirmLogout}
        title="登出確認"
        message="您確定要登出嗎？您的個人設定和偏好將會保留，下次登入時可以繼續使用。"
        confirmText="確認登出"
        cancelText="取消"
        type="logout"
      />

      {/* 刪除帳號確認對話框 */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={confirmDeleteAccount}
        title="刪除帳號"
        message="確定要刪除帳號嗎？此操作無法復原，將會刪除所有相關數據。"
        confirmText="確認刪除"
        cancelText="取消"
        type="danger"
      />

      {/* 個人頁面載入動畫 - 延遲0.1秒後顯示 */}
      <LoadingOverlay
        show={showLoadingOverlay}
        message="載入個人資料"
        subMessage="正在檢查登入狀態..."
      />
    </div>
  );
}
