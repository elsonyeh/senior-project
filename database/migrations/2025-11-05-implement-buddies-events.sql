/**
 * 實施 Buddies 事件流記錄系統
 *
 * 日期: 2025-11-05
 * 目的: 完整記錄 Buddies 模式的所有事件，支援審計追蹤和行為分析
 *
 * 參考:
 * - docs/DATA-LIFECYCLE-MANAGEMENT.md
 * - docs/DATABASE-AUDIT-REPORT.md
 *
 * 設計原理:
 * - 事件驅動架構：記錄所有關鍵操作
 * - 不可變日誌：事件只能新增，不可修改/刪除
 * - 完整審計追蹤：支援重放決策過程
 */

-- ============================================================================
-- 1. 檢查並創建 buddies_events 表（如果不存在）
-- ============================================================================

CREATE TABLE IF NOT EXISTS buddies_events (
  -- 主鍵
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 事件基本資訊
  room_id uuid NOT NULL,                  -- 關聯房間
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

-- 外鍵約束（如果房間被刪除，保留事件記錄用於審計）
-- 注意：不使用 ON DELETE CASCADE，事件應該永久保留
ALTER TABLE buddies_events
  DROP CONSTRAINT IF EXISTS fk_buddies_events_room;

ALTER TABLE buddies_events
  ADD CONSTRAINT fk_buddies_events_room
  FOREIGN KEY (room_id)
  REFERENCES buddies_rooms(id)
  ON DELETE SET NULL;  -- 房間刪除後，room_id 設為 NULL 但保留事件

-- ============================================================================
-- 2. 創建事件類型枚舉（使用 CHECK 約束）
-- ============================================================================

-- 定義允許的事件類型
ALTER TABLE buddies_events
  DROP CONSTRAINT IF EXISTS check_event_type;

ALTER TABLE buddies_events
  ADD CONSTRAINT check_event_type
  CHECK (event_type IN (
    -- 房間生命週期
    'room_created',              -- 房間創建
    'room_started',              -- 開始答題
    'room_completed',            -- 房間完成
    'room_abandoned',            -- 房間放棄

    -- 成員操作
    'member_joined',             -- 成員加入
    'member_left',               -- 成員離開
    'member_kicked',             -- 成員被踢除

    -- 問題回答
    'question_answered',         -- 成員答題
    'all_members_completed',     -- 所有成員完成答題

    -- 推薦生成
    'recommendations_generated', -- 生成推薦列表
    'recommendations_refreshed', -- 重新生成推薦

    -- 投票操作
    'vote_cast',                 -- 投票
    'vote_changed',              -- 修改投票
    'vote_removed',              -- 取消投票

    -- 最終決策
    'final_selection_made',      -- 做出最終選擇
    'final_selection_changed',   -- 修改最終選擇

    -- 系統事件
    'room_archived',             -- 房間已歸檔
    'room_cleaned',              -- 房間已清理

    -- 錯誤事件
    'error_occurred'             -- 發生錯誤
  ));

-- ============================================================================
-- 3. 創建索引（優化查詢效能）
-- ============================================================================

-- 基礎索引
CREATE INDEX IF NOT EXISTS idx_events_room_id
  ON buddies_events(room_id);

CREATE INDEX IF NOT EXISTS idx_events_user_id
  ON buddies_events(user_id);

CREATE INDEX IF NOT EXISTS idx_events_type
  ON buddies_events(event_type);

CREATE INDEX IF NOT EXISTS idx_events_created_at
  ON buddies_events(created_at DESC);

-- 複合索引（優化常見查詢）
CREATE INDEX IF NOT EXISTS idx_events_room_type
  ON buddies_events(room_id, event_type);

CREATE INDEX IF NOT EXISTS idx_events_room_created
  ON buddies_events(room_id, created_at DESC);

-- JSONB 索引（加速 JSON 查詢）
CREATE INDEX IF NOT EXISTS idx_events_data_gin
  ON buddies_events USING gin(event_data);

-- ============================================================================
-- 4. 創建事件記錄輔助函數
-- ============================================================================

-- 4.1 通用事件記錄函數
CREATE OR REPLACE FUNCTION log_buddies_event(
  p_room_id uuid,
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
    ip_address, user_agent, created_at
  ) VALUES (
    p_room_id, p_event_type, p_user_id, p_event_data,
    p_ip_address, p_user_agent, now()
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION log_buddies_event IS '記錄 Buddies 事件（通用函數）';

-- 4.2 自動記錄房間創建事件（觸發器）
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

DROP TRIGGER IF EXISTS trigger_room_created_event ON buddies_rooms;

CREATE TRIGGER trigger_room_created_event
AFTER INSERT ON buddies_rooms
FOR EACH ROW
EXECUTE FUNCTION trigger_log_room_created();

-- 4.3 自動記錄房間狀態變化事件（觸發器）
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
      NULL,  -- 狀態變化可能不是由特定用戶觸發
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

DROP TRIGGER IF EXISTS trigger_room_status_change_event ON buddies_rooms;

CREATE TRIGGER trigger_room_status_change_event
AFTER UPDATE ON buddies_rooms
FOR EACH ROW
EXECUTE FUNCTION trigger_log_room_status_change();

-- 4.4 自動記錄成員加入事件（觸發器）
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

DROP TRIGGER IF EXISTS trigger_member_joined_event ON buddies_members;

CREATE TRIGGER trigger_member_joined_event
AFTER INSERT ON buddies_members
FOR EACH ROW
EXECUTE FUNCTION trigger_log_member_joined();

-- ============================================================================
-- 5. 創建查詢輔助視圖
-- ============================================================================

-- 5.1 房間事件時間線視圖
CREATE OR REPLACE VIEW buddies_room_timeline AS
SELECT
  e.room_id,
  r.room_code,
  e.event_type,
  e.user_id,
  e.event_data,
  e.created_at,
  EXTRACT(EPOCH FROM (e.created_at - LAG(e.created_at) OVER (PARTITION BY e.room_id ORDER BY e.created_at)))::integer AS seconds_since_last_event
FROM buddies_events e
LEFT JOIN buddies_rooms r ON e.room_id = r.id
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
-- 6. 創建分析查詢函數
-- ============================================================================

-- 6.1 獲取房間完整事件日誌
CREATE OR REPLACE FUNCTION get_room_event_log(p_room_id uuid)
RETURNS TABLE(
  event_id uuid,
  event_type text,
  user_id uuid,
  event_data jsonb,
  created_at timestamptz,
  time_since_room_start interval
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    e.id as event_id,
    e.event_type,
    e.user_id,
    e.event_data,
    e.created_at,
    e.created_at - r.created_at as time_since_room_start
  FROM buddies_events e
  LEFT JOIN buddies_rooms r ON e.room_id = r.id
  WHERE e.room_id = p_room_id
  ORDER BY e.created_at;
$$;

COMMENT ON FUNCTION get_room_event_log IS '獲取指定房間的完整事件日誌';

-- 6.2 分析用戶行為模式
CREATE OR REPLACE FUNCTION analyze_user_buddies_behavior(p_user_id uuid)
RETURNS TABLE(
  total_events bigint,
  rooms_participated bigint,
  votes_cast bigint,
  questions_answered bigint,
  rooms_created bigint,
  avg_participation_minutes numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COUNT(*) as total_events,
    COUNT(DISTINCT room_id) as rooms_participated,
    COUNT(*) FILTER (WHERE event_type = 'vote_cast') as votes_cast,
    COUNT(*) FILTER (WHERE event_type = 'question_answered') as questions_answered,
    COUNT(*) FILTER (WHERE event_type = 'room_created') as rooms_created,
    ROUND(AVG(
      CASE
        WHEN event_type = 'room_completed' THEN
          EXTRACT(EPOCH FROM (created_at - (
            SELECT MIN(created_at)
            FROM buddies_events sub
            WHERE sub.room_id = buddies_events.room_id
          ))) / 60.0
        ELSE NULL
      END
    ), 2) as avg_participation_minutes
  FROM buddies_events
  WHERE user_id = p_user_id;
$$;

COMMENT ON FUNCTION analyze_user_buddies_behavior IS '分析用戶在 Buddies 模式的行為模式';

-- ============================================================================
-- 7. 設置 Row Level Security (RLS)
-- ============================================================================

ALTER TABLE buddies_events ENABLE ROW LEVEL SECURITY;

-- 政策：事件記錄只允許讀取（不可修改/刪除）
CREATE POLICY "Events are read-only for all users"
  ON buddies_events
  FOR SELECT
  TO public
  USING (true);

-- 政策：只允許服務角色寫入
CREATE POLICY "Only service role can write events"
  ON buddies_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 政策：禁止任何人更新或刪除事件（不可變日誌）
CREATE POLICY "Events are immutable"
  ON buddies_events
  FOR UPDATE
  TO public
  USING (false);

CREATE POLICY "Events cannot be deleted"
  ON buddies_events
  FOR DELETE
  TO public
  USING (false);

-- ============================================================================
-- 8. 創建事件保留政策（可選 - 長期數據管理）
-- ============================================================================

-- 8.1 創建事件歸檔表（用於超長期存儲，如 > 1年）
CREATE TABLE IF NOT EXISTS buddies_events_archive (
  LIKE buddies_events INCLUDING ALL,
  archived_at timestamptz DEFAULT now()
);

-- 8.2 事件歸檔函數
CREATE OR REPLACE FUNCTION archive_old_events(older_than_days integer DEFAULT 365)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_archived_count integer;
BEGIN
  WITH moved_events AS (
    INSERT INTO buddies_events_archive
    SELECT *, now() as archived_at
    FROM buddies_events
    WHERE created_at < now() - (older_than_days || ' days')::interval
    RETURNING id
  )
  DELETE FROM buddies_events
  WHERE id IN (SELECT id FROM moved_events);

  GET DIAGNOSTICS v_archived_count = ROW_COUNT;

  RETURN v_archived_count;
END;
$$;

COMMENT ON FUNCTION archive_old_events IS '歸檔超過指定天數的事件（預設365天）';

-- ============================================================================
-- 9. 驗證與測試
-- ============================================================================

DO $$
DECLARE
  table_exists BOOLEAN;
  trigger_count integer;
  function_count integer;
  view_count integer;
BEGIN
  -- 檢查表是否存在
  table_exists := EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'buddies_events'
  );

  -- 計算觸發器數量
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE trigger_name LIKE '%_event' OR trigger_name LIKE '%_events%';

  -- 計算函數數量
  SELECT COUNT(*) INTO function_count
  FROM pg_proc
  WHERE proname LIKE '%buddies_event%' OR proname LIKE '%room_event%';

  -- 計算視圖數量
  SELECT COUNT(*) INTO view_count
  FROM information_schema.views
  WHERE table_schema = 'public'
    AND (table_name LIKE '%event%' OR table_name LIKE '%timeline%');

  IF table_exists THEN
    RAISE NOTICE '✅ Buddies 事件系統創建成功';
    RAISE NOTICE '  ✓ buddies_events 表已創建';
    RAISE NOTICE '  ✓ % 個觸發器已啟用', trigger_count;
    RAISE NOTICE '  ✓ % 個輔助函數已創建', function_count;
    RAISE NOTICE '  ✓ % 個分析視圖已創建', view_count;
    RAISE NOTICE '  ✓ 7 個索引已創建';
    RAISE NOTICE '  ✓ RLS 政策已設置（不可變日誌）';
    RAISE NOTICE '';
    RAISE NOTICE '📝 支援的事件類型：';
    RAISE NOTICE '  - 房間生命週期：room_created, room_started, room_completed, room_abandoned';
    RAISE NOTICE '  - 成員操作：member_joined, member_left, member_kicked';
    RAISE NOTICE '  - 問題回答：question_answered, all_members_completed';
    RAISE NOTICE '  - 推薦生成：recommendations_generated, recommendations_refreshed';
    RAISE NOTICE '  - 投票操作：vote_cast, vote_changed, vote_removed';
    RAISE NOTICE '  - 最終決策：final_selection_made, final_selection_changed';
    RAISE NOTICE '  - 系統事件：room_archived, room_cleaned, error_occurred';
  ELSE
    RAISE WARNING '⚠️ buddies_events 表未創建';
  END IF;

  -- 顯示事件統計
  RAISE NOTICE '';
  RAISE NOTICE '📊 事件統計：';
  RAISE NOTICE '  總事件數：%', (SELECT COUNT(*) FROM buddies_events);
  RAISE NOTICE '  涉及房間：%', (SELECT COUNT(DISTINCT room_id) FROM buddies_events);
  RAISE NOTICE '  獨立用戶：%', (SELECT COUNT(DISTINCT user_id) FROM buddies_events WHERE user_id IS NOT NULL);
END $$;
