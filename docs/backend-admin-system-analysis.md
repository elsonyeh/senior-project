# SwiftTaste 後台管理系統功能整理與分析

## 摘要

SwiftTaste 後台管理系統是一個完整的 Web-based 管理平台，專為餐廳推薦系統設計，提供管理員帳號管理、餐廳數據維護、用戶行為分析、系統監控等功能。系統採用前後端分離架構，前端使用 React.js，後端使用 Supabase（PostgreSQL），實現了基於角色的訪問控制（RBAC）和完整的數據管理功能。

---

## 第一章：系統架構概述

### 1.1 技術架構

```
┌──────────────────────────────────────────────────────────────┐
│                      前端層 (React.js)                        │
├──────────────────────────────────────────────────────────────┤
│  ├─ 路由層: React Router v6                                  │
│  ├─ 頁面層: AdminPage, AdminLogin                            │
│  ├─ 組件層: AdminDashboard (7個標籤頁)                       │
│  ├─ UI層: Modal, Table, Chart Components                     │
│  └─ 狀態層: useState, useEffect, localStorage                │
├──────────────────────────────────────────────────────────────┤
│                      API服務層                                │
├──────────────────────────────────────────────────────────────┤
│  ├─ adminService: 管理員帳號管理                             │
│  ├─ restaurantService: 餐廳數據管理                          │
│  ├─ dataAnalyticsService: 數據分析與統計                     │
│  ├─ roomService: Buddies 房間管理                            │
│  └─ imageService: 圖片上傳與管理                             │
├──────────────────────────────────────────────────────────────┤
│                   後端層 (Supabase)                           │
├──────────────────────────────────────────────────────────────┤
│  ├─ 數據庫: PostgreSQL                                       │
│  ├─ 認證: Row Level Security (RLS)                           │
│  ├─ 存儲: Supabase Storage (圖片)                            │
│  └─ 實時通訊: Realtime Subscriptions                         │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 核心檔案結構

| 檔案路徑 | 行數 | 主要功能 |
|---------|------|---------|
| `src/pages/AdminPage.jsx` | 64 | 管理員權限檢查、儀表板入口 |
| `src/pages/AdminLogin.jsx` | 6 | 登入頁面路由 |
| `src/components/AdminLoginForm.jsx` | 192 | 登入表單、密碼重設 |
| `src/components/AdminDashboard.jsx` | 880 | 核心儀表板、7個功能標籤 |
| `src/components/RestaurantManager.jsx` | 400+ | 餐廳CRUD管理 |
| `src/services/supabaseService.js` | 2300+ | adminService核心API (400+行) |
| `src/services/dataAnalyticsService.js` | 300+ | 數據分析服務 |
| `src/components/admin/DataAnalyticsPage.jsx` | 500+ | 數據可視化儀表板 |
| `src/components/admin/RestaurantRatingUpdater.jsx` | 300+ | Google評分同步工具 |
| `src/components/admin/RecommendationTester.jsx` | 200+ | 推薦算法測試工具 |
| `src/components/admin/RestaurantGeocoder.jsx` | 150+ | 地址地理編碼工具 |

---

## 第二章：用戶認證與權限管理

### 2.1 認證流程架構

#### 2.1.1 登入流程 (AdminLoginForm.jsx → adminService)

```javascript
// 步驟 1: 用戶輸入郵箱和密碼
const result = await adminService.adminLogin(email, password);

// 步驟 2: 後端驗證 (supabaseService.js:1404-1455)
// 查詢 admin_users 表
SELECT * FROM admin_users
WHERE email = $1
  AND password = $2
  AND is_active = true

// 步驟 3: 更新最後登入時間
UPDATE admin_users
SET last_login_at = now()
WHERE id = $adminId

// 步驟 4: 創建 Session (存儲在 localStorage)
{
  email: "admin@example.com",
  isAdmin: true,
  role: "super_admin",
  adminId: "uuid-xxx",
  loginTime: "2025-12-24T10:00:00Z",
  sessionId: "admin_1735027200000_abc123"
}

// 步驟 5: 跳轉至管理後台
navigate("/admin");
```

**檔案位置**:
- 表單組件: `src/components/AdminLoginForm.jsx:60-75`
- 服務方法: `src/services/supabaseService.js:1404-1455`

### 2.2 Session 管理機制

#### 2.2.1 Session 驗證 (24小時過期機制)

**實現位置**: `src/services/supabaseService.js:1461-1505`

```javascript
async isAdminUser() {
  // 1. 檢查 localStorage 是否存在 session
  const adminSession = localStorage.getItem('adminSession');
  if (!adminSession) return false;

  // 2. 檢查 session 過期時間 (24小時)
  const session = JSON.parse(adminSession);
  const loginTime = new Date(session.loginTime);
  const hoursDiff = (now - loginTime) / (1000 * 60 * 60);

  if (hoursDiff > 24) {
    localStorage.removeItem('adminSession');
    return false;
  }

  // 3. 從數據庫二次驗證管理員狀態
  const { data: adminAccount } = await supabase
    .from('admin_users')
    .select('email, is_active')
    .eq('email', session.email)
    .eq('is_active', true)
    .single();

  return adminAccount && session.isAdmin === true;
}
```

**安全特性**:
- 雙重驗證：前端 session + 後端數據庫驗證
- 自動過期：24小時後自動失效
- 狀態同步：檢查 is_active 防止已停用帳號訪問

#### 2.2.2 頁面保護機制 (Route Guard)

**實現位置**: `src/pages/AdminPage.jsx:20-37`

```javascript
useEffect(() => {
  const checkAdminStatus = async () => {
    const adminStatus = await adminService.isAdminUser();
    if (!adminStatus) {
      navigate("/admin-login");  // 無權限重定向
      return;
    }
    setIsAdmin(adminStatus);
  };
  checkAdminStatus();
}, [navigate]);
```

### 2.3 角色權限系統 (RBAC)

#### 2.3.1 權限等級定義

| 角色 | 代碼 | 權限範圍 |
|------|------|---------|
| 超級管理員 | `super_admin` | 所有功能訪問權限 |
| 一般管理員 | `admin` | 受限功能訪問權限 |

#### 2.3.2 權限檢查實現

**檔案位置**: `src/services/supabaseService.js:1686-1708`

```javascript
async isSuperAdmin(email) {
  const { data: adminAccount } = await supabase
    .from('admin_users')
    .select('role')
    .eq('email', email)
    .eq('is_active', true)
    .single();

  return adminAccount?.role === 'super_admin';
}
```

#### 2.3.3 權限控制矩陣

| 操作 | 一般管理員 | 超級管理員 | 實現位置 |
|------|-----------|-----------|---------|
| **管理員帳號管理** ||||
| 修改自己的姓名 | ✓ 允許 | ✓ 允許 | AdminDashboard.jsx:188-196 |
| 修改他人的姓名 | ✗ 禁止 | ✓ 允許 | AdminDashboard.jsx:189 |
| 重設他人密碼 | ✗ 禁止 | ✓ 允許 | AdminDashboard.jsx:269-298 |
| 刪除管理員帳號 | ✗ 禁止 | ✓ 允許 | AdminDashboard.jsx:301-349 |
| 新增管理員 | ✗ 禁止 | ✓ 允許 | AdminDashboard.jsx:387-417 |
| 查看管理員列表 | ✓ 允許 | ✓ 允許 | AdminDashboard.jsx:76-96 |
| **房間管理** ||||
| 查看房間列表 | ✓ 允許 | ✓ 允許 | AdminDashboard.jsx:107-123 |
| 刪除單個房間 | ✗ 禁止 | ✓ 允許 | AdminDashboard.jsx:428-453 |
| 一鍵清空所有房間 | ✗ 禁止 | ✓ 允許 | AdminDashboard.jsx:352-384 |
| **餐廳管理** ||||
| 查看餐廳列表 | ✓ 允許 | ✓ 允許 | RestaurantManager.jsx:62-94 |
| 新增/編輯餐廳 | ✓ 允許 | ✓ 允許 | RestaurantManager.jsx |
| 上傳餐廳圖片 | ✓ 允許 | ✓ 允許 | RestaurantImageUpload.jsx |
| **數據分析** ||||
| 查看統計報表 | ✓ 允許 | ✓ 允許 | DataAnalyticsPage.jsx |
| 強制刷新數據 | ✓ 允許 | ✓ 允許 | DataAnalyticsPage.jsx |

**前端權限檢查示例** (AdminDashboard.jsx:784-816):
```jsx
{(currentAdmin?.isSuperAdmin || admin.email === getCurrentAdminEmail()) ? (
  <>
    <button onClick={() => handleUpdateName(admin.email, admin.name)}>
      修改姓名
    </button>
    {currentAdmin?.isSuperAdmin && (
      <>
        <button onClick={() => handleResetPassword(admin.email)}>
          重設密碼
        </button>
        {admin.email !== getCurrentAdminEmail() && (
          <button onClick={() => handleDeleteAdmin(admin.email)}>
            刪除
          </button>
        )}
      </>
    )}
  </>
) : (
  <span>僅可查看</span>
)}
```

---

## 第三章：管理員帳號管理模組

### 3.1 模組架構

**主要組件**: `AdminDashboard.jsx` (管理員管理標籤頁)
**API服務**: `adminService` (supabaseService.js:1355-2244)
**數據表**: `admin_users`

### 3.2 核心功能

#### 3.2.1 管理員列表展示

**實現位置**: `AdminDashboard.jsx:734-877`

**展示欄位**:
- 管理員姓名 (含在線狀態指示器)
- 電子郵件
- 權限等級 (超級管理員/一般管理員)
- 當前狀態 (線上/離線)
- 上次登入時間
- 操作按鈕 (修改姓名、重設密碼、刪除)

**數據加載邏輯** (AdminDashboard.jsx:48-104):
```javascript
const loadAdminData = async () => {
  // 1. 獲取當前登入管理員資訊
  const currentAdminInfo = await adminService.getCurrentAdmin();
  setCurrentAdmin(currentAdminInfo);

  // 2. 獲取所有管理員列表
  const admins = await adminService.getAllAdmins();

  // 3. 增強管理員資料 (在線狀態、角色名稱)
  const adminListWithStatus = await Promise.all(
    admins.map(async admin => {
      const adminInfo = await adminService.getAdminInfo(admin.email);
      return {
        ...admin,
        isOnline: admin.email === getCurrentAdminEmail(),
        lastLoginTime: getLastLoginTime(admin),
        status: admin.email === getCurrentAdminEmail() ? '線上' : '離線',
        roleName: adminInfo?.roleName || '一般管理員'
      };
    })
  );
  setAdminList(adminListWithStatus);
};
```

#### 3.2.2 新增管理員

**觸發按鈕**: AdminDashboard.jsx:387-393
**模態框組件**: `AdminFormModal` (CustomModal.jsx)
**服務方法**: `adminService.createAdmin()` (supabaseService.js:1885-1993)

**表單欄位驗證**:

| 欄位 | 驗證規則 | 錯誤訊息 |
|------|---------|---------|
| email | 1. 必填<br>2. Email格式 (正則: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)<br>3. 不可重複 | "請輸入有效的電子郵件地址"<br>"此電子郵件已被使用" |
| password | 1. 必填<br>2. 最少6字符 | "密碼長度至少6位" |
| confirmPassword | 必須與 password 一致 | "兩次密碼輸入不一致" |
| name | 1. 選填<br>2. 長度1-50字符<br>3. 僅允許中文、英文、空格 | "姓名只能包含中文、英文和空格" |
| role | 必須為 'admin' 或 'super_admin' | "無效的角色類型" |

**API實現** (supabaseService.js:1885-1993):
```javascript
async createAdmin(adminData) {
  const { email, password, name, role = 'admin' } = adminData;

  // 1. 郵箱格式驗證
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: '請輸入有效的電子郵件地址' };
  }

  // 2. 密碼強度驗證
  if (!password || password.length < 6) {
    return { success: false, error: '密碼長度至少 6 位' };
  }

  // 3. 姓名驗證
  const finalName = name?.trim() || email.split('@')[0];
  if (finalName.length < 1 || finalName.length > 50) {
    return { success: false, error: '姓名長度應在 1-50 字元之間' };
  }

  // 4. 檢查郵箱是否已存在
  const { data: existingAdmin } = await supabase
    .from('admin_users')
    .select('email')
    .eq('email', email)
    .single();

  if (existingAdmin) {
    return { success: false, error: '此電子郵件已被使用' };
  }

  // 5. 插入新管理員
  const { data, error } = await supabase
    .from('admin_users')
    .insert([{
      email,
      password, // 注意：實際應加密
      name: finalName,
      role,
      is_active: true,
      created_at: new Date().toISOString()
    }])
    .select()
    .single();

  return { success: true, data };
}
```

#### 3.2.3 修改管理員姓名

**實現位置**: AdminDashboard.jsx:188-222
**模態框組件**: `InputModal` (CustomModal.jsx:840-857)
**服務方法**: `adminService.updateAdminName()` (supabaseService.js:1801-1883)

**權限邏輯**:
```javascript
// AdminDashboard.jsx:188-196
if (!currentAdmin?.isSuperAdmin && email !== getCurrentAdminEmail()) {
  showNotificationMessage('error', '權限不足', '您只能修改自己的姓名');
  return;
}
```

**姓名驗證規則** (AdminDashboard.jsx:851-856):
```javascript
validation={(value) => {
  if (value.length < 1) return '姓名不能為空';
  if (value.length > 50) return '姓名不能超過 50 字元';
  if (!/^[\u4e00-\u9fa5a-zA-Z\s]+$/.test(value))
    return '姓名只能包含中文、英文和空格';
  return true;
}}
```

**API實現流程**:
```javascript
// supabaseService.js:1801-1883
async updateAdminName(email, newName) {
  // 1. 驗證輸入
  if (!email || !newName) {
    return { success: false, error: '郵箱和姓名不能為空' };
  }

  const trimmedName = newName.trim();
  if (trimmedName.length < 1 || trimmedName.length > 50) {
    return { success: false, error: '姓名長度應在 1-50 字元之間' };
  }

  // 2. 檢查管理員是否存在
  const { data: adminAccount } = await supabase
    .from('admin_users')
    .select('id, name')
    .eq('email', email)
    .eq('is_active', true)
    .single();

  if (!adminAccount) {
    return { success: false, error: '找不到該管理員' };
  }

  // 3. 更新姓名
  const { error } = await supabase
    .from('admin_users')
    .update({
      name: trimmedName,
      updated_at: new Date().toISOString()
    })
    .eq('email', email);

  if (error) throw error;

  // 4. 更新當前 session (如果是自己)
  const adminSession = localStorage.getItem('adminSession');
  if (adminSession) {
    const session = JSON.parse(adminSession);
    if (session.email === email) {
      session.name = trimmedName;
      localStorage.setItem('adminSession', JSON.stringify(session));
    }
  }

  return { success: true };
}
```

#### 3.2.4 重設管理員密碼

**實現位置**: AdminDashboard.jsx:269-298
**權限**: 僅超級管理員可執行
**服務方法**: `adminService.updatePassword()` (supabaseService.js)

**操作流程**:
```javascript
// AdminDashboard.jsx:269-298
const handleResetPassword = async (email) => {
  // 1. 權限檢查
  if (!currentAdmin?.isSuperAdmin) {
    alert('您沒有超級管理員權限');
    return;
  }

  // 2. 提示輸入新密碼
  const newPassword = prompt(`請輸入 ${email} 的新密碼：`);
  if (!newPassword) return;

  // 3. 密碼長度驗證
  if (newPassword.length < 6) {
    alert('密碼長度至少 6 位');
    return;
  }

  // 4. 調用 API 更新密碼
  const result = await adminService.updatePassword(email, newPassword);

  if (result.success) {
    alert(`${email} 的密碼已成功重設為：${newPassword}`);
  }
};
```

**安全注意事項**:
- ⚠️ **明文密碼**: 目前密碼以明文存儲於數據庫，生產環境應使用 bcrypt 加密
- ⚠️ **無審計日誌**: 密碼重設操作未記錄審計日誌
- ✓ **前端驗證**: 最少6字符長度驗證

#### 3.2.5 刪除管理員 (軟刪除)

**實現位置**: AdminDashboard.jsx:301-349
**權限**: 僅超級管理員可執行，且不能刪除自己
**服務方法**: `adminService.deleteAdmin()` (supabaseService.js:1995-2063)

**軟刪除機制**:
```javascript
// supabaseService.js:1995-2063
async deleteAdmin(email) {
  // 1. 驗證是否存在
  const { data: adminAccount } = await supabase
    .from('admin_users')
    .select('id, email, is_active')
    .eq('email', email)
    .single();

  if (!adminAccount) {
    return { success: false, error: '找不到該管理員' };
  }

  // 2. 執行軟刪除 (設置 is_active = false)
  const { error } = await supabase
    .from('admin_users')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('email', email);

  if (error) throw error;
  return { success: true };
}
```

**保護機制** (AdminDashboard.jsx:307-310):
```javascript
if (email === currentAdmin.email) {
  alert('不能刪除自己的帳號');
  return;
}
```

**確認對話框**:
```javascript
if (confirm(`確定要刪除管理員 ${email} 嗎？\n\n注意：此操作不可逆轉！`)) {
  // 執行刪除
}
```

### 3.3 數據同步與刷新

**實現位置**: AdminDashboard.jsx:225-260

```javascript
const reloadAdminList = async () => {
  setLoading(true);
  console.log('🔄 開始同步管理員資料...');

  // 1. 從 Supabase 獲取最新資料
  const admins = await adminService.getAllAdmins();

  // 2. 增強資料 (在線狀態、角色名稱)
  const adminListWithStatus = await Promise.all(
    admins.map(async admin => {
      const adminInfo = await adminService.getAdminInfo(admin.email);
      return {
        ...admin,
        isOnline: admin.email === getCurrentAdminEmail(),
        lastLoginTime: getLastLoginTime(admin),
        status: admin.email === getCurrentAdminEmail() ? '線上' : '離線',
        roleName: adminInfo?.roleName || '一般管理員'
      };
    })
  );

  setAdminList(adminListWithStatus);
  showNotificationMessage('success', '同步成功',
    `已同步 ${adminListWithStatus.length} 個活躍管理員帳號`);
};
```

---

## 第四章：房間管理模組 (Buddies Mode)

### 4.1 模組架構

**主要組件**: `AdminDashboard.jsx` (房間管理標籤頁)
**數據表結構**:
```
buddies_rooms (主表)
  ├─ buddies_members (成員表)
  ├─ buddies_questions (問題答案)
  ├─ buddies_votes (投票記錄)
  ├─ buddies_restaurant_votes (餐廳投票)
  ├─ buddies_recommendations (推薦記錄)
  └─ buddies_final_results (最終結果)
```

### 4.2 房間列表展示

**實現位置**: AdminDashboard.jsx:535-732

**統計儀表板** (AdminDashboard.jsx:538-639):
```jsx
{buddiesStats && (
  <div className="stats-dashboard">
    {/* 總房間數 */}
    <div className="stat-card">
      <div>總房間數</div>
      <div>{buddiesStats.totalRooms}</div>
    </div>

    {/* 活躍房間 (非 completed 狀態) */}
    <div className="stat-card">
      <div>活躍房間</div>
      <div>{buddiesStats.activeRooms}</div>
    </div>

    {/* 已完成房間 */}
    <div className="stat-card">
      <div>已完成房間</div>
      <div>{buddiesStats.completedRooms}</div>
    </div>

    {/* 總參與人次 */}
    <div className="stat-card">
      <div>總參與人次</div>
      <div>{buddiesStats.totalMembers}</div>
    </div>

    {/* 獨立用戶數 */}
    <div className="stat-card">
      <div>獨立用戶數</div>
      <div>{buddiesStats.uniqueUsers}</div>
    </div>

    {/* 其他統計... */}
  </div>
)}
```

**房間列表表格** (AdminDashboard.jsx:670-730):

| 欄位 | 數據來源 | 說明 |
|------|---------|------|
| 房間ID | `buddies_rooms.id` | UUID格式 |
| 房主 | `buddies_rooms.host_name` | 創建房間的用戶姓名 |
| 成員數 | `COUNT(buddies_members)` | 該房間的成員數量 |
| 狀態 | `buddies_rooms.status` | waiting/vote/recommend/completed |
| 創建時間 | `buddies_rooms.created_at` | 格式化為zh-TW本地時間 |
| 最後更新 | `buddies_rooms.last_updated` | 格式化為zh-TW本地時間 |
| 操作 | - | 刪除按鈕 (僅超級管理員) |

### 4.3 房間統計數據

**服務方法**: `adminService.getBuddiesStats()` (supabaseService.js)
**實現位置**: AdminDashboard.jsx:126-142

**統計指標**:

```javascript
const buddiesStats = {
  totalRooms: 50,              // 總房間數
  activeRooms: 30,             // 活躍房間 (status != 'completed')
  completedRooms: 20,          // 已完成房間
  totalMembers: 150,           // 總成員參與次數
  uniqueUsers: 45,             // 獨立用戶數 (去重)
  totalVotes: 500,             // 總投票次數
  finalSelections: 20,         // 最終選定餐廳次數
  avgMembersPerRoom: 3.0,      // 平均每房間成員數
  recentRooms: 8,              // 近7天新增房間
  todayRooms: 2                // 今日新增房間
}
```

**SQL查詢邏輯**:
```sql
-- 總房間數
SELECT COUNT(*) FROM buddies_rooms;

-- 活躍房間
SELECT COUNT(*) FROM buddies_rooms WHERE status != 'completed';

-- 總成員參與次數
SELECT COUNT(*) FROM buddies_members;

-- 獨立用戶數
SELECT COUNT(DISTINCT user_id) FROM buddies_members;

-- 平均每房間成員數
SELECT AVG(member_count) FROM (
  SELECT room_id, COUNT(*) as member_count
  FROM buddies_members
  GROUP BY room_id
);

-- 近7天新增房間
SELECT COUNT(*) FROM buddies_rooms
WHERE created_at >= NOW() - INTERVAL '7 days';

-- 今日新增房間
SELECT COUNT(*) FROM buddies_rooms
WHERE DATE(created_at) = CURRENT_DATE;
```

### 4.4 刪除單個房間

**實現位置**: AdminDashboard.jsx:428-453
**權限**: 僅超級管理員
**服務方法**: `adminService.deleteRoom()` (supabaseService.js:1601-1618)

**刪除流程**:
```javascript
const handleDeleteRoom = async (roomId) => {
  // 1. 權限檢查
  if (!currentAdmin?.isSuperAdmin) {
    alert('您沒有超級管理員權限');
    return;
  }

  // 2. 確認對話框
  if (confirm(`確定要刪除房間 ${roomId} 嗎？\n\n注意：此操作不可逆轉！`)) {
    // 3. 執行刪除 (級聯刪除子表)
    const result = await adminService.deleteRoom(roomId);

    // 4. 刷新列表
    if (result.success) {
      await loadRoomData();
    }
  }
};
```

**級聯刪除機制**:
由於數據庫設置了外鍵約束 (ON DELETE CASCADE)，刪除 `buddies_rooms` 時會自動刪除相關子表數據。

### 4.5 一鍵清空所有房間

**實現位置**: AdminDashboard.jsx:352-384
**權限**: 僅超級管理員
**服務方法**: `adminService.deleteAllRooms()` (supabaseService.js:1624-1679)

**安全確認機制**:
```javascript
const confirmText = `⚠️ 危險操作確認

您即將刪除所有 ${roomList.length} 個房間及其相關資料，包括：
- 房間基本資訊
- 成員資料
- 投票記錄
- 問題答案
- 推薦餐廳記錄

此操作無法復原！請輸入 "DELETE ALL" 確認：`;

const confirmation = prompt(confirmText);

if (confirmation !== 'DELETE ALL') {
  showNotificationMessage('info', '已取消', '刪除操作已取消');
  return;
}
```

**批量刪除順序** (必須按順序刪除以避免外鍵約束衝突):
```javascript
const tables = [
  'buddies_votes',              // 1. 投票記錄
  'buddies_restaurant_votes',   // 2. 餐廳投票
  'buddies_final_results',      // 3. 最終結果
  'buddies_recommendations',    // 4. 推薦記錄
  'buddies_questions',          // 5. 問題答案
  'buddies_members',            // 6. 成員資料
  'buddies_rooms'               // 7. 房間 (主表)
];

for (const table of tables) {
  await supabase.from(table).delete().not('id', 'is', null);
}
```

**刪除統計返回**:
```javascript
{
  success: true,
  message: '所有房間資料已清空',
  deletedCounts: {
    buddies_votes: 500,
    buddies_restaurant_votes: 300,
    buddies_final_results: 50,
    buddies_recommendations: 200,
    buddies_questions: 150,
    buddies_members: 150,
    buddies_rooms: 50
  }
}
```

---

## 第五章:餐廳數據管理模組

### 5.1 模組架構

**主要組件**: `RestaurantManager.jsx` (400+行)
**輔助組件**:
- `RestaurantImageUpload.jsx` - 圖片上傳管理
- `QuickAddRestaurant.jsx` - 快速新增餐廳
**服務層**: `restaurantService` (restaurantService.js)
**數據表**: `restaurants`

### 5.2 餐廳列表管理

**實現位置**: RestaurantManager.jsx:62-94

**數據加載**:
```javascript
const loadRestaurants = async () => {
  setLoading(true);

  // 1. 獲取所有餐廳
  const data = await restaurantService.getRestaurants();
  setRestaurants(data);
  setFilteredRestaurants(data);

  // 2. 計算標籤統計
  const tagMap = {};
  data.forEach(restaurant => {
    if (restaurant.tags && Array.isArray(restaurant.tags)) {
      restaurant.tags.forEach(tag => {
        const cleanTag = tag.trim();
        if (cleanTag) {
          tagMap[cleanTag] = (tagMap[cleanTag] || 0) + 1;
        }
      });
    }
  });

  // 3. 標籤排序 (依數量降序)
  const sortedTags = Object.entries(tagMap)
    .sort(([,a], [,b]) => b - a)
    .map(([tag, count]) => ({ tag, count }));

  setTagStats(sortedTags);
};
```

**展示欄位**:

| 欄位 | 數據類型 | 說明 |
|------|---------|------|
| name | String | 餐廳名稱 |
| address | String | 地址 |
| phone | String | 電話 |
| category | String | 類別 (如:中式、日式、西式) |
| price_range | Integer (1-4) | 價格區間 ($=1, $$=2, $$$=3, $$$$=4) |
| rating | Float | Google評分 (0-5.0) |
| tags | Array<String> | 標籤陣列 (如:["素食", "外帶"]) |
| suggested_people | String | 建議人數 (如:"1~4") |
| is_spicy | Boolean | 是否為辣味餐廳 |
| is_event_partner | Boolean | 是否為活動合作夥伴 |
| images | Array<String> | 圖片URL陣列 |
| latitude | Float | 緯度 |
| longitude | Float | 經度 |
| website_url | String | 官網URL |

### 5.3 標籤管理系統

**標籤統計展示** (RestaurantManager.jsx:69-86):
```javascript
// 自動統計所有餐廳的標籤使用頻率
const tagMap = {};
restaurants.forEach(restaurant => {
  restaurant.tags?.forEach(tag => {
    tagMap[tag] = (tagMap[tag] || 0) + 1;
  });
});

// 按使用次數降序排序
const sortedTags = Object.entries(tagMap)
  .sort(([,a], [,b]) => b - a)
  .map(([tag, count]) => ({ tag, count }));

// 範例輸出:
[
  { tag: "外帶", count: 120 },
  { tag: "素食", count: 85 },
  { tag: "停車方便", count: 67 },
  { tag: "可外送", count: 54 }
]
```

**標籤篩選功能**:
- 支援多標籤選擇
- 兩種匹配模式:
  - `matchMode: 'any'` - 符合任一標籤即可
  - `matchMode: 'all'` - 必須符合所有選中標籤

### 5.4 餐廳圖片管理

**組件**: `RestaurantImageUpload.jsx`
**存儲服務**: Supabase Storage
**存儲桶**: `restaurant-images`

**圖片上傳流程**:
```javascript
// 1. 選擇圖片檔案
<input type="file" accept="image/*" multiple />

// 2. 上傳到 Supabase Storage
const fileName = `${restaurantId}_${Date.now()}_${file.name}`;
const { data, error } = await supabase.storage
  .from('restaurant-images')
  .upload(fileName, file);

// 3. 獲取公開URL
const { data: { publicUrl } } = supabase.storage
  .from('restaurant-images')
  .getPublicUrl(fileName);

// 4. 更新餐廳表的 images 陣列
await supabase
  .from('restaurants')
  .update({
    images: [...existingImages, publicUrl]
  })
  .eq('id', restaurantId);
```

**圖片刪除流程**:
```javascript
// 1. 從 Storage 刪除檔案
const fileName = imageUrl.split('/').pop();
await supabase.storage
  .from('restaurant-images')
  .remove([fileName]);

// 2. 從餐廳表移除URL
const updatedImages = restaurant.images.filter(img => img !== imageUrl);
await supabase
  .from('restaurants')
  .update({ images: updatedImages })
  .eq('id', restaurantId);
```

### 5.5 快速新增餐廳

**組件**: `QuickAddRestaurant.jsx`

**表單欄位**:
```javascript
const newRestaurant = {
  name: '',                  // 必填
  address: '',               // 必填
  phone: '',                 // 選填
  category: '',              // 必填
  price_range: 1,            // 1-4，預設1
  rating: 0,                 // 0-5.0，預設0
  website_url: '',           // 選填
  tags: [],                  // 陣列，選填
  suggested_people: '1~4',   // 預設"1~4"
  is_spicy: 'false',         // 布林字串
  is_event_partner: false,   // 布林值
  images: []                 // 陣列，選填
};
```

**新增流程**:
```javascript
// 1. 表單驗證
if (!newRestaurant.name || !newRestaurant.address || !newRestaurant.category) {
  showToast('請填寫必填欄位', 'error');
  return;
}

// 2. 數據處理
const restaurantData = {
  ...newRestaurant,
  is_spicy: newRestaurant.is_spicy === 'true',
  tags: Array.isArray(newRestaurant.tags)
    ? newRestaurant.tags
    : newRestaurant.tags.split(',').map(t => t.trim())
};

// 3. 插入數據庫
const { data, error } = await supabase
  .from('restaurants')
  .insert([restaurantData])
  .select()
  .single();

// 4. 刷新列表
if (data) {
  await loadRestaurants();
  showToast('餐廳新增成功', 'success');
}
```

---

## 第六章：數據分析與統計模組

### 6.1 模組架構

**主要組件**: `DataAnalyticsPage.jsx` (500+行)
**服務層**: `dataAnalyticsService.js` (300+行)
**圖表庫**: Recharts (LineChart, BarChart, PieChart, RadarChart)

### 6.2 統計維度概覽

```
數據分析儀表板
├─ 用戶統計 (User Stats)
│  ├─ 總用戶數
│  ├─ 註冊用戶數
│  ├─ 活躍用戶數 (近30天)
│  ├─ 匿名會話數
│  └─ 新增用戶數
│
├─ 模式統計 (Mode Stats)
│  ├─ SwiftTaste 使用次數
│  ├─ Buddies 使用次數
│  ├─ 完成率
│  └─ 平均使用時長
│
├─ 互動統計 (Interaction Stats)
│  ├─ 總滑動次數
│  ├─ 總喜歡餐廳數
│  ├─ 最終選擇次數
│  └─ 平均滿意度
│
├─ 餐廳統計 (Restaurant Stats)
│  ├─ 推薦次數排行
│  ├─ 最終選擇排行
│  ├─ 喜歡次數排行
│  └─ 標籤熱度分析
│
├─ 人口統計 (Demographics)
│  ├─ 性別分布
│  ├─ 年齡分組
│  └─ 交叉分析
│
└─ 趨勢分析 (Trend Analysis)
   ├─ 時間序列數據
   ├─ 用戶活躍度趨勢
   └─ 使用模式變化
```

### 6.3 用戶統計分析

**實現位置**: DataAnalyticsPage.jsx:14-21

**統計指標**:
```javascript
const userStats = {
  totalUsers: 150,           // 總用戶數 (user_profiles表)
  registeredUsers: 120,      // 完整註冊用戶 (有姓名、年齡等資料)
  activeUsers: 95,           // 活躍用戶 (近30天有互動)
  anonymousSessions: 30,     // 匿名會話數
  newUsers: 15               // 新增用戶 (時間範圍內)
};
```

**SQL查詢邏輯**:
```sql
-- 總用戶數
SELECT COUNT(*) FROM user_profiles;

-- 註冊用戶數 (有完整資料)
SELECT COUNT(*) FROM user_profiles
WHERE name IS NOT NULL
  AND age IS NOT NULL
  AND gender IS NOT NULL;

-- 活躍用戶 (近30天)
SELECT COUNT(DISTINCT user_id)
FROM swifttaste_interactions
WHERE created_at >= NOW() - INTERVAL '30 days';

-- 新增用戶 (近30天)
SELECT COUNT(*) FROM user_profiles
WHERE created_at >= NOW() - INTERVAL '30 days';
```

### 6.4 SwiftTaste 模式分析

**實現位置**: DataAnalyticsPage.jsx:23-34

**核心指標**:
```javascript
const swiftTasteMetrics = {
  totalSessions: 500,        // 總使用次數
  completedSessions: 350,    // 完成次數 (有最終選擇)
  incompleteSessions: 150,   // 未完成次數
  completionRate: 70.0,      // 完成率 (350/500 = 70%)
  totalSwipes: 25000,        // 總滑動次數
  avgSwipes: 50.0,           // 平均每次滑動次數
  avgLikes: 8.5,             // 平均每次喜歡餐廳數
  avgDuration: 180,          // 平均使用時長 (秒)
  conversionRate: 0.014,     // 轉換率 (最終選擇/滑動次數)
  avgDecisionSpeed: 3.6      // 平均決策速度 (秒/次滑動)
};
```

**計算公式**:
```javascript
completionRate = (completedSessions / totalSessions) * 100;
avgSwipes = totalSwipes / totalSessions;
avgLikes = totalLikes / totalSessions;
conversionRate = finalChoices / totalSwipes;
avgDecisionSpeed = avgDuration / avgSwipes;
```

**數據來源表**: `swifttaste_interactions`

### 6.5 Buddies 模式分析

**實現位置**: DataAnalyticsPage.jsx:36-45

**核心指標**:
```javascript
const buddiesMetrics = {
  totalRooms: 100,           // 總房間數
  completedRooms: 75,        // 完成房間數 (status='completed')
  incompleteRooms: 25,       // 未完成房間數
  avgMembersPerRoom: 3.2,    // 平均每房間成員數
  avgSessionDuration: 420,   // 平均使用時長 (秒)
  completionRate: 75.0,      // 完成率 (75/100 = 75%)
  totalVotes: 1500,          // 總投票次數
  avgVotesPerRoom: 15.0      // 平均每房間投票次數
};
```

**數據來源表**:
- `buddies_rooms` - 房間資料
- `buddies_members` - 成員資料
- `buddies_votes` - 投票資料
- `buddies_restaurant_votes` - 餐廳投票

### 6.6 餐廳成功度分析

**實現位置**: DataAnalyticsPage.jsx:47

**Top 20 餐廳排行榜**:
```javascript
const restaurantSuccessData = [
  {
    restaurantId: "uuid-123",
    restaurantName: "台北101美食街",
    category: "中式",
    totalRecommendations: 250,  // 被推薦次數
    finalChoices: 45,           // 最終選擇次數
    likes: 180,                 // 被喜歡次數
    successRate: 18.0,          // 成功率 (45/250 = 18%)
    conversionRate: 25.0        // 轉換率 (45/180 = 25%)
  },
  // ... 其他餐廳
];
```

**排序邏輯**:
- 主要排序: `finalChoices` (最終選擇次數) 降序
- 次要排序: `successRate` (成功率) 降序

**圖表展示**:
- BarChart: 最終選擇次數
- PieChart: 類別分布
- Table: 詳細排行榜

### 6.7 人口統計分析

**實現位置**: DataAnalyticsPage.jsx:50-54

**性別分布**:
```javascript
const byGender = [
  { gender: '男性', count: 85, percentage: 56.7 },
  { gender: '女性', count: 60, percentage: 40.0 },
  { gender: '其他', count: 5, percentage: 3.3 }
];
```

**年齡分組**:
```javascript
const byAge = [
  { ageGroup: '18-25', count: 45, percentage: 30.0 },
  { ageGroup: '26-35', count: 60, percentage: 40.0 },
  { ageGroup: '36-45', count: 30, percentage: 20.0 },
  { ageGroup: '46+', count: 15, percentage: 10.0 }
];
```

**交叉分析** (性別 × 年齡):
```javascript
const crossAnalysis = [
  {
    ageGroup: '18-25',
    male: 25,
    female: 18,
    other: 2
  },
  {
    ageGroup: '26-35',
    male: 35,
    female: 23,
    other: 2
  },
  // ...
];
```

**SQL查詢**:
```sql
-- 性別分布
SELECT
  gender,
  COUNT(*) as count,
  (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM user_profiles)) as percentage
FROM user_profiles
WHERE gender IS NOT NULL
GROUP BY gender;

-- 年齡分組
SELECT
  CASE
    WHEN age BETWEEN 18 AND 25 THEN '18-25'
    WHEN age BETWEEN 26 AND 35 THEN '26-35'
    WHEN age BETWEEN 36 AND 45 THEN '36-45'
    ELSE '46+'
  END as age_group,
  COUNT(*) as count
FROM user_profiles
WHERE age IS NOT NULL
GROUP BY age_group;
```

### 6.8 趨勢分析

**實現位置**: DataAnalyticsPage.jsx:63

**時間序列數據**:
```javascript
const timeTrendData = [
  {
    date: '2025-12-01',
    swiftTasteSessions: 45,
    buddiesSessions: 12,
    newUsers: 8,
    totalInteractions: 2500
  },
  {
    date: '2025-12-02',
    swiftTasteSessions: 52,
    buddiesSessions: 15,
    newUsers: 10,
    totalInteractions: 2800
  },
  // ... 每日數據
];
```

**圖表展示**:
```jsx
<LineChart data={timeTrendData}>
  <Line
    type="monotone"
    dataKey="swiftTasteSessions"
    stroke="#8884d8"
    name="SwiftTaste使用次數"
  />
  <Line
    type="monotone"
    dataKey="buddiesSessions"
    stroke="#82ca9d"
    name="Buddies使用次數"
  />
  <Line
    type="monotone"
    dataKey="newUsers"
    stroke="#ffc658"
    name="新增用戶"
  />
</LineChart>
```

### 6.9 數據刷新機制

**實現位置**: DataAnalyticsPage.jsx:82-143

**強制刷新功能**:
```javascript
const loadData = async () => {
  setLoading(true);

  try {
    // 並行加載所有數據
    const [
      overviewStats,
      swiftTasteData,
      buddiesData,
      restaurantRankings,
      funQuestions,
      demographics,
      anonymousStats,
      timeTrend,
      // ... 更多統計
    ] = await Promise.all([
      dataAnalyticsService.getUserStats(timeRange),
      dataAnalyticsService.getSwiftTasteMetrics(timeRange),
      dataAnalyticsService.getBuddiesMetrics(timeRange),
      dataAnalyticsService.getRestaurantRankings(timeRange),
      dataAnalyticsService.getFunQuestionStats(),
      dataAnalyticsService.getDemographics(),
      dataAnalyticsService.getAnonymousStats(timeRange),
      dataAnalyticsService.getTimeTrend(timeRange),
      // ...
    ]);

    // 更新所有狀態
    setStats(overviewStats);
    setSwiftTasteMetrics(swiftTasteData);
    setBuddiesMetrics(buddiesData);
    // ...
  } catch (error) {
    setError(error.message);
  } finally {
    setLoading(false);
  }
};
```

**時間範圍選擇器**:
```jsx
<select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
  <option value={7}>近 7 天</option>
  <option value={30}>近 30 天</option>
  <option value={90}>近 90 天</option>
  <option value={365}>近一年</option>
</select>
```

---

## 第七章：系統工具與維護模組

### 7.1 評分更新工具

**組件**: `RestaurantRatingUpdater.jsx` (300+行)
**功能**: 批量更新餐廳的 Google Places 評分

**工作流程**:
```javascript
// 1. 掃描需要更新的餐廳
const restaurantsToUpdate = await supabase
  .from('restaurants')
  .select('*')
  .filter('last_rating_update', 'lt',
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7天前
  );

// 2. 逐一查詢 Google Places API
for (const restaurant of restaurantsToUpdate) {
  const placeData = await googlePlacesAPI.getDetails(restaurant.place_id);

  // 3. 更新數據庫
  await supabase
    .from('restaurants')
    .update({
      rating: placeData.rating,
      last_rating_update: new Date().toISOString()
    })
    .eq('id', restaurant.id);
}
```

**進度顯示**:
```jsx
<div className="update-progress">
  <div>已更新: {updatedCount} / {totalCount}</div>
  <div className="progress-bar">
    <div
      className="progress-fill"
      style={{ width: `${(updatedCount / totalCount) * 100}%` }}
    />
  </div>
</div>
```

### 7.2 地理編碼工具

**組件**: `RestaurantGeocoder.jsx` (150+行)
**功能**: 批量更新缺失經緯度的餐廳

**工作流程**:
```javascript
// 1. 查詢缺失經緯度的餐廳
const { data: restaurantsWithoutCoords } = await supabase
  .from('restaurants')
  .select('*')
  .or('latitude.is.null,longitude.is.null');

// 2. 使用 Google Geocoding API 獲取座標
for (const restaurant of restaurantsWithoutCoords) {
  const geocodeResult = await googleGeocodingAPI.geocode(restaurant.address);

  if (geocodeResult.status === 'OK') {
    const { lat, lng } = geocodeResult.results[0].geometry.location;

    // 3. 更新數據庫
    await supabase
      .from('restaurants')
      .update({
        latitude: lat,
        longitude: lng
      })
      .eq('id', restaurant.id);
  }
}
```

**錯誤處理**:
```javascript
// 記錄失敗的餐廳
const failedRestaurants = [];

if (geocodeResult.status !== 'OK') {
  failedRestaurants.push({
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    address: restaurant.address,
    error: geocodeResult.status
  });
}
```

### 7.3 推薦算法測試工具

**組件**: `RecommendationTester.jsx` (200+行)
**功能**: 測試推薦算法的準確性和性能

**測試參數**:
```javascript
const testConfig = {
  mode: 'swifttaste',           // 'swifttaste' 或 'buddies'
  testUserId: 'uuid-xxx',       // 測試用戶ID
  filters: {
    category: '日式',           // 餐廳類別
    priceRange: [1, 3],         // 價格範圍
    tags: ['素食', '停車方便'],  // 標籤
    distance: 5000              // 距離範圍 (米)
  },
  sampleSize: 20                // 推薦數量
};
```

**測試流程**:
```javascript
// 1. 獲取測試用戶的偏好數據
const userPreferences = await getUserPreferences(testUserId);

// 2. 執行推薦算法
const recommendations = await recommendationService.getRecommendations({
  userId: testUserId,
  mode: testConfig.mode,
  filters: testConfig.filters,
  limit: testConfig.sampleSize
});

// 3. 評估推薦質量
const evaluation = {
  totalRecommendations: recommendations.length,
  matchedPreferences: 0,
  avgRelevanceScore: 0,
  diversityScore: 0,
  executionTime: 0
};

recommendations.forEach(restaurant => {
  // 計算相關性評分
  const relevanceScore = calculateRelevance(restaurant, userPreferences);
  evaluation.avgRelevanceScore += relevanceScore;

  if (relevanceScore > 0.7) {
    evaluation.matchedPreferences++;
  }
});

// 4. 顯示結果
setTestResults(evaluation);
```

**評估指標**:
- 匹配率: 符合用戶偏好的餐廳比例
- 平均相關性評分: 推薦餐廳與用戶偏好的相關度
- 多樣性評分: 推薦餐廳的類別多樣性
- 執行時間: 算法執行效能

---

## 第八章：數據庫架構

### 8.1 核心數據表

#### 8.1.1 admin_users (管理員表)

```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,  -- ⚠️ 明文存儲 (應改用 bcrypt)
  name VARCHAR(100),
  role VARCHAR(20) NOT NULL DEFAULT 'admin',  -- 'admin' | 'super_admin'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_admin_email ON admin_users(email);
CREATE INDEX idx_admin_active ON admin_users(is_active);
```

**預設管理員** (supabaseService.js:1752-1798):
```javascript
const defaultAdmins = [
  {
    email: 'admin@swifttaste.com',
    password: 'admin123456',
    role: 'admin'
  },
  {
    email: 'elson921121@gmail.com',
    password: '921121elson',
    role: 'super_admin'
  },
  {
    email: 'tidalx86arm@gmail.com',
    password: '12345',
    role: 'admin'
  }
];
```

#### 8.1.2 buddies_rooms (房間主表)

```sql
CREATE TABLE buddies_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id TEXT NOT NULL,
  host_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',  -- 'waiting' | 'vote' | 'recommend' | 'completed'
  created_at TIMESTAMP DEFAULT NOW(),
  last_updated TIMESTAMP DEFAULT NOW(),

  -- 外鍵約束
  CONSTRAINT fk_host FOREIGN KEY (host_id)
    REFERENCES user_profiles(user_id)
    ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_rooms_host ON buddies_rooms(host_id);
CREATE INDEX idx_rooms_status ON buddies_rooms(status);
CREATE INDEX idx_rooms_created ON buddies_rooms(created_at);
```

#### 8.1.3 buddies_members (成員表)

```sql
CREATE TABLE buddies_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  is_host BOOLEAN DEFAULT false,
  joined_at TIMESTAMP DEFAULT NOW(),

  -- 外鍵約束
  CONSTRAINT fk_room FOREIGN KEY (room_id)
    REFERENCES buddies_rooms(id)
    ON DELETE CASCADE,

  -- 唯一約束 (防止重複加入)
  CONSTRAINT unique_room_user UNIQUE (room_id, user_id)
);

-- 索引
CREATE INDEX idx_members_room ON buddies_members(room_id);
CREATE INDEX idx_members_user ON buddies_members(user_id);
```

#### 8.1.4 restaurants (餐廳主表)

```sql
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  phone VARCHAR(50),
  category VARCHAR(100) NOT NULL,
  price_range INTEGER CHECK (price_range BETWEEN 1 AND 4),
  rating DECIMAL(2,1) CHECK (rating BETWEEN 0 AND 5),
  website_url TEXT,
  tags TEXT[],  -- PostgreSQL 陣列類型
  suggested_people VARCHAR(20) DEFAULT '1~4',
  is_spicy BOOLEAN DEFAULT false,
  is_event_partner BOOLEAN DEFAULT false,
  images TEXT[],  -- 圖片URL陣列
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  place_id VARCHAR(255),  -- Google Places ID
  last_rating_update TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_restaurants_category ON restaurants(category);
CREATE INDEX idx_restaurants_rating ON restaurants(rating);
CREATE INDEX idx_restaurants_location ON restaurants USING GIST (
  ll_to_earth(latitude, longitude)  -- 地理位置索引
);
CREATE INDEX idx_restaurants_tags ON restaurants USING GIN (tags);  -- 陣列索引
```

### 8.2 關聯表結構

#### 8.2.1 Buddies 相關表

```sql
-- 問題答案表
CREATE TABLE buddies_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL,
  question_data JSONB NOT NULL,  -- 問題答案的 JSON 資料
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT fk_room FOREIGN KEY (room_id)
    REFERENCES buddies_rooms(id) ON DELETE CASCADE
);

-- 投票記錄表
CREATE TABLE buddies_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  question_index INTEGER NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT fk_room FOREIGN KEY (room_id)
    REFERENCES buddies_rooms(id) ON DELETE CASCADE
);

-- 餐廳投票表
CREATE TABLE buddies_restaurant_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL,
  restaurant_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  vote_type TEXT NOT NULL,  -- 'like' | 'dislike' | 'skip'
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT fk_room FOREIGN KEY (room_id)
    REFERENCES buddies_rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants(id) ON DELETE CASCADE
);

-- 最終結果表
CREATE TABLE buddies_final_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL,
  restaurant_id UUID NOT NULL,
  final_selected BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT fk_room FOREIGN KEY (room_id)
    REFERENCES buddies_rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants(id) ON DELETE CASCADE
);

-- 推薦記錄表
CREATE TABLE buddies_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL,
  restaurant_id UUID NOT NULL,
  recommendation_score DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT fk_room FOREIGN KEY (room_id)
    REFERENCES buddies_rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants(id) ON DELETE CASCADE
);
```

#### 8.2.2 SwiftTaste 相關表

```sql
-- 互動記錄表
CREATE TABLE swifttaste_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  restaurant_id UUID NOT NULL,
  action TEXT NOT NULL,  -- 'swipe_left' | 'swipe_right' | 'final_choice'
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT fk_restaurant FOREIGN KEY (restaurant_id)
    REFERENCES restaurants(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_interactions_user ON swifttaste_interactions(user_id);
CREATE INDEX idx_interactions_session ON swifttaste_interactions(session_id);
CREATE INDEX idx_interactions_created ON swifttaste_interactions(created_at);
```

### 8.3 Row Level Security (RLS) 策略

```sql
-- 啟用 RLS
ALTER TABLE buddies_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddies_members ENABLE ROW LEVEL SECURITY;

-- 允許匿名讀取房間資料
CREATE POLICY "Allow anonymous read access"
  ON buddies_rooms
  FOR SELECT
  USING (true);

-- 允許匿名創建房間
CREATE POLICY "Allow anonymous insert"
  ON buddies_rooms
  FOR INSERT
  WITH CHECK (true);

-- 允許房主更新房間
CREATE POLICY "Allow host update"
  ON buddies_rooms
  FOR UPDATE
  USING (host_id = current_setting('request.jwt.claims')::json->>'sub');

-- 成員表策略
CREATE POLICY "Allow read members"
  ON buddies_members
  FOR SELECT
  USING (true);

CREATE POLICY "Allow join room"
  ON buddies_members
  FOR INSERT
  WITH CHECK (true);
```

### 8.4 數據庫觸發器

```sql
-- 自動更新 updated_at 時間戳
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_restaurants_updated_at
  BEFORE UPDATE ON restaurants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 房間狀態變更記錄
CREATE OR REPLACE FUNCTION log_room_status_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO buddies_events (
    room_id,
    event_type,
    event_data
  ) VALUES (
    NEW.id,
    'status_changed',
    jsonb_build_object(
      'old_status', OLD.status,
      'new_status', NEW.status,
      'changed_at', NOW()
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_room_status
  AFTER UPDATE OF status ON buddies_rooms
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_room_status_change();
```

---

## 第九章：系統安全性分析

### 9.1 現有安全機制

#### 9.1.1 認證安全
✓ **24小時 Session 過期**: 防止長期 session 劫持
✓ **雙重驗證**: localStorage + 數據庫驗證
✓ **is_active 檢查**: 防止已停用帳號訪問
✓ **Email 格式驗證**: 防止無效郵箱註冊

#### 9.1.2 權限控制
✓ **角色型訪問控制 (RBAC)**: super_admin / admin 兩級權限
✓ **前端權限檢查**: UI層面的權限判斷
✓ **自我保護機制**: 不能刪除自己的帳號

#### 9.1.3 數據保護
✓ **軟刪除機制**: is_active=false 而非直接刪除
✓ **外鍵約束**: 保證數據完整性
✓ **唯一約束**: 防止重複數據

### 9.2 安全風險與建議改進

#### 9.2.1 高風險問題

**問題 1: 密碼明文存儲**
```javascript
// ❌ 當前實現 (supabaseService.js:1418)
.eq('password', password)  // 明文比對
```

**建議改進**:
```javascript
// ✅ 建議實現
import bcrypt from 'bcryptjs';

// 註冊時加密
const hashedPassword = await bcrypt.hash(password, 10);
await supabase.from('admin_users').insert({
  email,
  password: hashedPassword
});

// 登入時驗證
const isMatch = await bcrypt.compare(password, adminAccount.password);
```

**問題 2: 無 SQL 注入防護**
```javascript
// ⚠️ Supabase 自動處理參數化查詢，但仍需注意
```

**建議**: 永不拼接 SQL 字串，使用 Supabase 的查詢構建器。

**問題 3: 無審計日誌**
```javascript
// ❌ 當前沒有記錄管理員操作日誌
```

**建議改進**:
```sql
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_email VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  target VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 記錄操作示例
INSERT INTO admin_audit_logs (admin_email, action, target, ip_address)
VALUES ('admin@example.com', 'DELETE_ADMIN', 'user@example.com', '192.168.1.1');
```

#### 9.2.2 中風險問題

**問題 4: Session 存儲在 localStorage**
```javascript
// ⚠️ localStorage 易受 XSS 攻擊
localStorage.setItem('adminSession', JSON.stringify(session));
```

**建議改進**:
```javascript
// ✅ 使用 HttpOnly Cookie
document.cookie = `adminSession=${sessionToken}; HttpOnly; Secure; SameSite=Strict`;
```

**問題 5: 無 CSRF 防護**

**建議改進**:
```javascript
// 生成 CSRF Token
const csrfToken = crypto.randomBytes(32).toString('hex');

// 在每個請求中驗證
headers: {
  'X-CSRF-Token': csrfToken
}
```

**問題 6: 無密碼複雜度要求**
```javascript
// ❌ 僅要求最少6字符
if (password.length < 6) return error;
```

**建議改進**:
```javascript
// ✅ 強密碼驗證
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
if (!passwordRegex.test(password)) {
  return {
    success: false,
    error: '密碼必須包含大小寫字母、數字和特殊字符，最少8位'
  };
}
```

### 9.3 最佳實踐建議

#### 9.3.1 認證加固
```javascript
// 1. 實施密碼加鹽 (Salt)
const salt = await bcrypt.genSalt(10);
const hashedPassword = await bcrypt.hash(password, salt);

// 2. 實施密碼歷史 (防止重複使用舊密碼)
CREATE TABLE password_history (
  admin_id UUID,
  password_hash VARCHAR(255),
  created_at TIMESTAMP
);

// 3. 實施登入嘗試限制
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15; // 分鐘

if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
  return { success: false, error: `帳號已鎖定 ${LOCKOUT_DURATION} 分鐘` };
}
```

#### 9.3.2 權限加固
```javascript
// 1. 實施最小權限原則
const permissions = {
  admin: ['VIEW_RESTAURANTS', 'VIEW_ANALYTICS'],
  super_admin: ['*']  // 所有權限
};

// 2. 實施操作驗證
async function requirePermission(action) {
  const currentAdmin = await getCurrentAdmin();
  if (!hasPermission(currentAdmin, action)) {
    throw new Error('權限不足');
  }
}
```

#### 9.3.3 數據保護加固
```javascript
// 1. 敏感數據加密
const crypto = require('crypto');

function encrypt(text) {
  const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// 2. 實施數據備份策略
-- 自動備份
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule('nightly-backup', '0 2 * * *', $$
  SELECT pg_dump('swifttaste_db')
  INTO '/backups/backup_' || to_char(now(), 'YYYYMMDD') || '.sql';
$$);
```

---

## 第十章：系統性能分析

### 10.1 前端性能優化

#### 10.1.1 組件懶加載
```javascript
// App.jsx 中實施
import { lazy, Suspense } from 'react';

const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const DataAnalyticsPage = lazy(() => import('./components/admin/DataAnalyticsPage'));

<Suspense fallback={<Loading />}>
  <AdminDashboard />
</Suspense>
```

#### 10.1.2 數據緩存
```javascript
// dataCache.js (新建檔案)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分鐘

export function getCachedData(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

export function setCachedData(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

// 使用範例
const cachedAdmins = getCachedData('admin_list');
if (cachedAdmins) {
  setAdminList(cachedAdmins);
} else {
  const admins = await adminService.getAllAdmins();
  setCachedData('admin_list', admins);
  setAdminList(admins);
}
```

### 10.2 後端性能優化

#### 10.2.1 數據庫查詢優化
```sql
-- 建立複合索引
CREATE INDEX idx_interactions_user_created
  ON swifttaste_interactions(user_id, created_at DESC);

-- 使用物化視圖 (Materialized View)
CREATE MATERIALIZED VIEW mv_restaurant_stats AS
SELECT
  r.id,
  r.name,
  COUNT(DISTINCT si.user_id) as unique_users,
  COUNT(*) FILTER (WHERE si.action = 'swipe_right') as likes,
  COUNT(*) FILTER (WHERE si.action = 'final_choice') as final_choices
FROM restaurants r
LEFT JOIN swifttaste_interactions si ON r.id = si.restaurant_id
GROUP BY r.id, r.name;

-- 定期刷新
REFRESH MATERIALIZED VIEW mv_restaurant_stats;
```

#### 10.2.2 批量操作優化
```javascript
// ❌ 低效實現 (N+1 查詢)
for (const admin of admins) {
  const info = await adminService.getAdminInfo(admin.email);
  adminList.push({ ...admin, ...info });
}

// ✅ 高效實現 (單次查詢)
const { data: adminList } = await supabase
  .from('admin_users')
  .select('*, admin_roles(*)')
  .eq('is_active', true);
```

### 10.3 性能監控

#### 10.3.1 API 響應時間監控
```javascript
// 在 supabaseService.js 中添加
const performanceMonitor = {
  async measureQuery(queryName, queryFn) {
    const startTime = performance.now();
    const result = await queryFn();
    const endTime = performance.now();

    console.log(`[Performance] ${queryName}: ${(endTime - startTime).toFixed(2)}ms`);

    // 記錄到分析系統
    if (endTime - startTime > 1000) {
      console.warn(`[Slow Query] ${queryName} took ${(endTime - startTime).toFixed(2)}ms`);
    }

    return result;
  }
};

// 使用範例
const admins = await performanceMonitor.measureQuery(
  'getAllAdmins',
  () => supabase.from('admin_users').select('*')
);
```

---

## 結論

### 系統優勢

1. **完整的管理功能**: 涵蓋管理員管理、餐廳管理、數據分析、系統工具等核心模組
2. **清晰的權限架構**: 基於 RBAC 的兩級權限系統，支援精細化權限控制
3. **豐富的數據分析**: 提供多維度統計分析，支援數據驅動的決策
4. **良好的用戶體驗**: 響應式設計、實時更新、友好的錯誤提示
5. **可擴展架構**: 模組化設計，易於添加新功能

### 改進建議

1. **安全加固**:
   - 實施密碼加密 (bcrypt)
   - 添加審計日誌
   - 實施 CSRF 防護
   - 強化密碼複雜度要求

2. **性能優化**:
   - 實施組件懶加載
   - 添加數據緩存層
   - 優化數據庫查詢
   - 使用物化視圖

3. **功能增強**:
   - 添加數據匯出功能
   - 實施操作撤銷/重做
   - 添加批量操作功能
   - 實施實時通知系統

4. **監控與維護**:
   - 添加性能監控
   - 實施自動化測試
   - 建立數據備份策略
   - 添加系統健康檢查

### 技術總結

| 技術層 | 技術選型 | 優勢 |
|--------|---------|------|
| 前端框架 | React.js | 組件化、高效渲染 |
| 路由管理 | React Router v6 | 聲明式路由、URL狀態管理 |
| 狀態管理 | React Hooks | 輕量級、易維護 |
| UI組件 | 自定義組件 | 高度客製化、統一風格 |
| 圖表庫 | Recharts | 聲明式、響應式 |
| 後端服務 | Supabase | 開箱即用、實時更新 |
| 數據庫 | PostgreSQL | 強大查詢、JSONB支援 |
| 存儲服務 | Supabase Storage | 簡單易用、CDN加速 |

---

## 附錄

### 附錄 A: API 方法完整列表

```javascript
// adminService 方法
adminService.getAllAdmins()
adminService.adminLogin(email, password)
adminService.isAdminUser()
adminService.adminLogout()
adminService.resetPassword(email)
adminService.getAllRooms()
adminService.deleteRoom(roomId)
adminService.deleteAllRooms()
adminService.isSuperAdmin(email)
adminService.getAdminInfo(email)
adminService.getCurrentAdmin()
adminService.initializeDefaultAdmins()
adminService.updatePassword(email, newPassword)
adminService.createAdmin(adminData)
adminService.updateAdminName(email, newName)
adminService.deleteAdmin(email)
adminService.getBuddiesStats()

// restaurantService 方法
restaurantService.getRestaurants()
restaurantService.getRestaurantById(id)
restaurantService.createRestaurant(data)
restaurantService.updateRestaurant(id, data)
restaurantService.deleteRestaurant(id)

// restaurantImageService 方法
restaurantImageService.uploadImage(restaurantId, file)
restaurantImageService.deleteImage(restaurantId, imageUrl)
restaurantImageService.getImages(restaurantId)

// dataAnalyticsService 方法
dataAnalyticsService.getUserStats(timeRange)
dataAnalyticsService.getSwiftTasteMetrics(timeRange)
dataAnalyticsService.getBuddiesMetrics(timeRange)
dataAnalyticsService.getRestaurantRankings(timeRange)
dataAnalyticsService.getDemographics()
dataAnalyticsService.getTimeTrend(timeRange)
dataAnalyticsService.forceRefresh()
```

### 附錄 B: 路由配置表

| 路徑 | 組件 | 權限 | 說明 |
|------|------|------|------|
| `/admin-login` | AdminLogin | 公開 | 管理員登入頁 |
| `/admin` | AdminPage | 需認證 | 管理後台主頁 |
| `/admin?tab=restaurants` | AdminDashboard | 需認證 | 餐廳管理標籤 |
| `/admin?tab=buddies` | AdminDashboard | 需認證 | 房間管理標籤 |
| `/admin?tab=admins` | AdminDashboard | 需認證 | 管理員管理標籤 |
| `/admin?tab=ratings` | AdminDashboard | 需認證 | 評分更新標籤 |
| `/admin?tab=analytics` | AdminDashboard | 需認證 | 數據分析標籤 |
| `/admin?tab=testing` | AdminDashboard | 需認證 | 推薦測試標籤 |
| `/admin?tab=geocoder` | AdminDashboard | 需認證 | 地理編碼標籤 |

### 附錄 C: 環境變數配置

```env
# Supabase 配置
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_KEY=your-service-key

# Google API 配置
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-key

# 應用配置
VITE_APP_NAME=SwiftTaste
VITE_APP_ENV=production
```

---

**文檔版本**: 1.0
**生成日期**: 2025-12-24
**作者**: Claude Code Analysis System
**適用論文**: SwiftTaste 餐廳推薦系統後台管理功能分析
