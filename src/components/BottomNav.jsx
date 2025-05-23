import React, { useState, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { IoMapOutline, IoRestaurantOutline, IoPersonOutline } from "react-icons/io5";
import "./BottomNav.css";

export default function BottomNav() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("");
  const [currentMode, setCurrentMode] = useState(null);
  const [isInitialRender, setIsInitialRender] = useState(true);
  const navRef = useRef(null);
  const pillBackgroundRef = useRef(null);

  // 初始化當前激活的標籤並檢測URL參數中的模式
  useEffect(() => {
    // 從URL獲取模式
    const params = new URLSearchParams(location.search);
    const modeParam = params.get("mode");
    if (modeParam) {
      setCurrentMode(modeParam);
    }

    // 處理初次載入，使用requestAnimationFrame確保在正確的瀏覽器繪製循環中處理
    if (isInitialRender) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          setIsInitialRender(false);
          if (pillBackgroundRef.current) {
            pillBackgroundRef.current.style.opacity = "1";
          }
        }, 100); // 給予一個短暫延遲，讓DOM完全渲染
      });
    }

    // 從路由路徑判斷當前頁面
    if (location.pathname.includes("/map")) {
      setActiveTab("map");
    } else if (location.pathname.includes("/swift")) {
      setActiveTab("swift");
    } else if (location.pathname.includes("/profile")) {
      setActiveTab("profile");
    } else if (location.pathname.includes("/buddies")) {
      // 當在buddies頁面時仍然保持swift標籤激活
      setActiveTab("swift");
    }
  }, [location.pathname, location.search, isInitialRender]);

  // 計算圓圈位置，使用精確百分比
  const getCirclePosition = () => {
    if (activeTab === "map") return "18.3%";
    if (activeTab === "swift") return "50%"; // 確保中間位置精確居中
    if (activeTab === "profile") return "82%";
    return "50%"; // 默認中間
  };

  // 維持當前模式參數，確保切換路由時不丟失模式
  const getRouteWithMode = (basePath) => {
    if (currentMode && (basePath === "/swift" || basePath === "/buddies")) {
      return `${basePath}?mode=${currentMode}`;
    }
    return basePath;
  };

  // 處理NavLink的激活狀態
  const isNavLinkActive = (path) => {
    if (path === "/swift" && (location.pathname.includes("/swift") || location.pathname.includes("/buddies"))) {
      return true;
    }
    return location.pathname.includes(path);
  };

  return (
    <div className="floating-nav-container">
      <nav 
        className={`floating-bottom-nav ${isInitialRender ? 'initializing' : ''}`}
        ref={navRef}
      >
        {/* 背景圓圈 */}
        <div 
          className="nav-pill-background"
          ref={pillBackgroundRef}
          style={{
            left: getCirclePosition(),
            marginLeft: "-27.5px", // 圓圈半徑為 27.5px (55px/2)
            opacity: isInitialRender ? "0" : "1", // 初始載入時隱藏
            transition: "opacity 0.2s ease, left 0.3s cubic-bezier(0.68, -0.6, 0.32, 1.6)"
          }}
        ></div>
        
        <NavLink 
          to="/map" 
          className={({isActive}) => 
            `nav-pill ${isActive || activeTab === "map" ? "active" : ""}`
          }
          onClick={() => setActiveTab("map")}
        >
          <div className="pill-content">
            <div className="pill-icon">
              <IoMapOutline />
            </div>
            <span className="pill-label">探索</span>
          </div>
        </NavLink>
        
        <NavLink 
          to={getRouteWithMode("/swift")}
          className={`nav-pill ${isNavLinkActive("/swift") ? "active" : ""}`}
          onClick={() => setActiveTab("swift")}
        >
          <div className="pill-content">
            <div className="pill-icon">
              <IoRestaurantOutline />
            </div>
            <span className="pill-label">今天吃啥</span>
          </div>
        </NavLink>
        
        <NavLink 
          to="/profile" 
          className={({isActive}) => 
            `nav-pill ${isActive || activeTab === "profile" ? "active" : ""}`
          }
          onClick={() => setActiveTab("profile")}
        >
          <div className="pill-content">
            <div className="pill-icon">
              <IoPersonOutline />
            </div>
            <span className="pill-label">我的</span>
          </div>
        </NavLink>
      </nav>
    </div>
  );
}