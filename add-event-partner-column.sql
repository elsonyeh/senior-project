-- 新增活動合作店家欄位到 restaurants 表
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS is_event_partner BOOLEAN DEFAULT false;

-- 為欄位新增註解
COMMENT ON COLUMN restaurants.is_event_partner IS '是否為活動合作店家';

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_restaurants_event_partner
ON restaurants(is_event_partner)
WHERE is_event_partner = true;
