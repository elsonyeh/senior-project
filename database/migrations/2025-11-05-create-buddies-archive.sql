/**
 * 創建 Buddies 房間歸檔表
 *
 * 日期: 2025-11-05
 * 目的: 實施數據生命週期管理，保留完成房間的完整數據供分析使用
 *
 * 參考:
 * - docs/DATA-LIFECYCLE-MANAGEMENT.md
 * - docs/DATABASE-AUDIT-REPORT.md
 *
 * 設計原理:
 * - 主表（buddies_rooms）保持輕量，定期清理
 * - 歸檔表（buddies_rooms_archive）永久保存，支援歷史分析
 * - 預計算統計欄位，加速查詢
 */

-- ============================================================================
-- 1. 創建歸檔表
-- ============================================================================

CREATE TABLE IF NOT EXISTS buddies_rooms_archive (
  -- 主鍵（與原表相同，使用 text 類型匹配 buddies_rooms.id）
  id text PRIMARY KEY,
  room_code varchar(6),

  -- 房間基本資訊
  host_id uuid,
  host_name text,
  status text,

  -- 核心數據快照（JSONB 格式）
  members_data jsonb,          -- 成員列表
  member_answers jsonb,        -- 所有答題記錄
  collective_answers jsonb,    -- 群體共識答案
  recommendations jsonb,       -- 推薦結果
  votes jsonb,                 -- 投票統計
  questions jsonb,             -- 問題集

  -- 最終選擇
  final_restaurant_id text,
  final_restaurant_data jsonb,

  -- 統計數據（預計算，加速查詢）
  member_count integer,              -- 參與人數
  total_votes integer,               -- 總投票數
  decision_time_seconds integer,     -- 決策耗時（秒）
  questions_count integer,           -- 問題數量
  recommendations_count integer,     -- 推薦餐廳數量

  -- 時間戳
  created_at timestamptz,
  questions_started_at timestamptz,
  voting_started_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz DEFAULT now(),

  -- 元數據
  schema_version text DEFAULT '1.0',  -- 數據結構版本
  archived_by text DEFAULT 'system'   -- 歸檔來源
);

-- ============================================================================
-- 2. 創建索引（優化查詢效能）
-- ============================================================================

-- 時間序列查詢
CREATE INDEX IF NOT EXISTS idx_archive_completed_at
  ON buddies_rooms_archive(completed_at);

CREATE INDEX IF NOT EXISTS idx_archive_created_at
  ON buddies_rooms_archive(created_at);

-- 餐廳分析
CREATE INDEX IF NOT EXISTS idx_archive_final_restaurant
  ON buddies_rooms_archive(final_restaurant_id);

-- 統計查詢
CREATE INDEX IF NOT EXISTS idx_archive_member_count
  ON buddies_rooms_archive(member_count);

CREATE INDEX IF NOT EXISTS idx_archive_status
  ON buddies_rooms_archive(status);

-- 房主分析
CREATE INDEX IF NOT EXISTS idx_archive_host_id
  ON buddies_rooms_archive(host_id);

-- JSONB 欄位索引（加速 JSONB 查詢）
CREATE INDEX IF NOT EXISTS idx_archive_votes_gin
  ON buddies_rooms_archive USING gin(votes);

CREATE INDEX IF NOT EXISTS idx_archive_recommendations_gin
  ON buddies_rooms_archive USING gin(recommendations);

-- ============================================================================
-- 3. 創建自動歸檔觸發器（選項 B - 資料庫層自動化）
-- ============================================================================

CREATE OR REPLACE FUNCTION archive_completed_buddies_room()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_member_count integer;
  v_total_votes integer;
  v_decision_time integer;
  v_questions_count integer;
  v_recommendations_count integer;
BEGIN
  -- 只在房間完成時觸發
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN

    -- 計算統計數據
    v_member_count := jsonb_array_length(COALESCE(NEW.members_data, '[]'::jsonb));

    v_total_votes := COALESCE((
      SELECT SUM((value->>'count')::int)
      FROM jsonb_each(COALESCE(NEW.votes, '{}'::jsonb))
    ), 0);

    v_decision_time := CASE
      WHEN NEW.completed_at IS NOT NULL AND NEW.created_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (NEW.completed_at - NEW.created_at))::integer
      ELSE NULL
    END;

    v_questions_count := jsonb_array_length(COALESCE(NEW.questions, '[]'::jsonb));

    v_recommendations_count := jsonb_array_length(COALESCE(NEW.recommendations, '[]'::jsonb));

    -- 插入歸檔表（使用 ON CONFLICT 防止重複）
    INSERT INTO buddies_rooms_archive (
      id, room_code, host_id, host_name, status,
      members_data, member_answers, collective_answers,
      recommendations, votes, questions,
      final_restaurant_id, final_restaurant_data,
      member_count, total_votes, decision_time_seconds,
      questions_count, recommendations_count,
      created_at, questions_started_at, voting_started_at,
      completed_at, archived_at,
      schema_version, archived_by
    ) VALUES (
      NEW.id, NEW.room_code, NEW.host_id, NEW.host_name, NEW.status,
      NEW.members_data, NEW.member_answers, NEW.collective_answers,
      NEW.recommendations, NEW.votes, NEW.questions,
      NEW.final_restaurant_id, NEW.final_restaurant_data,
      v_member_count, v_total_votes, v_decision_time,
      v_questions_count, v_recommendations_count,
      NEW.created_at, NEW.questions_started_at, NEW.voting_started_at,
      NEW.completed_at, now(),
      '1.0', 'trigger'
    )
    ON CONFLICT (id) DO UPDATE SET
      -- 如果已存在，更新為最新數據
      status = EXCLUDED.status,
      votes = EXCLUDED.votes,
      final_restaurant_id = EXCLUDED.final_restaurant_id,
      final_restaurant_data = EXCLUDED.final_restaurant_data,
      total_votes = EXCLUDED.total_votes,
      completed_at = EXCLUDED.completed_at,
      archived_at = now(),
      archived_by = 'trigger_update';

    RAISE NOTICE '✅ 房間 % 已自動歸檔', NEW.room_code;
  END IF;

  RETURN NEW;
END;
$$;

-- 綁定觸發器到 buddies_rooms 表
DROP TRIGGER IF EXISTS trigger_archive_completed_room ON buddies_rooms;

CREATE TRIGGER trigger_archive_completed_room
AFTER UPDATE ON buddies_rooms
FOR EACH ROW
EXECUTE FUNCTION archive_completed_buddies_room();

COMMENT ON TRIGGER trigger_archive_completed_room ON buddies_rooms IS '自動歸檔完成的 Buddies 房間';

-- ============================================================================
-- 4. 創建輔助函數
-- ============================================================================

-- 4.1 手動歸檔函數（用於批次歸檔歷史數據）
CREATE OR REPLACE FUNCTION manual_archive_completed_rooms(
  older_than_hours integer DEFAULT 24
)
RETURNS TABLE(
  archived_count integer,
  failed_count integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_archived integer := 0;
  v_failed integer := 0;
  room_record RECORD;
BEGIN
  FOR room_record IN
    SELECT * FROM buddies_rooms
    WHERE status = 'completed'
      AND completed_at < now() - (older_than_hours || ' hours')::interval
      AND id NOT IN (SELECT id FROM buddies_rooms_archive)
  LOOP
    BEGIN
      INSERT INTO buddies_rooms_archive (
        id, room_code, host_id, host_name, status,
        members_data, member_answers, collective_answers,
        recommendations, votes, questions,
        final_restaurant_id, final_restaurant_data,
        member_count, total_votes, decision_time_seconds,
        questions_count, recommendations_count,
        created_at, questions_started_at, voting_started_at,
        completed_at, archived_at,
        schema_version, archived_by
      ) VALUES (
        room_record.id, room_record.room_code, room_record.host_id,
        room_record.host_name, room_record.status,
        room_record.members_data, room_record.member_answers,
        room_record.collective_answers, room_record.recommendations,
        room_record.votes, room_record.questions,
        room_record.final_restaurant_id, room_record.final_restaurant_data,
        jsonb_array_length(COALESCE(room_record.members_data, '[]'::jsonb)),
        COALESCE((SELECT SUM((value->>'count')::int) FROM jsonb_each(COALESCE(room_record.votes, '{}'::jsonb))), 0),
        EXTRACT(EPOCH FROM (room_record.completed_at - room_record.created_at))::integer,
        jsonb_array_length(COALESCE(room_record.questions, '[]'::jsonb)),
        jsonb_array_length(COALESCE(room_record.recommendations, '[]'::jsonb)),
        room_record.created_at, room_record.questions_started_at,
        room_record.voting_started_at, room_record.completed_at, now(),
        '1.0', 'manual_function'
      );

      v_archived := v_archived + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '歸檔房間 % 失敗: %', room_record.room_code, SQLERRM;
      v_failed := v_failed + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_archived, v_failed;
END;
$$;

COMMENT ON FUNCTION manual_archive_completed_rooms IS '手動歸檔完成的房間（批次處理）';

-- 4.2 歸檔統計函數
CREATE OR REPLACE FUNCTION get_archive_stats()
RETURNS TABLE(
  total_archived bigint,
  archived_today bigint,
  archived_this_week bigint,
  archived_this_month bigint,
  avg_member_count numeric,
  avg_decision_minutes numeric,
  total_votes bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COUNT(*) as total_archived,
    COUNT(*) FILTER (WHERE archived_at >= CURRENT_DATE) as archived_today,
    COUNT(*) FILTER (WHERE archived_at >= CURRENT_DATE - interval '7 days') as archived_this_week,
    COUNT(*) FILTER (WHERE archived_at >= CURRENT_DATE - interval '30 days') as archived_this_month,
    ROUND(AVG(member_count), 2) as avg_member_count,
    ROUND(AVG(decision_time_seconds) / 60.0, 2) as avg_decision_minutes,
    SUM(total_votes) as total_votes
  FROM buddies_rooms_archive;
$$;

COMMENT ON FUNCTION get_archive_stats IS '獲取歸檔表統計摘要';

-- ============================================================================
-- 5. 設置 Row Level Security (RLS)
-- ============================================================================

ALTER TABLE buddies_rooms_archive ENABLE ROW LEVEL SECURITY;

-- 政策：歸檔數據只允許讀取（禁止一般用戶修改）
CREATE POLICY "Archive data is read-only for all users"
  ON buddies_rooms_archive
  FOR SELECT
  TO public
  USING (true);

-- 政策：只允許服務角色寫入
CREATE POLICY "Only service role can write archive"
  ON buddies_rooms_archive
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 6. 驗證與測試
-- ============================================================================

DO $$
DECLARE
  table_exists BOOLEAN;
  trigger_exists BOOLEAN;
BEGIN
  -- 檢查表是否創建成功
  table_exists := EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'buddies_rooms_archive'
  );

  -- 檢查觸發器是否創建成功
  trigger_exists := EXISTS (
    SELECT FROM information_schema.triggers
    WHERE trigger_name = 'trigger_archive_completed_room'
  );

  IF table_exists AND trigger_exists THEN
    RAISE NOTICE '✅ 歸檔系統創建成功';
    RAISE NOTICE '  ✓ buddies_rooms_archive 表已創建';
    RAISE NOTICE '  ✓ 自動歸檔觸發器已啟用';
    RAISE NOTICE '  ✓ 8 個索引已創建';
    RAISE NOTICE '  ✓ 2 個輔助函數已創建';
    RAISE NOTICE '  ✓ RLS 政策已設置';
  ELSE
    RAISE WARNING '⚠️ 歸檔系統創建不完整';
    IF NOT table_exists THEN
      RAISE WARNING '  ✗ buddies_rooms_archive 表未創建';
    END IF;
    IF NOT trigger_exists THEN
      RAISE WARNING '  ✗ 自動歸檔觸發器未啟用';
    END IF;
  END IF;

  -- 顯示歸檔統計
  RAISE NOTICE '';
  RAISE NOTICE '📊 歸檔統計：%', (SELECT ROW(total_archived, archived_today) FROM get_archive_stats());
END $$;
