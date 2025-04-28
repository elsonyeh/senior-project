import { io } from 'socket.io-client';

// ✅ 判斷是否本機開發
const isLocal = window.location.hostname === 'localhost' || window.location.hostname.startsWith('127.');

// ✅ 動態選擇連線目標
const SOCKET_URL = isLocal
  ? 'http://localhost:4000'
  : import.meta.env.VITE_SOCKET_URL || 'https://senior-project-production-ed41.up.railway.app'; // fallback 預設

console.log('🔌 WebSocket 連線到：', SOCKET_URL);

// 修正: 直接使用選擇好的 SOCKET_URL，而不是環境變數
const socket = io(SOCKET_URL, {
  transports: ["websocket", "polling"],
  reconnectionDelayMax: 10000,
  reconnectionAttempts: 10,
  timeout: 20000
});

// 新增錯誤處理和連接監控
socket.on('connect', () => {
  console.log('🟢 Socket.io 已連接, id:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('🔴 Socket.io 連接錯誤:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log('🔴 Socket.io 斷開連接:', reason);
});

socket.on('reconnect', (attemptNumber) => {
  console.log('🟠 Socket.io 重新連接成功，嘗試次數:', attemptNumber);
});

export default socket;