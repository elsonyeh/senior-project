-- ============================================================================
-- 驗證 SwiftTaste Interactions 記錄
-- ============================================================================
-- 執行方式：在 Supabase Dashboard 的 SQL Editor 中執行
-- ============================================================================

-- 查看最新的互動記錄（包含 metadata）
SELECT
  '📊 最新互動記錄' as title,
  id,
  session_id,
  user_id,
  restaurant_id,
  action_type,
  metadata,
  created_at
FROM swifttaste_interactions
ORDER BY created_at DESC
LIMIT 20;

-- 統計各類型互動數量
SELECT
  '📈 互動類型統計' as title,
  action_type,
  COUNT(*) as count
FROM swifttaste_interactions
GROUP BY action_type
ORDER BY count DESC;

-- 查看是否有最近的會話記錄
SELECT
  '🔍 最近會話' as title,
  COUNT(DISTINCT session_id) as session_count,
  COUNT(*) as total_interactions,
  MAX(created_at) as last_interaction
FROM swifttaste_interactions
WHERE created_at > NOW() - INTERVAL '1 hour';

-- 查看最近 10 分鐘的活動（用於測試）
SELECT
  '⏰ 最近 10 分鐘' as title,
  action_type,
  COUNT(*) as count,
  MAX(created_at) as last_time
FROM swifttaste_interactions
WHERE created_at > NOW() - INTERVAL '10 minutes'
GROUP BY action_type;
