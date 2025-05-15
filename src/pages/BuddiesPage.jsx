// ✅ BuddiesPage.jsx
import React from "react";
import RoomManager from "../components/BuddiesRoom";
import { useLocation } from "react-router-dom";

export default function BuddiesPage() {
  const location = useLocation();
  const fromSwiftTaste = location.state?.fromSwiftTaste || false;

  return (
    <div style={{ textAlign: "center" }}>
      <RoomManager fromSwiftTaste={fromSwiftTaste} />
    </div>
  );
}
