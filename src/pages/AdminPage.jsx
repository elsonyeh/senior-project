import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isAdminUser } from "../services/firebaseService";
import AdminDashboard from "../components/AdminDashboard";

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 檢查管理員權限
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        console.log("AdminPage: 開始檢查管理員權限...");

        // 標準環境下的管理員檢查
        const adminStatus = await isAdminUser();
        console.log("AdminPage: 管理員檢查結果:", adminStatus);
        setIsAdmin(adminStatus);

        if (!adminStatus) {
          console.log("AdminPage: 不是管理員，重定向到登入頁面");
          navigate("/admin-login");
          return;
        }

        console.log("AdminPage: 確認是管理員");
      } catch (error) {
        console.error("AdminPage: 檢查管理員狀態失敗:", error);
        navigate("/admin-login");
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [navigate]);

  // 如果正在載入，顯示載入中畫面
  if (loading) {
    return (
      <div className="loading-container">
        <div>載入中...</div>
      </div>
    );
  }

  // 如果不是管理員且已完成檢查，不顯示內容
  if (!isAdmin && !loading) {
    return (
      <div className="no-permission-container">
        <div>
          <h2>無訪問權限</h2>
          <p>您沒有管理員權限。</p>
          <button onClick={() => navigate("/admin-login")}>返回登入頁面</button>
        </div>
      </div>
    );
  }

  // 如果是管理員，渲染儀表板組件
  return <AdminDashboard />;
}