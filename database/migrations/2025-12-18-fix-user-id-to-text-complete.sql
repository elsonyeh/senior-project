/**
 * 完整修復 buddies_events.user_id 類型為 text
 *
 * 日期: 2025-12-18
 * 問題: user_id 欄位是 uuid 類型，但應用使用臨時字符串 ID
 * 解決: 刪除依賴視圖 → 修改類型 → 重建視圖和函數
 */

-- ============================================================================
-- 1. 刪除依賴的視圖
-- ============================================================================

DROP VIEW IF EXISTS buddies_room_timeline CASCADE;
DROP VIEW IF EXISTS buddies_event_stats CASCADE;

-- ============================================================================
-- 2. 刪除依賴的函數
-- ============================================================================

DROP FUNCTION IF EXISTS get_room_event_log(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_room_event_log(text) CASCADE;
DROP FUNCTION IF EXISTS analyze_user_buddies_behavior(uuid) CASCADE;
DROP FUNCTION IF EXISTS analyze_user_buddies_behavior(text) CASCADE;
DROP FUNCTION IF EXISTS log_buddies_event(text, text, uuid, jsonb) CASCADE;

-- ============================================================================
-- 3. 修改欄位類型
-- ============================================================================

ALTER TABLE buddies_events
ALTER COLUMN user_id TYPE text USING user_id::text;

COMMENT ON COLUMN buddies_events.user_id IS '觸發用戶 ID（支援 UUID 和臨時用戶 ID）';

-- ============================================================================
-- 4. 重建 log_buddies_event 函數（使用 text 類型）
-- ============================================================================

CREATE OR REPLACE FUNCTION log_buddies_event(
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

COMMENT ON FUNCTION log_buddies_event IS '記錄 Buddies 事件（user_id 為 text 類型）';

-- ============================================================================
-- 5. 重建視圖
-- ============================================================================

-- 5.1 房間事件時間線視圖
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

COMMENT ON VIEW buddies_room_timeline IS '房間事件時間線視圖（包含事件間隔時間）';

-- 5.2 事件統計視圖
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

COMMENT ON VIEW buddies_event_stats IS '事件類型統計視圖';

-- ============================================================================
-- 6. 重建分析函數
-- ============================================================================

-- 6.1 獲取房間完整事件日誌（使用 text）
CREATE OR REPLACE FUNCTION get_room_event_log(p_room_id text)
RETURNS TABLE(
  event_id uuid,
  event_type text,
  user_id text,
  event_data jsonb,
  created_at timestamptz,
  time_since_room_start interval
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.event_type,
    e.user_id,
    e.event_data,
    e.created_at,
    e.created_at - (
      SELECT MIN(created_at)
      FROM buddies_events
      WHERE room_id = p_room_id
    ) AS time_since_room_start
  FROM buddies_events e
  WHERE e.room_id = p_room_id
  ORDER BY e.created_at;
END;
$$;

-- 6.2 分析用戶 Buddies 行為（使用 text）
CREATE OR REPLACE FUNCTION analyze_user_buddies_behavior(p_user_id text)
RETURNS TABLE(
  total_events bigint,
  rooms_participated bigint,
  questions_answered bigint,
  votes_cast bigint,
  final_selections bigint,
  avg_response_time_seconds numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_events,
    COUNT(DISTINCT room_id)::bigint AS rooms_participated,
    COUNT(*) FILTER (WHERE event_type = 'question_answered')::bigint AS questions_answered,
    COUNT(*) FILTER (WHERE event_type = 'vote_cast')::bigint AS votes_cast,
    COUNT(*) FILTER (WHERE event_type = 'final_selection_made')::bigint AS final_selections,
    COALESCE(
      AVG(
        EXTRACT(EPOCH FROM (
          created_at - LAG(created_at) OVER (PARTITION BY room_id ORDER BY created_at)
        ))
      ) FILTER (WHERE event_type = 'question_answered'),
      0
    )::numeric AS avg_response_time_seconds
  FROM buddies_events
  WHERE user_id = p_user_id;
END;
$$;

-- ============================================================================
-- 7. 驗證
-- ============================================================================

DO $$
DECLARE
  v_user_id_type text;
BEGIN
  -- 檢查欄位類型
  SELECT data_type INTO v_user_id_type
  FROM information_schema.columns
  WHERE table_name = 'buddies_events'
    AND column_name = 'user_id';

  IF v_user_id_type = 'text' THEN
    RAISE NOTICE '======================================';
    RAISE NOTICE '✅ buddies_events.user_id 已成功改為 text';
    RAISE NOTICE '✅ 所有視圖和函數已重建';
    RAISE NOTICE '======================================';
    RAISE NOTICE '';
    RAISE NOTICE '現在支援：';
    RAISE NOTICE '  - UUID 格式: a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    RAISE NOTICE '  - 臨時 ID: user_1234567890_1234';
    RAISE NOTICE '======================================';
  ELSE
    RAISE EXCEPTION '❌ user_id 類型仍然是 %，預期為 text', v_user_id_type;
  END IF;
END $$;
