-- ==========================================
-- 為 buddies_rooms 添加 updated_at 欄位（可選）
-- ==========================================
-- 目的：支援 updated_at 時間戳追蹤
-- 執行時機：可選（不影響核心功能）
-- ==========================================

-- 添加 updated_at 欄位
ALTER TABLE buddies_rooms
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 添加註釋
COMMENT ON COLUMN buddies_rooms.updated_at IS '最後更新時間';

-- 創建觸發器自動更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_buddies_rooms_updated_at ON buddies_rooms;

CREATE TRIGGER update_buddies_rooms_updated_at
    BEFORE UPDATE ON buddies_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 驗證
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'buddies_rooms'
AND column_name = 'updated_at';

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '✅ updated_at 欄位已添加';
  RAISE NOTICE '✅ 自動更新觸發器已創建';
END $$;
