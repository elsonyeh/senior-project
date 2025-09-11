-- 🏗️ SwiftTaste 完整數據庫重建腳本
-- 這個腳本將完全重建你的 Supabase 數據庫架構
-- 請在 Supabase SQL Editor 中按順序執行

-- ==========================================
-- 第一階段：清理現有資源（如果存在）
-- ==========================================

-- 移除所有觸發器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP TRIGGER IF EXISTS trigger_update_places_count ON favorite_list_places;
DROP TRIGGER IF EXISTS trigger_update_user_lists_stats ON user_favorite_lists;
DROP TRIGGER IF EXISTS trigger_update_user_history_stats ON swifttaste_history;

-- 移除所有函數
DROP FUNCTION IF EXISTS create_user_profile();
DROP FUNCTION IF EXISTS sync_user_profile();
DROP FUNCTION IF EXISTS update_list_places_count();
DROP FUNCTION IF EXISTS update_user_stats();

-- 移除所有 RLS 政策
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can manage own favorite lists" ON user_favorite_lists;
DROP POLICY IF EXISTS "Users can view public lists" ON user_favorite_lists;
DROP POLICY IF EXISTS "Users can manage own list places" ON favorite_list_places;
DROP POLICY IF EXISTS "Users can manage own history" ON swifttaste_history;

-- 移除所有表格（按依賴順序）
DROP TABLE IF EXISTS favorite_list_places CASCADE;
DROP TABLE IF EXISTS swifttaste_history CASCADE;
DROP TABLE IF EXISTS user_favorite_lists CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- ==========================================
-- 第二階段：重新創建表格結構
-- ==========================================

-- 1. 創建用戶檔案表
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  bio TEXT,
  avatar_url TEXT,
  favorite_lists_count INTEGER DEFAULT 0,
  swifttaste_count INTEGER DEFAULT 0,
  buddies_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 創建用戶收藏清單表
CREATE TABLE user_favorite_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  color VARCHAR(20) DEFAULT '#ff6b35',
  is_public BOOLEAN DEFAULT false,
  places_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 創建收藏清單地點表
CREATE TABLE favorite_list_places (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID REFERENCES user_favorite_lists(id) ON DELETE CASCADE NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT DEFAULT '',
  rating DECIMAL(2,1),
  photo_url TEXT,
  notes TEXT DEFAULT '',
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 創建 SwiftTaste 歷史記錄表
CREATE TABLE swifttaste_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  session_type VARCHAR(50) NOT NULL DEFAULT 'swift',
  answers JSONB NOT NULL,
  recommended_restaurant JSONB,
  satisfied BOOLEAN,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 第三階段：創建索引以提升性能
-- ==========================================

CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_created_at ON user_profiles(created_at);

CREATE INDEX idx_favorite_lists_user_id ON user_favorite_lists(user_id);
CREATE INDEX idx_favorite_lists_created_at ON user_favorite_lists(created_at);

CREATE INDEX idx_list_places_list_id ON favorite_list_places(list_id);
CREATE INDEX idx_list_places_place_id ON favorite_list_places(place_id);

CREATE INDEX idx_swifttaste_history_user_id ON swifttaste_history(user_id);
CREATE INDEX idx_swifttaste_history_session_type ON swifttaste_history(session_type);
CREATE INDEX idx_swifttaste_history_created_at ON swifttaste_history(created_at);

-- ==========================================
-- 第四階段：創建觸發器函數
-- ==========================================

-- 函數1：自動創建用戶檔案
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, name, bio, avatar_url)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'bio', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error creating user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW; -- 即使失敗也要讓用戶註冊成功
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函數2：同步用戶資料更新
CREATE OR REPLACE FUNCTION sync_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles 
  SET 
    email = NEW.email,
    name = COALESCE(NEW.raw_user_meta_data->>'name', name),
    bio = COALESCE(NEW.raw_user_meta_data->>'bio', bio),
    avatar_url = COALESCE(NEW.raw_user_meta_data->>'avatar_url', avatar_url),
    updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error syncing user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 函數3：更新收藏清單地點數量
CREATE OR REPLACE FUNCTION update_list_places_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE user_favorite_lists 
    SET places_count = places_count + 1,
        updated_at = NOW()
    WHERE id = NEW.list_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE user_favorite_lists 
    SET places_count = GREATEST(places_count - 1, 0),
        updated_at = NOW()
    WHERE id = OLD.list_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 函數4：更新用戶統計數據
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF TG_TABLE_NAME = 'user_favorite_lists' THEN
      UPDATE user_profiles 
      SET favorite_lists_count = favorite_lists_count + 1,
          updated_at = NOW()
      WHERE id = NEW.user_id;
    ELSIF TG_TABLE_NAME = 'swifttaste_history' THEN
      UPDATE user_profiles 
      SET swifttaste_count = swifttaste_count + 1,
          buddies_count = CASE 
            WHEN NEW.session_type = 'buddies' THEN buddies_count + 1
            ELSE buddies_count
          END,
          updated_at = NOW()
      WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'user_favorite_lists' THEN
      UPDATE user_profiles 
      SET favorite_lists_count = GREATEST(favorite_lists_count - 1, 0),
          updated_at = NOW()
      WHERE id = OLD.user_id;
    ELSIF TG_TABLE_NAME = 'swifttaste_history' THEN
      UPDATE user_profiles 
      SET swifttaste_count = GREATEST(swifttaste_count - 1, 0),
          buddies_count = CASE 
            WHEN OLD.session_type = 'buddies' THEN GREATEST(buddies_count - 1, 0)
            ELSE buddies_count
          END,
          updated_at = NOW()
      WHERE id = OLD.user_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 第五階段：創建觸發器
-- ==========================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile();

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_user_profile();

CREATE TRIGGER trigger_update_places_count
  AFTER INSERT OR DELETE ON favorite_list_places
  FOR EACH ROW EXECUTE FUNCTION update_list_places_count();

CREATE TRIGGER trigger_update_user_lists_stats
  AFTER INSERT OR DELETE ON user_favorite_lists
  FOR EACH ROW EXECUTE FUNCTION update_user_stats();

CREATE TRIGGER trigger_update_user_history_stats
  AFTER INSERT OR DELETE ON swifttaste_history
  FOR EACH ROW EXECUTE FUNCTION update_user_stats();

-- ==========================================
-- 第六階段：啟用 Row Level Security (RLS)
-- ==========================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorite_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_list_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE swifttaste_history ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 第七階段：創建 RLS 政策
-- ==========================================

-- 用戶檔案政策
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "System can insert profiles" ON user_profiles
  FOR INSERT WITH CHECK (true);

-- 收藏清單政策
CREATE POLICY "Users can manage own favorite lists" ON user_favorite_lists
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view public lists" ON user_favorite_lists
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);

-- 清單地點政策
CREATE POLICY "Users can manage own list places" ON favorite_list_places
  FOR ALL USING (
    list_id IN (
      SELECT id FROM user_favorite_lists 
      WHERE user_id = auth.uid()
    )
  );

-- SwiftTaste 歷史政策
CREATE POLICY "Users can manage own history" ON swifttaste_history
  FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- 第八階段：驗證安裝
-- ==========================================

-- 檢查所有表是否創建成功
SELECT 
  'Verification' as step,
  'Tables created' as status,
  count(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN ('user_profiles', 'user_favorite_lists', 'favorite_list_places', 'swifttaste_history');

-- 檢查所有觸發器是否創建成功
SELECT 
  'Verification' as step,
  'Triggers created' as status,
  count(*) as count
FROM information_schema.triggers 
WHERE trigger_name IN ('on_auth_user_created', 'on_auth_user_updated', 'trigger_update_places_count', 'trigger_update_user_lists_stats', 'trigger_update_user_history_stats');

-- 檢查所有函數是否創建成功
SELECT 
  'Verification' as step,
  'Functions created' as status,
  count(*) as count
FROM information_schema.routines 
WHERE routine_name IN ('create_user_profile', 'sync_user_profile', 'update_list_places_count', 'update_user_stats');

-- 檢查所有 RLS 政策是否創建成功
SELECT 
  'Verification' as step,
  'RLS policies created' as status,
  count(*) as count
FROM pg_policies 
WHERE tablename IN ('user_profiles', 'user_favorite_lists', 'favorite_list_places', 'swifttaste_history');

-- ==========================================
-- 重建完成！🎉
-- ==========================================

-- 接下來請：
-- 1. 在 Supabase Storage 中創建 'avatars' bucket
-- 2. 測試用戶註冊功能
-- 3. 將應用程式切換回正常的數據庫服務