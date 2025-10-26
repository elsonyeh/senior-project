import React, { useState, useEffect, createContext, useContext } from "react";
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

// 創建導航欄狀態上下文
const NavContext = createContext();

export const useNavContext = () => {
  const context = useContext(NavContext);
  if (!context) {
    throw new Error('useNavContext must be used within a NavProvider');
  }
  return context;
};

// 底部導航欄控制組件
const BottomNavController = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [lastScrollTop, setLastScrollTop] = useState(0);
  const { isNavCollapsed, handleNavExpand, isAuthModalOpen } = useNavContext();

  // 判斷是否是管理頁面
  const isAdminPage = currentPath === '/admin' || currentPath === '/admin-login';
  // 判斷是否是個人資料頁面 (包含所有子頁面)
  const isProfilePage = currentPath === '/profile';

  useEffect(() => {
    // 如果不是個人資料頁面，總是顯示導航欄
    if (!isProfilePage) {
      setIsNavVisible(true);
      return;
    }

    // 監聽來自 UserProfilePage 的導航欄狀態變化
    const handleProfileNavChange = (event) => {
      setIsNavVisible(event.detail.isVisible);
    };

    window.addEventListener('profileNavChange', handleProfileNavChange);

    // 初始化狀態
    if (window.profileNavVisible !== undefined) {
      setIsNavVisible(window.profileNavVisible);
    }

    return () => {
      window.removeEventListener('profileNavChange', handleProfileNavChange);
    };
  }, [isProfilePage]);

  // 如果是管理頁面，不顯示底部導航欄
  if (isAdminPage) {
    return null;
  }

  // 如果AuthModal開啟，隱藏底部導航欄
  if (isAuthModalOpen) {
    return null;
  }

  // 否則顯示底部導航欄，在個人資料頁面時根據滾動狀態控制顯示
  return (
    <BottomNav
      isVisible={isNavVisible}
      isCollapsed={isNavCollapsed}
      onExpand={handleNavExpand}
    />
  );
};


// NavProvider組件
const NavProvider = ({ children }) => {
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const handleNavExpand = () => {
    setIsNavCollapsed(false);
  };

  const navContextValue = {
    isNavCollapsed,
    setIsNavCollapsed,
    handleNavExpand,
    isAuthModalOpen,
    setIsAuthModalOpen
  };

  return (
    <NavContext.Provider value={navContextValue}>
      {children}
    </NavContext.Provider>
  );
};

function App() {
  console.log('🚀 App component rendering...');
  return (
    <Router>
      <NavProvider>
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
      </NavProvider>
    </Router>
  );
}

export default App;