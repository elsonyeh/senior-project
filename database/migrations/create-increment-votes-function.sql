-- 建立原子性增加票數的 RPC 函數
-- 此函數確保多用戶同時投票時票數正確累加

CREATE OR REPLACE FUNCTION increment_restaurant_votes(
  p_room_id TEXT,
  p_restaurant_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 使用 INSERT ... ON CONFLICT 確保原子性
  INSERT INTO buddies_restaurant_votes (room_id, restaurant_id, vote_count, updated_at, created_at)
  VALUES (p_room_id, p_restaurant_id, 1, NOW(), NOW())
  ON CONFLICT (room_id, restaurant_id)
  DO UPDATE SET
    vote_count = buddies_restaurant_votes.vote_count + 1,
    updated_at = NOW();
END;
$$;

-- 授權給 anon 和 authenticated 角色
GRANT EXECUTE ON FUNCTION increment_restaurant_votes(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION increment_restaurant_votes(TEXT, TEXT) TO authenticated;

-- 測試函數
-- SELECT increment_restaurant_votes('test_room', 'test_restaurant');
-- SELECT * FROM buddies_restaurant_votes WHERE room_id = 'test_room';
