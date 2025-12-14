/**
 * 修復觸發器函數中的欄位引用
 *
 * 問題：buddies_rooms 表沒有 room_code 欄位
 */

-- 刪除舊觸發器
DROP TRIGGER IF EXISTS trigger_room_created_event ON buddies_rooms;
DROP TRIGGER IF EXISTS trigger_room_status_change_event ON buddies_rooms;

-- 刪除舊函數
DROP FUNCTION IF EXISTS trigger_log_room_created() CASCADE;
DROP FUNCTION IF EXISTS trigger_log_room_status_change() CASCADE;

-- 重新創建觸發器函數（移除 room_code 引用）

CREATE FUNCTION trigger_log_room_created()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM log_buddies_event(
    NEW.id::text,
    'room_created',
    NEW.host_id::uuid,
    jsonb_build_object(
      'host_name', NEW.host_name,
      'status', NEW.status
    )
  );
  RETURN NEW;
END;
$$;

CREATE FUNCTION trigger_log_room_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_type text;
BEGIN
  IF NEW.status != OLD.status THEN
    v_event_type := CASE NEW.status
      WHEN 'questions' THEN 'room_started'
      WHEN 'completed' THEN 'room_completed'
      WHEN 'abandoned' THEN 'room_abandoned'
      ELSE 'status_changed'
    END;

    PERFORM log_buddies_event(
      NEW.id::text,
      v_event_type,
      NULL,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 綁定觸發器
CREATE TRIGGER trigger_room_created_event
AFTER INSERT ON buddies_rooms
FOR EACH ROW
EXECUTE FUNCTION trigger_log_room_created();

CREATE TRIGGER trigger_room_status_change_event
AFTER UPDATE ON buddies_rooms
FOR EACH ROW
EXECUTE FUNCTION trigger_log_room_status_change();

-- 驗證
DO $$
BEGIN
  RAISE NOTICE '✅ 觸發器函數已更新';
END $$;
