-- ==========================================
-- 修復 buddies_rooms_archive 表的 RLS 權限
-- ==========================================
-- 執行日期：2025-12-17
-- 問題：403 Forbidden - 無法插入歸檔記錄
-- 解決：為匿名用戶添加插入權限

-- 1. 檢查 buddies_rooms_archive 表是否存在
SELECT
  table_name,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = table_name
        AND c.relrowsecurity = true
    ) THEN 'RLS 已啟用'
    ELSE 'RLS 未啟用'
  END as rls_status
FROM information_schema.tables
WHERE table_name = 'buddies_rooms_archive';

-- 2. 查看現有的 RLS 策略
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'buddies_rooms_archive';

-- 3. 為 buddies_rooms_archive 表添加寬鬆的 RLS 策略
-- 允許所有人插入和讀取歸檔記錄

-- 刪除舊的策略（如果存在）
DROP POLICY IF EXISTS "Allow anonymous insert archive" ON buddies_rooms_archive;
DROP POLICY IF EXISTS "Allow anonymous read archive" ON buddies_rooms_archive;
DROP POLICY IF EXISTS "Allow all insert archive" ON buddies_rooms_archive;
DROP POLICY IF EXISTS "Allow all read archive" ON buddies_rooms_archive;

-- 創建新的策略：允許所有人插入
CREATE POLICY "Allow all insert archive"
ON buddies_rooms_archive
FOR INSERT
TO public
WITH CHECK (true);

-- 創建新的策略：允許所有人讀取
CREATE POLICY "Allow all read archive"
ON buddies_rooms_archive
FOR SELECT
TO public
USING (true);

-- 4. 確保 RLS 已啟用
ALTER TABLE buddies_rooms_archive ENABLE ROW LEVEL SECURITY;

-- 5. 驗證策略
SELECT
  tablename,
  policyname,
  cmd as operation,
  roles,
  CASE
    WHEN qual = 'true' OR with_check = 'true' THEN '✅ 允許所有'
    ELSE '⚠️ 有限制'
  END as access_level
FROM pg_policies
WHERE tablename = 'buddies_rooms_archive'
ORDER BY policyname;

SELECT '✅ buddies_rooms_archive RLS 權限已修復' as status;
