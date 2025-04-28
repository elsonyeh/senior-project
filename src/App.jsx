import React from "react";
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
  
  // 判斷是否是管理頁面
  const isAdminPage = currentPath === '/admin' || currentPath === '/admin-login';
  
  // 如果是管理頁面，不顯示底部導航欄
  if (isAdminPage) {
    return null;
  }
  
  // 否則顯示底部導航欄
  return <BottomNav />;
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