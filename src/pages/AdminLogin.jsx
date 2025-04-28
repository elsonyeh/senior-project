import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin, isAdminUser } from '../services/firebaseService';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  const navigate = useNavigate();
  
  // 判斷是否為開發環境
  const isDevelopment = process.env.NODE_ENV === 'development' || 
                       window.location.hostname === 'localhost' ||
                       window.location.hostname.includes('127.0.0.1');
  
  // 檢查用戶是否已經是管理員
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        console.log("檢查管理員狀態...");
        const isAdmin = await isAdminUser();
        console.log("管理員狀態檢查結果:", isAdmin);
        
        if (isAdmin) {
          console.log("是管理員，重定向到管理頁面");
          navigate('/admin');
        } else {
          console.log("不是管理員，留在登入頁面");
        }
      } catch (error) {
        console.error('檢查管理員狀態失敗:', error);
      } finally {
        setCheckingAuth(false);
      }
    };
    
    checkAdmin();
  }, [navigate]);
  
  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('請輸入電子郵件和密碼');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      console.log("嘗試登入...");
      const result = await adminLogin(email, password);
      console.log("登入結果:", result);
      
      if (result.success) {
        console.log("登入成功，導航到管理頁面");
        navigate('/admin');
      } else {
        console.log("登入失敗:", result.error);
        setError(result.error || '登入失敗，請重試');
      }
    } catch (err) {
      console.error('管理員登入錯誤:', err);
      setError('登入過程中發生錯誤，請重試');
    } finally {
      setLoading(false);
    }
  };
  
  // 開發環境快速登入
  const handleDevLogin = async () => {
    console.log("開發環境快速登入被觸發");
    try {
      setLoading(true);
      setError('');
      
      const result = await adminLogin('elson921121@gmail.com', 'admin123');
      console.log("開發環境快速登入結果:", result);
      
      if (result.success) {
        console.log("開發環境快速登入成功，導航到管理頁面");
        // 為確保重定向工作正常，使用兩種方式
        localStorage.setItem('isAdmin', 'true');
        navigate('/admin');
      } else {
        console.log("開發環境快速登入失敗:", result.error);
        setError(result.error || '快速登入失敗，請重試');
      }
    } catch (err) {
      console.error('開發環境快速登入錯誤:', err);
      setError('快速登入過程中發生錯誤，請重試');
    } finally {
      setLoading(false);
    }
  };
  
  if (checkingAuth) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>載入中...</div>
      </div>
    );
  }
  
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '400px', 
        padding: '2rem', 
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>餐廳管理系統</h1>
        <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>管理員登入</h2>
        
        {error && (
          <div style={{ 
            backgroundColor: '#ffebee', 
            color: '#c62828', 
            padding: '0.75rem', 
            borderRadius: '4px',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              電子郵件
            </label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '0.75rem', 
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}
              placeholder="example@example.com"
              required
            />
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              密碼
            </label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '0.75rem', 
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}
              placeholder="請輸入密碼"
              required
            />
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            style={{ 
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? '登入中...' : '登入'}
          </button>
        </form>
        
        {/* 開發環境快速登入按鈕 */}
        {isDevelopment && (
          <div style={{ marginTop: '1rem' }}>
            <button 
              onClick={handleDevLogin}
              disabled={loading}
              style={{ 
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? '登入中...' : '開發環境快速登入'}
            </button>
            <div style={{ 
              fontSize: '0.8rem', 
              color: '#666', 
              textAlign: 'center',
              marginTop: '0.5rem' 
            }}>
              僅供開發測試使用
            </div>
          </div>
        )}
        
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <a 
            href="/"
            style={{ 
              textDecoration: 'none', 
              color: '#2196F3'
            }}
          >
            返回首頁
          </a>
        </div>
      </div>
    </div>
  );
}