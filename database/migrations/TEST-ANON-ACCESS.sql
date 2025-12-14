-- 🧪 精確測試 anon 角色訪問 buddies_members

-- ============================================================================
-- 測試 1: 檢查 anon 角色是否存在並有正確權限
-- ============================================================================
SELECT rolname FROM pg_roles WHERE rolname = 'anon';

-- 檢查 anon 是否是 public 的成員
SELECT
  r.rolname as role,
  m.rolname as member_of
FROM pg_roles r
LEFT JOIN pg_auth_members am ON r.oid = am.member
LEFT JOIN pg_roles m ON am.roleid = m.oid
WHERE r.rolname = 'anon';

-- ============================================================================
-- 測試 2: 以 anon 角色測試查詢（精確測試）
-- ============================================================================
SET ROLE anon;

-- 測試 A: 簡單查詢所有記錄
SELECT COUNT(*) as total_count FROM buddies_members;

-- 測試 B: 查詢特定房間
SELECT * FROM buddies_members WHERE room_id = 'BUS2MX';

-- 測試 C: 查詢特定用戶（使用 UUID 類型）
SELECT * FROM buddies_members
WHERE user_id = 'b85fffa3-50fc-4942-a758-cb6b49dc915c'::uuid;

-- 測試 D: 組合查詢（模擬前端的查詢）
SELECT * FROM buddies_members
WHERE room_id = 'BUS2MX'
  AND user_id = 'b85fffa3-50fc-4942-a758-cb6b49dc915c'::uuid;

RESET ROLE;

-- ============================================================================
-- 測試 3: 檢查 PostgREST 相關設定
-- ============================================================================
-- 檢查是否有任何 RLS bypass 設定
SHOW row_security;

-- 檢查當前數據庫設定
SELECT current_database(), current_user, session_user;

-- ============================================================================
-- 測試 4: 模擬 PostgREST 的查詢方式
-- ============================================================================
SET ROLE anon;

-- PostgREST 會使用這種方式查詢（帶有 select 參數）
PREPARE test_query AS
  SELECT * FROM buddies_members
  WHERE room_id = $1 AND user_id = $2;

EXECUTE test_query('BUS2MX', 'b85fffa3-50fc-4942-a758-cb6b49dc915c'::uuid);

DEALLOCATE test_query;

RESET ROLE;

-- ============================================================================
-- 總結報告
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '如果上述所有測試都成功：';
  RAISE NOTICE '  → 問題不在 RLS，可能是前端或 PostgREST 快取';
  RAISE NOTICE '';
  RAISE NOTICE '如果 anon 角色測試失敗：';
  RAISE NOTICE '  → 問題在 RLS 配置，需要調整政策';
  RAISE NOTICE '========================================';
END $$;
