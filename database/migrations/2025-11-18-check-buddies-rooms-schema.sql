-- 檢查 buddies_rooms 表結構
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'buddies_rooms'
ORDER BY ordinal_position;
