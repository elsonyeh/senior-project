-- 建議的問題分類修正方案
-- 添加question_category欄位來區分基本問題和趣味問題

-- 修改questions表結構
ALTER TABLE questions ADD COLUMN question_category VARCHAR(20) DEFAULT 'basic';

-- 更新現有數據分類
-- 基本問題（包含所有選擇項目）
UPDATE questions SET question_category = 'basic' 
WHERE question_text IN (
  '今天是一個人還是有朋友？',
  '想吃奢華點還是平價？', 
  '想吃正餐還是想喝飲料？',
  '吃一點還是吃飽？',
  '想吃辣的還是不辣？'
);

-- 趣味問題
UPDATE questions SET question_category = 'fun' 
WHERE question_text IN (
  '貓派v.s.狗派',
  '側背包 v.s. 後背包',
  '夏天沒有冷氣 v.s. 冬天只能穿短袖',
  '愛吃的東西都只能嘗一口 v.s. 只能吃不想吃的東西',
  '一個人在無人島生活 v.s. 24小時跟一群人待在一起',
  '黑巧克力 v.s. 白巧克力',
  '一生只能喝熱水 v.s. 一生只能喝冰水',
  '會飛 v.s. 力大無窮',
  '消除蚊子 v.s. 消除蟑螂',
  '回到過去 v.s. 去未來',
  '你會想生活在亞洲還是歐洲',
  '一輩子只能吃飯或麵',
  '刺激冒險 v.s. 平凡',
  '你是Ｉ人還是Ｅ人',
  '高腳杯v.s.低腳杯',
  '你覺得可能會有一見鍾情嗎？',
  '擁有永久的一字眉v.s.完全沒有眉毛'
);

-- 創建新的視圖來支持問題分類查詢
CREATE OR REPLACE VIEW questions_by_category AS
SELECT 
  q.*,
  q.question_category,
  array_agg(
    json_build_object(
      'id', qo.id,
      'option_text', qo.option_text,
      'display_order', qo.display_order
    ) ORDER BY qo.display_order
  ) as options
FROM questions q
LEFT JOIN question_options qo ON q.id = qo.question_id
WHERE q.is_active = true
GROUP BY q.id, q.question_text, q.mode, q.display_order, q.question_category, 
         q.depends_on_question_id, q.depends_on_answer
ORDER BY q.display_order;

-- 使用方式：
-- 載入基本問題（SwiftTaste模式 - 包含所有基本問題）
-- SELECT * FROM questions_by_category WHERE question_category = 'basic';

-- 載入基本問題（Buddies模式 - 排除"一個人還是多人"）  
-- SELECT * FROM questions_by_category 
-- WHERE question_category = 'basic' 
-- AND NOT (question_text LIKE '%一個人%' OR question_text LIKE '%朋友%');

-- 載入趣味問題
-- SELECT * FROM questions_by_category WHERE question_category = 'fun';