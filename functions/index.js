const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.database();

exports.cleanExpiredRooms = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async () => {
    const now = Date.now();
    const expiration = 20 * 60 * 1000; // 20 分鐘

    const roomsSnap = await db.ref('/buddiesRooms').once('value');
    const rooms = roomsSnap.val();

    if (!rooms) return console.log("✅ 沒有房間需要清除");

    const tasks = Object.entries(rooms).map(async ([roomId, roomData]) => {
      const createdAt = roomData.createdAt || 0;
      if (now - createdAt > expiration) {
        // 備份
        await db.ref(`/analyticsLogs/${roomId}`).set({
          copiedAt: now,
          roomData
        });
        // 刪除原始
        await db.ref(`/buddiesRooms/${roomId}`).remove();
        console.log(`✅ 已清除過期房間：${roomId}`);
      }
    });

    await Promise.all(tasks);
    return null;
  });
