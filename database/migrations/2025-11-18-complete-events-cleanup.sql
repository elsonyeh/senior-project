/**
 * 完整清理 buddies_events 相關函數和觸發器
 *
 * 日期: 2025-11-18
 * 目的: 徹底移除所有使用 ip_address 和 user_agent 的舊代碼
 */

-- ============================================================================
-- 1. 先刪除所有觸發器
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_room_created_event ON buddies_rooms;
DROP TRIGGER IF EXISTS trigger_room_status_change_event ON buddies_rooms;
DROP TRIGGER IF EXISTS trigger_member_joined_event ON buddies_members;

-- ============================================================================
-- 2. 刪除所有相關函數（所有可能的簽名）
-- ============================================================================

DROP FUNCTION IF EXISTS log_buddies_event(uuid, text, uuid, jsonb, inet, text);
DROP FUNCTION IF EXISTS log_buddies_event(uuid, text, uuid, jsonb);
DROP FUNCTION IF EXISTS trigger_log_room_created();
DROP FUNCTION IF EXISTS trigger_log_room_status_change();
DROP FUNCTION IF EXISTS trigger_log_member_joined();

-- ============================================================================
-- 3. 重新創建 log_buddies_event 函數（簡化版）
-- ============================================================================

CREATE FUNCTION log_buddies_event(
  p_room_id uuid,
  p_event_type text,
  p_user_id uuid DEFAULT NULL,
  p_event_data jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO buddies_events (
    room_id, event_type, user_id, event_data, created_at
  ) VALUES (
    p_room_id, p_event_type, p_user_id, p_event_data, now()
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION log_buddies_event(uuid, text, uuid, jsonb) IS '記錄 Buddies 事件';

-- ============================================================================
-- 4. 重新創建觸發器函數
-- ============================================================================

-- 4.1 房間創建觸發器
CREATE FUNCTION trigger_log_room_created()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM log_buddies_event(
    NEW.id,
    'room_created',
    NEW.host_id,
    jsonb_build_object(
      'room_code', NEW.room_code,
      'host_name', NEW.host_name,
      'status', NEW.status
    )
  );

  RETURN NEW;
END;
$$;

-- 4.2 房間狀態變化觸發器
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
      NEW.id,
      v_event_type,
      NULL,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'member_count', jsonb_array_length(COALESCE(NEW.members_data, '[]'::jsonb)),
        'room_code', NEW.room_code
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 4.3 成員加入觸發器
CREATE FUNCTION trigger_log_member_joined()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM log_buddies_event(
    NEW.room_id,
    'member_joined',
    NEW.user_id,
    jsonb_build_object(
      'username', NEW.username,
      'is_host', NEW.is_host
    )
  );

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 5. 重新綁定觸發器
-- ============================================================================

CREATE TRIGGER trigger_room_created_event
AFTER INSERT ON buddies_rooms
FOR EACH ROW
EXECUTE FUNCTION trigger_log_room_created();

CREATE TRIGGER trigger_room_status_change_event
AFTER UPDATE ON buddies_rooms
FOR EACH ROW
EXECUTE FUNCTION trigger_log_room_status_change();

CREATE TRIGGER trigger_member_joined_event
AFTER INSERT ON buddies_members
FOR EACH ROW
EXECUTE FUNCTION trigger_log_member_joined();

-- ============================================================================
-- 6. 驗證
-- ============================================================================

DO $$
DECLARE
  v_func_count integer;
  v_trigger_count integer;
BEGIN
  -- 檢查函數
  SELECT COUNT(*) INTO v_func_count
  FROM pg_proc
  WHERE proname = 'log_buddies_event';

  -- 檢查觸發器
  SELECT COUNT(*) INTO v_trigger_count
  FROM information_schema.triggers
  WHERE trigger_name IN ('trigger_room_created_event', 'trigger_room_status_change_event', 'trigger_member_joined_event');

  RAISE NOTICE '✅ 清理完成';
  RAISE NOTICE '  - log_buddies_event 函數數量: %', v_func_count;
  RAISE NOTICE '  - 觸發器數量: %', v_trigger_count;
END $$;
