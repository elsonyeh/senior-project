const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { rtdb, isOfflineMode, isConnected } = require('./firebase');
// 移除有問題的引入方式
// const { ref, set, get, update, serverTimestamp } = require('firebase-admin/database');
require('dotenv').config(); // 確保加載 .env 檔案

// 使用 Firebase Admin SDK 的數據庫操作
const admin = require('firebase-admin');
// 創建正確的數據庫操作函數
const database = rtdb; // 使用已導入的 rtdb
const serverTimestamp = () => admin.database.ServerValue.TIMESTAMP;
const ref = (path) => database.ref(path);
const set = (reference, data) => reference.set(data);
const get = (reference) => reference.once('value');
const update = (reference, data) => reference.update(data);

const enhancedLogic = require('./logic/enhancedRecommendLogicBackend.js');

const app = express();
const server = http.createServer(app);

// 從環境變量讀取允許的域名，如果未設置則使用默認值
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?
  process.env.ALLOWED_ORIGINS.split(',') :
  [
    'http://localhost:5173',
    'https://senior-project-ruby.vercel.app'
  ]).map(origin => origin.trim());

console.log('允許的跨域來源:', allowedOrigins);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// 設置 Socket.io
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST']
  },
  // 添加重連配置
  connectTimeout: 10000,
  pingTimeout: 5000,
  pingInterval: 10000,
  transports: ['websocket', 'polling']
});

// 從環境變量讀取端口，如果未設置則使用默認值
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Socket server running at http://localhost:${PORT}`);
  console.log(`Firebase 連接狀態: ${isConnected() ? '已連接' : '離線模式'}`);
});

// 房間數據儲存 - 使用內存作為備份
const rooms = {};

// 監控 Firebase 連接狀態變化
let firebaseOnline = isConnected();
setInterval(() => {
  const currentStatus = isConnected();
  if (currentStatus !== firebaseOnline) {
    firebaseOnline = currentStatus;
    console.log(`Firebase 連接狀態變更為: ${firebaseOnline ? '已連接' : '離線模式'}`);

    // 如果恢復連接，嘗試同步內存數據到 Firebase
    if (firebaseOnline && Object.keys(rooms).length > 0) {
      console.log('嘗試同步內存數據到 Firebase...');
      Object.entries(rooms).forEach(([roomId, room]) => {
        try {
          const roomRef = ref(`buddiesRooms/${roomId}`);
          set(roomRef, {
            ...room,
            syncedAt: serverTimestamp(),
            syncSource: 'server_memory'
          }).catch(err => console.error(`同步房間 ${roomId} 失敗:`, err));
        } catch (error) {
          console.error(`同步房間 ${roomId} 到 Firebase 時出錯:`, error);
        }
      });
    }
  }
}, 10000); // 每10秒檢查一次

// 從Firestore獲取餐廳數據
async function getRestaurants() {
  try {
    // 使用 Firestore 獲取餐廳數據
    const { firestore } = require('./firebase');
    if (!firestore) {
      console.error('Firestore 未初始化');
      return [];
    }

    const restaurantsCollection = firestore.collection('restaurants');
    const snapshot = await restaurantsCollection.get();

    if (snapshot.empty) {
      console.warn('Firestore 中沒有餐廳數據');
      return [];
    }

    // 轉換數據格式
    const restaurants = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`成功從 Firestore 獲取 ${restaurants.length} 個餐廳數據`);
    return restaurants;
  } catch (error) {
    console.error('獲取餐廳數據失敗:', error);
    return [];
  }
}

// 保存推薦結果到Firebase
async function saveRecommendationsToFirebase(roomId, recommendations) {
  try {
    if (!roomId || !recommendations) {
      console.error('保存推薦結果失敗: 參數不完整');
      return false;
    }

    // 同時保存到內存和 Firebase
    if (rooms[roomId]) {
      rooms[roomId].recommendations = recommendations;
    }

    if (firebaseOnline) {
      const recommendationsRef = ref(`buddiesRooms/${roomId}/recommendations`);
      await set(recommendationsRef, {
        timestamp: serverTimestamp(),
        restaurants: recommendations
      });

      // 更新房間狀態
      const roomRef = ref(`buddiesRooms/${roomId}`);
      await update(roomRef, {
        status: 'vote',
        updatedAt: serverTimestamp()
      });
    } else {
      console.warn(`Firebase 離線中，推薦結果只保存在內存中 (房間 ${roomId})`);
    }

    return true;
  } catch (error) {
    console.error('保存推薦結果失敗:', error);
    return false;
  }
}

// 工具函式
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function sanitizeName(name, socketId) {
  return typeof name === 'string' && name.trim()
    ? name.trim()
    : `User-${socketId ? socketId.slice(0, 5) : Math.floor(Math.random() * 10000)}`;
}

function getUserList(roomId) {
  const room = rooms[roomId];
  if (!room) return [];
  return Object.entries(room.members).map(([uid, data]) => ({
    uid,
    ...data
  }));
}

function emitUserList(roomId) {
  io.to(roomId).emit('updateUsers', getUserList(roomId));
}

// 處理Socket連接
io.on('connection', (socket) => {
  console.log('🟢 使用者連線:', socket.id);

  // 發送服務器狀態
  socket.emit('serverStatus', {
    firebaseConnected: firebaseOnline,
    serverTime: new Date().toISOString()
  });

  // 創建房間 - 修改版本
  socket.on('createRoom', async ({ userName }, callback) => {
    try {
      if (!userName || typeof userName !== 'string') {
        return callback?.({
          success: false,
          error: '缺少有效的用戶名'
        });
      }

      const roomId = generateRoomId();
      console.log(`嘗試創建房間 ${roomId} 由用戶 ${userName} (${socket.id})`);

      // 初始化房間數據
      rooms[roomId] = {
        host: socket.id,
        members: {},
        answers: {},
        votes: {},
        stage: 'waiting',
        createdAt: Date.now(),
        lastActive: Date.now() // 添加最後活動時間
      };

      // 加入房間
      socket.join(roomId);

      // 儲存會員資訊到記憶體
      const sanitizedName = sanitizeName(userName, socket.id);
      rooms[roomId].members[socket.id] = {
        id: socket.id,
        name: sanitizedName,
        isHost: true,
        joinedAt: Date.now()
      };

      console.log(`房間 ${roomId} 創建成功，加入成員: ${sanitizedName}`);

      // 如果 Firebase 在線，保存到 Firebase
      if (firebaseOnline) {
        try {
          const roomRef = ref(`buddiesRooms/${roomId}`);
          await set(roomRef, {
            hostSocket: socket.id,
            hostName: sanitizedName,
            createdAt: serverTimestamp(),
            lastActive: serverTimestamp(), // 添加最後活動時間
            status: 'waiting',
            meta: {
              isDeleted: false // 初始標記為未刪除
            }
          });

          // 保存成員信息
          const memberRef = ref(`buddiesRooms/${roomId}/members/${socket.id}`);
          await set(memberRef, {
            id: socket.id,
            name: sanitizedName,
            isHost: true,
            joinedAt: serverTimestamp()
          });

          // 同時將房間信息保存到分析集合中
          const analyticsRef = ref(`analyticsLogs/rooms/${roomId}`);
          await set(analyticsRef, {
            hostSocket: socket.id,
            hostName: sanitizedName,
            createdAt: serverTimestamp(),
            status: 'created',
            meta: {
              userAgent: socket.handshake.headers['user-agent'] || 'unknown',
              ip: socket.handshake.address || 'unknown'
            }
          });

          console.log(`房間 ${roomId} 已保存到 Firebase`);
        } catch (firebaseError) {
          console.error(`Firebase 保存房間 ${roomId} 失敗:`, firebaseError);
          // 即使 Firebase 保存失敗，內存中的數據仍然有效
        }
      }

      if (typeof callback === 'function') {
        callback({
          success: true,
          roomId,
          isHost: true
        });
      }

      // 通知房間成員
      emitUserList(roomId);
    } catch (error) {
      console.error("創建房間錯誤:", error);
      if (typeof callback === 'function') {
        callback({ success: false, error: '創建房間失敗: ' + error.message });
      }
    }
  });

  // 加入房間 - 修改後的版本
  socket.on('joinRoom', async ({ roomId, userName }, callback) => {
    if (!roomId || !userName) {
      return callback?.({
        success: false,
        error: '房號和用戶名不能為空'
      });
    }

    try {
      console.log(`用戶 ${userName} (${socket.id}) 嘗試加入房間 ${roomId}`);

      let room = rooms[roomId];

      // 如果房間不存在於內存，嘗試從Firebase獲取
      if (!room && firebaseOnline) {
        try {
          console.log(`嘗試從 Firebase 獲取房間 ${roomId}`);
          const roomRef = ref(`buddiesRooms/${roomId}`);
          const snap = await get(roomRef);

          if (snap.exists()) {
            const roomData = snap.val();

            // 檢查房間是否已標記為刪除
            if (roomData.meta && roomData.meta.isDeleted) {
              console.log(`房間 ${roomId} 已被標記為刪除，拒絕加入`);
              return callback?.({
                success: false,
                error: '此房間已關閉，請創建新房間'
              });
            }

            rooms[roomId] = {
              host: roomData.hostSocket || null,
              members: roomData.members || {},
              answers: roomData.answers || {},
              votes: roomData.votes || {},
              stage: roomData.status || 'waiting',
              createdAt: roomData.createdAt || Date.now(),
              lastActive: Date.now() // 更新最後活動時間
            };
            room = rooms[roomId];
            console.log(`成功從 Firebase 獲取房間 ${roomId}`);
          } else {
            console.log(`Firebase 中未找到房間 ${roomId}`);
          }
        } catch (firebaseError) {
          console.error(`從 Firebase 獲取房間 ${roomId} 失敗:`, firebaseError);
          // 不中斷操作，繼續檢查內存中是否存在該房間
        }
      }

      // 如果房間仍然不存在，表示它可能不存在或Firebase離線
      if (!room) {
        console.log(`房間 ${roomId} 不存在，中止加入操作`);
        return callback?.({
          success: false,
          error: '房間不存在或無法訪問'
        });
      }

      // 更新房間最後活動時間
      room.lastActive = Date.now();

      // 檢查當前房間是否已有主持人，如果沒有則將此用戶設為主持人
      let isHost = false;
      if (!room.host || Object.keys(room.members).length === 0) {
        room.host = socket.id;
        isHost = true;
        console.log(`房間 ${roomId} 的主持人設置為 ${userName} (${socket.id})`);
      }

      // 加入房間
      socket.join(roomId);
      const sanitizedName = sanitizeName(userName, socket.id);
      room.members[socket.id] = {
        id: socket.id,
        name: sanitizedName,
        isHost: isHost,
        joinedAt: Date.now()
      };

      console.log(`用戶 ${sanitizedName} 成功加入房間 ${roomId}`);

      // 如果 Firebase 在線，保存成員信息
      if (firebaseOnline) {
        try {
          // 更新房間活動時間
          const roomRef = ref(`buddiesRooms/${roomId}`);
          await update(roomRef, {
            lastActive: serverTimestamp()
          });

          // 保存成員資訊
          const memberRef = ref(`buddiesRooms/${roomId}/members/${socket.id}`);
          await set(memberRef, {
            id: socket.id,
            name: sanitizedName,
            isHost: isHost,
            joinedAt: serverTimestamp()
          });

          // 如果是新的房主，還需要更新房間的主持人信息
          if (isHost) {
            await update(roomRef, {
              hostSocket: socket.id,
              hostName: sanitizedName,
              updatedAt: serverTimestamp()
            });
          }

          // 記錄加入活動到分析日誌
          const analyticsRef = ref(`analyticsLogs/rooms/${roomId}/members/${socket.id}`);
          await set(analyticsRef, {
            name: sanitizedName,
            isHost: isHost,
            joinedAt: serverTimestamp(),
            meta: {
              userAgent: socket.handshake.headers['user-agent'] || 'unknown',
              ip: socket.handshake.address || 'unknown'
            }
          });

          console.log(`成員 ${sanitizedName} 已保存到 Firebase 房間 ${roomId}`);
        } catch (firebaseError) {
          console.error(`保存成員 ${sanitizedName} 到 Firebase 房間 ${roomId} 失敗:`, firebaseError);
          // 繼續處理，使用內存模式
          console.log(`將僅使用內存模式繼續操作`);
        }
      }

      // 返回成功結果，包含是否為房主的信息
      if (typeof callback === 'function') {
        callback({
          success: true,
          isHost: isHost
        });
      }

      // 通知房間成員
      emitUserList(roomId);
    } catch (error) {
      console.error(`加入房間 ${roomId} 錯誤:`, error);
      if (typeof callback === 'function') {
        callback({
          success: false,
          error: '加入房間失敗: ' + error.message
        });
      }
    }
  });

  // 定期清理空房間 (每分鐘檢查一次)
  setInterval(async () => {
    try {
      const currentTime = Date.now();
      const twentyMinutes = 20 * 60 * 1000; // 20分鐘的毫秒數

      // 1. 檢查內存中的房間
      for (const [roomId, room] of Object.entries(rooms)) {
        // 如果房間沒有成員或空置超過20分鐘
        if (!room.members || Object.keys(room.members).length === 0) {
          const emptyTime = currentTime - (room.lastActive || room.createdAt);
          if (emptyTime > twentyMinutes) {
            console.log(`房間 ${roomId} 已空置超過20分鐘，準備刪除...`);

            // 如果 Firebase 在線，標記房間為已刪除
            if (firebaseOnline) {
              try {
                // 1. 標記房間為已刪除
                const roomRef = ref(`buddiesRooms/${roomId}/meta`);
                await update(roomRef, {
                  isDeleted: true,
                  deletedAt: serverTimestamp(),
                  reason: 'inactive_20_minutes'
                });

                // 2. 記錄房間刪除事件到分析日誌
                const analyticsRef = ref(`analyticsLogs/rooms/${roomId}/events/deletion`);
                await set(analyticsRef, {
                  timestamp: serverTimestamp(),
                  reason: 'inactive_20_minutes',
                  membersCount: Object.keys(room.members || {}).length,
                  emptySince: room.lastActive || room.createdAt
                });

                console.log(`房間 ${roomId} 已在 Firebase 標記為已刪除`);
              } catch (error) {
                console.error(`標記房間 ${roomId} 為已刪除失敗:`, error);
              }
            }

            // 從內存中刪除房間
            delete rooms[roomId];
            console.log(`房間 ${roomId} 已從內存中刪除`);
          }
        }
      }

      // 2. 如果 Firebase 在線，檢查 Firebase 中的房間
      if (firebaseOnline) {
        try {
          const roomsRef = ref('buddiesRooms');
          const snapshot = await get(roomsRef);

          if (snapshot.exists()) {
            const roomsData = snapshot.val();

            for (const [roomId, data] of Object.entries(roomsData)) {
              // 跳過已標記為刪除的房間
              if (data.meta && data.meta.isDeleted) continue;

              // 檢查房間是否已經空置一段時間
              const lastActiveTime = data.lastActive ? new Date(data.lastActive).getTime() :
                data.createdAt ? new Date(data.createdAt).getTime() : 0;

              const emptyTime = currentTime - lastActiveTime;
              const noMembers = !data.members || Object.keys(data.members).length === 0;

              if (noMembers && emptyTime > twentyMinutes) {
                console.log(`Firebase 中的房間 ${roomId} 已空置超過20分鐘，標記為已刪除...`);

                // 標記房間為已刪除
                const roomRef = ref(`buddiesRooms/${roomId}/meta`);
                await update(roomRef, {
                  isDeleted: true,
                  deletedAt: serverTimestamp(),
                  reason: 'firebase_cleanup_inactive_20_minutes'
                });

                // 記錄房間刪除事件到分析日誌
                const analyticsRef = ref(`analyticsLogs/rooms/${roomId}/events/deletion`);
                await set(analyticsRef, {
                  timestamp: serverTimestamp(),
                  reason: 'firebase_cleanup_inactive_20_minutes',
                  membersCount: data.members ? Object.keys(data.members).length : 0,
                  emptySince: lastActiveTime
                });

                console.log(`Firebase 中的房間 ${roomId} 已標記為已刪除`);
              }
            }
          }
        } catch (error) {
          console.error('檢查 Firebase 中的空房間失敗:', error);
        }
      }
    } catch (error) {
      console.error('定期清理房間任務出錯:', error);
    }
  }, 60000); // 每分鐘檢查一次

  // 斷開連接處理 - 修改後的版本
  socket.on('disconnect', () => {
    console.log('🔴 使用者離線:', socket.id);

    // 從所有房間中移除用戶
    for (const [roomId, room] of Object.entries(rooms)) {
      if (room.members && room.members[socket.id]) {
        const wasHost = room.members[socket.id].isHost;
        const userName = room.members[socket.id].name || 'unknown';

        // 移除成員
        delete room.members[socket.id];

        // 更新房間最後活動時間
        room.lastActive = Date.now();

        // 如果是房主離開，選擇一個新的房主
        if (wasHost && room.host === socket.id) {
          // 獲取剩餘成員
          const remainingMembers = Object.entries(room.members);
          if (remainingMembers.length > 0) {
            // 選擇第一個剩餘成員作為新房主
            const [newHostId, newHost] = remainingMembers[0];
            room.host = newHostId;
            room.members[newHostId].isHost = true;

            console.log(`房間 ${roomId} 的新主持人設置為 ${room.members[newHostId].name} (${newHostId})`);

            // 如果 Firebase 在線，更新新房主信息
            if (firebaseOnline) {
              const roomRef = ref(`buddiesRooms/${roomId}`);
              update(roomRef, {
                hostSocket: newHostId,
                hostName: room.members[newHostId].name,
                updatedAt: serverTimestamp()
              }).catch(err => console.error(`更新新房主失敗:`, err));

              const memberRef = ref(`buddiesRooms/${roomId}/members/${newHostId}`);
              update(memberRef, {
                isHost: true
              }).catch(err => console.error(`更新成員房主狀態失敗:`, err));
            }
          } else {
            room.host = null;
          }
        }

        // 如果 Firebase 在線，同步到 Firebase
        if (firebaseOnline) {
          // 更新房間最後活動時間
          const roomRef = ref(`buddiesRooms/${roomId}`);
          update(roomRef, {
            lastActive: serverTimestamp()
          }).catch(err => console.error(`更新房間時間失敗:`, err));

          // 移除成員
          const memberRef = ref(`buddiesRooms/${roomId}/members/${socket.id}`);
          set(memberRef, null)
            .catch(error => console.error(`刪除成員錯誤:`, error));

          // 記錄用戶離開事件
          const leaveEvent = {
            userId: socket.id,
            userName: userName,
            timestamp: serverTimestamp(),
            wasHost: wasHost
          };

          const eventRef = ref(`analyticsLogs/rooms/${roomId}/events/userLeave/${Date.now()}`);
          set(eventRef, leaveEvent)
            .catch(error => console.error(`記錄用戶離開事件失敗:`, error));
        }

        // 通知房間成員
        emitUserList(roomId);

        // 如果房間空了，記錄空房間時間
        if (Object.keys(room.members).length === 0) {
          room.emptyTime = Date.now();

          if (firebaseOnline) {
            const roomRef = ref(`buddiesRooms/${roomId}`);
            update(roomRef, {
              emptyTime: serverTimestamp(),
              lastActive: serverTimestamp()
            }).catch(error => console.error(`設置房間空狀態錯誤:`, error));

            // 記錄房間為空事件
            const emptyEvent = {
              timestamp: serverTimestamp(),
              lastMemberId: socket.id,
              lastMemberName: userName
            };

            const eventRef = ref(`analyticsLogs/rooms/${roomId}/events/becameEmpty`);
            set(eventRef, emptyEvent)
              .catch(error => console.error(`記錄房間空事件失敗:`, error));
          }
        }
      }
    }
  });

  // 開始問答環節
  socket.on('startQuestions', async ({ roomId }, callback) => {
    try {
      const room = rooms[roomId];
      if (!room) {
        if (typeof callback === 'function') {
          callback({ success: false, error: '房間不存在' });
        }
        return;
      }

      // 更新房間狀態
      room.stage = 'questions';

      // 如果 Firebase 在線，更新狀態
      if (firebaseOnline) {
        try {
          const roomRef = ref(`buddiesRooms/${roomId}`);
          await update(roomRef, {
            status: 'questions',
            updatedAt: serverTimestamp()
          });
        } catch (firebaseError) {
          console.error("更新房間狀態到 Firebase 失敗:", firebaseError);
        }
      }

      // 通知所有房間成員開始問答
      io.to(roomId).emit('startQuestions');

      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (error) {
      console.error("開始問答錯誤:", error);
      if (typeof callback === 'function') {
        callback({ success: false, error: '開始問答失敗' });
      }
    }
  });

  // 提交答案
  socket.on('submitAnswers', async ({ roomId, answers, questionTexts, questionSources, index }) => {
    try {
      const room = rooms[roomId];
      if (!room) {
        if (typeof callback === 'function') {
          callback({ success: false, error: '房間不存在' });
        }
        return;
      }

      // 保存結構化答案到內存 (支援問題文本和問題來源)
      // 檢查是否提供了問題文本和來源
      if (Array.isArray(answers)) {
        if (Array.isArray(questionTexts) || Array.isArray(questionSources)) {
          // 如果提供了結構化資料，使用新格式儲存
          room.answers[socket.id] = {
            answers: answers,
            questionTexts: questionTexts || [],
            questionSources: questionSources || []
          };

          // 如果沒有提供問題來源但有問題文本，嘗試判斷問題類型
          if (!questionSources && questionTexts && questionTexts.length > 0) {
            // 使用 enhancedLogic.isBasicQuestion 判斷
            room.answers[socket.id].questionSources = questionTexts.map(
              text => enhancedLogic.isBasicQuestion(text) ? 'basic' : 'fun'
            );
          }
        } else {
          // 兼容性處理：無結構化資料時保持舊格式
          room.answers[socket.id] = answers;
        }
      } else {
        // 答案格式錯誤，記錄錯誤日誌
        console.error("提交答案格式錯誤:", answers);
        if (typeof callback === 'function') {
          callback({ success: false, error: '答案格式錯誤' });
        }
        return;
      }

      // 如果 Firebase 在線，保存到 Firebase
      if (firebaseOnline) {
        try {
          const answersRef = ref(`buddiesRooms/${roomId}/answers/${socket.id}`);
          await set(answersRef, room.answers[socket.id]);
        } catch (firebaseError) {
          console.error("保存答案到 Firebase 失敗:", firebaseError);
        }
      }

      if (typeof callback === 'function') {
        callback({ success: true });
      }

      // 檢查是否所有會員都已回答完畢
      const memberCount = Object.keys(room.members).length;
      const answerCount = Object.keys(room.answers).length;

      if (answerCount >= memberCount) {
        try {
          // 獲取餐廳數據
          const restaurants = await getRestaurants();

          if (restaurants.length > 0) {
            // 檢查 recommendForGroup 函數是否存在
            if (typeof enhancedLogic.recommendForGroup !== 'function') {
              console.error('recommendForGroup 函數不存在，請檢查導入方式');
              io.to(roomId).emit('recommendError', { error: '推薦系統暫時無法使用，請稍後再試' });
              return;
            }

            // 使用優化的推薦邏輯
            const recommendations = enhancedLogic.recommendForGroup(
              room.answers,
              restaurants,
              {
                basicQuestionsCount: 5,
                debug: process.env.NODE_ENV === 'development',
                basicQuestions: room.basicQuestions || []
              }
            );

            // 保存推薦結果
            await saveRecommendationsToFirebase(roomId, recommendations);

            // 更新房間狀態
            room.stage = 'vote';

            // 發送推薦結果給所有房間成員
            io.to(roomId).emit('groupRecommendations', recommendations);
          } else {
            throw new Error('未獲取到餐廳數據');
          }
        } catch (recError) {
          console.error("生成推薦結果錯誤:", recError);
          // 通知用戶推薦失敗
          io.to(roomId).emit('recommendError', { error: '生成推薦失敗，請重試' });
        }
      }
    } catch (error) {
      console.error("提交答案錯誤:", error);
      if (typeof callback === 'function') {
        callback({ success: false, error: '提交答案失敗' });
      }
    }
  });

  // 最終選擇餐廳
  socket.on('finalizeRestaurant', async ({ roomId, restaurantId, restaurant }, callback) => {
    try {
      const room = rooms[roomId];
      if (!room) {
        if (typeof callback === 'function') {
          callback({ success: false, error: '房間不存在' });
        }
        return;
      }

      // 更新內存中的最終選擇
      room.finalRestaurant = {
        id: restaurantId,
        ...(restaurant || {}),
        selectedAt: Date.now(),
        selectedBy: socket.id
      };

      // 更新內存中的房間狀態
      room.stage = 'completed';

      // 如果 Firebase 在線，更新 Firebase
      if (firebaseOnline) {
        try {
          const finalRef = ref(`buddiesRooms/${roomId}/finalRestaurant`);
          await set(finalRef, {
            id: restaurantId,
            ...(restaurant || {}),
            selectedAt: serverTimestamp(),
            selectedBy: socket.id
          });

          // 更新房間狀態
          const roomRef = ref(`buddiesRooms/${roomId}`);
          await update(roomRef, {
            status: 'completed',
            updatedAt: serverTimestamp()
          });
        } catch (firebaseError) {
          console.error("更新最終選擇到 Firebase 失敗:", firebaseError);
        }
      }

      // 通知所有成員最終選擇
      io.to(roomId).emit('restaurantFinalized', { restaurantId, restaurant });

      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (error) {
      console.error("最終選擇錯誤:", error);
      if (typeof callback === 'function') {
        callback({ success: false, error: '最終選擇失敗' });
      }
    }
  });

  // 獲取多人模式推薦餐廳
  socket.on('getBuddiesRecommendations', async ({ roomId }, callback) => {
    try {
      // 首先嘗試從內存獲取
      let recommendations = [];
      if (rooms[roomId] && rooms[roomId].recommendations) {
        recommendations = rooms[roomId].recommendations;
      }
      // 如果內存中沒有，且 Firebase 在線，從 Firebase 獲取
      else if (firebaseOnline) {
        try {
          const recommendationsRef = ref(`buddiesRooms/${roomId}/recommendations`);
          const snapshot = await get(recommendationsRef);

          if (snapshot.exists()) {
            const data = snapshot.val();

            if (Array.isArray(data)) {
              recommendations = data;
            } else if (data.restaurants && Array.isArray(data.restaurants)) {
              recommendations = data.restaurants;
            }

            // 保存到內存中
            if (!rooms[roomId]) {
              rooms[roomId] = {
                recommendations: recommendations
              };
            } else {
              rooms[roomId].recommendations = recommendations;
            }
          }
        } catch (firebaseError) {
          console.error("從 Firebase 獲取推薦結果失敗:", firebaseError);
        }
      }

      if (typeof callback === 'function') {
        callback({
          success: recommendations.length > 0,
          recommendations,
          error: recommendations.length === 0 ? '沒有推薦結果' : null
        });
      }
    } catch (error) {
      console.error("獲取推薦結果錯誤:", error);
      if (typeof callback === 'function') {
        callback({ success: false, error: '獲取推薦結果失敗', recommendations: [] });
      }
    }
  });

  // 連接斷開
  socket.on('disconnect', () => {
    console.log('🔴 使用者離線:', socket.id);

    // 從所有房間中移除用戶
    for (const [roomId, room] of Object.entries(rooms)) {
      if (room.members && room.members[socket.id]) {
        // 移除成員
        delete room.members[socket.id];

        // 如果 Firebase 在線，同步到 Firebase
        if (firebaseOnline) {
          const memberRef = ref(`buddiesRooms/${roomId}/members/${socket.id}`);
          set(memberRef, null)
            .catch(error => console.error(`刪除成員錯誤:`, error));
        }

        // 通知房間成員
        emitUserList(roomId);

        // 如果房間空了，設置過期時間
        if (Object.keys(room.members).length === 0) {
          if (firebaseOnline) {
            const metaRef = ref(`buddiesRooms/${roomId}/meta`);
            update(metaRef, {
              empty: serverTimestamp(),
              lastActive: serverTimestamp()
            }).catch(error => console.error(`設置房間空狀態錯誤:`, error));
          }

          // 從內存中刪除房間
          setTimeout(() => {
            if (rooms[roomId] && Object.keys(rooms[roomId].members).length === 0) {
              delete rooms[roomId];
              console.log(`已從內存中清理空房間: ${roomId}`);
            }
          }, 30 * 60 * 1000); // 30分鐘後清理
        }
      }
    }
  });

  // 處理連接錯誤
  socket.on('error', (error) => {
    console.error('Socket 連接錯誤:', error);
  });
});

// 健康檢查API
app.get('/ping', (req, res) => {
  res.send('pong');
});

// 獲取系統狀態API
app.get('/status', (req, res) => {
  res.json({
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      roomCount: Object.keys(rooms).length
    },
    firebase: {
      connected: firebaseOnline,
      mode: firebaseOnline ? 'online' : 'offline'
    },
    timestamp: new Date().toISOString()
  });
});

// 獲取房間狀態API
app.get('/api/room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    // 首先檢查內存
    if (rooms[roomId]) {
      return res.json({
        exists: true,
        source: 'memory',
        data: {
          ...rooms[roomId],
          // 不返回敏感數據
          answers: undefined,
          memberCount: Object.keys(rooms[roomId].members || {}).length
        }
      });
    }

    // 如果內存中沒有且 Firebase 在線，查詢 Firebase
    if (firebaseOnline) {
      const roomRef = ref(`buddiesRooms/${roomId}`);
      const snapshot = await get(roomRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        // 將數據緩存到內存中
        rooms[roomId] = {
          host: data.hostSocket || null,
          members: data.members || {},
          stage: data.status || 'waiting',
          createdAt: data.createdAt || Date.now()
        };

        return res.json({
          exists: true,
          source: 'firebase',
          data: {
            status: data.status,
            hostName: data.hostName,
            createdAt: data.createdAt,
            memberCount: data.members ? Object.keys(data.members).length : 0
          }
        });
      }
    }

    return res.json({
      exists: false,
      firebaseStatus: firebaseOnline ? 'online' : 'offline'
    });
  } catch (error) {
    console.error('房間查詢錯誤:', error);
    res.status(500).json({ error: '伺服器錯誤', message: error.message });
  }
});

// 清理過期房間的定時任務
setInterval(async () => {
  if (!firebaseOnline) return; // 如果 Firebase 離線，跳過清理

  try {
    // 檢查Firebase中標記為空的房間
    const roomsRef = ref('buddiesRooms');
    const emptySnapshot = await get(roomsRef);

    if (emptySnapshot.exists()) {
      const roomsData = emptySnapshot.val();
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000; // 24小時

      for (const [roomId, room] of Object.entries(roomsData)) {
        // 如果房間被標記為空並且超過24小時
        if (room.meta && room.meta.empty) {
          const emptyTime = new Date(room.meta.empty).getTime();
          if (!isNaN(emptyTime) && now - emptyTime > oneDay) {
            // 刪除過期房間
            const expiredRoomRef = ref(`buddiesRooms/${roomId}`);
            await set(expiredRoomRef, null);
            console.log(`已清理過期房間: ${roomId}`);

            // 如果內存中也有，一併清理
            if (rooms[roomId]) {
              delete rooms[roomId];
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('清理過期房間錯誤:', error);
  }
}, 3600000); // 每小時執行一次

// 捕獲未處理的異常
process.on('uncaughtException', (error) => {
  console.error('未捕獲的異常:', error);
  // 不退出程序，嘗試保持服務運行
});

// 捕獲未處理的Promise拒絕
process.on('unhandledRejection', (reason, promise) => {
  console.error('未處理的Promise拒絕:', reason);
});

// 導出伺服器實例（用於測試）
module.exports = { app, server, io };