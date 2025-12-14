-- 完全修復 buddies_members 表的 RLS 權限問題 (v2)

-- 1. 禁用 RLS
ALTER TABLE buddies_members DISABLE ROW LEVEL SECURITY;

-- 2. 刪除所有現有政策
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

-- 3. 重新啟用 RLS
ALTER TABLE buddies_members ENABLE ROW LEVEL SECURITY;

-- 4. 創建完全開放的政策（適用於所有角色）
CREATE POLICY "buddies_members_select_all"
  ON buddies_members FOR SELECT
  TO public
  USING (true);

CREATE POLICY "buddies_members_insert_all"
  ON buddies_members FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "buddies_members_update_all"
  ON buddies_members FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "buddies_members_delete_all"
  ON buddies_members FOR DELETE
  TO public
  USING (true);

-- 5. 確保權限正確
GRANT ALL ON buddies_members TO anon;
GRANT ALL ON buddies_members TO authenticated;
GRANT ALL ON buddies_members TO service_role;

-- 6. 同時修復 user_profiles 表的 SELECT 權限（用於獲取頭貼）
DO $$
BEGIN
  -- 檢查是否已有 select 政策
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_profiles'
    AND cmd = 'SELECT'
  ) THEN
    CREATE POLICY "user_profiles_select_all"
      ON user_profiles FOR SELECT
      TO public
      USING (true);
    RAISE NOTICE 'Created SELECT policy for user_profiles';
  END IF;
END $$;

GRANT SELECT ON user_profiles TO anon;
GRANT SELECT ON user_profiles TO authenticated;

-- 7. 驗證結果
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('buddies_members', 'user_profiles')
ORDER BY tablename, cmd;

DO $$
BEGIN
  RAISE NOTICE '✅ buddies_members 和 user_profiles 權限已修復';
END $$;
