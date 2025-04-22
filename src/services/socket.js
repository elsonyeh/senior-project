import { io } from 'socket.io-client';

// 支援從 .env 檔讀取變數，預設為 localhost:4000
const SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

// 初始化 socket 連線
const socket = io(SERVER_URL, {
  // 若 server 有跨域需求（例如登入驗證），可保留此行
  withCredentials: true,
  // transports 可選，預設自動從 polling 升級為 websocket
  // transports: ['websocket'],
});

export default socket;
