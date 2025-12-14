-- 驗證 UUID 遷移是否成功

-- 1. 檢查所有相關欄位的類型
SELECT
  'buddies_rooms.host_id' as column_path,
  data_type
FROM information_schema.columns
WHERE table_name = 'buddies_rooms' AND column_name = 'host_id'

UNION ALL

SELECT
  'buddies_members.user_id' as column_path,
  data_type
FROM information_schema.columns
WHERE table_name = 'buddies_members' AND column_name = 'user_id'

UNION ALL

SELECT
  'buddies_events.user_id' as column_path,
  data_type
FROM information_schema.columns
WHERE table_name = 'buddies_events' AND column_name = 'user_id';

-- 2. 檢查 log_buddies_event 函數簽名
SELECT
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname = 'log_buddies_event';

-- 3. 檢查觸發器是否存在
SELECT
  trigger_name,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name IN (
  'trigger_room_created_event',
  'trigger_room_status_change_event',
  'trigger_member_joined_event'
);
