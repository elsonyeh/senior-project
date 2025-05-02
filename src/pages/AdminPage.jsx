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

        // 判斷是否為開發環境
        const isDevelopment =
          process.env.NODE_ENV === "development" ||
          window.location.hostname === "localhost" ||
          window.location.hostname.includes("127.0.0.1");

        // 開發環境下提供更寬鬆的權限檢查
        if (isDevelopment && localStorage.getItem("isAdmin") === "true") {
          console.log("AdminPage: 開發環境，本地存儲顯示是管理員");
          setIsAdmin(true);
          setLoading(false);
          return;
        }

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

        // 開發環境下出錯時允許訪問
        if (process.env.NODE_ENV === "development") {
          console.log("AdminPage: 開發環境，權限檢查錯誤時默認通過");
          setIsAdmin(true);
          setLoading(false);
          return;
        }

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