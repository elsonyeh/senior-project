import React, { useState, useRef, useEffect } from 'react';
import {
  IoCameraOutline,
  IoCreateOutline,
  IoCheckmarkOutline,
  IoCloseOutline,
  IoPersonOutline,
  IoMailOutline,
  IoCalendarOutline,
  IoLocationOutline,
  IoBagOutline
} from 'react-icons/io5';
import { userDataService } from '../../services/userDataService.js';
import './ProfileHeader.css';

export default function ProfileHeader({
  user,
  onAvatarUpdate,
  onProfileUpdate,
  isEditing,
  onEditToggle
}) {
  const [uploading, setUploading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editData, setEditData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    bio: user?.bio || ''
  });
  const fileInputRef = useRef(null);

  // 載入完整的用戶個人資料
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const result = await userDataService.getUserProfile(user.id);
        if (result.success && result.profile) {
          setUserProfile(result.profile);
        }
      } catch (error) {
        console.error('載入用戶個人資料失敗:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [user?.id]);

  // 處理頭像上傳
  const handleAvatarUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 檢查文件類型
    if (!file.type.startsWith('image/')) {
      alert('請選擇圖片文件');
      return;
    }

    // 檢查文件大小 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('圖片大小不能超過5MB');
      return;
    }

    setUploading(true);

    try {
      // 直接傳遞文件給父組件處理 Supabase 上傳
      await onAvatarUpdate?.(file);

    } catch (error) {
      console.error('Avatar upload failed:', error);
      alert('頭像上傳失敗，請重試');
    } finally {
      setUploading(false);
    }
  };

  // 處理編輯數據變更
  const handleEditChange = (field, value) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 保存編輯
  const handleSaveEdit = async () => {
    try {
      await onProfileUpdate?.(editData);
      onEditToggle?.(false);
    } catch (error) {
      console.error('Profile update failed:', error);
      alert('更新失敗，請重試');
    }
  };

  // 取消編輯
  const handleCancelEdit = () => {
    setEditData({
      name: user?.name || '',
      email: user?.email || '',
      bio: user?.bio || ''
    });
    onEditToggle?.(false);
  };

  // 格式化日期
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // 取得頭像URL或預設頭像
  const getAvatarUrl = () => {
    // 嘗試從不同位置獲取頭像URL
    const avatarUrl = user?.user_metadata?.avatar_url || user?.avatar_url;
    if (avatarUrl) return avatarUrl;
    
    // 生成基於用戶名稱的預設頭像
    const name = user?.user_metadata?.name || user?.name || user?.email?.split('@')[0] || 'User';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const bgColor = generateColorFromString(name);
    
    return `data:image/svg+xml,${encodeURIComponent(`
      <svg width="120" height="120" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="60" fill="${bgColor}"/>
        <text x="50%" y="50%" text-anchor="middle" dy="0.3em" font-family="system-ui" font-size="36" fill="white" font-weight="600">${initials}</text>
      </svg>
    `)}`;
  };

  // 根據字串生成顏色
  const generateColorFromString = (str) => {
    const colors = [
      '#ff6b35', '#22c55e', '#3b82f6', '#8b5cf6', 
      '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="profile-header">
      {/* 背景裝飾 */}
      <div className="header-background">
        <div className="bg-decoration bg-decoration-1"></div>
        <div className="bg-decoration bg-decoration-2"></div>
        <div className="bg-decoration bg-decoration-3"></div>
      </div>

      {/* 頭像區域 */}
      <div className="avatar-section">
        <div className="avatar-container">
          <img
            src={getAvatarUrl()}
            alt={user?.name || 'User Avatar'}
            className="avatar-image"
          />
          
          {/* 上傳按鈕 */}
          <button
            className={`avatar-upload-btn ${uploading ? 'uploading' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="更換頭像"
          >
            {uploading ? (
              <div className="upload-spinner"></div>
            ) : (
              <IoCameraOutline />
            )}
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* 用戶資訊區域 */}
      <div className="user-info-section">
        {isEditing ? (
          /* 編輯模式 */
          <div className="edit-form">
            <div className="edit-field">
              <label className="edit-label">姓名</label>
              <input
                type="text"
                value={editData.name}
                onChange={(e) => handleEditChange('name', e.target.value)}
                className="edit-input"
                placeholder="輸入您的姓名"
              />
            </div>
            
            <div className="edit-field">
              <label className="edit-label">電子郵件</label>
              <input
                type="email"
                value={editData.email}
                onChange={(e) => handleEditChange('email', e.target.value)}
                className="edit-input"
                placeholder="輸入您的電子郵件"
              />
            </div>
            
            <div className="edit-field">
              <label className="edit-label">個人簡介</label>
              <textarea
                value={editData.bio}
                onChange={(e) => handleEditChange('bio', e.target.value)}
                className="edit-textarea"
                placeholder="寫一段關於自己的簡介..."
                rows={3}
              />
            </div>
            
            <div className="edit-actions">
              <button
                className="save-btn"
                onClick={handleSaveEdit}
              >
                <IoCheckmarkOutline />
                保存
              </button>
              <button
                className="cancel-btn"
                onClick={handleCancelEdit}
              >
                <IoCloseOutline />
                取消
              </button>
            </div>
          </div>
        ) : (
          /* 顯示模式 */
          <div className="display-info">
            <div className="user-name-section">
              <h1 className="user-name">{user?.name || '未設定姓名'}</h1>
              <button
                className="edit-profile-btn"
                onClick={() => onEditToggle?.(true)}
                title="編輯個人資料"
              >
                <IoCreateOutline />
              </button>
            </div>
            
            <div className="user-details">
              <div className="detail-item">
                <IoMailOutline className="detail-icon" />
                <span className="detail-text">{user?.email || '未設定郵件'}</span>
              </div>


              {userProfile?.occupation && (
                <div className="detail-item">
                  <IoBagOutline className="detail-icon" />
                  <span className="detail-text">{userProfile.occupation}</span>
                </div>
              )}

              {userProfile?.location && (
                <div className="detail-item">
                  <IoLocationOutline className="detail-icon" />
                  <span className="detail-text">{userProfile.location}</span>
                </div>
              )}


              {user?.created_at && (
                <div className="detail-item">
                  <IoCalendarOutline className="detail-icon" />
                  <span className="detail-text">加入於 {formatDate(user.created_at)}</span>
                </div>
              )}
            </div>
            
            {user?.bio && (
              <div className="user-bio">
                <p className="bio-text">{user.bio}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 統計區域 */}
      <div className="stats-section">
        <div className="stat-item">
          <div className="stat-number">{user?.favorite_lists_count || 0}</div>
          <div className="stat-label">收藏清單</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{user?.swifttaste_count || 0}</div>
          <div className="stat-label">SwiftTaste</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{user?.buddies_count || 0}</div>
          <div className="stat-label">Buddies</div>
        </div>
      </div>
    </div>
  );
}