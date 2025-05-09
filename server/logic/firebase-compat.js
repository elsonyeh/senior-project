// firebase-compat.js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// 從 CommonJS 模組導入
const firebaseCommon = require('./firebase.js');

// 直接導出 - 這將成為默認導出
export default firebaseCommon;

// 同時提供命名導出，方便解構
export const rtdb = firebaseCommon.rtdb;
export const firestore = firebaseCommon.firestore;
export const admin = firebaseCommon.admin;
export const isConnected = firebaseCommon.isConnected;
export const isOfflineMode = firebaseCommon.isOfflineMode;