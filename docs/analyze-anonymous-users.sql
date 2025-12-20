-- ==========================================
-- SwiftTaste 匿名用戶數據分析 SQL
-- ==========================================
-- 此文件包含所有用於分析匿名用戶的 SQL 查詢
-- 請在 Supabase SQL Editor 中逐個執行


-- ==========================================
-- 1. 查看 user_profiles 表結構
-- ==========================================
-- 目的：確認表中有哪些欄位
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_profiles'
ORDER BY ordinal_position;


-- ==========================================
-- 2. 查看用戶數據樣本
-- ==========================================
-- 目的：查看實際數據，了解哪些欄位有值
SELECT * FROM user_profiles LIMIT 5;


-- ==========================================
-- 3. 用戶個人資料完整度分析
-- ==========================================
-- 目的：查看每個用戶填寫了多少個人資料欄位
SELECT
    id,
    name,
    email,
    avatar_url IS NOT NULL as has_avatar,
    gender IS NOT NULL as has_gender,
    birth_date IS NOT NULL as has_birth_date,
    occupation IS NOT NULL as has_occupation,
    location IS NOT NULL as has_location,
    age IS NOT NULL as has_age,
    (CASE WHEN avatar_url IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN gender IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN birth_date IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN occupation IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN location IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN age IS NOT NULL THEN 1 ELSE 0 END) as filled_fields_count
FROM user_profiles
ORDER BY filled_fields_count DESC;


-- ==========================================
-- 4. 用戶註冊狀態統計
-- ==========================================
-- 目的：統計已完成註冊和未完成註冊的用戶數量
-- 注意：如果 bio 欄位不存在，請移除相關的條件
SELECT
  COUNT(*) AS 總用戶數,
  COUNT(CASE
    WHEN avatar_url IS NOT NULL
      OR gender IS NOT NULL
      OR birth_date IS NOT NULL
      OR occupation IS NOT NULL
      OR location IS NOT NULL
    THEN 1
  END) AS 已完成註冊,
  COUNT(CASE
    WHEN avatar_url IS NULL
      AND gender IS NULL
      AND birth_date IS NULL
      AND occupation IS NULL
      AND location IS NULL
    THEN 1
  END) AS 未完成註冊
FROM user_profiles;


-- ==========================================
-- 5. 會話記錄總體分析
-- ==========================================
-- 目的：分析所有會話記錄的基本統計
SELECT
  COUNT(*) AS 總會話數,
  COUNT(CASE WHEN user_id IS NULL THEN 1 END) AS 完全匿名會話_未登錄,
  COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) AS 有user_id的會話,
  COUNT(DISTINCT user_id) AS 獨特用戶數,
  COUNT(DISTINCT session_id) AS 獨特設備數
FROM user_selection_history;


-- ==========================================
-- 6. 按模式統計會話
-- ==========================================
-- 目的：查看 SwiftTaste 和 Buddies 各有多少會話
SELECT
  mode AS 模式,
  COUNT(*) AS 會話數,
  COUNT(DISTINCT user_id) AS 獨特用戶數,
  COUNT(DISTINCT session_id) AS 獨特設備數
FROM user_selection_history
GROUP BY mode;


-- ==========================================
-- 7. 匿名用戶詳細分析（完整版）
-- ==========================================
-- 目的：區分三種用戶類型的會話統計
WITH registered_users AS (
  -- 定義已完成註冊的用戶（有填寫任何個人資料）
  SELECT id
  FROM user_profiles
  WHERE avatar_url IS NOT NULL
     OR gender IS NOT NULL
     OR birth_date IS NOT NULL
     OR occupation IS NOT NULL
     OR location IS NOT NULL
),
session_analysis AS (
  SELECT
    ush.*,
    CASE
      WHEN ush.user_id IS NULL THEN '完全匿名（未登錄）'
      WHEN ush.user_id NOT IN (SELECT id FROM registered_users) THEN '已登錄但未完成註冊'
      ELSE '已註冊用戶'
    END AS 用戶類型
  FROM user_selection_history ush
)
SELECT
  用戶類型,
  COUNT(*) AS 會話數,
  COUNT(DISTINCT session_id) AS 獨特設備數,
  COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS 獨特用戶數
FROM session_analysis
GROUP BY 用戶類型
ORDER BY 用戶類型;


-- ==========================================
-- 8. 按模式分析匿名用戶（SwiftTaste vs Buddies）
-- ==========================================
-- 目的：查看匿名用戶在兩種模式下的使用情況
WITH registered_users AS (
  SELECT id
  FROM user_profiles
  WHERE avatar_url IS NOT NULL
     OR gender IS NOT NULL
     OR birth_date IS NOT NULL
     OR occupation IS NOT NULL
     OR location IS NOT NULL
)
SELECT
  mode AS 模式,
  COUNT(*) AS 匿名會話數,
  COUNT(DISTINCT session_id) AS 獨特匿名設備數,
  COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS 獨特匿名用戶數
FROM user_selection_history
WHERE user_id IS NULL
   OR user_id NOT IN (SELECT id FROM registered_users)
GROUP BY mode;


-- ==========================================
-- 9. 未完成註冊用戶的使用情況
-- ==========================================
-- 目的：查看每個未完成註冊的用戶是否有使用記錄
WITH incomplete_users AS (
  SELECT id, name, email, created_at
  FROM user_profiles
  WHERE avatar_url IS NULL
    AND gender IS NULL
    AND birth_date IS NULL
    AND occupation IS NULL
    AND location IS NULL
)
SELECT
  iu.id,
  iu.name AS 用戶名稱,
  iu.email AS 電子郵件,
  iu.created_at AS 註冊時間,
  COUNT(ush.id) AS 使用次數,
  COUNT(DISTINCT ush.session_id) AS 獨特會話數,
  MIN(ush.started_at) AS 首次使用時間,
  MAX(ush.started_at) AS 最後使用時間
FROM incomplete_users iu
LEFT JOIN user_selection_history ush ON ush.user_id = iu.id
GROUP BY iu.id, iu.name, iu.email, iu.created_at
ORDER BY 使用次數 DESC;


-- ==========================================
-- 10. 已註冊用戶的使用情況
-- ==========================================
-- 目的：查看已完成註冊的用戶的使用記錄
WITH registered_users AS (
  SELECT id, name, email, created_at
  FROM user_profiles
  WHERE avatar_url IS NOT NULL
     OR gender IS NOT NULL
     OR birth_date IS NOT NULL
     OR occupation IS NOT NULL
     OR location IS NOT NULL
)
SELECT
  ru.id,
  ru.name AS 用戶名稱,
  ru.email AS 電子郵件,
  ru.created_at AS 註冊時間,
  COUNT(ush.id) AS 使用次數,
  COUNT(DISTINCT ush.session_id) AS 獨特會話數,
  MIN(ush.started_at) AS 首次使用時間,
  MAX(ush.started_at) AS 最後使用時間
FROM registered_users ru
LEFT JOIN user_selection_history ush ON ush.user_id = ru.id
GROUP BY ru.id, ru.name, ru.email, ru.created_at
ORDER BY 使用次數 DESC;


-- ==========================================
-- 11. 完全匿名會話詳細信息（如果存在）
-- ==========================================
-- 目的：查看所有 user_id 為 null 的會話記錄
SELECT
  id,
  session_id,
  mode,
  started_at,
  completed_at,
  session_duration
FROM user_selection_history
WHERE user_id IS NULL
ORDER BY started_at DESC
LIMIT 20;


-- ==========================================
-- 12. Session ID 去重統計
-- ==========================================
-- 目的：按 session_id 統計匿名設備的使用情況
WITH registered_users AS (
  SELECT id
  FROM user_profiles
  WHERE avatar_url IS NOT NULL
     OR gender IS NOT NULL
     OR birth_date IS NOT NULL
     OR occupation IS NOT NULL
     OR location IS NOT NULL
)
SELECT
  session_id,
  COUNT(*) AS 會話次數,
  MIN(started_at) AS 首次使用,
  MAX(started_at) AS 最後使用,
  ARRAY_AGG(DISTINCT mode) AS 使用模式,
  CASE
    WHEN MIN(user_id) IS NULL THEN '完全匿名'
    WHEN MIN(user_id) NOT IN (SELECT id FROM registered_users) THEN '未完成註冊'
    ELSE '已註冊'
  END AS 用戶類型
FROM user_selection_history
WHERE user_id IS NULL
   OR user_id NOT IN (SELECT id FROM registered_users)
GROUP BY session_id
ORDER BY 會話次數 DESC;


-- ==========================================
-- 執行說明
-- ==========================================
-- 1. 請在 Supabase SQL Editor 中逐個執行上述查詢
-- 2. 從查詢 1 開始，依序執行到查詢 12
-- 3. 如果某個查詢報錯（例如 bio 欄位不存在），請跳過該查詢
-- 4. 重點關注查詢 7、8、9 的結果，這些會告訴您匿名用戶的分佈情況
-- 5. 將查詢結果截圖或複製，以便進一步分析
