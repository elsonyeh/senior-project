const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { rtdb } = require('./firebase');
const { ref, set, get } = require('firebase-admin/database');

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  'http://localhost:5173',
  'https://senior-project-ruby.vercel.app'
];


app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 4000;
const rooms = {};

socket.on('createRoom', async ({ userName }, callback) => {
  const roomId = generateRoomId();

  rooms[roomId] = {
    host: socket.id,
    members: {},
    answers: {},
    votes: {},
    stage: 'waiting'
  };

  socket.join(roomId);
  rooms[roomId].members[socket.id] = {
    name: sanitizeName(userName, socket.id)
  };

  // ✅ 僅後端寫入房號
  await rtdb.ref(`buddiesRooms/${roomId}`).set({
    hostSocket: socket.id,
    createdAt: Date.now()
  });

  if (typeof callback === 'function') {
    callback({ roomId }); // ✅ 傳給前端
  }

  emitUserList(roomId);
});

socket.on('joinRoom', async ({ roomId, userName }, callback) => {
  let room = rooms[roomId];

  if (!room) {
    const snap = await rtdb.ref(`buddiesRooms/${roomId}`).get();
    if (!snap.exists()) {
      if (typeof callback === 'function') {
        return callback({ success: false, error: '房間不存在' });
      }
      return;
    }

    // ⚠️ 若 server 重啟過 → 從 Firebase 恢復最基本資料
    rooms[roomId] = {
      host: snap.val().hostSocket || null,
      members: {},
      answers: {},
      votes: {},
      stage: 'waiting'
    };

    room = rooms[roomId];
  }

  socket.join(roomId);
  const name = sanitizeName(userName, socket.id);
  room.members[socket.id] = { name };

  if (typeof callback === 'function') {
    callback({ success: true });
  }

  emitUserList(roomId);
});

socket.on('startQuestions', ({ roomId }, callback) => {
  if (rooms[roomId]) {
    io.to(roomId).emit('startQuestions');
    if (typeof callback === 'function') {
      callback({ success: true });
    }
  } else {
    if (typeof callback === 'function') {
      callback({ success: false, error: '房間不存在' });
    }
  }
});

socket.on('submitAnswers', ({ roomId, answers }, callback) => {
  const room = rooms[roomId];
  if (!room) {
    if (typeof callback === 'function') {
      callback({ success: false, error: '房間不存在' });
    }
    return;
  }

  room.answers[socket.id] = answers;

  if (Object.keys(room.answers).length === Object.keys(room.members).length) {
    const recs = getDummyRecommendations();
    room.stage = 'vote';
    io.to(roomId).emit('groupRecommendations', recs);
  }

  if (typeof callback === 'function') {
    callback({ success: true });
  }
});

socket.on('voteRestaurant', ({ roomId, restaurantId }, callback) => {
  const room = rooms[roomId];
  if (!room) {
    if (typeof callback === 'function') {
      callback({ success: false, error: '房間不存在' });
    }
    return;
  }

  room.votes[restaurantId] = (room.votes[restaurantId] || 0) + 1;
  io.to(roomId).emit('voteUpdate', room.votes);

  if (typeof callback === 'function') {
    callback({ success: true });
  }
});

socket.on('disconnect', () => {
  console.log('🔴 使用者離線:', socket.id);
  for (const [roomId, room] of Object.entries(rooms)) {
    if (room.members[socket.id]) {
      delete room.members[socket.id];
      delete room.answers[socket.id];
      emitUserList(roomId);
      if (Object.keys(room.members).length === 0) {
        delete rooms[roomId];
      }
    }
  }
});

// 工具函式

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function sanitizeName(name, socketId) {
  return typeof name === 'string' && name.trim()
    ? name.trim()
    : `User-${socketId.slice(0, 5)}`;
}

function getUserList(roomId) {
  const room = rooms[roomId];
  if (!room) return [];
  return Object.entries(room.members).map(([uid, data]) => ({
    uid,
    name: data.name
  }));
}

function emitUserList(roomId) {
  io.to(roomId).emit('updateUsers', getUserList(roomId));
}

function getDummyRecommendations() {
  return [
    { id: 'r1', name: '拉麵一郎' },
    { id: 'r2', name: '火鍋之家' },
    { id: 'r3', name: '牛肉麵王' }
  ];
}

app.get('/ping', (req, res) => {
  res.send('pong');
});

server.listen(PORT, () => {
  console.log(`🚀 Socket server running at http://localhost:${PORT}`);
});
