-- 為 restaurants 表新增 is_spicy 欄位
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS is_spicy BOOLEAN DEFAULT false;

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_restaurants_is_spicy ON restaurants(is_spicy);

-- 檢查欄位是否已新增
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'restaurants' AND column_name = 'is_spicy';