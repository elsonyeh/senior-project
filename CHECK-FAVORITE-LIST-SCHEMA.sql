-- 🔍 檢查收藏清單相關表結構
-- 用於診斷 place_id 欄位問題

-- 1. 檢查 favorite_list_places 表結構
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'favorite_list_places'
ORDER BY ordinal_position;

-- 2. 檢查所有收藏相關的表
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%favorite%'
ORDER BY table_name;

-- 3. 如果表名不同，檢查可能的替代表名
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND (table_name LIKE '%list%' OR table_name LIKE '%place%')
ORDER BY table_name;

-- 4. 檢查 user_favorite_lists 表結構
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'user_favorite_lists'
ORDER BY ordinal_position;