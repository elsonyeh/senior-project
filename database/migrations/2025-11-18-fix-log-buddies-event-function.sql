/**
 * 修正 log_buddies_event 函數
 *
 * 日期: 2025-11-18
 * 目的: 確保舊版本函數完全移除
 */

-- 刪除所有可能存在的 log_buddies_event 函數版本
DROP FUNCTION IF EXISTS log_buddies_event(uuid, text, uuid, jsonb, inet, text);
DROP FUNCTION IF EXISTS log_buddies_event(uuid, text, uuid, jsonb);

-- 重新創建正確的函數
CREATE OR REPLACE FUNCTION log_buddies_event(
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

-- 更新觸發器函數以確保它們使用正確的簽名
CREATE OR REPLACE FUNCTION trigger_log_room_created()
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

CREATE OR REPLACE FUNCTION trigger_log_room_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_type text;
BEGIN
  -- 只在狀態改變時記錄
  IF NEW.status != OLD.status THEN

    -- 根據新狀態決定事件類型
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

CREATE OR REPLACE FUNCTION trigger_log_member_joined()
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

-- 驗證
DO $$
BEGIN
  RAISE NOTICE '✅ log_buddies_event 函數已更新';
  RAISE NOTICE '✅ 觸發器函數已更新';
END $$;
