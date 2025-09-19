-- 測試 storage 政策的替代方案

-- 清除所有現有政策
DROP POLICY IF EXISTS "Avatar upload policy" ON storage.objects;
DROP POLICY IF EXISTS "Avatar view policy" ON storage.objects;
DROP POLICY IF EXISTS "Avatar update policy" ON storage.objects;
DROP POLICY IF EXISTS "Avatar delete policy" ON storage.objects;

-- 方案一：使用 name 欄位進行簡單匹配
CREATE POLICY "Avatar upload policy v1" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND name LIKE auth.uid()::text || '/%'
  );

-- 查看頭像政策 - 公開可見
CREATE POLICY "Avatar view policy v1" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

-- 更新和刪除政策
CREATE POLICY "Avatar update policy v1" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND name LIKE auth.uid()::text || '/%'
  );

CREATE POLICY "Avatar delete policy v1" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND name LIKE auth.uid()::text || '/%'
  );

-- 驗證政策
SELECT
    policyname,
    permissive,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
AND policyname LIKE '%Avatar%';