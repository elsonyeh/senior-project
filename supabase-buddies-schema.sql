-- Supabase Database Schema for TasteBuddies
-- 將Buddies模式的即時功能從Firebase遷移到Supabase

-- 創建房間表
CREATE TABLE IF NOT EXISTS buddies_rooms (
    id TEXT PRIMARY KEY,
    host_id TEXT NOT NULL,
    host_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting', -- waiting, questions, recommend, completed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 創建成員表
CREATE TABLE IF NOT EXISTS buddies_members (
    id BIGSERIAL PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES buddies_rooms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    is_host BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

-- 創建問題集表
CREATE TABLE IF NOT EXISTS buddies_questions (
    id BIGSERIAL PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES buddies_rooms(id) ON DELETE CASCADE,
    questions JSONB NOT NULL, -- 存儲問題數組
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id)
);

-- 創建答案表
CREATE TABLE IF NOT EXISTS buddies_answers (
    id BIGSERIAL PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES buddies_rooms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    answers JSONB NOT NULL, -- 存儲答案數組
    question_texts JSONB, -- 問題文本數組
    question_sources JSONB, -- 問題來源數組 (basic/fun)
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

-- 創建推薦結果表
CREATE TABLE IF NOT EXISTS buddies_recommendations (
    id BIGSERIAL PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES buddies_rooms(id) ON DELETE CASCADE,
    restaurants JSONB NOT NULL, -- 存儲推薦餐廳列表
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id)
);

-- 創建用戶投票記錄表
CREATE TABLE IF NOT EXISTS buddies_votes (
    id BIGSERIAL PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES buddies_rooms(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    restaurant_id TEXT NOT NULL,
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, user_id, restaurant_id)
);

-- 創建餐廳投票統計表
CREATE TABLE IF NOT EXISTS buddies_restaurant_votes (
    id BIGSERIAL PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES buddies_rooms(id) ON DELETE CASCADE,
    restaurant_id TEXT NOT NULL,
    vote_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, restaurant_id)
);

-- 創建最終結果表
CREATE TABLE IF NOT EXISTS buddies_final_results (
    id BIGSERIAL PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES buddies_rooms(id) ON DELETE CASCADE,
    restaurant_id TEXT NOT NULL,
    restaurant_name TEXT NOT NULL,
    restaurant_address TEXT,
    restaurant_photo_url TEXT,
    restaurant_rating NUMERIC(3,2),
    restaurant_type TEXT,
    selected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    selected_by TEXT NOT NULL,
    UNIQUE(room_id)
);

-- 創建索引以優化查詢性能
CREATE INDEX IF NOT EXISTS idx_buddies_rooms_status ON buddies_rooms(status);
CREATE INDEX IF NOT EXISTS idx_buddies_rooms_created_at ON buddies_rooms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_buddies_members_room_id ON buddies_members(room_id);
CREATE INDEX IF NOT EXISTS idx_buddies_members_user_id ON buddies_members(user_id);
CREATE INDEX IF NOT EXISTS idx_buddies_questions_room_id ON buddies_questions(room_id);
CREATE INDEX IF NOT EXISTS idx_buddies_answers_room_id ON buddies_answers(room_id);
CREATE INDEX IF NOT EXISTS idx_buddies_answers_user_id ON buddies_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_buddies_recommendations_room_id ON buddies_recommendations(room_id);
CREATE INDEX IF NOT EXISTS idx_buddies_votes_room_id ON buddies_votes(room_id);
CREATE INDEX IF NOT EXISTS idx_buddies_votes_user_id ON buddies_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_buddies_restaurant_votes_room_id ON buddies_restaurant_votes(room_id);
CREATE INDEX IF NOT EXISTS idx_buddies_final_results_room_id ON buddies_final_results(room_id);

-- 啟用 Row Level Security (RLS)
ALTER TABLE buddies_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddies_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddies_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddies_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddies_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddies_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddies_restaurant_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddies_final_results ENABLE ROW LEVEL SECURITY;

-- 創建 RLS 政策 (允許所有操作，因為這是內部應用)
-- 注意：在生產環境中，您可能需要更嚴格的權限控制

-- 房間表政策
CREATE POLICY "Allow all operations on buddies_rooms" ON buddies_rooms
    FOR ALL USING (true) WITH CHECK (true);

-- 成員表政策
CREATE POLICY "Allow all operations on buddies_members" ON buddies_members
    FOR ALL USING (true) WITH CHECK (true);

-- 問題表政策
CREATE POLICY "Allow all operations on buddies_questions" ON buddies_questions
    FOR ALL USING (true) WITH CHECK (true);

-- 答案表政策
CREATE POLICY "Allow all operations on buddies_answers" ON buddies_answers
    FOR ALL USING (true) WITH CHECK (true);

-- 推薦表政策
CREATE POLICY "Allow all operations on buddies_recommendations" ON buddies_recommendations
    FOR ALL USING (true) WITH CHECK (true);

-- 投票記錄表政策
CREATE POLICY "Allow all operations on buddies_votes" ON buddies_votes
    FOR ALL USING (true) WITH CHECK (true);

-- 餐廳投票統計表政策
CREATE POLICY "Allow all operations on buddies_restaurant_votes" ON buddies_restaurant_votes
    FOR ALL USING (true) WITH CHECK (true);

-- 最終結果表政策
CREATE POLICY "Allow all operations on buddies_final_results" ON buddies_final_results
    FOR ALL USING (true) WITH CHECK (true);

-- 創建觸發器以自動更新 last_updated 字段
CREATE OR REPLACE FUNCTION update_last_updated_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_buddies_rooms_last_updated
    BEFORE UPDATE ON buddies_rooms
    FOR EACH ROW
    EXECUTE PROCEDURE update_last_updated_column();

CREATE TRIGGER update_buddies_restaurant_votes_updated_at
    BEFORE UPDATE ON buddies_restaurant_votes
    FOR EACH ROW
    EXECUTE PROCEDURE update_last_updated_column();

-- 添加註釋說明
COMMENT ON TABLE buddies_rooms IS 'TasteBuddies 房間管理表';
COMMENT ON TABLE buddies_members IS 'TasteBuddies 房間成員表';
COMMENT ON TABLE buddies_questions IS 'TasteBuddies 問題集表';
COMMENT ON TABLE buddies_answers IS 'TasteBuddies 用戶答案表';
COMMENT ON TABLE buddies_recommendations IS 'TasteBuddies 推薦結果表';
COMMENT ON TABLE buddies_votes IS 'TasteBuddies 用戶投票記錄表';
COMMENT ON TABLE buddies_restaurant_votes IS 'TasteBuddies 餐廳投票統計表';
COMMENT ON TABLE buddies_final_results IS 'TasteBuddies 最終選擇結果表';

-- 創建清理舊數據的函數（可選）
CREATE OR REPLACE FUNCTION cleanup_old_buddies_rooms()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- 刪除7天前創建且已完成的房間（包括相關數據）
    DELETE FROM buddies_rooms 
    WHERE created_at < NOW() - INTERVAL '7 days' 
    AND status = 'completed';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- 記錄清理操作
    RAISE NOTICE '清理了 % 個舊房間', deleted_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 可以設置定時任務來定期清理舊數據
-- SELECT cron.schedule('cleanup-old-rooms', '0 2 * * *', 'SELECT cleanup_old_buddies_rooms();');