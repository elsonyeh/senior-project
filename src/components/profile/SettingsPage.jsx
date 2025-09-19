import React, { useState } from 'react';
import {
  IoChevronForwardOutline,
  IoLogOutOutline,
  IoTrashOutline,
  IoNotificationsOutline,
  IoPersonOutline,
  IoAccessibilityOutline,
  IoLogInOutline,
  IoPersonAddOutline
} from 'react-icons/io5';
import ConfirmDialog from '../common/ConfirmDialog';
import './SettingsPage.css';

export default function SettingsPage({ user, onLogout, onDeleteAccount, onShowAuthModal, onNavigate }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [accessibilityEnabled, setAccessibilityEnabled] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleToggle = (setting, value) => {
    switch (setting) {
      case 'notifications':
        setNotificationsEnabled(value);
        break;
      case 'accessibility':
        setAccessibilityEnabled(value);
        break;
    }
  };

  const handleLogout = () => {
    setShowLogoutDialog(true);
  };

  const confirmLogout = () => {
    setShowLogoutDialog(false);
    onLogout();
  };

  const handleDeleteAccount = () => {
    setShowDeleteDialog(true);
  };

  const confirmDeleteAccount = () => {
    setShowDeleteDialog(false);
    onDeleteAccount();
  };

  // 未登入用戶的設定項目
  const guestSettingsItems = [
    {
      icon: IoLogInOutline,
      label: '登入',
      type: 'action',
      onClick: () => onShowAuthModal && onShowAuthModal('login'),
      className: 'login-item'
    },
    {
      icon: IoPersonAddOutline,
      label: '註冊',
      type: 'action', 
      onClick: () => onShowAuthModal && onShowAuthModal('register'),
      className: 'register-item'
    }
  ];

  // 已登入用戶的設定項目
  const userSettingsItems = [
    {
      icon: IoPersonOutline,
      label: '個人資料',
      type: 'nav',
      onClick: () => onNavigate && onNavigate('profileEdit')
    },
    {
      icon: IoNotificationsOutline,
      label: '通知設定',
      type: 'toggle',
      value: notificationsEnabled,
      onChange: (value) => handleToggle('notifications', value)
    },
    {
      icon: IoLogOutOutline,
      label: '登出',
      type: 'action',
      onClick: handleLogout,
      className: 'logout-item'
    },
    {
      icon: IoTrashOutline,
      label: '刪除帳號',
      type: 'action',
      onClick: handleDeleteAccount,
      className: 'delete-item'
    }
  ];

  const settingsItems = user ? userSettingsItems : guestSettingsItems;

  return (
    <div className="settings-content">
      <div className="settings-items-container">
        {settingsItems.map((item, itemIndex) => (
          <div 
            key={itemIndex} 
            className={`settings-item ${item.className || ''}`}
            onClick={item.type === 'nav' || item.type === 'action' ? item.onClick : undefined}
          >
            <div className="settings-item-content">
              <div className="settings-item-left">
                <div className="settings-item-icon">
                  <item.icon />
                </div>
                <span className="settings-item-label">{item.label}</span>
              </div>
              
              <div className="settings-item-right">
                {item.type === 'toggle' && (
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={item.value}
                      onChange={(e) => item.onChange(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                )}
                
                {item.type === 'nav' && (
                  <IoChevronForwardOutline className="nav-arrow" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

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
    </div>
  );
}