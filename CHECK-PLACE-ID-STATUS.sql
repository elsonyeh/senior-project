-- 🔍 檢查 Google Place ID 欄位狀態
-- 驗證欄位是否存在並查看當前使用情況

-- 1. 確認 google_place_id 欄位存在
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'restaurants'
AND column_name = 'google_place_id';

-- 2. 檢查索引是否存在
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'restaurants'
AND indexname = 'idx_restaurants_google_place_id';

-- 3. 統計當前 Place ID 覆蓋率
SELECT
    COUNT(*) as total_restaurants,
    COUNT(google_place_id) as with_place_id,
    COUNT(*) - COUNT(google_place_id) as without_place_id,
    ROUND(
        (COUNT(google_place_id)::numeric / COUNT(*)) * 100, 2
    ) as place_id_coverage_percentage
FROM restaurants;

-- 4. 顯示有 Place ID 的餐廳範例
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
LIMIT 5;

-- 5. 顯示沒有 Place ID 且從未更新的餐廳
SELECT
    id,
    name,
    address,
    rating,
    rating_updated_at
FROM restaurants
WHERE google_place_id IS NULL
AND rating_updated_at IS NULL
LIMIT 5;