/**
 * 清理未使用的表格和欄位
 *
 * 日期: 2025-11-18
 * 目的: 簡化資料庫結構，移除未使用的表格和欄位
 *
 * 變更:
 * 1. 刪除 buddies_answers 表（答題數據已改用 buddies_rooms.member_answers JSONB）
 * 2. 移除 buddies_events 表中未使用的 ip_address 和 user_agent 欄位
 * 3. 刪除 buddies_interactions 表（未使用）
 */

-- ============================================================================
-- 1. 刪除 buddies_answers 表
-- ============================================================================

-- 先從 realtime publication 移除（如果存在）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'buddies_answers'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE buddies_answers;
    RAISE NOTICE '✅ 已從 realtime publication 移除 buddies_answers';
  END IF;
END $$;

-- 刪除表格
DROP TABLE IF EXISTS buddies_answers CASCADE;

-- ============================================================================
-- 2. 刪除 buddies_interactions 表
-- ============================================================================

DROP TABLE IF EXISTS buddies_interactions CASCADE;

-- ============================================================================
-- 3. 移除 buddies_events 未使用的欄位
-- ============================================================================

-- 移除 ip_address 欄位
ALTER TABLE buddies_events DROP COLUMN IF EXISTS ip_address;

-- 移除 user_agent 欄位
ALTER TABLE buddies_events DROP COLUMN IF EXISTS user_agent;

-- ============================================================================
-- 4. 更新 log_buddies_event 函數（移除未使用參數）
-- ============================================================================

-- 先刪除舊版本的函數（包含 ip_address 和 user_agent 參數）
DROP FUNCTION IF EXISTS log_buddies_event(uuid, text, uuid, jsonb, inet, text);

-- 創建新版本的函數
CREATE OR REPLACE FUNCTION log_buddies_event(
  p_room_id uuid,
  p_event_type text,
  p_user_id uuid DEFAULT NULL,
  p_event_data jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO buddies_events (
    room_id, event_type, user_id, event_data, created_at
  ) VALUES (
    p_room_id, p_event_type, p_user_id, p_event_data, now()
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION log_buddies_event(uuid, text, uuid, jsonb) IS '記錄 Buddies 事件（簡化版）';

-- ============================================================================
-- 5. 驗證清理結果
-- ============================================================================

DO $$
DECLARE
  v_buddies_answers_exists boolean;
  v_buddies_interactions_exists boolean;
  v_ip_address_exists boolean;
  v_user_agent_exists boolean;
BEGIN
  -- 檢查 buddies_answers 是否已刪除
  v_buddies_answers_exists := EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'buddies_answers'
  );

  -- 檢查 buddies_interactions 是否已刪除
  v_buddies_interactions_exists := EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'buddies_interactions'
  );

  -- 檢查 ip_address 欄位是否已移除
  v_ip_address_exists := EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'buddies_events' AND column_name = 'ip_address'
  );

  -- 檢查 user_agent 欄位是否已移除
  v_user_agent_exists := EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'buddies_events' AND column_name = 'user_agent'
  );

  RAISE NOTICE '';
  RAISE NOTICE '📊 清理結果驗證：';

  IF NOT v_buddies_answers_exists THEN
    RAISE NOTICE '  ✅ buddies_answers 表已刪除';
  ELSE
    RAISE WARNING '  ❌ buddies_answers 表仍存在';
  END IF;

  IF NOT v_buddies_interactions_exists THEN
    RAISE NOTICE '  ✅ buddies_interactions 表已刪除';
  ELSE
    RAISE WARNING '  ❌ buddies_interactions 表仍存在';
  END IF;

  IF NOT v_ip_address_exists THEN
    RAISE NOTICE '  ✅ buddies_events.ip_address 欄位已移除';
  ELSE
    RAISE WARNING '  ❌ buddies_events.ip_address 欄位仍存在';
  END IF;

  IF NOT v_user_agent_exists THEN
    RAISE NOTICE '  ✅ buddies_events.user_agent 欄位已移除';
  ELSE
    RAISE WARNING '  ❌ buddies_events.user_agent 欄位仍存在';
  END IF;
END $$;
