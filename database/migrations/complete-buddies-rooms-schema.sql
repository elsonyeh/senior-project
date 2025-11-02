-- ==========================================
-- 完善 buddies_rooms 表結構
-- ==========================================
-- 目的：添加所有缺少的欄位以支援數據追蹤
-- 執行時機：立即執行
-- 作者：Claude
-- 日期：2025-10-28
-- ==========================================

-- 第一步：添加 questions 欄位（問題集）
ALTER TABLE buddies_rooms
ADD COLUMN IF NOT EXISTS questions JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN buddies_rooms.questions IS '房間的問題集，格式: [{"question": "...", "options": [...], "source": "basic|fun"}]';

-- 第二步：添加時間追蹤欄位（如果還沒有的話）
ALTER TABLE buddies_rooms
ADD COLUMN IF NOT EXISTS questions_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS voting_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

COMMENT ON COLUMN buddies_rooms.questions_started_at IS '開始答題的時間';
COMMENT ON COLUMN buddies_rooms.voting_started_at IS '開始投票的時間';
COMMENT ON COLUMN buddies_rooms.completed_at IS '會話完成的時間';

-- 第三步：添加投票結果和最終結果欄位（如果還沒有的話）
ALTER TABLE buddies_rooms
ADD COLUMN IF NOT EXISTS votes JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS final_restaurant_id TEXT,
ADD COLUMN IF NOT EXISTS final_restaurant_data JSONB;

COMMENT ON COLUMN buddies_rooms.votes IS '投票結果統計，格式: {"restaurant_id": vote_count}';
COMMENT ON COLUMN buddies_rooms.final_restaurant_id IS '最終選定的餐廳ID';
COMMENT ON COLUMN buddies_rooms.final_restaurant_data IS '最終餐廳的完整資料（JSONB）';

-- 第四步：建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_buddies_rooms_questions
ON buddies_rooms USING GIN (questions);

CREATE INDEX IF NOT EXISTS idx_buddies_rooms_votes
ON buddies_rooms USING GIN (votes);

CREATE INDEX IF NOT EXISTS idx_buddies_rooms_final_restaurant
ON buddies_rooms(final_restaurant_id)
WHERE final_restaurant_id IS NOT NULL;

-- 第五步：驗證所有欄位是否已添加
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'buddies_rooms'
AND column_name IN (
  'questions',
  'questions_started_at',
  'voting_started_at',
  'completed_at',
  'votes',
  'final_restaurant_id',
  'final_restaurant_data'
)
ORDER BY column_name;

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '======================================';
  RAISE NOTICE '✅ buddies_rooms 表結構已完善';
  RAISE NOTICE '======================================';
  RAISE NOTICE '';
  RAISE NOTICE '新增欄位：';
  RAISE NOTICE '  - questions (JSONB) - 問題集';
  RAISE NOTICE '  - questions_started_at (TIMESTAMPTZ) - 答題開始時間';
  RAISE NOTICE '  - voting_started_at (TIMESTAMPTZ) - 投票開始時間';
  RAISE NOTICE '  - completed_at (TIMESTAMPTZ) - 完成時間';
  RAISE NOTICE '  - votes (JSONB) - 投票結果';
  RAISE NOTICE '  - final_restaurant_id (TEXT) - 最終餐廳ID';
  RAISE NOTICE '  - final_restaurant_data (JSONB) - 最終餐廳資料';
  RAISE NOTICE '';
  RAISE NOTICE '新增索引：';
  RAISE NOTICE '  - idx_buddies_rooms_questions (GIN)';
  RAISE NOTICE '  - idx_buddies_rooms_votes (GIN)';
  RAISE NOTICE '  - idx_buddies_rooms_final_restaurant';
  RAISE NOTICE '';
  RAISE NOTICE '下一步：';
  RAISE NOTICE '1. 重新測試 Buddies 模式';
  RAISE NOTICE '2. 創建房間 → 開始答題';
  RAISE NOTICE '3. 應該可以正常運作了！';
  RAISE NOTICE '======================================';
END $$;
