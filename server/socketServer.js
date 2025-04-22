import { Server } from 'socket.io';
import http from 'http';
import express from 'express';
import cors from 'cors';

// 初始化 Express 與 HTTP Server
const app = express();
const server = http.createServer(app);

// 支援跨域設定（依環境變數自動選擇）
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: true
}));

// 建立 Socket.IO 伺服器
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// 預設 port
const PORT = process.env.PORT || 4000;

// 房間資料結構
const rooms = {};

io.on('connection', (socket) => {
  console.log('🟢 使用者連線:', socket.id);

  socket.on('createRoom', (callback) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms[roomId] = {
      host: socket.id,
      members: {},
      answers: {},
      votes: {},
      stage: 'waiting'
    };
    socket.join(roomId);
    rooms[roomId].members[socket.id] = { name: 'Host' };
    callback({ roomId });
    io.to(roomId).emit('updateUsers', Object.keys(rooms[roomId].members));
  });

  socket.on('joinRoom', ({ roomId }, callback) => {
    const room = rooms[roomId];
    if (!room) return callback({ success: false, error: '房間不存在' });

    room.members[socket.id] = { name: `User-${socket.id.slice(0, 5)}` };
    socket.join(roomId);
    callback({ success: true });
    io.to(roomId).emit('updateUsers', Object.keys(room.members));
  });

  socket.on('submitAnswers', ({ roomId, answers }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.answers[socket.id] = answers;

    if (Object.keys(room.answers).length === Object.keys(room.members).length) {
      const recs = getDummyRecommendations();
      room.stage = 'vote';
      io.to(roomId).emit('groupRecommendations', recs);
    }
  });

  socket.on('voteRestaurant', ({ roomId, restaurantId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.votes[restaurantId] = (room.votes[restaurantId] || 0) + 1;
    io.to(roomId).emit('voteUpdate', room.votes);
  });

  socket.on('disconnect', () => {
    console.log('🔴 使用者離線:', socket.id);
    for (const [roomId, room] of Object.entries(rooms)) {
      if (room.members[socket.id]) {
        delete room.members[socket.id];
        delete room.answers[socket.id];
        io.to(roomId).emit('updateUsers', Object.keys(room.members));
        if (Object.keys(room.members).length === 0) {
          delete rooms[roomId];
        }
      }
    }
  });
});

// 假資料推薦（你可改為連接資料庫）
function getDummyRecommendations() {
  return [
    { id: 'r1', name: '拉麵一郎' },
    { id: 'r2', name: '火鍋之家' },
    { id: 'r3', name: '牛肉麵王' }
  ];
}

// 簡單的健康檢查 API
app.get('/ping', (req, res) => {
  res.send('pong');
});

server.listen(PORT, () => {
  console.log(`🚀 Socket server running at http://localhost:${PORT}`);
});
