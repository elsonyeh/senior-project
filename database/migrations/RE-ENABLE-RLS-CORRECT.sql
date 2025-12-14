-- 🔧 正確重新啟用 RLS（在測試確認 RLS 是問題後運行）

-- ============================================================================
-- 重新啟用 RLS
-- ============================================================================
ALTER TABLE buddies_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 刪除所有舊政策（清理）
-- ============================================================================
DO $$
DECLARE
  policy_name TEXT;
BEGIN
  FOR policy_name IN
    SELECT policyname FROM pg_policies WHERE tablename = 'buddies_members'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON buddies_members', policy_name);
    RAISE NOTICE '🗑️ 已刪除政策: %', policy_name;
  END LOOP;
END $$;

-- ============================================================================
-- 創建單一、簡單的政策（避免複雜性）
-- ============================================================================
CREATE POLICY "buddies_members_allow_all"
  ON buddies_members
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 確保權限正確
-- ============================================================================
GRANT ALL ON buddies_members TO anon;
GRANT ALL ON buddies_members TO authenticated;
GRANT ALL ON buddies_members TO service_role;

-- ============================================================================
-- 驗證設置
-- ============================================================================
-- 檢查 RLS 狀態
SELECT
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE tablename = 'buddies_members';

-- 檢查政策
SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'buddies_members';

-- 檢查權限
SELECT
  grantee,
  string_agg(privilege_type, ', ') as privileges
FROM information_schema.table_privileges
WHERE table_name = 'buddies_members'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY grantee;

-- ============================================================================
-- 測試 anon 角色訪問
-- ============================================================================
SET ROLE anon;

SELECT
  room_id,
  user_id,
  user_name,
  is_host
FROM buddies_members
LIMIT 3;

RESET ROLE;

-- ============================================================================
-- 最終確認
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ RLS 已重新啟用並配置簡化政策';
  RAISE NOTICE '請刷新瀏覽器並測試';
  RAISE NOTICE '========================================';
END $$;
