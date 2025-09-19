# SwiftTaste 選擇紀錄功能設置指南

## 功能概述

SwiftTaste 現在具備完整的選擇紀錄功能，可以真實記錄用戶在 SwiftTaste 和 Buddies 模式下的選擇過程和推薦結果，並將資料安全存儲到 Supabase 資料庫中。

## 🚀 主要功能

### ✅ 已完成的功能

1. **資料庫 Schema**
   - ✅ 完整的選擇紀錄資料表 (`user_selection_history`)
   - ✅ 支援已登入和匿名用戶
   - ✅ Row Level Security (RLS) 保護用戶隱私
   - ✅ 自動清理舊資料功能

2. **選擇紀錄服務**
   - ✅ 完整的 `selectionHistoryService` API
   - ✅ 會話管理（開始、更新、完成）
   - ✅ 答案記錄（基本問題、趣味問題）
   - ✅ 推薦結果存儲
   - ✅ 用戶行為追蹤（滑動次數、喜歡的餐廳）

3. **SwiftTaste 整合**
   - ✅ 自動記錄選擇會話
   - ✅ 記錄所有用戶答案
   - ✅ 追蹤推薦結果和最終選擇
   - ✅ 記錄用戶互動行為

4. **個人頁面顯示**
   - ✅ 移除假資料，使用真實資料庫資料
   - ✅ 完整的歷史記錄顯示
   - ✅ 真實的刪除和清除功能

## 📋 設置步驟

### 1. 執行資料庫 Schema

在 Supabase Dashboard 的 SQL Editor 中執行：

```sql
-- 執行 selection-history-schema.sql 中的完整腳本
```

這將創建：
- `user_selection_history` 表格
- 相關索引和觸發器
- RLS 安全政策
- 輔助函數和視圖

### 2. 驗證資料庫設置

執行以下查詢確認表格已正確創建：

```sql
-- 檢查表格是否存在
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'user_selection_history';

-- 檢查 RLS 是否啟用
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'user_selection_history';
```

### 3. 測試功能

1. **測試 SwiftTaste 模式**
   - 進入 SwiftTaste 單人模式
   - 完成問題回答流程
   - 滑動選擇餐廳
   - 檢查個人頁面的選擇紀錄

2. **測試資料持久化**
   - 重新整理頁面
   - 檢查紀錄是否仍然存在
   - 測試刪除功能

## 📊 資料結構

### user_selection_history 表格欄位

```sql
- id: UUID (主鍵)
- user_id: UUID (已登入用戶ID，可為 NULL)
- session_id: TEXT (匿名用戶會話ID)
- mode: TEXT ('swifttaste' 或 'buddies')
- started_at: TIMESTAMPTZ (開始時間)
- completed_at: TIMESTAMPTZ (完成時間)
- session_duration: INTEGER (會話持續時間，秒)
- basic_answers: JSONB (基本問題答案)
- fun_answers: JSONB (趣味問題答案)
- recommended_restaurants: JSONB (推薦餐廳列表)
- final_restaurant: JSONB (最終選擇的餐廳)
- swipe_count: INTEGER (滑動次數)
- liked_restaurants: JSONB (用戶喜歡的餐廳)
- room_id: TEXT (Buddies 房間ID)
- user_location: JSONB (用戶位置資訊)
```

## 🔒 安全性

1. **Row Level Security (RLS)**
   - 用戶只能查看自己的紀錄
   - 匿名用戶通過 session_id 識別
   - 自動清理機制保護隱私

2. **資料驗證**
   - 輸入資料類型檢查
   - 必填欄位驗證
   - 防止 SQL 注入

## 🔧 API 使用方式

### 基本使用

```javascript
import selectionHistoryService from './services/selectionHistoryService';

// 開始會話
const session = await selectionHistoryService.startSession('swifttaste');

// 記錄答案
await selectionHistoryService.saveBasicAnswers(sessionId, ['單人', '平價美食']);
await selectionHistoryService.saveFunAnswers(sessionId, ['貓派', 'I人']);

// 記錄推薦結果
await selectionHistoryService.saveRecommendations(sessionId, restaurants);

// 完成會話
await selectionHistoryService.completeSession(sessionId, finalRestaurant);
```

### 查詢歷史

```javascript
// 獲取用戶歷史
const history = await selectionHistoryService.getUserHistory(20);

// 根據模式過濾
const swiftTasteHistory = await selectionHistoryService.getHistoryByMode('swifttaste');

// 獲取統計數據
const stats = await selectionHistoryService.getUserStats();
```

## 🐛 問題排除

### 常見問題

1. **無法記錄資料**
   - 檢查 Supabase 連線
   - 確認 RLS 政策正確
   - 檢查瀏覽器控制台錯誤

2. **歷史記錄不顯示**
   - 確認用戶已完成至少一次選擇流程
   - 檢查資料格式轉換函數
   - 驗證資料庫查詢權限

3. **會話無法開始**
   - 檢查 `session_id` 生成
   - 確認用戶認證狀態
   - 檢查網路連線

### 除錯工具

```javascript
// 檢查會話狀態
console.log('Current session ID:', selectionHistoryService.sessionId);

// 檢查用戶狀態
const user = await authService.getCurrentUser();
console.log('Current user:', user);

// 檢查資料庫連線
const { data, error } = await supabase.from('user_selection_history').select('count');
console.log('Database connection:', { data, error });
```

## 📈 效能優化

1. **資料庫索引**
   - 已為常用查詢欄位建立索引
   - 定期清理舊資料

2. **前端快取**
   - 會話 ID 本地快取
   - 分頁載入歷史記錄

3. **批次操作**
   - 合併多個更新操作
   - 非同步處理大量資料

## 🚀 未來擴展

### 計劃中的功能

1. **Buddies 模式完整整合**
2. **進階統計和分析**
3. **資料匯出功能**
4. **個人化推薦改進**

### 效能監控

1. **查詢效能追蹤**
2. **用戶行為分析**
3. **系統健康監控**

---

## 📝 總結

SwiftTaste 選擇紀錄功能現在已經完全移除假資料，實現了真實的資料庫存儲。用戶的每次選擇都會被安全記錄，並可在個人頁面中查看和管理。

### 核心優勢

- ✅ **真實資料存儲**：所有選擇記錄都存儲在 Supabase
- ✅ **隱私保護**：完整的 RLS 安全機制
- ✅ **用戶友好**：支援已登入和匿名用戶
- ✅ **完整追蹤**：記錄選擇過程的每個步驟
- ✅ **易於管理**：提供刪除和清除功能

現在用戶可以放心使用 SwiftTaste，他們的選擇紀錄將被安全且準確地保存！