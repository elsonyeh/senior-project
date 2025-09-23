-- 🧪 測試收藏清單與餐廳資料的 JOIN 查詢
-- 確認 restaurant_id 外鍵關聯是否正確

-- 1. 檢查 favorite_list_places 與 restaurants 的關聯
SELECT
    flp.id as favorite_id,
    flp.restaurant_id,
    flp.notes,
    flp.added_at,
    r.name as restaurant_name,
    r.address,
    r.rating,
    r.category
FROM favorite_list_places flp
LEFT JOIN restaurants r ON flp.restaurant_id = r.id
LIMIT 10;

-- 2. 檢查是否有無效的 restaurant_id（找不到對應餐廳）
SELECT
    flp.id,
    flp.restaurant_id,
    'Missing restaurant' as issue
FROM favorite_list_places flp
LEFT JOIN restaurants r ON flp.restaurant_id = r.id
WHERE r.id IS NULL;

-- 3. 模擬 Supabase 的嵌套查詢結果格式
SELECT
    ufl.id as list_id,
    ufl.name as list_name,
    ufl.user_id,
    json_agg(
        json_build_object(
            'id', flp.id,
            'restaurant_id', flp.restaurant_id,
            'notes', flp.notes,
            'added_at', flp.added_at,
            'restaurants', json_build_object(
                'id', r.id,
                'name', r.name,
                'address', r.address,
                'rating', r.rating,
                'latitude', r.latitude,
                'longitude', r.longitude,
                'category', r.category,
                'primary_image_url', r.primary_image_url
            )
        )
    ) as favorite_list_places
FROM user_favorite_lists ufl
LEFT JOIN favorite_list_places flp ON ufl.id = flp.list_id
LEFT JOIN restaurants r ON flp.restaurant_id = r.id
GROUP BY ufl.id, ufl.name, ufl.user_id
LIMIT 5;