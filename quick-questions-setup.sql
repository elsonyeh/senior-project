-- Quick setup for questions tables
-- Execute this in Supabase SQL Editor

-- 1. Create question types table
CREATE TABLE IF NOT EXISTS question_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create questions table
CREATE TABLE IF NOT EXISTS questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_type_id UUID REFERENCES question_types(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('swifttaste', 'buddies', 'both')),
  is_active BOOLEAN DEFAULT true,
  depends_on_question_id UUID REFERENCES questions(id),
  depends_on_answer VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create question options table
CREATE TABLE IF NOT EXISTS question_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  option_text VARCHAR(500) NOT NULL,
  option_value VARCHAR(255),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_questions_mode ON questions(mode);
CREATE INDEX IF NOT EXISTS idx_questions_active ON questions(is_active);
CREATE INDEX IF NOT EXISTS idx_questions_depends_on ON questions(depends_on_question_id);
CREATE INDEX IF NOT EXISTS idx_question_options_question ON question_options(question_id);
CREATE INDEX IF NOT EXISTS idx_questions_display_order ON questions(display_order);

-- 5. Insert question types
INSERT INTO question_types (name, description) VALUES
('basic', 'Basic preference questions for restaurant selection'),
('fun', 'Fun personality questions for buddy matching'),
('custom', 'Custom questions created by users or admins')
ON CONFLICT (name) DO NOTHING;

-- 6. Insert basic questions for SwiftTaste
INSERT INTO questions (question_type_id, question_text, display_order, mode) VALUES
((SELECT id FROM question_types WHERE name = 'basic'), '今天是一個人還是有朋友？', 1, 'swifttaste'),
((SELECT id FROM question_types WHERE name = 'basic'), '想吃奢華點還是平價？', 2, 'both'),
((SELECT id FROM question_types WHERE name = 'basic'), '想吃正餐還是想喝飲料？', 3, 'both'),
((SELECT id FROM question_types WHERE name = 'basic'), '吃一點還是吃飽？', 4, 'both'),
((SELECT id FROM question_types WHERE name = 'basic'), '想吃辣的還是不辣？', 5, 'both')
ON CONFLICT DO NOTHING;

-- 7. Set up dependencies
UPDATE questions 
SET depends_on_question_id = (
  SELECT id FROM questions 
  WHERE question_text = '想吃正餐還是想喝飲料？'
), depends_on_answer = '吃'
WHERE question_text IN ('吃一點還是吃飽？', '想吃辣的還是不辣？');

-- 8. Insert options for basic questions
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

-- 9. Create the view for easy querying
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