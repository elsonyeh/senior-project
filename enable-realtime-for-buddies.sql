-- ==========================================
-- 啟用 Buddies 相關表的 Supabase Realtime
-- ==========================================
-- 此腳本為 Buddies 模式相關的表啟用 Realtime 功能
-- 執行方式：在 Supabase Dashboard 的 SQL Editor 中執行

-- 使用 DO 區塊來安全地添加表到 publication
-- 只有當表尚未在 publication 中時才添加

DO $$
DECLARE
  tables_to_add text[] := ARRAY[
    'buddies_rooms',
    'buddies_members',
    'buddies_questions',
    'buddies_answers',
    'buddies_recommendations',
    'buddies_votes',
    'buddies_restaurant_votes',
    'buddies_final_results'
  ];
  table_name text;
  table_exists boolean;
BEGIN
  FOREACH table_name IN ARRAY tables_to_add
  LOOP
    -- 檢查表是否已經在 publication 中
    SELECT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      AND tablename = table_name
    ) INTO table_exists;

    -- 如果表不在 publication 中，則添加
    IF NOT table_exists THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', table_name);
      RAISE NOTICE 'Added table % to supabase_realtime', table_name;
    ELSE
      RAISE NOTICE 'Table % already in supabase_realtime, skipping', table_name;
    END IF;
  END LOOP;
END $$;

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
-- - buddies_restaurant_votes: 餐廳投票
-- - buddies_final_results: 最終結果
--
-- 注意：RLS (Row Level Security) 政策仍然適用於 Realtime 事件
-- 確保你的 RLS 政策允許用戶訂閱這些表的變化
