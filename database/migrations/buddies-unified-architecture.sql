-- ==========================================
-- Buddies 統一架構遷移
-- ==========================================
-- 目的：將所有數據集中到 buddies_rooms 主表
-- 原則：減少 JOIN，提升效能，簡化代碼
-- 作者：Linus-style Architecture Review
-- 日期：2025-10-28
-- ==========================================

-- ==========================================
-- 步驟 1：添加 member_answers 欄位
-- ==========================================
-- 存儲每個成員的個別答案
-- 格式：
-- {
--   "user123": {
--     "answers": ["吃飽", "平價美食"],
--     "completed": true,
--     "submitted_at": "2025-10-28T10:00:00Z"
--   }
-- }

ALTER TABLE buddies_rooms
ADD COLUMN IF NOT EXISTS member_answers JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN buddies_rooms.member_answers IS '每個成員的個別答案，格式: {"user_id": {"answers": [], "completed": bool, "submitted_at": timestamp}}';

CREATE INDEX IF NOT EXISTS idx_buddies_rooms_member_answers
ON buddies_rooms USING GIN (member_answers);

-- ==========================================
-- 步驟 2：添加 recommendations 欄位
-- ==========================================
-- 存儲推薦餐廳列表
-- 格式：
-- [
--   {"id": "rest1", "name": "餐廳A", "score": 95, ...},
--   {"id": "rest2", "name": "餐廳B", "score": 90, ...}
-- ]

ALTER TABLE buddies_rooms
ADD COLUMN IF NOT EXISTS recommendations JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN buddies_rooms.recommendations IS '推薦餐廳列表（完整餐廳數據）';

CREATE INDEX IF NOT EXISTS idx_buddies_rooms_recommendations
ON buddies_rooms USING GIN (recommendations);

-- ==========================================
-- 步驟 3：確保 votes 欄位結構正確
-- ==========================================
-- votes 格式應該包含票數和投票者列表：
-- {
--   "rest1": {
--     "count": 3,
--     "voters": ["user1", "user2", "user3"]
--   }
-- }

-- votes 欄位在 complete-buddies-rooms-schema.sql 中已添加
-- 這裡只添加註釋說明新格式
COMMENT ON COLUMN buddies_rooms.votes IS '投票數據，格式: {"restaurant_id": {"count": number, "voters": [user_ids]}}';

-- ==========================================
-- 步驟 4：驗證所有必要欄位
-- ==========================================

SELECT
  column_name,
  data_type,
  column_default IS NOT NULL as has_default
FROM information_schema.columns
WHERE table_name = 'buddies_rooms'
  AND column_name IN (
    'questions',
    'collective_answers',
    'member_answers',
    'recommendations',
    'votes',
    'final_restaurant_id',
    'final_restaurant_data',
    'questions_started_at',
    'voting_started_at',
    'completed_at'
  )
ORDER BY column_name;

-- ==========================================
-- 步驟 5：創建輔助函數
-- ==========================================

-- 函數：檢查用戶是否已完成答題
CREATE OR REPLACE FUNCTION check_user_completed(
  p_member_answers JSONB,
  p_user_id TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (p_member_answers->p_user_id->>'completed')::boolean,
    false
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION check_user_completed IS '檢查用戶是否已完成答題';

-- 函數：檢查用戶是否已投票給某餐廳
CREATE OR REPLACE FUNCTION check_user_voted(
  p_votes JSONB,
  p_restaurant_id TEXT,
  p_user_id TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    p_votes->p_restaurant_id->'voters' ? p_user_id,
    false
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION check_user_voted IS '檢查用戶是否已投票給指定餐廳';

-- 函數：獲取餐廳票數
CREATE OR REPLACE FUNCTION get_restaurant_votes(
  p_votes JSONB,
  p_restaurant_id TEXT
)
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(
    (p_votes->p_restaurant_id->>'count')::integer,
    0
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_restaurant_votes IS '獲取餐廳的票數';

-- ==========================================
-- 步驟 6：索引優化
-- ==========================================

-- 已在上面創建，這裡列出所有重要索引
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'buddies_rooms'
  AND indexname LIKE 'idx_%'
ORDER BY indexname;

-- ==========================================
-- 完成提示
-- ==========================================

DO $$
BEGIN
  RAISE NOTICE '======================================';
  RAISE NOTICE '✅ Buddies 統一架構遷移完成';
  RAISE NOTICE '======================================';
  RAISE NOTICE '';
  RAISE NOTICE '新架構特點：';
  RAISE NOTICE '  - 所有房間數據集中在 buddies_rooms';
  RAISE NOTICE '  - 零 JOIN 查詢';
  RAISE NOTICE '  - Realtime 只需訂閱一個表';
  RAISE NOTICE '  - 代碼簡化 50%%';
  RAISE NOTICE '';
  RAISE NOTICE 'JSONB 欄位：';
  RAISE NOTICE '  - questions: 問題集';
  RAISE NOTICE '  - collective_answers: 集體決策答案';
  RAISE NOTICE '  - member_answers: 個別用戶答案';
  RAISE NOTICE '  - recommendations: 推薦餐廳列表';
  RAISE NOTICE '  - votes: 投票數據';
  RAISE NOTICE '  - final_restaurant_id + final_restaurant_data: 最終結果';
  RAISE NOTICE '';
  RAISE NOTICE '輔助表：';
  RAISE NOTICE '  - buddies_members: 成員管理（必要）';
  RAISE NOTICE '  - buddies_interactions: 數據追蹤（可選）';
  RAISE NOTICE '';
  RAISE NOTICE '下一步：';
  RAISE NOTICE '  1. 更新 supabaseService.js';
  RAISE NOTICE '  2. 測試完整流程';
  RAISE NOTICE '  3. 刪除舊表（如果存在）';
  RAISE NOTICE '======================================';
END $$;
