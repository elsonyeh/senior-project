require('dotenv').config();
const admin = require('firebase-admin');

// ✅ 從 Railway 的環境變數讀取 JSON 字串
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL
});

const rtdb = admin.database();
module.exports = { rtdb };
