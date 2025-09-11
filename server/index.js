/* eslint-env node */
// index.js - 轉換為 CommonJS 格式
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const process = require('process');
// Firebase removed - now using Supabase only
// const firebase = require('./firebase.js');
// const { rtdb, firestore, admin, isConnected, isOfflineMode } = firebase;

// Supabase 服務支援 (用於 Buddies 即時功能)
let supabaseServices = null;
try {
  const supabaseService = require('./supabase.js');
  supabaseServices = { 
    roomService: supabaseService.roomService, 
    memberService: supabaseService.memberService,
    recommendationService: supabaseService.recommendationService,
    voteService: supabaseService.voteService,
    finalResultService: supabaseService.finalResultService
  };
  console.log('✅ Supabase 服務載入成功（支援 Buddies 即時功能）');
} catch (error) {
  console.warn('⚠️  Supabase 服務載入失敗，Buddies 功能將使用 Firebase 模式');
  console.warn('錯誤詳情:', error.message);
}

// 初始化 dotenv
dotenv.config();

// Database functions moved to Supabase - legacy Firebase functions commented out
// const database = rtdb;
// const serverTimestamp = () => admin.database.ServerValue.TIMESTAMP;
// const ref = (path) => database.ref(path);
// const set = (reference, data) => reference.set(data);
// const get = (reference) => reference.once('value');

// 創建 Express 應用程式和 HTTP 伺服器
const app = express();
const server = http.createServer(app);

// 配置 CORS
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://swifttaste-demo.vercel.app",
    "https://senior-project-production-ed41.up.railway.app"
  ],
  methods: ["GET", "POST"],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// 創建 Socket.IO 實例
const io = new Server(server, {
  cors: corsOptions,
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000
});

// 基本路由
app.get('/', (req, res) => {
  res.json({ 
    status: 'SwiftTaste Server is running',
    timestamp: new Date().toISOString(),
    supabaseEnabled: supabaseServices !== null
  });
});

// Socket.io 連接處理
io.on('connection', (socket) => {
  console.log(`用戶連接: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`用戶斷開連接: ${socket.id}`);
  });
});

// 設定 PORT - 優先使用環境變數，否則使用 4000 (後端專用端口)
const PORT = process.env.PORT || 4001;

// 啟動伺服器
server.listen(PORT, () => {
  console.log(`🚀 伺服器已啟動，監聽端口 ${PORT}`);
  console.log(`🌐 CORS 已配置為允許來自以下來源的請求:`);
  console.log(`   - http://localhost:5173 (前端開發伺服器)`);
  console.log(`   - https://swifttaste-demo.vercel.app (正式環境)`);
  console.log(`   - https://senior-project-production-ed41.up.railway.app (Railway)`);
  console.log(`📊 Supabase 服務狀態: ${supabaseServices ? '已啟用' : '未啟用'}`);
});