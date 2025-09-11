-- 檢查資料庫架構是否正確設定
-- 在 Supabase SQL Editor 中執行此查詢來診斷問題

-- 1. 檢查 user_profiles 表是否存在
SELECT 
  table_name, 
  table_type 
FROM information_schema.tables 
WHERE table_name = 'user_profiles';

-- 2. 檢查 user_profiles 表結構
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- 3. 檢查觸發器是否存在
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_timing
FROM information_schema.triggers 
WHERE trigger_name IN ('on_auth_user_created', 'on_auth_user_updated');

-- 4. 檢查函數是否存在
SELECT 
  routine_name, 
  routine_type
FROM information_schema.routines 
WHERE routine_name IN ('create_user_profile', 'sync_user_profile');

-- 5. 檢查 RLS 政策
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'user_profiles';