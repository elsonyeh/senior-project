-- ============================================================================
-- 修復 buddies_events 觸發器 - 移除不存在的欄位引用
-- ============================================================================
-- 問題：trg_log_room_created() 嘗試訪問 room_code 和 host_name
-- 但 buddies_rooms 表沒有這些欄位
--
-- 執行方式：在 Supabase Dashboard 的 SQL Editor 中執行
-- ============================================================================

-- 5.1 修復房間創建事件觸發器
CREATE OR REPLACE FUNCTION trg_log_room_created()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 只記錄存在的欄位：id 和 host_id
  PERFORM log_buddies_event(
    NEW.id,
    'room_created',
    NEW.host_id,
    jsonb_build_object(
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
-- 完成
-- ============================================================================

SELECT '✅ buddies_events 觸發器已修復' as status;
