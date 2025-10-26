import React from 'react';
import {
  IoChevronForwardOutline,
  IoListOutline,
  IoStarOutline,
  IoTimeOutline,
  IoSettingsOutline,
  IoPersonOutline,
  IoHelpCircleOutline,
  IoMailOutline,
  IoInformationCircleOutline
} from 'react-icons/io5';
import './ProfileMenu.css';

export default function ProfileMenu({ user, onNavigate, onLogout }) {
  const menuItems = [
    {
      icon: IoListOutline,
      label: '我的清單',
      action: () => onNavigate('lists')
    },
    {
      icon: IoStarOutline,
      label: '我的評論',
      action: () => onNavigate('reviews')
    },
    {
      icon: IoTimeOutline,
      label: '選擇紀錄',
      action: () => onNavigate('history')
    },
    {
      icon: IoHelpCircleOutline,
      label: '常見問題',
      action: () => onNavigate('faq')
    },
    {
      icon: IoMailOutline,
      label: '聯絡客服',
      action: () => onNavigate('contact')
    },
    {
      icon: IoInformationCircleOutline,
      label: '關於我們',
      action: () => onNavigate('about')
    },
    {
      icon: IoSettingsOutline,
      label: '設定',
      action: () => onNavigate('settings')
    }
  ];

  return (
    <div className="profile-menu">
      {/* 用戶資料區域 */}
      <div className="user-profile-section">
        <div className="user-avatar">
          {user.user_metadata?.avatar_url || user.avatar_url ? (
            <img
              key={user.user_metadata?.avatar_url || user.avatar_url}
              src={user.user_metadata?.avatar_url || user.avatar_url}
              alt="用戶頭像"
              className="avatar-image"
            />
          ) : (
            <IoPersonOutline className="default-avatar" />
          )}
        </div>
        <div className="user-info">
          <h2 className="user-name">
            {user.user_metadata?.name || user.email?.split('@')[0] || '用戶'}
          </h2>
          <p className="user-email">{user.email}</p>
        </div>
      </div>

      {/* 功能列表 */}
      <div className="menu-content">
        <div className="menu-items-container">
          {menuItems.map((item, index) => (
            <div 
              key={index}
              className={`menu-item ${item.className || ''}`}
              onClick={item.action}
            >
              <div className="menu-item-content">
                <div className="menu-item-left">
                  <div className="menu-item-icon">
                    <item.icon />
                  </div>
                  <span className="menu-item-label">{item.label}</span>
                </div>
                <div className="menu-item-right">
                  <IoChevronForwardOutline className="nav-arrow" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}