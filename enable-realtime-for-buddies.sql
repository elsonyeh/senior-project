-- ==========================================
-- 啟用 Buddies 相關表的 Supabase Realtime
-- ==========================================
-- 此腳本為 Buddies 模式相關的表啟用 Realtime 功能
-- 執行方式：在 Supabase Dashboard 的 SQL Editor 中執行

-- 1. 為 buddies_rooms 表啟用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE buddies_rooms;

-- 2. 為 buddies_members 表啟用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE buddies_members;

-- 3. 為 buddies_questions 表啟用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE buddies_questions;

-- 4. 為 buddies_answers 表啟用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE buddies_answers;

-- 5. 為 buddies_recommendations 表啟用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE buddies_recommendations;

-- 6. 為 buddies_votes 表啟用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE buddies_votes;

-- 驗證 Realtime 是否啟用成功
SELECT
  schemaname,
  tablename
FROM
  pg_publication_tables
WHERE
  pubname = 'supabase_realtime'
  AND tablename LIKE 'buddies_%'
ORDER BY
  tablename;

-- ==========================================
-- 說明
-- ==========================================
-- 執行此腳本後，Supabase Realtime 將能夠監聽這些表的變化：
-- - buddies_rooms: 房間狀態變化
-- - buddies_members: 成員加入/離開
-- - buddies_questions: 問題集更新
-- - buddies_answers: 答案提交
-- - buddies_recommendations: 推薦結果
-- - buddies_votes: 投票更新
--
-- 注意：RLS (Row Level Security) 政策仍然適用於 Realtime 事件
-- 確保你的 RLS 政策允許用戶訂閱這些表的變化
