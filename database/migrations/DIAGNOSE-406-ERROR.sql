-- 🔍 診斷 buddies_members 406 錯誤的根本原因
-- 在 Supabase SQL Editor 中運行此腳本

-- ============================================================================
-- 1. 檢查 RLS 狀態
-- ============================================================================
SELECT
  schemaname,
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE tablename = 'buddies_members';

-- ============================================================================
-- 2. 檢查所有 RLS 政策
-- ============================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as "USING clause",
  with_check as "WITH CHECK clause"
FROM pg_policies
WHERE tablename = 'buddies_members'
ORDER BY cmd;

-- ============================================================================
-- 3. 檢查表結構和列
-- ============================================================================
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'buddies_members'
ORDER BY ordinal_position;

-- ============================================================================
-- 4. 測試直接查詢（模擬 anon 角色）
-- ============================================================================
-- 設置角色為 anon
SET ROLE anon;

-- 嘗試查詢
SELECT * FROM buddies_members
WHERE room_id = 'BUS2MX'
  AND user_id = 'b85fffa3-50fc-4942-a758-cb6b49dc915c'
LIMIT 1;

-- 重置角色
RESET ROLE;

-- ============================================================================
-- 5. 檢查是否有觸發器或約束干擾
-- ============================================================================
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'buddies_members';

-- ============================================================================
-- 6. 檢查外鍵約束
-- ============================================================================
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'buddies_members';

-- ============================================================================
-- 7. 檢查是否有數據
-- ============================================================================
SELECT
  COUNT(*) as total_rows,
  COUNT(DISTINCT room_id) as distinct_rooms,
  COUNT(DISTINCT user_id) as distinct_users
FROM buddies_members;

-- 顯示最近的幾條記錄
SELECT * FROM buddies_members
ORDER BY joined_at DESC
LIMIT 5;

-- ============================================================================
-- 8. 檢查 PostgREST 設定（透過 pg_settings）
-- ============================================================================
SELECT name, setting, context
FROM pg_settings
WHERE name LIKE '%postgrest%' OR name LIKE '%pgrst%';

-- ============================================================================
-- 總結報告
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '診斷完成！請檢查上方的輸出結果';
  RAISE NOTICE '========================================';
END $$;
