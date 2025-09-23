-- 🔍 檢查圖片相關的表
-- 尋找可能儲存餐廳圖片的表

-- 1. 查找所有包含 image 的表
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND (table_name LIKE '%image%' OR table_name LIKE '%photo%')
ORDER BY table_name;

-- 2. 查找所有表名
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;