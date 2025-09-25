-- 識別並標記可能提供辣和不辣選擇的餐廳

-- 1. 檢查可能需要標記為 'both' 的餐廳類型
SELECT id, name, tags, is_spicy
FROM restaurants
WHERE is_active = true
  AND (
    -- 火鍋類（通常可選辣度）
    tags::text ILIKE '%火鍋%' OR
    name ILIKE '%火鍋%' OR

    -- 川菜類（通常有辣和不辣選擇）
    tags::text ILIKE '%川菜%' OR
    tags::text ILIKE '%四川%' OR
    name ILIKE '%川菜%' OR
    name ILIKE '%四川%' OR

    -- 湘菜類
    tags::text ILIKE '%湘菜%' OR
    tags::text ILIKE '%湖南%' OR
    name ILIKE '%湘菜%' OR
    name ILIKE '%湖南%' OR

    -- 泰式料理（通常可調辣度）
    tags::text ILIKE '%泰式%' OR
    tags::text ILIKE '%泰國%' OR
    name ILIKE '%泰式%' OR
    name ILIKE '%泰國%' OR

    -- 韓式料理（部分可調辣度）
    tags::text ILIKE '%韓式%' OR
    tags::text ILIKE '%韓國%' OR
    name ILIKE '%韓式%' OR
    name ILIKE '%韓國%' OR

    -- 麻辣相關但可能有溫和選擇
    tags::text ILIKE '%麻辣%' OR
    name ILIKE '%麻辣%' OR

    -- 中式料理（大部分可調辣度）
    (tags::text ILIKE '%中式%' OR name ILIKE '%中式%') AND
    (tags::text ILIKE '%菜%' OR name ILIKE '%菜%')
  )
ORDER BY name;

-- 2. 更新火鍋類餐廳為 'both'
UPDATE restaurants
SET is_spicy = 'both'
WHERE is_active = true
  AND (
    tags::text ILIKE '%火鍋%' OR
    name ILIKE '%火鍋%'
  )
  AND is_spicy IS NOT NULL; -- 保留已有明確設定的

-- 3. 更新川菜類餐廳為 'both'
UPDATE restaurants
SET is_spicy = 'both'
WHERE is_active = true
  AND (
    tags::text ILIKE '%川菜%' OR
    tags::text ILIKE '%四川%' OR
    name ILIKE '%川菜%' OR
    name ILIKE '%四川%'
  )
  AND is_spicy IS NOT NULL;

-- 4. 更新湘菜類餐廳為 'both'
UPDATE restaurants
SET is_spicy = 'both'
WHERE is_active = true
  AND (
    tags::text ILIKE '%湘菜%' OR
    tags::text ILIKE '%湖南%' OR
    name ILIKE '%湘菜%' OR
    name ILIKE '%湖南%'
  )
  AND is_spicy IS NOT NULL;

-- 5. 更新泰式餐廳為 'both'（大部分泰式料理可調辣度）
UPDATE restaurants
SET is_spicy = 'both'
WHERE is_active = true
  AND (
    tags::text ILIKE '%泰式%' OR
    tags::text ILIKE '%泰國%' OR
    name ILIKE '%泰式%' OR
    name ILIKE '%泰國%'
  )
  AND is_spicy IS NOT NULL;

-- 6. 檢查更新結果
SELECT
  'Updated restaurants to both' as description,
  COUNT(*) as count
FROM restaurants
WHERE is_active = true AND is_spicy = 'both';

-- 7. 檢查各類型的分佈
SELECT
  CASE
    WHEN tags::text ILIKE '%火鍋%' OR name ILIKE '%火鍋%' THEN '火鍋類'
    WHEN tags::text ILIKE '%川菜%' OR name ILIKE '%四川%' THEN '川菜類'
    WHEN tags::text ILIKE '%湘菜%' OR name ILIKE '%湖南%' THEN '湘菜類'
    WHEN tags::text ILIKE '%泰式%' OR name ILIKE '%泰國%' THEN '泰式類'
    ELSE '其他'
  END as restaurant_type,
  is_spicy,
  COUNT(*) as count
FROM restaurants
WHERE is_active = true
  AND is_spicy = 'both'
GROUP BY
  CASE
    WHEN tags::text ILIKE '%火鍋%' OR name ILIKE '%火鍋%' THEN '火鍋類'
    WHEN tags::text ILIKE '%川菜%' OR name ILIKE '%四川%' THEN '川菜類'
    WHEN tags::text ILIKE '%湘菜%' OR name ILIKE '%湖南%' THEN '湘菜類'
    WHEN tags::text ILIKE '%泰式%' OR name ILIKE '%泰國%' THEN '泰式類'
    ELSE '其他'
  END,
  is_spicy
ORDER BY restaurant_type;

-- 8. 最終統計
SELECT
  'Spicy only (true)' as category,
  COUNT(*) as count
FROM restaurants WHERE is_active = true AND is_spicy = 'true'

UNION ALL

SELECT
  'Non-spicy only (false)' as category,
  COUNT(*) as count
FROM restaurants WHERE is_active = true AND is_spicy = 'false'

UNION ALL

SELECT
  'Both spicy and non-spicy (both)' as category,
  COUNT(*) as count
FROM restaurants WHERE is_active = true AND is_spicy = 'both'

UNION ALL

SELECT
  'Unknown (NULL)' as category,
  COUNT(*) as count
FROM restaurants WHERE is_active = true AND is_spicy IS NULL;