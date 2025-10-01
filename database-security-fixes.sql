-- ==========================================
-- SwiftTaste 資料庫安全性修復腳本
-- ==========================================
-- 此腳本修復 Supabase Linter 檢測到的安全性問題
-- 執行方式：在 Supabase Dashboard 的 SQL Editor 中執行

-- ==========================================
-- 0. 創建管理員檢查函數
-- ==========================================
-- 此函數檢查當前用戶是否為活躍的管理員

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
  is_active_admin boolean;
BEGIN
  -- 獲取當前用戶的 email（從 auth.users 或 session）
  -- 注意：這裡假設使用 Supabase Auth
  user_email := current_setting('request.jwt.claims', true)::json->>'email';

  -- 如果沒有 email，返回 false
  IF user_email IS NULL THEN
    RETURN false;
  END IF;

  -- 檢查是否為活躍的管理員
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE email = user_email
    AND is_active = true
  ) INTO is_active_admin;

  RETURN is_active_admin;
EXCEPTION
  WHEN OTHERS THEN
    -- 如果發生任何錯誤，返回 false（安全優先）
    RETURN false;
END;
$$;

-- 為函數添加註釋
COMMENT ON FUNCTION public.is_admin() IS '檢查當前用戶是否為活躍的管理員（從 admin_users 表查詢）';

-- ==========================================
-- 1. 修復 SECURITY DEFINER Views
-- ==========================================
-- 將 SECURITY DEFINER 改為 SECURITY INVOKER
-- 這樣 view 會使用查詢用戶的權限，而不是 view 創建者的權限

-- 重新創建 questions_with_options view
DROP VIEW IF EXISTS public.questions_with_options;
CREATE OR REPLACE VIEW public.questions_with_options
WITH (security_invoker = true)
AS
SELECT
  q.id,
  q.question_text,
  q.question_type_id,
  q.mode,
  q.display_order,
  q.depends_on_question_id,
  q.depends_on_answer,
  q.is_active,
  q.created_at,
  q.updated_at,
  COALESCE(
    json_agg(
      json_build_object(
        'id', qo.id,
        'option_text', qo.option_text,
        'option_value', qo.option_value,
        'display_order', qo.display_order
      ) ORDER BY qo.display_order
    ) FILTER (WHERE qo.id IS NOT NULL),
    '[]'::json
  ) AS options
FROM public.questions q
LEFT JOIN public.question_options qo ON q.id = qo.question_id
GROUP BY q.id;

-- 重新創建 place_cache_stats view
DROP VIEW IF EXISTS public.place_cache_stats;
CREATE OR REPLACE VIEW public.place_cache_stats
WITH (security_invoker = true)
AS
SELECT
  COUNT(*) as total_cached,
  COUNT(*) FILTER (WHERE cached_at > NOW() - INTERVAL '7 days') as cached_last_7_days,
  COUNT(*) FILTER (WHERE cached_at > NOW() - INTERVAL '30 days') as cached_last_30_days,
  MAX(cached_at) as last_cache_time
FROM public.google_places_cache;

-- 重新創建 fun_question_tags_view view
DROP VIEW IF EXISTS public.fun_question_tags_view;
CREATE OR REPLACE VIEW public.fun_question_tags_view
WITH (security_invoker = true)
AS
SELECT
  qo.id as option_id,
  qo.option_text,
  qo.option_value,
  q.id as question_id,
  q.question_text,
  COALESCE(
    array_agg(fqot.tag_name) FILTER (WHERE fqot.tag_name IS NOT NULL),
    ARRAY[]::text[]
  ) as tags
FROM public.question_options qo
INNER JOIN public.questions q ON qo.question_id = q.id
LEFT JOIN public.fun_question_option_tags fqot ON qo.option_text = fqot.option_text
GROUP BY qo.id, qo.option_text, qo.option_value, q.id, q.question_text;

-- ==========================================
-- 2. 為 Questions 相關表啟用 RLS
-- ==========================================
-- 這些表包含問題數據，應該允許所有人讀取，但只有管理員可以寫入

-- questions 表
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- 允許所有人讀取問題
CREATE POLICY "Allow public read access to questions"
ON public.questions
FOR SELECT
TO public
USING (true);

-- 只有管理員可以插入/更新/刪除
CREATE POLICY "Allow admins to manage questions"
ON public.questions
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- question_types 表
ALTER TABLE public.question_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to question_types"
ON public.question_types
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow admins to manage question_types"
ON public.question_types
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- question_options 表
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to question_options"
ON public.question_options
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow admins to manage question_options"
ON public.question_options
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- fun_question_option_tags 表
ALTER TABLE public.fun_question_option_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to fun_question_option_tags"
ON public.fun_question_option_tags
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow admins to manage fun_question_option_tags"
ON public.fun_question_option_tags
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ==========================================
-- 3. 為 Google Places Cache 相關表啟用 RLS
-- ==========================================
-- 這些表是快取數據，只有管理員可以讀寫

-- google_places_cache 表
ALTER TABLE public.google_places_cache ENABLE ROW LEVEL SECURITY;

-- 允許管理員讀取快取
CREATE POLICY "Allow admins read access to google_places_cache"
ON public.google_places_cache
FOR SELECT
TO authenticated
USING (public.is_admin());

-- 允許管理員寫入快取
CREATE POLICY "Allow admins write access to google_places_cache"
ON public.google_places_cache
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- place_search_regions 表
ALTER TABLE public.place_search_regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admins read access to place_search_regions"
ON public.place_search_regions
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Allow admins write access to place_search_regions"
ON public.place_search_regions
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ==========================================
-- 執行完成提示
-- ==========================================
-- 執行此腳本後，請在 Supabase Dashboard 重新運行 Database Linter
-- 確認所有安全性警告已解決

-- ==========================================
-- 權限控制摘要
-- ==========================================
-- 1. Questions 相關表（questions, question_types, question_options, fun_question_option_tags）
--    - 所有人可讀取（公開訪問）
--    - 只有 admin_users 表中活躍的管理員可以寫入
--
-- 2. Google Places Cache 相關表（google_places_cache, place_search_regions）
--    - 只有 admin_users 表中活躍的管理員可以讀寫
--
-- 3. Views (questions_with_options, place_cache_stats, fun_question_tags_view)
--    - 使用 SECURITY INVOKER 模式，以查詢用戶的權限執行
--    - 繼承底層表的 RLS 政策
--
-- ==========================================
-- 重要提醒
-- ==========================================
-- 此腳本假設您的應用使用 Supabase Auth，且管理員的 email 會包含在 JWT token 中
-- 如果您使用不同的認證方式，可能需要修改 is_admin() 函數的實現
--
-- 測試建議：
-- 1. 使用管理員帳號登入後測試 CRUD 操作
-- 2. 使用非管理員帳號測試只讀操作
-- 3. 使用未認證狀態測試公開讀取
