-- 確保匿名用戶可以查詢 user_profiles 表

-- 授予 anon 角色 SELECT 權限
GRANT SELECT ON user_profiles TO anon;
GRANT USAGE ON SCHEMA public TO anon;

-- 驗證權限
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'user_profiles'
AND privilege_type = 'SELECT'
ORDER BY grantee;

DO $$
BEGIN
  RAISE NOTICE '✅ anon 角色已獲得 user_profiles 的 SELECT 權限';
END $$;
