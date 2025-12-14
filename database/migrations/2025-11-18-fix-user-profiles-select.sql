-- 修復 user_profiles 的 SELECT 權限，允許查看其他用戶的頭貼

-- 刪除現有的限制性 SELECT 政策
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;

-- 創建允許所有人查看所有用戶資料的政策
CREATE POLICY "user_profiles_select_all"
  ON user_profiles FOR SELECT
  TO public
  USING (true);

-- 驗證
SELECT
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY cmd;

DO $$
BEGIN
  RAISE NOTICE '✅ user_profiles SELECT 權限已修復，現在可以查看所有用戶的頭貼';
END $$;
