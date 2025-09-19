# 資料庫 Schema 設定指示

## 重要：請執行以下步驟來修正資料庫結構

你的 SwiftTaste 應用程式現在需要正確的資料庫 schema 才能正常運作。

### 步驟 1: 開啟 Supabase Dashboard

1. 前往 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇你的 SwiftTaste 專案
3. 點擊左側選單的 **SQL Editor**

### 步驟 2: 執行 Schema 腳本

1. 在 SQL Editor 中，開啟 `fix-database-schema.sql` 檔案的內容
2. 複製整個檔案內容並貼上到 SQL Editor
3. 點擊 **Run** 按鈕執行腳本

### 步驟 3: 驗證設定

執行完畢後，你應該會看到：
- ✅ 新的 `user_selection_history` 表格已創建
- ✅ 新的 `user_profiles` 表格已創建
- ✅ `avatars` 存儲桶已創建
- ✅ 表格結構正確（包含所有必要欄位）
- ✅ 所有必要的索引和觸發器已建立
- ✅ RLS 政策已設定
- ✅ 存儲桶政策已設定

### 步驟 4: 確認結果

回到你的 SwiftTaste 管理員分析頁面，你應該會看到：
- **註冊用戶數**：來自 `user_profiles` 表格的實際用戶數量
- **活躍用戶數**：最近30天有使用記錄的用戶
- **新用戶數**：最近30天新註冊的用戶
- **匿名會話數**：來自 `user_selection_history` 中匿名使用記錄
- **SwiftTaste/Buddies 會話**：來自 `user_selection_history` 的真實使用統計

### 資料來源說明

統計數據的來源：
- **📊 用戶統計**: 主要從 `user_profiles` 表格讀取註冊用戶數量
- **📈 活躍度**: 結合 `user_selection_history` 計算活躍用戶和新用戶
- **🎯 會話統計**: 完全來自 `user_selection_history` 表格
- **🤝 匿名使用**: 統計 `user_selection_history` 中沒有 `user_id` 的記錄

### 檔案位置

- **Schema 腳本**: `fix-database-schema.sql`
- **服務代碼**: 已更新為直接使用正確的 schema，不再有兼容模式

### 疑難排解

如果遇到問題：
1. 確認你有 Supabase 專案的管理員權限
2. 檢查控制台是否有錯誤訊息
3. 確認網路連線正常

---

**注意**: 此腳本會刪除並重建 `user_selection_history` 表格，任何現有資料將會遺失。新表格將是空的，等待真實使用者產生資料。