-- ==========================================
-- 為 SwiftTaste 模式新增互動記錄表
-- ==========================================
-- 目的：記錄 SwiftTaste 模式中用戶的詳細互動行為
-- 包括：查看、喜歡、跳過等動作
-- ==========================================

-- ==========================================
-- 第一步：創建 SwiftTaste 互動記錄表
-- ==========================================

CREATE TABLE IF NOT EXISTS swifttaste_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id TEXT,
  restaurant_id TEXT NOT NULL,

  -- 互動類型：view(查看), like(喜歡), skip(跳過), final(最終選擇)
  action_type TEXT NOT NULL CHECK (action_type IN ('view', 'like', 'skip', 'final')),

  -- 時間戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 額外資訊（可選）
  metadata JSONB DEFAULT '{}'::jsonb,

  -- 外鍵（軟關聯，因為 user_selection_history 可能被刪除）
  CONSTRAINT fk_session
    FOREIGN KEY (session_id)
    REFERENCES user_selection_history(id)
    ON DELETE CASCADE,

  -- 確保相同互動不會重複記錄（可選）
  UNIQUE(session_id, restaurant_id, action_type)
);

-- ==========================================
-- 第二步：建立索引以提升查詢效能
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_swifttaste_interactions_session
ON swifttaste_interactions(session_id);

CREATE INDEX IF NOT EXISTS idx_swifttaste_interactions_user
ON swifttaste_interactions(user_id);

CREATE INDEX IF NOT EXISTS idx_swifttaste_interactions_restaurant
ON swifttaste_interactions(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_swifttaste_interactions_action
ON swifttaste_interactions(action_type);

CREATE INDEX IF NOT EXISTS idx_swifttaste_interactions_created
ON swifttaste_interactions(created_at);

-- 複合索引：常見查詢組合
CREATE INDEX IF NOT EXISTS idx_swifttaste_interactions_session_restaurant
ON swifttaste_interactions(session_id, restaurant_id);

-- ==========================================
-- 第三步：為 user_selection_history 新增時間戳欄位
-- ==========================================

-- 新增各階段的時間戳
ALTER TABLE user_selection_history
ADD COLUMN IF NOT EXISTS questions_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS fun_questions_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS restaurants_started_at TIMESTAMPTZ;

COMMENT ON COLUMN user_selection_history.questions_started_at IS '開始基本問題的時間';
COMMENT ON COLUMN user_selection_history.fun_questions_started_at IS '開始趣味問題的時間';
COMMENT ON COLUMN user_selection_history.restaurants_started_at IS '開始查看餐廳的時間';

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_user_selection_history_timestamps
ON user_selection_history(started_at, completed_at)
WHERE completed_at IS NOT NULL;

-- ==========================================
-- 第四步：啟用 RLS（Row Level Security）
-- ==========================================

ALTER TABLE swifttaste_interactions ENABLE ROW LEVEL SECURITY;

-- 允許所有人讀寫（與 user_selection_history 一致）
-- 先刪除舊 policy（如果存在），再創建新的
DROP POLICY IF EXISTS "Allow all access to swifttaste_interactions" ON swifttaste_interactions;

CREATE POLICY "Allow all access to swifttaste_interactions"
ON swifttaste_interactions
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- ==========================================
-- 第五步：啟用 Realtime
-- ==========================================

-- 將新表加入 Realtime 訂閱
DO $$
BEGIN
  -- 添加 swifttaste_interactions 到 Realtime
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE swifttaste_interactions;
    RAISE NOTICE '✅ swifttaste_interactions 已加入 Realtime';
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE '⚠️  swifttaste_interactions 已經在 Realtime 中';
  END;
END $$;

-- ==========================================
-- 第六步：創建輔助函數
-- ==========================================

-- 獲取會話的互動摘要
CREATE OR REPLACE FUNCTION get_session_interaction_summary(p_session_id UUID)
RETURNS TABLE (
  total_interactions BIGINT,
  view_count BIGINT,
  like_count BIGINT,
  skip_count BIGINT,
  unique_restaurants BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_interactions,
    COUNT(*) FILTER (WHERE action_type = 'view') as view_count,
    COUNT(*) FILTER (WHERE action_type = 'like') as like_count,
    COUNT(*) FILTER (WHERE action_type = 'skip') as skip_count,
    COUNT(DISTINCT restaurant_id) as unique_restaurants
  FROM swifttaste_interactions
  WHERE session_id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- 獲取餐廳的互動統計
CREATE OR REPLACE FUNCTION get_restaurant_interaction_stats(p_restaurant_id TEXT)
RETURNS TABLE (
  restaurant_id TEXT,
  view_count BIGINT,
  like_count BIGINT,
  skip_count BIGINT,
  final_count BIGINT,
  unique_sessions BIGINT,
  like_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p_restaurant_id,
    COUNT(*) FILTER (WHERE action_type = 'view') as view_count,
    COUNT(*) FILTER (WHERE action_type = 'like') as like_count,
    COUNT(*) FILTER (WHERE action_type = 'skip') as skip_count,
    COUNT(*) FILTER (WHERE action_type = 'final') as final_count,
    COUNT(DISTINCT session_id) as unique_sessions,
    CASE
      WHEN COUNT(*) FILTER (WHERE action_type = 'view') > 0
      THEN ROUND(
        COUNT(*) FILTER (WHERE action_type = 'like')::numeric /
        COUNT(*) FILTER (WHERE action_type = 'view')::numeric * 100,
        2
      )
      ELSE 0
    END as like_rate
  FROM swifttaste_interactions
  WHERE restaurant_id = p_restaurant_id;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 驗證檢查清單
-- ==========================================

-- 檢查新表是否已建立
SELECT
  table_name,
  (SELECT COUNT(*) FROM swifttaste_interactions) as row_count
FROM information_schema.tables
WHERE table_name = 'swifttaste_interactions';

-- 檢查新欄位是否已添加
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_selection_history'
AND column_name IN (
  'questions_started_at',
  'fun_questions_started_at',
  'restaurants_started_at'
);

-- 檢查索引是否已建立
SELECT indexname
FROM pg_indexes
WHERE tablename = 'swifttaste_interactions'
AND indexname LIKE 'idx_%'
ORDER BY indexname;

-- 測試輔助函數
SELECT * FROM get_session_interaction_summary('00000000-0000-0000-0000-000000000000'::UUID);

-- ==========================================
-- 完成提示
-- ==========================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SwiftTaste 互動記錄表已創建';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '新增內容：';
  RAISE NOTICE '  - swifttaste_interactions 表';
  RAISE NOTICE '  - user_selection_history 時間戳欄位';
  RAISE NOTICE '  - 相關索引和 RLS 政策';
  RAISE NOTICE '  - 輔助查詢函數';
  RAISE NOTICE '';
  RAISE NOTICE '下一步：';
  RAISE NOTICE '1. 更新前端代碼記錄互動';
  RAISE NOTICE '2. 更新 DataAnalyticsPage 顯示新數據';
  RAISE NOTICE '3. 測試驗證數據記錄';
  RAISE NOTICE '========================================';
END $$;
