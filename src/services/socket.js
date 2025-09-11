import { io } from 'socket.io-client';

// ✅ 判斷是否本機開發
const isLocal = window.location.hostname === 'localhost' || window.location.hostname.startsWith('127.');

// ✅ 動態選擇連線目標 
const SOCKET_URL = isLocal
  ? 'http://localhost:4001'  // 本機開發時連接到後端端口 4001
  : import.meta.env.VITE_SOCKET_URL || 'https://senior-project-production-ed41.up.railway.app';

console.log('🔌 WebSocket 連線到：', SOCKET_URL);

// 創建 Socket 實例，添加更多連接選項以提高穩定性
const socket = io(SOCKET_URL, {
  transports: ["websocket", "polling"],  // 優先使用 WebSocket，備選輪詢
  reconnectionDelayMax: 10000,          // 最大重連延遲 10 秒
  reconnectionAttempts: 10,             // 嘗試重連 10 次
  timeout: 20000,                        // 連接超時設為 20 秒
  autoConnect: true,                    // 自動連接
  reconnection: true,                    // 啟用重連
  reconnectionDelay: 1000,               // 首次重連延遲 1 秒
  randomizationFactor: 0.5               // 重連隨機因子
});

// 監控連接狀態 - 僅用於日誌記錄
socket.on('connect', () => {
  console.log('🟢 Socket.io 已連接, id:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('🔴 Socket.io 連接錯誤:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log('🔴 Socket.io 斷開連接:', reason);
  
  // 如果因為伺服器端錯誤斷開，嘗試手動重連
  if (reason === 'io server disconnect') {
    console.log('🟠 服務器斷開連接，手動重新連接...');
    socket.connect();
  }
});

socket.on('reconnect', (attemptNumber) => {
  console.log('🟠 Socket.io 重新連接成功，嘗試次數:', attemptNumber);
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log('🟠 Socket.io 嘗試重連，次數:', attemptNumber);
});

socket.on('reconnect_error', (error) => {
  console.error('🔴 Socket.io 重連錯誤:', error.message);
});

socket.on('reconnect_failed', () => {
  console.error('🔴 Socket.io 重連失敗，達到最大嘗試次數');
});

// 導出原始的 socket 實例，確保與 Socket.io 標準接口兼容
export default socket;