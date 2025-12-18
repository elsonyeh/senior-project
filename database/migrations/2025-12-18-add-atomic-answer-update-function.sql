/**
 * 添加原子更新成員答案的 RPC 函數
 *
 * 日期: 2025-12-18
 * 問題: submitAnswers 使用「先讀後寫」邏輯，存在競態條件
 *       當多個成員幾乎同時提交答案時，後提交的答案會覆蓋先提交的
 * 解決: 創建 PostgreSQL 函數，使用 JSONB 原子操作更新答案
 */

-- ============================================================================
-- 創建原子更新成員答案的函數
-- ============================================================================

CREATE OR REPLACE FUNCTION update_member_answer(
  p_room_id text,
  p_user_id text,
  p_answer_data jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- 使用 JSONB 的 || 運算符原子性地合併數據
  -- 如果 member_answers 為 NULL，初始化為空對象
  UPDATE buddies_rooms
  SET
    member_answers = COALESCE(member_answers, '{}'::jsonb) || jsonb_build_object(p_user_id, p_answer_data),
    last_updated = now()
  WHERE id = p_room_id;

  -- 檢查是否更新成功
  IF NOT FOUND THEN
    RAISE EXCEPTION '房間不存在: %', p_room_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION update_member_answer IS '原子性地更新成員答案，避免競態條件';

-- ============================================================================
-- 驗證
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '======================================';
  RAISE NOTICE '✅ update_member_answer 函數已創建';
  RAISE NOTICE '======================================';
  RAISE NOTICE '';
  RAISE NOTICE '功能：';
  RAISE NOTICE '  - 原子性地更新 buddies_rooms.member_answers';
  RAISE NOTICE '  - 避免多個用戶同時提交答案時的競態條件';
  RAISE NOTICE '  - 使用 JSONB || 運算符合併數據';
  RAISE NOTICE '';
  RAISE NOTICE '使用範例：';
  RAISE NOTICE '  SELECT update_member_answer(';
  RAISE NOTICE '    ''room_id'',';
  RAISE NOTICE '    ''user_id'',';
  RAISE NOTICE '    ''{"answers": ["吃"], "completed": true}''::jsonb';
  RAISE NOTICE '  );';
  RAISE NOTICE '======================================';
END $$;
