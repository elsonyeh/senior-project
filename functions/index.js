// functions/index.js - 生產環境最終版本
const {onValueWritten} = require('firebase-functions/v2/database');
const admin = require('firebase-admin');

admin.initializeApp();

// 自動同步管理員權限（當 Realtime Database 中的管理員列表變更時）
exports.syncAdminClaims = onValueWritten({
  ref: '/admins/{uid}',
  region: 'asia-southeast1',
  database: 'https://tastebuddies-demo-2-default-rtdb.asia-southeast1.firebasedatabase.app/'
}, async (event) => {
  const uid = event.params.uid;
  const change = event.data;
  
  try {
    if (change.after.exists()) {
      const adminData = change.after.val();
      if (adminData.role === 'admin') {
        await admin.auth().setCustomUserClaims(uid, { admin: true });
        console.log(`設置管理員權限: ${adminData.email}`);
      }
    } else {
      // 用戶從管理員列表中移除
      await admin.auth().setCustomUserClaims(uid, { admin: false });
      console.log(`移除管理員權限: ${uid}`);
    }
  } catch (error) {
    console.error('同步管理員權限失敗:', error);
  }
});