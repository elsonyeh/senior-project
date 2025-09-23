-- 🔍 檢查 restaurants 表結構
-- 找出正確的圖片欄位名稱

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'restaurants'
ORDER BY ordinal_position;