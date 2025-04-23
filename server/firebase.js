// firebase.js
const admin = require('firebase-admin');

admin.initializeApp({
  databaseURL: process.env.FIREBASE_DB_URL
});

const rtdb = admin.database();
module.exports = { rtdb };
