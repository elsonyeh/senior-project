-- 🔧 修復 trigger_log_room_status_change 函數
-- 移除對已不存在的 members_data 字段的引用
-- 改為從 buddies_members 表查詢成員數量
--
-- 問題: buddies_rooms 表中的 members_data 字段已被移除
-- 解決: 從 buddies_members 表查詢實際成員數量

CREATE OR REPLACE FUNCTION trigger_log_room_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_type text;
  v_member_count integer;
BEGIN
  -- 只在狀態改變時記錄
  IF NEW.status != OLD.status THEN

    -- 從 buddies_members 表查詢成員數量
    SELECT COUNT(*) INTO v_member_count
    FROM buddies_members
    WHERE room_id = NEW.id::text;

    -- 根據新狀態決定事件類型
    v_event_type := CASE NEW.status
      WHEN 'questions' THEN 'room_started'
      WHEN 'completed' THEN 'room_completed'
      WHEN 'abandoned' THEN 'room_abandoned'
      ELSE 'status_changed'
    END;

    PERFORM log_buddies_event(
      NEW.id::text,  -- 確保轉換為 text 類型
      v_event_type,
      NULL,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'member_count', v_member_count,
        'room_code', NEW.room_code
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trigger_log_room_status_change() IS '記錄房間狀態變更事件（修復版：使用 buddies_members 表）';

-- 驗證修復
DO $$
BEGIN
  RAISE NOTICE '======================================';
  RAISE NOTICE '✅ trigger_log_room_status_change 已修復';
  RAISE NOTICE '✅ 已移除對 members_data 字段的引用';
  RAISE NOTICE '✅ 改為從 buddies_members 表查詢成員數量';
  RAISE NOTICE '======================================';
END $$;
