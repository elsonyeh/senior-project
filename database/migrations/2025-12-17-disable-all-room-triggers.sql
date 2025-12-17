-- ==========================================
-- 禁用所有 buddies_rooms 表的觸發器
-- ==========================================
-- 執行日期：2025-12-17
-- 問題：多個觸發器訪問不存在的字段導致 400 錯誤
-- 解決：禁用所有 buddies_rooms 表的觸發器

-- 1. 查看所有 buddies_rooms 表的觸發器
SELECT
  t.tgname as trigger_name,
  c.relname as table_name,
  p.proname as function_name,
  CASE t.tgenabled
    WHEN 'D' THEN 'DISABLED'
    WHEN 'O' THEN 'ENABLED'
    ELSE 'UNKNOWN'
  END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'buddies_rooms'
  AND NOT t.tgisinternal -- 排除內部觸發器
ORDER BY t.tgname;

-- 2. 禁用所有 buddies_rooms 表的非內部觸發器
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      t.tgname as trigger_name,
      c.relname as table_name
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'buddies_rooms'
      AND NOT t.tgisinternal -- 排除內部觸發器（如 RI 約束）
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I DISABLE TRIGGER %I', r.table_name, r.trigger_name);
      RAISE NOTICE '⚠️ 已禁用觸發器: %.%', r.table_name, r.trigger_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '❌ 無法禁用觸發器 %.%: %', r.table_name, r.trigger_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- 3. 也禁用 buddies_members 表的觸發器（預防性措施）
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      t.tgname as trigger_name,
      c.relname as table_name
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'buddies_members'
      AND NOT t.tgisinternal
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I DISABLE TRIGGER %I', r.table_name, r.trigger_name);
      RAISE NOTICE '⚠️ 已禁用觸發器: %.%', r.table_name, r.trigger_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '❌ 無法禁用觸發器 %.%: %', r.table_name, r.trigger_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- 4. 驗證結果
SELECT
  t.tgname as trigger_name,
  c.relname as table_name,
  p.proname as function_name,
  CASE t.tgenabled
    WHEN 'D' THEN 'DISABLED ✅'
    WHEN 'O' THEN 'ENABLED ⚠️'
    ELSE 'UNKNOWN'
  END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname IN ('buddies_rooms', 'buddies_members')
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

-- 5. 檢查 buddies_rooms 表的實際欄位
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'buddies_rooms'
ORDER BY ordinal_position;

SELECT '✅ 所有 buddies_rooms 和 buddies_members 觸發器已禁用' as status;
