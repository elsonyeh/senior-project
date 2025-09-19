-- SwiftTaste 選擇紀錄資料庫 Schema
-- 此腳本建立儲存用戶選擇紀錄的資料表

-- 1. 用戶選擇紀錄主表
-- 儲存每次 SwiftTaste 或 Buddies 的完整選擇過程
CREATE TABLE IF NOT EXISTS user_selection_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL, -- 用於匿名用戶的會話標識

    -- 選擇模式
    mode TEXT NOT NULL CHECK (mode IN ('swifttaste', 'buddies')),

    -- 時間記錄
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    session_duration INTEGER, -- 秒數

    -- 基本選擇答案
    basic_answers JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- 趣味問題答案（SwiftTaste） 或 個人化問題答案（Buddies）
    fun_answers JSONB DEFAULT '[]'::jsonb,

    -- 推薦結果
    recommended_restaurants JSONB DEFAULT '[]'::jsonb,

    -- 最終選擇的餐廳
    final_restaurant JSONB,

    -- 用戶互動數據
    swipe_count INTEGER DEFAULT 0,
    liked_restaurants JSONB DEFAULT '[]'::jsonb,

    -- Buddies 特有數據
    room_id TEXT, -- Buddies 房間ID

    -- 地理位置信息
    user_location JSONB, -- {lat, lng, address}

    -- 元數據
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 索引優化
CREATE INDEX IF NOT EXISTS idx_user_selection_history_user_id ON user_selection_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_selection_history_session_id ON user_selection_history(session_id);
CREATE INDEX IF NOT EXISTS idx_user_selection_history_mode ON user_selection_history(mode);
CREATE INDEX IF NOT EXISTS idx_user_selection_history_started_at ON user_selection_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_selection_history_room_id ON user_selection_history(room_id) WHERE room_id IS NOT NULL;

-- 3. 自動更新 updated_at 觸發器
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

-- 4. Row Level Security (RLS) 政策
ALTER TABLE user_selection_history ENABLE ROW LEVEL SECURITY;

-- 允許用戶查看自己的紀錄
DROP POLICY IF EXISTS "Users can view their own selection history" ON user_selection_history;
CREATE POLICY "Users can view their own selection history"
    ON user_selection_history FOR SELECT
    USING (
        (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
        (auth.uid() IS NULL AND session_id IS NOT NULL)
    );

-- 允許用戶插入自己的紀錄
DROP POLICY IF EXISTS "Users can insert their own selection history" ON user_selection_history;
CREATE POLICY "Users can insert their own selection history"
    ON user_selection_history FOR INSERT
    WITH CHECK (
        (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
        (auth.uid() IS NULL AND session_id IS NOT NULL)
    );

-- 允許用戶更新自己的紀錄
DROP POLICY IF EXISTS "Users can update their own selection history" ON user_selection_history;
CREATE POLICY "Users can update their own selection history"
    ON user_selection_history FOR UPDATE
    USING (
        (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
        (auth.uid() IS NULL AND session_id IS NOT NULL)
    );

-- 允許用戶刪除自己的紀錄
DROP POLICY IF EXISTS "Users can delete their own selection history" ON user_selection_history;
CREATE POLICY "Users can delete their own selection history"
    ON user_selection_history FOR DELETE
    USING (
        (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
        (auth.uid() IS NULL AND session_id IS NOT NULL)
    );

-- 5. 創建視圖方便查詢
CREATE OR REPLACE VIEW user_selection_summary AS
SELECT
    user_id,
    session_id,
    mode,
    COUNT(*) as total_sessions,
    AVG(session_duration) as avg_duration,
    COUNT(*) FILTER (WHERE final_restaurant IS NOT NULL) as completed_sessions,
    MAX(started_at) as last_session,
    SUM(swipe_count) as total_swipes
FROM user_selection_history
GROUP BY user_id, session_id, mode;

-- 6. 創建函數：清理舊紀錄（可選，保留最近6個月的紀錄）
CREATE OR REPLACE FUNCTION cleanup_old_selection_history()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_selection_history
    WHERE created_at < NOW() - INTERVAL '6 months';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 註釋和使用說明
COMMENT ON TABLE user_selection_history IS '用戶選擇紀錄主表，記錄 SwiftTaste 和 Buddies 模式的完整選擇過程';
COMMENT ON COLUMN user_selection_history.user_id IS '已登入用戶的 UUID，未登入用戶為 NULL';
COMMENT ON COLUMN user_selection_history.session_id IS '會話標識，用於追蹤匿名用戶的選擇紀錄';
COMMENT ON COLUMN user_selection_history.mode IS '選擇模式：swifttaste 或 buddies';
COMMENT ON COLUMN user_selection_history.basic_answers IS '基本問題答案陣列，格式: ["answer1", "answer2", ...]';
COMMENT ON COLUMN user_selection_history.fun_answers IS '趣味問題答案陣列，格式同上';
COMMENT ON COLUMN user_selection_history.recommended_restaurants IS '推薦餐廳列表，包含餐廳完整資訊';
COMMENT ON COLUMN user_selection_history.final_restaurant IS '最終選擇的餐廳資訊';
COMMENT ON COLUMN user_selection_history.liked_restaurants IS '用戶喜歡的餐廳列表';
COMMENT ON COLUMN user_selection_history.room_id IS 'Buddies 模式的房間 ID';
COMMENT ON COLUMN user_selection_history.user_location IS '用戶位置資訊 {lat, lng, address}';

-- 示例查詢
/*
-- 查詢某用戶的選擇紀錄
SELECT * FROM user_selection_history
WHERE user_id = 'user-uuid'
ORDER BY started_at DESC;

-- 查詢某會話的選擇紀錄（匿名用戶）
SELECT * FROM user_selection_history
WHERE session_id = 'session-id'
ORDER BY started_at DESC;

-- 查詢用戶統計
SELECT * FROM user_selection_summary
WHERE user_id = 'user-uuid';

-- 清理6個月前的舊紀錄
SELECT cleanup_old_selection_history();
*/