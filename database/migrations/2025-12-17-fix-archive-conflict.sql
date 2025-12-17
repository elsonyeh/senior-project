-- ==========================================
-- 修復 buddies_rooms_archive 表的 409 Conflict 錯誤
-- ==========================================
-- 執行日期：2025-12-17
-- 問題：409 Conflict - 插入歸檔記錄時發生衝突
-- 解決：檢查並修復唯一約束或主鍵衝突

-- 1. 檢查 buddies_rooms_archive 表結構
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'buddies_rooms_archive'
ORDER BY ordinal_position;

-- 2. 查看所有約束
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'buddies_rooms_archive'::regclass;

-- 3. 查看索引
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'buddies_rooms_archive';

-- 4. 檢查是否有重複的 room_code
SELECT
  room_code,
  COUNT(*) as count
FROM buddies_rooms_archive
GROUP BY room_code
HAVING COUNT(*) > 1;

-- 5. 如果 room_code 是唯一約束或主鍵，可能需要改為允許重複
-- 或者使用 UPSERT（ON CONFLICT DO UPDATE）策略
-- 這裡我們先查看是否需要移除唯一約束

-- 檢查是否有 room_code 的唯一約束
DO $$
DECLARE
  constraint_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'buddies_rooms_archive'::regclass
      AND contype = 'u'  -- unique constraint
      AND pg_get_constraintdef(oid) LIKE '%room_code%'
  ) INTO constraint_exists;

  IF constraint_exists THEN
    RAISE NOTICE '⚠️ 找到 room_code 唯一約束';
    -- 如果需要，可以移除唯一約束
    -- ALTER TABLE buddies_rooms_archive DROP CONSTRAINT constraint_name;
  ELSE
    RAISE NOTICE '✅ 沒有 room_code 唯一約束';
  END IF;
END $$;

-- 6. 建議的解決方案：
-- 如果應用層需要多次歸檔同一個房間（例如每次完成都歸檔），
-- 則應該移除 room_code 的唯一約束，或者使用組合鍵（room_code + archived_at）

-- 方案 A：移除 room_code 唯一約束（如果存在）
-- 取消註釋以執行：
-- DO $$
-- DECLARE
--   r RECORD;
-- BEGIN
--   FOR r IN
--     SELECT conname
--     FROM pg_constraint
--     WHERE conrelid = 'buddies_rooms_archive'::regclass
--       AND contype = 'u'
--       AND pg_get_constraintdef(oid) LIKE '%room_code%'
--   LOOP
--     EXECUTE format('ALTER TABLE buddies_rooms_archive DROP CONSTRAINT %I', r.conname);
--     RAISE NOTICE '✅ 已移除約束: %', r.conname;
--   END LOOP;
-- END $$;

-- 方案 B：添加 archived_at 時間戳（如果不存在）使記錄唯一
-- 檢查是否有 archived_at 欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'buddies_rooms_archive'
      AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE buddies_rooms_archive
    ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    RAISE NOTICE '✅ 已添加 archived_at 欄位';
  ELSE
    RAISE NOTICE 'ℹ️ archived_at 欄位已存在';
  END IF;
END $$;

-- 7. 如果表有自增 ID 主鍵，確保它存在
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'buddies_rooms_archive'
      AND column_name = 'id'
  ) THEN
    -- 如果沒有 id 欄位，添加一個
    ALTER TABLE buddies_rooms_archive
    ADD COLUMN id SERIAL PRIMARY KEY;
    RAISE NOTICE '✅ 已添加 id 主鍵';
  ELSE
    RAISE NOTICE 'ℹ️ id 欄位已存在';
  END IF;
END $$;

SELECT '✅ buddies_rooms_archive 衝突問題已檢查，請根據需要執行方案 A 或 B' as status;
