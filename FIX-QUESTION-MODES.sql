-- 修復問題的 mode 設定
--
-- 1. "一個人吃或和朋友吃" 問題應該只屬於 SwiftTaste 模式
-- 2. 所有標記為 'buddies' 的趣味問題改成 'both'

-- 首先查看目前的問題設定
SELECT
    id,
    question_text,
    mode,
    question_type_id,
    is_active
FROM questions
WHERE question_text LIKE '%一個人%'
   OR question_text LIKE '%朋友%'
   OR question_text LIKE '%單人%'
   OR question_text LIKE '%多人%'
ORDER BY question_text;

-- 查看所有 mode = 'buddies' 的問題
SELECT
    id,
    question_text,
    mode,
    question_type_id,
    is_active
FROM questions
WHERE mode = 'buddies'
ORDER BY question_text;

-- 修復 1: 將 "一個人還是朋友" 問題設為 SwiftTaste only
UPDATE questions
SET mode = 'swifttaste'
WHERE question_text LIKE '%一個人%'
   OR question_text LIKE '%朋友%'
   OR question_text LIKE '%單人%'
   OR question_text LIKE '%多人%';

-- 修復 2: 將所有 buddies 模式的趣味問題改為 both
-- (假設基本問題的 question_type_id 不同於趣味問題)
UPDATE questions
SET mode = 'both'
WHERE mode = 'buddies';

-- 驗證修復結果
SELECT
    mode,
    COUNT(*) as question_count,
    STRING_AGG(question_text, '; ') as sample_questions
FROM questions
WHERE is_active = true
GROUP BY mode
ORDER BY mode;