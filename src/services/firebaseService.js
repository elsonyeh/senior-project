// firebaseService.js
// 前端 Firebase 服務功能 - 同時支援 Firestore 與 Realtime Database

import {
    ref,
    set,
    get,
    push,
    update,
    remove,
    onValue,
    off,
    serverTimestamp as rtdbTimestamp
} from "firebase/database";

import {
    collection,
    getDocs,
    query,
    where,
    limit,
    doc,
    getDoc,
    orderBy,
    serverTimestamp as firestoreTimestamp
} from "firebase/firestore";

import { getAuth, signInAnonymously, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { db, rtdb, auth, checkIsAdmin } from "./firebase";

// 保存一個局部的管理員狀態變數
let localIsAdmin = false;

/**
 * 確保用戶已登入（匿名登入）
 * @return {Promise<Object>} 用戶信息
 */
const ensureAuth = async () => {
    if (!auth.currentUser) {
        try {
            await signInAnonymously(auth);
            console.log('匿名登入成功');
        } catch (error) {
            console.error('匿名登入失敗:', error);
            throw new Error('無法登入，請重試');
        }
    }
    return auth.currentUser;
};

/**
 * 管理員登入
 * @param {String} email - 管理員電子郵件
 * @param {String} password - 管理員密碼
 * @return {Promise<Object>} 登入結果
 */
export const adminLogin = async (email, password) => {
    try {
        if (!email || !password) {
            return { success: false, error: '請輸入電子郵件和密碼' };
        }

        // 嘗試使用電子郵件和密碼登入
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log('使用者登入成功:', user.email);

        // 檢查是否為管理員
        const isAdmin = await checkIsAdmin(true);
        console.log('管理員檢查結果:', isAdmin);

        if (!isAdmin) {
            // 如果不是管理員，則登出並返回錯誤
            console.log('用戶不是管理員，執行登出');
            await signOut(auth);
            return { success: false, error: '您沒有管理員權限' };
        }

        // 將管理員狀態保存在本地存儲中
        localStorage.setItem('isAdmin', 'true');
        localIsAdmin = true;

        return { success: true, user };
    } catch (error) {
        console.error('管理員登入失敗:', error);

        // 提供更友好的錯誤訊息
        let errorMessage = '登入失敗，請檢查您的電子郵件和密碼';

        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorMessage = '電子郵件或密碼不正確';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = '登入嘗試次數過多，請稍後再試';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = '電子郵件格式不正確';
        }

        return { success: false, error: errorMessage };
    }
};

/**
 * 管理員登出
 * @return {Promise<Object>} 登出結果
 */
export const adminLogout = async () => {
    try {
        await signOut(auth);
        localStorage.removeItem('isAdmin');
        localIsAdmin = false;
        return { success: true };
    } catch (error) {
        console.error('登出失敗:', error);
        return { success: false, error: error.message };
    }
};

/**
 * 檢查當前用戶是否為管理員
 * @return {Promise<boolean>} 是否為管理員
 */
export const isAdminUser = async () => {
    try {
        // 局部變數檢查
        if (localIsAdmin) {
            console.log('從局部變數確認是管理員');
            return true;
        }

        // 首先檢查本地存儲
        if (localStorage.getItem('isAdmin') === 'true' && auth.currentUser) {
            console.log('從本地存儲確認是管理員');
            localIsAdmin = true;
            return true;
        }

        // 用戶未登入，肯定不是管理員
        if (!auth.currentUser) {
            console.log('用戶未登入，不是管理員');
            return false;
        }

        // 最後嘗試檢查 Firebase 中的管理員狀態
        try {
            console.log('檢查 Firebase 中的管理員狀態...');
            const isAdmin = await checkIsAdmin();

            // 如果是管理員，更新本地存儲
            if (isAdmin) {
                console.log('從 Firebase 確認是管理員');
                localStorage.setItem('isAdmin', 'true');
                localIsAdmin = true;
            } else {
                console.log('從 Firebase 確認不是管理員');
            }

            return isAdmin;
        } catch (error) {
            console.error('檢查管理員狀態失敗:', error);
            return false;
        }
    } catch (error) {
        console.error('isAdminUser 檢查失敗:', error);
        return false;
    }
};

/**
 * 從 Firestore 獲取餐廳數據
 * @param {Object} options - 篩選選項 
 * @return {Promise<Array>} 餐廳資料陣列
 */
export const getRestaurants = async (options = {}) => {
    try {
        // 使用 Firestore 獲取餐廳數據
        const restaurantsCollection = collection(db, 'restaurants');
        const snapshot = await getDocs(restaurantsCollection);

        // 轉換數據格式
        let restaurants = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`從 Firestore 成功獲取 ${restaurants.length} 個餐廳數據`);

        // 處理篩選選項
        const { tags = [], type, priceRange, isSpicy } = options;

        if (tags.length > 0 || type || priceRange || isSpicy !== undefined) {
            restaurants = restaurants.filter(restaurant => {
                // 標籤過濾
                if (tags.length > 0) {
                    const restaurantTags = Array.isArray(restaurant.tags) ? restaurant.tags : [];
                    if (!tags.some(tag => restaurantTags.includes(tag))) {
                        return false;
                    }
                }

                // 餐廳類型過濾
                if (type && restaurant.type !== type) {
                    return false;
                }

                // 價格範圍過濾
                if (priceRange && restaurant.priceRange !== priceRange) {
                    return false;
                }

                // 辣度過濾
                if (isSpicy !== undefined && restaurant.isSpicy !== isSpicy) {
                    return false;
                }

                return true;
            });
        }

        // 將數據緩存到本地存儲
        try {
            localStorage.setItem('cachedRestaurants', JSON.stringify(restaurants));
        } catch (cacheError) {
            console.warn('緩存餐廳數據失敗:', cacheError);
        }

        return restaurants;
    } catch (error) {
        console.error('獲取餐廳數據失敗:', error);

        // 嘗試從本地緩存獲取
        const cachedData = localStorage.getItem('cachedRestaurants');
        if (cachedData) {
            try {
                const parsed = JSON.parse(cachedData);
                console.log('使用本地緩存的餐廳數據');
                return parsed;
            } catch (e) {
                console.error('解析緩存失敗:', e);
            }
        }

        return [];
    }
};

/**
 * 監聽房間狀態變化 (Realtime Database)
 * @param {String} roomId - 房間ID
 * @param {Function} callback - 狀態變化時的回調函數
 * @return {Function} 取消監聽的函數
 */
export const listenRoomStatus = (roomId, callback) => {
    if (!roomId || typeof callback !== 'function') return () => { };

    const statusRef = ref(rtdb, `buddiesRooms/${roomId}/status`);

    const handler = (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        } else {
            // 如果狀態不存在，默認為 "waiting"
            callback("waiting");
        }
    };

    onValue(statusRef, handler);

    // 返回取消監聽的函數
    return () => off(statusRef, 'value', handler);
};

/**
 * 獲取或創建用戶ID
 * @return {String} 用戶ID
 */
export const getOrCreateUserId = () => {
    let userId = localStorage.getItem("userId");

    if (!userId) {
        userId = `user_${Date.now()}`;
        localStorage.setItem("userId", userId);
    }

    return userId;
};

/**
 * 獲取房間信息 (Realtime Database)
 * @param {String} roomId - 房間ID
 * @return {Promise<Object>} 房間信息
 */
export const getRoomInfo = async (roomId) => {
    try {
        if (!roomId) return { success: false, error: '參數不完整' };

        // 確保用戶已登入
        await ensureAuth();

        const roomRef = ref(rtdb, `buddiesRooms/${roomId}`);
        const snapshot = await get(roomRef);

        if (snapshot.exists()) {
            return { success: true, data: snapshot.val() };
        } else {
            return { success: false, error: '房間不存在' };
        }
    } catch (error) {
        console.error("獲取房間信息失敗:", error);
        return { success: false, error: error.message };
    }
};

/**
 * 監聽房間成員變化 (Realtime Database)
 * @param {String} roomId - 房間ID
 * @param {Function} callback - 成員變化回調函數
 * @return {Function} 取消監聽的函數
 */
export const listenRoomMembers = (roomId, callback) => {
    if (!roomId || typeof callback !== 'function') return () => { };

    const membersRef = ref(rtdb, `buddiesRooms/${roomId}/members`);

    const listener = onValue(membersRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        } else {
            callback({});
        }
    });

    return () => off(membersRef, 'value', listener);
};

/**
 * 創建房間 (Realtime Database)
 * @param {String} hostName - 房主名稱
 * @return {Promise<Object>} 創建結果
 */
export const createRoom = async (hostName) => {
    try {
        if (!hostName) return { success: false, error: '請輸入房主名稱' };

        // 確保用戶已登入
        await ensureAuth();

        // 生成房間ID
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();

        // 獲取或創建用戶ID
        const userId = getOrCreateUserId();

        // 創建房間
        const roomRef = ref(rtdb, `buddiesRooms/${roomId}`);
        await set(roomRef, {
            hostId: userId,
            hostName: hostName,
            createdAt: rtdbTimestamp(),
            status: 'waiting',
            members: {
                [userId]: {
                    id: userId,
                    name: hostName,
                    isHost: true,
                    joinedAt: rtdbTimestamp()
                }
            }
        });

        return { success: true, roomId, userId };
    } catch (error) {
        console.error("創建房間失敗:", error);

        // 提供更具體的錯誤信息
        if (error.code === 'PERMISSION_DENIED') {
            return {
                success: false,
                error: '沒有創建房間的權限，請確保已登入'
            };
        }

        return { success: false, error: error.message };
    }
};

/**
 * 加入房間 (Realtime Database)
 * @param {String} roomId - 房間ID
 * @param {String} userName - 用戶名稱
 * @return {Promise<Object>} 加入結果
 */
export const joinRoom = async (roomId, userName) => {
    try {
        if (!roomId || !userName) return { success: false, error: '參數不完整' };

        // 確保用戶已登入
        await ensureAuth();

        // 檢查房間是否存在
        const { success, data, error } = await getRoomInfo(roomId);
        if (!success) return { success: false, error };

        // 獲取用戶ID (使用 Firebase Auth UID 以匹配安全規則)
        const userId = auth.currentUser.uid;

        // 嘗試通過客戶端 API 加入房間
        try {
            const memberRef = ref(rtdb, `buddiesRooms/${roomId}/members/${userId}`);
            await set(memberRef, {
                id: userId,
                name: userName,
                isHost: false,
                joinedAt: rtdbTimestamp()
            });

            return { success: true, roomData: data, userId };
        } catch (clientError) {
            // 如果客戶端 API 失敗，嘗試通過服務端 API
            if (clientError.code === 'PERMISSION_DENIED') {
                console.log('使用服務端 API 嘗試加入房間');

                // 通過服務端 API 加入
                return new Promise((resolve) => {
                    socket.emit('joinRoom', { roomId, userName }, (result) => {
                        if (result.success) {
                            // 保存用戶ID
                            localStorage.setItem('userId', result.userId);
                            resolve({ success: true, roomData: data, userId: result.userId });
                        } else {
                            resolve({ success: false, error: result.error || '加入房間失敗' });
                        }
                    });
                });
            }

            throw clientError;
        }
    } catch (error) {
        console.error("加入房間失敗:", error);
        return { success: false, error: error.message };
    }
};

/**
 * 從 Firebase 獲取推薦結果 (Realtime Database)
 * @param {String} roomId - 房間ID
 * @return {Promise<Array>} 餐廳推薦列表
 */
export const getRecommendationsFromFirebase = async (roomId) => {
    try {
        if (!roomId) return [];

        // 確保用戶已登入
        await ensureAuth();

        const recommendationsRef = ref(rtdb, `buddiesRooms/${roomId}/recommendations`);
        const snapshot = await get(recommendationsRef);

        if (snapshot.exists()) {
            const data = snapshot.val();
            // 檢查是否是舊格式還是新格式
            if (Array.isArray(data)) {
                return data;
            } else if (data.restaurants && Array.isArray(data.restaurants)) {
                return data.restaurants;
            }
        }

        return [];
    } catch (error) {
        console.error("獲取推薦結果失敗:", error);
        return [];
    }
};

/**
 * 監聽房間推薦變化 (Realtime Database)
 * @param {String} roomId - 房間ID
 * @param {Function} callback - 推薦變化時的回調函數
 * @return {Function} 取消監聽的函數
 */
export const listenRoomRecommendations = (roomId, callback) => {
    if (!roomId || typeof callback !== 'function') return () => { };

    const recommendationsRef = ref(rtdb, `buddiesRooms/${roomId}/recommendations`);

    const handler = (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            // 處理不同格式的資料
            if (Array.isArray(data)) {
                callback(data);
            } else if (data.restaurants && Array.isArray(data.restaurants)) {
                callback(data.restaurants);
            } else {
                callback([]);
            }
        } else {
            callback([]);
        }
    };

    onValue(recommendationsRef, handler);

    // 返回取消監聽的函數
    return () => off(recommendationsRef, 'value', handler);
};

/**
 * 保存推薦結果到Firebase (Realtime Database)
 * @param {String} roomId - 房間ID
 * @param {Array} recommendations - 推薦餐廳列表
 * @return {Promise<Object>} 保存結果
 */
export const saveRecommendationsToFirebase = async (roomId, recommendations) => {
    try {
        if (!roomId || !recommendations) return { success: false, error: '參數不完整' };

        // 確保用戶已登入
        await ensureAuth();

        const recommendationsRef = ref(rtdb, `buddiesRooms/${roomId}/recommendations`);
        await set(recommendationsRef, {
            timestamp: rtdbTimestamp(),
            restaurants: recommendations
        });

        // 更新房間狀態
        const roomRef = ref(rtdb, `buddiesRooms/${roomId}`);
        await update(roomRef, {
            status: 'recommend',
            lastUpdated: rtdbTimestamp()
        });

        // 本地保存副本
        localStorage.setItem("buddiesRecommendations", JSON.stringify(recommendations));

        return { success: true };
    } catch (error) {
        console.error("保存推薦結果失敗:", error);
        return { success: false, error: error.message };
    }
};

/**
 * 為餐廳投票 (Realtime Database)
 * @param {String} roomId - 房間ID
 * @param {String} restaurantId - 餐廳ID
 * @return {Promise<Object>} 投票結果
 */
export const voteForRestaurant = async (roomId, restaurantId) => {
    try {
        if (!roomId || !restaurantId) return { success: false, error: '參數不完整' };

        // 確保用戶已登入
        await ensureAuth();

        // 獲取用戶ID
        const userId = getOrCreateUserId();

        // 記錄用戶投票
        const userVoteRef = ref(rtdb, `buddiesRooms/${roomId}/userVotes/${userId}`);
        await set(userVoteRef, {
            restaurantId,
            timestamp: rtdbTimestamp()
        });

        // 更新餐廳票數
        const votesRef = ref(rtdb, `buddiesRooms/${roomId}/votes/${restaurantId}`);
        const snapshot = await get(votesRef);
        const currentVotes = snapshot.exists() ? snapshot.val() : 0;

        await set(votesRef, currentVotes + 1);

        // 標記本地投票狀態
        localStorage.setItem(`voted_${roomId}_${userId}`, "true");

        return { success: true };
    } catch (error) {
        console.error("餐廳投票失敗:", error);
        return { success: false, error: error.message };
    }
};

/**
 * 監聽投票結果 (Realtime Database)
 * @param {String} roomId - 房間ID
 * @param {Function} callback - 投票變化時的回調函數
 * @return {Function} 取消監聽的函數
 */
export const listenVotes = (roomId, callback) => {
    if (!roomId || typeof callback !== 'function') return () => { };

    const votesRef = ref(rtdb, `buddiesRooms/${roomId}/votes`);

    const handler = (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        } else {
            callback({});
        }
    };

    onValue(votesRef, handler);

    // 返回取消監聽的函數
    return () => off(votesRef, 'value', handler);
};

/**
 * 確認最終選擇的餐廳 (Realtime Database)
 * @param {String} roomId - 房間ID
 * @param {Object} restaurant - 餐廳資料
 * @return {Promise<Object>} 選擇結果
 */
export const finalizeRestaurant = async (roomId, restaurant) => {
    try {
        if (!roomId || !restaurant) return { success: false, error: '參數不完整' };

        // 確保用戶已登入
        await ensureAuth();

        // 獲取用戶ID
        const userId = getOrCreateUserId();

        // 保存最終選擇
        const finalRef = ref(rtdb, `buddiesRooms/${roomId}/finalRestaurant`);
        await set(finalRef, {
            id: restaurant.id,
            name: restaurant.name,
            address: restaurant.address,
            photoURL: restaurant.photoURL,
            rating: restaurant.rating,
            type: restaurant.type,
            selectedAt: rtdbTimestamp(),
            selectedBy: userId
        });

        // 更新房間狀態
        const roomRef = ref(rtdb, `buddiesRooms/${roomId}`);
        await update(roomRef, {
            status: 'completed',
            lastUpdated: rtdbTimestamp()
        });

        return { success: true };
    } catch (error) {
        console.error("確認餐廳選擇失敗:", error);
        return { success: false, error: error.message };
    }
};

/**
 * 監聽最終選擇的餐廳 (Realtime Database)
 * @param {String} roomId - 房間ID
 * @param {Function} callback - 最終選擇變化時的回調函數
 * @return {Function} 取消監聽的函數
 */
export const listenFinalRestaurant = (roomId, callback) => {
    if (!roomId || typeof callback !== 'function') return () => { };

    const finalRef = ref(rtdb, `buddiesRooms/${roomId}/finalRestaurant`);

    const handler = (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        } else {
            callback(null);
        }
    };

    onValue(finalRef, handler);

    // 返回取消監聽的函數
    return () => off(finalRef, 'value', handler);
};

/**
 * 檢查用戶是否已投票 (Realtime Database)
 * @param {String} roomId - 房間ID
 * @return {Promise<Boolean>} 是否已投票
 */
export const hasUserVoted = async (roomId) => {
    try {
        const userId = getOrCreateUserId();

        // 首先檢查本地存儲
        if (localStorage.getItem(`voted_${roomId}_${userId}`)) {
            return true;
        }

        // 確保用戶已登入
        await ensureAuth();

        // 如果本地沒有記錄，檢查Firebase
        const userVotesRef = ref(rtdb, `buddiesRooms/${roomId}/userVotes/${userId}`);
        const snapshot = await get(userVotesRef);

        return snapshot.exists();
    } catch (error) {
        console.error("檢查用戶投票狀態失敗:", error);
        return false;
    }
};

/**
 * 離開房間 (Realtime Database)
 * @param {String} roomId - 房間ID
 * @return {Promise<Object>} 離開結果
 */
export const leaveRoom = async (roomId) => {
    try {
        const userId = getOrCreateUserId();

        // 確保用戶已登入
        await ensureAuth();

        // 移除成員
        const memberRef = ref(rtdb, `buddiesRooms/${roomId}/members/${userId}`);
        await remove(memberRef);

        return { success: true };
    } catch (error) {
        console.error("離開房間失敗:", error);
        return { success: false, error: error.message };
    }
};

/**
 * 取得所有 Realtime Database 中的房間列表 (僅限管理員使用)
 * @return {Promise<Array>} 房間列表
 */
export const getAllRooms = async () => {
    try {
        // 先確保用戶已登入
        if (!auth.currentUser) {
            try {
                await ensureAuth();
                console.log('用戶已匿名登入');
            } catch (authError) {
                console.error('匿名登入失敗:', authError);
                return { success: false, error: '請先登入系統', rooms: [] };
            }
        }

        // 確認用戶是否為管理員
        const admin = await isAdminUser();
        if (!admin) {
            console.error('非管理員用戶嘗試獲取所有房間');
            return { success: false, error: '只有管理員可以查看所有房間', rooms: [] };
        }

        // 獲取所有房間數據
        const roomsRef = ref(rtdb, 'buddiesRooms');

        try {
            const snapshot = await get(roomsRef);

            if (snapshot.exists()) {
                const roomsData = snapshot.val();
                const roomsList = Object.keys(roomsData).map(key => ({
                    id: key,
                    ...roomsData[key]
                }));

                // 按創建時間排序
                roomsList.sort((a, b) => {
                    const timeA = a.createdAt || 0;
                    const timeB = b.createdAt || 0;
                    return timeB - timeA;
                });

                console.log(`成功獲取 ${roomsList.length} 個房間數據`);
                return { success: true, rooms: roomsList };
            } else {
                console.log('沒有找到任何房間數據');
                return { success: true, rooms: [] };
            }
        } catch (dbError) {
            console.error('Firebase 獲取房間失敗:', dbError);

            if (dbError.code === 'PERMISSION_DENIED') {
                return { success: false, error: '權限不足，無法讀取房間數據', rooms: [] };
            }

            return { success: false, error: dbError.message, rooms: [] };
        }
    } catch (error) {
        console.error('獲取所有房間失敗:', error);
        return { success: false, error: error.message, rooms: [] };
    }
};

/**
 * 刪除房間 (僅限管理員使用)
 * @param {String} roomId - 房間ID
 * @return {Promise<Object>} 刪除結果
 */
export const deleteRoom = async (roomId) => {
    try {
        // 確認用戶是否為管理員
        const admin = await isAdminUser();
        if (!admin) {
            console.error('非管理員用戶嘗試刪除房間');
            return { success: false, error: '只有管理員可以刪除房間' };
        }

        // 刪除房間
        const roomRef = ref(rtdb, `buddiesRooms/${roomId}`);
        await remove(roomRef);
        console.log(`房間 ${roomId} 已成功刪除`);

        return { success: true };
    } catch (error) {
        console.error('刪除房間失敗:', error);
        return { success: false, error: error.message };
    }
};