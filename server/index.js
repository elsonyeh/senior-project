/* eslint-env node */
// index.js - 轉換為 CommonJS 格式
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const process = require('process');
const firebase = require('./firebase.js');
const { rtdb, firestore, admin, isConnected, isOfflineMode } = firebase;

// 初始化 dotenv
dotenv.config();

// 創建數據庫操作函數
const database = rtdb;
const serverTimestamp = () => admin.database.ServerValue.TIMESTAMP;
const ref = (path) => database.ref(path);
const set = (reference, data) => reference.set(data);
const get = (reference) => reference.once('value');
const update = (reference, data) => reference.update(data);

// 確保 enhancedLogic 正確導入
let enhancedLogic;
try {
  enhancedLogic = require('./logic/enhancedRecommendLogicBackend.js');
  console.log('enhancedLogic 導入成功，可用函數：',
    Object.keys(enhancedLogic).filter(key => typeof enhancedLogic[key] === 'function').join(', '));
} catch (error) {
  console.error('enhancedLogic 導入失敗:', error);
  // 提供一個備用的基本推薦邏輯
  enhancedLogic = {
    recommendForGroup: function (answers, restaurants) {
      console.log('使用備用推薦邏輯，原因: 原始邏輯導入失敗');
      // 簡單返回前10個餐廳作為備用
      return restaurants.slice(0, 10);
    },
    isBasicQuestion: function (text) {
      return text && (
        text.includes("想吃奢華點還是平價") ||
        text.includes("想吃正餐還是想喝飲料") ||
        text.includes("吃一點還是吃飽") ||
        text.includes("附近吃還是遠一點") ||
        text.includes("想吃辣的還是不辣") ||
        text.includes("今天是一個人還是有朋友")
      );
    }
  };
}

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
}, 600000); // 每10分鐘檢查一次

// 從Firestore獲取餐廳數據
function getRestaurants() {
  return new Promise(async (resolve, reject) => {
    try {
      if (!firestore) {
        console.error('Firestore 未初始化');
        resolve([]);
        return;
      }

      const restaurantsCollection = firestore.collection('restaurants');
      restaurantsCollection.get()
        .then(snapshot => {
          if (snapshot.empty) {
            console.warn('Firestore 中沒有餐廳數據');
            resolve([]);
            return;
          }

          // 轉換數據格式
          const restaurants = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          // 添加格式檢查
          if (restaurants.length > 0) {
            console.log(`成功從 Firestore 獲取 ${restaurants.length} 個餐廳數據`);

            // 檢查第一家餐廳的數據格式
            const firstRestaurant = restaurants[0];
            const requiredFields = ['id', 'name'];
            const missingFields = requiredFields.filter(field => !firstRestaurant[field]);

            if (missingFields.length > 0) {
              console.warn(`警告: 餐廳數據缺少必要字段: ${missingFields.join(', ')}`);
            }
          }

          resolve(restaurants);
        })
        .catch(error => {
          console.error('獲取餐廳數據失敗:', error);
          resolve([]);
        });
    } catch (error) {
      console.error('獲取餐廳數據失敗:', error);
      resolve([]);
    }
  });
}

// 保存推薦結果到Firebase
function saveRecommendationsToFirebase(roomId, recommendations) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!roomId || !recommendations) {
        console.error('保存推薦結果失敗: 參數不完整');
        resolve(false);
        return;
      }

      // 確保推薦結果是數組且不為空
      if (!Array.isArray(recommendations) || recommendations.length === 0) {
        console.error('推薦結果格式無效');
        resolve(false);
        return;
      }

      // 同時保存到內存和 Firebase
      if (rooms[roomId]) {
        rooms[roomId].recommendations = recommendations;
        // 更新房間狀態為已有推薦 - 重要修改
        rooms[roomId].stage = 'vote';
        rooms[roomId].status = 'recommendation_ready';
      }

      if (firebaseOnline) {
        const recommendationsRef = ref(`buddiesRooms/${roomId}/recommendations`);
        set(recommendationsRef, {
          timestamp: serverTimestamp(),
          restaurants: recommendations
        })
          .then(() => {
            // 更新房間狀態
            const roomRef = ref(`buddiesRooms/${roomId}`);
            return update(roomRef, {
              status: 'vote',
              updatedAt: serverTimestamp()
            });
          })
          .then(() => {
            console.log(`[${roomId}] 推薦結果保存到Firebase成功`);
            resolve(true);
          })
          .catch(error => {
            console.error('保存推薦結果失敗:', error);
            resolve(false);
          });
      } else {
        console.warn(`Firebase 離線中，推薦結果只保存在內存中 (房間 ${roomId})`);
        resolve(true);
      }
    } catch (error) {
      console.error('保存推薦結果失敗:', error);
      resolve(false);
    }
  });
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

// 檢查答案格式函數 - 重要: 確保答案格式正確
function validateAnswers(answers, questionTexts, questionSources) {
  if (!Array.isArray(answers)) {
    return { valid: false, error: '答案不是數組' };
  }

  if (answers.length === 0) {
    return { valid: false, error: '答案數組為空' };
  }

  // 檢查答案每項是否為字符串
  const invalidItems = answers.filter(ans => typeof ans !== 'string' && ans !== null);
  if (invalidItems.length > 0) {
    return {
      valid: false,
      error: `答案數組包含非字符串項: ${invalidItems.map(i => typeof i).join(', ')}`
    };
  }

  // 如果提供了問題文本，檢查長度是否匹配
  if (Array.isArray(questionTexts) && questionTexts.length !== answers.length) {
    return {
      valid: false,
      error: `答案數組(${answers.length})與問題文本數組(${questionTexts.length})長度不匹配`
    };
  }

  // 如果提供了問題來源，檢查長度是否匹配
  if (Array.isArray(questionSources) && questionSources.length !== answers.length) {
    return {
      valid: false,
      error: `答案數組(${answers.length})與問題來源數組(${questionSources.length})長度不匹配`
    };
  }

  return { valid: true };
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
  socket.on('createRoom', function ({ userName }, callback) {
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
        status: 'waiting', // 添加明確的狀態字段
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
          set(roomRef, {
            hostSocket: socket.id,
            hostName: sanitizedName,
            createdAt: serverTimestamp(),
            lastActive: serverTimestamp(), // 添加最後活動時間
            status: 'waiting',
            meta: {
              isDeleted: false // 初始標記為未刪除
            }
          })
            .then(() => {
              // 保存成員信息
              const memberRef = ref(`buddiesRooms/${roomId}/members/${socket.id}`);
              return set(memberRef, {
                id: socket.id,
                name: sanitizedName,
                isHost: true,
                joinedAt: serverTimestamp()
              });
            })
            .then(() => {
              // 同時將房間信息保存到分析集合中
              const analyticsRef = ref(`analyticsLogs/rooms/${roomId}`);
              return set(analyticsRef, {
                hostSocket: socket.id,
                hostName: sanitizedName,
                createdAt: serverTimestamp(),
                status: 'created',
                meta: {
                  userAgent: socket.handshake.headers['user-agent'] || 'unknown',
                  ip: socket.handshake.address || 'unknown'
                }
              });
            })
            .then(() => {
              console.log(`房間 ${roomId} 已保存到 Firebase`);
            })
            .catch(firebaseError => {
              console.error(`Firebase 保存房間 ${roomId} 失敗:`, firebaseError);
              // 即使 Firebase 保存失敗，內存中的數據仍然有效
            });
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
  socket.on('joinRoom', function ({ roomId, userName }, callback) {
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
        const roomRef = ref(`buddiesRooms/${roomId}`);

        get(roomRef)
          .then(snap => {
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
                status: roomData.status || 'waiting',
                createdAt: roomData.createdAt || Date.now(),
                lastActive: Date.now() // 更新最後活動時間
              };
              room = rooms[roomId];
              console.log(`成功從 Firebase 獲取房間 ${roomId}`);

              // 繼續加入流程
              finishJoining();
            } else {
              console.log(`Firebase 中未找到房間 ${roomId}`);
              return callback?.({
                success: false,
                error: '房間不存在或無法訪問'
              });
            }
          })
          .catch(firebaseError => {
            console.error(`從 Firebase 獲取房間 ${roomId} 失敗:`, firebaseError);
            // 不中斷操作，繼續檢查內存中是否存在該房間
            if (!room) {
              console.log(`房間 ${roomId} 不存在，中止加入操作`);
              return callback?.({
                success: false,
                error: '房間不存在或無法訪問'
              });
            } else {
              finishJoining();
            }
          });
      } else if (!room) {
        // 如果房間仍然不存在，表示它可能不存在或Firebase離線
        console.log(`房間 ${roomId} 不存在，中止加入操作`);
        return callback?.({
          success: false,
          error: '房間不存在或無法訪問'
        });
      } else {
        // 房間在內存中存在，繼續加入流程
        finishJoining();
      }

      function finishJoining() {
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
          // 更新房間活動時間
          const roomRef = ref(`buddiesRooms/${roomId}`);
          update(roomRef, {
            lastActive: serverTimestamp()
          })
            .then(() => {
              // 保存成員資訊
              const memberRef = ref(`buddiesRooms/${roomId}/members/${socket.id}`);
              return set(memberRef, {
                id: socket.id,
                name: sanitizedName,
                isHost: isHost,
                joinedAt: serverTimestamp()
              });
            })
            .then(() => {
              // 如果是新的房主，還需要更新房間的主持人信息
              if (isHost) {
                return update(roomRef, {
                  hostSocket: socket.id,
                  hostName: sanitizedName,
                  updatedAt: serverTimestamp()
                });
              }
              return Promise.resolve();
            })
            .then(() => {
              // 記錄加入活動到分析日誌
              const analyticsRef = ref(`analyticsLogs/rooms/${roomId}/members/${socket.id}`);
              return set(analyticsRef, {
                name: sanitizedName,
                isHost: isHost,
                joinedAt: serverTimestamp(),
                meta: {
                  userAgent: socket.handshake.headers['user-agent'] || 'unknown',
                  ip: socket.handshake.address || 'unknown'
                }
              });
            })
            .then(() => {
              console.log(`成員 ${sanitizedName} 已保存到 Firebase 房間 ${roomId}`);
            })
            .catch(firebaseError => {
              console.error(`保存成員 ${sanitizedName} 到 Firebase 房間 ${roomId} 失敗:`, firebaseError);
              // 繼續處理，使用內存模式
              console.log(`將僅使用內存模式繼續操作`);
            });
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
      }
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
  setInterval(function () {
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
              // 1. 標記房間為已刪除
              const roomRef = ref(`buddiesRooms/${roomId}/meta`);
              update(roomRef, {
                isDeleted: true,
                deletedAt: serverTimestamp(),
                reason: 'inactive_20_minutes'
              })
                .then(() => {
                  // 2. 記錄房間刪除事件到分析日誌
                  const analyticsRef = ref(`analyticsLogs/rooms/${roomId}/events/deletion`);
                  return set(analyticsRef, {
                    timestamp: serverTimestamp(),
                    reason: 'inactive_20_minutes',
                    membersCount: Object.keys(room.members || {}).length,
                    emptySince: room.lastActive || room.createdAt
                  });
                })
                .then(() => {
                  console.log(`房間 ${roomId} 已在 Firebase 標記為已刪除`);
                })
                .catch(error => {
                  console.error(`標記房間 ${roomId} 為已刪除失敗:`, error);
                });
            }

            // 從內存中刪除房間
            delete rooms[roomId];
            console.log(`房間 ${roomId} 已從內存中刪除`);
          }
        }
      }

      // 2. 如果 Firebase 在線，檢查 Firebase 中的房間
      if (firebaseOnline) {
        const roomsRef = ref('buddiesRooms');

        get(roomsRef)
          .then(snapshot => {
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
                  update(roomRef, {
                    isDeleted: true,
                    deletedAt: serverTimestamp(),
                    reason: 'firebase_cleanup_inactive_20_minutes'
                  })
                    .then(() => {
                      // 記錄房間刪除事件到分析日誌
                      const analyticsRef = ref(`analyticsLogs/rooms/${roomId}/events/deletion`);
                      return set(analyticsRef, {
                        timestamp: serverTimestamp(),
                        reason: 'firebase_cleanup_inactive_20_minutes',
                        membersCount: data.members ? Object.keys(data.members).length : 0,
                        emptySince: lastActiveTime
                      });
                    })
                    .then(() => {
                      console.log(`Firebase 中的房間 ${roomId} 已標記為已刪除`);
                    })
                    .catch(error => {
                      console.error(`標記 Firebase 房間 ${roomId} 失敗:`, error);
                    });
                }
              }
            }
          })
          .catch(error => {
            console.error('檢查 Firebase 中的空房間失敗:', error);
          });
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
  socket.on('startQuestions', function ({ roomId }, callback) {
    try {
      const room = rooms[roomId];
      if (!room) {
        if (typeof callback === 'function') {
          callback({ success: false, error: '房間不存在' });
        }
        return callback?.({
          success: false,
          error: '推薦正在生成中，請稍候'
        });
      }

      // 更新房間狀態
      room.stage = 'questions';
      room.status = 'questions';

      // 如果 Firebase 在線，更新狀態
      if (firebaseOnline) {
        const roomRef = ref(`buddiesRooms/${roomId}`);
        update(roomRef, {
          status: 'questions',
          updatedAt: serverTimestamp()
        })
          .then(() => {
            console.log(`房間 ${roomId} 狀態已更新為問答環節`);
          })
          .catch(firebaseError => {
            console.error("更新房間狀態到 Firebase 失敗:", firebaseError);
          });
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

  // 提交答案 - 完全修改版本，修復推薦生成問題
  socket.on("submitAnswers", function ({ roomId, answers, questionTexts, questionSources, index, basicQuestions }, callback) {
    try {
      console.log(`[${roomId}] 收到答案提交 - 用戶 ${socket.id}，題目 ${index}/${answers?.length || 0}`);

      const room = rooms[roomId];
      if (!room) {
        console.error(`[${roomId}] 房間不存在!`);
        if (typeof callback === 'function') callback({ success: false, error: '房間不存在' });
        return;
      }

      // 檢查房間狀態 - 關鍵修改：避免重複提交和推薦生成
      if (room.status === 'generating_recommendations' || room.status === 'recommendation_ready' || room.status === 'vote') {
        console.log(`[${roomId}] 房間已在生成推薦或已有推薦結果，忽略答案提交`);

        // 如果房間已有推薦結果，直接返回這些結果
        if (room.recommendations && Array.isArray(room.recommendations) && room.recommendations.length > 0) {
          if (typeof callback === 'function') {
            callback({
              success: true,
              message: '已有推薦結果',
              recommendations: room.recommendations
            });
          }

          // 再次發送推薦結果，確保客戶端收到
          io.to(roomId).emit('groupRecommendations', room.recommendations);
        } else {
          if (typeof callback === 'function') {
            callback({ success: false, error: '推薦正在生成中，請稍候' });
          }
        }
        return;
      }

      // 驗證答案格式 - 添加格式檢查
      const validation = validateAnswers(answers, questionTexts, questionSources);
      if (!validation.valid) {
        console.error(`[${roomId}] 答案格式無效:`, validation.error);
        if (typeof callback === 'function') {
          callback({ success: false, error: `答案格式無效: ${validation.error}` });
        }
        return;
      }

      // 保存結構化答案到內存
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
            room.answers[socket.id].questionSources = questionTexts.map(
              text => enhancedLogic.isBasicQuestion(text) ? 'basic' : 'fun'
            );
          }
        } else {
          // 兼容性處理：無結構化資料時保持舊格式
          room.answers[socket.id] = answers;
        }
      } else {
        console.error("提交答案格式錯誤:", answers);
        if (typeof callback === 'function') {
          callback({ success: false, error: '答案格式錯誤' });
        }
        return;
      }

      // 如果提供了 basicQuestions，保存到房間對象中供推薦算法使用
      if (basicQuestions) {
        room.basicQuestions = basicQuestions;
      }

      // 保存當前題目索引，供clientReady事件使用
      room.currentQuestionIndex = index;

      // 如果 Firebase 在線，保存到 Firebase
      if (firebaseOnline) {
        const answersRef = ref(`buddiesRooms/${roomId}/answers/${socket.id}`);
        set(answersRef, room.answers[socket.id])
          .then(() => console.log(`[${roomId}] 用戶 ${socket.id} 的答案已保存到 Firebase`))
          .catch(firebaseError => console.error("保存答案到 Firebase 失敗:", firebaseError));
      }

      if (typeof callback === 'function') {
        callback({ success: true });
      }

      // 檢查是否所有會員都已回答完畢
      const memberCount = Object.keys(room.members || {}).length;
      const answerCount = Object.keys(room.answers || {}).length;

      console.log(`[${roomId}] 答題進度 ${answerCount}/${memberCount}, 當前題目: ${index}`);

      // 獲取所有基本問題和趣味問題的總數（總題數）
      // 重要：從客戶端傳來的 basicQuestions 獲取基礎題數量
      const basicQuestionsCount = room.basicQuestions ? room.basicQuestions.length : 5;
      const funQuestionsCount = 3; // 預設有3個趣味問題
      const totalQuestionsCount = basicQuestionsCount + funQuestionsCount;

      console.log(`[${roomId}] 總題數: ${totalQuestionsCount} (基本: ${basicQuestionsCount}, 趣味: ${funQuestionsCount})`);

      // 重要修改：明確檢查是最後一題，確保索引是數字並嚴格比較
      const currentIndex = parseInt(index, 10);
      const isLastQuestion = currentIndex >= (totalQuestionsCount - 1);

      // 所有成員已提交當前題目的答案
      if (answerCount >= memberCount) {
        console.log(`[${roomId}] 所有成員已提交第 ${index} 題答案`);

        // 如果是最後一題，生成推薦 - 重要邏輯修改
        if (isLastQuestion) {
          console.log(`[${roomId}] 這是最後一題，將生成推薦結果`);

          // 重要：更新房間狀態，避免重複生成
          room.status = 'generating_recommendations';

          // 不發送下一題信號，避免客戶端混淆 - 關鍵修改點
          // 延遲處理推薦結果
          setTimeout(function () {
            getRestaurants()
              .then(restaurants => {
                console.log(`[${roomId}] 獲取到 ${restaurants.length} 家餐廳`);

                if (restaurants.length > 0) {
                  // 添加日誌來顯示答案數據格式，幫助診斷問題
                  const firstUser = Object.keys(room.answers)[0];
                  console.log(`[${roomId}] 用戶答案範例:`,
                    firstUser ? typeof room.answers[firstUser] : '沒有答案');

                  // 在調用 recommendForGroup 前，構建 answerQuestionMap
                  const answerQuestionMap = {};
                  let questionTexts = [];

                  // 從用戶答案中提取問題文本
                  Object.values(room.answers).forEach(userAnswer => {
                    if (userAnswer.questionTexts && userAnswer.questionTexts.length > 0) {
                      questionTexts = userAnswer.questionTexts;
                      return;
                    }
                  });

                  // 構建 answerQuestionMap
                  questionTexts.forEach((text, index) => {
                    answerQuestionMap[index] = text;
                  });

                  // 嘗試不同的推薦生成方式
                  let recommendations;
                  try {
                    console.log(`[${roomId}] 使用 ${basicQuestionsCount} 個基本問題進行推薦`);
                    // 生成推薦 - 結合嚴格匹配與調整權重
                    recommendations = enhancedLogic.recommendForGroup(
                      room.answers,
                      restaurants,
                      {
                        basicQuestionsCount: basicQuestionsCount,
                        debug: process.env.NODE_ENV === 'development',
                        basicQuestions: room.basicQuestions || [],
                        strictBasicMatch: true,  // 保持嚴格匹配開啟
                        minBasicMatchRatio: 0.5, // 要求至少50%的基本問題匹配
                        basicMatchWeight: enhancedLogic.WEIGHT.BASIC_MATCH * 1.5, // 增加基本問題匹配的權重
                        answerQuestionMap: answerQuestionMap // 確保傳遞答案-問題映射
                      }
                    );

                    // 添加調試日誌
                    console.log(`[${roomId}] 推薦函數參數:`, {
                      answerCount: Object.keys(room.answers).length,
                      hasAnswerQuestionMap: Object.keys(answerQuestionMap).length > 0,
                      basicQuestionsCount
                    });

                    console.log(`[${roomId}] 前5家推薦餐廳的分數:`, recommendations.slice(0, 5).map(r => ({
                      name: r.name,
                      score: r.matchScore
                    })));
                  } catch (recError) {
                    console.error(`[${roomId}] 推薦生成錯誤，使用備用方案:`, recError);
                    // 備用方案：直接返回全部餐廳或隨機選擇
                    recommendations = restaurants.slice(0, 20);
                  }

                  // 保存推薦結果到Firebase
                  return saveRecommendationsToFirebase(roomId, recommendations)
                    .then(() => {
                      // 更新房間狀態為推薦就緒
                      room.recommendations = recommendations;
                      room.status = 'recommendation_ready';
                      room.stage = 'vote';

                      // 發送推薦結果事件
                      console.log(`[${roomId}] 準備發送推薦結果，共 ${recommendations.length} 家餐廳`);
                      io.to(roomId).emit('groupRecommendations', recommendations);
                      console.log(`[${roomId}] 已發送推薦結果，共 ${recommendations.length} 家餐廳`);
                    });
                } else {
                  throw new Error('未獲取到餐廳數據');
                }
              })
              .catch(recError => {
                console.error(`[${roomId}] 生成推薦結果錯誤:`, recError);
                // 發送錯誤通知
                io.to(roomId).emit('recommendError', { error: '生成推薦失敗，請重試' });
                // 重置房間狀態，允許重新生成
                room.status = 'questions';
              });
          }, 1000); // 縮短延遲到1秒，確保更快響應
        } else {
          // 如果不是最後一題，發送下一題信號
          const nextIndex = currentIndex + 1;
          console.log(`[${roomId}] 發送下一題信號: nextIndex=${nextIndex}, isLastUser=true`);
          io.to(roomId).emit('nextQuestion', {
            nextIndex: nextIndex,
            isLastUser: true
          });
        }
      } else {
        // 不是所有成員都已提交答案
        console.log(`[${roomId}] 仍有 ${memberCount - answerCount} 成員未提交答案`);

        // 發送投票統計
        const currentQuestion = index || 0;
        const questionStats = {};

        // 收集該題的答案統計
        Object.entries(room.answers).forEach(([userId, userData]) => {
          let answer;
          if (typeof userData === 'object' && Array.isArray(userData.answers)) {
            answer = userData.answers[currentQuestion];
          } else if (Array.isArray(userData)) {
            answer = userData[currentQuestion];
          }

          if (answer) {
            questionStats[answer] = (questionStats[answer] || 0) + 1;
          }
        });

        io.to(roomId).emit('voteStats', questionStats);

        // 發送新投票通知
        const userName = room.members[socket.id]?.name || "匿名用戶";
        const userAnswer = Array.isArray(answers) ? answers[answers.length - 1] : null;

        if (userAnswer) {
          io.to(roomId).emit('newVote', {
            option: userAnswer,
            senderId: socket.id,
            userName: userName
          });
        }
      }
    } catch (error) {
      console.error(`[${roomId}] 處理答案錯誤:`, error);
      if (typeof callback === 'function') {
        callback({ success: false, error: `處理答案錯誤: ${error.message}` });
      }
    }
  });

  // 添加一個新的事件處理函數，用於客戶端準備就緒信號
  socket.on("clientReady", function ({ roomId, currentIndex }) {
    console.log(`[${roomId}] 用戶 ${socket.id} 已準備好題目 ${currentIndex}`);

    const room = rooms[roomId];
    if (!room) {
      console.error(`[${roomId}] 客戶端準備失敗: 房間不存在`);
      return;
    }

    // 檢查房間狀態，如果已有推薦，直接發送推薦結果
    if (room.status === 'recommendation_ready' || room.status === 'vote') {
      if (room.recommendations && Array.isArray(room.recommendations) && room.recommendations.length > 0) {
        console.log(`[${roomId}] 用戶 ${socket.id} 準備就緒，已有推薦結果，直接發送`);
        socket.emit('groupRecommendations', room.recommendations);
        return;
      }
    }

    // 檢查是否所有成員已回答當前題目
    const memberCount = Object.keys(room.members || {}).length;
    const answerCount = Object.keys(room.answers || {}).length;

    // 如果客戶端問了一個所有人都已經回答完的題目，立即發送下一題信號
    if (answerCount >= memberCount && currentIndex === parseInt(room.currentQuestionIndex || 0)) {
      console.log(`[${roomId}] 用戶 ${socket.id} 請求的題目已全部回答，發送下一題信號`);

      // 發送下一題信號給請求的客戶端
      socket.emit('nextQuestion', {
        nextIndex: currentIndex + 1,
        isLastUser: false
      });
    }
  });

  // 獲取多人模式推薦餐廳 - 修改版本
  socket.on('getBuddiesRecommendations', function ({ roomId }, callback) {
    try {
      console.log(`[${roomId}] 收到獲取推薦餐廳請求`);
      // 首先嘗試從內存獲取
      let recommendations = [];
      if (rooms[roomId] && rooms[roomId].recommendations) {
        recommendations = rooms[roomId].recommendations;
        console.log(`[${roomId}] 從內存獲取推薦餐廳: ${recommendations.length} 家`);
      }
      // 如果內存中沒有，且 Firebase 在線，從 Firebase 獲取
      else if (firebaseOnline) {
        const recommendationsRef = ref(`buddiesRooms/${roomId}/recommendations`);

        get(recommendationsRef)
          .then(snapshot => {
            if (snapshot.exists()) {
              const data = snapshot.val();

              if (Array.isArray(data)) {
                recommendations = data;
              } else if (data.restaurants && Array.isArray(data.restaurants)) {
                recommendations = data.restaurants;
              }

              console.log(`[${roomId}] 從 Firebase 獲取推薦餐廳: ${recommendations.length} 家`);

              // 保存到內存中
              if (!rooms[roomId]) {
                rooms[roomId] = {
                  recommendations: recommendations,
                  status: 'recommendation_ready'
                };
              } else {
                rooms[roomId].recommendations = recommendations;
                rooms[roomId].status = 'recommendation_ready';
              }

              // 返回結果
              if (typeof callback === 'function') {
                callback({
                  success: recommendations.length > 0,
                  recommendations,
                  error: recommendations.length === 0 ? '沒有推薦結果' : null
                });
              }
            } else {
              console.log(`[${roomId}] Firebase 中沒有推薦結果`);
              generateRecommendations(); // 找不到結果時嘗試生成
            }
          })
          .catch(firebaseError => {
            console.error("從 Firebase 獲取推薦結果失敗:", firebaseError);
            generateRecommendations(); // 錯誤時嘗試生成
          });
      } else {
        // 沒有從儲存中找到，嘗試生成
        generateRecommendations();
      }

      // 如果仍然沒有推薦結果，嘗試即時生成
      function generateRecommendations() {
        if (recommendations.length === 0 && rooms[roomId] && rooms[roomId].answers) {
          console.log(`[${roomId}] 沒有找到推薦結果，嘗試即時生成`);

          getRestaurants()
            .then(restaurants => {
              if (restaurants.length > 0) {
                const basicQuestionsCount = rooms[roomId].basicQuestions ? rooms[roomId].basicQuestions.length : 5;

                // 嘗試生成推薦
                const answerQuestionMap = {};
                let questionTexts = [];

                // 從用戶答案中提取問題文本
                Object.values(rooms[roomId].answers).forEach(userAnswer => {
                  if (userAnswer.questionTexts && userAnswer.questionTexts.length > 0) {
                    questionTexts = userAnswer.questionTexts;
                    return;
                  }
                });

                // 構建 answerQuestionMap
                questionTexts.forEach((text, index) => {
                  answerQuestionMap[index] = text;
                });

                // 調用推薦函數
                const newRecommendations = enhancedLogic.recommendForGroup(
                  rooms[roomId].answers,
                  restaurants,
                  {
                    basicQuestionsCount: basicQuestionsCount,
                    debug: process.env.NODE_ENV === 'development',
                    basicQuestions: rooms[roomId].basicQuestions || [],
                    strictBasicMatch: true,  // 保持嚴格匹配開啟
                    minBasicMatchRatio: 0.5, // 要求至少50%的基本問題匹配
                    basicMatchWeight: enhancedLogic.WEIGHT.BASIC_MATCH * 1.5, // 增加基本問題匹配的權重
                    answerQuestionMap: answerQuestionMap // 確保傳遞答案-問題映射
                  }
                );

                // 添加調試日誌
                console.log(`[${roomId}] 即時生成推薦函數參數:`, {
                  answerCount: Object.keys(rooms[roomId].answers).length,
                  hasAnswerQuestionMap: Object.keys(answerQuestionMap).length > 0
                });

                // 如果成功生成，保存並設置狀態
                if (newRecommendations.length > 0) {
                  console.log(`[${roomId}] 即時生成 ${newRecommendations.length} 家餐廳推薦`);

                  saveRecommendationsToFirebase(roomId, newRecommendations)
                    .then(() => {
                      rooms[roomId].recommendations = newRecommendations;
                      rooms[roomId].status = 'recommendation_ready';

                      // 返回結果
                      if (typeof callback === 'function') {
                        callback({
                          success: true,
                          recommendations: newRecommendations,
                          error: null
                        });
                      }
                    })
                    .catch(error => {
                      console.error(`[${roomId}] 保存推薦結果失敗:`, error);

                      // 即使保存失敗，也返回生成的推薦
                      if (typeof callback === 'function') {
                        callback({
                          success: true,
                          recommendations: newRecommendations,
                          error: null
                        });
                      }
                    });
                } else {
                  if (typeof callback === 'function') {
                    callback({
                      success: false,
                      recommendations: [],
                      error: '無法生成推薦結果'
                    });
                  }
                }
              } else {
                if (typeof callback === 'function') {
                  callback({
                    success: false,
                    recommendations: [],
                    error: '無法獲取餐廳數據'
                  });
                }
              }
            })
            .catch(genError => {
              console.error(`[${roomId}] 即時生成推薦失敗:`, genError);
              if (typeof callback === 'function') {
                callback({
                  success: false,
                  recommendations: [],
                  error: '生成推薦失敗: ' + genError.message
                });
              }
            });
        } else {
          // 返回結果
          if (typeof callback === 'function') {
            callback({
              success: recommendations.length > 0,
              recommendations,
              error: recommendations.length === 0 ? '沒有推薦結果' : null
            });
          }
        }
      }
    } catch (error) {
      console.error("獲取推薦結果錯誤:", error);
      if (typeof callback === 'function') {
        callback({ success: false, error: '獲取推薦結果失敗', recommendations: [] });
      }
    }
  });

  // 最終選擇餐廳
  socket.on('finalizeRestaurant', function ({ roomId, restaurantId, restaurant }, callback) {
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
      room.status = 'completed';

      // 如果 Firebase 在線，更新 Firebase
      if (firebaseOnline) {
        const finalRef = ref(`buddiesRooms/${roomId}/finalRestaurant`);
        set(finalRef, {
          id: restaurantId,
          ...(restaurant || {}),
          selectedAt: serverTimestamp(),
          selectedBy: socket.id
        })
          .then(() => {
            // 更新房間狀態
            const roomRef = ref(`buddiesRooms/${roomId}`);
            return update(roomRef, {
              status: 'completed',
              updatedAt: serverTimestamp()
            });
          })
          .then(() => {
            console.log(`[${roomId}] 最終選擇已保存到 Firebase`);
          })
          .catch(firebaseError => {
            console.error("更新最終選擇到 Firebase 失敗:", firebaseError);
          });
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
app.get('/api/room/:roomId', function (req, res) {
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

      get(roomRef)
        .then(snapshot => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            // 將數據緩存到內存中
            rooms[roomId] = {
              host: data.hostSocket || null,
              members: data.members || {},
              stage: data.status || 'waiting',
              status: data.status || 'waiting',
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
          } else {
            return res.json({
              exists: false,
              firebaseStatus: firebaseOnline ? 'online' : 'offline'
            });
          }
        })
        .catch(error => {
          console.error('查詢房間錯誤:', error);
          res.status(500).json({ error: '伺服器錯誤', message: error.message });
        });
    } else {
      return res.json({
        exists: false,
        firebaseStatus: firebaseOnline ? 'online' : 'offline'
      });
    }
  } catch (error) {
    console.error('房間查詢錯誤:', error);
    res.status(500).json({ error: '伺服器錯誤', message: error.message });
  }
});

// 緊急調試 API - 用於強制生成推薦
app.get('/api/debug/room/:roomId', function (req, res) {
  try {
    const { roomId } = req.params;
    const { command } = req.query;

    // 檢查房間是否存在
    const room = rooms[roomId];
    if (!room) {
      return res.status(404).json({ error: '房間不存在' });
    }

    let result = null;

    // 執行特定命令
    switch (command) {
      case 'force-recommend':
        try {
          // 強制執行推薦邏輯
          getRestaurants()
            .then(restaurants => {
              if (restaurants.length > 0) {
                // 設置狀態為正在生成推薦
                room.status = 'generating_recommendations';

                const recommendations = enhancedLogic.recommendForGroup(
                  room.answers,
                  restaurants,
                  {
                    basicQuestionsCount: room.basicQuestions ? room.basicQuestions.length : 5,
                    debug: true,
                    basicQuestions: room.basicQuestions || []
                  }
                );

                // 添加調試信息，但不修改返回結果
                console.log(`[${roomId}] 推薦結果（前3家）：`, recommendations.slice(0, 3).map(r => ({
                  name: r.name,
                  matchScore: r.matchScore,
                  hasScore: typeof r.matchScore === 'number'
                })));

                // 確保匹配分數被保留
                console.log(`[${roomId}] 推薦結果是否包含匹配分數：`, recommendations.some(r => typeof r.matchScore === 'number'));

                // 發送推薦結果
                io.to(roomId).emit('groupRecommendations', recommendations);

                // 保存推薦結果
                return saveRecommendationsToFirebase(roomId, recommendations)
                  .then(() => {
                    room.recommendations = recommendations;
                    room.status = 'recommendation_ready';

                    res.json({
                      success: true,
                      message: '強制推薦已生成並發送',
                      recommendationsCount: recommendations.length
                    });
                  });
              } else {
                res.json({ success: false, error: '無法獲取餐廳數據' });
              }
            })
            .catch(error => {
              res.json({ success: false, error: error.message });
            });
        } catch (error) {
          res.json({ success: false, error: error.message });
        }
        break;

      case 'room-status':
        // 返回房間狀態
        result = {
          members: Object.keys(room.members || {}).length,
          answers: Object.keys(room.answers || {}).length,
          stage: room.stage,
          status: room.status,
          currentQuestionIndex: room.currentQuestionIndex || 0,
          hasRecommendations: room.recommendations ? room.recommendations.length : 0
        };
        res.json(result);
        break;

      case 'reset-answers':
        // 重置房間答案
        room.answers = {};
        if (firebaseOnline) {
          const answersRef = ref(`buddiesRooms/${roomId}/answers`);
          set(answersRef, {})
            .then(() => {
              res.json({ success: true, message: '所有答案已重置' });
            })
            .catch(error => {
              res.json({ success: false, error: error.message });
            });
        } else {
          res.json({ success: true, message: '所有答案已重置' });
        }
        break;
      case 'sync-members':
        // 發送用戶列表更新
        emitUserList(roomId);
        result = {
          success: true,
          message: '已同步成員列表',
          members: Object.keys(room.members || {}).map(id => ({
            id,
            name: room.members[id].name,
            isHost: room.members[id].isHost
          }))
        };
        res.json(result);
        break;

      default:
        result = {
          error: '未知命令',
          availableCommands: [
            'force-recommend',
            'room-status',
            'reset-answers',
            'sync-members'
          ]
        };
        res.json(result);
    }
  } catch (error) {
    console.error('調試API錯誤:', error);
    res.status(500).json({ error: '伺服器錯誤', message: error.message });
  }
});

// 查看所有房間的狀態
app.get('/api/debug/rooms', (req, res) => {
  try {
    const result = Object.entries(rooms).map(([roomId, room]) => ({
      roomId,
      members: Object.keys(room.members || {}).length,
      answers: Object.keys(room.answers || {}).length,
      stage: room.stage,
      status: room.status,
      currentQuestionIndex: room.currentQuestionIndex || 0,
      hasRecommendations: room.recommendations ? true : false
    }));

    res.json(result);
  } catch (error) {
    console.error('查看房間狀態錯誤:', error);
    res.status(500).json({ error: '伺服器錯誤', message: error.message });
  }
});

// 清理過期房間的定時任務
setInterval(function () {
  if (!firebaseOnline) return; // 如果 Firebase 離線，跳過清理

  try {
    // 檢查Firebase中標記為空的房間
    const roomsRef = ref('buddiesRooms');

    get(roomsRef)
      .then(emptySnapshot => {
        if (emptySnapshot.exists()) {
          const roomsData = emptySnapshot.val();
          const now = Date.now();
          const oneDay = 2 * 60 * 60 * 1000; // 2小時

          Object.entries(roomsData).forEach(([roomId, room]) => {
            // 如果房間被標記為空並且超過2小時
            if (room.meta && room.meta.empty) {
              const emptyTime = new Date(room.meta.empty).getTime();
              if (!isNaN(emptyTime) && now - emptyTime > oneDay) {
                // 刪除過期房間
                const expiredRoomRef = ref(`buddiesRooms/${roomId}`);
                set(expiredRoomRef, null)
                  .then(() => {
                    console.log(`已清理過期房間: ${roomId}`);

                    // 如果內存中也有，一併清理
                    if (rooms[roomId]) {
                      delete rooms[roomId];
                    }
                  })
                  .catch(error => {
                    console.error(`清理過期房間 ${roomId} 失敗:`, error);
                  });
              }
            }
          });
        }
      })
      .catch(error => {
        console.error('清理過期房間錯誤:', error);
      });
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