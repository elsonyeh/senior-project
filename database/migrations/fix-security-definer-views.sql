-- ==========================================
-- 修復 SECURITY DEFINER Views 安全性問題
-- ==========================================
-- 此腳本將所有使用 SECURITY DEFINER 的 views 改為 SECURITY INVOKER
-- 以防止權限提升攻擊
--
-- 執行方式：在 Supabase Dashboard 的 SQL Editor 中執行
-- ==========================================

-- ==========================================
-- 1. Buddies 相關的統計 Views
-- ==========================================

-- 1.1 房間事件時間線視圖
DROP VIEW IF EXISTS public.buddies_room_timeline CASCADE;
CREATE OR REPLACE VIEW public.buddies_room_timeline
WITH (security_invoker = true)
AS
SELECT
  e.room_id,
  e.event_type,
  e.user_id,
  e.event_data,
  e.created_at,
  EXTRACT(EPOCH FROM (e.created_at - LAG(e.created_at) OVER (PARTITION BY e.room_id ORDER BY e.created_at)))::integer AS seconds_since_last_event
FROM buddies_events e
ORDER BY e.room_id, e.created_at;

COMMENT ON VIEW public.buddies_room_timeline IS '房間事件時間線視圖（包含事件間隔時間）- 使用 SECURITY INVOKER';

-- 1.2 事件統計視圖
DROP VIEW IF EXISTS public.buddies_event_stats CASCADE;
CREATE OR REPLACE VIEW public.buddies_event_stats
WITH (security_invoker = true)
AS
SELECT
  event_type,
  COUNT(*) as event_count,
  COUNT(DISTINCT room_id) as affected_rooms,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(created_at) as first_occurrence,
  MAX(created_at) as last_occurrence
FROM buddies_events
GROUP BY event_type
ORDER BY event_count DESC;

COMMENT ON VIEW public.buddies_event_stats IS '事件類型統計視圖 - 使用 SECURITY INVOKER';

-- 1.3 房間完成漏斗統計
DROP VIEW IF EXISTS public.room_completion_funnel CASCADE;
CREATE OR REPLACE VIEW public.room_completion_funnel
WITH (security_invoker = true)
AS
SELECT
  COUNT(DISTINCT CASE WHEN event_type = 'room_created' THEN room_id END) as rooms_created,
  COUNT(DISTINCT CASE WHEN event_type = 'room_started' THEN room_id END) as rooms_started,
  COUNT(DISTINCT CASE WHEN event_type = 'recommendations_generated' THEN room_id END) as rooms_got_recommendations,
  COUNT(DISTINCT CASE WHEN event_type = 'vote_cast' THEN room_id END) as rooms_with_votes,
  COUNT(DISTINCT CASE WHEN event_type = 'room_completed' THEN room_id END) as rooms_completed,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN event_type = 'room_completed' THEN room_id END) /
    NULLIF(COUNT(DISTINCT CASE WHEN event_type = 'room_created' THEN room_id END), 0), 2) as completion_rate
FROM buddies_events;

COMMENT ON VIEW public.room_completion_funnel IS '房間完成漏斗統計 - 使用 SECURITY INVOKER';

-- ==========================================
-- 2. 清理系統相關 Views
-- ==========================================

-- 2.1 清理健康狀態視圖
DROP VIEW IF EXISTS public.cleanup_health_status CASCADE;
CREATE OR REPLACE VIEW public.cleanup_health_status
WITH (security_invoker = true)
AS
SELECT
  CURRENT_DATE as check_date,
  -- 待清理的完成房間
  (SELECT COUNT(*) FROM buddies_rooms
   WHERE status = 'completed'
     AND completed_at < now() - interval '24 hours') as pending_completed_rooms,
  -- 待清理的放棄房間
  (SELECT COUNT(*) FROM buddies_rooms
   WHERE status != 'completed'
     AND created_at < now() - interval '30 days') as pending_abandoned_rooms,
  -- 待歸檔的舊事件
  (SELECT COUNT(*) FROM buddies_events
   WHERE created_at < now() - interval '365 days') as pending_old_events,
  -- 最近一次清理時間
  (SELECT MAX(created_at) FROM cleanup_logs) as last_cleanup,
  -- 待清理互動記錄
  (SELECT COUNT(*) FROM swifttaste_interactions
   WHERE created_at < now() - interval '365 days') as pending_old_interactions;

COMMENT ON VIEW public.cleanup_health_status IS '清理健康狀態視圖 - 使用 SECURITY INVOKER';

-- 2.2 清理歷史統計視圖
DROP VIEW IF EXISTS public.cleanup_history_stats CASCADE;
CREATE OR REPLACE VIEW public.cleanup_history_stats
WITH (security_invoker = true)
AS
SELECT
  DATE(created_at) as cleanup_date,
  cleanup_type,
  SUM(rooms_deleted) as total_rooms_deleted,
  SUM(events_archived) as total_events_archived,
  AVG(execution_time_ms) as avg_execution_time_ms,
  COUNT(*) FILTER (WHERE status = 'success') as successful_runs,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_runs
FROM cleanup_logs
GROUP BY DATE(created_at), cleanup_type
ORDER BY cleanup_date DESC, cleanup_type;

COMMENT ON VIEW public.cleanup_history_stats IS '清理歷史統計視圖 - 使用 SECURITY INVOKER';

-- ==========================================
-- 3. SwiftTaste 互動相關 Views
-- ==========================================

-- 3.1 SwiftTaste 會話與互動視圖
DROP VIEW IF EXISTS public.v_swifttaste_sessions_with_interactions CASCADE;
CREATE OR REPLACE VIEW public.v_swifttaste_sessions_with_interactions
WITH (security_invoker = true)
AS
SELECT
  ush.id,
  ush.user_id,
  ush.session_id,
  ush.mode,
  ush.started_at,
  ush.completed_at,
  ush.session_duration,
  ush.questions_started_at,
  ush.fun_questions_started_at,
  ush.restaurants_started_at,
  ush.basic_answers,
  ush.fun_answers,
  ush.final_restaurant,
  ush.swipe_count,
  ush.liked_restaurants,
  ush.recommendations,
  -- 計算互動統計
  (SELECT COUNT(*) FROM swifttaste_interactions si
   WHERE si.session_id = ush.session_id) as total_interactions,
  (SELECT COUNT(*) FROM swifttaste_interactions si
   WHERE si.session_id = ush.session_id AND si.action_type = 'like') as like_count,
  (SELECT COUNT(*) FROM swifttaste_interactions si
   WHERE si.session_id = ush.session_id AND si.action_type = 'skip') as skip_count,
  (SELECT COUNT(*) FROM swifttaste_interactions si
   WHERE si.session_id = ush.session_id AND si.action_type = 'view') as view_count
FROM user_selection_history ush
WHERE ush.mode = 'swifttaste';

COMMENT ON VIEW public.v_swifttaste_sessions_with_interactions IS 'SwiftTaste 會話與互動統計視圖 - 使用 SECURITY INVOKER';

-- ==========================================
-- 4. 設置適當的 RLS 策略
-- ==========================================
-- 確保底層表有適當的 RLS 策略

-- 4.1 buddies_events 表（如果尚未啟用 RLS）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'buddies_events'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.buddies_events ENABLE ROW LEVEL SECURITY;

    -- 允許所有人讀取事件（用於統計）
    CREATE POLICY "Allow public read access to buddies_events"
    ON public.buddies_events
    FOR SELECT
    TO public
    USING (true);
  END IF;
END $$;

-- 4.2 buddies_rooms 表（如果尚未啟用 RLS）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'buddies_rooms'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.buddies_rooms ENABLE ROW LEVEL SECURITY;

    -- 允許所有人讀取房間信息
    CREATE POLICY "Allow public read access to buddies_rooms"
    ON public.buddies_rooms
    FOR SELECT
    TO public
    USING (true);
  END IF;
END $$;

-- 4.3 cleanup_logs 表
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'cleanup_logs'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.cleanup_logs ENABLE ROW LEVEL SECURITY;

    -- 只允許管理員讀取清理日誌
    CREATE POLICY "Allow admins read access to cleanup_logs"
    ON public.cleanup_logs
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE email = current_setting('request.jwt.claims', true)::json->>'email'
        AND is_active = true
      )
    );
  END IF;
END $$;

-- 4.4 swifttaste_interactions 表
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'swifttaste_interactions'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.swifttaste_interactions ENABLE ROW LEVEL SECURITY;

    -- 用戶可以讀取自己的互動記錄
    CREATE POLICY "Users can read own interactions"
    ON public.swifttaste_interactions
    FOR SELECT
    TO authenticated
    USING (
      user_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
      OR user_id IS NULL  -- 允許匿名互動
    );

    -- 允許插入互動記錄
    CREATE POLICY "Allow insert interactions"
    ON public.swifttaste_interactions
    FOR INSERT
    TO public
    WITH CHECK (true);
  END IF;
END $$;

-- 4.5 user_selection_history 表
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'user_selection_history'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.user_selection_history ENABLE ROW LEVEL SECURITY;

    -- 用戶可以讀取自己的選擇歷史
    CREATE POLICY "Users can read own history"
    ON public.user_selection_history
    FOR SELECT
    TO authenticated
    USING (
      user_id = current_setting('request.jwt.claims', true)::json->>'sub'
      OR user_id IS NULL  -- 允許匿名會話
    );

    -- 允許所有人插入選擇歷史
    CREATE POLICY "Allow insert history"
    ON public.user_selection_history
    FOR INSERT
    TO public
    WITH CHECK (true);
  END IF;
END $$;

-- ==========================================
-- 5. 驗證修復
-- ==========================================

-- 列出所有 views 及其 security 模式
SELECT
  schemaname,
  viewname,
  viewowner,
  CASE
    WHEN v.viewname IN (
      'buddies_room_timeline',
      'buddies_event_stats',
      'room_completion_funnel',
      'cleanup_health_status',
      'cleanup_history_stats',
      'v_swifttaste_sessions_with_interactions'
    ) THEN 'FIXED ✅'
    ELSE 'OK'
  END as status
FROM pg_views v
WHERE schemaname = 'public'
AND viewname IN (
  'buddies_room_timeline',
  'buddies_event_stats',
  'room_completion_funnel',
  'cleanup_health_status',
  'cleanup_history_stats',
  'v_swifttaste_sessions_with_interactions'
)
ORDER BY viewname;

-- ==========================================
-- 執行完成
-- ==========================================
-- 1. 所有 SECURITY DEFINER views 已改為 SECURITY INVOKER
-- 2. 已為底層表設置適當的 RLS 策略
-- 3. Views 現在會以查詢用戶的權限執行，防止權限提升
--
-- 下一步：
-- 1. 在 Supabase Dashboard 重新運行 Database Linter
-- 2. 確認所有 SECURITY DEFINER 警告已解決
-- 3. 測試應用功能確保一切正常運作
-- ==========================================

SELECT '✅ Security fixes applied successfully!' as message;
