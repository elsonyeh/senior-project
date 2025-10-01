# 資料庫安全性設置指南

## 📋 概述

此文檔說明如何執行資料庫安全性修復腳本，以解決 Supabase Database Linter 檢測到的 9 個安全性警告。

## 🔒 修復內容

### 1. **SECURITY DEFINER Views (3個)**
- `questions_with_options`
- `place_cache_stats`
- `fun_question_tags_view`

**修復方式：** 改為 `SECURITY INVOKER` 模式，使用查詢用戶的權限而非 view 創建者的權限。

### 2. **Questions 相關表 RLS (4個)**
- `questions`
- `question_types`
- `question_options`
- `fun_question_option_tags`

**權限設置：**
- ✅ **公開讀取**：所有人（包括未認證用戶）可以讀取問題數據
- 🔒 **管理員寫入**：只有 `admin_users` 表中活躍的管理員可以新增/修改/刪除

### 3. **Google Places Cache 相關表 RLS (2個)**
- `google_places_cache`
- `place_search_regions`

**權限設置：**
- 🔐 **管理員專用**：只有 `admin_users` 表中活躍的管理員可以讀寫

## 🚀 執行步驟

### 步驟 1：開啟 Supabase SQL Editor
1. 登入 [Supabase Dashboard](https://app.supabase.com)
2. 選擇您的專案
3. 點擊左側選單的 **"SQL Editor"**

### 步驟 2：執行修復腳本
1. 點擊 **"New query"** 創建新查詢
2. 開啟專案根目錄的 `database-security-fixes.sql` 檔案
3. 複製所有內容並貼到 SQL Editor
4. 點擊 **"Run"** 執行腳本

### 步驟 3：驗證修復
1. 前往 **"Database"** → **"Linter"**
2. 點擊 **"Run linter"** 重新檢查
3. 確認所有 9 個安全性警告已消失

## 🔑 管理員權限檢查機制

腳本創建了 `public.is_admin()` 函數來檢查用戶是否為管理員：

```sql
CREATE FUNCTION public.is_admin()
RETURNS boolean
AS $$
  -- 從 JWT token 獲取用戶 email
  -- 檢查該 email 是否存在於 admin_users 表且 is_active = true
$$;
```

**工作原理：**
1. 從 Supabase Auth JWT token 中提取用戶的 `email`
2. 查詢 `admin_users` 表，檢查該 email 是否存在且 `is_active = true`
3. 返回布林值供 RLS 政策使用

## 📊 權限矩陣

| 表名 | 未認證用戶 | 一般用戶 | 管理員 |
|------|-----------|---------|--------|
| questions 相關表 | 只讀 ✅ | 只讀 ✅ | 讀寫 ✅ |
| google_places_cache | 無權限 ❌ | 無權限 ❌ | 讀寫 ✅ |
| place_search_regions | 無權限 ❌ | 無權限 ❌ | 讀寫 ✅ |

## ⚠️ 重要提醒

### 關於 Service Role Key
- 使用 **Service Role Key** 的後端操作**不受 RLS 限制**
- 前端使用 **Anon Key** 的操作**會受 RLS 限制**
- 確保 Service Role Key 僅在伺服器端使用，不要暴露在前端代碼中

### 關於 JWT Token
此設置假設：
1. 您使用 Supabase Auth 進行身份驗證
2. 管理員登入後，JWT token 中包含 `email` 欄位
3. 該 email 與 `admin_users` 表中的 email 相符

如果您使用自定義認證方式，可能需要修改 `is_admin()` 函數。

## 🧪 測試建議

### 測試 1：管理員權限
```javascript
// 使用管理員帳號登入
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'admin@example.com',
  password: 'password'
});

// 嘗試新增問題（應該成功）
const { data: newQuestion, error: insertError } = await supabase
  .from('questions')
  .insert({ question_text: 'Test Question' });
```

### 測試 2：公開讀取
```javascript
// 未登入狀態
const { data, error } = await supabase
  .from('questions')
  .select('*');

// 應該成功返回問題列表
```

### 測試 3：非管理員寫入
```javascript
// 使用非管理員帳號登入（或未登入）
const { data, error } = await supabase
  .from('questions')
  .insert({ question_text: 'Test Question' });

// 應該失敗，返回權限錯誤
```

## 🔧 疑難排解

### 問題：執行腳本後出現錯誤
**解決方案：**
1. 確認您的 Supabase 專案已啟用 Auth 功能
2. 檢查 `admin_users` 表是否存在且包含 `email` 和 `is_active` 欄位
3. 確認您有足夠的權限執行 SQL 腳本

### 問題：管理員無法寫入數據
**可能原因：**
1. JWT token 中沒有包含 `email` 欄位
2. `admin_users` 表中的 email 與登入 email 不符
3. `is_active` 欄位設為 `false`

**除錯步驟：**
```sql
-- 檢查當前用戶
SELECT current_setting('request.jwt.claims', true)::json->>'email';

-- 檢查 admin_users 表
SELECT * FROM admin_users WHERE is_active = true;

-- 測試 is_admin() 函數
SELECT public.is_admin();
```

### 問題：前端仍然可以未經授權寫入
**檢查項目：**
1. 確認前端使用的是 **Anon Key** 而非 Service Role Key
2. 確認 RLS 政策已正確啟用
3. 清除瀏覽器快取並重新整理

## 📝 後續建議

1. **定期運行 Database Linter** 檢查新的安全性問題
2. **監控 RLS 政策**的效能影響
3. **記錄管理員操作**以供審計
4. **定期審查**管理員帳號列表

## 🔗 相關文檔

- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
