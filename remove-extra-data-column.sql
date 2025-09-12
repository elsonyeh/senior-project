-- 最後驗證 extra_data 中只有 originalUpdatedAt 等不重要的資料
SELECT name, extra_data 
FROM restaurants 
WHERE extra_data IS NOT NULL 
LIMIT 5;

-- 確認新欄位已正確遷移
SELECT name, suggested_people, original_photo_url, extra_data 
FROM restaurants 
WHERE suggested_people IS NOT NULL OR original_photo_url IS NOT NULL
LIMIT 5;

-- 移除 extra_data 欄位
ALTER TABLE restaurants DROP COLUMN IF EXISTS extra_data;

-- 驗證欄位已被移除
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'restaurants' 
AND column_name = 'extra_data';