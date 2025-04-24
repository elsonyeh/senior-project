require('dotenv').config();
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let serviceAccount;

try {
  // 優先嘗試從環境變量獲取(支持 Vercel/Railway 等平台)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('使用環境變量中的 Firebase 服務帳號配置');
  } 
  // 如果環境變量不存在，嘗試使用本地文件 (本地開發環境)
  else {
    const localServiceAccountPath = path.join(__dirname, './serviceAccountKey.json');
    if (fs.existsSync(localServiceAccountPath)) {
      serviceAccount = require(localServiceAccountPath);
      console.log('使用本地服務配置文件');
    } else {
      throw new Error('缺少 Firebase 憑據，请提供環境變量或本地配置文件');
    }
  }
  
  // 驗證帳號信息
  if (!serviceAccount.project_id || !serviceAccount.private_key) {
    throw new Error('Firebase 服務帳號配置不完整');
  }
  
} catch (error) {
  console.error('Firebase 初始化錯誤:', error.message);
  console.error('如果在本地開發，請確保 serviceAccountKey.json 文件存在且格式正確');
  console.error('如果在 Vercel 部署，请確保設置了 FIREBASE_SERVICE_ACCOUNT 環境變量');
  process.exit(1);
}

// 資料庫 URL 也同樣處理
const databaseURL = process.env.FIREBASE_DB_URL || 
                   (serviceAccount.databaseURL ? serviceAccount.databaseURL : 
                   `https://${serviceAccount.project_id}.firebaseio.com`);

// 初始化 Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: databaseURL
});

console.log('Firebase 已成功初始化，項目ID:', serviceAccount.project_id);

const rtdb = admin.database();
module.exports = { rtdb };