import React from 'react';
import { IoHeartOutline, IoListOutline, IoTimeOutline, IoRestaurantOutline } from 'react-icons/io5';
import './EmptyState.css';

export default function EmptyState({ 
  type = 'lists', 
  title, 
  description, 
  actionText, 
  onAction 
}) {
  const getIcon = () => {
    switch (type) {
      case 'lists':
        return <IoListOutline />;
      case 'favorites':
        return <IoHeartOutline />;
      case 'history':
        return <IoTimeOutline />;
      case 'restaurants':
        return <IoRestaurantOutline />;
      default:
        return <IoListOutline />;
    }
  };

  const getDefaultContent = () => {
    switch (type) {
      case 'lists':
        return {
          title: '還沒有收藏清單',
          description: '建立您的第一個收藏清單，開始收集喜愛的餐廳',
          actionText: '創建清單'
        };
      case 'favorites':
        return {
          title: '清單是空的',
          description: '開始添加您喜愛的餐廳到這個清單中',
          actionText: '探索餐廳'
        };
      case 'history':
        return {
          title: '還沒有選擇記錄',
          description: '使用 SwiftTaste 開始您的美食探索之旅',
          actionText: '開始探索'
        };
      default:
        return {
          title: '沒有內容',
          description: '目前沒有任何內容',
          actionText: '開始使用'
        };
    }
  };

  const defaultContent = getDefaultContent();
  const displayTitle = title || defaultContent.title;
  const displayDescription = description || defaultContent.description;
  const displayActionText = actionText || defaultContent.actionText;

  return (
    <div className="empty-state">
      <div className="empty-state-content">
        <div className="empty-state-icon">
          {getIcon()}
        </div>
        <h3 className="empty-state-title">{displayTitle}</h3>
        <p className="empty-state-description">{displayDescription}</p>
        {onAction && (
          <button className="empty-state-action" onClick={onAction}>
            {displayActionText}
          </button>
        )}
      </div>
      
      {/* 背景裝飾 */}
      <div className="empty-state-decorations">
        <div className="decoration decoration-1"></div>
        <div className="decoration decoration-2"></div>
        <div className="decoration decoration-3"></div>
      </div>
    </div>
  );
}