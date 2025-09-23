-- 🔧 修復 restaurants 表的 RLS 插入權限問題
-- 請在 Supabase SQL Editor 中執行此查詢

-- 1. 檢查當前的 RLS 策略
SELECT
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'restaurants';

-- 2. 刪除可能有問題的舊策略
DROP POLICY IF EXISTS "Users can insert restaurants" ON restaurants;
DROP POLICY IF EXISTS "Users can upsert restaurants" ON restaurants;
DROP POLICY IF EXISTS "Allow restaurant upsert" ON restaurants;

-- 3. 創建新的插入策略 - 允許認證用戶插入餐廳資料
CREATE POLICY "Allow authenticated users to insert restaurants"
ON restaurants
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 4. 創建新的更新策略 - 允許認證用戶更新餐廳資料
CREATE POLICY "Allow authenticated users to update restaurants"
ON restaurants
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 5. 確保查看策略存在
CREATE POLICY IF NOT EXISTS "Allow authenticated users to view restaurants"
ON restaurants
FOR SELECT
TO authenticated
USING (true);

-- 6. 檢查策略是否成功創建
SELECT
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename = 'restaurants'
ORDER BY cmd;