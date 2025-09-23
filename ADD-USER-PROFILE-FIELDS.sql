-- 為 user_profiles 表添加基本個人資料欄位
-- 執行前請確認已登入 Supabase SQL Editor

-- 添加基本個人資料欄位
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS occupation VARCHAR(100);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS location VARCHAR(100);

-- 添加評論說明
COMMENT ON COLUMN user_profiles.gender IS '性別 (male, female, other, prefer_not_to_say)';
COMMENT ON COLUMN user_profiles.birth_date IS '生日';
COMMENT ON COLUMN user_profiles.occupation IS '職業';
COMMENT ON COLUMN user_profiles.location IS '居住地區';

-- 檢查表結構
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND table_schema = 'public'
ORDER BY ordinal_position;