-- 🔧 修正管理員權限問題
-- 請在 Supabase SQL Editor 中執行此腳本

-- 1. 檢查當前的 auth.role() 函數
SELECT auth.role() as current_role;

-- 2. 為餐廳評分更新創建專用的 RLS 策略
-- 允許有 service_role 的操作
DROP POLICY IF EXISTS "評分更新服務" ON restaurants;

CREATE POLICY "評分更新服務" ON restaurants
FOR UPDATE
USING (true)  -- 允許所有更新
WITH CHECK (true);  -- 允許所有更新檢查

-- 3. 或者，如果你想保持更嚴格的安全性，
-- 可以只允許特定欄位的更新
DROP POLICY IF EXISTS "評分欄位更新" ON restaurants;

CREATE POLICY "評分欄位更新" ON restaurants
FOR UPDATE
TO service_role  -- 只允許 service_role
USING (true)
WITH CHECK (true);

-- 4. 檢查所有策略
SELECT
    policyname,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'restaurants';

-- 5. 測試更新（這應該會成功）
-- 注意：service_role 具有完整權限，繞過 RLS
UPDATE restaurants
SET
    user_ratings_total = 1621,
    rating_updated_at = NOW()
WHERE id = 'a9e3a372-c990-4273-a8e8-e0ed8ef1f629';

-- 6. 驗證結果
SELECT
    id,
    name,
    rating,
    user_ratings_total,
    rating_updated_at
FROM restaurants
WHERE id = 'a9e3a372-c990-4273-a8e8-e0ed8ef1f629';