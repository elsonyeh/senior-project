-- ==========================================
-- 修復 fun_question_tags_view - 新增 weights 欄位
-- ==========================================
-- 此腳本修復 fun_question_tags_view 缺少 weights 欄位的問題
-- 執行方式：在 Supabase Dashboard 的 SQL Editor 中執行

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
    array_agg(fqot.tag_name ORDER BY fqot.tag_name) FILTER (WHERE fqot.tag_name IS NOT NULL),
    ARRAY[]::text[]
  ) as tags,
  COALESCE(
    array_agg(fqot.weight ORDER BY fqot.tag_name) FILTER (WHERE fqot.weight IS NOT NULL),
    ARRAY[]::numeric[]
  ) as weights
FROM public.question_options qo
INNER JOIN public.questions q ON qo.question_id = q.id
LEFT JOIN public.fun_question_option_tags fqot ON qo.option_text = fqot.option_text
GROUP BY qo.id, qo.option_text, qo.option_value, q.id, q.question_text;

-- 為 view 添加註釋
COMMENT ON VIEW public.fun_question_tags_view IS '趣味問題選項與標籤的映射視圖，包含權重資訊';
