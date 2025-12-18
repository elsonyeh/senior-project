-- 查詢特定房間的答題事件
-- 使用方法: 在 Supabase SQL Editor 中執行，替換 'YOUR_ROOM_ID' 為實際房間 ID

-- 1. 查看所有問題回答事件
SELECT
  user_id,
  event_type,
  event_data->>'question_index' as question_index,
  event_data->>'answer' as answer,
  created_at,
  EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY created_at))) as seconds_since_previous
FROM buddies_events
WHERE room_id = 'YOUR_ROOM_ID'  -- 替換為實際房間 ID，例如 '8TGAC1'
  AND event_type = 'question_answered'
ORDER BY created_at;

-- 2. 統計每個問題的回答次數
SELECT
  event_data->>'question_index' as question_index,
  COUNT(*) as answer_count,
  COUNT(DISTINCT user_id) as unique_users,
  array_agg(DISTINCT event_data->>'answer') as answers,
  array_agg(user_id) as user_ids,
  MIN(created_at) as first_answer_time,
  MAX(created_at) as last_answer_time,
  EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) as time_span_seconds
FROM buddies_events
WHERE room_id = 'YOUR_ROOM_ID'  -- 替換為實際房間 ID
  AND event_type = 'question_answered'
GROUP BY event_data->>'question_index'
ORDER BY question_index::int;

-- 3. 檢查是否有用戶的答案被覆蓋（提交了但 member_answers 中沒有）
WITH event_users AS (
  SELECT DISTINCT user_id
  FROM buddies_events
  WHERE room_id = 'YOUR_ROOM_ID'  -- 替換為實際房間 ID
    AND event_type = 'question_answered'
    AND event_data->>'question_index' = '0'  -- 檢查趣味問題 (index 0)
),
member_answer_users AS (
  SELECT jsonb_object_keys(member_answers) as user_id
  FROM buddies_rooms
  WHERE id = 'YOUR_ROOM_ID'  -- 替換為實際房間 ID
)
SELECT
  eu.user_id,
  CASE
    WHEN mau.user_id IS NOT NULL THEN '✅ 答案已保存'
    ELSE '❌ 答案遺失（競態條件）'
  END as status
FROM event_users eu
LEFT JOIN member_answer_users mau ON eu.user_id = mau.user_id
ORDER BY eu.user_id;

-- 4. 查看提交答案的時間差（判斷是否接近同時提交）
WITH answer_times AS (
  SELECT
    user_id,
    event_data->>'question_index' as question_index,
    created_at,
    LAG(created_at) OVER (ORDER BY created_at) as previous_time
  FROM buddies_events
  WHERE room_id = 'YOUR_ROOM_ID'  -- 替換為實際房間 ID
    AND event_type = 'question_answered'
    AND event_data->>'question_index' = '0'  -- 趣味問題
  ORDER BY created_at
)
SELECT
  user_id,
  created_at,
  CASE
    WHEN previous_time IS NULL THEN NULL
    ELSE EXTRACT(EPOCH FROM (created_at - previous_time))
  END as seconds_since_previous_answer,
  CASE
    WHEN previous_time IS NULL THEN NULL
    WHEN EXTRACT(EPOCH FROM (created_at - previous_time)) < 1 THEN '⚠️ 極近時間（可能競態）'
    WHEN EXTRACT(EPOCH FROM (created_at - previous_time)) < 3 THEN '⚠️ 接近時間'
    ELSE '✅ 正常間隔'
  END as timing_status
FROM answer_times;
