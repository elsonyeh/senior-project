const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { rtdb } = require('./firebase');
const { ref, set } = require('firebase-admin/database');

const app = express();
const server = http.createServer(app);

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: true
}));

const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 4000;
const rooms = {};

io.on('connection', (socket) => {
  console.log('🟢 使用者連線:', socket.id);

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
    rooms[roomId].members[socket.id] = { name: sanitizeName(userName, socket.id) };

    await set(ref(rtdb, `buddiesRooms/${roomId}`), {
      hostSocket: socket.id,
      createdAt: Date.now()
    });

    if (typeof callback === 'function') {
      callback({ roomId });
    }
    emitUserList(roomId);
  });

  socket.on('joinRoom', ({ roomId, userName }, callback) => {
    const room = rooms[roomId];
    if (!room) {
      if (typeof callback === 'function') {
        callback({ success: false, error: '房間不存在' });
      }
      return;
    }

    socket.join(roomId);
    const finalName = sanitizeName(userName, socket.id);
    room.members[socket.id] = { name: finalName };

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
