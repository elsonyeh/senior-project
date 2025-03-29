import React from "react";
import { NavLink } from "react-router-dom";
import "./BottomNav.css";

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/map" className="nav-item">
        <span>🗺️</span>
        <p>地圖探索</p>
      </NavLink>
      <NavLink to="/swift" className="nav-item">
        <span>🎯</span>
        <p>SwiftTaste</p>
      </NavLink>
      <NavLink to="/profile" className="nav-item">
        <span>👤</span>
        <p>個人</p>
      </NavLink>
    </nav>
  );
}
