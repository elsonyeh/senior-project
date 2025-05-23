// firebase.js
// 前端 Firebase 配置和初始化

import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, get } from "firebase/database";
import { getStorage } from "firebase/storage";

// Firebase 配置
// 注意：這些配置是公開的，可以暴露在前端代碼中
const firebaseConfig = {
  apiKey: "AIzaSyAFnM6jwEITNIFgjo6OTFK3gcf1eiBvJR4",
  authDomain: "tastebuddies-demo-2.firebaseapp.com",
  databaseURL: "https://tastebuddies-demo-2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tastebuddies-demo-2",
  storageBucket: "tastebuddies-demo-2.firebasestorage.app",
  messagingSenderId: "350257167925",
  appId: "1:350257167925:web:64b8d7d08d16dca6867b7c",
  measurementId: "G-0F5TNENZ6Q"
};

// 初始化 Firebase
let app;
let analytics = null;
let db = null;
let auth = null;
let rtdb = null;
let storage = null;

// 保存管理員信息的狀態
let isAdmin = false;
let adminCheckPromise = null;

// 本地儲存的管理員狀態鍵值
const ADMIN_STORAGE_KEY = 'isAdminUser';

try {
  app = initializeApp(firebaseConfig);

  // 只在瀏覽器環境初始化 Analytics
  if (typeof window !== 'undefined') {
    try {
      analytics = getAnalytics(app);
      console.log('Firebase Analytics 已初始化');
    } catch (analyticsError) {
      console.warn('Firebase Analytics 初始化失敗:', analyticsError);
    }
  }

  // 初始化 Firestore
  try {
    db = getFirestore(app);
    console.log('Firebase Firestore 已初始化');
  } catch (firestoreError) {
    console.error('Firebase Firestore 初始化失敗:', firestoreError);
  }

  // 初始化 Authentication
  try {
    auth = getAuth(app);
    console.log('Firebase Auth 已初始化');
  } catch (authError) {
    console.error('Firebase Auth 初始化失敗:', authError);
  }

  // 初始化 Realtime Database
  try {
    rtdb = getDatabase(app);
    console.log('Firebase Realtime Database 已初始化');
  } catch (rtdbError) {
    console.error('Firebase Realtime Database 初始化失敗:', rtdbError);
  }

  // 初始化 Storage
  try {
    storage = getStorage(app);
    console.log('Firebase Storage 已初始化');
  } catch (storageError) {
    console.error('Firebase Storage 初始化失敗:', storageError);
  }

  console.log('Firebase 已成功初始化');
} catch (error) {
  console.error('Firebase 初始化失敗:', error);
}

/**
 * 檢查用戶是否為管理員 - 使用 Custom Claims
 * @param {boolean} forceRefresh - 是否強制重新檢查
 * @return {Promise<boolean>} 是否為管理員
 */
export const checkIsAdmin = async (forceRefresh = false) => {
  // 如果已經檢查過且不需要強制刷新，則直接返回結果
  if (isAdmin && !forceRefresh) {
    return isAdmin;
  }

  // 如果有正在進行的檢查，直接返回該 Promise
  if (adminCheckPromise && !forceRefresh) {
    return adminCheckPromise;
  }

  // 先嘗試從本地存儲獲取管理員狀態
  const storedAdminStatus = localStorage.getItem(ADMIN_STORAGE_KEY);
  if (storedAdminStatus === 'true' && !forceRefresh) {
    isAdmin = true;
    return true;
  }

  // 創建新的檢查 Promise
  adminCheckPromise = new Promise(async (resolve) => {
    try {
      // 確保用戶已登入
      if (!auth.currentUser) {
        console.log('未登入用戶，非管理員');
        isAdmin = false;
        resolve(false);
        return;
      }

      // 獲取用戶的 ID Token 結果，包含 Custom Claims
      const tokenResult = await auth.currentUser.getIdTokenResult();

      // 檢查 Claims 中是否包含 admin: true
      if (tokenResult.claims.admin === true) {
        isAdmin = true;
        localStorage.setItem(ADMIN_STORAGE_KEY, 'true');
        console.log('用戶是管理員（Custom Claims）');
      } else {
        isAdmin = false;
        localStorage.removeItem(ADMIN_STORAGE_KEY);
        console.log('用戶不是管理員（Custom Claims）');
      }

      resolve(isAdmin);
    } catch (error) {
      console.error('檢查管理員狀態失敗:', error);
      isAdmin = false;
      localStorage.removeItem(ADMIN_STORAGE_KEY);
      resolve(false);
    } finally {
      // 完成檢查後重置 Promise
      adminCheckPromise = null;
    }
  });

  return adminCheckPromise;
};


// 監聽用戶登入狀態變化
if (auth) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // 用戶登入時自動檢查管理員狀態
      checkIsAdmin(true).then(result => {
        console.log('管理員狀態檢查完成:', result);
      });
    } else {
      // 用戶登出時重置管理員狀態
      isAdmin = false;
      localStorage.removeItem(ADMIN_STORAGE_KEY);
    }
  });
}

// 導出初始化的服務
export { app, analytics, db, auth, rtdb, storage, isAdmin };