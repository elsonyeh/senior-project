// Legacy Firebase compatibility layer - migrated to Supabase
// This file maintains compatibility for existing imports while using Supabase

console.log('Firebase services have been migrated to Supabase');

// Create dummy services for compatibility
const app = null;
const analytics = null;
const db = null;
const auth = {
  currentUser: null,
  onAuthStateChanged: () => {},
  signOut: () => Promise.resolve()
};
const rtdb = null;
const storage = null;

// Admin state management (now uses Supabase)
let isAdmin = false;
const ADMIN_STORAGE_KEY = 'isAdminUser';

/**
 * Legacy admin check function - now redirects to Supabase
 * @param {boolean} forceRefresh - 是否強制重新檢查
 * @return {Promise<boolean>} 是否為管理員
 */
export const checkIsAdmin = async (forceRefresh = false) => {
  console.warn('checkIsAdmin called on legacy Firebase service - please use Supabase adminService instead');
  
  // Check local storage for admin status
  const storedAdminStatus = localStorage.getItem(ADMIN_STORAGE_KEY);
  return storedAdminStatus === 'true';
};

// 導出初始化的服務
export { app, analytics, db, auth, rtdb, storage, isAdmin };