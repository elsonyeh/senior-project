import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation
} from "react-router-dom";
import SwiftTastePage from "./pages/SwiftTastePage";
import BuddiesPage from "./pages/BuddiesPage";
import MapPage from "./pages/MapPage";
import BottomNav from "./components/BottomNav";
import UserProfilePage from "./pages/UserProfilePage";
import AdminPage from './pages/AdminPage';
import AdminLogin from './pages/AdminLogin'; // 引入管理員登入頁面
import "./App.css";

// 底部導航欄控制組件
const BottomNavController = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [lastScrollTop, setLastScrollTop] = useState(0);

  // 判斷是否是管理頁面
  const isAdminPage = currentPath === '/admin' || currentPath === '/admin-login';
  // 判斷是否是個人資料頁面
  const isProfilePage = currentPath === '/profile';

  useEffect(() => {
    // 只在個人資料頁面啟用滾動隱藏功能
    if (!isProfilePage) {
      setIsNavVisible(true);
      return;
    }

    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      // 向下滾動超過50px時隱藏導航欄，向上滾動時顯示
      if (scrollTop > lastScrollTop && scrollTop > 50) {
        // 向下滾動
        setIsNavVisible(false);
      } else {
        // 向上滾動或接近頂部
        setIsNavVisible(true);
      }

      setLastScrollTop(scrollTop <= 0 ? 0 : scrollTop);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isProfilePage, lastScrollTop]);

  // 如果是管理頁面，不顯示底部導航欄
  if (isAdminPage) {
    return null;
  }

  // 否則顯示底部導航欄，在個人資料頁面時根據滾動狀態控制顯示
  return <BottomNav isVisible={isNavVisible} />;
};


function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<Navigate to="/swift" />} />
          <Route path="/swift" element={<SwiftTastePage />} />
          <Route path="/buddies" element={<BuddiesPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/profile" element={<UserProfilePage />} />
          <Route path="/admin-login" element={<AdminLogin />} /> {/* 管理員登入頁面路由 */}
          <Route path="/admin" element={<AdminPage />} /> {/* 管理頁面路由 */}
        </Routes>

        {/* 使用控制組件來決定是否顯示底部導航欄 */}
        <BottomNavController />
      </div>
    </Router>
  );
}

export default App;