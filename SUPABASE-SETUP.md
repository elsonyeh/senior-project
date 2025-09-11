# 🚀 SwiftTaste Supabase 設置指南

## ✅ 已完成的改進

### 1. 🔧 修復的問題
- ✅ Google Maps API 自動定位
- ✅ 用戶認證錯誤處理
- ✅ 手機版 UI 優化
- ✅ 移除硬編碼數據

### 2. 🎨 UI 優化
- 📱 手機版側邊欄改為底部彈出
- 🎯 自動請求用戶位置
- 🎭 響應式通知訊息
- 💫 美觀的空狀態組件

### 3. 🔐 認證系統升級
- 🆕 完整的 Supabase Auth 整合
- 📸 頭像上傳功能
- 📊 用戶統計數據
- 🔒 Row Level Security

## 📋 Supabase 數據庫設置

### 快速設置步驟：

1. **登入 Supabase Dashboard**
   - 前往 https://supabase.com/dashboard
   - 選擇您的專案

2. **執行 SQL 腳本**
   - 前往 SQL Editor
   - 複製 `supabase-auth-schema.sql` 的完整內容
   - 執行腳本 (這會創建所有必要的表格和觸發器)

3. **創建存儲桶**
   - 前往 Storage 頁面
   - 創建名為 `avatars` 的桶
   - 設為公開讀取

4. **設置存儲政策** (在 SQL Editor 執行)
   ```sql
   -- 允許用戶管理自己的頭像
   CREATE POLICY "Users can upload own avatar" ON storage.objects
   FOR INSERT TO authenticated WITH CHECK (
     bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
   );

   CREATE POLICY "Users can update own avatar" ON storage.objects
   FOR UPDATE TO authenticated USING (
     bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
   );

   CREATE POLICY "Users can delete own avatar" ON storage.objects
   FOR DELETE TO authenticated USING (
     bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
   );
   ```

## 🧪 測試功能

完成設置後，您可以測試：

- ✅ 用戶註冊/登入
- ✅ 頭像上傳
- ✅ 收藏清單管理
- ✅ Google Maps 自動定位
- ✅ 響應式手機版 UI

## 📂 新增的文件

### 服務文件
- `src/services/authService.js` - 用戶認證
- `src/services/userDataService.js` - 數據管理

### 組件文件
- `src/components/common/EmptyState.jsx` - 空狀態組件

### 設置文件
- `supabase-auth-schema.sql` - 完整數據庫架構
- `setup-supabase.js` - 設置指南
- `SUPABASE-SETUP.md` - 此說明文件

## 🔍 問題排除

### 認證錯誤
如果遇到 "Auth session missing" 錯誤：
- 確保 Supabase 腳本正確執行
- 檢查環境變數設置
- 確認用戶已正確註冊

### 地圖不顯示
如果 Google Maps 無法載入：
- 檢查 API Key 是否有效
- 確認已啟用 Maps JavaScript API
- 檢查瀏覽器控制台錯誤

### 手機版體驗
- 📱 側邊欄在手機版會從底部彈出
- 🎯 頁面載入時自動請求定位權限
- 🎨 響應式設計適配不同螢幕尺寸

## 🚀 開始使用

1. 執行上述 Supabase 設置
2. 重新啟動開發伺服器: `npm run dev`
3. 訪問 http://localhost:5174
4. 測試註冊新用戶和各項功能

現在 SwiftTaste 已具備完整的用戶認證、數據持久化和優化的手機版體驗！