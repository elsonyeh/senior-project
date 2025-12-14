/**
 * 診斷並修復 buddies_events 問題
 */

-- ============================================================================
-- 1. 診斷：列出所有 log_buddies_event 函數版本
-- ============================================================================

SELECT
  p.oid,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'log_buddies_event'
AND n.nspname = 'public';

-- ============================================================================
-- 2. 診斷：檢查 buddies_events 表的欄位
-- ============================================================================

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'buddies_events'
ORDER BY ordinal_position;

-- ============================================================================
-- 3. 強制刪除所有版本的 log_buddies_event
-- ============================================================================

DO $$
DECLARE
  func_record RECORD;
BEGIN
  -- 刪除所有觸發器先
  DROP TRIGGER IF EXISTS trigger_room_created_event ON buddies_rooms;
  DROP TRIGGER IF EXISTS trigger_room_status_change_event ON buddies_rooms;
  DROP TRIGGER IF EXISTS trigger_member_joined_event ON buddies_members;

  -- 刪除觸發器函數
  DROP FUNCTION IF EXISTS trigger_log_room_created() CASCADE;
  DROP FUNCTION IF EXISTS trigger_log_room_status_change() CASCADE;
  DROP FUNCTION IF EXISTS trigger_log_member_joined() CASCADE;

  -- 刪除所有 log_buddies_event 函數版本
  FOR func_record IN
    SELECT p.oid, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'log_buddies_event'
    AND n.nspname = 'public'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS log_buddies_event(' || func_record.args || ') CASCADE';
    RAISE NOTICE '已刪除函數: log_buddies_event(%)', func_record.args;
  END LOOP;
END $$;

-- ============================================================================
-- 4. 確認所有函數已刪除
-- ============================================================================

SELECT COUNT(*) as remaining_functions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'log_buddies_event'
AND n.nspname = 'public';

-- ============================================================================
-- 5. 創建新的簡化版函數
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

-- ============================================================================
-- 6. 創建觸發器函數
-- ============================================================================

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
-- 7. 綁定觸發器
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
-- 8. 最終驗證
-- ============================================================================

SELECT
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'log_buddies_event'
AND n.nspname = 'public';
