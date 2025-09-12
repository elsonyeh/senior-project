-- 為 restaurants 表新增 suggested_people 和 original_photo_url 欄位
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS suggested_people TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS original_photo_url TEXT;

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_restaurants_suggested_people ON restaurants(suggested_people);
CREATE INDEX IF NOT EXISTS idx_restaurants_original_photo_url ON restaurants(original_photo_url);

-- 檢查欄位是否已新增
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'restaurants' 
AND column_name IN ('suggested_people', 'original_photo_url');