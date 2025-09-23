-- 🔍 檢查餐廳評分更新系統是否準備就緒
-- 請在 Supabase SQL Editor 中執行此查詢

-- 1. 檢查餐廳表的所有欄位
SELECT
    '📋 餐廳表欄位清單' as check_type,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'restaurants'
ORDER BY ordinal_position;

-- 2. 餐廳資料統計
SELECT
    '📊 餐廳資料統計' as check_type,
    COUNT(*) as total_restaurants,
    COUNT(CASE WHEN name IS NOT NULL AND name != '' THEN 1 END) as with_name,
    COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as with_coordinates,
    COUNT(CASE WHEN rating IS NOT NULL THEN 1 END) as with_rating,
    COUNT(CASE WHEN user_ratings_total > 0 THEN 1 END) as with_rating_count,
    COUNT(CASE WHEN rating_updated_at IS NOT NULL THEN 1 END) as with_update_time
FROM restaurants;

-- 3. 評分品質檢查
SELECT
    '🎯 評分品質檢查' as check_type,
    ROUND(AVG(rating), 2) as avg_rating,
    MIN(rating) as min_rating,
    MAX(rating) as max_rating,
    ROUND(AVG(user_ratings_total), 0) as avg_rating_count,
    COUNT(CASE WHEN rating BETWEEN 1 AND 5 THEN 1 END) as valid_ratings,
    COUNT(CASE WHEN rating < 1 OR rating > 5 THEN 1 END) as invalid_ratings
FROM restaurants
WHERE rating IS NOT NULL;

-- 4. 準備更新的餐廳數量
SELECT
    '🔄 準備更新統計' as check_type,
    COUNT(*) as ready_for_update,
    COUNT(CASE WHEN rating_updated_at IS NULL THEN 1 END) as never_updated,
    COUNT(CASE
        WHEN rating_updated_at IS NOT NULL
        AND rating_updated_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
        THEN 1
    END) as needs_update_7days,
    COUNT(CASE
        WHEN rating_updated_at IS NOT NULL
        AND rating_updated_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
        THEN 1
    END) as needs_update_30days
FROM restaurants
WHERE name IS NOT NULL
    AND name != ''
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL;

-- 5. 最近更新活動
SELECT
    '📅 最近更新活動' as check_type,
    COUNT(CASE WHEN rating_updated_at >= CURRENT_TIMESTAMP - INTERVAL '1 day' THEN 1 END) as updated_today,
    COUNT(CASE WHEN rating_updated_at >= CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 1 END) as updated_this_week,
    COUNT(CASE WHEN rating_updated_at >= CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 1 END) as updated_this_month,
    MAX(rating_updated_at) as last_update_time
FROM restaurants;

-- 6. 資料完整性檢查
SELECT
    '🔍 資料完整性檢查' as check_type,
    COUNT(CASE WHEN name IS NULL OR name = '' THEN 1 END) as missing_name,
    COUNT(CASE WHEN latitude IS NULL THEN 1 END) as missing_latitude,
    COUNT(CASE WHEN longitude IS NULL THEN 1 END) as missing_longitude,
    COUNT(CASE WHEN address IS NULL OR address = '' THEN 1 END) as missing_address,
    COUNT(CASE
        WHEN latitude IS NOT NULL
        AND (latitude < -90 OR latitude > 90)
        THEN 1
    END) as invalid_latitude,
    COUNT(CASE
        WHEN longitude IS NOT NULL
        AND (longitude < -180 OR longitude > 180)
        THEN 1
    END) as invalid_longitude
FROM restaurants;

-- 7. 系統準備狀態總結
SELECT
    '✅ 系統準備狀態' as status,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'restaurants'
            AND column_name IN ('rating', 'user_ratings_total', 'rating_updated_at')
            HAVING COUNT(*) = 3
        ) THEN '🟢 資料庫欄位：準備完成'
        ELSE '🔴 資料庫欄位：需要設定'
    END as database_fields,

    CASE
        WHEN (
            SELECT COUNT(*) FROM restaurants
            WHERE name IS NOT NULL
            AND latitude IS NOT NULL
            AND longitude IS NOT NULL
        ) > 0 THEN '🟢 餐廳資料：可以更新'
        ELSE '🔴 餐廳資料：無有效資料'
    END as restaurant_data,

    CASE
        WHEN (
            SELECT COUNT(*) FROM restaurants
            WHERE name IS NOT NULL
            AND latitude IS NOT NULL
            AND longitude IS NOT NULL
            AND (rating_updated_at IS NULL OR rating_updated_at < CURRENT_TIMESTAMP - INTERVAL '7 days')
        ) > 0 THEN CONCAT('🟡 需要更新：', (
            SELECT COUNT(*) FROM restaurants
            WHERE name IS NOT NULL
            AND latitude IS NOT NULL
            AND longitude IS NOT NULL
            AND (rating_updated_at IS NULL OR rating_updated_at < CURRENT_TIMESTAMP - INTERVAL '7 days')
        )::text, ' 間餐廳')
        ELSE '🟢 評分狀態：都是最新的'
    END as update_status;