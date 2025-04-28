const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // 確保加載 .env 檔案

// 初始化配置
let serviceAccount;
let initialized = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 10;

try {
  // 優先嘗試從環境變量獲取(支持 Vercel/Railway 等平台)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      console.log('使用環境變量中的 Firebase 服務帳號配置');
    } catch (parseError) {
      console.error('解析 FIREBASE_SERVICE_ACCOUNT 環境變量失敗:', parseError);
      throw new Error('Firebase 服務帳號環境變量格式不正確');
    }
  } 
  // 如果環境變量不存在，嘗試使用本地文件 (本地開發環境)
  else {
    const localServiceAccountPath = path.join(__dirname, './serviceAccountKey.json');
    if (fs.existsSync(localServiceAccountPath)) {
      serviceAccount = require(localServiceAccountPath);
      console.log('使用本地服務配置文件');
    } else {
      throw new Error('缺少 Firebase 憑據，請提供環境變量或本地配置文件');
    }
  }
  
  // 驗證帳號信息
  if (!serviceAccount.project_id || !serviceAccount.private_key) {
    throw new Error('Firebase 服務帳號配置不完整');
  }
  
} catch (error) {
  console.error('Firebase 初始化錯誤:', error.message);
  console.error('如果在本地開發，請確保 serviceAccountKey.json 文件存在且格式正確');
  console.error('如果在雲服務部署，請確保設置了 FIREBASE_SERVICE_ACCOUNT 環境變量');
  // 不強制退出，允許應用程序繼續運行
  console.warn('Firebase 將使用離線模式運行，部分功能可能不可用');
}

// 使用 .env 中的 FIREBASE_DB_URL 環境變量
const databaseURL = process.env.FIREBASE_DB_URL || 
                   (serviceAccount?.databaseURL ? serviceAccount.databaseURL : 
                   serviceAccount ? `https://${serviceAccount.project_id}.firebaseio.com` : null);

// 顯示配置信息
console.log(`使用資料庫 URL: ${databaseURL}`);
console.log(`Socket URL 配置: ${process.env.VITE_SOCKET_URL || '未配置'}`);

// 定義 rtdb 變量
let rtdb = null;
let firestore = null;

// 初始化 Firebase Admin
if (serviceAccount && databaseURL) {
  try {
    // 配置連接選項 - 添加 databaseAuthVariableOverride 繞過安全規則
    const firebaseConfig = {
      credential: admin.credential.cert(serviceAccount),
      databaseURL: databaseURL,
      // 重要：添加此配置可繞過安全規則中的 auth 檢查
      databaseAuthVariableOverride: { 
        admin: true  // 這將在安全規則中可以用 auth.admin === true 來識別
      }
    };

    // 檢查是否已初始化
    if (!initialized) {
      admin.initializeApp(firebaseConfig);
      initialized = true;
      console.log('Firebase 已成功初始化，項目ID:', serviceAccount.project_id);
      
      // 獲取 Realtime Database 實例
      rtdb = admin.database();
      
      // 設置數據庫連接選項
      if (rtdb.app && rtdb.app.options) {
        // 減少閒置連接超時，優化連接池
        rtdb.app.options.databaseTimeoutSeconds = 60; // 60秒後關閉閒置連接
      }
      
      // 嘗試獲取 Firestore 實例
      try {
        firestore = admin.firestore();
        console.log('Firebase Firestore 已初始化');
      } catch (firestoreError) {
        console.warn('Firebase Firestore 初始化失敗:', firestoreError.message);
        console.warn('將只使用 Realtime Database');
      }
    }
  } catch (initError) {
    console.error('Firebase 初始化失敗:', initError);
    console.warn('Firebase 將使用離線模式運行，部分功能可能不可用');
  }
}

// 連接重試機制
const connectWithRetry = (maxRetries = MAX_CONNECTION_ATTEMPTS, delay = 5000) => {
  if (!rtdb) {
    console.error('Firebase Realtime Database 未初始化，無法建立連接');
    return;
  }
  
  let retries = 0;
  
  const tryConnect = () => {
    connectionAttempts++;
    console.log(`嘗試連接 Firebase Realtime Database (嘗試 ${connectionAttempts}/${maxRetries})...`);
    
    rtdb.ref('.info/connected').on('value', (snapshot) => {
      if (snapshot.exists() && snapshot.val() === true) {
        retries = 0; // 重置重試計數
        connectionAttempts = 0;
        console.log('已成功連接到 Firebase Realtime Database');
      } else if (retries < maxRetries) {
        retries++;
        console.log(`連接失敗，${delay/1000}秒後重試 (${retries}/${maxRetries})...`);
        setTimeout(tryConnect, delay);
      } else {
        console.error(`已達到最大重試次數 (${maxRetries})，連接失敗`);
        console.warn('Firebase 將使用離線模式運行，部分功能可能不可用');
        // 設置一個長時間的定時器，再次嘗試連接
        setTimeout(() => {
          retries = 0;
          connectionAttempts = 0;
          tryConnect();
        }, 60000); // 1分鐘後再試
      }
    }, (error) => {
      console.error('Firebase 連接錯誤:', error.message);
      if (retries < maxRetries) {
        retries++;
        console.log(`連接錯誤，${delay/1000}秒後重試 (${retries}/${maxRetries})...`);
        setTimeout(tryConnect, delay);
      } else {
        console.error(`已達到最大重試次數 (${maxRetries})，連接失敗`);
        // 設置一個長時間的定時器，再次嘗試連接
        setTimeout(() => {
          retries = 0;
          connectionAttempts = 0;
          tryConnect();
        }, 60000); // 1分鐘後再試
      }
    });
  };
  
  // 只有在成功初始化 rtdb 後才嘗試連接
  if (rtdb) {
    tryConnect();
  }
};

// 監控連接狀態變化
if (rtdb) {
  rtdb.ref('.info/connected').on('value', (snapshot) => {
    const connected = snapshot.val();
    if (connected) {
      console.log('與 Firebase Realtime Database 連接建立');
    } else {
      console.log('與 Firebase Realtime Database 連接中斷');
    }
  });

  // 啟動連接重試機制
  connectWithRetry();
}

// 簡單的本地緩存實現，用於離線模式
const localCache = {
  data: {},
  get: function(path) {
    return this.data[path] || null;
  },
  set: function(path, value) {
    this.data[path] = value;
    return value;
  },
  remove: function(path) {
    delete this.data[path];
    return null;
  }
};

// 創建一個代理 rtdb 對象，用於離線模式
const rtdbProxy = rtdb || {
  ref: (path) => {
    console.warn(`Firebase 離線模式: 嘗試訪問路徑 ${path}`);
    return {
      set: (value) => {
        return Promise.resolve(localCache.set(path, value));
      },
      update: (updates) => {
        for (const key in updates) {
          localCache.set(`${path}/${key}`, updates[key]);
        }
        return Promise.resolve(updates);
      },
      push: () => {
        const newKey = Math.random().toString(36).substring(2, 15);
        return {
          key: newKey,
          set: (value) => {
            return Promise.resolve(localCache.set(`${path}/${newKey}`, value));
          }
        };
      },
      remove: () => {
        return Promise.resolve(localCache.remove(path));
      },
      once: (eventType) => {
        if (eventType === 'value') {
          return Promise.resolve({
            val: () => localCache.get(path),
            exists: () => localCache.get(path) !== null
          });
        }
        return Promise.resolve(null);
      },
      on: (eventType, callback, errorCallback) => {
        if (eventType === 'value') {
          try {
            callback({
              val: () => localCache.get(path),
              exists: () => localCache.get(path) !== null
            });
          } catch (error) {
            if (errorCallback) errorCallback(error);
          }
        }
        // 返回一個空函數作為unsubscribe函數
        return () => {};
      }
    };
  },
  // 實現簡單的離線模式服務器時間戳
  ServerValue: {
    TIMESTAMP: Date.now()
  }
};

// 導出 Firebase Admin 實例和數據庫引用
module.exports = { 
  admin,
  rtdb: rtdb, // 直接導出真正的 rtdb 實例，而不是 rtdbProxy
  firestore: firestore || null,
  isConnected: () => rtdb !== null && initialized,
  isOfflineMode: () => rtdb === null || !initialized
};