import { io } from 'socket.io-client';

// ✅ 自動偵測部署與開發環境
const isLocal = location.hostname === 'localhost' || location.hostname.startsWith('127.');

const socket = io(
  isLocal
    ? 'http://localhost:4000'
    : import.meta.env.VITE_SOCKET_URL || 'senior-project-production-ed41.up.railway.app',
  {
    transports: ['websocket'],
  }
);

export default socket;
