-- ==========================================
-- 修復 Buddies Schema 缺少的欄位
-- ==========================================
-- 此腳本新增程式碼中使用但 Schema 中缺少的欄位
-- 執行方式：在 Supabase Dashboard 的 SQL Editor 中執行

-- 1. 為 buddies_members 新增 status 欄位
ALTER TABLE buddies_members
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

COMMENT ON COLUMN buddies_members.status IS '成員狀態: active, left';

-- 為 status 欄位建立索引
CREATE INDEX IF NOT EXISTS idx_buddies_members_status
ON buddies_members(status)
WHERE status = 'active';

-- 2. 為 buddies_rooms 新增 last_updated 欄位（如果尚未存在）
ALTER TABLE buddies_rooms
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN buddies_rooms.last_updated IS '房間最後更新時間';

-- 3. 確認 collective_answers 和 current_question_index 已存在
-- （這些應該已經由 add-collective-answers-to-buddies-rooms.sql 建立）
DO $$
BEGIN
  -- 檢查並新增 collective_answers
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buddies_rooms' AND column_name = 'collective_answers'
  ) THEN
    ALTER TABLE buddies_rooms
    ADD COLUMN collective_answers JSONB DEFAULT '{}'::jsonb;

    COMMENT ON COLUMN buddies_rooms.collective_answers IS '集體決策答案（多數決結果），格式: {"questionIndex": "answer"}';
  END IF;

  -- 檢查並新增 current_question_index
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buddies_rooms' AND column_name = 'current_question_index'
  ) THEN
    ALTER TABLE buddies_rooms
    ADD COLUMN current_question_index INTEGER DEFAULT 0;

    COMMENT ON COLUMN buddies_rooms.current_question_index IS '當前題目索引（所有人統一進度）';

    CREATE INDEX IF NOT EXISTS idx_buddies_rooms_question_index
    ON buddies_rooms(current_question_index)
    WHERE current_question_index > 0;
  END IF;
END $$;

-- 4. 為 buddies_votes 新增欄位和約束
-- 注意：buddies_votes 用於追蹤用戶對餐廳的投票（不是問題投票）
DO $$
BEGIN
  -- 檢查並新增 restaurant_id 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buddies_votes' AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE buddies_votes
    ADD COLUMN restaurant_id TEXT;
  END IF;

  -- 檢查並新增 voted_at 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buddies_votes' AND column_name = 'voted_at'
  ) THEN
    ALTER TABLE buddies_votes
    ADD COLUMN voted_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- 檢查約束是否已存在
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'buddies_votes_room_user_restaurant_unique'
  ) THEN
    -- 先刪除可能的重複資料
    DELETE FROM buddies_votes a USING buddies_votes b
    WHERE a.id > b.id
    AND a.room_id = b.room_id
    AND a.user_id = b.user_id
    AND COALESCE(a.restaurant_id, '') = COALESCE(b.restaurant_id, '');

    -- 新增 UNIQUE 約束
    ALTER TABLE buddies_votes
    ADD CONSTRAINT buddies_votes_room_user_restaurant_unique
    UNIQUE (room_id, user_id, restaurant_id);
  END IF;
END $$;

-- 5. 為 buddies_restaurant_votes 新增欄位
DO $$
BEGIN
  -- 檢查並新增 vote_count 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buddies_restaurant_votes' AND column_name = 'vote_count'
  ) THEN
    ALTER TABLE buddies_restaurant_votes
    ADD COLUMN vote_count INTEGER NOT NULL DEFAULT 0;
  END IF;

  -- 檢查並新增 updated_at 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buddies_restaurant_votes' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE buddies_restaurant_votes
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ==========================================
-- 驗證修復結果
-- ==========================================

-- 檢查 buddies_members 的 status 欄位
SELECT
  'buddies_members.status' as check_item,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'buddies_members' AND column_name = 'status'
    ) THEN '✅ 存在'
    ELSE '❌ 缺少'
  END as result;

-- 檢查 buddies_rooms 的新欄位
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM
  information_schema.columns
WHERE
  table_name = 'buddies_rooms'
  AND column_name IN ('collective_answers', 'current_question_index', 'last_updated', 'status')
ORDER BY
  column_name;

-- 檢查 buddies_votes 的欄位
SELECT
  'buddies_votes' as table_name,
  column_name,
  data_type,
  column_default
FROM
  information_schema.columns
WHERE
  table_name = 'buddies_votes'
  AND column_name IN ('restaurant_id', 'voted_at')
ORDER BY
  column_name;

-- 檢查 buddies_restaurant_votes 的欄位
SELECT
  'buddies_restaurant_votes' as table_name,
  column_name,
  data_type,
  column_default
FROM
  information_schema.columns
WHERE
  table_name = 'buddies_restaurant_votes'
  AND column_name IN ('vote_count', 'updated_at')
ORDER BY
  column_name;

-- ==========================================
-- 說明
-- ==========================================
-- 執行此腳本後：
-- 1. buddies_members.status 欄位已新增，用於追蹤成員是否離開房間
-- 2. buddies_rooms.last_updated 欄位已新增，用於追蹤房間最後更新時間
-- 3. buddies_rooms.collective_answers 和 current_question_index 已確保存在
-- 4. buddies_votes 表已新增 restaurant_id 和 voted_at 欄位，以及 UNIQUE 約束
-- 5. buddies_restaurant_votes 表已新增 vote_count 和 updated_at 欄位
