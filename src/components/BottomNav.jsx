import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { IoMapOutline, IoRestaurantOutline, IoPersonOutline } from "react-icons/io5";
import "./BottomNav.css";

export default function BottomNav() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("");

  // 初始化當前激活的標籤
  useEffect(() => {
    if (location.pathname.includes("/map")) setActiveTab("map");
    else if (location.pathname.includes("/swift")) setActiveTab("swift");
    else if (location.pathname.includes("/profile")) setActiveTab("profile");
  }, [location.pathname]);

  // 處理標籤點擊
  const handleTabClick = (tab) => {
    setActiveTab(tab);
  };

  // 計算圓圈位置 - 調整靠內一點
  const getCirclePosition = () => {
    if (activeTab === "map") return "17.5%"; // 從16.6%調整為22%靠內
    if (activeTab === "swift") return "49.5%"; // 中間位置保持不變
    if (activeTab === "profile") return "81.3%"; // 從83.3%調整為78%靠內
    return "50%"; // 默認中間
  };

  return (
    <div className="floating-nav-container">
      <nav className="floating-bottom-nav">
        {/* 背景圓圈 */}
        <div 
          className="nav-pill-background" 
          style={{
            left: getCirclePosition(),
            marginLeft: "-25px" // 圓圈半徑為 25px
          }}
        ></div>
        
        <NavLink 
          to="/map" 
          className={({isActive}) => 
            `nav-pill ${isActive ? "active" : ""}`
          }
          onClick={() => handleTabClick("map")}
        >
          <div className="pill-content">
            <div className="pill-icon">
              <IoMapOutline />
            </div>
            <span className="pill-label">探索</span>
          </div>
        </NavLink>
        
        <NavLink 
          to="/swift" 
          className={({isActive}) => 
            `nav-pill ${isActive ? "active" : ""}`
          }
          onClick={() => handleTabClick("swift")}
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
            `nav-pill ${isActive ? "active" : ""}`
          }
          onClick={() => handleTabClick("profile")}
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