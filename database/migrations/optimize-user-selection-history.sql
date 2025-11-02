-- ==========================================
-- 優化 user_selection_history 表
-- ==========================================
-- 目的：移除與互動表重複的欄位
-- 將詳細互動記錄交給專門的互動表處理
-- ==========================================

-- ==========================================
-- 第一步：數據遷移策略說明
-- ==========================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '優化 user_selection_history 表';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '本腳本將：';
  RAISE NOTICE '1. 保留 user_selection_history 中的摘要數據';
  RAISE NOTICE '2. 詳細互動記錄交給 swifttaste_interactions';
  RAISE NOTICE '3. 移除冗餘欄位（可選）';
  RAISE NOTICE '';
  RAISE NOTICE '決策：';
  RAISE NOTICE '- swipe_count: 保留（快速查詢用）';
  RAISE NOTICE '- liked_restaurants: 保留（快速訪問用）';
  RAISE NOTICE '- 新增時間戳欄位（已執行）';
  RAISE NOTICE '';
  RAISE NOTICE '原因：';
  RAISE NOTICE '- 這些欄位可以作為快取，提升查詢速度';
  RAISE NOTICE '- 詳細數據從互動表查詢';
  RAISE NOTICE '- 符合 Denormalization for Performance 原則';
  RAISE NOTICE '========================================';
END $$;

-- ==========================================
-- 第二步：添加註釋說明數據來源
-- ==========================================

COMMENT ON COLUMN user_selection_history.swipe_count IS
'滑動次數（快取）- 詳細記錄在 swifttaste_interactions 表';

COMMENT ON COLUMN user_selection_history.liked_restaurants IS
'喜歡的餐廳列表（快取）- 詳細記錄在 swifttaste_interactions 表（action_type = like）';

COMMENT ON COLUMN user_selection_history.recommended_restaurants IS
'推薦的餐廳列表（摘要）- 完整推薦邏輯可重新計算';

COMMENT ON COLUMN user_selection_history.final_restaurant IS
'最終選擇的餐廳（結果）- 對應 swifttaste_interactions (action_type = final)';

-- ==========================================
-- 第三步：創建視圖方便查詢完整數據
-- ==========================================

-- 創建視圖：合併 user_selection_history 和互動記錄
CREATE OR REPLACE VIEW v_swifttaste_sessions_with_interactions AS
SELECT
  ush.id,
  ush.user_id,
  ush.session_id,
  ush.mode,
  ush.started_at,
  ush.completed_at,
  ush.session_duration,
  ush.questions_started_at,
  ush.fun_questions_started_at,
  ush.restaurants_started_at,
  ush.basic_answers,
  ush.fun_answers,
  ush.final_restaurant,

  -- 從互動表計算的即時數據
  (SELECT COUNT(*)
   FROM swifttaste_interactions si
   WHERE si.session_id = ush.id
   AND si.action_type = 'view') as actual_view_count,

  (SELECT COUNT(*)
   FROM swifttaste_interactions si
   WHERE si.session_id = ush.id
   AND si.action_type = 'like') as actual_like_count,

  (SELECT COUNT(*)
   FROM swifttaste_interactions si
   WHERE si.session_id = ush.id
   AND si.action_type = 'skip') as actual_skip_count,

  -- 快取數據（用於快速訪問）
  ush.swipe_count as cached_swipe_count,
  ush.liked_restaurants as cached_liked_restaurants

FROM user_selection_history ush
WHERE ush.mode = 'swifttaste';

COMMENT ON VIEW v_swifttaste_sessions_with_interactions IS
'SwiftTaste 會話與互動記錄的合併視圖 - 包含即時計算和快取數據';

-- ==========================================
-- 第四步：創建觸發器自動更新快取
-- ==========================================

-- 當互動表新增記錄時，自動更新 user_selection_history 的快取欄位
CREATE OR REPLACE FUNCTION update_selection_history_cache()
RETURNS TRIGGER AS $$
BEGIN
  -- 更新 swipe_count（所有互動）
  UPDATE user_selection_history
  SET swipe_count = (
    SELECT COUNT(*)
    FROM swifttaste_interactions
    WHERE session_id = NEW.session_id
  )
  WHERE id = NEW.session_id;

  -- 如果是 like，更新 liked_restaurants
  IF NEW.action_type = 'like' THEN
    UPDATE user_selection_history
    SET liked_restaurants = (
      SELECT COALESCE(json_agg(
        jsonb_build_object(
          'id', restaurant_id,
          'liked_at', created_at
        )
      ), '[]'::json)
      FROM swifttaste_interactions
      WHERE session_id = NEW.session_id
      AND action_type = 'like'
    )
    WHERE id = NEW.session_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 創建觸發器
CREATE TRIGGER trg_update_selection_history_cache
AFTER INSERT ON swifttaste_interactions
FOR EACH ROW
EXECUTE FUNCTION update_selection_history_cache();

COMMENT ON FUNCTION update_selection_history_cache IS
'自動更新 user_selection_history 中的快取欄位';

-- ==========================================
-- 第五步：數據一致性檢查函數
-- ==========================================

CREATE OR REPLACE FUNCTION check_data_consistency()
RETURNS TABLE (
  session_id UUID,
  cached_swipe_count INTEGER,
  actual_swipe_count BIGINT,
  is_consistent BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ush.id,
    ush.swipe_count as cached_swipe_count,
    COUNT(si.id) as actual_swipe_count,
    (ush.swipe_count = COUNT(si.id)) as is_consistent
  FROM user_selection_history ush
  LEFT JOIN swifttaste_interactions si ON si.session_id = ush.id
  WHERE ush.mode = 'swifttaste'
  GROUP BY ush.id, ush.swipe_count
  HAVING ush.swipe_count != COUNT(si.id)
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_data_consistency IS
'檢查快取數據與實際數據的一致性';

-- ==========================================
-- 驗證
-- ==========================================

-- 檢查視圖是否創建成功
SELECT COUNT(*) as view_exists
FROM information_schema.views
WHERE table_name = 'v_swifttaste_sessions_with_interactions';

-- 檢查觸發器是否創建成功
SELECT COUNT(*) as trigger_exists
FROM information_schema.triggers
WHERE trigger_name = 'trg_update_selection_history_cache';

-- 測試視圖
SELECT * FROM v_swifttaste_sessions_with_interactions LIMIT 1;

-- 測試一致性檢查
SELECT * FROM check_data_consistency();

-- ==========================================
-- 完成提示
-- ==========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 優化完成';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '架構說明：';
  RAISE NOTICE '1. user_selection_history - 存儲會話摘要和快取數據';
  RAISE NOTICE '2. swifttaste_interactions - 存儲詳細互動記錄';
  RAISE NOTICE '3. 觸發器自動同步快取';
  RAISE NOTICE '';
  RAISE NOTICE '查詢建議：';
  RAISE NOTICE '- 快速訪問：直接查 user_selection_history';
  RAISE NOTICE '- 詳細分析：使用視圖 v_swifttaste_sessions_with_interactions';
  RAISE NOTICE '- 互動追蹤：查 swifttaste_interactions';
  RAISE NOTICE '';
  RAISE NOTICE '數據一致性：';
  RAISE NOTICE '- 執行 SELECT * FROM check_data_consistency()';
  RAISE NOTICE '========================================';
END $$;
