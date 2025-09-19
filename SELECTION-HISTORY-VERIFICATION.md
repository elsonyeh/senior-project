# SwiftTaste 選擇紀錄功能驗證清單

## 📋 功能驗證檢查表

### ✅ 必須完成的設置步驟

- [ ] **資料庫 Schema 執行**
  - [ ] 在 Supabase Dashboard SQL Editor 中執行 `selection-history-schema.sql`
  - [ ] 確認 `user_selection_history` 表格已創建
  - [ ] 驗證 RLS 政策已啟用
  - [ ] 檢查索引是否正確建立

- [ ] **權限設置**
  - [ ] 確認 Supabase 項目連線正常
  - [ ] 驗證匿名用戶可以讀寫資料
  - [ ] 確認已登入用戶可以存取自己的資料

### 🧪 功能測試

#### 1. SwiftTaste 單人模式測試

- [ ] **基本流程**
  - [ ] 進入 SwiftTaste 單人模式
  - [ ] 完成基本問題回答
  - [ ] 完成趣味問題回答
  - [ ] 完成餐廳選擇流程

- [ ] **資料記錄驗證**
  - [ ] 檢查瀏覽器控制台是否有 "Selection session started" 訊息
  - [ ] 在答題過程中應看到 "Basic answers recorded" 等訊息
  - [ ] 完成選擇後應看到 "Selection session completed" 訊息

- [ ] **個人頁面驗證**
  - [ ] 進入個人頁面查看選擇紀錄
  - [ ] 確認顯示真實的選擇資料（非假資料）
  - [ ] 測試刪除個別記錄功能
  - [ ] 測試清除所有記錄功能

#### 2. Buddies 多人模式測試

- [ ] **房間創建與加入**
  - [ ] 創建 Buddies 房間
  - [ ] 檢查控制台是否有 "Buddies session started" 訊息
  - [ ] 其他用戶加入房間

- [ ] **答題流程**
  - [ ] 開始答題
  - [ ] 完成基本問題和趣味問題
  - [ ] 檢查控制台是否記錄了答案

- [ ] **推薦與投票**
  - [ ] 完成推薦流程
  - [ ] 確認最終選擇被記錄

#### 3. 資料庫驗證

```sql
-- 檢查是否有選擇記錄
SELECT COUNT(*) FROM user_selection_history;

-- 查看最新的記錄
SELECT * FROM user_selection_history
ORDER BY created_at DESC
LIMIT 5;

-- 檢查特定模式的記錄
SELECT mode, COUNT(*)
FROM user_selection_history
GROUP BY mode;
```

#### 4. 瀏覽器控制台測試

- [ ] **載入測試腳本**
  - [ ] 在網站頁面中開啟瀏覽器控制台
  - [ ] 載入 `test-selection-history.js`
  - [ ] 執行 `testSelectionHistory.quickTest()`
  - [ ] 確認基本功能正常

- [ ] **完整測試**
  - [ ] 執行 `testSelectionHistory.runAllTests()`
  - [ ] 檢查測試通過率應為 100%
  - [ ] 如有失敗，檢查相關錯誤訊息

### 🔧 問題排除檢查

#### 常見問題檢查

- [ ] **連線問題**
  - [ ] Supabase 專案 URL 和 API Key 是否正確
  - [ ] 網路連線是否正常
  - [ ] 是否有 CORS 錯誤

- [ ] **權限問題**
  - [ ] RLS 政策是否正確設置
  - [ ] 匿名用戶是否有適當權限
  - [ ] Session ID 是否正常生成

- [ ] **資料格式問題**
  - [ ] 答案格式是否正確（陣列格式）
  - [ ] 餐廳資料是否包含必要欄位
  - [ ] JSON 資料是否有效

#### 除錯檢查清單

```javascript
// 在瀏覽器控制台中執行這些檢查

// 1. 檢查服務是否載入
console.log('Service available:', typeof selectionHistoryService);

// 2. 檢查 Session ID
console.log('Session ID:', localStorage.getItem('swifttaste_session_id'));

// 3. 檢查 Supabase 連線
import { supabase } from './src/services/supabaseService.js';
const { data, error } = await supabase.from('user_selection_history').select('count');
console.log('Database connection:', { data, error });

// 4. 檢查用戶狀態
import { authService } from './src/services/authService.js';
const user = await authService.getCurrentUser();
console.log('User status:', user);
```

### 📊 效能檢查

- [ ] **載入時間**
  - [ ] 個人頁面載入歷史記錄應在 2 秒內完成
  - [ ] 記錄保存應即時完成（無明顯延遲）

- [ ] **資料量測試**
  - [ ] 測試載入大量歷史記錄（50+ 筆）
  - [ ] 確認分頁載入功能正常
  - [ ] 檢查記憶體使用量是否合理

### 🔒 安全性檢查

- [ ] **資料隔離**
  - [ ] 確認用戶只能看到自己的記錄
  - [ ] 匿名用戶記錄與已登入用戶記錄正確隔離
  - [ ] Session ID 無法被其他用戶存取

- [ ] **輸入驗證**
  - [ ] 嘗試提交無效資料格式
  - [ ] 確認伺服器端有適當驗證
  - [ ] SQL 注入防護測試

### 📱 跨平台測試

- [ ] **桌面瀏覽器**
  - [ ] Chrome 最新版本
  - [ ] Firefox 最新版本
  - [ ] Safari（如可用）

- [ ] **行動裝置**
  - [ ] iOS Safari
  - [ ] Android Chrome
  - [ ] 響應式設計正常運作

### 🚀 部署前最終檢查

- [ ] **生產環境準備**
  - [ ] 生產環境 Supabase 配置正確
  - [ ] 環境變數設置完成
  - [ ] 建構過程無錯誤

- [ ] **使用者體驗**
  - [ ] 沒有明顯的載入延遲
  - [ ] 錯誤訊息友善且有幫助
  - [ ] 功能直觀易用

- [ ] **文檔完整性**
  - [ ] README 更新包含新功能說明
  - [ ] API 文檔正確
  - [ ] 設置指南清楚明瞭

## ✅ 驗證完成確認

完成以上所有檢查項目後，請確認：

- [ ] 所有核心功能正常運作
- [ ] 沒有顯著的效能問題
- [ ] 安全性檢查通過
- [ ] 跨平台相容性良好
- [ ] 文檔完整且準確

**驗證日期**: ________________

**驗證人員**: ________________

**備註**:
_____________________________
_____________________________
_____________________________

---

## 🚨 發現問題時的處理步驟

1. **記錄問題詳情**
   - 重現步驟
   - 錯誤訊息
   - 瀏覽器和環境資訊

2. **查看相關日誌**
   - 瀏覽器控制台
   - Supabase Dashboard 日誌
   - 網路請求狀態

3. **尋求解決方案**
   - 檢查設置文檔
   - 查看問題排除指南
   - 諮詢技術團隊

4. **驗證修復**
   - 重新執行相關測試
   - 確認問題已完全解決
   - 更新驗證清單狀態