# SwiftTaste 資料庫結構改建計劃

## 概述
本文檔記錄 SwiftTaste 資料庫的已知問題、改建建議和遷移計劃。

---

## 🔍 當前資料庫結構概述

### 核心表格

1. **user_profiles** - 用戶基本資料
2. **user_selection_history** - 選擇記錄（SwiftTaste & Buddies）
3. **swifttaste_interactions** - 用戶互動記錄
4. **buddies_rooms** - Buddies 房間
5. **room_members** - 房間成員
6. **room_votes** - 房間投票
7. **room_recommendations** - 房間推薦
8. **restaurants** - 餐廳基本資料
9. **restaurant_images** - 餐廳圖片
10. **user_favorite_lists** - 收藏清單
11. **favorite_list_places** - 收藏清單內容

---

## ⚠️ 已知問題

### 1. 資料格式不一致

**問題描述**：
- `user_selection_history.basic_answers` 欄位有時是陣列 `[]`，有時是物件 `{}`
- `user_selection_history.fun_answers` 同樣有格式不一致問題
- SwiftTaste 模式存陣列，Buddies 模式可能存物件

**影響**：
- 前端需要複雜的類型檢查和轉換邏輯
- 容易產生 `forEach is not a function` 錯誤
- 查詢和分析困難

**目前暫時解決方案**：
```javascript
// src/components/profile/SwiftTasteHistory.jsx:60-80
// 前端做兼容處理
if (basicAnswers && typeof basicAnswers === 'object' && !Array.isArray(basicAnswers)) {
  Object.assign(answers, basicAnswers);
} else if (Array.isArray(basicAnswers)) {
  // 解析陣列
}
```

**建議改建**：
- 統一為 JSONB 格式，使用固定的 schema
- 或分離為獨立表格（答案明細表）

---

### 2. 餐廳圖片欄位命名混亂

**問題描述**：
- 不同來源的餐廳資料有不同的欄位名稱：
  - `primaryImage.image_url` (Supabase 資料庫)
  - `allImages[0].image_url` (Supabase 資料庫)
  - `restaurant_images[0].image_url` (Supabase 資料庫)
  - `photo_url` (舊格式)
  - `photoURL` (舊格式)
  - `photo` (舊格式)
  - `photos[0]` (Google Places API)

**影響**：
- 需要複雜的 fallback 邏輯提取圖片
- 不同頁面可能顯示不同的圖片
- 維護困難

**目前暫時解決方案**：
```javascript
// src/components/profile/SwiftTasteHistory.jsx:118-163
// 逐一檢查所有可能的欄位
const getPhotoUrl = (restaurant) => {
  if (restaurant.primaryImage?.image_url) return restaurant.primaryImage.image_url;
  if (restaurant.allImages?.[0]?.image_url) return restaurant.allImages[0].image_url;
  // ... 還有 10+ 個檢查
}
```

**建議改建**：
- 在存入資料庫時統一格式
- 使用 `restaurant_images` 表格作為唯一來源
- 新增資料驗證層確保格式一致

---

### 3. 統計數據重複儲存

**問題描述**：
- `user_profiles` 表格儲存統計數據（`swifttaste_count`, `buddies_count`）
- 但這些數據可以從 `user_selection_history` 動態計算
- 更新邏輯複雜，容易不同步

**影響**：
- 資料不一致風險
- 需要額外的更新邏輯
- 之前發生過統計顯示錯誤的問題

**目前解決方案**：
```javascript
// src/services/userDataService.js:478-538
// 每次查詢時動態計算，然後異步更新 cache
const swifttaste_count = sessions?.filter(s => s.mode === 'swifttaste').length || 0;
const buddies_count = sessions?.filter(s => s.mode === 'buddies').length || 0;
```

**建議改建**：
- 選項 A：完全移除 `user_profiles` 的統計欄位，改用 View 或函數
- 選項 B：使用資料庫 Trigger 自動更新統計
- 選項 C：保持現狀，但加強一致性檢查

---

### 4. Session 資料過於龐大

**問題描述**：
- `user_selection_history` 儲存完整的：
  - `basic_answers` (可能很長)
  - `fun_answers` (可能很長)
  - `recommended_restaurants` (完整餐廳物件陣列)
  - `final_restaurant` (完整餐廳物件)
  - `liked_restaurants` (完整餐廳物件陣列)

**影響**：
- 單筆記錄可能非常大（幾 KB 到幾十 KB）
- 查詢效能問題
- 儲存成本高

**建議改建**：
- 只儲存餐廳 ID，透過 JOIN 查詢完整資訊
- 將大型 JSON 欄位分離到獨立表格
- 考慮使用壓縮或歸檔舊資料

---

### 5. 缺少適當的索引

**問題描述**：
- 經常查詢的欄位可能沒有索引
- 例如：`user_selection_history.user_id`, `user_selection_history.mode`

**影響**：
- 查詢效能差
- 資料量增加時會更明顯

**建議改建**：
```sql
-- 建議新增的索引
CREATE INDEX idx_user_selection_history_user_id ON user_selection_history(user_id);
CREATE INDEX idx_user_selection_history_mode ON user_selection_history(mode);
CREATE INDEX idx_user_selection_history_completed_at ON user_selection_history(completed_at);
CREATE INDEX idx_buddies_rooms_status ON buddies_rooms(status);
CREATE INDEX idx_room_members_user_id ON room_members(user_id);
```

---

## 🎯 改建優先順序

### 高優先級（建議 1-2 個月內完成）

1. **統一 basic_answers 和 fun_answers 格式**
   - 影響範圍：中等
   - 難度：中等
   - 風險：低（前端已有兼容邏輯）

2. **新增關鍵索引**
   - 影響範圍：高（效能提升）
   - 難度：低
   - 風險：極低

3. **統一餐廳圖片欄位命名**
   - 影響範圍：高（影響所有餐廳顯示）
   - 難度：高
   - 風險：中等

### 中優先級（建議 3-6 個月內完成）

4. **重構統計數據儲存方式**
   - 影響範圍：中等
   - 難度：中等
   - 風險：中等

5. **優化 Session 資料結構**
   - 影響範圍：高（資料庫大小和效能）
   - 難度：高
   - 風險：高（需要資料遷移）

### 低優先級（可長期規劃）

6. **引入資料分割（Partitioning）**
   - 按時間分割歷史記錄
   - 提升查詢效能

7. **考慮使用時序資料庫**
   - 對於互動記錄可能更適合

---

## 📋 改建計劃：統一 Answer 格式

### 步驟 1：資料審計

```sql
-- 檢查當前資料格式分佈
SELECT
  mode,
  pg_typeof(basic_answers) as basic_type,
  pg_typeof(fun_answers) as fun_type,
  COUNT(*) as count
FROM user_selection_history
GROUP BY mode, pg_typeof(basic_answers), pg_typeof(fun_answers);
```

### 步驟 2：定義標準格式

建議使用 JSONB 物件格式：

```javascript
// 標準格式
{
  "basic_answers": {
    "dining_companions": "單人",
    "price_level": "平價美食",
    "meal_type": "吃",
    "portion_size": "吃飽",
    "spice_level": "不辣"
  },
  "fun_answers": {
    "question_1": "選項A",
    "question_2": "選項B"
  }
}
```

### 步驟 3：資料遷移腳本

```sql
-- 備份表格
CREATE TABLE user_selection_history_backup AS
SELECT * FROM user_selection_history;

-- 遷移 basic_answers（如果是陣列，轉換為物件）
UPDATE user_selection_history
SET basic_answers = (
  SELECT jsonb_object_agg(
    CASE
      WHEN value::text IN ('單人', '多人') THEN 'dining_companions'
      WHEN value::text IN ('平價美食', '奢華美食') THEN 'price_level'
      WHEN value::text IN ('吃', '喝') THEN 'meal_type'
      WHEN value::text IN ('吃一點', '吃飽') THEN 'portion_size'
      WHEN value::text IN ('辣', '不辣') THEN 'spice_level'
      ELSE 'unknown_' || ROW_NUMBER() OVER ()
    END,
    value::text
  )
  FROM jsonb_array_elements(basic_answers) WITH ORDINALITY
)
WHERE jsonb_typeof(basic_answers) = 'array';

-- 類似的遷移 fun_answers
```

### 步驟 4：更新應用程式碼

```javascript
// 更新 selectionHistoryService.js
async saveBasicAnswers(sessionId, answers) {
  // 確保永遠存物件格式
  const answersObject = Array.isArray(answers)
    ? this.convertArrayToObject(answers)
    : answers;

  return await this.updateSession(sessionId, {
    basic_answers: answersObject
  });
}
```

### 步驟 5：驗證和回滾計劃

```sql
-- 驗證遷移
SELECT
  COUNT(*) FILTER (WHERE jsonb_typeof(basic_answers) = 'object') as object_count,
  COUNT(*) FILTER (WHERE jsonb_typeof(basic_answers) = 'array') as array_count,
  COUNT(*) as total_count
FROM user_selection_history;

-- 如果失敗，回滾
DROP TABLE user_selection_history;
ALTER TABLE user_selection_history_backup RENAME TO user_selection_history;
```

---

## 📋 改建計劃：統一餐廳圖片欄位

### 步驟 1：資料遷移到 restaurant_images 表格

```sql
-- 為所有餐廳確保至少有一張主圖片記錄
INSERT INTO restaurant_images (restaurant_id, image_url, is_primary, display_order, created_at)
SELECT
  r.id,
  COALESCE(
    r.photo_url,
    r.photoURL,
    r.photo,
    (r.photos->0)::text,
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4'
  ) as image_url,
  true as is_primary,
  1 as display_order,
  NOW() as created_at
FROM restaurants r
WHERE NOT EXISTS (
  SELECT 1 FROM restaurant_images ri
  WHERE ri.restaurant_id = r.id AND ri.is_primary = true
)
ON CONFLICT DO NOTHING;
```

### 步驟 2：更新應用程式碼統一使用 restaurant_images

```javascript
// 所有地方統一使用這個 query
const { data: restaurants } = await supabase
  .from('restaurants')
  .select(`
    *,
    restaurant_images (
      image_url,
      is_primary,
      display_order
    )
  `)
  .order('restaurant_images.display_order');

// 提取圖片的統一函數
const getPrimaryImage = (restaurant) => {
  const primaryImage = restaurant.restaurant_images?.find(img => img.is_primary);
  return primaryImage?.image_url || restaurant.restaurant_images?.[0]?.image_url || DEFAULT_IMAGE;
};
```

### 步驟 3：移除舊欄位

```sql
-- 確認沒有程式碼依賴後
ALTER TABLE restaurants DROP COLUMN photo_url;
ALTER TABLE restaurants DROP COLUMN photoURL;
ALTER TABLE restaurants DROP COLUMN photo;
ALTER TABLE restaurants DROP COLUMN photos;
```

---

## 🛡️ 風險管理

### 遷移前檢查清單

- [ ] 完整備份資料庫
- [ ] 在測試環境驗證遷移腳本
- [ ] 準備回滾計劃
- [ ] 通知團隊成員
- [ ] 檢查所有依賴程式碼
- [ ] 安排低流量時段執行
- [ ] 準備監控儀表板

### 回滾策略

1. **保留備份表格**至少 30 天
2. **使用事務**確保原子性
3. **分階段執行**，每個步驟都可獨立回滾
4. **監控錯誤日誌**，發現問題立即停止

---

## 📊 效能監控

改建後需要監控的指標：

1. **查詢效能**
   - 平均查詢時間
   - 慢查詢數量
   - 資料庫 CPU 使用率

2. **資料一致性**
   - 格式驗證通過率
   - 資料完整性檢查

3. **使用者影響**
   - 錯誤率變化
   - 頁面載入時間
   - 使用者回報

---

## 🔄 長期維護

### 資料驗證規則

```sql
-- 新增 CHECK 約束確保資料格式
ALTER TABLE user_selection_history
ADD CONSTRAINT check_basic_answers_is_object
CHECK (jsonb_typeof(basic_answers) = 'object' OR basic_answers IS NULL);

ALTER TABLE user_selection_history
ADD CONSTRAINT check_fun_answers_is_object
CHECK (jsonb_typeof(fun_answers) = 'object' OR fun_answers IS NULL);
```

### 定期資料品質檢查

```sql
-- 每週執行的資料品質報告
SELECT
  'basic_answers_format' as check_name,
  COUNT(*) FILTER (WHERE jsonb_typeof(basic_answers) != 'object') as issues_count
FROM user_selection_history
UNION ALL
SELECT
  'missing_restaurant_images' as check_name,
  COUNT(*) as issues_count
FROM restaurants r
WHERE NOT EXISTS (
  SELECT 1 FROM restaurant_images ri
  WHERE ri.restaurant_id = r.id AND ri.is_primary = true
);
```

---

## 📚 相關文檔

- [資料庫清理指南](./database-cleanup-guide.md)
- Supabase 文檔：https://supabase.com/docs
- PostgreSQL 最佳實踐：https://wiki.postgresql.org/wiki/Don't_Do_This

---

**最後更新**：2025-12-21
**維護者**：SwiftTaste 開發團隊
**狀態**：規劃中

---

## 💡 決策記錄

### 2025-12-21：發現 Answer 格式不一致問題
- **問題**：basic_answers 有時是陣列有時是物件
- **暫時方案**：前端做兼容處理
- **長期方案**：統一為物件格式
- **決定**：延後遷移，先修復前端

### 2025-12-21：餐廳照片欄位混亂
- **問題**：10+ 種不同的照片欄位名稱
- **暫時方案**：逐一檢查所有可能欄位
- **長期方案**：統一使用 restaurant_images 表格
- **決定**：規劃中，需要評估影響範圍
