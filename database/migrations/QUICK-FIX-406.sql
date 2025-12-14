-- ⚡ 快速修復 406 錯誤 - 測試版本
-- 這個腳本會暫時完全禁用 RLS 來測試是否是 RLS 政策的問題

-- ============================================================================
-- 選項 A: 完全禁用 RLS（僅用於測試）
-- ============================================================================
-- 警告：這會讓所有人都能訪問所有數據，僅用於診斷！

ALTER TABLE buddies_members DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  RAISE NOTICE '⚠️ RLS 已禁用 - 僅用於測試！';
  RAISE NOTICE '請測試 406 錯誤是否消失';
  RAISE NOTICE '測試完成後，請運行下方的「重新啟用 RLS」腳本';
END $$;

-- ============================================================================
-- 如果測試成功（406 錯誤消失），請運行以下腳本重新啟用 RLS：
-- ============================================================================

/*
-- 重新啟用 RLS 並使用更簡單的政策
ALTER TABLE buddies_members ENABLE ROW LEVEL SECURITY;

-- 刪除所有現有政策
DROP POLICY IF EXISTS "buddies_members_select_all" ON buddies_members;
DROP POLICY IF EXISTS "buddies_members_insert_all" ON buddies_members;
DROP POLICY IF EXISTS "buddies_members_update_all" ON buddies_members;
DROP POLICY IF EXISTS "buddies_members_delete_all" ON buddies_members;

-- 創建一個超級簡單的政策
CREATE POLICY "buddies_members_all_operations"
  ON buddies_members
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 確保權限正確
GRANT ALL ON buddies_members TO anon, authenticated, service_role;
*/
