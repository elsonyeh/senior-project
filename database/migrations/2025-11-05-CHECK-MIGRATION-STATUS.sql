-- ============================================================================
-- 檢查資料庫遷移狀態
-- ============================================================================
-- 此腳本檢查所有資料庫優化遷移是否已正確執行
-- 執行方式：在 Supabase Dashboard 的 SQL Editor 中執行
-- ============================================================================

DO $$
DECLARE
  v_status text := '✅ 所有檢查通過';
  v_missing text := '';
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '開始檢查資料庫遷移狀態...';
  RAISE NOTICE '========================================';

  -- 檢查 1: buddies_rooms_archive 表
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'buddies_rooms_archive') THEN
    v_missing := v_missing || E'\n❌ buddies_rooms_archive 表不存在';
    v_status := '❌ 遷移未完成';
  ELSE
    RAISE NOTICE '✅ buddies_rooms_archive 表已存在';
  END IF;

  -- 檢查 2: buddies_events 表
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'buddies_events') THEN
    v_missing := v_missing || E'\n❌ buddies_events 表不存在';
    v_status := '❌ 遷移未完成';
  ELSE
    RAISE NOTICE '✅ buddies_events 表已存在';
  END IF;

  -- 檢查 3: cleanup_logs 表
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cleanup_logs') THEN
    v_missing := v_missing || E'\n❌ cleanup_logs 表不存在';
    v_status := '❌ 遷移未完成';
  ELSE
    RAISE NOTICE '✅ cleanup_logs 表已存在';
  END IF;

  -- 檢查 4: log_buddies_event 函數
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_buddies_event') THEN
    v_missing := v_missing || E'\n❌ log_buddies_event() 函數不存在';
    v_status := '❌ 遷移未完成';
  ELSE
    RAISE NOTICE '✅ log_buddies_event() 函數已存在';
  END IF;

  -- 檢查 5: archive_completed_buddies_room 函數
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'archive_completed_buddies_room') THEN
    v_missing := v_missing || E'\n❌ archive_completed_buddies_room() 函數不存在';
    v_status := '❌ 遷移未完成';
  ELSE
    RAISE NOTICE '✅ archive_completed_buddies_room() 函數已存在';
  END IF;

  -- 檢查 6: cleanup_completed_rooms 函數
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_completed_rooms') THEN
    v_missing := v_missing || E'\n❌ cleanup_completed_rooms() 函數不存在';
    v_status := '❌ 遷移未完成';
  ELSE
    RAISE NOTICE '✅ cleanup_completed_rooms() 函數已存在';
  END IF;

  -- 檢查 7: pg_cron 擴展
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    v_missing := v_missing || E'\n❌ pg_cron 擴展未啟用';
    v_status := '❌ 遷移未完成';
  ELSE
    RAISE NOTICE '✅ pg_cron 擴展已啟用';
  END IF;

  -- 檢查 8: trg_log_room_created 觸發器
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_log_room_created') THEN
    v_missing := v_missing || E'\n❌ trg_log_room_created 觸發器不存在';
    v_status := '❌ 遷移未完成';
  ELSE
    RAISE NOTICE '✅ trg_log_room_created 觸發器已存在';
  END IF;

  RAISE NOTICE '========================================';

  -- 顯示最終狀態
  IF v_status = '✅ 所有檢查通過' THEN
    RAISE NOTICE '%', v_status;
  ELSE
    RAISE NOTICE '%', v_status;
    RAISE NOTICE '缺少的項目：%', v_missing;
    RAISE NOTICE '';
    RAISE NOTICE '請依序執行以下 SQL 遷移腳本：';
    RAISE NOTICE '1. 2025-11-05-create-buddies-archive.sql';
    RAISE NOTICE '2. 2025-11-05-implement-buddies-events-FIXED.sql';
    RAISE NOTICE '3. 啟用 pg_cron 擴展（在 Database → Extensions）';
    RAISE NOTICE '4. 2025-11-05-setup-auto-cleanup.sql';
    RAISE NOTICE '5. 2025-11-05-fix-buddies-events-trigger-v2.sql';
  END IF;

  RAISE NOTICE '========================================';
END $$;

-- 顯示當前資料庫物件統計
SELECT
  'buddies_rooms_archive' as table_name,
  (SELECT COUNT(*) FROM buddies_rooms_archive) as row_count
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'buddies_rooms_archive')
UNION ALL
SELECT
  'buddies_events' as table_name,
  (SELECT COUNT(*) FROM buddies_events) as row_count
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'buddies_events')
UNION ALL
SELECT
  'cleanup_logs' as table_name,
  (SELECT COUNT(*) FROM cleanup_logs) as row_count
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cleanup_logs');
