-- 🔍 分析餐點類型的使用情況
-- 評估是否需要創建專門的 meal_type 關聯表

-- 1. 統計各餐點類型的使用頻率
SELECT
  '喝' as meal_type,
  COUNT(*) as restaurant_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM restaurants WHERE is_active = true), 2) as percentage
FROM restaurants
WHERE is_active = true AND '喝' = ANY(tags)

UNION ALL

SELECT
  '吃一點' as meal_type,
  COUNT(*) as restaurant_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM restaurants WHERE is_active = true), 2) as percentage
FROM restaurants
WHERE is_active = true AND '吃一點' = ANY(tags)

UNION ALL

SELECT
  '吃飽' as meal_type,
  COUNT(*) as restaurant_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM restaurants WHERE is_active = true), 2) as percentage
FROM restaurants
WHERE is_active = true AND '吃飽' = ANY(tags)

UNION ALL

SELECT
  '無餐點類型' as meal_type,
  COUNT(*) as restaurant_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM restaurants WHERE is_active = true), 2) as percentage
FROM restaurants
WHERE is_active = true
  AND NOT ('喝' = ANY(tags) OR '吃一點' = ANY(tags) OR '吃飽' = ANY(tags))

ORDER BY restaurant_count DESC;

-- 2. 檢查是否有餐廳同時有多個餐點類型標籤
SELECT
  id,
  name,
  tags,
  CASE
    WHEN '喝' = ANY(tags) THEN 1 ELSE 0
  END +
  CASE
    WHEN '吃一點' = ANY(tags) THEN 1 ELSE 0
  END +
  CASE
    WHEN '吃飽' = ANY(tags) THEN 1 ELSE 0
  END as meal_type_count
FROM restaurants
WHERE is_active = true
  AND (
    ('喝' = ANY(tags)) + ('吃一點' = ANY(tags))::int + ('吃飽' = ANY(tags))::int > 1
  )
ORDER BY meal_type_count DESC;

-- 3. 分析 tags 陣列的平均長度和複雜度
SELECT
  AVG(array_length(tags, 1)) as avg_tags_count,
  MAX(array_length(tags, 1)) as max_tags_count,
  MIN(array_length(tags, 1)) as min_tags_count,
  COUNT(CASE WHEN array_length(tags, 1) > 10 THEN 1 END) as restaurants_with_many_tags
FROM restaurants
WHERE is_active = true AND tags IS NOT NULL;

-- 4. 檢查餐點類型與其他標籤的重疊情況
SELECT
  unnest(tags) as tag,
  COUNT(*) as usage_count
FROM restaurants
WHERE is_active = true
  AND ('喝' = ANY(tags) OR '吃一點' = ANY(tags) OR '吃飽' = ANY(tags))
GROUP BY unnest(tags)
ORDER BY usage_count DESC
LIMIT 20;