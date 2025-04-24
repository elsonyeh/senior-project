import { io } from 'socket.io-client';

// ✅ 判斷是否本機開發
const isLocal = location.hostname === 'localhost' || location.hostname.startsWith('127.');

// ✅ 動態選擇連線目標
const SOCKET_URL = isLocal
  ? 'http://localhost:4000'
  : import.meta.env.VITE_SOCKET_URL || 'https://senior-project-production-e44e.up.railway.app'; // fallback 預設

console.log('🔌 WebSocket 連線到：', SOCKET_URL);

const socket = io(import.meta.env.VITE_SOCKET_URL, {
  transports: ["websocket"]
});

export default socket;
