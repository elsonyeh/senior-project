// ✅ BuddiesPage.jsx
import React from "react";
import RoomManager from "../components/BuddiesRoom";
import { useLocation, useSearchParams } from "react-router-dom";

export default function BuddiesPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const fromSwiftTaste = location.state?.fromSwiftTaste || false;
  const roomIdFromUrl = searchParams.get("roomId");

  return (
    <div style={{ textAlign: "center" }}>
      <RoomManager fromSwiftTaste={fromSwiftTaste} initialRoomId={roomIdFromUrl} />
    </div>
  );
}
