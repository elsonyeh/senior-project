-- ============================================================================
-- 檢查 Interactions 相關表的狀態
-- ============================================================================
-- 此腳本檢查所有互動記錄相關的表是否可以正常讀取
-- 執行方式：在 Supabase Dashboard 的 SQL Editor 中執行
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '開始檢查 Interactions 相關表...';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- 1. 檢查 swifttaste_interactions 表
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'swifttaste_interactions'
  ) THEN
    RAISE NOTICE '❌ swifttaste_interactions 表不存在';
    RAISE NOTICE '   需要執行：add-swifttaste-interactions-table.sql';
  ELSE
    RAISE NOTICE '✅ swifttaste_interactions 表已存在';
  END IF;
END $$;

-- 嘗試讀取數據
SELECT
  'swifttaste_interactions' as table_name,
  COUNT(*) as total_rows,
  COUNT(DISTINCT session_id) as unique_sessions,
  COUNT(DISTINCT restaurant_id) as unique_restaurants,
  COUNT(*) FILTER (WHERE action_type = 'view') as view_count,
  COUNT(*) FILTER (WHERE action_type = 'like') as like_count,
  COUNT(*) FILTER (WHERE action_type = 'skip') as skip_count,
  COUNT(*) FILTER (WHERE action_type = 'final') as final_count
FROM swifttaste_interactions
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'swifttaste_interactions');

-- ============================================================================
-- 2. 檢查 user_selection_history 表的時間戳欄位
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_selection_history'
    AND column_name = 'questions_started_at'
  ) THEN
    RAISE NOTICE '✅ user_selection_history 時間戳欄位已添加';
  ELSE
    RAISE NOTICE '❌ user_selection_history 缺少時間戳欄位';
    RAISE NOTICE '   需要執行：add-swifttaste-interactions-table.sql';
  END IF;
END $$;

-- 顯示 user_selection_history 的欄位
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_selection_history'
AND column_name IN (
  'started_at',
  'completed_at',
  'questions_started_at',
  'fun_questions_started_at',
  'restaurants_started_at'
)
ORDER BY column_name;

-- ============================================================================
-- 3. 檢查相關索引
-- ============================================================================

SELECT
  indexname as index_name,
  tablename as table_name
FROM pg_indexes
WHERE tablename IN ('swifttaste_interactions', 'user_selection_history')
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- ============================================================================
-- 4. 檢查輔助函數
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'get_session_interaction_summary'
  ) THEN
    RAISE NOTICE '✅ get_session_interaction_summary() 函數已存在';
  ELSE
    RAISE NOTICE '❌ get_session_interaction_summary() 函數不存在';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'get_restaurant_interaction_stats'
  ) THEN
    RAISE NOTICE '✅ get_restaurant_interaction_stats() 函數已存在';
  ELSE
    RAISE NOTICE '❌ get_restaurant_interaction_stats() 函數不存在';
  END IF;
END $$;

-- ============================================================================
-- 5. 測試基本查詢
-- ============================================================================

-- 測試最近的互動記錄
SELECT
  id,
  session_id,
  restaurant_id,
  action_type,
  created_at
FROM swifttaste_interactions
ORDER BY created_at DESC
LIMIT 5;

-- 測試 user_selection_history
SELECT
  id,
  user_id,
  mode,
  started_at,
  completed_at,
  questions_started_at,
  fun_questions_started_at,
  restaurants_started_at
FROM user_selection_history
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- 6. 總結報告
-- ============================================================================

DO $$
DECLARE
  v_interactions_count bigint;
  v_sessions_count bigint;
  v_has_timestamps boolean;
BEGIN
  -- 計算統計數據
  SELECT COUNT(*) INTO v_interactions_count
  FROM swifttaste_interactions
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'swifttaste_interactions');

  SELECT COUNT(DISTINCT session_id) INTO v_sessions_count
  FROM swifttaste_interactions
  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'swifttaste_interactions');

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_selection_history'
    AND column_name = 'questions_started_at'
  ) INTO v_has_timestamps;

  RAISE NOTICE '========================================';
  RAISE NOTICE '檢查完成！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '統計資料：';
  RAISE NOTICE '  - 總互動記錄數：%', COALESCE(v_interactions_count, 0);
  RAISE NOTICE '  - 總會話數：%', COALESCE(v_sessions_count, 0);
  RAISE NOTICE '  - 時間戳欄位：%', CASE WHEN v_has_timestamps THEN '✅ 已添加' ELSE '❌ 未添加' END;
  RAISE NOTICE '========================================';
END $$;
