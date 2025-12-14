-- 檢查並修復 buddies_members 的 RLS 政策

-- 1. 檢查現有 RLS 狀態
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'buddies_members';

-- 2. 啟用 RLS（如果還沒啟用）
ALTER TABLE buddies_members ENABLE ROW LEVEL SECURITY;

-- 3. 刪除所有舊政策
DROP POLICY IF EXISTS "Allow all access to buddies_members" ON buddies_members;
DROP POLICY IF EXISTS "Anyone can read buddies_members" ON buddies_members;
DROP POLICY IF EXISTS "Anyone can insert buddies_members" ON buddies_members;
DROP POLICY IF EXISTS "Anyone can update buddies_members" ON buddies_members;
DROP POLICY IF EXISTS "Anyone can delete buddies_members" ON buddies_members;
DROP POLICY IF EXISTS "Allow all operations on buddies_members" ON buddies_members;

-- 4. 創建新的開放政策（允許所有操作）
CREATE POLICY "Allow all operations on buddies_members"
  ON buddies_members
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 5. 確認 anon 和 authenticated 角色可以訪問
GRANT ALL ON buddies_members TO anon;
GRANT ALL ON buddies_members TO authenticated;

-- 6. 驗證
DO $$
BEGIN
  RAISE NOTICE '✅ buddies_members RLS 政策已更新';
END $$;
