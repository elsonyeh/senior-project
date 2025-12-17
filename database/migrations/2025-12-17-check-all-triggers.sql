-- 檢查所有 buddies_rooms 表相關的觸發器

-- 1. 查看所有觸發器
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'buddies_rooms'
ORDER BY trigger_name;

-- 2. 查看觸發器函數的完整定義
SELECT
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname LIKE '%buddies%' OR proname LIKE '%room%'
ORDER BY proname;

-- 3. 檢查 buddies_rooms 表的所有欄位
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'buddies_rooms'
ORDER BY ordinal_position;
