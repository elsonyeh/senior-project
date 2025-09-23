-- 🔄 遷移 Place ID 快取到資料庫
-- 此腳本需要在前端執行後，再用以下 SQL 驗證結果

-- 1. 檢查遷移前狀態
SELECT
    'Migration Status Check' as check_type,
    COUNT(*) as total_restaurants,
    COUNT(google_place_id) as restaurants_with_place_id,
    COUNT(*) - COUNT(google_place_id) as restaurants_without_place_id
FROM restaurants;

-- 2. 顯示已有 Place ID 的餐廳範例
SELECT
    id,
    name,
    google_place_id,
    rating,
    user_ratings_total,
    rating_updated_at
FROM restaurants
WHERE google_place_id IS NOT NULL
LIMIT 10;

-- 3. 顯示沒有 Place ID 的餐廳範例
SELECT
    id,
    name,
    address,
    rating,
    rating_updated_at
FROM restaurants
WHERE google_place_id IS NULL
LIMIT 10;

-- 4. 遷移完成後，可以用此查詢檢查結果
-- SELECT
--     COUNT(*) as migrated_count,
--     COUNT(CASE WHEN google_place_id IS NOT NULL THEN 1 END) as successful_migrations
-- FROM restaurants;