-- ==========================================
-- 修復觸發器中的 members_data 欄位問題
-- ==========================================
-- 執行日期：2025-12-15
-- 問題：trg_log_room_completed 觸發器嘗試訪問不存在的 members_data 欄位
-- 解決：從 buddies_members 表動態查詢成員數量

-- 重新創建房間完成事件觸發器函數
CREATE OR REPLACE FUNCTION trg_log_room_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_member_count integer;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- 從 buddies_members 表查詢成員數量
    SELECT COUNT(*)
    INTO v_member_count
    FROM buddies_members
    WHERE room_id = NEW.id AND status = 'active';

    PERFORM log_buddies_event(
      NEW.id,
      'room_completed',
      NULL,
      jsonb_build_object(
        'final_restaurant_id', NEW.final_restaurant_id,
        'member_count', v_member_count,
        'total_votes', (SELECT SUM((value->>'count')::int) FROM jsonb_each(COALESCE(NEW.votes, '{}'::jsonb)))
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 觸發器已經存在，不需要重新創建
-- 只是更新了函數內容

COMMENT ON FUNCTION trg_log_room_completed IS '記錄房間完成事件（已修復 members_data 問題）';

-- ==========================================
-- 修復歸檔觸發器
-- ==========================================

CREATE OR REPLACE FUNCTION archive_completed_buddies_room()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_member_count integer;
  v_total_votes integer;
  v_decision_time integer;
  v_questions_count integer;
  v_recommendations_count integer;
BEGIN
  -- 只在房間完成時觸發
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN

    -- 從 buddies_members 表查詢成員數量
    SELECT COUNT(*)
    INTO v_member_count
    FROM buddies_members
    WHERE room_id = NEW.id AND status = 'active';

    v_total_votes := COALESCE((
      SELECT SUM((value->>'count')::int)
      FROM jsonb_each(COALESCE(NEW.votes, '{}'::jsonb))
    ), 0);

    v_decision_time := CASE
      WHEN NEW.completed_at IS NOT NULL AND NEW.created_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (NEW.completed_at - NEW.created_at))::integer
      ELSE NULL
    END;

    v_questions_count := jsonb_array_length(COALESCE(NEW.questions, '[]'::jsonb));

    v_recommendations_count := jsonb_array_length(COALESCE(NEW.recommendations, '[]'::jsonb));

    -- 插入歸檔表（使用 ON CONFLICT 防止重複）
    INSERT INTO buddies_rooms_archive (
      id, room_code, host_id, host_name, status,
      members_data, member_answers, collective_answers,
      recommendations, votes, questions,
      final_restaurant_id, final_restaurant_data,
      member_count, total_votes, decision_time_seconds,
      questions_count, recommendations_count,
      created_at, questions_started_at, voting_started_at,
      completed_at, archived_at,
      schema_version, archived_by
    ) VALUES (
      NEW.id, NEW.room_code, NEW.host_id, NEW.host_name, NEW.status,
      '[]'::jsonb, NEW.member_answers, NEW.collective_answers,  -- members_data 改為空陣列
      NEW.recommendations, NEW.votes, NEW.questions,
      NEW.final_restaurant_id, NEW.final_restaurant_data,
      v_member_count, v_total_votes, v_decision_time,
      v_questions_count, v_recommendations_count,
      NEW.created_at, NEW.questions_started_at, NEW.voting_started_at,
      NEW.completed_at, now(),
      '1.0', 'trigger'
    )
    ON CONFLICT (id) DO UPDATE SET
      -- 如果已存在，更新為最新數據
      status = EXCLUDED.status,
      votes = EXCLUDED.votes,
      final_restaurant_id = EXCLUDED.final_restaurant_id,
      final_restaurant_data = EXCLUDED.final_restaurant_data,
      total_votes = EXCLUDED.total_votes,
      completed_at = EXCLUDED.completed_at,
      archived_at = now(),
      archived_by = 'trigger_update';

    RAISE NOTICE '✅ 房間 % 已自動歸檔', NEW.room_code;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION archive_completed_buddies_room IS '自動歸檔完成的房間（已修復 members_data 問題）';

SELECT '✅ 所有觸發器函數已修復' as status;
