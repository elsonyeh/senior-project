-- ==========================================
-- 添加 dislikes 欄位到 buddies_rooms 表
-- ==========================================
-- 用途：記錄用戶左滑（不喜歡）的餐廳
-- 執行日期：2025-12-15

-- 添加 dislikes 欄位（JSONB 格式，結構與 votes 相同）
ALTER TABLE public.buddies_rooms
ADD COLUMN IF NOT EXISTS dislikes JSONB DEFAULT '{}'::jsonb;

-- 為現有房間初始化空物件
UPDATE public.buddies_rooms
SET dislikes = '{}'::jsonb
WHERE dislikes IS NULL;

-- 添加註解說明欄位用途
COMMENT ON COLUMN public.buddies_rooms.dislikes IS '用戶左滑（不喜歡）的餐廳記錄，格式: { restaurantId: { count: 數量, voters: [userId1, userId2] } }';
