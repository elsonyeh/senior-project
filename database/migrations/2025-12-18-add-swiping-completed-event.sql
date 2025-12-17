/**
 * 添加 swiping_completed 事件類型到 buddies_events 表
 *
 * 日期: 2025-12-18
 * 目的: 支援滑動完成檢測功能
 */

-- 先刪除任何不符合舊約束的記錄（如果有的話）
-- 註：這樣做是為了避免約束衝突
DELETE FROM buddies_events
WHERE event_type NOT IN (
  'room_created', 'room_started', 'room_completed', 'room_abandoned',
  'member_joined', 'member_left', 'member_kicked',
  'question_answered', 'all_members_completed',
  'recommendations_generated', 'recommendations_refreshed',
  'vote_cast', 'vote_changed', 'vote_removed',
  'final_selection_made', 'final_selection_changed',
  'room_archived', 'room_cleaned',
  'error_occurred',
  'swiping_completed'  -- 也包含 swiping_completed
);

-- 移除舊的 CHECK 約束
ALTER TABLE buddies_events
  DROP CONSTRAINT IF EXISTS check_event_type;

-- 添加新的 CHECK 約束，包含 swiping_completed
ALTER TABLE buddies_events
  ADD CONSTRAINT check_event_type
  CHECK (event_type IN (
    -- 房間生命週期
    'room_created',
    'room_started',
    'room_completed',
    'room_abandoned',
    -- 成員操作
    'member_joined',
    'member_left',
    'member_kicked',
    -- 問題回答
    'question_answered',
    'all_members_completed',
    -- 推薦生成
    'recommendations_generated',
    'recommendations_refreshed',
    -- 滑動操作（新增）
    'swiping_completed',
    -- 投票操作
    'vote_cast',
    'vote_changed',
    'vote_removed',
    -- 最終決策
    'final_selection_made',
    'final_selection_changed',
    -- 系統事件
    'room_archived',
    'room_cleaned',
    -- 錯誤事件
    'error_occurred'
  ));

-- 驗證約束已更新
DO $$
BEGIN
  RAISE NOTICE '======================================';
  RAISE NOTICE '✅ swiping_completed 事件類型已添加';
  RAISE NOTICE '======================================';
  RAISE NOTICE '';
  RAISE NOTICE '現在可以記錄以下事件類型：';
  RAISE NOTICE '  - swiping_completed: 用戶完成滑動所有餐廳卡片';
  RAISE NOTICE '';
  RAISE NOTICE '使用方法：';
  RAISE NOTICE '  buddiesEventService.logSwipingCompleted(roomId, userId, swipedCount)';
  RAISE NOTICE '======================================';
END $$;
