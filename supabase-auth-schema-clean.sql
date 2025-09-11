-- SwiftTaste 用戶認證和資料架構 (清理版本)
-- 此文件安全地創建或更新數據庫架構

-- 1. 用戶資料表 (擴展 Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
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

-- 創建索引（如果不存在）
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_profiles_email') THEN
    CREATE INDEX idx_user_profiles_email ON user_profiles(email);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_profiles_created_at') THEN
    CREATE INDEX idx_user_profiles_created_at ON user_profiles(created_at);
  END IF;
END $$;

-- 2. 用戶收藏清單
CREATE TABLE IF NOT EXISTS user_favorite_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(20) DEFAULT '#ff6b35',
  is_public BOOLEAN DEFAULT false,
  places_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 創建索引（如果不存在）
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_favorite_lists_user_id') THEN
    CREATE INDEX idx_favorite_lists_user_id ON user_favorite_lists(user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_favorite_lists_created_at') THEN
    CREATE INDEX idx_favorite_lists_created_at ON user_favorite_lists(created_at);
  END IF;
END $$;

-- 3. 清單中的地點
CREATE TABLE IF NOT EXISTS favorite_list_places (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID REFERENCES user_favorite_lists(id) ON DELETE CASCADE,
  place_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  rating DECIMAL(2,1),
  photo_url TEXT,
  notes TEXT,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 創建索引（如果不存在）
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_list_places_list_id') THEN
    CREATE INDEX idx_list_places_list_id ON favorite_list_places(list_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_list_places_place_id') THEN
    CREATE INDEX idx_list_places_place_id ON favorite_list_places(place_id);
  END IF;
END $$;

-- 4. SwiftTaste 歷史記錄
CREATE TABLE IF NOT EXISTS swifttaste_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  session_type VARCHAR(50) NOT NULL,
  answers JSONB NOT NULL,
  recommended_restaurant JSONB,
  satisfied BOOLEAN,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 創建索引（如果不存在）
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_swifttaste_history_user_id') THEN
    CREATE INDEX idx_swifttaste_history_user_id ON swifttaste_history(user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_swifttaste_history_session_type') THEN
    CREATE INDEX idx_swifttaste_history_session_type ON swifttaste_history(session_type);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_swifttaste_history_created_at') THEN
    CREATE INDEX idx_swifttaste_history_created_at ON swifttaste_history(created_at);
  END IF;
END $$;

-- 5. 觸發器：自動創建用戶檔案
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
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 創建觸發器（安全地刪除和重建）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE create_user_profile();

-- 6. 觸發器：同步用戶資料更新
CREATE OR REPLACE FUNCTION sync_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles 
  SET 
    name = COALESCE(NEW.raw_user_meta_data->>'name', name),
    bio = COALESCE(NEW.raw_user_meta_data->>'bio', bio),
    avatar_url = COALESCE(NEW.raw_user_meta_data->>'avatar_url', avatar_url),
    updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 創建觸發器（安全地刪除和重建）
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE sync_user_profile();

-- 7. 更新收藏清單數量觸發器
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
    SET places_count = places_count - 1,
        updated_at = NOW()
    WHERE id = OLD.list_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 創建觸發器（安全地刪除和重建）
DROP TRIGGER IF EXISTS trigger_update_places_count ON favorite_list_places;
CREATE TRIGGER trigger_update_places_count
  AFTER INSERT OR DELETE ON favorite_list_places
  FOR EACH ROW EXECUTE PROCEDURE update_list_places_count();

-- 8. 更新用戶統計數據觸發器
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
      SET favorite_lists_count = favorite_lists_count - 1,
          updated_at = NOW()
      WHERE id = OLD.user_id;
    ELSIF TG_TABLE_NAME = 'swifttaste_history' THEN
      UPDATE user_profiles 
      SET swifttaste_count = swifttaste_count - 1,
          buddies_count = CASE 
            WHEN OLD.session_type = 'buddies' THEN buddies_count - 1
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

-- 創建統計觸發器（安全地刪除和重建）
DROP TRIGGER IF EXISTS trigger_update_user_lists_stats ON user_favorite_lists;
CREATE TRIGGER trigger_update_user_lists_stats
  AFTER INSERT OR DELETE ON user_favorite_lists
  FOR EACH ROW EXECUTE PROCEDURE update_user_stats();

DROP TRIGGER IF EXISTS trigger_update_user_history_stats ON swifttaste_history;
CREATE TRIGGER trigger_update_user_history_stats
  AFTER INSERT OR DELETE ON swifttaste_history
  FOR EACH ROW EXECUTE PROCEDURE update_user_stats();

-- 9. 啟用 Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorite_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_list_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE swifttaste_history ENABLE ROW LEVEL SECURITY;

-- 10. RLS 政策（安全地創建）
DO $$ 
BEGIN 
  -- 刪除現有政策並重建
  DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
  CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

  DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
  CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

  DROP POLICY IF EXISTS "Users can manage own favorite lists" ON user_favorite_lists;
  CREATE POLICY "Users can manage own favorite lists" ON user_favorite_lists
    FOR ALL USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can view public lists" ON user_favorite_lists;
  CREATE POLICY "Users can view public lists" ON user_favorite_lists
    FOR SELECT USING (is_public = true OR auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can manage own list places" ON favorite_list_places;
  CREATE POLICY "Users can manage own list places" ON favorite_list_places
    FOR ALL USING (
      list_id IN (
        SELECT id FROM user_favorite_lists 
        WHERE user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "Users can manage own history" ON swifttaste_history;
  CREATE POLICY "Users can manage own history" ON swifttaste_history
    FOR ALL USING (auth.uid() = user_id);
END $$;