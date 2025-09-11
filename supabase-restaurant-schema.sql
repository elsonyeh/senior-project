-- 餐廳資料表 SQL Schema
-- 包含餐廳資訊與照片儲存

-- 1. 餐廳主資料表
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firebase_id VARCHAR(100) UNIQUE, -- 原始 Firebase ID (用於資料遷移)
  name VARCHAR(255) NOT NULL,
  description TEXT,
  address VARCHAR(500),
  phone VARCHAR(50),
  category VARCHAR(100), -- 餐廳類型（如：中式、西式、日式等）
  price_range INTEGER CHECK (price_range >= 1 AND price_range <= 4), -- 1-4 價格等級
  rating DECIMAL(3,2) CHECK (rating >= 0 AND rating <= 5), -- 評分 0-5
  opening_hours JSONB, -- 營業時間 JSON 格式
  latitude DECIMAL(10, 8), -- 緯度
  longitude DECIMAL(11, 8), -- 經度
  tags TEXT[], -- 標籤陣列 (如: ['素食', '外送', '停車場'])
  website_url VARCHAR(500),
  social_media JSONB, -- 社交媒體連結 JSON 格式
  extra_data JSONB, -- 額外資料儲存 (原始 Firebase 資料)
  is_active BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false, -- 是否為推薦餐廳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 餐廳照片表 (支援上傳和外部連結)
CREATE TABLE IF NOT EXISTS restaurant_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  image_url VARCHAR(1000) NOT NULL, -- 圖片 URL (Supabase Storage 或外部連結)
  image_path VARCHAR(500), -- Storage 路徑 (僅上傳檔案時使用)
  source_type VARCHAR(20) DEFAULT 'upload' CHECK (source_type IN ('upload', 'external')), -- 來源類型
  alt_text VARCHAR(255), -- 圖片替代文字
  image_type VARCHAR(50) DEFAULT 'general', -- 圖片類型：'logo', 'interior', 'food', 'general'
  display_order INTEGER DEFAULT 0, -- 顯示順序
  is_primary BOOLEAN DEFAULT false, -- 是否為主要照片
  file_size INTEGER, -- 檔案大小 (bytes，僅上傳檔案時使用)
  width INTEGER, -- 圖片寬度
  height INTEGER, -- 圖片高度
  uploaded_by UUID, -- 上傳者/新增者 (可連接到用戶表)
  external_source VARCHAR(255), -- 外部來源網站名稱 (如: 'Google', 'Facebook', '官網')
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 餐廳菜單表 (選用)
CREATE TABLE IF NOT EXISTS restaurant_menu_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2),
  category VARCHAR(100), -- 菜品類別
  image_url VARCHAR(1000), -- 菜品照片
  is_available BOOLEAN DEFAULT true,
  is_recommended BOOLEAN DEFAULT false, -- 推薦菜品
  allergens TEXT[], -- 過敏原資訊
  dietary_info TEXT[], -- 飲食資訊 (如: ['素食', '無麩質'])
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 餐廳評論表 (選用)
CREATE TABLE IF NOT EXISTS restaurant_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID, -- 評論者 ID
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  visit_date DATE,
  is_verified BOOLEAN DEFAULT false, -- 是否為驗證評論
  helpful_count INTEGER DEFAULT 0, -- 有用計數
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引優化
CREATE INDEX IF NOT EXISTS idx_restaurants_firebase_id ON restaurants(firebase_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_category ON restaurants(category);
CREATE INDEX IF NOT EXISTS idx_restaurants_price_range ON restaurants(price_range);
CREATE INDEX IF NOT EXISTS idx_restaurants_rating ON restaurants(rating);
CREATE INDEX IF NOT EXISTS idx_restaurants_location ON restaurants(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_restaurants_active ON restaurants(is_active);
CREATE INDEX IF NOT EXISTS idx_restaurants_featured ON restaurants(featured);
CREATE INDEX IF NOT EXISTS idx_restaurant_images_restaurant_id ON restaurant_images(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_images_primary ON restaurant_images(is_primary);
CREATE INDEX IF NOT EXISTS idx_restaurant_menu_restaurant_id ON restaurant_menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_reviews_restaurant_id ON restaurant_reviews(restaurant_id);

-- RLS (Row Level Security) 政策
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_reviews ENABLE ROW LEVEL SECURITY;

-- 公開讀取政策 (所有人都能查看餐廳資料)
CREATE POLICY "公開查看餐廳" ON restaurants
  FOR SELECT USING (is_active = true);

CREATE POLICY "公開查看餐廳照片" ON restaurant_images
  FOR SELECT USING (true);

CREATE POLICY "公開查看菜單" ON restaurant_menu_items
  FOR SELECT USING (is_available = true);

CREATE POLICY "公開查看評論" ON restaurant_reviews
  FOR SELECT USING (true);

-- 管理員寫入政策 (需要 auth.role() = 'admin' 或類似權限控制)
CREATE POLICY "管理員管理餐廳" ON restaurants
  FOR ALL USING (auth.role() = 'admin');

CREATE POLICY "管理員管理照片" ON restaurant_images
  FOR ALL USING (auth.role() = 'admin');

CREATE POLICY "管理員管理菜單" ON restaurant_menu_items
  FOR ALL USING (auth.role() = 'admin');

-- 用戶評論政策 (已登入用戶可以新增評論)
CREATE POLICY "已登入用戶可評論" ON restaurant_reviews
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "用戶可編輯自己的評論" ON restaurant_reviews
  FOR UPDATE USING (auth.uid() = user_id);

-- 觸發器：自動更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_restaurant_images_updated_at BEFORE UPDATE ON restaurant_images
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_restaurant_menu_items_updated_at BEFORE UPDATE ON restaurant_menu_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_restaurant_reviews_updated_at BEFORE UPDATE ON restaurant_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage Bucket 建立 (需要在 Supabase Dashboard 中手動建立或使用 SQL)
-- Supabase Storage 的 SQL 指令
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'restaurant-images',
  'restaurant-images',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
) ON CONFLICT (id) DO NOTHING;

-- Storage 政策：允許公開讀取
CREATE POLICY "公開讀取餐廳照片" ON storage.objects
  FOR SELECT USING (bucket_id = 'restaurant-images');

-- Storage 政策：已認證用戶可上傳
CREATE POLICY "已認證用戶可上傳餐廳照片" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'restaurant-images' 
    AND auth.role() = 'authenticated'
  );

-- Storage 政策：管理員可刪除
CREATE POLICY "管理員可刪除餐廳照片" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'restaurant-images' 
    AND auth.role() = 'admin'
  );