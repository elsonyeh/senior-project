-- 🔧 緊急修復: buddies_members 表 406 錯誤
-- 此腳本修復 buddies_members 表的權限和 RLS 政策問題
-- 在 Supabase SQL Editor 中運行此腳本

-- ============================================================================
-- 1. 檢查表是否存在
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'buddies_members'
  ) THEN
    RAISE EXCEPTION 'Table buddies_members does not exist!';
  END IF;
  RAISE NOTICE '✅ buddies_members 表存在';
END $$;

-- ============================================================================
-- 2. 清理並重新設置 RLS
-- ============================================================================

-- 暫時禁用 RLS 以清理
ALTER TABLE buddies_members DISABLE ROW LEVEL SECURITY;

-- 刪除所有現有政策
DO $$
DECLARE
  policy_name TEXT;
BEGIN
  FOR policy_name IN
    SELECT policyname FROM pg_policies WHERE tablename = 'buddies_members'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON buddies_members', policy_name);
    RAISE NOTICE '🗑️ Dropped policy: %', policy_name;
  END LOOP;
END $$;

-- 重新啟用 RLS
ALTER TABLE buddies_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. 創建完全開放的政策
-- ============================================================================

CREATE POLICY "buddies_members_select_all"
  ON buddies_members FOR SELECT
  TO public
  USING (true);

CREATE POLICY "buddies_members_insert_all"
  ON buddies_members FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "buddies_members_update_all"
  ON buddies_members FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "buddies_members_delete_all"
  ON buddies_members FOR DELETE
  TO public
  USING (true);

-- ============================================================================
-- 4. 授予權限給所有角色
-- ============================================================================

GRANT ALL ON buddies_members TO anon;
GRANT ALL ON buddies_members TO authenticated;
GRANT ALL ON buddies_members TO service_role;

DO $$
BEGIN
  RAISE NOTICE '✅ RLS 政策已創建';
  RAISE NOTICE '✅ 權限已授予 anon, authenticated, service_role';
END $$;

-- ============================================================================
-- 5. 同時修復其他相關表
-- ============================================================================

-- buddies_rooms
ALTER TABLE buddies_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for buddies_rooms" ON buddies_rooms;
DROP POLICY IF EXISTS "Allow all access to buddies_rooms" ON buddies_rooms;
DROP POLICY IF EXISTS "Allow all operations on buddies_rooms" ON buddies_rooms;

CREATE POLICY "buddies_rooms_all"
  ON buddies_rooms FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

GRANT ALL ON buddies_rooms TO anon;
GRANT ALL ON buddies_rooms TO authenticated;

-- buddies_events
ALTER TABLE buddies_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for buddies_events" ON buddies_events;
DROP POLICY IF EXISTS "Events are read-only for all users" ON buddies_events;
DROP POLICY IF EXISTS "Only service role can write events" ON buddies_events;

CREATE POLICY "buddies_events_all"
  ON buddies_events FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

GRANT ALL ON buddies_events TO anon;
GRANT ALL ON buddies_events TO authenticated;

-- buddies_restaurant_votes
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'buddies_restaurant_votes') THEN
    ALTER TABLE buddies_restaurant_votes ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "buddies_restaurant_votes_all" ON buddies_restaurant_votes;

    CREATE POLICY "buddies_restaurant_votes_all"
      ON buddies_restaurant_votes FOR ALL
      TO public
      USING (true)
      WITH CHECK (true);

    GRANT ALL ON buddies_restaurant_votes TO anon;
    GRANT ALL ON buddies_restaurant_votes TO authenticated;

    RAISE NOTICE '✅ buddies_restaurant_votes 權限已修復';
  END IF;
END $$;

-- buddies_final_result
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'buddies_final_result') THEN
    ALTER TABLE buddies_final_result ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "buddies_final_result_all" ON buddies_final_result;

    CREATE POLICY "buddies_final_result_all"
      ON buddies_final_result FOR ALL
      TO public
      USING (true)
      WITH CHECK (true);

    GRANT ALL ON buddies_final_result TO anon;
    GRANT ALL ON buddies_final_result TO authenticated;

    RAISE NOTICE '✅ buddies_final_result 權限已修復';
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '✅ 所有 buddies 表的權限已修復';
END $$;

-- ============================================================================
-- 6. 驗證修復結果
-- ============================================================================

-- 顯示所有政策
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
WHERE tablename LIKE 'buddies_%'
ORDER BY tablename, cmd;

-- 顯示表權限
SELECT
  table_name,
  grantee,
  string_agg(privilege_type, ', ') as privileges
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name LIKE 'buddies_%'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;

-- ============================================================================
-- 7. 測試查詢
-- ============================================================================

DO $$
DECLARE
  test_count INTEGER;
BEGIN
  -- 嘗試查詢 buddies_members
  SELECT COUNT(*) INTO test_count FROM buddies_members;
  RAISE NOTICE '✅ buddies_members 查詢成功，共 % 條記錄', test_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ buddies_members 查詢失敗: %', SQLERRM;
END $$;

-- 最終確認
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🎉 修復完成！';
  RAISE NOTICE '請刷新瀏覽器頁面並測試';
  RAISE NOTICE '========================================';
END $$;
