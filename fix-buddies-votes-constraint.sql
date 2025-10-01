-- ==========================================
-- 修復 buddies_votes 約束
-- ==========================================
-- 允許同一用戶在同一房間為不同餐廳投票

-- 檢查當前約束狀態
DO $$
BEGIN
  -- 1. 刪除舊的兩欄約束（如果存在）
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'buddies_votes_room_id_user_id_key'
    AND conrelid = 'public.buddies_votes'::regclass
  ) THEN
    ALTER TABLE public.buddies_votes
    DROP CONSTRAINT buddies_votes_room_id_user_id_key;
    RAISE NOTICE '✅ 已刪除舊約束 buddies_votes_room_id_user_id_key';
  END IF;

  -- 2. 檢查新約束是否存在
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'buddies_votes_room_user_restaurant_unique'
    AND conrelid = 'public.buddies_votes'::regclass
  ) THEN
    ALTER TABLE public.buddies_votes
    ADD CONSTRAINT buddies_votes_room_user_restaurant_unique
    UNIQUE (room_id, user_id, restaurant_id);
    RAISE NOTICE '✅ 已創建新約束 buddies_votes_room_user_restaurant_unique';
  ELSE
    RAISE NOTICE 'ℹ️  約束 buddies_votes_room_user_restaurant_unique 已存在，無需創建';
  END IF;
END $$;

-- 3. 為性能優化添加索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_buddies_votes_room_user
ON public.buddies_votes(room_id, user_id);

CREATE INDEX IF NOT EXISTS idx_buddies_votes_room_restaurant
ON public.buddies_votes(room_id, restaurant_id);

-- 顯示最終結果
SELECT
  '✅ 修復完成' AS status,
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.buddies_votes'::regclass
  AND contype = 'u'
ORDER BY conname;
