-- ==========================================
-- 清理 Buddies 表的廢棄欄位
-- ==========================================
-- 此腳本刪除已不再使用的舊欄位，釋放資料庫空間
-- ⚠️ 警告：此操作不可逆！執行前請備份資料
-- 執行方式：在 Supabase Dashboard 的 SQL Editor 中執行

-- ==========================================
-- 步驟 1: 檢查是否存在舊欄位
-- ==========================================

DO $$
DECLARE
  has_question_id BOOLEAN;
  has_option BOOLEAN;
  has_user_id_in_restaurant_votes BOOLEAN;
BEGIN
  -- 檢查 buddies_votes.question_id
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buddies_votes' AND column_name = 'question_id'
  ) INTO has_question_id;

  -- 檢查 buddies_votes.option
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buddies_votes' AND column_name = 'option'
  ) INTO has_option;

  -- 檢查 buddies_restaurant_votes.user_id（舊版錯誤欄位）
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buddies_restaurant_votes' AND column_name = 'user_id'
  ) INTO has_user_id_in_restaurant_votes;

  RAISE NOTICE '=== 舊欄位檢查結果 ===';
  RAISE NOTICE 'buddies_votes.question_id: %', CASE WHEN has_question_id THEN '存在 ⚠️' ELSE '不存在 ✅' END;
  RAISE NOTICE 'buddies_votes.option: %', CASE WHEN has_option THEN '存在 ⚠️' ELSE '不存在 ✅' END;
  RAISE NOTICE 'buddies_restaurant_votes.user_id: %', CASE WHEN has_user_id_in_restaurant_votes THEN '存在 ⚠️' ELSE '不存在 ✅' END;
END $$;

-- ==========================================
-- 步驟 2: 刪除 buddies_votes 表的舊欄位
-- ==========================================

-- 刪除舊的問題投票欄位（如果存在）
DO $$
BEGIN
  -- 刪除 question_id 欄位
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buddies_votes' AND column_name = 'question_id'
  ) THEN
    ALTER TABLE buddies_votes DROP COLUMN question_id;
    RAISE NOTICE '✅ 已刪除 buddies_votes.question_id';
  ELSE
    RAISE NOTICE '✅ buddies_votes.question_id 不存在，跳過';
  END IF;

  -- 刪除 option 欄位
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buddies_votes' AND column_name = 'option'
  ) THEN
    ALTER TABLE buddies_votes DROP COLUMN option;
    RAISE NOTICE '✅ 已刪除 buddies_votes.option';
  ELSE
    RAISE NOTICE '✅ buddies_votes.option 不存在，跳過';
  END IF;
END $$;

-- ==========================================
-- 步驟 3: 刪除 buddies_restaurant_votes 的錯誤欄位
-- ==========================================

-- 刪除 user_id 欄位（此表應只有 room_id 和 restaurant_id）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buddies_restaurant_votes' AND column_name = 'user_id'
  ) THEN
    -- 先刪除可能依賴 user_id 的舊約束
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'buddies_restaurant_votes_room_id_restaurant_id_user_id_key'
    ) THEN
      ALTER TABLE buddies_restaurant_votes
      DROP CONSTRAINT buddies_restaurant_votes_room_id_restaurant_id_user_id_key;
      RAISE NOTICE '✅ 已刪除舊的 UNIQUE 約束';
    END IF;

    ALTER TABLE buddies_restaurant_votes DROP COLUMN user_id;
    RAISE NOTICE '✅ 已刪除 buddies_restaurant_votes.user_id';
  ELSE
    RAISE NOTICE '✅ buddies_restaurant_votes.user_id 不存在，跳過';
  END IF;
END $$;

-- ==========================================
-- 步驟 4: 清理舊的約束
-- ==========================================

DO $$
BEGIN
  -- 刪除舊的 buddies_votes 約束（如果存在）
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'buddies_votes_room_id_question_id_user_id_key'
  ) THEN
    ALTER TABLE buddies_votes
    DROP CONSTRAINT buddies_votes_room_id_question_id_user_id_key;
    RAISE NOTICE '✅ 已刪除舊的 buddies_votes UNIQUE 約束';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'buddies_votes_room_question_user_unique'
  ) THEN
    ALTER TABLE buddies_votes
    DROP CONSTRAINT buddies_votes_room_question_user_unique;
    RAISE NOTICE '✅ 已刪除舊的 buddies_votes_room_question_user_unique 約束';
  END IF;
END $$;

-- ==========================================
-- 步驟 5: 清理未使用的索引
-- ==========================================

-- 刪除可能存在的舊索引
DROP INDEX IF EXISTS idx_buddies_votes_question_id;
DROP INDEX IF EXISTS idx_buddies_restaurant_votes_user_id;

-- ==========================================
-- 步驟 6: VACUUM 回收空間
-- ==========================================

-- 清理並回收空間
VACUUM FULL buddies_votes;
VACUUM FULL buddies_restaurant_votes;

-- ==========================================
-- 驗證清理結果
-- ==========================================

-- 檢查 buddies_votes 的最終欄位
SELECT
  '📋 buddies_votes 欄位清單' as info,
  column_name,
  data_type,
  CASE
    WHEN column_name IN ('id', 'room_id', 'user_id', 'restaurant_id', 'voted_at', 'created_at') THEN '✅ 正確'
    ELSE '⚠️ 未知欄位'
  END as status
FROM
  information_schema.columns
WHERE
  table_name = 'buddies_votes'
ORDER BY
  ordinal_position;

-- 檢查 buddies_restaurant_votes 的最終欄位
SELECT
  '📋 buddies_restaurant_votes 欄位清單' as info,
  column_name,
  data_type,
  CASE
    WHEN column_name IN ('id', 'room_id', 'restaurant_id', 'vote_count', 'updated_at', 'created_at') THEN '✅ 正確'
    ELSE '⚠️ 未知欄位'
  END as status
FROM
  information_schema.columns
WHERE
  table_name = 'buddies_restaurant_votes'
ORDER BY
  ordinal_position;

-- 檢查表格大小
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size('public.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size('public.'||tablename) - pg_relation_size('public.'||tablename)) as indexes_size
FROM
  pg_tables
WHERE
  schemaname = 'public'
  AND tablename IN ('buddies_votes', 'buddies_restaurant_votes')
ORDER BY
  tablename;

-- ==========================================
-- 說明
-- ==========================================
-- 執行此腳本後：
-- 1. buddies_votes 只保留：id, room_id, user_id, restaurant_id, voted_at, created_at
-- 2. buddies_restaurant_votes 只保留：id, room_id, restaurant_id, vote_count, updated_at, created_at
-- 3. 已刪除所有舊的問題投票相關欄位 (question_id, option)
-- 4. 已刪除錯誤的 user_id 欄位（從 buddies_restaurant_votes）
-- 5. 已執行 VACUUM FULL 回收磁碟空間
--
-- ⚠️ 注意：
-- - 此操作不可逆，執行前請確認已備份
-- - VACUUM FULL 會鎖定表格，建議在低流量時段執行
-- - 如果沒有舊欄位，腳本會自動跳過相關操作
