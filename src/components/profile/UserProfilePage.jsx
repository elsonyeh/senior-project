import React, { useState, useEffect, useRef } from 'react';
import {
  IoPersonOutline,
  IoMailOutline,
  IoSaveOutline,
  IoCheckmarkCircleOutline,
  IoAlertCircleOutline,
  IoCameraOutline
} from 'react-icons/io5';
import { authService } from '../../services/authService.js';
import { userDataService } from '../../services/userDataService.js';
import ImageCropper from '../common/ImageCropper.jsx';
import './UserProfilePage.css';

export default function UserProfilePage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const fileInputRef = useRef(null);
  const [userProfile, setUserProfile] = useState({
    name: '',
    email: '',
    bio: '',
    avatar_url: '',
    favorite_lists_count: 0,
    swifttaste_count: 0,
    buddies_count: 0
  });
  const [originalProfile, setOriginalProfile] = useState({});

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    setLoading(true);
    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser.success || !currentUser.user) {
        setMessage({ type: 'error', text: '請先登入以編輯個人資料' });
        return;
      }

      // 獲取用戶個人資料
      const profileResult = await userDataService.getUserProfile(currentUser.user.id);
      const statsResult = await userDataService.getUserStats(currentUser.user.id);

      const profile = {
        name: profileResult.profile?.name || currentUser.user.user_metadata?.full_name || currentUser.user.email?.split('@')[0] || '',
        email: currentUser.user.email || '',
        bio: profileResult.profile?.bio || '',
        avatar_url: profileResult.profile?.avatar_url || '',
        favorite_lists_count: statsResult.stats?.favorite_lists_count || 0,
        swifttaste_count: statsResult.stats?.swifttaste_count || 0,
        buddies_count: statsResult.stats?.buddies_count || 0
      };

      setUserProfile(profile);
      setOriginalProfile({ ...profile });
    } catch (error) {
      console.error('載入用戶資料失敗:', error);
      setMessage({ type: 'error', text: '載入用戶資料失敗' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setUserProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 處理文件選擇
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 重置文件輸入
    event.target.value = '';

    // 檢查文件類型
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: '請選擇圖片文件' });
      return;
    }

    // 檢查文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setMessage({ type: 'error', text: '圖片大小不能超過10MB' });
      return;
    }

    // 創建圖片預覽URL
    const imageUrl = URL.createObjectURL(file);
    setSelectedImage(imageUrl);
    setShowCropper(true);
    setMessage(null);
  };

  // 處理圖片裁切完成
  const handleCropComplete = async (croppedFile) => {
    setShowCropper(false);
    setUploading(true);

    // 清理預覽URL
    if (selectedImage) {
      URL.revokeObjectURL(selectedImage);
      setSelectedImage(null);
    }

    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser.success || !currentUser.user) {
        setMessage({ type: 'error', text: '用戶登入狀態已過期' });
        return;
      }

      // 使用 authService 上傳裁切後的頭像
      const result = await authService.uploadAvatar(croppedFile, currentUser.user.id);

      if (result.success) {
        // 更新用戶頭像URL
        setUserProfile(prev => ({
          ...prev,
          avatar_url: result.avatarUrl
        }));

        // 同時更新原始配置檔，避免無必要的保存提示
        setOriginalProfile(prev => ({
          ...prev,
          avatar_url: result.avatarUrl
        }));

        setMessage({ type: 'success', text: '頭像已更新' });

        // 3秒後清除訊息
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: result.error });
      }
    } catch (error) {
      console.error('頭像上傳失敗:', error);
      setMessage({ type: 'error', text: '頭像上傳失敗，請稍後再試' });
    } finally {
      setUploading(false);
    }
  };

  // 處理取消裁切
  const handleCropCancel = () => {
    setShowCropper(false);
    if (selectedImage) {
      URL.revokeObjectURL(selectedImage);
      setSelectedImage(null);
    }
  };

  // 生成頭像URL或預設頭像
  const getAvatarUrl = () => {
    if (userProfile.avatar_url) return userProfile.avatar_url;

    // 生成基於用戶名稱的預設頭像
    const name = userProfile.name || userProfile.email?.split('@')[0] || 'User';
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
      '#667eea', '#764ba2', '#22c55e', '#3b82f6', '#8b5cf6',
      '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser.success || !currentUser.user) {
        setMessage({ type: 'error', text: '用戶登入狀態已過期' });
        return;
      }

      // 檢查是否有變更
      const hasChanges = userProfile.name !== originalProfile.name ||
                        userProfile.bio !== originalProfile.bio ||
                        userProfile.avatar_url !== originalProfile.avatar_url;
      if (!hasChanges) {
        setMessage({ type: 'info', text: '沒有變更需要保存' });
        return;
      }

      // 驗證必填欄位
      if (!userProfile.name.trim()) {
        setMessage({ type: 'error', text: '姓名不能為空' });
        return;
      }

      // 更新用戶個人資料
      const updateResult = await userDataService.updateUserProfile(currentUser.user.id, {
        name: userProfile.name.trim(),
        bio: userProfile.bio.trim(),
        email: userProfile.email,
        avatar_url: userProfile.avatar_url
      });

      if (!updateResult.success) {
        setMessage({ type: 'error', text: updateResult.error });
        return;
      }

      // 更新原始資料
      setOriginalProfile({ ...userProfile });

      setMessage({ type: 'success', text: '個人資料已成功更新' });

      // 3秒後清除訊息
      setTimeout(() => setMessage(null), 3000);

    } catch (error) {
      console.error('保存用戶資料失敗:', error);
      setMessage({ type: 'error', text: '保存失敗，請稍後再試' });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = userProfile.name !== originalProfile.name ||
                    userProfile.bio !== originalProfile.bio ||
                    userProfile.avatar_url !== originalProfile.avatar_url;

  if (loading) {
    return (
      <div className="user-profile-edit">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-profile-edit">

      {message && (
        <div className={`message ${message.type}`}>
          {message.type === 'success' && <IoCheckmarkCircleOutline className="message-icon" />}
          {message.type === 'error' && <IoAlertCircleOutline className="message-icon" />}
          {message.type === 'info' && <IoAlertCircleOutline className="message-icon" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="profile-form">
        <div className="form-section">
          <h3>個人頭像</h3>

          <div
            className={`avatar-upload-section ${uploading ? 'uploading' : ''}`}
            onClick={() => !uploading && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="avatar-preview">
              <div className="avatar-circle">
                <img
                  src={getAvatarUrl()}
                  alt="用戶頭像"
                  className="preview-image"
                />
              </div>
            </div>
            <div className="avatar-upload-info">
              <p className="upload-title">
                {uploading ? '正在上傳...' : '點擊更換頭像'}
              </p>
              <p className="upload-hint">支援 JPG、PNG 格式，檔案大小不超過 10MB<br/>上傳後可裁切為正方形頭像</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        <div className="form-section">
          <h3>基本資料</h3>

          <div className="form-group">
            <label htmlFor="name">
              <IoPersonOutline className="field-icon" />
              姓名
            </label>
            <input
              id="name"
              type="text"
              value={userProfile.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="請輸入您的姓名"
              maxLength="50"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">
              <IoMailOutline className="field-icon" />
              電子郵件
            </label>
            <input
              id="email"
              type="email"
              value={userProfile.email}
              disabled
              className="disabled-input"
            />
            <small className="field-note">電子郵件無法修改</small>
          </div>

          <div className="form-group">
            <label htmlFor="bio">
              <IoPersonOutline className="field-icon" />
              個人簡介
            </label>
            <textarea
              id="bio"
              value={userProfile.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              placeholder="介紹一下自己..."
              maxLength="200"
              rows="3"
            />
            <small className="field-note">最多200個字符</small>
          </div>
        </div>

        <div className="form-section">
          <h3>使用統計</h3>

          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">{userProfile.favorite_lists_count}</div>
              <div className="stat-label">收藏清單</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{userProfile.swifttaste_count}</div>
              <div className="stat-label">SwiftTaste 使用次數</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{userProfile.buddies_count}</div>
              <div className="stat-label">Buddies 使用次數</div>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button
            className={`save-button ${hasChanges && !saving ? 'active' : ''}`}
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <>
                <div className="button-spinner"></div>
                保存中...
              </>
            ) : (
              <>
                <IoSaveOutline />
                保存變更
              </>
            )}
          </button>
        </div>
      </div>

      {/* 圖片裁切器 */}
      {showCropper && selectedImage && (
        <ImageCropper
          image={selectedImage}
          onCrop={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}