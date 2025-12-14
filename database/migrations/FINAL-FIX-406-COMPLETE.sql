-- 🔧 完整修復 buddies_members 406 錯誤
-- 這個腳本會重建所有政策並明確指定角色

-- ============================================================================
-- 1. 禁用 RLS 並清理
-- ============================================================================
ALTER TABLE buddies_members DISABLE ROW LEVEL SECURITY;

-- 刪除所有現有政策
DROP POLICY IF EXISTS "buddies_members_select_all" ON buddies_members;
DROP POLICY IF EXISTS "buddies_members_insert_all" ON buddies_members;
DROP POLICY IF EXISTS "buddies_members_update_all" ON buddies_members;
DROP POLICY IF EXISTS "buddies_members_delete_all" ON buddies_members;
DROP POLICY IF EXISTS "buddies_members_allow_all" ON buddies_members;
DROP POLICY IF EXISTS "Enable all for buddies_members" ON buddies_members;

DO $$
BEGIN
  RAISE NOTICE '✅ 已清理所有舊政策';
END $$;

-- ============================================================================
-- 2. 重新啟用 RLS
-- ============================================================================
ALTER TABLE buddies_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. 創建明確的政策（分別針對 anon 和 authenticated）
-- ============================================================================

-- SELECT 政策
CREATE POLICY "buddies_members_select"
  ON buddies_members
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT 政策
CREATE POLICY "buddies_members_insert"
  ON buddies_members
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- UPDATE 政策
CREATE POLICY "buddies_members_update"
  ON buddies_members
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE 政策
CREATE POLICY "buddies_members_delete"
  ON buddies_members
  FOR DELETE
  TO anon, authenticated
  USING (true);

DO $$
BEGIN
  RAISE NOTICE '✅ 已創建新的 RLS 政策（明確指定 anon, authenticated）';
END $$;

-- ============================================================================
-- 4. 授予權限（明確授予）
-- ============================================================================
GRANT SELECT ON buddies_members TO anon;
GRANT INSERT ON buddies_members TO anon;
GRANT UPDATE ON buddies_members TO anon;
GRANT DELETE ON buddies_members TO anon;

GRANT SELECT ON buddies_members TO authenticated;
GRANT INSERT ON buddies_members TO authenticated;
GRANT UPDATE ON buddies_members TO authenticated;
GRANT DELETE ON buddies_members TO authenticated;

GRANT ALL ON buddies_members TO service_role;

DO $$
BEGIN
  RAISE NOTICE '✅ 已授予權限給 anon, authenticated, service_role';
END $$;

-- ============================================================================
-- 5. 刷新 PostgREST Schema Cache（如果可能）
-- ============================================================================
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '✅ 已通知 PostgREST 重載 schema';
END $$;

-- ============================================================================
-- 6. 驗證配置
-- ============================================================================

-- 檢查 RLS 狀態
DO $$
DECLARE
  rls_enabled BOOLEAN;
BEGIN
  SELECT rowsecurity INTO rls_enabled
  FROM pg_tables
  WHERE tablename = 'buddies_members';

  IF rls_enabled THEN
    RAISE NOTICE '✅ RLS 已啟用';
  ELSE
    RAISE NOTICE '❌ RLS 未啟用';
  END IF;
END $$;

-- 檢查政策數量
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'buddies_members';

  RAISE NOTICE '✅ 共有 % 個政策', policy_count;
END $$;

-- 列出所有政策
SELECT
  policyname as "政策名稱",
  cmd as "操作",
  roles as "角色"
FROM pg_policies
WHERE tablename = 'buddies_members'
ORDER BY cmd;

-- ============================================================================
-- 7. 測試 anon 角色訪問
-- ============================================================================
SET ROLE anon;

DO $$
DECLARE
  test_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO test_count FROM buddies_members;
  RAISE NOTICE '✅ anon 角色可以查詢，共 % 條記錄', test_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ anon 角色查詢失敗: %', SQLERRM;
END $$;

-- 測試具體查詢
SELECT * FROM buddies_members
WHERE room_id = 'BUS2MX'
LIMIT 1;

RESET ROLE;

-- ============================================================================
-- 8. 最終確認
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 修復完成！';
  RAISE NOTICE '';
  RAISE NOTICE '下一步：';
  RAISE NOTICE '1. 等待 5-10 分鐘讓 PostgREST 更新快取';
  RAISE NOTICE '   （或重啟 Supabase 項目強制更新）';
  RAISE NOTICE '2. 刷新瀏覽器（Ctrl+F5）';
  RAISE NOTICE '3. 測試 Buddies 模式';
  RAISE NOTICE '4. 檢查 406 錯誤是否消失';
  RAISE NOTICE '========================================';
END $$;
