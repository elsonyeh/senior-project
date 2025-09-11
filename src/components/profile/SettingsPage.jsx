import React, { useState } from 'react';
import { 
  IoChevronForwardOutline,
  IoHelpCircleOutline,
  IoMailOutline,
  IoInformationCircleOutline,
  IoLogOutOutline,
  IoTrashOutline,
  IoNotificationsOutline,
  IoPersonOutline,
  IoAccessibilityOutline,
  IoLogInOutline,
  IoPersonAddOutline
} from 'react-icons/io5';
import './SettingsPage.css';

export default function SettingsPage({ user, onLogout, onDeleteAccount, onShowAuthModal, onNavigate }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [accessibilityEnabled, setAccessibilityEnabled] = useState(false);

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
    if (confirm('確定要登出嗎？')) {
      onLogout();
    }
  };

  const handleDeleteAccount = () => {
    if (confirm('確定要刪除帳號嗎？此操作無法復原。')) {
      onDeleteAccount();
    }
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
      icon: IoNotificationsOutline,
      label: '通知設定',
      type: 'toggle',
      value: notificationsEnabled,
      onChange: (value) => handleToggle('notifications', value)
    },
    {
      icon: IoHelpCircleOutline,
      label: '常見問題',
      type: 'nav',
      onClick: () => onNavigate && onNavigate('faq')
    },
    {
      icon: IoMailOutline,
      label: '聯絡客服',
      type: 'nav',
      onClick: () => onNavigate && onNavigate('contact')
    },
    {
      icon: IoInformationCircleOutline,
      label: '關於我們',
      type: 'nav',
      onClick: () => onNavigate && onNavigate('about')
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
    </div>
  );
}