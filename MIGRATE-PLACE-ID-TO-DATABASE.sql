-- 🔄 遷移 localStorage 中的 Place ID 快取到資料庫
-- 此腳本用於檢查並遷移現有的 Place ID 資料

-- 1. 檢查遷移前的狀態
SELECT
    'Before Migration' as status,
    COUNT(*) as total_restaurants,
    COUNT(google_place_id) as with_place_id,
    COUNT(*) - COUNT(google_place_id) as without_place_id,
    ROUND(
        (COUNT(google_place_id)::float / COUNT(*)) * 100, 2
    ) as place_id_coverage_percentage
FROM restaurants;

-- 2. 顯示目前沒有 Place ID 的餐廳數量（依更新時間排序）
SELECT
    'Restaurants Without Place ID' as info,
    COUNT(*) as count,
    COUNT(CASE WHEN rating_updated_at IS NULL THEN 1 END) as never_updated,
    COUNT(CASE WHEN rating_updated_at IS NOT NULL THEN 1 END) as has_updates
FROM restaurants
WHERE google_place_id IS NULL;

-- 3. 顯示最需要 Place ID 的餐廳（從未更新過的）
SELECT
    id,
    name,
    address,
    rating,
    rating_updated_at,
    created_at
FROM restaurants
WHERE google_place_id IS NULL
AND rating_updated_at IS NULL
ORDER BY created_at
LIMIT 10;

-- 4. 顯示已有 Place ID 的餐廳範例
SELECT
    id,
    name,
    google_place_id,
    rating,
    user_ratings_total,
    rating_updated_at
FROM restaurants
WHERE google_place_id IS NOT NULL
ORDER BY rating_updated_at DESC NULLS LAST
LIMIT 10;

-- 5. 遷移完成後的驗證查詢（執行遷移後使用）
-- SELECT
--     'After Migration' as status,
--     COUNT(*) as total_restaurants,
--     COUNT(google_place_id) as with_place_id,
--     COUNT(*) - COUNT(google_place_id) as without_place_id,
--     ROUND(
--         (COUNT(google_place_id)::float / COUNT(*)) * 100, 2
--     ) as place_id_coverage_percentage
-- FROM restaurants;

-- 6. 檢查最近更新的餐廳是否有 Place ID
-- SELECT
--     id,
--     name,
--     google_place_id,
--     rating,
--     rating_updated_at
-- FROM restaurants
-- WHERE rating_updated_at >= NOW() - INTERVAL '1 day'
-- ORDER BY rating_updated_at DESC
-- LIMIT 20;