-- ==========================================
-- 檢查 buddies_rooms 表的實際結構
-- ==========================================
-- 在 Supabase SQL Editor 執行此查詢
-- 用於確認現有的時間戳欄位

SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'buddies_rooms'
ORDER BY ordinal_position;

-- 特別檢查時間戳欄位
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'buddies_rooms'
  AND column_name IN ('created_at', 'updated_at', 'last_updated');
