-- Questions Schema for SwiftTaste Application
-- Supports both SwiftTaste mode and Buddies mode questions

-- 1. Question Types Table
CREATE TABLE IF NOT EXISTS question_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE, -- 'basic', 'fun', 'custom'
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Questions Table
CREATE TABLE IF NOT EXISTS questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_type_id UUID REFERENCES question_types(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  display_order INTEGER DEFAULT 0, -- Order to display questions
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('swifttaste', 'buddies', 'both')), -- Which mode uses this question
  is_active BOOLEAN DEFAULT true,
  depends_on_question_id UUID REFERENCES questions(id), -- For conditional questions
  depends_on_answer VARCHAR(255), -- Required answer for dependent question
  metadata JSONB, -- Additional data like tags, difficulty, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Question Options Table
CREATE TABLE IF NOT EXISTS question_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  option_text VARCHAR(500) NOT NULL,
  option_value VARCHAR(255), -- Value to store when selected (if different from text)
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB, -- Additional option data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_questions_mode ON questions(mode);
CREATE INDEX IF NOT EXISTS idx_questions_active ON questions(is_active);
CREATE INDEX IF NOT EXISTS idx_questions_depends_on ON questions(depends_on_question_id);
CREATE INDEX IF NOT EXISTS idx_question_options_question ON question_options(question_id);
CREATE INDEX IF NOT EXISTS idx_questions_display_order ON questions(display_order);

-- Insert default question types
INSERT INTO question_types (name, description) VALUES
('basic', 'Basic preference questions for restaurant selection'),
('fun', 'Fun personality questions for buddy matching'),
('custom', 'Custom questions created by users or admins')
ON CONFLICT (name) DO NOTHING;

-- Insert basic questions for SwiftTaste mode
INSERT INTO questions (question_type_id, question_text, display_order, mode) VALUES
((SELECT id FROM question_types WHERE name = 'basic'), '今天是一個人還是有朋友？', 1, 'swifttaste'),
((SELECT id FROM question_types WHERE name = 'basic'), '想吃奢華點還是平價？', 2, 'both'),
((SELECT id FROM question_types WHERE name = 'basic'), '想吃正餐還是想喝飲料？', 3, 'both'),
((SELECT id FROM question_types WHERE name = 'basic'), '吃一點還是吃飽？', 4, 'both'),
((SELECT id FROM question_types WHERE name = 'basic'), '想吃辣的還是不辣？', 5, 'both')
ON CONFLICT DO NOTHING;

-- Set up dependencies for conditional questions
UPDATE questions 
SET depends_on_question_id = (
  SELECT id FROM questions 
  WHERE question_text = '想吃正餐還是想喝飲料？'
), depends_on_answer = '吃'
WHERE question_text IN ('吃一點還是吃飽？', '想吃辣的還是不辣？');

-- Insert options for basic questions
INSERT INTO question_options (question_id, option_text, display_order) VALUES
-- 今天是一個人還是有朋友？
((SELECT id FROM questions WHERE question_text = '今天是一個人還是有朋友？'), '單人', 1),
((SELECT id FROM questions WHERE question_text = '今天是一個人還是有朋友？'), '多人', 2),

-- 想吃奢華點還是平價？
((SELECT id FROM questions WHERE question_text = '想吃奢華點還是平價？'), '奢華美食', 1),
((SELECT id FROM questions WHERE question_text = '想吃奢華點還是平價？'), '平價美食', 2),

-- 想吃正餐還是想喝飲料？
((SELECT id FROM questions WHERE question_text = '想吃正餐還是想喝飲料？'), '吃', 1),
((SELECT id FROM questions WHERE question_text = '想吃正餐還是想喝飲料？'), '喝', 2),

-- 吃一點還是吃飽？
((SELECT id FROM questions WHERE question_text = '吃一點還是吃飽？'), '吃一點', 1),
((SELECT id FROM questions WHERE question_text = '吃一點還是吃飽？'), '吃飽', 2),

-- 想吃辣的還是不辣？
((SELECT id FROM questions WHERE question_text = '想吃辣的還是不辣？'), '辣', 1),
((SELECT id FROM questions WHERE question_text = '想吃辣的還是不辣？'), '不辣', 2)
ON CONFLICT DO NOTHING;

-- Insert fun questions for Buddies mode
INSERT INTO questions (question_type_id, question_text, display_order, mode) VALUES
((SELECT id FROM question_types WHERE name = 'fun'), '側背包 v.s. 後背包', 1, 'buddies'),
((SELECT id FROM question_types WHERE name = 'fun'), '夏天沒有冷氣 v.s. 冬天只能穿短袖', 2, 'buddies'),
((SELECT id FROM question_types WHERE name = 'fun'), '愛吃的東西都只能嘗一口 v.s. 只能吃不想吃的東西', 3, 'buddies'),
((SELECT id FROM question_types WHERE name = 'fun'), '一個人在無人島生活 v.s. 24小時跟一群人待在一起', 4, 'buddies'),
((SELECT id FROM question_types WHERE name = 'fun'), '黑巧克力 v.s. 白巧克力', 5, 'buddies'),
((SELECT id FROM question_types WHERE name = 'fun'), '一生只能喝熱水 v.s. 一生只能喝冰水', 6, 'buddies'),
((SELECT id FROM question_types WHERE name = 'fun'), '如果可以獲得超能力，我想......', 7, 'buddies'),
((SELECT id FROM question_types WHERE name = 'fun'), '消除蚊子 v.s. 消除蟑螂', 8, 'buddies'),
((SELECT id FROM question_types WHERE name = 'fun'), '回到過去 v.s. 去未來', 9, 'buddies'),
((SELECT id FROM question_types WHERE name = 'fun'), '你會想生活在亞洲還是歐洲', 10, 'buddies'),
((SELECT id FROM question_types WHERE name = 'fun'), '一輩子只能吃飯或麵', 11, 'buddies'),
((SELECT id FROM question_types WHERE name = 'fun'), '刺激冒險 v.s. 平凡', 12, 'buddies'),
((SELECT id FROM question_types WHERE name = 'fun'), '你是Ｉ人還是Ｅ人', 13, 'buddies'),
((SELECT id FROM question_types WHERE name = 'fun'), '貓派v.s.狗派', 14, 'buddies'),
((SELECT id FROM question_types WHERE name = 'fun'), '高腳杯v.s.低腳杯', 15, 'buddies'),
((SELECT id FROM question_types WHERE name = 'fun'), '你覺得可能會有一見鍾情嗎？', 16, 'buddies'),
((SELECT id FROM question_types WHERE name = 'fun'), '擁有永久的一字眉v.s.完全沒有眉毛', 17, 'buddies')
ON CONFLICT DO NOTHING;

-- Insert options for fun questions
INSERT INTO question_options (question_id, option_text, display_order) VALUES
-- 側背包 v.s. 後背包
((SELECT id FROM questions WHERE question_text = '側背包 v.s. 後背包'), '側背包', 1),
((SELECT id FROM questions WHERE question_text = '側背包 v.s. 後背包'), '後背包', 2),

-- 夏天沒有冷氣 v.s. 冬天只能穿短袖
((SELECT id FROM questions WHERE question_text = '夏天沒有冷氣 v.s. 冬天只能穿短袖'), '夏天沒有冷氣', 1),
((SELECT id FROM questions WHERE question_text = '夏天沒有冷氣 v.s. 冬天只能穿短袖'), '冬天只能穿短袖', 2),

-- 愛吃的東西都只能嘗一口 v.s. 只能吃不想吃的東西
((SELECT id FROM questions WHERE question_text = '愛吃的東西都只能嘗一口 v.s. 只能吃不想吃的東西'), '愛吃的東西都只能嘗一口', 1),
((SELECT id FROM questions WHERE question_text = '愛吃的東西都只能嘗一口 v.s. 只能吃不想吃的東西'), '只能吃不想吃的東西', 2),

-- 一個人在無人島生活 v.s. 24小時跟一群人待在一起
((SELECT id FROM questions WHERE question_text = '一個人在無人島生活 v.s. 24小時跟一群人待在一起'), '一個人在無人島生活', 1),
((SELECT id FROM questions WHERE question_text = '一個人在無人島生活 v.s. 24小時跟一群人待在一起'), '24小時跟一群人待在一起', 2),

-- 黑巧克力 v.s. 白巧克力
((SELECT id FROM questions WHERE question_text = '黑巧克力 v.s. 白巧克力'), '黑巧克力', 1),
((SELECT id FROM questions WHERE question_text = '黑巧克力 v.s. 白巧克力'), '白巧克力', 2),

-- 一生只能喝熱水 v.s. 一生只能喝冰水
((SELECT id FROM questions WHERE question_text = '一生只能喝熱水 v.s. 一生只能喝冰水'), '一生只能喝熱水', 1),
((SELECT id FROM questions WHERE question_text = '一生只能喝熱水 v.s. 一生只能喝冰水'), '一生只能喝冰水', 2),

-- 如果可以獲得超能力，我想......
((SELECT id FROM questions WHERE question_text = '如果可以獲得超能力，我想......'), '會飛', 1),
((SELECT id FROM questions WHERE question_text = '如果可以獲得超能力，我想......'), '力大無窮', 2),

-- 消除蚊子 v.s. 消除蟑螂
((SELECT id FROM questions WHERE question_text = '消除蚊子 v.s. 消除蟑螂'), '消除蚊子', 1),
((SELECT id FROM questions WHERE question_text = '消除蚊子 v.s. 消除蟑螂'), '消除蟑螂', 2),

-- 回到過去 v.s. 去未來
((SELECT id FROM questions WHERE question_text = '回到過去 v.s. 去未來'), '回到過去', 1),
((SELECT id FROM questions WHERE question_text = '回到過去 v.s. 去未來'), '去未來', 2),

-- 你會想生活在亞洲還是歐洲
((SELECT id FROM questions WHERE question_text = '你會想生活在亞洲還是歐洲'), '亞洲', 1),
((SELECT id FROM questions WHERE question_text = '你會想生活在亞洲還是歐洲'), '歐洲', 2),

-- 一輩子只能吃飯或麵
((SELECT id FROM questions WHERE question_text = '一輩子只能吃飯或麵'), '飯', 1),
((SELECT id FROM questions WHERE question_text = '一輩子只能吃飯或麵'), '麵', 2),

-- 刺激冒險 v.s. 平凡
((SELECT id FROM questions WHERE question_text = '刺激冒險 v.s. 平凡'), '刺激冒險', 1),
((SELECT id FROM questions WHERE question_text = '刺激冒險 v.s. 平凡'), '平凡', 2),

-- 你是Ｉ人還是Ｅ人
((SELECT id FROM questions WHERE question_text = '你是Ｉ人還是Ｅ人'), 'Ｉ人', 1),
((SELECT id FROM questions WHERE question_text = '你是Ｉ人還是Ｅ人'), 'Ｅ人', 2),

-- 貓派v.s.狗派
((SELECT id FROM questions WHERE question_text = '貓派v.s.狗派'), '貓派', 1),
((SELECT id FROM questions WHERE question_text = '貓派v.s.狗派'), '狗派', 2),

-- 高腳杯v.s.低腳杯
((SELECT id FROM questions WHERE question_text = '高腳杯v.s.低腳杯'), '高腳杯', 1),
((SELECT id FROM questions WHERE question_text = '高腳杯v.s.低腳杯'), '低腳杯', 2),

-- 你覺得可能會有一見鍾情嗎？
((SELECT id FROM questions WHERE question_text = '你覺得可能會有一見鍾情嗎？'), '有', 1),
((SELECT id FROM questions WHERE question_text = '你覺得可能會有一見鍾情嗎？'), '沒有', 2),

-- 擁有永久的一字眉v.s.完全沒有眉毛
((SELECT id FROM questions WHERE question_text = '擁有永久的一字眉v.s.完全沒有眉毛'), '一字眉', 1),
((SELECT id FROM questions WHERE question_text = '擁有永久的一字眉v.s.完全沒有眉毛'), '沒有眉毛', 2)
ON CONFLICT DO NOTHING;

-- Create a view for easy querying of questions with their options
CREATE OR REPLACE VIEW questions_with_options AS
SELECT 
    q.id as question_id,
    q.question_text,
    q.mode,
    q.display_order,
    q.depends_on_question_id,
    q.depends_on_answer,
    qt.name as question_type,
    json_agg(
        json_build_object(
            'id', qo.id,
            'text', qo.option_text,
            'value', COALESCE(qo.option_value, qo.option_text),
            'order', qo.display_order
        ) ORDER BY qo.display_order
    ) as options
FROM questions q
JOIN question_types qt ON q.question_type_id = qt.id
LEFT JOIN question_options qo ON q.id = qo.question_id AND qo.is_active = true
WHERE q.is_active = true
GROUP BY q.id, q.question_text, q.mode, q.display_order, q.depends_on_question_id, q.depends_on_answer, qt.name
ORDER BY q.display_order;

-- Enable Row Level Security (optional)
-- ALTER TABLE question_types ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE question_options ENABLE ROW LEVEL SECURITY;

-- Create policies (optional - for admin access only)
-- CREATE POLICY "Questions are viewable by everyone" ON questions FOR SELECT USING (true);
-- CREATE POLICY "Question options are viewable by everyone" ON question_options FOR SELECT USING (true);