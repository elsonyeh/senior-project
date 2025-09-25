-- 擴展 is_spicy 欄位以支援 "both" 選項
-- 將 BOOLEAN 欄位改為 VARCHAR 以支援三種狀態：true, false, both

-- 1. 檢查當前 is_spicy 欄位狀態
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'restaurants' AND column_name = 'is_spicy';

-- 2. 備份當前資料
CREATE TABLE restaurants_spicy_backup AS
SELECT id, name, is_spicy
FROM restaurants
WHERE is_active = true;

-- 3. 修改欄位類型（如果是 BOOLEAN）
-- 注意：這會將 true 轉為 'true'，false 轉為 'false'，null 轉為 null
ALTER TABLE restaurants
ALTER COLUMN is_spicy TYPE VARCHAR(10) USING
  CASE
    WHEN is_spicy IS NULL THEN NULL
    WHEN is_spicy = true THEN 'true'
    WHEN is_spicy = false THEN 'false'
  END;

-- 4. 添加檢查約束確保只接受有效值
ALTER TABLE restaurants
ADD CONSTRAINT check_is_spicy_values
CHECK (is_spicy IN ('true', 'false', 'both') OR is_spicy IS NULL);

-- 5. 檢查修改後的欄位
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'restaurants' AND column_name = 'is_spicy';

-- 6. 驗證資料轉換
SELECT
  is_spicy,
  COUNT(*) as count
FROM restaurants
WHERE is_active = true
GROUP BY is_spicy
ORDER BY is_spicy;

-- 7. 範例：將某些餐廳標記為 'both'（需要根據實際情況調整）
-- 例如：火鍋店、川菜餐廳等通常可以提供辣和不辣選擇
/*
UPDATE restaurants
SET is_spicy = 'both'
WHERE is_active = true
  AND (
    tags::text ILIKE '%火鍋%' OR
    tags::text ILIKE '%川菜%' OR
    tags::text ILIKE '%湘菜%' OR
    tags::text ILIKE '%麻辣%' OR
    name ILIKE '%火鍋%' OR
    name ILIKE '%川菜%' OR
    name ILIKE '%湘菜%'
  );
*/

-- 8. 更新後的統計
SELECT
  'Total active restaurants' as description,
  COUNT(*) as count
FROM restaurants WHERE is_active = true

UNION ALL

SELECT
  'Spicy only restaurants (true)' as description,
  COUNT(*) as count
FROM restaurants WHERE is_active = true AND is_spicy = 'true'

UNION ALL

SELECT
  'Non-spicy only restaurants (false)' as description,
  COUNT(*) as count
FROM restaurants WHERE is_active = true AND is_spicy = 'false'

UNION ALL

SELECT
  'Both spicy and non-spicy (both)' as description,
  COUNT(*) as count
FROM restaurants WHERE is_active = true AND is_spicy = 'both'

UNION ALL

SELECT
  'Unknown spicy status (NULL)' as description,
  COUNT(*) as count
FROM restaurants WHERE is_active = true AND is_spicy IS NULL;