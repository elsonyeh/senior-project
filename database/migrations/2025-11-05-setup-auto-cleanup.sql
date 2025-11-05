/**
 * 設置自動清理與數據導出系統
 *
 * 日期: 2025-11-05
 * 目的: 使用 pg_cron 實現每日自動清理，保持資料庫輕量高效
 *
 * 參考:
 * - docs/DATA-LIFECYCLE-MANAGEMENT.md
 * - docs/DATABASE-AUDIT-REPORT.md
 *
 * 清理策略:
 * - 完成的房間：24小時後清理（已歸檔）
 * - 未完成的房間：30天後清理（防止垃圾累積）
 * - 事件記錄：保留1年後歸檔到 buddies_events_archive
 *
 * 注意：此腳本需要 Supabase 項目啟用 pg_cron 擴展
 */

-- ============================================================================
-- 1. 啟用 pg_cron 擴展
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

COMMENT ON EXTENSION pg_cron IS '定期任務調度系統（PostgreSQL cron）';

-- ============================================================================
-- 2. 創建清理日誌表（追蹤清理歷史）
-- ============================================================================

CREATE TABLE IF NOT EXISTS cleanup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cleanup_type text NOT NULL,              -- 'completed_rooms', 'abandoned_rooms', 'old_events'
  rooms_deleted integer DEFAULT 0,         -- 清理的房間數
  events_archived integer DEFAULT 0,       -- 歸檔的事件數
  execution_time_ms integer,               -- 執行時間（毫秒）
  status text NOT NULL,                    -- 'success', 'partial', 'failed'
  error_message text,                      -- 錯誤訊息（如有）
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cleanup_logs_created_at
  ON cleanup_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cleanup_logs_type
  ON cleanup_logs(cleanup_type);

COMMENT ON TABLE cleanup_logs IS '自動清理執行日誌';

-- ============================================================================
-- 3. 創建安全清理函數
-- ============================================================================

-- 3.1 清理已完成並已歸檔的房間（24小時後）
CREATE OR REPLACE FUNCTION cleanup_completed_rooms()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_deleted_count integer := 0;
  v_error_message text;
  v_status text := 'success';
BEGIN
  v_start_time := clock_timestamp();

  BEGIN
    -- 只刪除已歸檔的完成房間（雙重保險）
    WITH deleted AS (
      DELETE FROM buddies_rooms
      WHERE status = 'completed'
        AND completed_at < now() - interval '24 hours'
        AND id IN (SELECT id FROM buddies_rooms_archive)
      RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted;

    v_end_time := clock_timestamp();

    -- 記錄日誌
    INSERT INTO cleanup_logs (
      cleanup_type, rooms_deleted, execution_time_ms, status
    ) VALUES (
      'completed_rooms',
      v_deleted_count,
      EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::integer,
      v_status
    );

    -- 記錄清理事件
    IF v_deleted_count > 0 THEN
      PERFORM log_buddies_event(
        NULL,  -- room_id 為空（系統級事件）
        'room_cleaned',
        NULL,
        jsonb_build_object(
          'cleanup_type', 'completed_rooms',
          'rooms_deleted', v_deleted_count,
          'threshold', '24 hours'
        )
      );
    END IF;

  EXCEPTION WHEN OTHERS THEN
    v_status := 'failed';
    v_error_message := SQLERRM;

    -- 記錄錯誤日誌
    INSERT INTO cleanup_logs (
      cleanup_type, rooms_deleted, status, error_message
    ) VALUES (
      'completed_rooms', v_deleted_count, 'failed', v_error_message
    );
  END;

  RETURN jsonb_build_object(
    'status', v_status,
    'deleted_count', v_deleted_count,
    'error', v_error_message
  );
END;
$$;

COMMENT ON FUNCTION cleanup_completed_rooms IS '清理24小時前完成且已歸檔的房間';

-- 3.2 清理超過30天的未完成房間（防止垃圾累積）
CREATE OR REPLACE FUNCTION cleanup_abandoned_rooms()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_deleted_count integer := 0;
  v_error_message text;
  v_status text := 'success';
BEGIN
  v_start_time := clock_timestamp();

  BEGIN
    -- 先歸檔（保留數據供分析為何未完成）
    INSERT INTO buddies_rooms_archive (
      id, room_code, host_id, host_name, status,
      members_data, member_answers, collective_answers,
      recommendations, votes, questions,
      member_count, questions_count,
      created_at, archived_at,
      schema_version, archived_by
    )
    SELECT
      id, room_code, host_id, host_name, status,
      members_data, member_answers, collective_answers,
      recommendations, votes, questions,
      jsonb_array_length(COALESCE(members_data, '[]'::jsonb)),
      jsonb_array_length(COALESCE(questions, '[]'::jsonb)),
      created_at, now(),
      '1.0', 'cleanup_abandoned'
    FROM buddies_rooms
    WHERE status != 'completed'
      AND created_at < now() - interval '30 days'
    ON CONFLICT (id) DO NOTHING;

    -- 刪除未完成的舊房間
    WITH deleted AS (
      DELETE FROM buddies_rooms
      WHERE status != 'completed'
        AND created_at < now() - interval '30 days'
      RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted;

    v_end_time := clock_timestamp();

    -- 記錄日誌
    INSERT INTO cleanup_logs (
      cleanup_type, rooms_deleted, execution_time_ms, status
    ) VALUES (
      'abandoned_rooms',
      v_deleted_count,
      EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::integer,
      v_status
    );

    -- 記錄清理事件
    IF v_deleted_count > 0 THEN
      PERFORM log_buddies_event(
        NULL,
        'room_cleaned',
        NULL,
        jsonb_build_object(
          'cleanup_type', 'abandoned_rooms',
          'rooms_deleted', v_deleted_count,
          'threshold', '30 days'
        )
      );
    END IF;

  EXCEPTION WHEN OTHERS THEN
    v_status := 'failed';
    v_error_message := SQLERRM;

    INSERT INTO cleanup_logs (
      cleanup_type, rooms_deleted, status, error_message
    ) VALUES (
      'abandoned_rooms', v_deleted_count, 'failed', v_error_message
    );
  END;

  RETURN jsonb_build_object(
    'status', v_status,
    'deleted_count', v_deleted_count,
    'error', v_error_message
  );
END;
$$;

COMMENT ON FUNCTION cleanup_abandoned_rooms IS '清理30天前創建但未完成的房間';

-- 3.3 歸檔超過1年的事件記錄
CREATE OR REPLACE FUNCTION cleanup_old_events()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_archived_count integer := 0;
  v_error_message text;
  v_status text := 'success';
BEGIN
  v_start_time := clock_timestamp();

  BEGIN
    -- 使用已存在的 archive_old_events 函數
    v_archived_count := archive_old_events(365);

    v_end_time := clock_timestamp();

    -- 記錄日誌
    INSERT INTO cleanup_logs (
      cleanup_type, events_archived, execution_time_ms, status
    ) VALUES (
      'old_events',
      v_archived_count,
      EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::integer,
      v_status
    );

  EXCEPTION WHEN OTHERS THEN
    v_status := 'failed';
    v_error_message := SQLERRM;

    INSERT INTO cleanup_logs (
      cleanup_type, events_archived, status, error_message
    ) VALUES (
      'old_events', v_archived_count, 'failed', v_error_message
    );
  END;

  RETURN jsonb_build_object(
    'status', v_status,
    'archived_count', v_archived_count,
    'error', v_error_message
  );
END;
$$;

COMMENT ON FUNCTION cleanup_old_events IS '歸檔超過1年的事件記錄';

-- 3.4 綜合清理函數（執行所有清理任務）
CREATE OR REPLACE FUNCTION run_daily_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_result_completed jsonb;
  v_result_abandoned jsonb;
  v_result_events jsonb;
  v_total_deleted integer := 0;
BEGIN
  -- 執行清理任務
  v_result_completed := cleanup_completed_rooms();
  v_result_abandoned := cleanup_abandoned_rooms();
  v_result_events := cleanup_old_events();

  v_total_deleted := COALESCE((v_result_completed->>'deleted_count')::integer, 0)
                   + COALESCE((v_result_abandoned->>'deleted_count')::integer, 0);

  RETURN jsonb_build_object(
    'timestamp', now(),
    'total_rooms_deleted', v_total_deleted,
    'completed_rooms', v_result_completed,
    'abandoned_rooms', v_result_abandoned,
    'old_events', v_result_events
  );
END;
$$;

COMMENT ON FUNCTION run_daily_cleanup IS '執行每日綜合清理任務';

-- ============================================================================
-- 4. 設置 pg_cron 定期任務
-- ============================================================================

-- 4.1 每天凌晨 3:00 執行清理
SELECT cron.schedule(
  'daily-buddies-cleanup',           -- 任務名稱
  '0 3 * * *',                       -- 每天 03:00 (Cron 表達式)
  $$SELECT run_daily_cleanup();$$   -- 執行的 SQL
);

COMMENT ON EXTENSION pg_cron IS 'daily-buddies-cleanup: 每天凌晨 3:00 執行 Buddies 房間清理';

-- 4.2 每週一凌晨 4:00 清理舊的清理日誌（保留90天）
SELECT cron.schedule(
  'weekly-cleanup-logs-cleanup',
  '0 4 * * 1',  -- 每週一 04:00
  $$
    DELETE FROM cleanup_logs
    WHERE created_at < now() - interval '90 days';
  $$
);

-- ============================================================================
-- 5. 創建監控視圖
-- ============================================================================

-- 5.1 清理健康狀況視圖
CREATE OR REPLACE VIEW cleanup_health_status AS
SELECT
  CURRENT_DATE as check_date,
  -- 待清理的完成房間
  (SELECT COUNT(*) FROM buddies_rooms
   WHERE status = 'completed'
     AND completed_at < now() - interval '24 hours') as pending_completed_rooms,
  -- 待清理的放棄房間
  (SELECT COUNT(*) FROM buddies_rooms
   WHERE status != 'completed'
     AND created_at < now() - interval '30 days') as pending_abandoned_rooms,
  -- 待歸檔的舊事件
  (SELECT COUNT(*) FROM buddies_events
   WHERE created_at < now() - interval '365 days') as pending_old_events,
  -- 最近一次清理時間
  (SELECT MAX(created_at) FROM cleanup_logs) as last_cleanup,
  -- 最近一次清理狀態
  (SELECT status FROM cleanup_logs
   ORDER BY created_at DESC LIMIT 1) as last_cleanup_status,
  -- 過去7天清理統計
  (SELECT SUM(rooms_deleted) FROM cleanup_logs
   WHERE created_at >= now() - interval '7 days') as rooms_deleted_last_week,
  (SELECT SUM(events_archived) FROM cleanup_logs
   WHERE created_at >= now() - interval '7 days') as events_archived_last_week;

COMMENT ON VIEW cleanup_health_status IS '清理系統健康狀況視圖';

-- 5.2 清理歷史統計視圖
CREATE OR REPLACE VIEW cleanup_history_stats AS
SELECT
  DATE(created_at) as cleanup_date,
  cleanup_type,
  SUM(rooms_deleted) as total_rooms_deleted,
  SUM(events_archived) as total_events_archived,
  AVG(execution_time_ms) as avg_execution_time_ms,
  COUNT(*) FILTER (WHERE status = 'success') as successful_runs,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_runs
FROM cleanup_logs
GROUP BY DATE(created_at), cleanup_type
ORDER BY cleanup_date DESC, cleanup_type;

COMMENT ON VIEW cleanup_history_stats IS '清理歷史統計視圖';

-- ============================================================================
-- 6. 創建手動清理輔助函數（供管理員使用）
-- ============================================================================

-- 6.1 手動觸發立即清理
CREATE OR REPLACE FUNCTION manual_cleanup_now()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- 執行清理
  v_result := run_daily_cleanup();

  -- 發送通知
  RAISE NOTICE '✅ 手動清理完成：%', v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION manual_cleanup_now IS '手動觸發立即清理（管理員使用）';

-- 6.2 檢查清理系統狀態
CREATE OR REPLACE FUNCTION check_cleanup_system()
RETURNS TABLE(
  component text,
  status text,
  details jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    'pg_cron 擴展'::text,
    CASE WHEN EXISTS (SELECT FROM pg_extension WHERE extname = 'pg_cron')
      THEN '✅ 已啟用' ELSE '❌ 未啟用' END,
    NULL::jsonb
  UNION ALL
  SELECT
    'cleanup_logs 表'::text,
    CASE WHEN EXISTS (SELECT FROM information_schema.tables
                      WHERE table_name = 'cleanup_logs')
      THEN '✅ 已創建' ELSE '❌ 未創建' END,
    jsonb_build_object('total_logs', (SELECT COUNT(*) FROM cleanup_logs))
  UNION ALL
  SELECT
    '定期任務'::text,
    CASE WHEN EXISTS (SELECT FROM cron.job WHERE jobname = 'daily-buddies-cleanup')
      THEN '✅ 已排程' ELSE '❌ 未排程' END,
    (SELECT jsonb_agg(jsonb_build_object('jobname', jobname, 'schedule', schedule))
     FROM cron.job WHERE jobname LIKE '%cleanup%')
  UNION ALL
  SELECT
    '清理函數'::text,
    '✅ 已創建',
    jsonb_build_object(
      'cleanup_completed_rooms', EXISTS (SELECT FROM pg_proc WHERE proname = 'cleanup_completed_rooms'),
      'cleanup_abandoned_rooms', EXISTS (SELECT FROM pg_proc WHERE proname = 'cleanup_abandoned_rooms'),
      'cleanup_old_events', EXISTS (SELECT FROM pg_proc WHERE proname = 'cleanup_old_events'),
      'run_daily_cleanup', EXISTS (SELECT FROM pg_proc WHERE proname = 'run_daily_cleanup')
    );
END;
$$;

COMMENT ON FUNCTION check_cleanup_system IS '檢查清理系統完整性';

-- ============================================================================
-- 7. 設置警報觸發器（可選）
-- ============================================================================

-- 7.1 當待清理房間過多時發送警報
CREATE OR REPLACE FUNCTION check_pending_cleanup_alert()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_pending_rooms integer;
BEGIN
  SELECT COUNT(*) INTO v_pending_rooms
  FROM buddies_rooms
  WHERE status = 'completed'
    AND completed_at < now() - interval '72 hours';  -- 超過3天未清理

  IF v_pending_rooms > 100 THEN
    RAISE WARNING '⚠️ 清理警報：有 % 個房間超過72小時未清理，可能清理任務失敗！', v_pending_rooms;

    -- 記錄到清理日誌
    INSERT INTO cleanup_logs (
      cleanup_type, rooms_deleted, status, error_message
    ) VALUES (
      'alert', 0, 'warning',
      format('%s 個房間超過72小時未清理', v_pending_rooms)
    );
  END IF;
END;
$$;

-- ============================================================================
-- 8. 驗證與測試
-- ============================================================================

DO $$
DECLARE
  cron_enabled BOOLEAN;
  jobs_count integer;
  functions_count integer;
BEGIN
  -- 檢查 pg_cron 是否啟用
  cron_enabled := EXISTS (SELECT FROM pg_extension WHERE extname = 'pg_cron');

  -- 計算定期任務數量
  IF cron_enabled THEN
    SELECT COUNT(*) INTO jobs_count
    FROM cron.job
    WHERE jobname LIKE '%cleanup%';
  ELSE
    jobs_count := 0;
  END IF;

  -- 計算清理函數數量
  SELECT COUNT(*) INTO functions_count
  FROM pg_proc
  WHERE proname LIKE '%cleanup%' AND proname NOT LIKE 'pg_%';

  -- 顯示結果
  RAISE NOTICE '==================================================';
  RAISE NOTICE '✅ 自動清理系統創建成功';
  RAISE NOTICE '==================================================';
  RAISE NOTICE '';

  IF cron_enabled THEN
    RAISE NOTICE '✓ pg_cron 擴展：已啟用';
    RAISE NOTICE '✓ 定期任務：% 個已排程', jobs_count;
    RAISE NOTICE '';
    RAISE NOTICE '📅 排程詳情：';
    RAISE NOTICE '  - daily-buddies-cleanup: 每天 03:00';
    RAISE NOTICE '  - weekly-cleanup-logs-cleanup: 每週一 04:00';
  ELSE
    RAISE WARNING '⚠️ pg_cron 擴展：未啟用';
    RAISE WARNING '  請在 Supabase Dashboard 啟用 pg_cron 擴展';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '✓ 清理函數：% 個已創建', functions_count;
  RAISE NOTICE '  - cleanup_completed_rooms() - 清理24小時前的完成房間';
  RAISE NOTICE '  - cleanup_abandoned_rooms() - 清理30天前的未完成房間';
  RAISE NOTICE '  - cleanup_old_events() - 歸檔1年前的事件';
  RAISE NOTICE '  - run_daily_cleanup() - 執行所有清理任務';
  RAISE NOTICE '';
  RAISE NOTICE '✓ cleanup_logs 表：已創建';
  RAISE NOTICE '✓ 監控視圖：2 個已創建';
  RAISE NOTICE '✓ 手動清理函數：已創建';
  RAISE NOTICE '';
  RAISE NOTICE '==================================================';
  RAISE NOTICE '🔍 檢查系統狀態：';
  RAISE NOTICE '==================================================';

  -- 顯示健康狀況
  PERFORM * FROM check_cleanup_system();

  RAISE NOTICE '';
  RAISE NOTICE '📊 當前待清理數據：';
  RAISE NOTICE '  %', (SELECT ROW(pending_completed_rooms, pending_abandoned_rooms, pending_old_events)
                       FROM cleanup_health_status);
END $$;

-- ============================================================================
-- 9. 使用指南
-- ============================================================================

COMMENT ON SCHEMA public IS '
自動清理系統使用指南：

1. 查看清理狀態：
   SELECT * FROM cleanup_health_status;

2. 查看清理歷史：
   SELECT * FROM cleanup_history_stats;

3. 手動執行清理：
   SELECT manual_cleanup_now();

4. 檢查系統完整性：
   SELECT * FROM check_cleanup_system();

5. 查看 pg_cron 任務：
   SELECT * FROM cron.job;

6. 查看 pg_cron 執行歷史：
   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

7. 取消定期任務（如需要）：
   SELECT cron.unschedule(''daily-buddies-cleanup'');

8. 重新排程任務：
   SELECT cron.schedule(''daily-buddies-cleanup'', ''0 3 * * *'', $$SELECT run_daily_cleanup();$$);
';
