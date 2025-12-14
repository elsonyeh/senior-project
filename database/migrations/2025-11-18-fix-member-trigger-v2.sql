/**
 * 修復 buddies_members 觸發器 - 修正類型轉換
 */

-- 刪除舊觸發器和函數
DROP TRIGGER IF EXISTS trigger_member_joined_event ON buddies_members;
DROP FUNCTION IF EXISTS trigger_log_member_joined() CASCADE;

-- 重新創建觸發器函數（正確的類型轉換）
CREATE FUNCTION trigger_log_member_joined()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM log_buddies_event(
    NEW.room_id::text,
    'member_joined'::text,
    NEW.user_id::uuid,
    jsonb_build_object(
      'is_host', NEW.is_host
    )
  );
  RETURN NEW;
END;
$$;

-- 綁定觸發器
CREATE TRIGGER trigger_member_joined_event
AFTER INSERT ON buddies_members
FOR EACH ROW
EXECUTE FUNCTION trigger_log_member_joined();

-- 驗證
DO $$
BEGIN
  RAISE NOTICE '✅ buddies_members 觸發器已更新';
END $$;
