-- ============================================================================
-- 用戶初始化觸發器 - 自動創建預設資料
-- ============================================================================
-- 當新用戶註冊時，自動創建：
-- 1. user_profiles 記錄
-- 2. 「我的最愛」預設收藏清單（無法刪除）
--
-- 執行方式：在 Supabase Dashboard 的 SQL Editor 中執行
-- ============================================================================

-- ============================================================================
-- 1. 創建用戶初始化函數
-- ============================================================================

CREATE OR REPLACE FUNCTION initialize_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- 以觸發器擁有者權限執行
AS $$
DECLARE
  v_user_name text;
  v_default_list_id uuid;
BEGIN
  -- 從 email 提取用戶名（如果沒有 metadata 中的 name）
  v_user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- 1. 創建 user_profiles 記錄
  INSERT INTO user_profiles (
    id,
    email,
    name,
    avatar_url,
    bio,
    favorite_lists_count,
    swifttaste_count,
    buddies_count
  ) VALUES (
    NEW.id,
    NEW.email,
    v_user_name,
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'bio', ''),
    1, -- 預設有一個收藏清單
    0,
    0
  )
  ON CONFLICT (id) DO NOTHING; -- 如果已存在則跳過

  -- 2. 創建預設收藏清單「我的最愛」
  INSERT INTO user_favorite_lists (
    user_id,
    name,
    description,
    color,
    is_public,
    is_default,
    is_deletable
  ) VALUES (
    NEW.id,
    '我的最愛',
    'SwiftTaste 收藏的餐廳',
    '#ff6b35',
    false,
    true,  -- 標記為預設清單
    false  -- 標記為不可刪除
  )
  RETURNING id INTO v_default_list_id;

  RAISE NOTICE '✅ 用戶初始化完成: % (ID: %)', v_user_name, NEW.id;
  RAISE NOTICE '   - 創建 user_profiles 記錄';
  RAISE NOTICE '   - 創建預設收藏清單: %', v_default_list_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ 用戶初始化失敗: % - %', NEW.email, SQLERRM;
    RETURN NEW; -- 不阻斷用戶註冊流程
END;
$$;

-- ============================================================================
-- 2. 檢查並添加必要欄位
-- ============================================================================

-- 檢查 user_favorite_lists 是否有 is_default 和 is_deletable 欄位
DO $$
BEGIN
  -- 添加 is_default 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_favorite_lists'
    AND column_name = 'is_default'
  ) THEN
    ALTER TABLE user_favorite_lists
    ADD COLUMN is_default BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ 已添加 is_default 欄位';
  ELSE
    RAISE NOTICE '✓ is_default 欄位已存在';
  END IF;

  -- 添加 is_deletable 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_favorite_lists'
    AND column_name = 'is_deletable'
  ) THEN
    ALTER TABLE user_favorite_lists
    ADD COLUMN is_deletable BOOLEAN DEFAULT true;
    RAISE NOTICE '✅ 已添加 is_deletable 欄位';
  ELSE
    RAISE NOTICE '✓ is_deletable 欄位已存在';
  END IF;
END $$;

-- ============================================================================
-- 3. 創建觸發器
-- ============================================================================

-- 刪除舊觸發器（如果存在）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 創建新觸發器
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_new_user();

-- 顯示觸發器創建成功訊息
DO $$
BEGIN
  RAISE NOTICE '✅ 觸發器已創建: on_auth_user_created';
END $$;

-- ============================================================================
-- 4. 為現有用戶補充預設清單（可選）
-- ============================================================================

DO $$
DECLARE
  v_user_record RECORD;
  v_list_id uuid;
  v_user_name text;
  v_profile_exists boolean;
BEGIN
  RAISE NOTICE '======================================';
  RAISE NOTICE '開始為現有用戶補充資料...';
  RAISE NOTICE '======================================';

  FOR v_user_record IN
    SELECT
      u.id,
      u.email,
      u.raw_user_meta_data,
      up.name as profile_name,
      up.id as profile_id
    FROM auth.users u
    LEFT JOIN user_profiles up ON u.id = up.id
    WHERE NOT EXISTS (
      SELECT 1 FROM user_favorite_lists
      WHERE user_id = u.id
      AND is_default = true
    )
  LOOP
    -- 檢查是否有 user_profiles 記錄
    v_profile_exists := v_user_record.profile_id IS NOT NULL;

    -- 提取用戶名
    v_user_name := COALESCE(
      v_user_record.profile_name,
      v_user_record.raw_user_meta_data->>'name',
      split_part(v_user_record.email, '@', 1)
    );

    -- 如果沒有 user_profiles 記錄，先創建
    IF NOT v_profile_exists THEN
      INSERT INTO user_profiles (
        id,
        email,
        name,
        avatar_url,
        bio,
        favorite_lists_count,
        swifttaste_count,
        buddies_count
      ) VALUES (
        v_user_record.id,
        v_user_record.email,
        v_user_name,
        v_user_record.raw_user_meta_data->>'avatar_url',
        COALESCE(v_user_record.raw_user_meta_data->>'bio', ''),
        1, -- 預設有一個收藏清單
        0,
        0
      )
      ON CONFLICT (id) DO NOTHING;

      RAISE NOTICE '  → 為用戶 % 創建 user_profiles 記錄', v_user_record.email;
    END IF;

    -- 創建預設收藏清單
    INSERT INTO user_favorite_lists (
      user_id,
      name,
      description,
      color,
      is_public,
      is_default,
      is_deletable
    ) VALUES (
      v_user_record.id,
      '我的最愛',
      'SwiftTaste 收藏的餐廳',
      '#ff6b35',
      false,
      true,
      false
    )
    RETURNING id INTO v_list_id;

    -- 更新 user_profiles 的計數（如果記錄已存在）
    IF v_profile_exists THEN
      UPDATE user_profiles
      SET favorite_lists_count = favorite_lists_count + 1
      WHERE id = v_user_record.id;
    END IF;

    RAISE NOTICE '✅ 為用戶 % (%) 創建預設清單', v_user_name, v_user_record.email;
  END LOOP;

  RAISE NOTICE '======================================';
  RAISE NOTICE '現有用戶資料補充完成！';
  RAISE NOTICE '======================================';
END $$;

-- ============================================================================
-- 5. 修改 deleteFavoriteList 函數以保護預設清單（可選）
-- ============================================================================

-- 如果有刪除清單的函數，可以在這裡添加保護邏輯
-- 這部分可以根據實際需求實現

-- ============================================================================
-- 6. 驗證設置
-- ============================================================================

DO $$
DECLARE
  v_trigger_count int;
  v_default_lists_count int;
BEGIN
  -- 檢查觸發器
  SELECT COUNT(*) INTO v_trigger_count
  FROM pg_trigger
  WHERE tgname = 'on_auth_user_created';

  -- 檢查預設清單數量
  SELECT COUNT(*) INTO v_default_lists_count
  FROM user_favorite_lists
  WHERE is_default = true;

  RAISE NOTICE '======================================';
  RAISE NOTICE '驗證結果：';
  RAISE NOTICE '  - 觸發器: % 個', v_trigger_count;
  RAISE NOTICE '  - 預設清單: % 個', v_default_lists_count;
  RAISE NOTICE '======================================';
END $$;

-- ============================================================================
-- 完成
-- ============================================================================

SELECT '✅ 用戶初始化觸發器設置完成！' as status;
