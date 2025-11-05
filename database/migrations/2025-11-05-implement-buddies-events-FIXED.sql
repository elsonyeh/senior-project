/**
 * 實施 Buddies 事件流記錄系統（已修復類型問題）
 *
 * 日期: 2025-11-05
 * 修復: room_id 類型從 uuid 改為 text 以匹配 buddies_rooms.id
 */

-- ============================================================================
-- 1. 創建 buddies_events 表
-- ============================================================================

CREATE TABLE IF NOT EXISTS buddies_events (
  -- 主鍵
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 事件基本資訊
  room_id text NOT NULL,                  -- 關聯房間 (改為 text 以匹配 buddies_rooms.id)
  event_type text NOT NULL,               -- 事件類型
  user_id uuid,                           -- 觸發用戶（部分事件無用戶）

  -- 事件數據（JSONB 靈活存儲）
  event_data jsonb,                       -- 事件詳細數據

  -- 元數據
  created_at timestamptz DEFAULT now(),   -- 事件發生時間
  ip_address inet,                        -- IP 地址（可選）
  user_agent text,                        -- 用戶代理（可選）

  -- 版本控制
  schema_version text DEFAULT '1.0'       -- 數據結構版本
);

-- 外鍵約束
ALTER TABLE buddies_events
  DROP CONSTRAINT IF EXISTS fk_buddies_events_room;

ALTER TABLE buddies_events
  ADD CONSTRAINT fk_buddies_events_room
  FOREIGN KEY (room_id)
  REFERENCES buddies_rooms(id)
  ON DELETE SET NULL;

-- ============================================================================
-- 2. 創建事件類型枚舉（使用 CHECK 約束）
-- ============================================================================

ALTER TABLE buddies_events
  DROP CONSTRAINT IF EXISTS check_event_type;

ALTER TABLE buddies_events
  ADD CONSTRAINT check_event_type
  CHECK (event_type IN (
    -- 房間生命週期
    'room_created',
    'room_started',
    'room_completed',
    'room_abandoned',
    -- 成員操作
    'member_joined',
    'member_left',
    'member_kicked',
    -- 問題回答
    'question_answered',
    'all_members_completed',
    -- 推薦生成
    'recommendations_generated',
    'recommendations_refreshed',
    -- 投票操作
    'vote_cast',
    'vote_changed',
    'vote_removed',
    -- 最終決策
    'final_selection_made',
    'final_selection_changed',
    -- 系統事件
    'room_archived',
    'room_cleaned',
    -- 錯誤事件
    'error_occurred'
  ));

-- ============================================================================
-- 3. 創建索引
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_events_room_id ON buddies_events(room_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON buddies_events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON buddies_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON buddies_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_room_type ON buddies_events(room_id, event_type);
CREATE INDEX IF NOT EXISTS idx_events_user_type ON buddies_events(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_events_data_gin ON buddies_events USING gin(event_data);

-- ============================================================================
-- 4. 創建事件記錄函數
-- ============================================================================

CREATE OR REPLACE FUNCTION log_buddies_event(
  p_room_id text,
  p_event_type text,
  p_user_id uuid DEFAULT NULL,
  p_event_data jsonb DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO buddies_events (
    room_id, event_type, user_id, event_data,
    ip_address, user_agent
  ) VALUES (
    p_room_id, p_event_type, p_user_id, p_event_data,
    p_ip_address, p_user_agent
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION log_buddies_event IS '記錄 Buddies 事件';

-- ============================================================================
-- 5. 創建自動觸發器
-- ============================================================================

-- 5.1 房間創建事件
CREATE OR REPLACE FUNCTION trg_log_room_created()
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
      'host_name', NEW.host_name
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_room_created ON buddies_rooms;
CREATE TRIGGER trg_log_room_created
  AFTER INSERT ON buddies_rooms
  FOR EACH ROW
  EXECUTE FUNCTION trg_log_room_created();

-- 5.2 房間完成事件
CREATE OR REPLACE FUNCTION trg_log_room_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    PERFORM log_buddies_event(
      NEW.id,
      'room_completed',
      NULL,
      jsonb_build_object(
        'final_restaurant_id', NEW.final_restaurant_id,
        'member_count', jsonb_array_length(COALESCE(NEW.members_data, '[]'::jsonb)),
        'total_votes', (SELECT SUM((value->>'count')::int) FROM jsonb_each(COALESCE(NEW.votes, '{}'::jsonb)))
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_room_completed ON buddies_rooms;
CREATE TRIGGER trg_log_room_completed
  AFTER UPDATE ON buddies_rooms
  FOR EACH ROW
  EXECUTE FUNCTION trg_log_room_completed();

-- 5.3 房間歸檔事件
CREATE OR REPLACE FUNCTION trg_log_room_archived()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM log_buddies_event(
    NEW.id,
    'room_archived',
    NULL,
    jsonb_build_object(
      'archived_at', NEW.archived_at,
      'archived_by', NEW.archived_by
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_room_archived ON buddies_rooms_archive;
CREATE TRIGGER trg_log_room_archived
  AFTER INSERT ON buddies_rooms_archive
  FOR EACH ROW
  EXECUTE FUNCTION trg_log_room_archived();

-- ============================================================================
-- 6. 創建分析視圖
-- ============================================================================

-- 6.1 房間事件時間線視圖
CREATE OR REPLACE VIEW room_event_timeline AS
SELECT
  room_id,
  event_type,
  event_data,
  created_at,
  user_id,
  LAG(created_at) OVER (PARTITION BY room_id ORDER BY created_at) as previous_event_time,
  EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY room_id ORDER BY created_at))) as seconds_since_previous
FROM buddies_events
ORDER BY room_id, created_at;

-- 6.2 用戶互動統計視圖
CREATE OR REPLACE VIEW user_interaction_stats AS
SELECT
  user_id,
  COUNT(*) as total_events,
  COUNT(DISTINCT room_id) as rooms_participated,
  COUNT(*) FILTER (WHERE event_type = 'vote_cast') as votes_cast,
  COUNT(*) FILTER (WHERE event_type = 'question_answered') as questions_answered,
  MIN(created_at) as first_interaction,
  MAX(created_at) as last_interaction
FROM buddies_events
WHERE user_id IS NOT NULL
GROUP BY user_id;

-- 6.3 熱門餐廳（從事件分析）
CREATE OR REPLACE VIEW popular_restaurants_from_events AS
SELECT
  event_data->>'final_restaurant_id' as restaurant_id,
  COUNT(*) as selection_count,
  AVG((event_data->>'member_count')::int) as avg_group_size
FROM buddies_events
WHERE event_type = 'room_completed'
  AND event_data->>'final_restaurant_id' IS NOT NULL
GROUP BY event_data->>'final_restaurant_id'
ORDER BY selection_count DESC;

-- 6.4 房間完成漏斗分析
CREATE OR REPLACE VIEW room_completion_funnel AS
SELECT
  COUNT(DISTINCT CASE WHEN event_type = 'room_created' THEN room_id END) as rooms_created,
  COUNT(DISTINCT CASE WHEN event_type = 'room_started' THEN room_id END) as rooms_started,
  COUNT(DISTINCT CASE WHEN event_type = 'recommendations_generated' THEN room_id END) as rooms_got_recommendations,
  COUNT(DISTINCT CASE WHEN event_type = 'vote_cast' THEN room_id END) as rooms_with_votes,
  COUNT(DISTINCT CASE WHEN event_type = 'room_completed' THEN room_id END) as rooms_completed,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN event_type = 'room_completed' THEN room_id END) /
    NULLIF(COUNT(DISTINCT CASE WHEN event_type = 'room_created' THEN room_id END), 0), 2) as completion_rate
FROM buddies_events;

-- ============================================================================
-- 7. 設置 Row Level Security (事件不可變)
-- ============================================================================

ALTER TABLE buddies_events ENABLE ROW LEVEL SECURITY;

-- 允許讀取所有事件
DROP POLICY IF EXISTS "Allow read access to all events" ON buddies_events;
CREATE POLICY "Allow read access to all events"
  ON buddies_events FOR SELECT
  USING (true);

-- 只允許插入新事件（不允許更新/刪除）
DROP POLICY IF EXISTS "Allow insert events" ON buddies_events;
CREATE POLICY "Allow insert events"
  ON buddies_events FOR INSERT
  WITH CHECK (true);

-- 禁止更新
DROP POLICY IF EXISTS "Prevent updates" ON buddies_events;
CREATE POLICY "Prevent updates"
  ON buddies_events FOR UPDATE
  USING (false);

-- 禁止刪除
DROP POLICY IF EXISTS "Prevent deletes" ON buddies_events;
CREATE POLICY "Prevent deletes"
  ON buddies_events FOR DELETE
  USING (false);

-- ============================================================================
-- 驗證
-- ============================================================================

DO $$
DECLARE
  v_table_exists BOOLEAN;
  v_trigger_count INTEGER;
  v_view_count INTEGER;
BEGIN
  -- 檢查表
  v_table_exists := EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_name = 'buddies_events'
  );

  -- 檢查觸發器
  SELECT COUNT(*) INTO v_trigger_count
  FROM pg_trigger
  WHERE tgname IN ('trg_log_room_created', 'trg_log_room_completed', 'trg_log_room_archived');

  -- 檢查視圖
  SELECT COUNT(*) INTO v_view_count
  FROM information_schema.views
  WHERE table_name IN (
    'room_event_timeline',
    'user_interaction_stats',
    'popular_restaurants_from_events',
    'room_completion_funnel'
  );

  RAISE NOTICE '✅ 事件系統創建完成';
  RAISE NOTICE '- 表: buddies_events (存在: %)', v_table_exists;
  RAISE NOTICE '- 觸發器: % 個', v_trigger_count;
  RAISE NOTICE '- 視圖: % 個', v_view_count;
  RAISE NOTICE '- 事件類型: 19 個';
  RAISE NOTICE '- 索引: 7 個';
END $$;
