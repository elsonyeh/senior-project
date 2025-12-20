import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  IoPersonOutline,
  IoMailOutline,
  IoSaveOutline,
  IoCheckmarkCircleOutline,
  IoAlertCircleOutline,
  IoCameraOutline,
  IoCalendarOutline,
  IoBagOutline,
  IoLocationOutline
} from 'react-icons/io5';
import { authService } from '../../services/authService.js';
import { userDataService } from '../../services/userDataService.js';
import ImageCropper from '../common/ImageCropper.jsx';
import './UserProfileEdit.css';

export default function UserProfileEdit() {
  // 選項常數
  const GENDER_OPTIONS = [
    { value: 'male', label: '男性', icon: '👨' },
    { value: 'female', label: '女性', icon: '👩' },
    { value: 'other', label: '其他', icon: '🏳️‍⚧️' },
    { value: 'prefer_not_to_say', label: '不願透露', icon: '🤷' }
  ];

  const OCCUPATION_OPTIONS = [
    '學生',
    '軟體工程師',
    '設計師',
    '金融業',
    '教育業',
    '醫療保健',
    '服務業',
    '製造業',
    '建築業',
    '販售業',
    '公務員',
    '自由業',
    '家管',
    '退休',
    '其他'
  ];

  const TAIWAN_CITIES = [
    '台北市',
    '新北市',
    '桃園市',
    '台中市',
    '台南市',
    '高雄市',
    '基隆市',
    '新竹市',
    '嘉義市',
    '新竹縣',
    '苗栗縣',
    '彰化縣',
    '南投縣',
    '雲林縣',
    '嘉義縣',
    '屏東縣',
    '宜蘭縣',
    '花蓮縣',
    '台東縣',
    '澎湖縣',
    '金門縣',
    '連江縣'
  ];


  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [initialAvatarLoaded, setInitialAvatarLoaded] = useState(false);
  const fileInputRef = useRef(null);
  const [userProfile, setUserProfile] = useState({
    name: '',
    email: '',
    bio: '',
    avatar_url: '',
    gender: '',
    birth_date: '',
    occupation: '',
    location: '',
    favorite_lists_count: 0,
    swifttaste_count: 0,
    buddies_count: 0
  });
  const [customOccupation, setCustomOccupation] = useState('');
  const [showCustomOccupation, setShowCustomOccupation] = useState(false);
  const [errors, setErrors] = useState({});
  const [showOccupationDropdown, setShowOccupationDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [originalProfile, setOriginalProfile] = useState({});

  // 立即載入當前用戶頭像(在完整資料載入前)
  useEffect(() => {
    const loadInitialAvatar = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (currentUser.success && currentUser.user) {
          const avatarUrl = currentUser.user.user_metadata?.avatar_url || '';
          if (avatarUrl) {
            setUserProfile(prev => ({ ...prev, avatar_url: avatarUrl }));
            setInitialAvatarLoaded(true);
          }
        }
      } catch (error) {
        console.error('載入初始頭像失敗:', error);
      }
    };

    loadInitialAvatar();
    loadUserProfile();
  }, []);

  // 點擊外部關閉下拉選單
  const handleClickOutside = useCallback((event) => {
    if (!event.target.closest('.custom-select')) {
      setShowOccupationDropdown(false);
      setShowLocationDropdown(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [handleClickOutside]);

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
        avatar_url: profileResult.profile?.avatar_url || currentUser.user.user_metadata?.avatar_url || '',
        gender: profileResult.profile?.gender || '',
        birth_date: profileResult.profile?.birth_date || '',
        occupation: profileResult.profile?.occupation || '',
        location: profileResult.profile?.location || '',
        favorite_lists_count: statsResult.stats?.favorite_lists_count || 0,
        swifttaste_count: statsResult.stats?.swifttaste_count || 0,
        buddies_count: statsResult.stats?.buddies_count || 0
      };

      setUserProfile(profile);
      setOriginalProfile({ ...profile });

      // 處理自訂職業
      if (profile.occupation && !OCCUPATION_OPTIONS.includes(profile.occupation)) {
        setShowCustomOccupation(true);
        setCustomOccupation(profile.occupation);
      }
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

    // 清除該欄位的錯誤訊息
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  // 處理性別選擇
  const handleGenderSelect = (gender) => {
    handleInputChange('gender', gender);
  };

  // 處理職業選擇
  const handleOccupationSelect = (value) => {
    if (value === '其他') {
      setShowCustomOccupation(true);
      handleInputChange('occupation', customOccupation);
    } else {
      setShowCustomOccupation(false);
      setCustomOccupation('');
      handleInputChange('occupation', value);
    }
    setShowOccupationDropdown(false);
  };

  // 處理居住地選擇
  const handleLocationSelect = (value) => {
    handleInputChange('location', value);
    setShowLocationDropdown(false);
  };

  // 處理自訂職業輸入
  const handleCustomOccupationChange = (value) => {
    setCustomOccupation(value);
    handleInputChange('occupation', value);
  };

  // 驗證生日
  const validateBirthDate = (date) => {
    if (!date) return null;

    const birthDate = new Date(date);
    const today = new Date();
    const minDate = new Date('1900-01-01');

    if (birthDate > today) {
      return '生日不能大於今日';
    }

    if (birthDate < minDate) {
      return '請輸入有效的生日';
    }

    const age = today.getFullYear() - birthDate.getFullYear();
    if (age > 120) {
      return '請輸入有效的生日';
    }

    return null;
  };

  // 處理生日變更
  const handleBirthDateChange = (date) => {
    const error = validateBirthDate(date);
    setErrors(prev => ({
      ...prev,
      birth_date: error
    }));
    handleInputChange('birth_date', date);
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

    // 創建圖片URL供裁切器使用,但不顯示預覽
    const imageUrl = URL.createObjectURL(file);
    setSelectedImage(imageUrl);
    setShowCropper(true);
    setMessage(null);
  };

  // 處理圖片裁切完成
  const handleCropComplete = async (croppedFile) => {
    setShowCropper(false);

    // 清理選擇URL
    if (selectedImage) {
      URL.revokeObjectURL(selectedImage);
      setSelectedImage(null);
    }

    // 立即生成裁切後的預覽
    const previewBlob = URL.createObjectURL(croppedFile);
    setPreviewUrl(previewBlob);

    setUploading(true);

    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser.success || !currentUser.user) {
        setMessage({ type: 'error', text: '用戶登入狀態已過期' });
        return;
      }

      // 使用 authService 上傳裁切後的頭像
      const result = await authService.uploadAvatar(croppedFile, currentUser.user.id);

      if (result.success) {
        // 預載入新頭像確保完全載入後再清理預覽
        const newImg = new Image();
        newImg.onload = () => {
          // 新圖片載入完成,清理預覽
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }
        };
        newImg.onerror = () => {
          // 載入失敗,仍保留預覽
          console.error('新頭像載入失敗');
        };
        newImg.src = result.avatarUrl;

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
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  // 生成頭像URL或預設頭像
  const getAvatarUrl = () => {
    // 優先顯示預覽
    if (previewUrl) return previewUrl;
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
                        userProfile.avatar_url !== originalProfile.avatar_url ||
                        userProfile.gender !== originalProfile.gender ||
                        userProfile.birth_date !== originalProfile.birth_date ||
                        userProfile.occupation !== originalProfile.occupation ||
                        userProfile.location !== originalProfile.location;
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
        avatar_url: userProfile.avatar_url,
        gender: userProfile.gender || null,
        birth_date: userProfile.birth_date || null,
        occupation: userProfile.occupation.trim() || null,
        location: userProfile.location.trim() || null
      });

      if (!updateResult.success) {
        setMessage({ type: 'error', text: updateResult.error });
        return;
      }

      // 更新原始資料
      setOriginalProfile({ ...userProfile });

      // 重設錯誤訊息
      setErrors({});

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
                    userProfile.avatar_url !== originalProfile.avatar_url ||
                    userProfile.gender !== originalProfile.gender ||
                    userProfile.birth_date !== originalProfile.birth_date ||
                    userProfile.occupation !== originalProfile.occupation ||
                    userProfile.location !== originalProfile.location;

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
                  key={previewUrl || userProfile.avatar_url || 'default'}
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
          <h3>個人資訊</h3>

          <div className="form-group">
            <label>
              <IoPersonOutline className="field-icon" />
              性別
            </label>
            <div className="gender-selection-compact">
              {GENDER_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={`gender-option-compact ${userProfile.gender === option.value ? 'selected' : ''}`}
                  onClick={() => handleGenderSelect(option.value)}
                  title={option.label}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="birth_date">
              <IoCalendarOutline className="field-icon" />
              生日
            </label>
            <input
              id="birth_date"
              type="date"
              value={userProfile.birth_date}
              onChange={(e) => handleBirthDateChange(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              min="1900-01-01"
              className={errors.birth_date ? 'error' : ''}
              onFocus={(e) => {
                if (!e.target.value) {
                  e.target.value = '2000-01-01';
                  handleBirthDateChange('2000-01-01');
                }
              }}
            />
            {errors.birth_date && (
              <small className="field-error">{errors.birth_date}</small>
            )}
          </div>

          <div className="form-group">
            <label>
              <IoBagOutline className="field-icon" />
              職業
            </label>
            <div className="custom-select">
              <button
                type="button"
                className="select-button"
                onClick={() => setShowOccupationDropdown(!showOccupationDropdown)}
              >
                <span
                  className="select-value"
                  data-placeholder="請選擇職業"
                >
                  {userProfile.occupation}
                </span>
                <span className={`select-arrow ${showOccupationDropdown ? 'open' : ''}`}>▼</span>
              </button>
              {showOccupationDropdown && (
                <div className="select-dropdown">
                  <div className="select-option-list">
                    {OCCUPATION_OPTIONS.map(option => (
                      <button
                        key={option}
                        type="button"
                        className={`select-option ${userProfile.occupation === option ? 'selected' : ''}`}
                        onClick={() => handleOccupationSelect(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {showCustomOccupation && (
              <input
                type="text"
                value={customOccupation}
                onChange={(e) => handleCustomOccupationChange(e.target.value)}
                placeholder="請輸入您的職業"
                maxLength="100"
                className="custom-occupation-input"
              />
            )}
          </div>

          <div className="form-group">
            <label>
              <IoLocationOutline className="field-icon" />
              居住城市
            </label>
            <div className="custom-select">
              <button
                type="button"
                className="select-button"
                onClick={() => setShowLocationDropdown(!showLocationDropdown)}
              >
                <span
                  className="select-value"
                  data-placeholder="請選擇居住城市"
                >
                  {userProfile.location}
                </span>
                <span className={`select-arrow ${showLocationDropdown ? 'open' : ''}`}>▼</span>
              </button>
              {showLocationDropdown && (
                <div className="select-dropdown">
                  <div className="select-option-list">
                    {TAIWAN_CITIES.map(city => (
                      <button
                        key={city}
                        type="button"
                        className={`select-option ${userProfile.location === city ? 'selected' : ''}`}
                        onClick={() => handleLocationSelect(city)}
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>


        <div className="form-section">
          <h3>使用統計</h3>

          <div className="profile-stats-grid">
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