-- ============================================================================
-- 測試 Interactions 表的數據讀取與功能
-- ============================================================================
-- 此腳本測試所有互動記錄相關的表和函數
-- 執行方式：在 Supabase Dashboard 的 SQL Editor 中執行
-- ============================================================================

-- ============================================================================
-- 1. 查看現有數據統計
-- ============================================================================

-- SwiftTaste 互動統計
SELECT
  '📊 SwiftTaste 互動統計' as title,
  COUNT(*) as total_interactions,
  COUNT(DISTINCT session_id) as unique_sessions,
  COUNT(DISTINCT restaurant_id) as unique_restaurants,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) FILTER (WHERE action_type = 'view') as views,
  COUNT(*) FILTER (WHERE action_type = 'like') as likes,
  COUNT(*) FILTER (WHERE action_type = 'skip') as skips,
  COUNT(*) FILTER (WHERE action_type = 'final') as finals
FROM swifttaste_interactions;

-- Buddies 互動統計
SELECT
  '📊 Buddies 互動統計' as title,
  COUNT(*) as total_interactions,
  COUNT(DISTINCT room_id) as unique_rooms,
  COUNT(DISTINCT restaurant_id) as unique_restaurants,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) FILTER (WHERE action_type = 'view') as views,
  COUNT(*) FILTER (WHERE action_type = 'like') as likes,
  COUNT(*) FILTER (WHERE action_type = 'skip') as skips,
  COUNT(*) FILTER (WHERE action_type = 'vote') as votes
FROM buddies_interactions;

-- ============================================================================
-- 2. 查看最新的互動記錄
-- ============================================================================

-- SwiftTaste 最新 5 筆
SELECT
  '🔍 SwiftTaste 最新互動' as title,
  id,
  session_id,
  user_id,
  restaurant_id,
  action_type,
  created_at
FROM swifttaste_interactions
ORDER BY created_at DESC
LIMIT 5;

-- Buddies 最新 5 筆
SELECT
  '🔍 Buddies 最新互動' as title,
  id,
  room_id,
  user_id,
  restaurant_id,
  action_type,
  created_at
FROM buddies_interactions
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- 3. 測試輔助函數（使用實際存在的數據）
-- ============================================================================

-- 測試 SwiftTaste 會話互動摘要（使用實際 session_id）
DO $$
DECLARE
  v_session_id uuid;
BEGIN
  -- 獲取一個實際存在的 session_id
  SELECT session_id INTO v_session_id
  FROM swifttaste_interactions
  LIMIT 1;

  IF v_session_id IS NOT NULL THEN
    RAISE NOTICE '測試會話ID: %', v_session_id;

    -- 執行函數測試
    PERFORM * FROM get_session_interaction_summary(v_session_id);
    RAISE NOTICE '✅ get_session_interaction_summary() 函數測試成功';
  ELSE
    RAISE NOTICE '⚠️  沒有 SwiftTaste 互動數據，無法測試函數';
  END IF;
END $$;

-- 顯示實際結果（如果有數據）
SELECT
  '📈 會話互動摘要' as title,
  *
FROM get_session_interaction_summary(
  (SELECT session_id FROM swifttaste_interactions LIMIT 1)
)
WHERE EXISTS (SELECT 1 FROM swifttaste_interactions LIMIT 1);

-- 測試餐廳互動統計（使用實際 restaurant_id）
SELECT
  '📈 餐廳互動統計' as title,
  *
FROM get_restaurant_interaction_stats(
  (SELECT restaurant_id FROM swifttaste_interactions LIMIT 1)
)
WHERE EXISTS (SELECT 1 FROM swifttaste_interactions LIMIT 1);

-- ============================================================================
-- 4. 測試插入數據（可選）
-- ============================================================================

-- 創建測試數據（如果需要）
DO $$
DECLARE
  v_test_session_id uuid := gen_random_uuid();
  v_test_restaurant_id text := 'ChIJ_test_' || substr(gen_random_uuid()::text, 1, 8);
BEGIN
  -- 插入 SwiftTaste 測試互動
  INSERT INTO swifttaste_interactions (
    session_id,
    user_id,
    restaurant_id,
    action_type
  ) VALUES
    (v_test_session_id, 'test-user-1', v_test_restaurant_id, 'view'),
    (v_test_session_id, 'test-user-1', v_test_restaurant_id, 'like');

  RAISE NOTICE '✅ 成功插入 2 筆 SwiftTaste 測試數據';
  RAISE NOTICE '   Session ID: %', v_test_session_id;
  RAISE NOTICE '   Restaurant ID: %', v_test_restaurant_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️  插入測試數據失敗：%', SQLERRM;
END $$;

-- ============================================================================
-- 5. 驗證數據完整性
-- ============================================================================

-- 檢查是否有孤立的 session_id（不在 user_selection_history 中）
SELECT
  '⚠️  孤立的 session_id' as warning,
  COUNT(DISTINCT si.session_id) as orphaned_sessions
FROM swifttaste_interactions si
LEFT JOIN user_selection_history ush ON si.session_id = ush.id
WHERE ush.id IS NULL;

-- 檢查唯一約束是否有效（應該沒有重複）
SELECT
  '🔍 檢查重複記錄' as check_name,
  session_id,
  restaurant_id,
  action_type,
  COUNT(*) as duplicate_count
FROM swifttaste_interactions
GROUP BY session_id, restaurant_id, action_type
HAVING COUNT(*) > 1;

-- ============================================================================
-- 6. 性能指標
-- ============================================================================

-- 查看表大小
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN ('swifttaste_interactions', 'buddies_interactions')
ORDER BY tablename;

-- 查看索引使用情況
SELECT
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename IN ('swifttaste_interactions', 'buddies_interactions')
ORDER BY tablename, indexname;

-- ============================================================================
-- 完成提示
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Interactions 表測試完成';
  RAISE NOTICE '========================================';
END $$;
