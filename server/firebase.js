require('dotenv').config(); // 讀取 .env

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // ⬅ 你下載的憑證 JSON 檔

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL
});

const rtdb = admin.database();
module.exports = { rtdb };
