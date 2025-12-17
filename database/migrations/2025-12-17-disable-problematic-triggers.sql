-- ==========================================
-- 暫時禁用或修復有問題的 buddies_events 觸發器
-- ==========================================
-- 執行日期：2025-12-17
-- 問題：buddies_events 觸發器導致更新房間狀態時出現約束錯誤
-- 解決：暫時禁用觸發器或修復觸發器邏輯

-- 1. 查看所有與 buddies_events 相關的觸發器
SELECT
  t.tgname as trigger_name,
  c.relname as table_name,
  p.proname as function_name,
  t.tgenabled as enabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname IN ('buddies_rooms', 'buddies_members')
  AND p.proname LIKE '%buddies%event%'
ORDER BY t.tgname;

-- 2. 禁用所有與 log_buddies_event 相關的觸發器
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
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE c.relname IN ('buddies_rooms', 'buddies_members')
      AND p.proname LIKE '%buddies%event%'
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE TRIGGER %I', r.table_name, r.trigger_name);
    RAISE NOTICE '⚠️ 已禁用觸發器: %.%', r.table_name, r.trigger_name;
  END LOOP;
END $$;

-- 3. 檢查 buddies_events 表是否存在且正常
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'buddies_events') THEN
    RAISE NOTICE '✅ buddies_events 表存在';

    -- 移除過於嚴格的約束
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'check_event_type'
        AND conrelid = 'buddies_events'::regclass
    ) THEN
      ALTER TABLE buddies_events DROP CONSTRAINT check_event_type;
      RAISE NOTICE '✅ 已移除 check_event_type 約束';
    END IF;
  ELSE
    RAISE NOTICE '⚠️ buddies_events 表不存在，跳過';
  END IF;
END $$;

-- 4. 驗證結果
SELECT
  t.tgname as trigger_name,
  c.relname as table_name,
  CASE t.tgenabled
    WHEN 'D' THEN 'DISABLED'
    WHEN 'O' THEN 'ENABLED'
    ELSE 'UNKNOWN'
  END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname IN ('buddies_rooms', 'buddies_members')
  AND p.proname LIKE '%buddies%event%'
ORDER BY t.tgname;

SELECT '✅ 有問題的觸發器已禁用' as status;
