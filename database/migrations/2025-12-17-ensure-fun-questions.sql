-- ==========================================
-- 確保資料庫中有足夠的趣味問題（至少10題）
-- ==========================================
-- 執行日期：2025-12-17
-- 目的：確保 Buddies 模式有足夠的趣味問題供隨機選擇

-- 檢查 questions 表是否存在
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'questions') THEN
    RAISE EXCEPTION 'questions 表不存在，請先創建該表';
  END IF;
END $$;

-- 插入趣味問題（使用 ON CONFLICT DO NOTHING 避免重複）
-- 假設 question_text 是唯一的

INSERT INTO questions (question_text, mode, display_order, created_at, updated_at)
VALUES
  ('側背包 v.s. 後背包', 'buddies', 100, now(), now()),
  ('夏天沒有冷氣 v.s. 冬天只能穿短袖', 'buddies', 101, now(), now()),
  ('愛吃的東西都只能嘗一口 v.s. 只能吃不想吃的東西', 'buddies', 102, now(), now()),
  ('一個人在無人島生活 v.s. 24小時跟一群人待在一起', 'buddies', 103, now(), now()),
  ('黑巧克力 v.s. 白巧克力', 'buddies', 104, now(), now()),
  ('一生只能喝熱水 v.s. 一生只能喝冰水', 'buddies', 105, now(), now()),
  ('如果可以獲得超能力，我想......', 'buddies', 106, now(), now()),
  ('消除蚊子 v.s. 消除蟑螂', 'buddies', 107, now(), now()),
  ('回到過去 v.s. 去未來', 'buddies', 108, now(), now()),
  ('你會想生活在亞洲還是歐洲', 'buddies', 109, now(), now()),
  ('一輩子只能吃飯或麵', 'buddies', 110, now(), now()),
  ('刺激冒險 v.s. 平凡', 'buddies', 111, now(), now()),
  ('你是Ｉ人還是Ｅ人', 'buddies', 112, now(), now()),
  ('貓派v.s.狗派', 'buddies', 113, now(), now()),
  ('高腳杯v.s.低腳杯', 'buddies', 114, now(), now()),
  ('你覺得可能會有一見鍾情嗎？', 'buddies', 115, now(), now()),
  ('擁有永久的一字眉v.s.完全沒有眉毛', 'buddies', 116, now(), now())
ON CONFLICT (question_text) DO NOTHING;

-- 為每個趣味問題添加選項（假設 question_options 表存在）
DO $$
DECLARE
  q_record RECORD;
  opt_count INTEGER;
BEGIN
  -- 側背包 v.s. 後背包
  SELECT id INTO q_record FROM questions WHERE question_text = '側背包 v.s. 後背包';
  IF FOUND THEN
    SELECT COUNT(*) INTO opt_count FROM question_options WHERE question_id = q_record.id;
    IF opt_count = 0 THEN
      INSERT INTO question_options (question_id, option_text, display_order) VALUES
        (q_record.id, '側背包', 1),
        (q_record.id, '後背包', 2);
    END IF;
  END IF;

  -- 夏天沒有冷氣 v.s. 冬天只能穿短袖
  SELECT id INTO q_record FROM questions WHERE question_text = '夏天沒有冷氣 v.s. 冬天只能穿短袖';
  IF FOUND THEN
    SELECT COUNT(*) INTO opt_count FROM question_options WHERE question_id = q_record.id;
    IF opt_count = 0 THEN
      INSERT INTO question_options (question_id, option_text, display_order) VALUES
        (q_record.id, '夏天沒有冷氣', 1),
        (q_record.id, '冬天只能穿短袖', 2);
    END IF;
  END IF;

  -- 愛吃的東西都只能嘗一口 v.s. 只能吃不想吃的東西
  SELECT id INTO q_record FROM questions WHERE question_text = '愛吃的東西都只能嘗一口 v.s. 只能吃不想吃的東西';
  IF FOUND THEN
    SELECT COUNT(*) INTO opt_count FROM question_options WHERE question_id = q_record.id;
    IF opt_count = 0 THEN
      INSERT INTO question_options (question_id, option_text, display_order) VALUES
        (q_record.id, '愛吃的東西都只能嘗一口', 1),
        (q_record.id, '只能吃不想吃的東西', 2);
    END IF;
  END IF;

  -- 一個人在無人島生活 v.s. 24小時跟一群人待在一起
  SELECT id INTO q_record FROM questions WHERE question_text = '一個人在無人島生活 v.s. 24小時跟一群人待在一起';
  IF FOUND THEN
    SELECT COUNT(*) INTO opt_count FROM question_options WHERE question_id = q_record.id;
    IF opt_count = 0 THEN
      INSERT INTO question_options (question_id, option_text, display_order) VALUES
        (q_record.id, '一個人在無人島生活', 1),
        (q_record.id, '24小時跟一群人待在一起', 2);
    END IF;
  END IF;

  -- 黑巧克力 v.s. 白巧克力
  SELECT id INTO q_record FROM questions WHERE question_text = '黑巧克力 v.s. 白巧克力';
  IF FOUND THEN
    SELECT COUNT(*) INTO opt_count FROM question_options WHERE question_id = q_record.id;
    IF opt_count = 0 THEN
      INSERT INTO question_options (question_id, option_text, display_order) VALUES
        (q_record.id, '黑巧克力', 1),
        (q_record.id, '白巧克力', 2);
    END IF;
  END IF;

  -- 一生只能喝熱水 v.s. 一生只能喝冰水
  SELECT id INTO q_record FROM questions WHERE question_text = '一生只能喝熱水 v.s. 一生只能喝冰水';
  IF FOUND THEN
    SELECT COUNT(*) INTO opt_count FROM question_options WHERE question_id = q_record.id;
    IF opt_count = 0 THEN
      INSERT INTO question_options (question_id, option_text, display_order) VALUES
        (q_record.id, '一生只能喝熱水', 1),
        (q_record.id, '一生只能喝冰水', 2);
    END IF;
  END IF;

  -- 如果可以獲得超能力，我想......
  SELECT id INTO q_record FROM questions WHERE question_text = '如果可以獲得超能力，我想......';
  IF FOUND THEN
    SELECT COUNT(*) INTO opt_count FROM question_options WHERE question_id = q_record.id;
    IF opt_count = 0 THEN
      INSERT INTO question_options (question_id, option_text, display_order) VALUES
        (q_record.id, '會飛', 1),
        (q_record.id, '力大無窮', 2);
    END IF;
  END IF;

  -- 消除蚊子 v.s. 消除蟑螂
  SELECT id INTO q_record FROM questions WHERE question_text = '消除蚊子 v.s. 消除蟑螂';
  IF FOUND THEN
    SELECT COUNT(*) INTO opt_count FROM question_options WHERE question_id = q_record.id;
    IF opt_count = 0 THEN
      INSERT INTO question_options (question_id, option_text, display_order) VALUES
        (q_record.id, '消除蚊子', 1),
        (q_record.id, '消除蟑螂', 2);
    END IF;
  END IF;

  -- 回到過去 v.s. 去未來
  SELECT id INTO q_record FROM questions WHERE question_text = '回到過去 v.s. 去未來';
  IF FOUND THEN
    SELECT COUNT(*) INTO opt_count FROM question_options WHERE question_id = q_record.id;
    IF opt_count = 0 THEN
      INSERT INTO question_options (question_id, option_text, display_order) VALUES
        (q_record.id, '回到過去', 1),
        (q_record.id, '去未來', 2);
    END IF;
  END IF;

  -- 你會想生活在亞洲還是歐洲
  SELECT id INTO q_record FROM questions WHERE question_text = '你會想生活在亞洲還是歐洲';
  IF FOUND THEN
    SELECT COUNT(*) INTO opt_count FROM question_options WHERE question_id = q_record.id;
    IF opt_count = 0 THEN
      INSERT INTO question_options (question_id, option_text, display_order) VALUES
        (q_record.id, '亞洲', 1),
        (q_record.id, '歐洲', 2);
    END IF;
  END IF;

  -- 一輩子只能吃飯或麵
  SELECT id INTO q_record FROM questions WHERE question_text = '一輩子只能吃飯或麵';
  IF FOUND THEN
    SELECT COUNT(*) INTO opt_count FROM question_options WHERE question_id = q_record.id;
    IF opt_count = 0 THEN
      INSERT INTO question_options (question_id, option_text, display_order) VALUES
        (q_record.id, '飯', 1),
        (q_record.id, '麵', 2);
    END IF;
  END IF;

  -- 刺激冒險 v.s. 平凡
  SELECT id INTO q_record FROM questions WHERE question_text = '刺激冒險 v.s. 平凡';
  IF FOUND THEN
    SELECT COUNT(*) INTO opt_count FROM question_options WHERE question_id = q_record.id;
    IF opt_count = 0 THEN
      INSERT INTO question_options (question_id, option_text, display_order) VALUES
        (q_record.id, '刺激冒險', 1),
        (q_record.id, '平凡', 2);
    END IF;
  END IF;

  -- 你是Ｉ人還是Ｅ人
  SELECT id INTO q_record FROM questions WHERE question_text = '你是Ｉ人還是Ｅ人';
  IF FOUND THEN
    SELECT COUNT(*) INTO opt_count FROM question_options WHERE question_id = q_record.id;
    IF opt_count = 0 THEN
      INSERT INTO question_options (question_id, option_text, display_order) VALUES
        (q_record.id, 'Ｉ人', 1),
        (q_record.id, 'Ｅ人', 2);
    END IF;
  END IF;

  -- 貓派v.s.狗派
  SELECT id INTO q_record FROM questions WHERE question_text = '貓派v.s.狗派';
  IF FOUND THEN
    SELECT COUNT(*) INTO opt_count FROM question_options WHERE question_id = q_record.id;
    IF opt_count = 0 THEN
      INSERT INTO question_options (question_id, option_text, display_order) VALUES
        (q_record.id, '貓派', 1),
        (q_record.id, '狗派', 2);
    END IF;
  END IF;

  -- 高腳杯v.s.低腳杯
  SELECT id INTO q_record FROM questions WHERE question_text = '高腳杯v.s.低腳杯';
  IF FOUND THEN
    SELECT COUNT(*) INTO opt_count FROM question_options WHERE question_id = q_record.id;
    IF opt_count = 0 THEN
      INSERT INTO question_options (question_id, option_text, display_order) VALUES
        (q_record.id, '高腳杯', 1),
        (q_record.id, '低腳杯', 2);
    END IF;
  END IF;

  -- 你覺得可能會有一見鍾情嗎？
  SELECT id INTO q_record FROM questions WHERE question_text = '你覺得可能會有一見鍾情嗎？';
  IF FOUND THEN
    SELECT COUNT(*) INTO opt_count FROM question_options WHERE question_id = q_record.id;
    IF opt_count = 0 THEN
      INSERT INTO question_options (question_id, option_text, display_order) VALUES
        (q_record.id, '有', 1),
        (q_record.id, '沒有', 2);
    END IF;
  END IF;

  -- 擁有永久的一字眉v.s.完全沒有眉毛
  SELECT id INTO q_record FROM questions WHERE question_text = '擁有永久的一字眉v.s.完全沒有眉毛';
  IF FOUND THEN
    SELECT COUNT(*) INTO opt_count FROM question_options WHERE question_id = q_record.id;
    IF opt_count = 0 THEN
      INSERT INTO question_options (question_id, option_text, display_order) VALUES
        (q_record.id, '一字眉', 1),
        (q_record.id, '沒有眉毛', 2);
    END IF;
  END IF;
END $$;

-- 驗證結果
SELECT
  '✅ 趣味問題數量: ' || COUNT(*) as status,
  COUNT(*) as fun_question_count
FROM questions
WHERE mode = 'buddies';

SELECT '✅ 趣味問題已確保完整' as status;
