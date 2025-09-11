import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminService } from "../services/supabaseService";
import "./AdminLoginForm.css";

export default function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetStatus, setResetStatus] = useState("");
  const [showResetForm, setShowResetForm] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await adminService.adminLogin(email, password);
      
      if (result.success) {
        // 登入成功導向管理頁面
        navigate("/admin");
      } else {
        setError(result.error || "登入失敗，請確認帳號密碼。");
      }
    } catch (err) {
      console.error("登入失敗：", err);
      setError("登入失敗，請確認帳號密碼。");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setResetStatus("");
    
    if (!email) {
      setResetStatus("請先輸入您的電子郵件");
      return;
    }

    try {
      const result = await adminService.resetPassword(email);
      if (result.success) {
        setResetStatus("密碼重設郵件已發送，請檢查您的信箱");
        setShowResetForm(false);
      } else {
        setResetStatus(result.error || "發送重設郵件失敗，請稍後再試");
      }
    } catch (error) {
      console.error("送出重設郵件失敗:", error);
      setResetStatus("發送重設郵件失敗，請稍後再試");
    }
  };

  return (
    <div className="admin-login-wrapper">
      <div className="admin-login-container">
        <div className="admin-login-header">
          <div className="admin-logo">
            <svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="50" height="50" rx="10" fill="#4F46E5"/>
              <path d="M15 17.5C15 16.1193 16.1193 15 17.5 15H32.5C33.8807 15 35 16.1193 35 17.5V32.5C35 33.8807 33.8807 35 32.5 35H17.5C16.1193 35 15 33.8807 15 32.5V17.5Z" fill="white"/>
              <path d="M20 25H30M25 20V30" stroke="#4F46E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2>管理員登入</h2>
          <p className="welcome-text">歡迎回來！請登入您的管理帳號</p>
        </div>
        
        <form onSubmit={handleLogin} className="admin-login-form">
          <div className="form-group">
            <label htmlFor="email">電子郵件</label>
            <div className="input-wrapper">
              <input
                type="email"
                id="email"
                placeholder="請輸入電子郵件"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={error ? "error" : ""}
              />
              <span className="input-icon">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3.66667 3.66667H18.3333C19.5416 3.66667 20.5 4.625 20.5 5.83333V16.5C20.5 17.7083 19.5416 18.6667 18.3333 18.6667H3.66667C2.45833 18.6667 1.5 17.7083 1.5 16.5V5.83333C1.5 4.625 2.45833 3.66667 3.66667 3.66667Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M20.5 5.83333L11 11.9167L1.5 5.83333" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">密碼</label>
            <div className="input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                placeholder="請輸入密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={error ? "error" : ""}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
              >
                {showPassword ? (
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L21 21M13.36 13.36C12.9956 13.7193 12.5565 14.0023 12.0689 14.1915C11.5813 14.3807 11.0558 14.4717 10.5272 14.4593C9.99866 14.4469 9.47807 14.3313 8.99865 14.1197C8.51923 13.9081 8.09227 13.605 7.74399 13.2284C7.3957 12.8518 7.13103 12.4091 6.96393 11.9249C6.79682 11.4407 6.73053 10.9249 6.77014 10.4119" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2.45833 11C3.36251 8.71667 5.50206 6.875 8.25 6.875H8.73333M11 6.875C13.7479 6.875 15.8875 8.71667 16.7917 11" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11 8.25C12.5188 8.25 13.75 9.48122 13.75 11C13.75 12.5188 12.5188 13.75 11 13.75C9.48122 13.75 8.25 12.5188 8.25 11C8.25 9.48122 9.48122 8.25 11 8.25Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M11 16.5C13.7479 16.5 15.8875 14.6583 16.7917 12.375C16.9388 12.0008 16.9388 11.5992 16.7917 11.225C15.8875 8.94167 13.7479 7.1 11 7.1C8.25208 7.1 6.11252 8.94167 5.20834 11.225C5.06121 11.5992 5.06121 12.0008 5.20834 12.375C6.11252 14.6583 8.25208 16.5 11 16.5Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 20.1667C16.0627 20.1667 20.1667 16.0627 20.1667 11C20.1667 5.93733 16.0627 1.83333 11 1.83333C5.93733 1.83333 1.83333 5.93733 1.83333 11C1.83333 16.0627 5.93733 20.1667 11 20.1667Z" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M11 7.33333V11" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M11 14.6667H11.0092" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p>{error}</p>
            </div>
          )}

          <button 
            type="submit" 
            className={`login-button ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="loading-spinner"></div>
            ) : (
              "登入"
            )}
          </button>
        </form>

        <div className="login-footer">
          <div className="forgot-password-section">
            <p className="help-text">
              {showResetForm ? "請輸入您的電子郵件以重設密碼" : "忘記密碼？"}
            </p>
            
            {showResetForm ? (
              <form onSubmit={handlePasswordReset} className="reset-form">
                <div className="reset-actions">
                  <button 
                    type="submit" 
                    className="reset-button"
                  >
                    發送重設郵件
                  </button>
                  <button 
                    type="button" 
                    className="cancel-reset"
                    onClick={() => setShowResetForm(false)}
                  >
                    取消
                  </button>
                </div>
              </form>
            ) : (
              <button 
                className="forgot-link" 
                onClick={() => setShowResetForm(true)}
              >
                重設密碼
              </button>
            )}
            
            {resetStatus && (
              <p className={`reset-status ${resetStatus.includes('已發送') ? 'success' : 'error'}`}>
                {resetStatus}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}