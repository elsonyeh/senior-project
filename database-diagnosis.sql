-- 🔍 SwiftTaste Supabase 數據庫診斷腳本
-- 請在 Supabase SQL Editor 中執行此腳本以診斷問題

-- === 第一步：檢查現有表格 ===
SELECT 
  'Tables' as category,
  table_name as name, 
  table_type as type
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN ('user_profiles', 'user_favorite_lists', 'favorite_list_places', 'swifttaste_history')
ORDER BY table_name;

-- === 第二步：檢查 auth.users 表（Supabase 內建） ===
SELECT 
  'Auth Users' as category,
  count(*) as total_users,
  count(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END) as confirmed_users
FROM auth.users;

-- === 第三步：檢查觸發器 ===
SELECT 
  'Triggers' as category,
  trigger_name as name,
  event_object_table as table_name,
  action_timing || ' ' || string_agg(event_manipulation, ', ') as trigger_info
FROM information_schema.triggers 
WHERE trigger_name IN ('on_auth_user_created', 'on_auth_user_updated')
GROUP BY trigger_name, event_object_table, action_timing
ORDER BY trigger_name;

-- === 第四步：檢查函數 ===
SELECT 
  'Functions' as category,
  routine_name as name,
  routine_type as type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_name IN ('create_user_profile', 'sync_user_profile', 'update_list_places_count', 'update_user_stats')
ORDER BY routine_name;

-- === 第五步：檢查 RLS 政策 ===
SELECT 
  'RLS Policies' as category,
  tablename as table_name,
  policyname as policy_name,
  cmd as command_type,
  permissive as permissive_type
FROM pg_policies 
WHERE tablename IN ('user_profiles', 'user_favorite_lists', 'favorite_list_places', 'swifttaste_history')
ORDER BY tablename, policyname;

-- === 第六步：檢查索引 ===
SELECT 
  'Indexes' as category,
  indexname as name,
  tablename as table_name,
  indexdef as definition
FROM pg_indexes 
WHERE tablename IN ('user_profiles', 'user_favorite_lists', 'favorite_list_places', 'swifttaste_history')
AND schemaname = 'public'
ORDER BY tablename, indexname;

-- === 第七步：檢查外鍵約束 ===
SELECT 
  'Foreign Keys' as category,
  tc.table_name,
  tc.constraint_name as name,
  kcu.column_name as column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name IN ('user_profiles', 'user_favorite_lists', 'favorite_list_places', 'swifttaste_history');

-- === 第八步：測試基本權限 ===
-- 檢查當前用戶是否有創建表的權限
SELECT 
  'Permissions' as category,
  current_user as current_user,
  session_user as session_user,
  has_schema_privilege('public', 'CREATE') as can_create_in_public;

-- === 診斷完成 ===
-- 請將以上所有查詢結果截圖或複製，我將根據結果制定修復方案