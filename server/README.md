# 🧠 TasteBuddies Socket Server

這是 TasteBuddies 專案的多人互動後端伺服器，使用 `express` + `socket.io` 建立。

---

## 📁 檔案結構建議

```bash
TasteBuddies/
├── client/            # React 前端專案（原本的 SwiftTaste）
│   └── ...
├── server/            # ✅ Socket server 位置
│   └── socketServer.js
└── README.md          # 或 socket server README
```

---

## 📦 安裝後端依賴

請在 `server/` 資料夾下執行：

```bash
cd server
npm init -y
npm install express socket.io cors
```

---

## 🚀 啟動伺服器

```bash
node socketServer.js
```

（如果你有安裝 nodemon 也可以用）
```bash
npx nodemon socketServer.js
```

伺服器將啟動於：
```
http://localhost:4000
```

---

## 🧪 測試連線
React 前端請使用：
```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:4000');
```

---

## ✅ 支援的事件
| 事件名稱           | 功能說明                         |
|--------------------|----------------------------------|
| `createRoom`       | 建立房間，回傳 roomId           |
| `joinRoom`         | 加入房間並加入 socket room       |
| `submitAnswers`    | 上傳每位使用者答題資料           |
| `groupRecommendations` | 回傳推薦餐廳（模擬）         |
| `voteRestaurant`   | 對特定餐廳進行投票              |
| `updateUsers`      | 廣播當前使用者名單              |

---

## 📌 注意
- 本伺服器目前使用記憶體暫存房間資料，部署時可改為 Redis 等永久儲存
- 未實作使用者名稱登入，可與 Firebase Auth 整合 UID later

---

若需部署至遠端伺服器（如 Vercel + Render），可另外加上 proxy 設定與環境變數支持。
