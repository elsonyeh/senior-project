-- 完整的辣度欄位遷移腳本
-- 執行順序：
-- 1. 將 is_spicy 從 BOOLEAN 轉換為 VARCHAR 支援 'true', 'false', 'both'
-- 2. 將所有 is_spicy = 'true' 的餐廳改為 'both'
-- 3. 刪除測試餐廳

-- 步驟1：修改資料庫結構（如果尚未執行）
-- 注意：如果已經是 VARCHAR 則此步驟會失敗，可以忽略
DO $$
BEGIN
    -- 檢查欄位型別
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'restaurants'
        AND column_name = 'is_spicy'
        AND data_type = 'boolean'
    ) THEN
        -- 如果是 boolean，則轉換為 varchar
        RAISE NOTICE 'Converting is_spicy from BOOLEAN to VARCHAR...';

        -- 先備份原始資料
        ALTER TABLE restaurants ADD COLUMN is_spicy_backup BOOLEAN;
        UPDATE restaurants SET is_spicy_backup = is_spicy;

        -- 刪除原始欄位
        ALTER TABLE restaurants DROP COLUMN is_spicy;

        -- 新增 VARCHAR 欄位
        ALTER TABLE restaurants ADD COLUMN is_spicy VARCHAR(10) DEFAULT 'false';

        -- 轉換資料
        UPDATE restaurants
        SET is_spicy = CASE
            WHEN is_spicy_backup = true THEN 'true'
            WHEN is_spicy_backup = false THEN 'false'
            ELSE 'false'
        END;

        -- 移除備份欄位
        ALTER TABLE restaurants DROP COLUMN is_spicy_backup;

        RAISE NOTICE 'Conversion completed!';
    ELSE
        RAISE NOTICE 'is_spicy is already VARCHAR or does not exist as BOOLEAN';
    END IF;
END $$;

-- 步驟2：檢查更新前的狀態
SELECT
  '更新前狀態' as stage,
  is_spicy,
  COUNT(*) as count
FROM restaurants
WHERE is_active = true
GROUP BY is_spicy
ORDER BY is_spicy;

-- 步驟3：將所有 is_spicy = 'true' 的餐廳改為 'both'
-- 理由：大部分標記為辣的餐廳通常也可以提供不辣選項
UPDATE restaurants
SET is_spicy = 'both'
WHERE is_active = true
  AND is_spicy = 'true';

-- 步驟4：刪除明顯的測試餐廳
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

-- 步驟5：檢查可能重複的餐廳（基於名稱相似度）
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

-- 步驟6：檢查更新後的狀態
SELECT
  '更新後狀態' as stage,
  is_spicy,
  COUNT(*) as count
FROM restaurants
WHERE is_active = true
GROUP BY is_spicy
ORDER BY is_spicy;

-- 步驟7：檢查活躍餐廳總數
SELECT
  '活躍餐廳總數' as description,
  COUNT(*) as count
FROM restaurants
WHERE is_active = true;

-- 步驟8：顯示一些範例餐廳的更新結果
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

-- 步驟9：統計最終結果
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

-- 步驟10：驗證資料完整性
SELECT
  '資料完整性檢查' as check_type,
  CASE
    WHEN COUNT(*) = COUNT(CASE WHEN is_spicy IN ('true', 'false', 'both') THEN 1 END)
    THEN '✅ 所有活躍餐廳都有有效的辣度設定'
    ELSE '❌ 發現無效的辣度設定'
  END as result,
  COUNT(*) as total_restaurants,
  COUNT(CASE WHEN is_spicy IN ('true', 'false', 'both') THEN 1 END) as valid_spicy_settings
FROM restaurants
WHERE is_active = true;