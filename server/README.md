# 🍜 TasteBuddies Socket Server（適用於 Railway 部署）

這是一個支援 WebSocket 的 Socket.IO 伺服器，專為 [TasteBuddies](https://github.com/你的前端專案) 專案設計，負責多人答題房間同步、投票與結果傳遞等功能。

部署在 [Railway](https://railway.app) 上，可免費使用，穩定支援 WebSocket。

---

## 🛠️ 功能簡介

- ✅ 使用 Firebase Realtime Database 儲存房間資料
- ✅ 支援 createRoom / joinRoom / answer / vote / 結果顯示
- ✅ 每 5 分鐘自動清理過期房間（可選）
- ✅ 適合前端 React 專案串接使用

---

## 🚀 快速部署到 Railway

### ✅ 1. fork 或 clone 此專案

你可以將整個 `/server` 資料夾放入你的前端 GitHub 專案下，或建立獨立 Repo。

### ✅ 2. 登入 Railway 並建立新專案

- 前往 [https://railway.app](https://railway.app)
- 點選「New Project」→ 選擇「Deploy from GitHub Repo」
- 選擇你含有此專案的 GitHub 倉庫

### ✅ 3. 設定環境變數

| 名稱 | 值 |
|------|----|
| `FIREBASE_DB_URL` | `https://你的-firebase-專案.firebaseio.com` |

---

## 🧾 檔案說明

| 檔案 | 功能 |
|------|------|
| `index.js` | 主程式入口，包含 socket.io 伺服器邏輯 |
| `firebase.js` | Firebase Admin SDK 初始化，連線至 RTDB |
| `package.json` | 定義依賴與啟動命令 |
| `Procfile` | Railway 使用的啟動配置 |
| `.env` | ✅ 可選，本地測試時放入環境變數設定（不會上傳 Git） |

---

## 🔌 前端串接方式

在你的前端專案中設定 socket：

```js
import { io } from 'socket.io-client';

const socket = io('https://你的-railway-app.up.railway.app', {
  transports: ['websocket'],
});

export default socket;
