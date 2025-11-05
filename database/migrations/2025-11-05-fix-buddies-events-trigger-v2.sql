-- ============================================================================
-- 修復 buddies_events 觸發器 - 解決類型不匹配問題
-- ============================================================================
-- 問題：
-- 1. buddies_rooms.host_id 是 TEXT 類型
-- 2. log_buddies_event() 函數的 p_user_id 參數是 UUID 類型
-- 3. 觸發器無法將 TEXT 傳給 UUID 參數
--
-- 解決方案：
-- 將 host_id 放在 event_data 中，不作為 user_id 傳遞
--
-- 執行方式：在 Supabase Dashboard 的 SQL Editor 中執行
-- ============================================================================

-- 修復房間創建事件觸發器
CREATE OR REPLACE FUNCTION trg_log_room_created()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 將 host_id 放在 event_data 中，因為它是 TEXT 類型，無法作為 user_id (UUID)
  PERFORM log_buddies_event(
    NEW.id,                  -- room_id (text)
    'room_created',          -- event_type (text)
    NULL,                    -- user_id (uuid) - 設為 NULL，因為 host_id 是 text
    jsonb_build_object(
      'host_id', NEW.host_id,
      'status', NEW.status,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;

-- 觸發器已經存在，不需要重新創建
-- DROP TRIGGER IF EXISTS trg_log_room_created ON buddies_rooms;
-- CREATE TRIGGER trg_log_room_created
--   AFTER INSERT ON buddies_rooms
--   FOR EACH ROW
--   EXECUTE FUNCTION trg_log_room_created();

-- ============================================================================
-- 驗證函數是否存在
-- ============================================================================

-- 檢查 log_buddies_event 函數是否存在
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'log_buddies_event'
  ) THEN
    RAISE EXCEPTION '❌ log_buddies_event 函數不存在！請先執行 2025-11-05-implement-buddies-events-FIXED.sql';
  ELSE
    RAISE NOTICE '✅ log_buddies_event 函數已存在';
  END IF;
END $$;

-- 檢查 buddies_events 表是否存在
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'buddies_events'
  ) THEN
    RAISE EXCEPTION '❌ buddies_events 表不存在！請先執行 2025-11-05-implement-buddies-events-FIXED.sql';
  ELSE
    RAISE NOTICE '✅ buddies_events 表已存在';
  END IF;
END $$;

-- ============================================================================
-- 完成
-- ============================================================================

SELECT '✅ buddies_events 觸發器已修復（v2 - 類型修正版）' as status;
