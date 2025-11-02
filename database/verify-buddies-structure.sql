-- ==========================================
-- 驗證 Buddies 架構完整性
-- ==========================================
-- 執行此腳本以確認所有必要欄位都已正確建立
-- ==========================================

-- 檢查 buddies_rooms 所有欄位
SELECT
  column_name,
  data_type,
  CASE
    WHEN column_default IS NOT NULL THEN 'Yes'
    ELSE 'No'
  END as has_default,
  CASE
    WHEN is_nullable = 'YES' THEN 'Yes'
    ELSE 'No'
  END as nullable
FROM information_schema.columns
WHERE table_name = 'buddies_rooms'
ORDER BY ordinal_position;

-- ==========================================
-- 檢查關鍵 JSONB 欄位是否存在
-- ==========================================

DO $$
DECLARE
  has_questions BOOLEAN;
  has_member_answers BOOLEAN;
  has_recommendations BOOLEAN;
  has_votes BOOLEAN;
  has_final_data BOOLEAN;
BEGIN
  -- 檢查各欄位
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buddies_rooms' AND column_name = 'questions'
  ) INTO has_questions;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buddies_rooms' AND column_name = 'member_answers'
  ) INTO has_member_answers;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buddies_rooms' AND column_name = 'recommendations'
  ) INTO has_recommendations;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buddies_rooms' AND column_name = 'votes'
  ) INTO has_votes;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buddies_rooms' AND column_name = 'final_restaurant_data'
  ) INTO has_final_data;

  -- 顯示結果
  RAISE NOTICE '======================================';
  RAISE NOTICE '✨ Buddies 架構驗證結果';
  RAISE NOTICE '======================================';
  RAISE NOTICE '';
  RAISE NOTICE '實時互動層 (Operational Layer):';
  RAISE NOTICE '  - questions: %', CASE WHEN has_questions THEN '✅' ELSE '❌' END;
  RAISE NOTICE '  - member_answers: %', CASE WHEN has_member_answers THEN '✅' ELSE '❌' END;
  RAISE NOTICE '  - recommendations: %', CASE WHEN has_recommendations THEN '✅' ELSE '❌' END;
  RAISE NOTICE '  - votes: %', CASE WHEN has_votes THEN '✅' ELSE '❌' END;
  RAISE NOTICE '  - final_restaurant_data: %', CASE WHEN has_final_data THEN '✅' ELSE '❌' END;
  RAISE NOTICE '';

  IF has_questions AND has_member_answers AND has_recommendations AND has_votes AND has_final_data THEN
    RAISE NOTICE '🎉 所有必要欄位都已正確建立！';
    RAISE NOTICE '';
    RAISE NOTICE '下一步：';
    RAISE NOTICE '1. 測試 Buddies 完整流程';
    RAISE NOTICE '2. 檢查 Console 日誌是否正常';
    RAISE NOTICE '3. 確認推薦生成功能';
  ELSE
    RAISE NOTICE '⚠️  有欄位缺失，請執行遷移腳本';
    RAISE NOTICE '';
    RAISE NOTICE '執行：database/migrations/buddies-unified-architecture.sql';
  END IF;

  RAISE NOTICE '======================================';
END $$;

-- ==========================================
-- 檢查索引是否正確建立
-- ==========================================

SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('buddies_rooms', 'buddies_interactions')
  AND schemaname = 'public'
ORDER BY tablename, indexname;

-- ==========================================
-- 檢查 buddies_interactions 表（事件記錄層）
-- ==========================================

SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'buddies_interactions'
ORDER BY ordinal_position;

-- ==========================================
-- 測試查詢：驗證 JSONB 功能
-- ==========================================

-- 創建測試房間（如果不存在）
DO $$
BEGIN
  -- 測試插入
  INSERT INTO buddies_rooms (id, host_id, status)
  VALUES ('test-verification', 'test-user', 'waiting')
  ON CONFLICT (id) DO NOTHING;

  -- 測試更新 JSONB 欄位
  UPDATE buddies_rooms
  SET
    questions = '[{"text": "測試問題", "type": "basic"}]'::jsonb,
    member_answers = '{"test-user": {"answers": ["測試答案"], "completed": true}}'::jsonb,
    recommendations = '[{"id": "test-rest", "name": "測試餐廳", "score": 100}]'::jsonb,
    votes = '{"test-rest": {"count": 1, "voters": ["test-user"]}}'::jsonb
  WHERE id = 'test-verification';

  -- 查詢測試
  PERFORM * FROM buddies_rooms WHERE id = 'test-verification';

  RAISE NOTICE '';
  RAISE NOTICE '✅ JSONB 欄位讀寫測試成功！';
  RAISE NOTICE '';

  -- 清理測試數據
  DELETE FROM buddies_rooms WHERE id = 'test-verification';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ JSONB 測試失敗: %', SQLERRM;
END $$;

-- ==========================================
-- 完成
-- ==========================================

SELECT '✅ 架構驗證完成！請檢查上方輸出。' as result;
