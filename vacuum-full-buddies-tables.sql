-- ==========================================
-- VACUUM FULL - 完全回收 Buddies 表空間
-- ==========================================
-- 此腳本執行 VACUUM FULL 以完全回收已刪除欄位的磁碟空間
-- ⚠️ 警告：會完全鎖定表格，建議在低流量時段執行
-- 執行方式：在 Supabase Dashboard 的 SQL Editor 中執行

-- ==========================================
-- 執行前檢查
-- ==========================================

-- 檢查表格當前大小
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size('public.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size('public.'||tablename) - pg_relation_size('public.'||tablename)) as indexes_size,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows
FROM
  pg_tables t
LEFT JOIN
  pg_stat_user_tables s ON t.tablename = s.relname
WHERE
  schemaname = 'public'
  AND tablename LIKE 'buddies_%'
ORDER BY
  pg_total_relation_size('public.'||tablename) DESC;

-- ==========================================
-- 執行 VACUUM FULL
-- ==========================================

-- ⚠️ 注意：以下命令會完全鎖定表格
-- 估計執行時間：依表格大小而定，通常數秒到數分鐘

VACUUM FULL buddies_votes;
VACUUM FULL buddies_restaurant_votes;
VACUUM FULL buddies_rooms;
VACUUM FULL buddies_members;
VACUUM FULL buddies_questions;
VACUUM FULL buddies_answers;
VACUUM FULL buddies_recommendations;
VACUUM FULL buddies_final_results;

-- ==========================================
-- 執行後驗證
-- ==========================================

-- 再次檢查表格大小（應該會變小）
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) as total_size_after,
  pg_size_pretty(pg_relation_size('public.'||tablename)) as table_size_after,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows_after
FROM
  pg_tables t
LEFT JOIN
  pg_stat_user_tables s ON t.tablename = s.relname
WHERE
  schemaname = 'public'
  AND tablename LIKE 'buddies_%'
ORDER BY
  pg_total_relation_size('public.'||tablename) DESC;

-- ==========================================
-- 說明
-- ==========================================
-- VACUUM FULL 的效果：
-- 1. 完全重建表格，回收所有未使用的空間
-- 2. 更新統計資訊，優化查詢計劃
-- 3. 重建索引，提升查詢效能
--
-- ⚠️ 注意事項：
-- - 執行期間表格會被完全鎖定（不能讀寫）
-- - 需要額外的磁碟空間（約為表格大小的 2 倍）
-- - 執行時間視表格大小而定
-- - 建議在低流量時段執行
--
-- 💡 替代方案：
-- 如不想鎖定表格，可以只執行：
--   VACUUM ANALYZE buddies_votes;
-- 這不會鎖定表格，但回收空間的效果較差
--
-- 📊 執行建議：
-- - 開發環境：可隨時執行
-- - 生產環境：建議在維護時段執行
-- - 大型表格：考慮分批執行或使用 VACUUM ANALYZE
