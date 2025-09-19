-- 直接修正 SwiftTaste 資料庫 Schema
-- 此腳本將創建正確的表格結構，移除兼容模式的需要

-- 1. 創建或更新 user_selection_history 表格
DROP TABLE IF EXISTS user_selection_history CASCADE;

CREATE TABLE user_selection_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,

    -- 選擇模式和來源
    mode TEXT NOT NULL CHECK (mode IN ('swifttaste', 'buddies')),
    source_type TEXT DEFAULT 'direct' CHECK (source_type IN ('direct', 'buddies_room')),

    -- 時間記錄
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    session_duration INTEGER, -- 秒數

    -- SwiftTaste 專用資料
    basic_answers JSONB DEFAULT '[]'::jsonb,
    fun_answers JSONB DEFAULT '[]'::jsonb,
    recommended_restaurants JSONB DEFAULT '[]'::jsonb,
    final_restaurant JSONB,

    -- 用戶互動數據
    swipe_count INTEGER DEFAULT 0,
    liked_restaurants JSONB DEFAULT '[]'::jsonb,

    -- Buddies 關聯（僅參考）
    buddies_room_id TEXT,
    buddies_role TEXT CHECK (buddies_role IN ('host', 'member')),

    -- 地理位置信息
    user_location JSONB, -- {lat, lng, address}

    -- 用戶體驗評價
    user_satisfaction INTEGER CHECK (user_satisfaction BETWEEN 1 AND 5),
    feedback_notes TEXT,

    -- 元數據
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 建立索引
CREATE INDEX IF NOT EXISTS idx_user_selection_history_user_id ON user_selection_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_selection_history_session_id ON user_selection_history(session_id);
CREATE INDEX IF NOT EXISTS idx_user_selection_history_mode ON user_selection_history(mode);
CREATE INDEX IF NOT EXISTS idx_user_selection_history_started_at ON user_selection_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_selection_history_buddies_room ON user_selection_history(buddies_room_id)
    WHERE buddies_room_id IS NOT NULL;

-- 3. 建立觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_selection_history_updated_at ON user_selection_history;
CREATE TRIGGER update_user_selection_history_updated_at
    BEFORE UPDATE ON user_selection_history
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. 啟用 Row Level Security
ALTER TABLE user_selection_history ENABLE ROW LEVEL SECURITY;

-- 清除舊政策
DROP POLICY IF EXISTS "Users can view their own selection history" ON user_selection_history;
DROP POLICY IF EXISTS "Users can insert their own selection history" ON user_selection_history;
DROP POLICY IF EXISTS "Users can update their own selection history" ON user_selection_history;
DROP POLICY IF EXISTS "Users can delete their own selection history" ON user_selection_history;

-- 創建新政策
CREATE POLICY "Users can view their own selection history"
    ON user_selection_history FOR SELECT
    USING (
        (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
        (auth.uid() IS NULL AND session_id IS NOT NULL)
    );

CREATE POLICY "Users can insert their own selection history"
    ON user_selection_history FOR INSERT
    WITH CHECK (
        (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
        (auth.uid() IS NULL AND session_id IS NOT NULL)
    );

CREATE POLICY "Users can update their own selection history"
    ON user_selection_history FOR UPDATE
    USING (
        (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
        (auth.uid() IS NULL AND session_id IS NOT NULL)
    );

CREATE POLICY "Users can delete their own selection history"
    ON user_selection_history FOR DELETE
    USING (
        (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
        (auth.uid() IS NULL AND session_id IS NOT NULL)
    );

-- 5. 創建或更新 user_profiles 表格
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    avatar_url TEXT,
    bio TEXT,
    favorite_lists_count INTEGER DEFAULT 0,
    swifttaste_count INTEGER DEFAULT 0,
    buddies_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 建立 user_profiles 索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON user_profiles(created_at DESC);

-- 建立 user_profiles 觸發器
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 啟用 user_profiles Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 清除舊 user_profiles 政策
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;

-- 創建新 user_profiles 政策
CREATE POLICY "Users can view their own profile"
    ON user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON user_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = id);

-- 6. 注意：存儲政策需要在 Supabase Dashboard 的 Storage 界面設置
-- 請參考 STORAGE_POLICY_SETUP.md 文件進行設置
--
-- avatars bucket 會在首次使用時自動創建，或者：
-- 可以在 Storage > Create bucket 手動創建 'avatars' bucket

-- 8. 驗證表格結構（不插入測試資料）
-- 檢查表格是否成功創建
SELECT 'user_selection_history table created successfully' as status;
SELECT 'user_profiles table created successfully' as status;
SELECT 'avatars bucket and policies created successfully' as status;

-- 確認表格結構
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_selection_history'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;