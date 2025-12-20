-- ==========================================
-- SwiftTaste 數據分析函數設置
-- ==========================================
-- 此文件創建所有儀表板需要的分析函數，繞過 RLS 限制
-- 請在 Supabase SQL Editor 中執行此文件


-- ==========================================
-- 1. 匿名用戶統計函數
-- ==========================================
CREATE OR REPLACE FUNCTION get_anonymous_user_stats()
RETURNS TABLE (
  total_anonymous BIGINT,
  anonymous_swifttaste BIGINT,
  anonymous_buddies BIGINT,
  completely_anonymous BIGINT,
  incomplete_profile BIGINT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  registered_user_ids UUID[];
BEGIN
  -- 獲取已註冊用戶 ID（有填寫任何個人資料的用戶）
  SELECT ARRAY_AGG(id)
  INTO registered_user_ids
  FROM user_profiles
  WHERE bio IS NOT NULL
     OR avatar_url IS NOT NULL
     OR gender IS NOT NULL
     OR birth_date IS NOT NULL
     OR occupation IS NOT NULL
     OR location IS NOT NULL;

  -- 返回匿名用戶統計
  RETURN QUERY
  WITH anonymous_sessions AS (
    SELECT
      user_id,
      session_id,
      mode,
      CASE
        WHEN user_id IS NULL THEN true
        ELSE false
      END as is_completely_anonymous
    FROM user_selection_history
    WHERE user_id IS NULL
       OR user_id != ALL(COALESCE(registered_user_ids, ARRAY[]::UUID[]))
  )
  SELECT
    COUNT(DISTINCT session_id)::BIGINT as total_anonymous,
    COUNT(DISTINCT CASE WHEN mode = 'swifttaste' THEN session_id END)::BIGINT as anonymous_swifttaste,
    COUNT(DISTINCT CASE WHEN mode = 'buddies' THEN session_id END)::BIGINT as anonymous_buddies,
    COUNT(DISTINCT CASE WHEN is_completely_anonymous THEN session_id END)::BIGINT as completely_anonymous,
    COUNT(DISTINCT CASE WHEN NOT is_completely_anonymous THEN session_id END)::BIGINT as incomplete_profile
  FROM anonymous_sessions;
END;
$$;


-- ==========================================
-- 2. 用戶分類統計函數
-- ==========================================
CREATE OR REPLACE FUNCTION get_user_classification_stats()
RETURNS TABLE (
  total_users BIGINT,
  registered_users BIGINT,
  incomplete_with_usage BIGINT,
  incomplete_without_usage BIGINT,
  anonymous_devices BIGINT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH registered AS (
    SELECT id
    FROM user_profiles
    WHERE bio IS NOT NULL
       OR avatar_url IS NOT NULL
       OR gender IS NOT NULL
       OR birth_date IS NOT NULL
       OR occupation IS NOT NULL
       OR location IS NOT NULL
  ),
  incomplete_users AS (
    SELECT id
    FROM user_profiles
    WHERE bio IS NULL
      AND avatar_url IS NULL
      AND gender IS NULL
      AND birth_date IS NULL
      AND occupation IS NULL
      AND location IS NULL
  ),
  incomplete_with_usage AS (
    SELECT DISTINCT ush.user_id
    FROM user_selection_history ush
    INNER JOIN incomplete_users iu ON ush.user_id = iu.id
  ),
  anonymous_sessions AS (
    SELECT DISTINCT session_id
    FROM user_selection_history
    WHERE user_id IS NULL
       OR user_id NOT IN (SELECT id FROM registered)
  )
  SELECT
    (SELECT COUNT(*) FROM user_profiles)::BIGINT,
    (SELECT COUNT(*) FROM registered)::BIGINT,
    (SELECT COUNT(*) FROM incomplete_with_usage)::BIGINT,
    (SELECT COUNT(*) FROM incomplete_users) - (SELECT COUNT(*) FROM incomplete_with_usage)::BIGINT,
    (SELECT COUNT(*) FROM anonymous_sessions)::BIGINT;
END;
$$;


-- ==========================================
-- 3. 會話來源分析函數
-- ==========================================
CREATE OR REPLACE FUNCTION get_session_source_stats()
RETURNS TABLE (
  total_sessions BIGINT,
  registered_sessions BIGINT,
  anonymous_sessions BIGINT,
  incomplete_sessions BIGINT,
  registered_percentage NUMERIC,
  anonymous_percentage NUMERIC,
  incomplete_percentage NUMERIC
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  total BIGINT;
  registered BIGINT;
  anonymous BIGINT;
  incomplete BIGINT;
BEGIN
  -- 計算各類會話數
  WITH registered_users AS (
    SELECT id
    FROM user_profiles
    WHERE bio IS NOT NULL
       OR avatar_url IS NOT NULL
       OR gender IS NOT NULL
       OR birth_date IS NOT NULL
       OR occupation IS NOT NULL
       OR location IS NOT NULL
  )
  SELECT
    COUNT(*)::BIGINT,
    COUNT(CASE WHEN user_id IN (SELECT id FROM registered_users) THEN 1 END)::BIGINT,
    COUNT(CASE WHEN user_id IS NULL THEN 1 END)::BIGINT,
    COUNT(CASE WHEN user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM registered_users) THEN 1 END)::BIGINT
  INTO total, registered, anonymous, incomplete
  FROM user_selection_history;

  RETURN QUERY
  SELECT
    total,
    registered,
    anonymous,
    incomplete,
    ROUND((registered::NUMERIC / NULLIF(total, 0) * 100), 2),
    ROUND((anonymous::NUMERIC / NULLIF(total, 0) * 100), 2),
    ROUND((incomplete::NUMERIC / NULLIF(total, 0) * 100), 2);
END;
$$;


-- ==========================================
-- 4. 模式使用對比函數
-- ==========================================
CREATE OR REPLACE FUNCTION get_mode_usage_comparison()
RETURNS TABLE (
  mode VARCHAR,
  total_sessions BIGINT,
  registered_sessions BIGINT,
  anonymous_sessions BIGINT,
  incomplete_sessions BIGINT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH registered_users AS (
    SELECT id
    FROM user_profiles
    WHERE bio IS NOT NULL
       OR avatar_url IS NOT NULL
       OR gender IS NOT NULL
       OR birth_date IS NOT NULL
       OR occupation IS NOT NULL
       OR location IS NOT NULL
  )
  SELECT
    ush.mode::VARCHAR,
    COUNT(*)::BIGINT as total_sessions,
    COUNT(CASE WHEN ush.user_id IN (SELECT id FROM registered_users) THEN 1 END)::BIGINT as registered_sessions,
    COUNT(CASE WHEN ush.user_id IS NULL THEN 1 END)::BIGINT as anonymous_sessions,
    COUNT(CASE WHEN ush.user_id IS NOT NULL AND ush.user_id NOT IN (SELECT id FROM registered_users) THEN 1 END)::BIGINT as incomplete_sessions
  FROM user_selection_history ush
  GROUP BY ush.mode
  ORDER BY total_sessions DESC;
END;
$$;


-- ==========================================
-- 5. 用戶活躍度排行函數
-- ==========================================
CREATE OR REPLACE FUNCTION get_user_activity_ranking(limit_count INT DEFAULT 10)
RETURNS TABLE (
  user_id UUID,
  user_name VARCHAR,
  user_email VARCHAR,
  is_registered BOOLEAN,
  total_sessions BIGINT,
  swifttaste_count BIGINT,
  buddies_count BIGINT,
  last_activity TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH registered_users AS (
    SELECT id
    FROM user_profiles
    WHERE bio IS NOT NULL
       OR avatar_url IS NOT NULL
       OR gender IS NOT NULL
       OR birth_date IS NOT NULL
       OR occupation IS NOT NULL
       OR location IS NOT NULL
  ),
  user_activity AS (
    SELECT
      ush.user_id,
      COUNT(*)::BIGINT as total_sessions,
      COUNT(CASE WHEN ush.mode = 'swifttaste' THEN 1 END)::BIGINT as swifttaste_count,
      COUNT(CASE WHEN ush.mode = 'buddies' THEN 1 END)::BIGINT as buddies_count,
      MAX(ush.started_at) as last_activity
    FROM user_selection_history ush
    WHERE ush.user_id IS NOT NULL
    GROUP BY ush.user_id
  )
  SELECT
    ua.user_id,
    up.name::VARCHAR,
    up.email::VARCHAR,
    (ua.user_id IN (SELECT id FROM registered_users))::BOOLEAN,
    ua.total_sessions,
    ua.swifttaste_count,
    ua.buddies_count,
    ua.last_activity
  FROM user_activity ua
  LEFT JOIN user_profiles up ON ua.user_id = up.id
  ORDER BY ua.total_sessions DESC
  LIMIT limit_count;
END;
$$;


-- ==========================================
-- 6. 註冊轉化率統計函數
-- ==========================================
CREATE OR REPLACE FUNCTION get_registration_conversion_stats()
RETURNS TABLE (
  total_users BIGINT,
  registered_users BIGINT,
  users_with_activity BIGINT,
  dormant_users BIGINT,
  registration_rate NUMERIC,
  activity_rate NUMERIC,
  dormant_rate NUMERIC
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  total BIGINT;
  registered BIGINT;
  with_activity BIGINT;
  dormant BIGINT;
BEGIN
  -- 計算各類用戶數
  SELECT COUNT(*)::BIGINT INTO total FROM user_profiles;

  SELECT COUNT(*)::BIGINT INTO registered
  FROM user_profiles
  WHERE bio IS NOT NULL
     OR avatar_url IS NOT NULL
     OR gender IS NOT NULL
     OR birth_date IS NOT NULL
     OR occupation IS NOT NULL
     OR location IS NOT NULL;

  SELECT COUNT(DISTINCT user_id)::BIGINT INTO with_activity
  FROM user_selection_history
  WHERE user_id IS NOT NULL;

  dormant := total - with_activity;

  RETURN QUERY
  SELECT
    total,
    registered,
    with_activity,
    dormant,
    ROUND((registered::NUMERIC / NULLIF(total, 0) * 100), 2),
    ROUND((with_activity::NUMERIC / NULLIF(total, 0) * 100), 2),
    ROUND((dormant::NUMERIC / NULLIF(total, 0) * 100), 2);
END;
$$;


-- ==========================================
-- 7. 匿名用戶按時間趨勢函數
-- ==========================================
CREATE OR REPLACE FUNCTION get_anonymous_user_trend(days_back INT DEFAULT 30)
RETURNS TABLE (
  date DATE,
  anonymous_sessions BIGINT,
  registered_sessions BIGINT,
  total_sessions BIGINT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH registered_users AS (
    SELECT id
    FROM user_profiles
    WHERE bio IS NOT NULL
       OR avatar_url IS NOT NULL
       OR gender IS NOT NULL
       OR birth_date IS NOT NULL
       OR occupation IS NOT NULL
       OR location IS NOT NULL
  ),
  date_series AS (
    SELECT generate_series(
      CURRENT_DATE - (days_back || ' days')::INTERVAL,
      CURRENT_DATE,
      '1 day'::INTERVAL
    )::DATE as date
  )
  SELECT
    ds.date,
    COALESCE(COUNT(CASE
      WHEN ush.user_id IS NULL OR ush.user_id NOT IN (SELECT id FROM registered_users)
      THEN 1
    END), 0)::BIGINT as anonymous_sessions,
    COALESCE(COUNT(CASE
      WHEN ush.user_id IN (SELECT id FROM registered_users)
      THEN 1
    END), 0)::BIGINT as registered_sessions,
    COALESCE(COUNT(*), 0)::BIGINT as total_sessions
  FROM date_series ds
  LEFT JOIN user_selection_history ush ON DATE(ush.started_at) = ds.date
  GROUP BY ds.date
  ORDER BY ds.date;
END;
$$;


-- ==========================================
-- 測試查詢（執行後可刪除）
-- ==========================================
-- 測試所有函數是否正常工作

-- 1. 測試匿名用戶統計
SELECT * FROM get_anonymous_user_stats();

-- 2. 測試用戶分類統計
SELECT * FROM get_user_classification_stats();

-- 3. 測試會話來源分析
SELECT * FROM get_session_source_stats();

-- 4. 測試模式使用對比
SELECT * FROM get_mode_usage_comparison();

-- 5. 測試用戶活躍度排行（前5名）
SELECT * FROM get_user_activity_ranking(5);

-- 6. 測試註冊轉化率統計
SELECT * FROM get_registration_conversion_stats();

-- 7. 測試匿名用戶趨勢（最近7天）
SELECT * FROM get_anonymous_user_trend(7);


-- ==========================================
-- 完成提示
-- ==========================================
-- 所有函數創建完成！
--
-- 下一步：
-- 1. 檢查上面的測試查詢結果，確認數據正確
-- 2. 在前端代碼中調用這些函數
-- 3. 在儀表板上顯示結果
