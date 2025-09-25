-- 檢查辣度資料的完整性和分佈

-- 1. 檢查 is_spicy 欄位的資料類型和分佈
SELECT
  is_spicy,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM restaurants WHERE is_active = true), 2) as percentage
FROM restaurants
WHERE is_active = true
GROUP BY is_spicy
ORDER BY is_spicy;

-- 2. 檢查有哪些餐廳標記為辣的
SELECT id, name, is_spicy, tags
FROM restaurants
WHERE is_active = true AND is_spicy = true
ORDER BY name
LIMIT 10;

-- 3. 檢查有哪些餐廳標記為不辣的
SELECT id, name, is_spicy, tags
FROM restaurants
WHERE is_active = true AND is_spicy = false
ORDER BY name
LIMIT 10;

-- 4. 檢查 NULL 值的餐廳
SELECT id, name, is_spicy, tags
FROM restaurants
WHERE is_active = true AND is_spicy IS NULL
ORDER BY name
LIMIT 10;

-- 5. 檢查是否有異常的資料類型
SELECT
  id,
  name,
  is_spicy,
  pg_typeof(is_spicy) as data_type
FROM restaurants
WHERE is_active = true
  AND pg_typeof(is_spicy) != 'boolean'::regtype
  AND is_spicy IS NOT NULL;

-- 6. 統計摘要
SELECT
  'Total active restaurants' as description,
  COUNT(*) as count
FROM restaurants WHERE is_active = true

UNION ALL

SELECT
  'Spicy restaurants (TRUE)' as description,
  COUNT(*) as count
FROM restaurants WHERE is_active = true AND is_spicy = true

UNION ALL

SELECT
  'Non-spicy restaurants (FALSE)' as description,
  COUNT(*) as count
FROM restaurants WHERE is_active = true AND is_spicy = false

UNION ALL

SELECT
  'Unknown spicy status (NULL)' as description,
  COUNT(*) as count
FROM restaurants WHERE is_active = true AND is_spicy IS NULL;