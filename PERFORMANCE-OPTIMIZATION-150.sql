-- 效能優化方案：針對150間餐廳的中小型資料集
-- 重點：簡單但有效的索引，避免過度優化

-- 1. 基礎單欄位索引（最重要）
CREATE INDEX IF NOT EXISTS idx_restaurants_active
ON restaurants(is_active)
WHERE is_active = true;

-- 2. 標籤搜尋優化（GIN索引對陣列搜尋很有效）
CREATE INDEX IF NOT EXISTS idx_restaurants_tags_gin
ON restaurants USING GIN(tags)
WHERE is_active = true;

-- 3. 價格篩選索引
CREATE INDEX IF NOT EXISTS idx_restaurants_price_range
ON restaurants(price_range)
WHERE is_active = true;

-- 4. 辣度篩選索引
CREATE INDEX IF NOT EXISTS idx_restaurants_spicy
ON restaurants(is_spicy)
WHERE is_active = true;

-- 5. 建議人數欄位索引
CREATE INDEX IF NOT EXISTS idx_restaurants_suggested_people
ON restaurants(suggested_people)
WHERE is_active = true;

-- 6. 複合索引（僅針對最常用的組合）
-- 活躍狀態 + 價格範圍（常見組合）
CREATE INDEX IF NOT EXISTS idx_restaurants_active_price
ON restaurants(is_active, price_range)
WHERE is_active = true;

-- 效能監控查詢
-- 檢查索引使用情況
SELECT
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'restaurants'
ORDER BY idx_tup_read DESC;

-- 檢查查詢執行計劃（範例）
EXPLAIN ANALYZE
SELECT * FROM restaurants
WHERE is_active = true
  AND price_range = 2
  AND '喝' = ANY(tags);

-- 資料表統計資訊更新（建議定期執行）
ANALYZE restaurants;