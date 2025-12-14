-- 完整修復 buddies_members 表的權限問題

-- 1. 檢查表是否存在
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'buddies_members'
);

-- 2. 禁用 RLS（暫時）
ALTER TABLE buddies_members DISABLE ROW LEVEL SECURITY;

-- 3. 刪除所有現有政策
DO $$
DECLARE
  policy_name TEXT;
BEGIN
  FOR policy_name IN
    SELECT policyname FROM pg_policies WHERE tablename = 'buddies_members'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON buddies_members', policy_name);
    RAISE NOTICE 'Dropped policy: %', policy_name;
  END LOOP;
END $$;

-- 4. 重新啟用 RLS
ALTER TABLE buddies_members ENABLE ROW LEVEL SECURITY;

-- 5. 創建簡單的允許所有操作的政策
CREATE POLICY "Allow all select on buddies_members"
  ON buddies_members FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow all insert on buddies_members"
  ON buddies_members FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow all update on buddies_members"
  ON buddies_members FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all delete on buddies_members"
  ON buddies_members FOR DELETE
  TO anon, authenticated
  USING (true);

-- 6. 確保權限正確
GRANT ALL ON buddies_members TO anon;
GRANT ALL ON buddies_members TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 7. 驗證
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'buddies_members';

DO $$
BEGIN
  RAISE NOTICE '✅ buddies_members 權限已完全重置';
END $$;
