import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import SwiftTastePage from "./pages/SwiftTastePage";
import BuddiesPage from "./pages/BuddiesPage";
import MapPage from "./pages/MapPage";
import BottomNav from "./components/BottomNav";
import UserProfilePage from "./pages/UserProfilePage";
import AdminPage from './pages/AdminPage';
import "./App.css";

function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<Navigate to="/swift" />} />
          <Route path="/swift" element={<SwiftTastePage />} />
          <Route path="/buddies" element={<BuddiesPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/profile"  element={<UserProfilePage />}/>
          <Route path="/admin" element={<AdminPage />} />  // 新增管理頁面路由
        </Routes>

        {/* 固定底部導航列 */}
        <BottomNav />
      </div>
    </Router>
  );
}

export default App;
