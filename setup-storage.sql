-- 🗄️ Supabase Storage 設置腳本
-- 這個腳本設置頭像上傳所需的 Storage 政策
-- 請在設置完 Storage bucket 後執行

-- 注意：首先需要在 Supabase Dashboard > Storage 中手動創建 'avatars' bucket
-- 並設置為 public bucket

-- 為 avatars bucket 創建存儲政策

-- 1. 用戶可以上傳自己的頭像
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. 用戶可以上傳自己的頭像文件
CREATE POLICY "Users can upload own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 3. 所有人可以查看頭像（因為是 public bucket）
CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- 4. 用戶可以更新自己的頭像
CREATE POLICY "Users can update own avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  ) WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 5. 用戶可以刪除自己的頭像
CREATE POLICY "Users can delete own avatar" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );