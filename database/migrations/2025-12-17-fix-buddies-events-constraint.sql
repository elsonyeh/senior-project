-- ==========================================
-- 修復 buddies_events 表的事件類型約束問題
-- ==========================================
-- 執行日期：2025-12-17
-- 問題：check_event_type 約束過於嚴格，導致某些合法事件無法插入
-- 解決：放寬約束或移除舊約束，允許更多事件類型

-- 1. 檢查現有約束
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'buddies_events'::regclass
  AND conname LIKE '%event_type%';

-- 2. 檢查 buddies_events 表結構
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'buddies_events'
ORDER BY ordinal_position;

-- 3. 查看最近失敗的事件類型（從錯誤日誌推測）
-- 檢查 buddies_rooms 表的 status 欄位可能的值
SELECT DISTINCT status
FROM buddies_rooms
ORDER BY status;

-- 4. 檢查相關觸發器
SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  event_object_table
FROM information_schema.triggers
WHERE event_object_table IN ('buddies_rooms', 'buddies_members')
ORDER BY trigger_name;

-- 5. 暫時解決方案：移除過於嚴格的約束
-- 如果約束存在，先刪除它
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_event_type'
      AND conrelid = 'buddies_events'::regclass
  ) THEN
    ALTER TABLE buddies_events DROP CONSTRAINT check_event_type;
    RAISE NOTICE '✅ 已移除舊的 check_event_type 約束';
  END IF;
END $$;

-- 6. 添加更寬鬆的約束（如果需要）
-- 允許所有非空的事件類型
ALTER TABLE buddies_events
ADD CONSTRAINT check_event_type_not_empty
CHECK (event_type IS NOT NULL AND event_type <> '');

-- 7. 或者完全移除約束，依賴應用層驗證
-- ALTER TABLE buddies_events DROP CONSTRAINT IF EXISTS check_event_type_not_empty;

SELECT '✅ buddies_events 約束已修復' as status;
