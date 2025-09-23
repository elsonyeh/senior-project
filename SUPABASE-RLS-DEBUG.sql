-- 🔍 檢查 Supabase RLS 策略和權限問題
-- 請在 Supabase SQL Editor 中執行此查詢

-- 1. 檢查 restaurants 表的 RLS 設定
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    tableowner
FROM pg_tables
WHERE tablename = 'restaurants';

-- 2. 檢查 restaurants 表的 RLS 策略
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'restaurants';

-- 3. 測試直接更新（繞過 RLS）
-- 注意：這只是測試，請小心使用
UPDATE restaurants
SET user_ratings_total = 1621,
    rating_updated_at = NOW()
WHERE id = 'a9e3a372-c990-4273-a8e8-e0ed8ef1f629';

-- 4. 檢查更新結果
SELECT
    id,
    name,
    rating,
    user_ratings_total,
    rating_updated_at
FROM restaurants
WHERE id = 'a9e3a372-c990-4273-a8e8-e0ed8ef1f629';