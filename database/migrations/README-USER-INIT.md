# 用戶初始化觸發器說明

## 概述

這個遷移為 SwiftTaste 系統實現了自動化的用戶初始化流程。當新用戶註冊時，系統會自動創建必要的資料記錄，包括用戶資料和預設收藏清單。

## 功能特點

### 1. **自動化用戶資料初始化**
當用戶通過任何方式註冊（Email、Google、Apple）時，觸發器會自動：
- 在 `user_profiles` 表中創建用戶資料記錄
- 創建一個名為「我的最愛」的預設收藏清單
- 設置清單為不可刪除狀態

### 2. **預設收藏清單特性**
- **名稱**: 「我的最愛」
- **顏色**: #ff6b35 (橘紅色)
- **is_default**: true (標記為預設清單)
- **is_deletable**: false (無法被用戶刪除)
- **is_public**: false (私密清單)

### 3. **向後兼容**
- 遷移腳本會為所有現有用戶補充預設收藏清單
- 不會影響已存在的用戶資料和清單

## 資料庫變更

### 新增欄位
在 `user_favorite_lists` 表中新增兩個欄位：

```sql
is_default BOOLEAN DEFAULT false    -- 標記是否為預設清單
is_deletable BOOLEAN DEFAULT true   -- 標記是否可以被刪除
```

### 新增函數
- `initialize_new_user()`: 處理新用戶初始化邏輯

### 新增觸發器
- `on_auth_user_created`: 在 `auth.users` 表新增記錄時觸發

## 執行步驟

1. **執行 SQL 遷移**
   ```sql
   -- 在 Supabase Dashboard 的 SQL Editor 中執行
   -- 文件: 2025-11-05-create-user-init-trigger.sql
   ```

2. **驗證設置**
   執行遷移後會自動顯示驗證結果：
   - 觸發器數量
   - 已創建的預設清單數量

3. **測試新用戶註冊**
   - 註冊一個新用戶
   - 檢查是否自動創建了 `user_profiles` 記錄
   - 檢查是否自動創建了「我的最愛」收藏清單

## 前端整合

### SwiftTaste.jsx 變更

**原始邏輯 (移除)**:
```javascript
// ❌ 舊代碼：動態創建預設清單
if (listsResult.lists.length === 0) {
  const createResult = await userDataService.createFavoriteList(...);
}
```

**新邏輯**:
```javascript
// ✅ 新代碼：直接使用預設清單
const defaultList = listsResult.lists.find(list => list.is_default) || listsResult.lists[0];
setDefaultFavoriteListId(defaultList.id);
```

### userDataService.js 變更

**deleteFavoriteList 函數**:
```javascript
// 新增檢查：防止刪除預設清單
if (list && list.is_deletable === false) {
  return {
    success: false,
    error: `「${list.name}」是預設清單，無法刪除`
  };
}
```

**getFavoriteLists 函數**:
```javascript
// 新增查詢欄位
is_default,
is_deletable,

// 新增排序：預設清單排在最前面
.order('is_default', { ascending: false })
```

## 測試檢查清單

- [ ] 執行 SQL 遷移腳本
- [ ] 確認觸發器已創建
- [ ] 確認現有用戶都有預設清單
- [ ] 註冊新用戶測試
- [ ] 檢查新用戶是否有「我的最愛」清單
- [ ] 嘗試刪除預設清單（應該被拒絕）
- [ ] 測試 SwiftTaste 收藏功能

## 查詢命令

### 檢查觸發器狀態
```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

### 檢查預設清單
```sql
SELECT
  ufl.id,
  ufl.user_id,
  up.email,
  ufl.name,
  ufl.is_default,
  ufl.is_deletable
FROM user_favorite_lists ufl
JOIN user_profiles up ON ufl.user_id = up.id
WHERE ufl.is_default = true
ORDER BY ufl.created_at DESC;
```

### 查找沒有預設清單的用戶
```sql
SELECT
  u.id,
  u.email,
  up.name
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.id
WHERE NOT EXISTS (
  SELECT 1 FROM user_favorite_lists
  WHERE user_id = u.id
  AND is_default = true
);
```

## 故障排除

### 問題：新用戶沒有預設清單

**可能原因**:
1. 觸發器未正確創建
2. 觸發器執行失敗（查看日誌）
3. 權限問題

**解決方法**:
```sql
-- 手動為用戶創建預設清單
INSERT INTO user_favorite_lists (
  user_id,
  name,
  description,
  color,
  is_public,
  is_default,
  is_deletable
) VALUES (
  'user-uuid-here',
  '我的最愛',
  'SwiftTaste 收藏的餐廳',
  '#ff6b35',
  false,
  true,
  false
);
```

### 問題：無法刪除某個清單

**檢查**:
```sql
SELECT is_deletable FROM user_favorite_lists WHERE id = 'list-id-here';
```

如果 `is_deletable = false`，這是預設清單，無法刪除屬於正常行為。

## 注意事項

1. **預設清單是永久的**: 用戶無法刪除「我的最愛」清單
2. **用戶可以創建額外清單**: 預設清單不影響用戶創建其他收藏清單
3. **觸發器是自動的**: 不需要前端代碼處理初始化邏輯
4. **向後兼容**: 現有用戶會自動補充預設清單

## 相關文件

- SQL 遷移: `2025-11-05-create-user-init-trigger.sql`
- 前端服務: `src/services/userDataService.js`
- 前端組件: `src/components/SwiftTaste.jsx`
