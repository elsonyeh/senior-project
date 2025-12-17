-- ==========================================
-- 最終修復：移除 buddies_rooms_archive 的唯一約束
-- ==========================================
-- 執行日期：2025-12-17
-- 問題：409 Conflict - room_code 唯一約束導致無法重複歸檔
-- 解決：移除唯一約束，允許同一房間多次歸檔

-- 1. 移除 room_code 的唯一約束（如果存在）
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'buddies_rooms_archive'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%room_code%'
  LOOP
    EXECUTE format('ALTER TABLE buddies_rooms_archive DROP CONSTRAINT %I', r.conname);
    RAISE NOTICE '✅ 已移除約束: %', r.conname;
  END LOOP;

  -- 如果沒有找到約束
  IF NOT FOUND THEN
    RAISE NOTICE 'ℹ️ 沒有找到 room_code 唯一約束（可能已經移除）';
  END IF;
END $$;

-- 2. 移除 room_code 的主鍵約束（如果存在）
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'buddies_rooms_archive'::regclass
      AND contype = 'p'  -- primary key
      AND pg_get_constraintdef(oid) LIKE '%room_code%'
  LOOP
    EXECUTE format('ALTER TABLE buddies_rooms_archive DROP CONSTRAINT %I', r.conname);
    RAISE NOTICE '✅ 已移除主鍵約束: %', r.conname;
  END LOOP;
END $$;

-- 3. 確保有 id 自增主鍵
DO $$
BEGIN
  -- 檢查是否已有 id 欄位
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'buddies_rooms_archive'
      AND column_name = 'id'
  ) THEN
    RAISE NOTICE 'ℹ️ id 欄位已存在';

    -- 確保 id 是主鍵
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'buddies_rooms_archive'::regclass
        AND contype = 'p'
        AND pg_get_constraintdef(oid) LIKE '%id%'
    ) THEN
      ALTER TABLE buddies_rooms_archive ADD PRIMARY KEY (id);
      RAISE NOTICE '✅ 已將 id 設為主鍵';
    END IF;
  ELSE
    -- 添加 id 欄位並設為主鍵
    ALTER TABLE buddies_rooms_archive ADD COLUMN id SERIAL PRIMARY KEY;
    RAISE NOTICE '✅ 已添加 id 自增主鍵';
  END IF;
END $$;

-- 4. 確保有 archived_at 時間戳
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

-- 5. 驗證結果
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'buddies_rooms_archive'::regclass;

SELECT '✅ buddies_rooms_archive 已修復，現在可以重複歸檔同一房間' as status;
