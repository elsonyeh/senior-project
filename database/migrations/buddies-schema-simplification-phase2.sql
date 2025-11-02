-- ==========================================
-- Buddies Schema 簡化遷移 - 階段 2
-- ==========================================
-- ⚠️ 警告：此腳本會刪除舊表格，執行前請確認：
-- 1. 階段 1 已執行並驗證無誤
-- 2. 新欄位和 buddies_interactions 表已正常運作
-- 3. 數據已從舊表遷移到新結構
-- 4. 已進行完整的資料備份
-- ==========================================
-- 執行時機：階段 1 運行 1-2 週並驗證無誤後
-- 作者：Linus-style Architecture Review
-- 日期：2025-10-28
-- ==========================================

-- ==========================================
-- 第一步：備份檢查
-- ==========================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '⚠️  Buddies Schema 簡化 - 階段 2';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '此腳本將刪除以下表格：';
  RAISE NOTICE '  - buddies_questions (問題集)';
  RAISE NOTICE '  - buddies_answers (答案)';
  RAISE NOTICE '  - buddies_recommendations (推薦結果)';
  RAISE NOTICE '  - buddies_votes (用戶投票追蹤)';
  RAISE NOTICE '  - buddies_restaurant_votes (餐廳票數統計)';
  RAISE NOTICE '  - buddies_final_results (最終結果)';
  RAISE NOTICE '';
  RAISE NOTICE '執行前請確認：';
  RAISE NOTICE '  ✓ 已執行階段 1 遷移';
  RAISE NOTICE '  ✓ 新結構已驗證無誤';
  RAISE NOTICE '  ✓ 已進行資料備份';
  RAISE NOTICE '  ✓ 程式碼已更新為使用新結構';
  RAISE NOTICE '';
  RAISE NOTICE '如要繼續執行，請取消註解下方的 DROP TABLE 語句';
  RAISE NOTICE '========================================';
END $$;

-- ==========================================
-- 第二步：數據驗證
-- ==========================================

-- 驗證新欄位是否已存在且有數據
DO $$
DECLARE
  rooms_with_votes INTEGER;
  rooms_with_final INTEGER;
  interactions_count INTEGER;
BEGIN
  -- 檢查 votes 欄位
  SELECT COUNT(*) INTO rooms_with_votes
  FROM buddies_rooms
  WHERE votes IS NOT NULL AND votes != '{}'::jsonb;

  -- 檢查 final_restaurant_id 欄位
  SELECT COUNT(*) INTO rooms_with_final
  FROM buddies_rooms
  WHERE final_restaurant_id IS NOT NULL;

  -- 檢查 interactions 表
  SELECT COUNT(*) INTO interactions_count
  FROM buddies_interactions;

  RAISE NOTICE '========================================';
  RAISE NOTICE '數據驗證結果：';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  - 有投票記錄的房間: %', rooms_with_votes;
  RAISE NOTICE '  - 有最終結果的房間: %', rooms_with_final;
  RAISE NOTICE '  - 互動記錄總數: %', interactions_count;
  RAISE NOTICE '========================================';

  IF rooms_with_votes = 0 AND rooms_with_final = 0 AND interactions_count = 0 THEN
    RAISE WARNING '⚠️  新結構尚未有數據，請確認程式碼是否已更新';
    RAISE WARNING '建議暫緩執行刪除操作';
  ELSE
    RAISE NOTICE '✓ 新結構已有數據，可以繼續執行';
  END IF;
END $$;

-- ==========================================
-- 第三步：比對舊表和新結構的數據一致性
-- ==========================================

-- 比對投票數據
DO $$
DECLARE
  old_votes_count INTEGER;
  new_votes_count INTEGER;
  old_final_count INTEGER;
  new_final_count INTEGER;
BEGIN
  -- 舊表的投票記錄數
  SELECT COUNT(*) INTO old_votes_count
  FROM buddies_restaurant_votes;

  -- 新結構的投票房間數
  SELECT COUNT(*) INTO new_votes_count
  FROM buddies_rooms
  WHERE votes IS NOT NULL AND votes != '{}'::jsonb;

  -- 舊表的最終結果數
  SELECT COUNT(*) INTO old_final_count
  FROM buddies_final_results;

  -- 新結構的最終結果數
  SELECT COUNT(*) INTO new_final_count
  FROM buddies_rooms
  WHERE final_restaurant_id IS NOT NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE '數據一致性檢查：';
  RAISE NOTICE '========================================';
  RAISE NOTICE '投票記錄：';
  RAISE NOTICE '  - 舊表 (buddies_restaurant_votes): %', old_votes_count;
  RAISE NOTICE '  - 新結構 (buddies_rooms.votes): %', new_votes_count;
  RAISE NOTICE '';
  RAISE NOTICE '最終結果：';
  RAISE NOTICE '  - 舊表 (buddies_final_results): %', old_final_count;
  RAISE NOTICE '  - 新結構 (buddies_rooms.final_restaurant_id): %', new_final_count;
  RAISE NOTICE '========================================';

  IF old_votes_count > new_votes_count OR old_final_count > new_final_count THEN
    RAISE WARNING '⚠️  舊表的數據比新結構多，可能尚未完全遷移';
    RAISE WARNING '建議先執行數據遷移函數';
  END IF;
END $$;

-- ==========================================
-- 第四步：創建備份表（可選）
-- ==========================================

-- 如果想保留舊數據以備查，可以創建備份表
-- 取消註解以執行

/*
CREATE TABLE IF NOT EXISTS buddies_questions_backup AS
SELECT * FROM buddies_questions;

CREATE TABLE IF NOT EXISTS buddies_answers_backup AS
SELECT * FROM buddies_answers;

CREATE TABLE IF NOT EXISTS buddies_recommendations_backup AS
SELECT * FROM buddies_recommendations;

CREATE TABLE IF NOT EXISTS buddies_votes_backup AS
SELECT * FROM buddies_votes;

CREATE TABLE IF NOT EXISTS buddies_restaurant_votes_backup AS
SELECT * FROM buddies_restaurant_votes;

CREATE TABLE IF NOT EXISTS buddies_final_results_backup AS
SELECT * FROM buddies_final_results;

RAISE NOTICE '✓ 備份表已創建（_backup 後綴）';
*/

-- ==========================================
-- 第五步：刪除舊表（謹慎執行）
-- ==========================================

-- ⚠️ 取消註解以執行刪除操作
-- ⚠️ 確保已進行資料備份

/*
DO $$
BEGIN
  -- 1. 刪除 buddies_questions 表
  DROP TABLE IF EXISTS buddies_questions CASCADE;
  RAISE NOTICE '✓ 已刪除 buddies_questions';

  -- 2. 刪除 buddies_answers 表
  DROP TABLE IF EXISTS buddies_answers CASCADE;
  RAISE NOTICE '✓ 已刪除 buddies_answers';

  -- 3. 刪除 buddies_recommendations 表
  DROP TABLE IF EXISTS buddies_recommendations CASCADE;
  RAISE NOTICE '✓ 已刪除 buddies_recommendations';

  -- 4. 刪除 buddies_votes 表
  DROP TABLE IF EXISTS buddies_votes CASCADE;
  RAISE NOTICE '✓ 已刪除 buddies_votes';

  -- 5. 刪除 buddies_restaurant_votes 表
  DROP TABLE IF EXISTS buddies_restaurant_votes CASCADE;
  RAISE NOTICE '✓ 已刪除 buddies_restaurant_votes';

  -- 6. 刪除 buddies_final_results 表
  DROP TABLE IF EXISTS buddies_final_results CASCADE;
  RAISE NOTICE '✓ 已刪除 buddies_final_results';
END $$;
*/

-- ==========================================
-- 第六步：清理相關的 RLS 政策（如果表已刪除）
-- ==========================================

-- 這些政策會隨著表的刪除自動移除（CASCADE）
-- 無需手動清理

-- ==========================================
-- 第七步：清理 Realtime 訂閱
-- ==========================================

/*
-- 從 Realtime 移除已刪除的表
-- 注意：表刪除後會自動從 publication 中移除
-- 無需手動執行以下命令

DO $$
BEGIN
  -- 這些命令僅在表仍存在時需要
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS buddies_questions;
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS buddies_answers;
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS buddies_recommendations;
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS buddies_votes;
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS buddies_restaurant_votes;
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS buddies_final_results;

  RAISE NOTICE '✓ 已從 Realtime 移除舊表';
END $$;
*/

-- ==========================================
-- 第八步：優化新結構
-- ==========================================

-- 重建統計資訊
ANALYZE buddies_rooms;
ANALYZE buddies_members;
ANALYZE buddies_interactions;

-- 清理未使用的空間（可選，需要較長時間）
-- VACUUM FULL buddies_rooms;
-- VACUUM FULL buddies_members;
-- VACUUM FULL buddies_interactions;

-- ==========================================
-- 第九步：最終驗證
-- ==========================================

-- 驗證剩餘的 Buddies 表
SELECT
  t.tablename,
  pg_size_pretty(pg_total_relation_size(t.schemaname||'.'||t.tablename)) as size,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.tablename) as columns_count
FROM pg_tables t
WHERE t.schemaname = 'public'
AND t.tablename LIKE 'buddies_%'
ORDER BY t.tablename;

-- ==========================================
-- 完成提示
-- ==========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 階段 2 遷移檢查完成';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '如果數據驗證通過，請：';
  RAISE NOTICE '1. 取消註解「第四步」創建備份表';
  RAISE NOTICE '2. 執行備份';
  RAISE NOTICE '3. 取消註解「第五步」刪除舊表';
  RAISE NOTICE '4. 再次執行此腳本';
  RAISE NOTICE '';
  RAISE NOTICE '刪除後的最終結構：';
  RAISE NOTICE '  ✓ buddies_rooms (核心房間資料)';
  RAISE NOTICE '  ✓ buddies_members (成員資訊)';
  RAISE NOTICE '  ✓ buddies_interactions (互動記錄)';
  RAISE NOTICE '';
  RAISE NOTICE '節省的表格數：6 個';
  RAISE NOTICE '========================================';
END $$;

-- ==========================================
-- 附錄：回滾腳本（緊急情況使用）
-- ==========================================

/*
-- 如果刪除後發現問題，可以從備份表恢復
-- 取消註解以執行

DO $$
BEGIN
  -- 從備份表恢復
  CREATE TABLE buddies_questions AS
  SELECT * FROM buddies_questions_backup;

  CREATE TABLE buddies_answers AS
  SELECT * FROM buddies_answers_backup;

  CREATE TABLE buddies_recommendations AS
  SELECT * FROM buddies_recommendations_backup;

  CREATE TABLE buddies_votes AS
  SELECT * FROM buddies_votes_backup;

  CREATE TABLE buddies_restaurant_votes AS
  SELECT * FROM buddies_restaurant_votes_backup;

  CREATE TABLE buddies_final_results AS
  SELECT * FROM buddies_final_results_backup;

  RAISE NOTICE '✓ 已從備份恢復舊表';
  RAISE NOTICE '⚠️  請手動執行 create-buddies-schema.sql 重建索引和 RLS 政策';
END $$;
*/
