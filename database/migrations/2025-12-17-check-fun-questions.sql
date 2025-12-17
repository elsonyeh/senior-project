-- 檢查趣味問題的數量和內容

-- 1. 檢查所有 buddies 模式的問題
SELECT
  id,
  question_text,
  mode,
  display_order,
  depends_on_question_id
FROM questions
WHERE mode IN ('buddies', 'both')
ORDER BY display_order;

-- 2. 統計趣味問題數量（排除基本問題）
SELECT
  COUNT(*) as total_buddies_questions,
  COUNT(CASE WHEN depends_on_question_id IS NOT NULL THEN 1 END) as dependent_questions,
  COUNT(CASE WHEN depends_on_question_id IS NULL THEN 1 END) as independent_questions
FROM questions
WHERE mode IN ('buddies', 'both');

-- 3. 檢查 questions_with_options 視圖
SELECT
  question_text,
  mode,
  options
FROM questions_with_options
WHERE mode IN ('buddies', 'both')
ORDER BY display_order
LIMIT 20;
