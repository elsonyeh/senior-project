-- ==========================================
-- 為 buddies_rooms_archive 表添加 UPDATE 權限
-- ==========================================
-- 執行日期：2025-12-17
-- 問題：UPSERT 需要 UPDATE 權限，但 RLS 策略只有 INSERT 和 SELECT
-- 解決：添加 UPDATE 策略

-- 1. 查看現有策略
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

-- 2. 刪除舊的 UPDATE 策略（如果存在）
DROP POLICY IF EXISTS "Allow all update archive" ON buddies_rooms_archive;

-- 3. 創建新的 UPDATE 策略：允許所有人更新
CREATE POLICY "Allow all update archive"
ON buddies_rooms_archive
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- 4. 驗證所有策略
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
ORDER BY cmd, policyname;

SELECT '✅ buddies_rooms_archive UPDATE 權限已添加' as status;
