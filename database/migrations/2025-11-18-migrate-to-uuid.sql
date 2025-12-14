/**
 * 遷移 user_id 到 UUID 類型
 *
 * 日期: 2025-11-18
 * 目的: 統一使用 UUID 作為用戶識別，以便與 Supabase Auth 整合
 */

-- ============================================================================
-- 1. 先清空相關表（因為舊數據格式不相容）
-- ============================================================================

-- 刪除觸發器
DROP TRIGGER IF EXISTS trigger_room_created_event ON buddies_rooms;
DROP TRIGGER IF EXISTS trigger_room_status_change_event ON buddies_rooms;
DROP TRIGGER IF EXISTS trigger_member_joined_event ON buddies_members;

-- 清空事件表
TRUNCATE TABLE buddies_events CASCADE;

-- 清空成員表
TRUNCATE TABLE buddies_members CASCADE;

-- 清空房間表
TRUNCATE TABLE buddies_rooms CASCADE;

-- ============================================================================
-- 2. 刪除依賴的視圖
-- ============================================================================

DROP VIEW IF EXISTS room_event_timeline CASCADE;
DROP VIEW IF EXISTS buddies_room_timeline CASCADE;
DROP VIEW IF EXISTS buddies_event_stats CASCADE;
DROP VIEW IF EXISTS user_interaction_stats CASCADE;
DROP VIEW IF EXISTS popular_restaurants_from_events CASCADE;

-- ============================================================================
-- 3. 修改表結構為 UUID
-- ============================================================================

-- buddies_rooms.host_id
ALTER TABLE buddies_rooms
ALTER COLUMN host_id TYPE uuid USING host_id::uuid;

-- buddies_members.user_id
ALTER TABLE buddies_members
ALTER COLUMN user_id TYPE uuid USING user_id::uuid;

-- buddies_events.user_id
ALTER TABLE buddies_events
ALTER COLUMN user_id TYPE uuid USING user_id::uuid;

-- ============================================================================
-- 4. 重新創建視圖
-- ============================================================================

-- 房間事件時間線視圖
CREATE OR REPLACE VIEW buddies_room_timeline AS
SELECT
  e.room_id,
  e.event_type,
  e.user_id,
  e.event_data,
  e.created_at,
  EXTRACT(EPOCH FROM (e.created_at - LAG(e.created_at) OVER (PARTITION BY e.room_id ORDER BY e.created_at)))::integer AS seconds_since_last_event
FROM buddies_events e
ORDER BY e.room_id, e.created_at;

-- 事件統計視圖
CREATE OR REPLACE VIEW buddies_event_stats AS
SELECT
  event_type,
  COUNT(*) as event_count,
  COUNT(DISTINCT room_id) as affected_rooms,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(created_at) as first_occurrence,
  MAX(created_at) as last_occurrence
FROM buddies_events
GROUP BY event_type
ORDER BY event_count DESC;

-- ============================================================================
-- 3. 刪除舊函數
-- ============================================================================

DROP FUNCTION IF EXISTS log_buddies_event(text, text, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS log_buddies_event(text, text, uuid, jsonb) CASCADE;
DROP FUNCTION IF EXISTS trigger_log_room_created() CASCADE;
DROP FUNCTION IF EXISTS trigger_log_room_status_change() CASCADE;
DROP FUNCTION IF EXISTS trigger_log_member_joined() CASCADE;

-- ============================================================================
-- 4. 創建新的 log_buddies_event 函數（使用 UUID）
-- ============================================================================

CREATE FUNCTION log_buddies_event(
  p_room_id text,
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
-- 5. 創建觸發器函數
-- ============================================================================

CREATE FUNCTION trigger_log_room_created()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM log_buddies_event(
    NEW.id::text,
    'room_created',
    NEW.host_id,
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
    NEW.user_id,
    jsonb_build_object(
      'is_host', NEW.is_host
    )
  );
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 6. 綁定觸發器
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
-- 7. 驗證
-- ============================================================================

DO $$
DECLARE
  v_host_id_type text;
  v_member_user_id_type text;
  v_event_user_id_type text;
BEGIN
  SELECT data_type INTO v_host_id_type
  FROM information_schema.columns
  WHERE table_name = 'buddies_rooms' AND column_name = 'host_id';

  SELECT data_type INTO v_member_user_id_type
  FROM information_schema.columns
  WHERE table_name = 'buddies_members' AND column_name = 'user_id';

  SELECT data_type INTO v_event_user_id_type
  FROM information_schema.columns
  WHERE table_name = 'buddies_events' AND column_name = 'user_id';

  RAISE NOTICE '✅ UUID 遷移完成';
  RAISE NOTICE '  - buddies_rooms.host_id: %', v_host_id_type;
  RAISE NOTICE '  - buddies_members.user_id: %', v_member_user_id_type;
  RAISE NOTICE '  - buddies_events.user_id: %', v_event_user_id_type;
END $$;
