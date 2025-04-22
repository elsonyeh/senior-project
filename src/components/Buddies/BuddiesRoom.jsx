import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { db, ref, set, get, update, onValue } from '../../services/realtime';
import { QRCode } from 'react-qrcode-logo';
import './BuddiesRoom.css';

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function BuddiesRoom({ fromSwiftTaste }) {
  const [roomCode, setRoomCode] = useState('');
  const [userName, setUserName] = useState('');
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [userId, setUserId] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const auth = getAuth();
    signInAnonymously(auth).catch(console.error);
    onAuthStateChanged(auth, (user) => {
      if (user) setUserId(user.uid);
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roomFromUrl = params.get("room");
    if (roomFromUrl && userId) {
      joinRoom(roomFromUrl);
    }
  }, [location.search, userId]);

  const handleCreateRoom = async () => {
    if (!userName || !userId) return setError("請輸入名稱");
    const newRoom = generateRoomCode();
    const roomRef = ref(db, `buddiesRooms/${newRoom}`);
    const snapshot = await get(roomRef);
    if (!snapshot.exists()) {
      await set(roomRef, {
        host: userId,
        members: {
          [userId]: {
            name: userName,
            joinedAt: Date.now(),
          },
        },
        stage: 'waiting',
        createdAt: Date.now(),
      });
      setRoomCode(newRoom);
      setIsHost(true);
      setJoined(true);
    }
  };

  const joinRoom = async (roomIdInput) => {
    if (!userName || !userId) return setError("請輸入名稱與房號");
    const roomRef = ref(db, `buddiesRooms/${roomIdInput}`);
    const snapshot = await get(roomRef);
    if (!snapshot.exists()) {
      setError('房間不存在');
      return;
    }
    const membersData = snapshot.val().members || {};
    const names = Object.values(membersData).map((m) => m.name);
    if (names.includes(userName)) {
      setError('這個名稱已被使用');
      return;
    }
    await update(ref(db, `buddiesRooms/${roomIdInput}/members/${userId}`), {
      name: userName,
      joinedAt: Date.now(),
    });
    setRoomCode(roomIdInput);
    setJoined(true);
  };

  useEffect(() => {
    if (!roomCode || !joined) return;
    const roomRef = ref(db, `buddiesRooms/${roomCode}/members`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val() || {};
      setMembers(Object.values(data));
    });
    return () => unsubscribe();
  }, [roomCode, joined]);

  const simulateRecommendation = () => {
    const dummyRecs = [
      { id: 'r1', name: '拉麵一郎' },
      { id: 'r2', name: '火鍋之家' },
    ];
    localStorage.setItem('buddiesRecommendations', JSON.stringify(dummyRecs));
    navigate('/swift?mode=buddies');
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      alert("房號已複製 ✅");
    } catch (err) {
      alert("複製失敗");
    }
  };

  const shareRoom = async () => {
    const url = `${window.location.origin}/buddies?room=${roomCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "TasteBuddies 房間邀請", url });
      } catch (err) {
        console.error("分享失敗", err);
      }
    } else {
      await navigator.clipboard.writeText(url);
      alert("已複製分享連結 ✅");
    }
  };

  return (
    <div className="buddies-room">
      {!joined ? (
        <>
          <input
            placeholder="你的名稱"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <input
            placeholder="房號（若要加入）"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          />
          <button onClick={handleCreateRoom}>建立新房間</button>
          <button onClick={() => joinRoom(roomCode)}>加入房間</button>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </>
      ) : (
        <>
          <h3>房號：{roomCode}</h3>
          <QRCode value={`${window.location.origin}/buddies?room=${roomCode}`} size={160} />
          <div>
            <button onClick={copyToClipboard}>📋 複製房號</button>
            <button onClick={shareRoom}>🔗 分享連結</button>
          </div>
          <h4>目前成員：</h4>
          <ul>
            {members.map((m, i) => (
              <li key={i}>{m.name}</li>
            ))}
          </ul>
          {isHost && (
            <button onClick={simulateRecommendation}>👉 開始配對！（模擬）</button>
          )}
        </>
      )}
    </div>
  );
}
