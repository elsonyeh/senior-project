// ✅ BuddiesPage.jsx
import React from 'react';
import RoomManager from '../components/Buddies/BuddiesRoom';
import { useLocation } from 'react-router-dom';

export default function BuddiesPage() {
  const location = useLocation();
  const fromSwiftTaste = location.state?.fromSwiftTaste || false;

  return (
    <div style={{ textAlign: 'center', marginTop: '5rem' }}>
      <h1>BuddiesPage</h1>
      <p>🚧 此功能尚在開發中，敬請期待！</p>
      <RoomManager fromSwiftTaste={fromSwiftTaste} />
    </div>
  );
}