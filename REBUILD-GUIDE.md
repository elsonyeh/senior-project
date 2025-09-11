# 🏗️ SwiftTaste Supabase 數據庫重建指南

## 🔍 第一步：診斷現狀

1. **登入 Supabase Dashboard**
   - 訪問：https://supabase.com/dashboard
   - 選擇你的項目：`ijgelbxfrahtrrcjijqf`

2. **執行診斷腳本**
   - 進入：SQL Editor
   - 複製 `database-diagnosis.sql` 的內容
   - 點擊 "Run" 執行
   - **📸 截圖或記錄所有結果**

## 🏗️ 第二步：完整重建

1. **執行重建腳本**
   - 在同一個 SQL Editor 中
   - 複製 `complete-rebuild.sql` 的**全部內容**
   - 點擊 "Run" 執行
   - **⚠️ 注意觀察是否有錯誤訊息**

2. **預期結果**
   ```
   Verification | Tables created     | 4
   Verification | Triggers created   | 5  
   Verification | Functions created  | 4
   Verification | RLS policies created | 7
   ```

## 💾 第三步：設置存儲桶

1. **創建頭像存儲桶**
   - 進入：Storage
   - 點擊："Create Bucket"
   - 名稱：`avatars`
   - 設置為：**Public bucket**

2. **設置存儲政策**
   - 點擊 `avatars` bucket
   - 進入 "Policies" 標籤
   - 點擊 "New Policy"
   - 選擇 "Allow all operations"
   - 或者手動添加：
     ```sql
     -- 用戶可以上傳自己的頭像
     CREATE POLICY "Avatar upload policy" ON storage.objects
       FOR INSERT WITH CHECK (
         bucket_id = 'avatars' 
         AND auth.uid()::text = (storage.foldername(name))[1]
       );
     
     -- 所有人可以查看頭像
     CREATE POLICY "Avatar view policy" ON storage.objects
       FOR SELECT USING (bucket_id = 'avatars');
     
     -- 用戶可以更新自己的頭像
     CREATE POLICY "Avatar update policy" ON storage.objects
       FOR UPDATE USING (
         bucket_id = 'avatars' 
         AND auth.uid()::text = (storage.foldername(name))[1]
       );
     ```

## 🔧 第四步：恢復應用程式

1. **恢復正常的 authService**
   - 我會幫你把 authService.js 改回使用數據庫版本
   - 移除本地存儲的臨時方案

2. **測試註冊功能**
   - 嘗試註冊新用戶
   - 檢查是否成功創建用戶檔案

## ✅ 完成檢查清單

- [ ] 診斷腳本執行完成，沒有錯誤
- [ ] 重建腳本執行完成，所有驗證通過
- [ ] avatars 存儲桶創建並設置政策
- [ ] 應用程式恢復正常數據庫服務
- [ ] 用戶註冊測試成功
- [ ] 收藏清單功能測試成功
- [ ] 歷史記錄功能測試成功

## 🚨 常見問題排除

### 問題1：權限錯誤
- 確保你在正確的項目中
- 確保你有 Owner 或 Admin 權限

### 問題2：表已存在錯誤
- 重建腳本會自動清理舊表
- 如果還有問題，請告訴我具體錯誤訊息

### 問題3：觸發器創建失敗
- 檢查是否有語法錯誤
- 確保 PostgreSQL 版本兼容（Supabase 使用 PostgreSQL 15）

## 📞 需要幫助？

如果在任何步驟遇到問題：
1. 複製完整的錯誤訊息給我
2. 截圖 Supabase Dashboard 的相關部分
3. 告訴我執行到哪一步出現問題

讓我們一步步解決所有問題！🚀