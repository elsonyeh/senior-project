# 儀表板進階分析整合指南

## 📋 已完成的步驟

✅ 1. 創建了 SQL 分析函數（`docs/setup-analytics-functions.sql`）
✅ 2. 修改前端代碼調用這些函數
✅ 3. 添加了狀態管理和數據加載邏輯

---

## 🚀 下一步：執行 SQL 並測試

### 步驟 1：在 Supabase 中創建分析函數

1. 打開 **Supabase Dashboard**
2. 進入 **SQL Editor**
3. 打開文件 `docs/setup-analytics-functions.sql`
4. **複製整個文件內容**
5. 貼到 SQL Editor 中
6. 點擊 **Run** 執行

**預期結果：**
```
✅ 7 個函數創建成功
✅ 測試查詢執行成功
```

如果出現錯誤，請截圖並告訴我。

---

### 步驟 2：測試前端是否能獲取數據

1. **清除快取**：在瀏覽器 Console 執行
   ```javascript
   localStorage.clear()
   ```

2. **重新整理頁面**（Ctrl+R 或 F5）

3. **檢查 Console 輸出**，應該會看到：
   ```
   ✅ 成功獲取匿名用戶統計: { total_anonymous: 14, ... }
   ```

4. **檢查匿名用戶卡片**，應該顯示：
   ```
   匿名用戶
   14
   🔓 未登錄: 13
   ⚠️ 未完成註冊: 1
   ST 6 · BD 11
   ```

---

## 📊 現在可以使用的數據

執行 SQL 函數後，前端可以獲取以下數據：

### 1. 用戶分類統計 (`userClassification`)
```javascript
{
  total_users: 27,
  registered_users: 2,
  incomplete_with_usage: 1,
  incomplete_without_usage: 24,
  anonymous_devices: 14
}
```

### 2. 會話來源分析 (`sessionSource`)
```javascript
{
  total_sessions: 298,
  registered_sessions: 186,
  anonymous_sessions: 109,
  incomplete_sessions: 3,
  registered_percentage: 62.42,
  anonymous_percentage: 36.58,
  incomplete_percentage: 1.01
}
```

### 3. 模式使用對比 (`modeComparison`)
```javascript
[
  {
    mode: 'buddies',
    total_sessions: 279,
    registered_sessions: 177,
    anonymous_sessions: 102,
    incomplete_sessions: 0
  },
  {
    mode: 'swifttaste',
    total_sessions: 19,
    registered_sessions: 9,
    anonymous_sessions: 10,
    incomplete_sessions: 0
  }
]
```

### 4. 用戶活躍度排行 (`userActivityRanking`)
```javascript
[
  {
    user_id: 'xxx',
    user_name: 'Elson',
    user_email: 'elson921121@gmail.com',
    is_registered: true,
    total_sessions: 181,
    swifttaste_count: 0,
    buddies_count: 181,
    last_activity: '2025-12-18T21:45:56.058Z'
  },
  // ... 更多用戶
]
```

### 5. 註冊轉化率統計 (`conversionStats`)
```javascript
{
  total_users: 27,
  registered_users: 2,
  users_with_activity: 3,
  dormant_users: 24,
  registration_rate: 7.41,
  activity_rate: 11.11,
  dormant_rate: 88.89
}
```

---

## 🎨 下一步：UI 設計和實現

一旦 SQL 函數創建成功並且前端能獲取數據，我會：

1. ✅ 添加新的統計卡片顯示這些數據
2. ✅ 創建圖表可視化（餅圖、條形圖等）
3. ✅ 添加可點擊查看詳情功能
4. ✅ 優化頁面佈局和樣式

---

## ⚠️ 常見問題

### Q: SQL 執行出錯怎麼辦？
A: 請截圖錯誤訊息並告訴我，我會修正 SQL 語法。

### Q: 前端顯示 Console 錯誤？
A: 如果看到「調用 xxx 失敗」，說明 SQL 函數還沒創建成功，請先執行步驟 1。

### Q: 匿名用戶數還是顯示 0？
A: 檢查 Console 是否有錯誤訊息。如果有，請貼給我。

---

## 📝 執行清單

請按順序完成：

- [ ] 在 Supabase SQL Editor 執行 `setup-analytics-functions.sql`
- [ ] 清除瀏覽器快取 (`localStorage.clear()`)
- [ ] 重新整理頁面
- [ ] 檢查匿名用戶數是否正確顯示（應該是 14）
- [ ] 把 Console 輸出貼給我確認

完成後告訴我結果，我會繼續添加新的 UI 組件！
