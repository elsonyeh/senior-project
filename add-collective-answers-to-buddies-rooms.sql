-- ==========================================
-- 為 buddies_rooms 新增集體答案欄位
-- ==========================================
-- 用於儲存多人模式下的集體決策答案
-- 格式: { "0": "吃", "1": "平價美食" }
-- 鍵為題目索引，值為多數決答案

-- 新增 collective_answers 欄位
ALTER TABLE buddies_rooms
ADD COLUMN IF NOT EXISTS collective_answers JSONB DEFAULT '{}'::jsonb;

-- 新增 current_question_index 欄位（追蹤當前題目）
ALTER TABLE buddies_rooms
ADD COLUMN IF NOT EXISTS current_question_index INTEGER DEFAULT 0;

-- 為欄位新增註解
COMMENT ON COLUMN buddies_rooms.collective_answers IS '集體決策答案（多數決結果），格式: {"questionIndex": "answer"}';
COMMENT ON COLUMN buddies_rooms.current_question_index IS '當前題目索引（所有人統一進度）';

-- 建立索引提升查詢效能
CREATE INDEX IF NOT EXISTS idx_buddies_rooms_question_index
ON buddies_rooms(current_question_index)
WHERE current_question_index > 0;

-- 驗證欄位是否新增成功
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM
  information_schema.columns
WHERE
  table_name = 'buddies_rooms'
  AND column_name IN ('collective_answers', 'current_question_index')
ORDER BY
  ordinal_position;
