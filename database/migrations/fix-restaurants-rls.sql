-- ==========================================
-- 修復 restaurants 表的 RLS 政策
-- ==========================================
-- 允許公開讀取，但只有管理員可以修改/刪除

-- 1. 確保 RLS 已啟用
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- 2. 刪除舊的政策（如果存在）
DROP POLICY IF EXISTS "Allow public read access to restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Allow admins to insert restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Allow admins to update restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Allow admins to delete restaurants" ON public.restaurants;

-- 3. 建立新的 RLS 政策

-- 允許所有人讀取活躍的餐廳
CREATE POLICY "Allow public read access to restaurants"
ON public.restaurants
FOR SELECT
TO public
USING (true);

-- 只允許管理員新增餐廳
CREATE POLICY "Allow admins to insert restaurants"
ON public.restaurants
FOR INSERT
TO public
WITH CHECK (public.is_admin());

-- 只允許管理員更新餐廳
CREATE POLICY "Allow admins to update restaurants"
ON public.restaurants
FOR UPDATE
TO public
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 只允許管理員刪除餐廳（軟刪除：更新 is_active）
CREATE POLICY "Allow admins to delete restaurants"
ON public.restaurants
FOR DELETE
TO public
USING (public.is_admin());

-- 4. 驗證政策
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'restaurants'
ORDER BY policyname;

COMMENT ON TABLE public.restaurants IS '餐廳資料表 - 公開讀取，管理員可編輯';
