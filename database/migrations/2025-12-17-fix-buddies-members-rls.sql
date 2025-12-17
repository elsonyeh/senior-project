-- ==========================================
-- 修復 buddies_members 表的 RLS 權限
-- ==========================================
-- 執行日期：2025-12-17
-- 問題：406 Not Acceptable - 無法查詢成員記錄
-- 解決：為匿名用戶添加完整的 CRUD 權限

-- 1. 檢查 buddies_members 表的 RLS 狀態
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
WHERE table_name = 'buddies_members';

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
WHERE tablename = 'buddies_members';

-- 3. 刪除所有舊的策略（清理）
DROP POLICY IF EXISTS "Allow anonymous read members" ON buddies_members;
DROP POLICY IF EXISTS "Allow anonymous insert members" ON buddies_members;
DROP POLICY IF EXISTS "Allow anonymous update members" ON buddies_members;
DROP POLICY IF EXISTS "Allow anonymous delete members" ON buddies_members;
DROP POLICY IF EXISTS "Allow all read members" ON buddies_members;
DROP POLICY IF EXISTS "Allow all insert members" ON buddies_members;
DROP POLICY IF EXISTS "Allow all update members" ON buddies_members;
DROP POLICY IF EXISTS "Allow all delete members" ON buddies_members;

-- 4. 創建新的寬鬆策略：允許所有人進行所有操作
-- SELECT（讀取）權限
CREATE POLICY "Allow all read members"
ON buddies_members
FOR SELECT
TO public
USING (true);

-- INSERT（新增）權限
CREATE POLICY "Allow all insert members"
ON buddies_members
FOR INSERT
TO public
WITH CHECK (true);

-- UPDATE（更新）權限
CREATE POLICY "Allow all update members"
ON buddies_members
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- DELETE（刪除）權限
CREATE POLICY "Allow all delete members"
ON buddies_members
FOR DELETE
TO public
USING (true);

-- 5. 確保 RLS 已啟用
ALTER TABLE buddies_members ENABLE ROW LEVEL SECURITY;

-- 6. 驗證策略
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
WHERE tablename = 'buddies_members'
ORDER BY policyname;

-- 7. 檢查表結構
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'buddies_members'
ORDER BY ordinal_position;

SELECT '✅ buddies_members RLS 權限已修復' as status;
