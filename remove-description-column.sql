-- 最終驗證 category 和 description 完全相同
SELECT 
  COUNT(*) as total_restaurants,
  COUNT(CASE WHEN category = description THEN 1 END) as identical_count,
  COUNT(CASE WHEN category != description OR category IS NULL OR description IS NULL THEN 1 END) as different_count
FROM restaurants;

-- 顯示前 5 間餐廳的範例
SELECT name, category, description 
FROM restaurants 
ORDER BY name 
LIMIT 5;

-- 移除 description 欄位
ALTER TABLE restaurants DROP COLUMN IF EXISTS description;

-- 驗證欄位已被移除
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'restaurants' 
AND column_name = 'description';