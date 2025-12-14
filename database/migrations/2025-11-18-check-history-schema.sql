-- 檢查 user_selection_history 表現有結構
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_selection_history'
ORDER BY ordinal_position;
