-- 優化後的 SwiftTaste 選擇紀錄資料庫 Schema
-- 避免與現有 Buddies 表格功能重複

-- 1. 用戶選擇紀錄主表（優化版）
-- 專注於個人選擇歷史，避免與 Buddies 系統重複
CREATE TABLE IF NOT EXISTS user_selection_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL, -- 用於匿名用戶的會話標識

    -- 選擇模式和來源
    mode TEXT NOT NULL CHECK (mode IN ('swifttaste', 'buddies')),
    source_type TEXT DEFAULT 'direct' CHECK (source_type IN ('direct', 'buddies_room')),

    -- 時間記錄
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    session_duration INTEGER, -- 秒數

    -- SwiftTaste 專用資料（直接模式）
    basic_answers JSONB DEFAULT '[]'::jsonb,
    fun_answers JSONB DEFAULT '[]'::jsonb,
    recommended_restaurants JSONB DEFAULT '[]'::jsonb,
    final_restaurant JSONB,

    -- 用戶互動數據（僅針對個人體驗）
    swipe_count INTEGER DEFAULT 0,
    liked_restaurants JSONB DEFAULT '[]'::jsonb,

    -- Buddies 關聯（僅參考，不重複儲存詳細資料）
    buddies_room_id TEXT, -- 關聯到 buddies_rooms.id
    buddies_role TEXT CHECK (buddies_role IN ('host', 'member')), -- 在房間中的角色

    -- 地理位置信息
    user_location JSONB, -- {lat, lng, address}

    -- 用戶體驗評價（新增）
    user_satisfaction INTEGER CHECK (user_satisfaction BETWEEN 1 AND 5),
    feedback_notes TEXT,

    -- 元數據
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 建立視圖整合 Buddies 和個人資料
CREATE OR REPLACE VIEW user_complete_history AS
SELECT
    ush.id,
    ush.user_id,
    ush.session_id,
    ush.mode,
    ush.started_at,
    ush.completed_at,
    ush.session_duration,

    -- 個人資料
    ush.basic_answers as personal_basic_answers,
    ush.fun_answers as personal_fun_answers,
    ush.recommended_restaurants as personal_recommendations,
    ush.final_restaurant as personal_final_choice,
    ush.swipe_count,
    ush.liked_restaurants,

    -- Buddies 資料（如果存在）
    ush.buddies_room_id,
    ush.buddies_role,
    br.host_name as buddies_host_name,
    br.status as buddies_room_status,

    -- 從 buddies_answers 獲取答案（如果是 Buddies 模式）
    CASE
        WHEN ush.mode = 'buddies' THEN
            (SELECT jsonb_agg(ba.answers)
             FROM buddies_answers ba
             WHERE ba.room_id = ush.buddies_room_id
             AND ba.user_id = ush.session_id)
        ELSE ush.basic_answers
    END as effective_answers,

    -- 從 buddies_recommendations 獲取推薦（如果是 Buddies 模式）
    CASE
        WHEN ush.mode = 'buddies' THEN
            (SELECT jsonb_agg(br_rec.restaurants)
             FROM buddies_recommendations br_rec
             WHERE br_rec.room_id = ush.buddies_room_id)
        ELSE ush.recommended_restaurants
    END as effective_recommendations,

    ush.user_location,
    ush.user_satisfaction,
    ush.feedback_notes,
    ush.created_at,
    ush.updated_at

FROM user_selection_history ush
LEFT JOIN buddies_rooms br ON ush.buddies_room_id = br.id;

-- 3. 索引優化（避免重複）
CREATE INDEX IF NOT EXISTS idx_user_selection_history_user_id ON user_selection_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_selection_history_session_id ON user_selection_history(session_id);
CREATE INDEX IF NOT EXISTS idx_user_selection_history_mode ON user_selection_history(mode);
CREATE INDEX IF NOT EXISTS idx_user_selection_history_started_at ON user_selection_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_selection_history_buddies_room ON user_selection_history(buddies_room_id)
    WHERE buddies_room_id IS NOT NULL;

-- 4. 觸發器（與之前相同）
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

-- 5. Row Level Security 政策（與之前相同）
ALTER TABLE user_selection_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own selection history" ON user_selection_history;
CREATE POLICY "Users can view their own selection history"
    ON user_selection_history FOR SELECT
    USING (
        (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
        (auth.uid() IS NULL AND session_id IS NOT NULL)
    );

DROP POLICY IF EXISTS "Users can insert their own selection history" ON user_selection_history;
CREATE POLICY "Users can insert their own selection history"
    ON user_selection_history FOR INSERT
    WITH CHECK (
        (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
        (auth.uid() IS NULL AND session_id IS NOT NULL)
    );

DROP POLICY IF EXISTS "Users can update their own selection history" ON user_selection_history;
CREATE POLICY "Users can update their own selection history"
    ON user_selection_history FOR UPDATE
    USING (
        (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
        (auth.uid() IS NULL AND session_id IS NOT NULL)
    );

DROP POLICY IF EXISTS "Users can delete their own selection history" ON user_selection_history;
CREATE POLICY "Users can delete their own selection history"
    ON user_selection_history FOR DELETE
    USING (
        (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
        (auth.uid() IS NULL AND session_id IS NOT NULL)
    );

-- 6. 優化後的統計視圖
CREATE OR REPLACE VIEW user_selection_stats AS
SELECT
    COALESCE(user_id::text, session_id) as user_identifier,
    user_id,
    session_id,
    mode,
    COUNT(*) as total_sessions,
    AVG(session_duration) as avg_duration,
    COUNT(*) FILTER (WHERE completed_at IS NOT NULL) as completed_sessions,
    COUNT(*) FILTER (WHERE mode = 'swifttaste') as swifttaste_sessions,
    COUNT(*) FILTER (WHERE mode = 'buddies') as buddies_sessions,
    MAX(started_at) as last_session,
    SUM(swipe_count) as total_swipes,
    AVG(user_satisfaction) FILTER (WHERE user_satisfaction IS NOT NULL) as avg_satisfaction,

    -- Buddies 特定統計
    COUNT(DISTINCT buddies_room_id) FILTER (WHERE buddies_room_id IS NOT NULL) as unique_buddies_rooms,
    COUNT(*) FILTER (WHERE buddies_role = 'host') as times_as_host,
    COUNT(*) FILTER (WHERE buddies_role = 'member') as times_as_member

FROM user_selection_history
GROUP BY COALESCE(user_id::text, session_id), user_id, session_id, mode;

-- 7. 清理函數（保留）
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

-- 8. 新增：關聯現有 Buddies 資料的函數
CREATE OR REPLACE FUNCTION sync_buddies_to_history()
RETURNS INTEGER AS $$
DECLARE
    synced_count INTEGER := 0;
    room_record RECORD;
    member_record RECORD;
BEGIN
    -- 為每個 Buddies 房間的每個成員創建歷史記錄
    FOR room_record IN
        SELECT * FROM buddies_rooms
        WHERE created_at > NOW() - INTERVAL '1 month' -- 只同步最近一個月的資料
    LOOP
        FOR member_record IN
            SELECT * FROM buddies_members
            WHERE room_id = room_record.id
        LOOP
            -- 檢查是否已存在記錄
            IF NOT EXISTS (
                SELECT 1 FROM user_selection_history
                WHERE buddies_room_id = room_record.id
                AND session_id = member_record.user_id
            ) THEN
                INSERT INTO user_selection_history (
                    session_id,
                    mode,
                    source_type,
                    started_at,
                    completed_at,
                    buddies_room_id,
                    buddies_role
                ) VALUES (
                    member_record.user_id,
                    'buddies',
                    'buddies_room',
                    room_record.created_at,
                    CASE WHEN room_record.status = 'completed' THEN room_record.last_updated END,
                    room_record.id,
                    CASE WHEN member_record.is_host THEN 'host' ELSE 'member' END
                );

                synced_count := synced_count + 1;
            END IF;
        END LOOP;
    END LOOP;

    RETURN synced_count;
END;
$$ LANGUAGE plpgsql;

-- 註釋
COMMENT ON TABLE user_selection_history IS '用戶選擇歷史表 - 避免與現有 Buddies 系統重複，專注於個人體驗記錄';
COMMENT ON COLUMN user_selection_history.source_type IS '來源類型：direct=直接使用，buddies_room=來自Buddies房間';
COMMENT ON COLUMN user_selection_history.buddies_room_id IS '關聯的 Buddies 房間ID，不重複儲存房間詳細資料';
COMMENT ON COLUMN user_selection_history.buddies_role IS '在 Buddies 房間中的角色';
COMMENT ON VIEW user_complete_history IS '整合個人和 Buddies 資料的完整視圖';
COMMENT ON FUNCTION sync_buddies_to_history IS '同步現有 Buddies 資料到歷史記錄的工具函數';

-- 使用範例
/*
-- 查詢用戶完整歷史（包含 Buddies 資料）
SELECT * FROM user_complete_history
WHERE user_id = 'user-uuid'
ORDER BY started_at DESC;

-- 查詢用戶統計
SELECT * FROM user_selection_stats
WHERE user_id = 'user-uuid';

-- 同步現有 Buddies 資料到歷史記錄
SELECT sync_buddies_to_history();

-- 查詢特定房間的所有參與者歷史
SELECT * FROM user_selection_history
WHERE buddies_room_id = 'ROOM123';
*/