import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { adminService } from "../services/supabaseService";
import RestaurantManager from "./RestaurantManager";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("restaurants");
  const [adminList, setAdminList] = useState([]);
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const navigate = useNavigate();

  // 獲取管理員列表和當前管理員資訊
  useEffect(() => {
    const loadAdminData = () => {
      const adminSession = localStorage.getItem('adminSession');
      if (adminSession) {
        const session = JSON.parse(adminSession);
        setCurrentAdmin(session);
      }
      
      // 獲取管理員列表（添加上線時間等資訊）
      const adminListWithStatus = adminService.adminAccounts.map(admin => ({
        ...admin,
        isOnline: admin.email === getCurrentAdminEmail(),
        lastLoginTime: getLastLoginTime(admin.email),
        status: admin.email === getCurrentAdminEmail() ? '線上' : '離線'
      }));
      
      setAdminList(adminListWithStatus);
    };

    loadAdminData();
  }, []);

  const getCurrentAdminEmail = () => {
    const adminSession = localStorage.getItem('adminSession');
    if (adminSession) {
      const session = JSON.parse(adminSession);
      return session.email;
    }
    return null;
  };

  const getLastLoginTime = (email) => {
    const adminSession = localStorage.getItem('adminSession');
    if (adminSession) {
      const session = JSON.parse(adminSession);
      if (session.email === email) {
        return new Date(session.loginTime).toLocaleString('zh-TW');
      }
    }
    return '未知';
  };

  const handleLogout = async () => {
    try {
      await adminService.adminLogout();
      navigate("/admin-login");
    } catch (error) {
      console.error("登出失敗:", error);
      // 即使登出失敗也跳轉到登入頁面
      navigate("/admin-login");
    }
  };

  return (
    <div className="admin-dashboard">
      {/* 頂部標題列 */}
      <div className="dashboard-header">
        <div className="header-left">
          <span className="system-icon">📋</span>
          <h1>餐廳管理系統</h1>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          登出
        </button>
      </div>

      {/* 用戶資訊列 */}
      <div className="user-info">
        <span>當前用戶：elson921121@gmail.com / </span>
        <span className="admin-status">管理員</span>
      </div>

      {/* 標籤頁 */}
      <div className="dashboard-tabs">
        <button
          className={`tab-button ${activeTab === "restaurants" ? "active" : ""}`}
          onClick={() => setActiveTab("restaurants")}
        >
          餐廳資料 (Firestore)
        </button>
        <button
          className={`tab-button ${activeTab === "buddies" ? "active" : ""}`}
          onClick={() => setActiveTab("buddies")}
        >
          房間管理 (Realtime DB)
        </button>
        <button
          className={`tab-button ${activeTab === "admins" ? "active" : ""}`}
          onClick={() => setActiveTab("admins")}
        >
          管理員管理
        </button>
      </div>

      {/* 內容區域 */}
      <div className="dashboard-content">
        {activeTab === "restaurants" && <RestaurantManager />}
        
        {activeTab === "buddies" && (
          <div className="buddies-section">
            <div className="section-header">
              <div className="section-title">
                <span className="section-icon">🏠</span>
                <h2>房間管理 (Realtime Database)</h2>
              </div>
              <button className="refresh-btn">
                🔄 刷新列表
              </button>
            </div>
            
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>房間ID</th>
                    <th>房主</th>
                    <th>成員數</th>
                    <th>狀態</th>
                    <th>創建時間</th>
                    <th>最後更新</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>XYGAGM</td>
                    <td>老-4</td>
                    <td>0</td>
                    <td><span className="status-waiting">等待中</span></td>
                    <td>2025/05/24 上午09:31</td>
                    <td>未知</td>
                    <td><button className="delete-btn">🗑️ 刪除</button></td>
                  </tr>
                  <tr>
                    <td>RQ9LF0</td>
                    <td>老-4</td>
                    <td>0</td>
                    <td><span className="status-voting">vote</span></td>
                    <td>2025/05/24 上午08:37</td>
                    <td>未知</td>
                    <td><button className="delete-btn">🗑️ 刪除</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "admins" && (
          <div className="admins-section">
            <div className="section-header">
              <div className="section-title">
                <span className="section-icon">👥</span>
                <h2>管理員管理</h2>
              </div>
              <div className="admin-status-info">
                <span>當前登入：{currentAdmin?.email || 'elson921121@gmail.com'}</span>
                <span className="separator"> | </span>
                <span>超級管理員權限</span>
              </div>
            </div>
            
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>管理員帳號</th>
                    <th>權限等級</th>
                    <th>狀態</th>
                    <th>最後登入時間</th>
                    <th>帳號創建時間</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {adminList.map((admin, index) => (
                    <tr key={admin.email}>
                      <td>
                        <div className="admin-info">
                          <span className={`status-indicator ${admin.isOnline ? 'online' : 'offline'}`}></span>
                          {admin.email}
                          {admin.email === getCurrentAdminEmail() && <span className="current-user"> (您)</span>}
                        </div>
                      </td>
                      <td>
                        <span className="role-badge super-admin">超級管理員</span>
                      </td>
                      <td>
                        <span className={`status-badge ${admin.isOnline ? 'online' : 'offline'}`}>
                          {admin.status}
                        </span>
                      </td>
                      <td>{admin.lastLoginTime}</td>
                      <td>2024/01/01</td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className="edit-btn"
                            disabled={admin.email === getCurrentAdminEmail()}
                            title={admin.email === getCurrentAdminEmail() ? "不能編輯自己的帳號" : "編輯管理員"}
                          >
                            ✏️ 編輯
                          </button>
                          <button 
                            className="reset-password-btn"
                            title="重設密碼"
                          >
                            🔑 重設密碼
                          </button>
                          {admin.email !== getCurrentAdminEmail() && (
                            <button 
                              className="delete-btn"
                              title="刪除管理員帳號"
                            >
                              🗑️ 刪除
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="admin-actions">
              <button className="add-admin-btn">
                ➕ 新增管理員
              </button>
              <button className="export-logs-btn">
                📊 匯出操作記錄
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}