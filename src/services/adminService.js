// adminService.js
// 管理員相關的服務功能

import {
    ref,
    set,
    get,
    update,
    remove,
    query,
    orderByChild,
    equalTo,
    serverTimestamp
} from "firebase/database";
import { 
    getAuth, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
} from "firebase/auth";
import { rtdb, auth, isDevelopment } from "./firebase";

/**
 * 初始化管理員數據
 * 確保在 Realtime Database 中存在管理員數據
 */
export const initializeAdminData = async () => {
    try {
        console.log('初始化管理員數據...');
        
        // 檢查管理員數據是否已存在
        const adminRef = ref(rtdb, 'admins');
        const snapshot = await get(adminRef);
        
        if (!snapshot.exists()) {
            // 獲取當前用戶
            const currentUser = auth.currentUser;
            if (!currentUser || !currentUser.email) {
                return { success: false, error: '需要登入後才能初始化管理員數據' };
            }

            // 創建默認管理員數據
            const defaultAdmins = {};
            
            // 使用當前登入的用戶作為管理員
            defaultAdmins[currentUser.uid] = {
                email: currentUser.email,
                role: 'admin',
                createdAt: new Date().toISOString(),
                uid: currentUser.uid
            };
            
            // 寫入數據庫
            await set(adminRef, defaultAdmins);
            console.log('已創建默認管理員數據:', defaultAdmins);
            
            return { success: true, message: '已初始化管理員數據' };
        } else {
            console.log('管理員數據已存在，檢查是否需要更新');
            
            // 獲取當前用戶
            const currentUser = auth.currentUser;
            if (!currentUser || !currentUser.email) {
                return { success: true, message: '管理員數據已存在，但當前用戶未登入，無法檢查更新' };
            }
            
            // 檢查當前用戶是否已在管理員列表中
            const adminData = snapshot.val();
            
            if (adminData[currentUser.uid]) {
                return { success: true, message: '用戶已在管理員列表中' };
            }
            
            // 檢查是否有匹配的郵箱
            let hasMatchingEmail = false;
            for (const adminId in adminData) {
                if (adminData[adminId].email === currentUser.email) {
                    hasMatchingEmail = true;
                    
                    // 更新 UID 關聯
                    await set(ref(rtdb, `admins/${currentUser.uid}`), {
                        ...adminData[adminId],
                        email: currentUser.email,
                        uid: currentUser.uid,
                        updatedAt: new Date().toISOString()
                    });
                    
                    console.log('已更新用戶在管理員列表中的 UID 關聯');
                    return { success: true, message: '已更新管理員數據' };
                }
            }
            
            // 如果當前沒有管理員，將當前用戶添加為管理員
            if (Object.keys(adminData).length === 0) {
                await set(ref(rtdb, `admins/${currentUser.uid}`), {
                    email: currentUser.email,
                    role: 'admin',
                    createdAt: new Date().toISOString(),
                    uid: currentUser.uid
                });
                
                console.log('已添加當前用戶作為管理員');
                return { success: true, message: '已將當前用戶添加為管理員' };
            }
            
            return { success: false, message: '管理員數據已存在，但當前用戶不在管理員列表中' };
        }
    } catch (error) {
        console.error('初始化管理員數據失敗:', error);
        return { success: false, error: error.message };
    }
};

/**
 * 檢查電子郵件是否為管理員
 * @param {String} email - 電子郵件
 * @return {Promise<Object>} 檢查結果
 */
export const checkAdminByEmail = async (email) => {
    try {
        if (!email) {
            return { success: false, error: '請提供電子郵件' };
        }
        
        // 清理郵箱
        email = email.trim().toLowerCase();
        
        // 獲取所有管理員數據
        const adminRef = ref(rtdb, 'admins');
        const snapshot = await get(adminRef);
        
        if (snapshot.exists()) {
            const admins = snapshot.val();
            
            for (const adminId in admins) {
                if (admins[adminId].email === email) {
                    return { 
                        success: true, 
                        isAdmin: true, 
                        adminData: admins[adminId], 
                        adminId 
                    };
                }
            }
        }
        
        return { success: true, isAdmin: false };
    } catch (error) {
        console.error('檢查管理員郵箱失敗:', error);
        return { success: false, error: error.message };
    }
};

/**
 * 獲取所有管理員列表
 */
export const getAllAdmins = async () => {
    try {
        const adminRef = ref(rtdb, 'admins');
        const snapshot = await get(adminRef);
        
        if (snapshot.exists()) {
            const admins = snapshot.val();
            
            // 轉換為數組格式，方便前端使用
            return {
                success: true,
                admins: Object.entries(admins).map(([id, data]) => ({
                    id,
                    ...data
                }))
            };
        } else {
            return { success: true, admins: [] };
        }
    } catch (error) {
        console.error('獲取管理員列表失敗:', error);
        return { success: false, error: error.message, admins: [] };
    }
};

/**
 * 添加新管理員
 * @param {String} email - 管理員電子郵件
 * @param {String} role - 管理員角色 (預設為 "admin")
 * @param {Boolean} createAccount - 是否創建新用戶帳號 (僅開發環境)
 */
export const addAdmin = async (email, role = 'admin', createAccount = false) => {
    try {
        if (!email) {
            return { success: false, error: '請提供電子郵件' };
        }
        
        // 清理和驗證郵箱
        email = email.trim().toLowerCase();
        if (!email.includes('@')) {
            return { success: false, error: '無效的電子郵件格式' };
        }
        
        // 檢查該郵箱是否已存在
        const adminRef = ref(rtdb, 'admins');
        const snapshot = await get(adminRef);
        
        if (snapshot.exists()) {
            const admins = snapshot.val();
            
            // 檢查是否已經存在此郵箱
            for (const id in admins) {
                if (admins[id].email === email) {
                    return { success: false, error: '此郵箱已經是管理員' };
                }
            }
        }
        
        // 生成唯一ID (使用郵箱的轉換格式)
        const adminId = email.replace(/[.@]/g, '_');
        
        // 添加新管理員
        const newAdminRef = ref(rtdb, `admins/${adminId}`);
        await set(newAdminRef, {
            email: email,
            role: role,
            createdAt: new Date().toISOString(),
            addedBy: auth.currentUser?.email || 'system'
        });
        
        console.log(`已添加新管理員: ${email} (${adminId})`);
        
        // 如果需要創建帳號 (僅開發環境)
        if (createAccount && isDevelopment()) {
            try {
                // 嘗試創建用戶帳號 (可能會失敗如果帳號已存在)
                await createUserWithEmailAndPassword(auth, email, 'admin123')
                    .catch(err => {
                        console.log('創建帳號失敗，可能帳號已存在:', err.message);
                    });
                
                console.log(`已為管理員創建測試帳號: ${email}`);
                return { success: true, message: '已添加新管理員並創建帳號' };
            } catch (accountError) {
                console.error('創建帳號失敗:', accountError);
                return { success: true, message: '已添加新管理員，但創建帳號失敗' };
            }
        }
        
        return { success: true, message: '已添加新管理員' };
    } catch (error) {
        console.error('添加管理員失敗:', error);
        return { success: false, error: error.message };
    }
};

/**
 * 刪除管理員
 * @param {String} adminId - 管理員ID
 */
export const removeAdmin = async (adminId) => {
    try {
        if (!adminId) {
            return { success: false, error: '請提供管理員ID' };
        }
        
        // 檢查該管理員是否存在
        const adminRef = ref(rtdb, `admins/${adminId}`);
        const snapshot = await get(adminRef);
        
        if (!snapshot.exists()) {
            return { success: false, error: '管理員不存在' };
        }
        
        // 檢查是否為唯一管理員
        const allAdminsRef = ref(rtdb, 'admins');
        const allAdminsSnapshot = await get(allAdminsRef);
        
        if (allAdminsSnapshot.exists()) {
            const allAdmins = allAdminsSnapshot.val();
            
            // 如果是唯一管理員，不允許刪除
            if (Object.keys(allAdmins).length === 1 && allAdmins[adminId]) {
                return { success: false, error: '無法刪除唯一的管理員' };
            }
            
            // 如果是當前登入的用戶，需要確認
            if (auth.currentUser && (adminId === auth.currentUser.uid || allAdmins[adminId].email === auth.currentUser.email)) {
                // 這裡可以添加額外的確認邏輯，但目前我們允許自我刪除
                console.log('警告：用戶正在刪除自己的管理員權限');
            }
        }
        
        // 刪除管理員
        await remove(adminRef);
        console.log(`已刪除管理員: ${adminId}`);
        
        return { success: true, message: '已刪除管理員' };
    } catch (error) {
        console.error('刪除管理員失敗:', error);
        return { success: false, error: error.message };
    }
};

/**
 * 更新管理員信息
 * @param {String} adminId - 管理員ID
 * @param {Object} data - 更新的數據
 */
export const updateAdmin = async (adminId, data) => {
    try {
        if (!adminId) {
            return { success: false, error: '請提供管理員ID' };
        }
        
        // 檢查該管理員是否存在
        const adminRef = ref(rtdb, `admins/${adminId}`);
        const snapshot = await get(adminRef);
        
        if (!snapshot.exists()) {
            return { success: false, error: '管理員不存在' };
        }
        
        // 過濾掉不允許修改的字段
        const allowedFields = ['role', 'notes', 'status'];
        const updates = {};
        
        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updates[field] = data[field];
            }
        }
        
        // 添加更新時間
        updates.updatedAt = new Date().toISOString();
        updates.updatedBy = auth.currentUser?.email || 'system';
        
        // 更新管理員
        await update(adminRef, updates);
        console.log(`已更新管理員: ${adminId}`, updates);
        
        return { success: true, message: '已更新管理員信息' };
    } catch (error) {
        console.error('更新管理員信息失敗:', error);
        return { success: false, error: error.message };
    }
};

/**
 * 獲取所有房間信息
 * @param {Number} limit - 限制獲取的房間數量 (預設 50)
 */
export const getAllRooms = async (limit = 50) => {
    try {
        const roomsRef = ref(rtdb, 'buddiesRooms');
        const snapshot = await get(roomsRef);
        
        if (snapshot.exists()) {
            const roomsData = snapshot.val();
            
            // 將房間數據轉換為陣列格式
            const rooms = Object.entries(roomsData)
                .map(([id, data]) => ({
                    id,
                    ...data,
                    // 計算成員數量
                    memberCount: data.members ? Object.keys(data.members).length : 0,
                    // 格式化創建時間
                    createdAt: data.createdAt ? new Date(data.createdAt).toLocaleString() : 'unknown',
                    // 格式化最後活動時間
                    lastActive: data.lastActive ? new Date(data.lastActive).toLocaleString() : 'unknown',
                    // 格式化狀態
                    status: data.status || 'unknown'
                }))
                .slice(0, limit); // 限制數量
            
            // 按創建時間排序 (最新的優先)
            rooms.sort((a, b) => {
                const timeA = a.lastActive || a.createdAt || 0;
                const timeB = b.lastActive || b.createdAt || 0;
                return new Date(timeB) - new Date(timeA);
            });
            
            return { success: true, rooms };
        } else {
            return { success: true, rooms: [] };
        }
    } catch (error) {
        console.error('獲取房間列表失敗:', error);
        return { success: false, error: error.message, rooms: [] };
    }
};

/**
 * 獲取單個房間信息
 * @param {String} roomId - 房間ID
 */
export const getRoomInfo = async (roomId) => {
    try {
        if (!roomId) {
            return { success: false, error: '請提供房間ID' };
        }
        
        const roomRef = ref(rtdb, `buddiesRooms/${roomId}`);
        const snapshot = await get(roomRef);
        
        if (snapshot.exists()) {
            const roomData = snapshot.val();
            
            // 添加計算欄位
            const memberCount = roomData.members ? Object.keys(roomData.members).length : 0;
            const createdAt = roomData.createdAt ? new Date(roomData.createdAt).toLocaleString() : 'unknown';
            const lastActive = roomData.lastActive ? new Date(roomData.lastActive).toLocaleString() : 'unknown';
            
            return {
                success: true,
                room: {
                    id: roomId,
                    ...roomData,
                    memberCount,
                    createdAt,
                    lastActive
                }
            };
        } else {
            return { success: false, error: '房間不存在' };
        }
    } catch (error) {
        console.error('獲取房間信息失敗:', error);
        return { success: false, error: error.message };
    }
};

/**
 * 刪除房間
 * @param {String} roomId - 房間ID
 */
export const deleteRoom = async (roomId) => {
    try {
        if (!roomId) {
            return { success: false, error: '請提供房間ID' };
        }
        
        // 檢查房間是否存在
        const roomRef = ref(rtdb, `buddiesRooms/${roomId}`);
        const snapshot = await get(roomRef);
        
        if (!snapshot.exists()) {
            return { success: false, error: '房間不存在' };
        }
        
        // 刪除房間
        await remove(roomRef);
        console.log(`已刪除房間: ${roomId}`);
        
        return { success: true, message: '已刪除房間' };
    } catch (error) {
        console.error('刪除房間失敗:', error);
        return { success: false, error: error.message };
    }
};

/**
 * 清理空房間（沒有成員或超過一定時間未活動）
 * @param {Number} olderThanHours - 超過多少小時未活動的房間會被清理 (預設 24 小時)
 */
export const cleanupEmptyRooms = async (olderThanHours = 24) => {
    try {
        // 獲取所有房間
        const roomsRef = ref(rtdb, 'buddiesRooms');
        const snapshot = await get(roomsRef);
        
        if (!snapshot.exists()) {
            return { success: true, message: '沒有需要清理的房間', deletedCount: 0 };
        }
        
        const roomsData = snapshot.val();
        const currentTime = Date.now();
        const olderThanMillis = olderThanHours * 60 * 60 * 1000; // 轉換為毫秒
        let deletedCount = 0;
        
        // 檢查每個房間
        for (const [roomId, roomData] of Object.entries(roomsData)) {
            // 檢查房間是否為空
            const isEmpty = !roomData.members || Object.keys(roomData.members).length === 0;
            
            // 檢查房間是否超過指定時間未活動
            let isInactive = false;
            if (roomData.lastActive) {
                const lastActive = new Date(roomData.lastActive).getTime();
                isInactive = (currentTime - lastActive) > olderThanMillis;
            } else if (roomData.createdAt) {
                const createdAt = new Date(roomData.createdAt).getTime();
                isInactive = (currentTime - createdAt) > olderThanMillis;
            }
            
            // 如果房間為空且超過指定時間未活動，則刪除
            if (isEmpty && isInactive) {
                await remove(ref(rtdb, `buddiesRooms/${roomId}`));
                console.log(`已清理空房間: ${roomId}`);
                deletedCount++;
            }
        }
        
        return { 
            success: true, 
            message: `已清理 ${deletedCount} 個空房間`, 
            deletedCount 
        };
    } catch (error) {
        console.error('清理空房間失敗:', error);
        return { success: false, error: error.message };
    }
};

export default {
    initializeAdminData,
    checkAdminByEmail,
    getAllAdmins,
    addAdmin,
    removeAdmin,
    updateAdmin,
    getAllRooms,
    getRoomInfo,
    deleteRoom,
    cleanupEmptyRooms
};