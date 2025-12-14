/**
 * 修復 user_id 類型問題
 *
 * 問題：buddies_members.user_id 是 text，但 buddies_events.user_id 是 uuid
 * 應用程式使用 "user_xxx" 格式的 ID，不是 UUID
 */

-- ============================================================================
-- 1. 修改 buddies_events.user_id 為 text 類型
-- ============================================================================

ALTER TABLE buddies_events
ALTER COLUMN user_id TYPE text USING user_id::text;

-- ============================================================================
-- 2. 刪除舊的函數和觸發器
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_member_joined_event ON buddies_members;
DROP TRIGGER IF EXISTS trigger_room_created_event ON buddies_rooms;
DROP TRIGGER IF EXISTS trigger_room_status_change_event ON buddies_rooms;

DROP FUNCTION IF EXISTS trigger_log_member_joined() CASCADE;
DROP FUNCTION IF EXISTS trigger_log_room_created() CASCADE;
DROP FUNCTION IF EXISTS trigger_log_room_status_change() CASCADE;
DROP FUNCTION IF EXISTS log_buddies_event(text, text, uuid, jsonb) CASCADE;
DROP FUNCTION IF EXISTS log_buddies_event(text, text, text, jsonb) CASCADE;

-- ============================================================================
-- 3. 創建新的 log_buddies_event 函數（使用 text 類型）
-- ============================================================================

CREATE FUNCTION log_buddies_event(
  p_room_id text,
  p_event_type text,
  p_user_id text DEFAULT NULL,
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

-- ============================================================================
-- 4. 創建觸發器函數
-- ============================================================================

CREATE FUNCTION trigger_log_room_created()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM log_buddies_event(
    NEW.id::text,
    'room_created',
    NEW.host_id::text,
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

CREATE FUNCTION trigger_log_member_joined()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM log_buddies_event(
    NEW.room_id::text,
    'member_joined',
    NEW.user_id::text,
    jsonb_build_object(
      'is_host', NEW.is_host
    )
  );
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 5. 綁定觸發器
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
BEGIN
  RAISE NOTICE '✅ user_id 類型已統一為 text';
  RAISE NOTICE '✅ 所有觸發器已更新';
END $$;
