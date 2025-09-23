-- 🚀 新增 Google Place ID 欄位到餐廳表
-- 請在 Supabase SQL Editor 中執行此腳本

-- 1. 新增 google_place_id 欄位
ALTER TABLE restaurants
ADD COLUMN google_place_id TEXT;

-- 2. 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_restaurants_google_place_id
ON restaurants(google_place_id);

-- 3. 新增註釋
COMMENT ON COLUMN restaurants.google_place_id IS 'Google Places API 的 Place ID，用於快速獲取最新評分資訊';

-- 4. 檢查結果
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'restaurants'
AND column_name = 'google_place_id';

-- 5. 顯示新增後的表結構（psql 命令，在 Supabase SQL Editor 中可能不支援）
-- \d restaurants;

-- 6. 統計目前有多少餐廳已有 google_place_id
SELECT
    COUNT(*) as total_restaurants,
    COUNT(google_place_id) as with_place_id,
    COUNT(*) - COUNT(google_place_id) as without_place_id,
    ROUND(
        (COUNT(google_place_id)::float / COUNT(*)) * 100, 2
    ) as place_id_coverage_percentage
FROM restaurants;