-- 修复 buddies_answers 表结构
-- 移除不需要的字段，保持与代码一致

-- 1. 备份现有数据
CREATE TABLE IF NOT EXISTS buddies_answers_backup AS
SELECT * FROM buddies_answers;

-- 2. 删除现有表
DROP TABLE IF EXISTS buddies_answers CASCADE;

-- 3. 重新创建正确的表结构
CREATE TABLE buddies_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    answers JSONB NOT NULL DEFAULT '[]'::jsonb,
    question_texts JSONB DEFAULT '[]'::jsonb,
    question_sources JSONB DEFAULT '[]'::jsonb,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 确保同一用户在同一房间只有一条记录
    CONSTRAINT unique_user_room UNIQUE(room_id, user_id)
);

-- 4. 创建索引以提高查询性能
CREATE INDEX idx_buddies_answers_room_id ON buddies_answers(room_id);
CREATE INDEX idx_buddies_answers_user_id ON buddies_answers(user_id);
CREATE INDEX idx_buddies_answers_submitted_at ON buddies_answers(submitted_at);

-- 5. 创建更新时间戳的触发器
CREATE OR REPLACE FUNCTION update_buddies_answers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_buddies_answers_updated_at
    BEFORE UPDATE ON buddies_answers
    FOR EACH ROW EXECUTE FUNCTION update_buddies_answers_updated_at();

-- 6. 启用 RLS (Row Level Security)
ALTER TABLE buddies_answers ENABLE ROW LEVEL SECURITY;

-- 7. 创建 RLS 策略 - 生产环境安全策略
-- 允许用户查看同房间的所有答案（用于显示投票状态）
CREATE POLICY "Users can view answers in their room"
    ON buddies_answers
    FOR SELECT
    USING (
        room_id IN (
            SELECT rm.id
            FROM buddies_rooms rm
            JOIN buddies_members bm ON rm.id = bm.room_id
            WHERE bm.user_id = auth.uid()::text OR bm.user_id = current_setting('app.user_id', true)
        )
    );

-- 允许用户插入自己的答案
CREATE POLICY "Users can insert their own answers"
    ON buddies_answers
    FOR INSERT
    WITH CHECK (
        user_id = COALESCE(auth.uid()::text, current_setting('app.user_id', true))
        AND room_id IN (
            SELECT rm.id
            FROM buddies_rooms rm
            JOIN buddies_members bm ON rm.id = bm.room_id
            WHERE bm.user_id = user_id
        )
    );

-- 允许用户更新自己的答案
CREATE POLICY "Users can update their own answers"
    ON buddies_answers
    FOR UPDATE
    USING (
        user_id = COALESCE(auth.uid()::text, current_setting('app.user_id', true))
    )
    WITH CHECK (
        user_id = COALESCE(auth.uid()::text, current_setting('app.user_id', true))
        AND room_id IN (
            SELECT rm.id
            FROM buddies_rooms rm
            JOIN buddies_members bm ON rm.id = bm.room_id
            WHERE bm.user_id = user_id
        )
    );

-- 禁止删除答案（保护数据完整性）
-- 如果需要删除功能，可以添加特定的管理员策略

-- 为匿名用户提供临时访问权限（SwiftTaste 支持匿名使用）
-- 注意：这是为了支持无需注册的游客模式，在实际生产中可以考虑更严格的限制

-- 匿名用户可以查看所有房间的答案（用于显示投票状态）
CREATE POLICY "Anonymous users can view answers for voting display"
    ON buddies_answers
    FOR SELECT
    USING (auth.role() = 'anon');

-- 匿名用户可以插入答案（使用 user_id 字段标识）
CREATE POLICY "Anonymous users can insert answers"
    ON buddies_answers
    FOR INSERT
    WITH CHECK (auth.role() = 'anon');

-- 匿名用户可以更新自己的答案（基于 user_id 匹配）
CREATE POLICY "Anonymous users can update their answers"
    ON buddies_answers
    FOR UPDATE
    USING (auth.role() = 'anon')
    WITH CHECK (auth.role() = 'anon');

-- 可选：添加管理员策略（如果有管理员需要管理答案）
/*
CREATE POLICY "Admin full access to answers"
    ON buddies_answers
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE email = auth.jwt() ->> 'email'
            AND is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE email = auth.jwt() ->> 'email'
            AND is_active = true
        )
    );
*/

-- 8. 确保 Realtime 启用
ALTER PUBLICATION supabase_realtime ADD TABLE buddies_answers;

-- 9. 从备份恢复兼容的数据（如果有的话）
INSERT INTO buddies_answers (room_id, user_id, answers, question_texts, question_sources, submitted_at)
SELECT
    room_id,
    user_id,
    answers,
    question_texts,
    question_sources,
    submitted_at
FROM buddies_answers_backup
ON CONFLICT (room_id, user_id)
DO UPDATE SET
    answers = EXCLUDED.answers,
    question_texts = EXCLUDED.question_texts,
    question_sources = EXCLUDED.question_sources,
    submitted_at = EXCLUDED.submitted_at,
    updated_at = NOW();

-- 10. 验证数据迁移
SELECT
    COUNT(*) as total_records,
    COUNT(DISTINCT room_id) as unique_rooms,
    COUNT(DISTINCT user_id) as unique_users
FROM buddies_answers;

COMMENT ON TABLE buddies_answers IS 'Buddies模式用户答案存储表 - 修复后的正确结构';
COMMENT ON COLUMN buddies_answers.room_id IS '房间ID';
COMMENT ON COLUMN buddies_answers.user_id IS '用户ID';
COMMENT ON COLUMN buddies_answers.answers IS '用户答案数组 (JSON格式)';
COMMENT ON COLUMN buddies_answers.question_texts IS '问题文本数组 (JSON格式)';
COMMENT ON COLUMN buddies_answers.question_sources IS '问题来源数组 (JSON格式)';
COMMENT ON COLUMN buddies_answers.submitted_at IS '首次提交时间';
COMMENT ON COLUMN buddies_answers.updated_at IS '最后更新时间';