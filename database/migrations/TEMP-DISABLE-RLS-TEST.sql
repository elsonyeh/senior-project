-- ⚡ 臨時禁用 RLS 以測試 406 錯誤是否與 RLS 有關
-- 警告：這會讓所有人都能訪問數據，僅用於診斷！
-- 測試完成後必須重新啟用 RLS

ALTER TABLE buddies_members DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '⚠️  RLS 已暫時禁用';
  RAISE NOTICE '請立即測試 406 錯誤是否消失';
  RAISE NOTICE '步驟：';
  RAISE NOTICE '1. 刷新瀏覽器（Ctrl+F5）';
  RAISE NOTICE '2. 測試 Buddies 模式';
  RAISE NOTICE '3. 檢查 Console 是否還有 406 錯誤';
  RAISE NOTICE '========================================';
END $$;

-- 測試完成後，運行以下腳本重新啟用 RLS
-- （先不要運行，等測試結果）
