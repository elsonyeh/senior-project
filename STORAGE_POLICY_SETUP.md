# Supabase Storage 政策設置指南

## ⚠️ 重要：不能通過 SQL Editor 設置存儲政策

由於權限限制，無法在 SQL Editor 中直接修改 `storage.objects` 表的政策。需要使用 Supabase Dashboard 的 Storage 界面。

## 📋 正確的設置步驟

### 步驟 0: 清理舊政策 (重要!)
1. 如果可能，先執行 `clean-old-policies.sql` 清理舊政策
2. 如果 SQL 執行失敗，請在 Dashboard 手動刪除以下舊政策：
   - `Users can upload own avatar`
   - `Users can view all avatars`
   - `Users can update own avatar`
   - `Users can delete own avatar`
   - 任何其他 avatar 相關政策

### 步驟 1: 前往 Storage 設置
1. 在 Supabase Dashboard 中，點擊左側選單的 **Storage**
2. 確認 `avatars` bucket 已存在，如果沒有請創建

### 步驟 2: 設置 Bucket 政策
1. 點擊 `avatars` bucket
2. 點擊右上角的 **Settings** (齒輪圖標)
3. 選擇 **Policies** 頁籤
4. **刪除所有現有的 avatar 相關政策**

### 步驟 3: 創建政策

#### 📤 Upload Policy (上傳政策)
```sql
-- 政策名稱: Avatar Upload Policy
-- 操作: INSERT
-- 條件:
bucket_id = 'avatars' AND name LIKE auth.uid()::text || '/%'
```

#### 👁️ View Policy (查看政策)
```sql
-- 政策名稱: Avatar View Policy
-- 操作: SELECT
-- 條件:
bucket_id = 'avatars'
```

#### ✏️ Update Policy (更新政策)
```sql
-- 政策名稱: Avatar Update Policy
-- 操作: UPDATE
-- 條件:
bucket_id = 'avatars' AND name LIKE auth.uid()::text || '/%'
```

#### 🗑️ Delete Policy (刪除政策)
```sql
-- 政策名稱: Avatar Delete Policy
-- 操作: DELETE
-- 條件:
bucket_id = 'avatars' AND name LIKE auth.uid()::text || '/%'
```

## 🎯 政策說明

- **上傳/更新/刪除**：用戶只能操作以自己 UUID 命名的文件夾中的文件
- **查看**：所有人都可以查看頭像（公開存取）
- **安全性**：確保用戶無法操作其他用戶的文件

## 🔍 驗證設置

設置完成後，可以在 SQL Editor 中執行以下查詢來驗證：

```sql
-- 檢查政策是否正確創建
SELECT
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
AND policyname LIKE '%Avatar%';
```

## ⚠️ 注意事項

1. 必須在 Storage 界面設置，不能用 SQL Editor
2. 確保 bucket 設為 public（用於查看頭像）
3. 政策設置後立即生效，無需重啟