-- 綜合更新：將true改為both、刪除測試餐廳、清理資料

-- 1. 檢查更新前的狀態
SELECT
  '更新前狀態' as stage,
  is_spicy,
  COUNT(*) as count
FROM restaurants
WHERE is_active = true
GROUP BY is_spicy
ORDER BY is_spicy;

-- 2. 將所有 is_spicy = 'true' 的餐廳改為 'both'
-- 理由：大部分標記為辣的餐廳通常也可以提供不辣選項
UPDATE restaurants
SET is_spicy = 'both'
WHERE is_active = true
  AND is_spicy = 'true';

-- 3. 刪除明顯的測試餐廳
-- 基於常見的測試餐廳名稱模式
DELETE FROM restaurants
WHERE is_active = true
  AND (
    name ILIKE '%測試%' OR
    name ILIKE '%test%' OR
    name ILIKE '%demo%' OR
    name ILIKE '%範例%' OR
    name ILIKE '%sample%' OR
    name ILIKE '%example%' OR
    name = '餐廳1' OR
    name = '餐廳2' OR
    name = '餐廳3' OR
    name ILIKE '餐廳_' OR
    name ILIKE 'Restaurant %' OR
    name ILIKE '新餐廳%' OR
    -- 檢查是否有重複或無效的餐廳名稱
    LENGTH(TRIM(name)) < 2
  );

-- 4. 清理重複的餐廳（基於名稱相似度）
-- 標記可能重複的餐廳供手動檢查
SELECT
  '可能重複的餐廳' as note,
  name,
  COUNT(*) as duplicate_count,
  STRING_AGG(id::text, ', ') as restaurant_ids
FROM restaurants
WHERE is_active = true
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 5. 檢查更新後的狀態
SELECT
  '更新後狀態' as stage,
  is_spicy,
  COUNT(*) as count
FROM restaurants
WHERE is_active = true
GROUP BY is_spicy
ORDER BY is_spicy;

-- 6. 檢查刪除的餐廳數量
SELECT
  '活躍餐廳總數' as description,
  COUNT(*) as count
FROM restaurants
WHERE is_active = true;

-- 7. 顯示一些範例餐廳的更新結果
SELECT
  id,
  name,
  is_spicy,
  tags,
  created_at
FROM restaurants
WHERE is_active = true
  AND is_spicy = 'both'
ORDER BY created_at DESC
LIMIT 10;

-- 8. 統計最終結果
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