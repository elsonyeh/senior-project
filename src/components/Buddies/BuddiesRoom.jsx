// BuddiesRoom.jsx（整合後，含同步答題流程）
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { db, ref, set, get, update, onValue } from '../../services/realtime';
import { QRCode } from 'react-qrcode-logo';
import socket from '../../services/socket';
import './BuddiesRoom.css';
import { basicQuestions } from '../../data/basicQuestions';
import { funQuestions } from '../../data/funQuestions';
import { getRandomFunQuestions } from '../../logic/recommendLogic';
import QuestionSwiperMotion from '../QuestionSwiperMotion';

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
  const [phase, setPhase] = useState('lobby');
  const [questions, setQuestions] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [votes, setVotes] = useState({});
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

  useEffect(() => {
    socket.on('updateUsers', (users) => setMembers(users));
    socket.on('startQuestions', () => {
      const randomFun = getRandomFunQuestions(funQuestions);
      const all = [...basicQuestions, ...randomFun];
      setQuestions(all);
      setPhase('questions');
    });
    socket.on('groupRecommendations', (recs) => {
      setRecommendations(recs);
      setPhase('vote');
    });
    socket.on('voteUpdate', (voteData) => {
      setVotes(voteData);
    });
    return () => {
      socket.off('updateUsers');
      socket.off('startQuestions');
      socket.off('groupRecommendations');
      socket.off('voteUpdate');
    };
  }, []);

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
      socket.emit('createRoom', { roomId: newRoom });
      setPhase('waiting');
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
    await update(ref(db, `buddiesRooms/${roomIdInput}/members/${userId}`), {
      name: userName,
      joinedAt: Date.now(),
    });
    setRoomCode(roomIdInput);
    setJoined(true);
    socket.emit('joinRoom', { roomId: roomIdInput });
    setPhase('waiting');
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

  const submitAnswers = (answersObj) => {
    const answers = Object.values(answersObj);
    socket.emit('submitAnswers', { roomId, answers });
    setPhase('waitingResults');
  };

  const voteRestaurant = (restaurantId) => {
    socket.emit('voteRestaurant', { roomId, restaurantId });
  };

  const formatQuestionsForSwiper = (questions) =>
    questions.map((q, index) => ({
      id: "q" + index,
      text: q.question,
      leftOption: q.options[0],
      rightOption: q.options[1],
    }));

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
      ) : phase === 'waiting' ? (
        <>
          <h3>房號：{roomCode}</h3>
          <QRCode value={`${window.location.origin}/buddies?room=${roomCode}`} size={160} />
          <div>
            <button onClick={copyToClipboard}>📋 複製房號</button>
            <button onClick={shareRoom}>🔗 分享連結</button>
          </div>
          <h4>目前成員：</h4>
          <ul>
            {members.map((uid) => (
              <li key={uid}>{uid}</li>
            ))}
          </ul>
          {isHost && (
            <button onClick={() => socket.emit('startQuestions', { roomId })}>👉 開始答題</button>
          )}
        </>
      ) : phase === 'questions' ? (
        <QuestionSwiperMotion
          questions={formatQuestionsForSwiper(questions)}
          onComplete={submitAnswers}
        />
      ) : phase === 'waitingResults' ? (
        <p>等待其他人完成答題...</p>
      ) : phase === 'vote' ? (
        <div>
          <h3>大家都答完啦！來投票吧 🎉</h3>
          {recommendations.map((r) => (
            <div key={r.id}>
              <h4>{r.name}</h4>
              <button onClick={() => voteRestaurant(r.id)}>投票</button>
              <p>票數: {votes[r.id] || 0}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
