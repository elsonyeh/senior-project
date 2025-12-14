-- 為 user_selection_history 添加 Buddies 專用欄位

-- 添加 room_id 欄位
ALTER TABLE user_selection_history
ADD COLUMN IF NOT EXISTS room_id text;

-- 添加 room_members 欄位
ALTER TABLE user_selection_history
ADD COLUMN IF NOT EXISTS room_members jsonb;

-- 添加 is_host 欄位
ALTER TABLE user_selection_history
ADD COLUMN IF NOT EXISTS is_host boolean DEFAULT false;

-- 添加 participant_count 欄位
ALTER TABLE user_selection_history
ADD COLUMN IF NOT EXISTS participant_count integer;

-- 驗證
DO $$
BEGIN
  RAISE NOTICE '✅ Buddies 專用欄位已添加到 user_selection_history';
END $$;
