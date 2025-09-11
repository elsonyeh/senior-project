import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminService } from "../services/supabaseService";
import RestaurantManager from "./RestaurantManager";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("restaurants");
  const navigate = useNavigate();

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
      <div className="dashboard-header">
        <h1>🍽️ SwiftTaste 管理面板</h1>
        <div className="header-actions">
          <span className="admin-info">👤 管理員模式</span>
          <button className="btn-logout" onClick={handleLogout}>
            登出
          </button>
        </div>
      </div>

      <div className="dashboard-tabs">
        <button
          className={`tab-button ${activeTab === "restaurants" ? "active" : ""}`}
          onClick={() => setActiveTab("restaurants")}
        >
          🍕 餐廳管理
        </button>
        <button
          className={`tab-button ${activeTab === "buddies" ? "active" : ""}`}
          onClick={() => setActiveTab("buddies")}
        >
          👥 Buddies 管理
        </button>
        <button
          className={`tab-button ${activeTab === "analytics" ? "active" : ""}`}
          onClick={() => setActiveTab("analytics")}
        >
          📊 數據分析
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === "restaurants" && <RestaurantManager />}
        
        {activeTab === "buddies" && (
          <div className="buddies-section">
            <h2>Buddies 模式管理</h2>
            <div className="feature-placeholder">
              <p>🚧 此功能開發中...</p>
              <p>將包含房間管理、用戶活動監控等功能</p>
            </div>
          </div>
        )}
        
        {activeTab === "analytics" && (
          <div className="analytics-section">
            <h2>數據分析</h2>
            <div className="feature-placeholder">
              <p>🚧 此功能開發中...</p>
              <p>將包含用戶行為分析、餐廳推薦效果等統計資訊</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}