-- 檢查存儲桶配置的調試腳本

-- 1. 檢查 avatars bucket 是否存在
SELECT
    id,
    name,
    public,
    created_at,
    updated_at
FROM storage.buckets
WHERE id = 'avatars';

-- 2. 檢查 storage.objects 表的 RLS 狀態
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'storage' AND tablename = 'objects';

-- 3. 查看所有存儲政策
SELECT
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';

-- 4. 檢查當前用戶權限
SELECT
    auth.uid() as current_user_id,
    auth.jwt() as current_jwt;

-- 5. 測試 bucket 存取權限
SELECT
    COUNT(*) as total_files
FROM storage.objects
WHERE bucket_id = 'avatars';