-- ==========================================
-- Buddies Schema 簡化遷移 - 階段 1
-- ==========================================
-- 目的：新增必要欄位，確保數據完整性
-- 執行時機：立即執行（無破壞性）
-- 作者：Linus-style Architecture Review
-- 日期：2025-10-28
-- ==========================================

-- ==========================================
-- 第一步：新增時間追蹤欄位到 buddies_rooms
-- ==========================================

ALTER TABLE buddies_rooms
ADD COLUMN IF NOT EXISTS questions_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS voting_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

COMMENT ON COLUMN buddies_rooms.questions_started_at IS '開始答題的時間';
COMMENT ON COLUMN buddies_rooms.voting_started_at IS '開始投票的時間';
COMMENT ON COLUMN buddies_rooms.completed_at IS '會話完成的時間';

-- ==========================================
-- 第二步：新增合併後的投票結果欄位
-- ==========================================

ALTER TABLE buddies_rooms
ADD COLUMN IF NOT EXISTS votes JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN buddies_rooms.votes IS '投票結果統計，格式: {"restaurant_id": vote_count}';

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_buddies_rooms_votes
ON buddies_rooms USING GIN (votes);

-- ==========================================
-- 第三步：新增最終結果欄位
-- ==========================================

ALTER TABLE buddies_rooms
ADD COLUMN IF NOT EXISTS final_restaurant_id TEXT,
ADD COLUMN IF NOT EXISTS final_restaurant_data JSONB;

COMMENT ON COLUMN buddies_rooms.final_restaurant_id IS '最終選定的餐廳ID';
COMMENT ON COLUMN buddies_rooms.final_restaurant_data IS '最終餐廳的完整資料（JSONB）';

CREATE INDEX IF NOT EXISTS idx_buddies_rooms_final_restaurant
ON buddies_rooms(final_restaurant_id)
WHERE final_restaurant_id IS NOT NULL;

-- ==========================================
-- 第四步：創建互動記錄表（全新）
-- ==========================================

CREATE TABLE IF NOT EXISTS buddies_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL REFERENCES buddies_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,

  -- 互動類型：view(查看), like(喜歡), skip(跳過), vote(投票)
  action_type TEXT NOT NULL CHECK (action_type IN ('view', 'like', 'skip', 'vote')),

  -- 時間戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 額外資訊（可選）
  metadata JSONB DEFAULT '{}'::jsonb,

  -- 確保相同互動不會重複記錄（可選）
  UNIQUE(room_id, user_id, restaurant_id, action_type)
);

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_buddies_interactions_room
ON buddies_interactions(room_id);

CREATE INDEX IF NOT EXISTS idx_buddies_interactions_user
ON buddies_interactions(user_id);

CREATE INDEX IF NOT EXISTS idx_buddies_interactions_restaurant
ON buddies_interactions(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_buddies_interactions_action
ON buddies_interactions(action_type);

CREATE INDEX IF NOT EXISTS idx_buddies_interactions_created
ON buddies_interactions(created_at);

-- 複合索引：常見查詢組合
CREATE INDEX IF NOT EXISTS idx_buddies_interactions_room_restaurant
ON buddies_interactions(room_id, restaurant_id);

CREATE INDEX IF NOT EXISTS idx_buddies_interactions_room_user
ON buddies_interactions(room_id, user_id);

COMMENT ON TABLE buddies_interactions IS '記錄用戶在 Buddies 模式中的所有互動行為';
COMMENT ON COLUMN buddies_interactions.action_type IS '互動類型：view(查看), like(喜歡), skip(跳過), vote(投票)';

-- ==========================================
-- 第五步：啟用 RLS（Row Level Security）
-- ==========================================

ALTER TABLE buddies_interactions ENABLE ROW LEVEL SECURITY;

-- 允許所有人讀寫（適用於 Buddies 的匿名房間機制）
-- 先刪除舊 policy（如果存在），再創建新的
DROP POLICY IF EXISTS "Allow all access to buddies_interactions" ON buddies_interactions;

CREATE POLICY "Allow all access to buddies_interactions"
ON buddies_interactions
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- ==========================================
-- 第六步：啟用 Realtime
-- ==========================================

-- 將新表加入 Realtime 訂閱
DO $$
BEGIN
  -- 添加 buddies_interactions 到 Realtime
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE buddies_interactions;
    RAISE NOTICE '✅ buddies_interactions 已加入 Realtime';
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE '⚠️  buddies_interactions 已經在 Realtime 中';
  END;
END $$;

-- ==========================================
-- 第七步：數據遷移函數（從舊表同步到新欄位）
-- ==========================================

-- 遷移投票數據：buddies_restaurant_votes -> buddies_rooms.votes
CREATE OR REPLACE FUNCTION migrate_votes_to_rooms()
RETURNS void AS $$
DECLARE
  room_record RECORD;
  votes_json JSONB;
BEGIN
  FOR room_record IN
    SELECT DISTINCT room_id FROM buddies_restaurant_votes
  LOOP
    -- 構建 votes JSONB
    SELECT jsonb_object_agg(restaurant_id, vote_count)
    INTO votes_json
    FROM buddies_restaurant_votes
    WHERE room_id = room_record.room_id;

    -- 更新到 buddies_rooms
    UPDATE buddies_rooms
    SET votes = votes_json
    WHERE id = room_record.room_id;

    RAISE NOTICE '遷移房間 % 的投票數據: %', room_record.room_id, votes_json;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 遷移最終結果：buddies_final_results -> buddies_rooms
CREATE OR REPLACE FUNCTION migrate_final_results_to_rooms()
RETURNS void AS $$
DECLARE
  result_record RECORD;
BEGIN
  FOR result_record IN
    SELECT room_id, restaurant_id, created_at
    FROM buddies_final_results
  LOOP
    UPDATE buddies_rooms
    SET
      final_restaurant_id = result_record.restaurant_id,
      completed_at = result_record.created_at
    WHERE id = result_record.room_id;

    RAISE NOTICE '遷移房間 % 的最終結果: %', result_record.room_id, result_record.restaurant_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 第八步：執行數據遷移（可選）
-- ==========================================

-- ⚠️ 只有在舊表存在且需要遷移時才執行
-- ⚠️ 如果是全新環境或舊表不存在，請跳過此步驟

-- 檢查舊表是否存在並執行遷移
DO $$
BEGIN
  -- 檢查 buddies_restaurant_votes 是否存在
  IF EXISTS (SELECT FROM information_schema.tables
             WHERE table_name = 'buddies_restaurant_votes') THEN
    RAISE NOTICE '✅ 找到 buddies_restaurant_votes 表，開始遷移投票數據';
    PERFORM migrate_votes_to_rooms();
  ELSE
    RAISE NOTICE '⚠️  buddies_restaurant_votes 表不存在，跳過投票數據遷移';
  END IF;

  -- 檢查 buddies_final_results 是否存在
  IF EXISTS (SELECT FROM information_schema.tables
             WHERE table_name = 'buddies_final_results') THEN
    RAISE NOTICE '✅ 找到 buddies_final_results 表，開始遷移最終結果';
    PERFORM migrate_final_results_to_rooms();
  ELSE
    RAISE NOTICE '⚠️  buddies_final_results 表不存在，跳過最終結果遷移';
  END IF;
END $$;

-- ==========================================
-- 驗證檢查清單
-- ==========================================

-- 檢查新欄位是否已添加
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'buddies_rooms'
AND column_name IN (
  'questions_started_at',
  'voting_started_at',
  'completed_at',
  'votes',
  'final_restaurant_id',
  'final_restaurant_data'
);

-- 檢查互動記錄表是否已建立
SELECT
  table_name,
  (SELECT COUNT(*) FROM buddies_interactions) as row_count
FROM information_schema.tables
WHERE table_name = 'buddies_interactions';

-- 檢查索引是否已建立
SELECT indexname
FROM pg_indexes
WHERE tablename IN ('buddies_rooms', 'buddies_interactions')
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- ==========================================
-- 完成提示
-- ==========================================

DO $$
BEGIN
  RAISE NOTICE '✅ 階段 1 遷移完成！';
  RAISE NOTICE '新增欄位：';
  RAISE NOTICE '  - buddies_rooms.questions_started_at';
  RAISE NOTICE '  - buddies_rooms.voting_started_at';
  RAISE NOTICE '  - buddies_rooms.completed_at';
  RAISE NOTICE '  - buddies_rooms.votes';
  RAISE NOTICE '  - buddies_rooms.final_restaurant_id';
  RAISE NOTICE '  - buddies_rooms.final_restaurant_data';
  RAISE NOTICE '新增表格：';
  RAISE NOTICE '  - buddies_interactions (互動記錄)';
  RAISE NOTICE '';
  RAISE NOTICE '下一步：';
  RAISE NOTICE '1. 執行數據遷移函數（如果有現有數據）';
  RAISE NOTICE '2. 更新程式碼以使用新欄位（雙寫模式）';
  RAISE NOTICE '3. 驗證數據一致性';
  RAISE NOTICE '4. 執行階段 2 遷移（移除舊表）';
END $$;
