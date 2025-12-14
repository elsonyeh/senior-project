-- 完整修復所有 buddies 表的 RLS 和權限

-- ============================================================================
-- 1. buddies_members
-- ============================================================================

ALTER TABLE buddies_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to buddies_members" ON buddies_members;
DROP POLICY IF EXISTS "Allow all operations on buddies_members" ON buddies_members;

CREATE POLICY "Enable all for buddies_members"
  ON buddies_members
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON buddies_members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON buddies_members TO authenticated;

-- ============================================================================
-- 2. buddies_rooms
-- ============================================================================

ALTER TABLE buddies_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to buddies_rooms" ON buddies_rooms;
DROP POLICY IF EXISTS "Allow all operations on buddies_rooms" ON buddies_rooms;

CREATE POLICY "Enable all for buddies_rooms"
  ON buddies_rooms
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON buddies_rooms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON buddies_rooms TO authenticated;

-- ============================================================================
-- 3. buddies_events
-- ============================================================================

ALTER TABLE buddies_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Events are read-only for all users" ON buddies_events;
DROP POLICY IF EXISTS "Only service role can write events" ON buddies_events;
DROP POLICY IF EXISTS "Events are immutable" ON buddies_events;
DROP POLICY IF EXISTS "Events cannot be deleted" ON buddies_events;

CREATE POLICY "Enable all for buddies_events"
  ON buddies_events
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON buddies_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON buddies_events TO authenticated;

-- ============================================================================
-- 4. 驗證
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ 所有 buddies 表的 RLS 政策已更新';
END $$;
