-- 创建 buddies_answers 表结构
-- 用于存储 Buddies 模式中用户的答案

CREATE TABLE IF NOT EXISTS buddies_answers (
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

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_buddies_answers_room_id ON buddies_answers(room_id);
CREATE INDEX IF NOT EXISTS idx_buddies_answers_user_id ON buddies_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_buddies_answers_submitted_at ON buddies_answers(submitted_at);

-- 创建更新时间戳的触发器
CREATE OR REPLACE FUNCTION update_buddies_answers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_buddies_answers_updated_at ON buddies_answers;
CREATE TRIGGER trigger_update_buddies_answers_updated_at
    BEFORE UPDATE ON buddies_answers
    FOR EACH ROW EXECUTE FUNCTION update_buddies_answers_updated_at();

-- 启用 RLS (Row Level Security)
ALTER TABLE buddies_answers ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略 - 允许所有操作 (在开发阶段)
DROP POLICY IF EXISTS "Allow all buddies_answers operations" ON buddies_answers;
CREATE POLICY "Allow all buddies_answers operations"
    ON buddies_answers
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 确保 Realtime 启用
ALTER PUBLICATION supabase_realtime ADD TABLE buddies_answers;

COMMENT ON TABLE buddies_answers IS 'Buddies模式用户答案存储表';
COMMENT ON COLUMN buddies_answers.room_id IS '房间ID';
COMMENT ON COLUMN buddies_answers.user_id IS '用户ID';
COMMENT ON COLUMN buddies_answers.answers IS '用户答案数组 (JSON格式)';
COMMENT ON COLUMN buddies_answers.question_texts IS '问题文本数组 (JSON格式)';
COMMENT ON COLUMN buddies_answers.question_sources IS '问题来源数组 (JSON格式)';
COMMENT ON COLUMN buddies_answers.submitted_at IS '首次提交时间';
COMMENT ON COLUMN buddies_answers.updated_at IS '最后更新时间';