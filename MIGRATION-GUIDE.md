# 🔄 Firebase 到 Supabase 資料遷移指南

## 📋 概覽

此文件說明如何將 SwiftTaste 應用程式的餐廳資料從 Firebase Firestore 遷移到 Supabase PostgreSQL 資料庫。

## 🛠️ 準備工作

### 1. 確認環境變數

確保 `server/.env` 檔案中包含以下設定：

```env
# Supabase 設定
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. 執行資料庫 Schema

在 Supabase SQL Editor 中執行 `supabase-restaurant-schema.sql` 文件：

1. 打開 Supabase Dashboard
2. 進入 SQL Editor
3. 複製貼上 `supabase-restaurant-schema.sql` 內容
4. 執行 SQL 指令

## 🚀 執行遷移

### 方法一：使用 npm 腳本

```bash
npm run migrate-firebase
```

### 方法二：直接執行

```bash
node migrate-firebase-to-supabase.js
```

## 📊 遷移過程

遷移腳本會執行以下步驟：

1. **連接 Firebase Firestore** - 讀取現有餐廳資料
2. **資料轉換** - 將 Firebase 格式轉換為 Supabase 格式
3. **批量匯入** - 分批插入餐廳資料到 Supabase
4. **照片處理** - 將 Firebase Storage 圖片作為外部連結新增
5. **結果報告** - 顯示成功/失敗統計

## 🔄 資料對應

### Firebase → Supabase 欄位對應

| Firebase 欄位 | Supabase 欄位 | 說明 |
|--------------|--------------|------|
| `id` | `firebase_id` | 原始 Firebase ID（用於避免重複） |
| `name` | `name` | 餐廳名稱 |
| `type` | `category` | 餐廳類型 |
| `address` | `address` | 地址 |
| `rating` | `rating` | 評分 (0-5) |
| `priceRange` | `price_range` | 價格等級 ($=1, $$=2, $$$=3, $$$$=4) |
| `location.lat` | `latitude` | 緯度 |
| `location.lng` | `longitude` | 經度 |
| `tags` | `tags` | 標籤陣列 |
| `photoURL` | `restaurant_images.image_url` | 照片連結（外部） |
| - | `description` | 自動組合 type + suggestedPeople |
| - | `featured` | 評分 ≥ 4.5 自動設為推薦 |
| - | `extra_data` | JSON 格式儲存原始資料 |

## ✅ 驗證遷移

遷移完成後，可透過以下方式驗證：

### 1. 檢查餐廳數量

```sql
SELECT COUNT(*) FROM restaurants;
```

### 2. 檢查照片數量

```sql
SELECT COUNT(*) FROM restaurant_images;
```

### 3. 查看範例資料

```sql
SELECT name, category, rating, price_range 
FROM restaurants 
LIMIT 5;
```

## 🎯 前端更新

遷移完成後，前端會自動：

1. ✅ 從 Supabase 讀取餐廳資料
2. ✅ 支援新的資料格式顯示
3. ✅ 相容舊格式（漸進式更新）
4. ✅ 顯示圖片來源標籤

## 🚨 注意事項

### 重複執行

- 腳本會檢查 `firebase_id` 避免重複匯入
- 可以安全地多次執行

### 資料完整性

- 原始 Firebase 資料會保存在 `extra_data` 欄位
- 支援漸進式遷移，新舊格式並存

### 錯誤處理

- 批量處理避免 API 限制
- 個別餐廳失敗不影響整體遷移
- 詳細錯誤日誌協助除錯

## 📈 效能優化

### 資料庫索引

已自動建立以下索引：
- `firebase_id` (唯一索引)
- `category`
- `price_range` 
- `rating`
- `location` (複合索引)
- `is_active`
- `featured`

### API 限制

- 批次大小：5 筆/批次
- 批次間延遲：1 秒
- 避免 Supabase API 限制

## 🎊 完成後

遷移成功後：

1. ✅ 所有餐廳資料已在 Supabase
2. ✅ 前端自動從 Supabase 載入
3. ✅ 管理員可在後台管理餐廳
4. ✅ 支援照片上傳和外部連結
5. ✅ 完整的搜尋和篩選功能

## 🆘 疑難排解

### 常見問題

**Q: 遷移中斷怎麼辦？**  
A: 重新執行腳本，已匯入的資料會自動跳過。

**Q: 照片無法顯示？**  
A: 檢查 Firebase Storage 權限，確保圖片連結可公開訪問。

**Q: 環境變數錯誤？**  
A: 確認 `server/.env` 檔案路徑和內容正確。

### 聯絡支援

如遇到問題，請檢查：
1. Console 輸出的錯誤訊息
2. Supabase Dashboard 的 API 日誌
3. Firebase Console 的存取權限

---

🎉 **恭喜！** 您已成功完成 Firebase 到 Supabase 的資料遷移！