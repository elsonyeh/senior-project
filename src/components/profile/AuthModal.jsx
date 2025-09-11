import React, { useState } from 'react';
import { IoCloseOutline, IoEyeOutline, IoEyeOffOutline, IoMailOutline, IoPersonOutline, IoLockClosedOutline, IoLogoGoogle, IoLogoApple } from 'react-icons/io5';
import './AuthModal.css';

export default function AuthModal({ isOpen, onClose, onLogin, onRegister, onGoogleLogin, onAppleLogin }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // 清除錯誤訊息
    if (error) setError('');
  };

  const validateForm = () => {
    const { email, password, confirmPassword, name } = formData;
    
    if (!email || !password) {
      setError('請填寫所有必填欄位');
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('請輸入有效的電子郵件');
      return false;
    }
    
    if (password.length < 6) {
      setError('密碼長度至少需要6個字符');
      return false;
    }
    
    if (!isLoginMode) {
      if (!name.trim()) {
        setError('請輸入姓名');
        return false;
      }
      
      if (password !== confirmPassword) {
        setError('密碼確認不一致');
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    setError('');
    
    try {
      if (isLoginMode) {
        await onLogin({
          email: formData.email,
          password: formData.password
        });
      } else {
        await onRegister({
          email: formData.email,
          password: formData.password,
          name: formData.name.trim()
        });
      }
      
      // 成功後重置表單並關閉模態框
      resetForm();
      onClose();
    } catch (err) {
      setError(err.message || '操作失敗，請重試');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      name: ''
    });
    setError('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const switchMode = () => {
    setIsLoginMode(!isLoginMode);
    resetForm();
  };

  const handleGoogleAuth = async () => {
    if (!onGoogleLogin) return;
    
    setLoading(true);
    setError('');
    
    try {
      await onGoogleLogin();
      resetForm();
      onClose();
    } catch (err) {
      setError(err.message || 'Google 登入失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleAuth = async () => {
    if (!onAppleLogin) return;
    
    setLoading(true);
    setError('');
    
    try {
      await onAppleLogin();
      resetForm();
      onClose();
    } catch (err) {
      setError(err.message || 'Apple 登入失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
      resetForm();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="auth-modal-overlay" onClick={handleOverlayClick}>
      <div className="auth-modal">
        {/* 標題欄 */}
        <div className="auth-modal-header">
          <h2 className="auth-modal-title">
            {isLoginMode ? '登入' : '註冊'}
          </h2>
          <button
            className="auth-modal-close"
            onClick={() => {
              onClose();
              resetForm();
            }}
          >
            <IoCloseOutline />
          </button>
        </div>

        {/* OAuth 按鈕 */}
        <div className="auth-oauth-section">
          {onGoogleLogin && (
            <button
              type="button"
              className="oauth-button google-button"
              onClick={handleGoogleAuth}
              disabled={loading}
            >
              <IoLogoGoogle className="oauth-icon" />
              使用 Google {isLoginMode ? '登入' : '註冊'}
            </button>
          )}
          
          {onAppleLogin && (
            <button
              type="button"
              className="oauth-button apple-button"
              onClick={handleAppleAuth}
              disabled={loading}
            >
              <IoLogoApple className="oauth-icon" />
              使用 Apple {isLoginMode ? '登入' : '註冊'}
            </button>
          )}
        </div>

        {/* 分隔線 */}
        <div className="auth-divider">
          <span className="divider-text">或</span>
        </div>

        {/* 表單 */}
        <form onSubmit={handleSubmit} className="auth-form">
          {/* 註冊模式顯示姓名欄位 */}
          {!isLoginMode && (
            <div className="form-group">
              <label className="form-label">姓名</label>
              <div className="input-wrapper">
                <IoPersonOutline className="input-icon" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="輸入您的姓名"
                  className="form-input"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {/* 電子郵件 */}
          <div className="form-group">
            <label className="form-label">電子郵件</label>
            <div className="input-wrapper">
              <IoMailOutline className="input-icon" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="輸入您的電子郵件"
                className="form-input"
                disabled={loading}
              />
            </div>
          </div>

          {/* 密碼 */}
          <div className="form-group">
            <label className="form-label">密碼</label>
            <div className="input-wrapper">
              <IoLockClosedOutline className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="輸入您的密碼"
                className="form-input"
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                {showPassword ? <IoEyeOffOutline /> : <IoEyeOutline />}
              </button>
            </div>
          </div>

          {/* 確認密碼（註冊模式） */}
          {!isLoginMode && (
            <div className="form-group">
              <label className="form-label">確認密碼</label>
              <div className="input-wrapper">
                <IoLockClosedOutline className="input-icon" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="再次輸入密碼"
                  className="form-input"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                >
                  {showConfirmPassword ? <IoEyeOffOutline /> : <IoEyeOutline />}
                </button>
              </div>
            </div>
          )}

          {/* 錯誤訊息 */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* 提交按鈕 */}
          <button
            type="submit"
            className={`submit-button ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <div className="loading-spinner"></div>
            ) : (
              isLoginMode ? '登入' : '註冊'
            )}
          </button>

          {/* 模式切換 */}
          <div className="mode-switch">
            <span className="mode-switch-text">
              {isLoginMode ? '還沒有帳號？' : '已有帳號？'}
            </span>
            <button
              type="button"
              className="mode-switch-button"
              onClick={switchMode}
              disabled={loading}
            >
              {isLoginMode ? '立即註冊' : '立即登入'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}