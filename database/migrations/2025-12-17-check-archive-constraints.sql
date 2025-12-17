-- ==========================================
-- 檢查 buddies_rooms_archive 表的所有約束和索引
-- ==========================================

-- 1. 查看表結構
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'buddies_rooms_archive'
ORDER BY ordinal_position;

-- 2. 查看所有約束（詳細）
SELECT
  conname as constraint_name,
  contype as type,
  CASE contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'c' THEN 'CHECK'
    ELSE 'OTHER'
  END as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'buddies_rooms_archive'::regclass
ORDER BY contype;

-- 3. 查看所有索引
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'buddies_rooms_archive'
ORDER BY indexname;

-- 4. 嘗試插入測試記錄（不會真的插入，只是測試）
-- 先查看現有記錄
SELECT COUNT(*), array_agg(DISTINCT room_code) as room_codes
FROM buddies_rooms_archive
LIMIT 10;
