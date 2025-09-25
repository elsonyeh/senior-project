-- 🔄 將所有"飽足"標籤更新為"吃飽"
-- 檢查目前使用"飽足"的餐廳（適用於 text[] 格式）

-- 1. 檢查包含"飽足"標籤的餐廳
SELECT id, name, tags
FROM restaurants
WHERE '飽足' = ANY(tags);

-- 2. 更新所有"飽足"標籤為"吃飽"
-- 使用 array_replace 函數替換陣列中的元素
UPDATE restaurants
SET tags = array_replace(tags, '飽足', '吃飽')
WHERE '飽足' = ANY(tags);

-- 3. 驗證更新結果
SELECT id, name, tags
FROM restaurants
WHERE '吃飽' = ANY(tags)
   OR '飽足' = ANY(tags);

-- 4. 統計結果
SELECT
  '更新後包含吃飽的餐廳數量' as description,
  COUNT(*) as count
FROM restaurants
WHERE '吃飽' = ANY(tags);

SELECT
  '剩餘包含飽足的餐廳數量' as description,
  COUNT(*) as count
FROM restaurants
WHERE '飽足' = ANY(tags);