# 🏗️ 統一數據架構設計

## 問題：避免數據重複

當前設計中，**SwiftTaste** 和 **Buddies** 兩種模式都需要記錄互動，可能與現有表格產生重複。

---

## 📊 當前架構分析

### SwiftTaste 模式

**現有表：** `user_selection_history`
```sql
- swipe_count          -- 滑動次數
- liked_restaurants    -- 喜歡的餐廳（JSONB 數組）
- final_restaurant     -- 最終選擇
```

**新表：** `swifttaste_interactions`
```sql
- session_id, restaurant_id, action_type (view/like/skip), created_at
```

**重複問題：**
- `swipe_count` vs 互動表總數
- `liked_restaurants` vs action_type = 'like' 的記錄

---

### Buddies 模式

**現有表：** `buddies_rooms`
```sql
- votes JSONB          -- 投票結果 {"restaurant_id": vote_count}
- final_restaurant_id  -- 最終餐廳
- final_restaurant_data JSONB
```

**新表：** `buddies_interactions`
```sql
- room_id, user_id, restaurant_id, action_type (view/like/skip/vote), created_at
```

**重複問題：**
- `votes` vs action_type = 'vote' 的統計
- `final_restaurant_id` vs 最終投票結果

---

## ✅ **推薦方案：Denormalization for Performance**

### 核心原則

1. **摘要數據** → 存在主表（user_selection_history, buddies_rooms）
2. **詳細互動** → 存在互動表（swifttaste_interactions, buddies_interactions）
3. **自動同步** → 使用觸發器保持一致性

---

## 📋 統一架構設計

### 方案 A：完全分離（推薦）⭐

**適用場景：** 需要詳細分析用戶行為

#### SwiftTaste 架構

```
user_selection_history (摘要表)
├── session_id
├── started_at, completed_at
├── questions_started_at, fun_questions_started_at, restaurants_started_at
└── final_restaurant (JSONB)

swifttaste_interactions (詳細互動表)
├── session_id
├── restaurant_id, action_type, created_at
└── metadata (JSONB)

🔗 關係：user_selection_history.id = swifttaste_interactions.session_id
```

**保留的快取欄位（可選）：**
- `swipe_count` - 快速統計用
- `liked_restaurants` - 快速訪問用

**刪除的欄位（從互動表計算）：**
- 無（保留快取以提升效能）

#### Buddies 架構

```
buddies_rooms (摘要表)
├── room_id
├── created_at, questions_started_at, voting_started_at, completed_at
├── final_restaurant_id, final_restaurant_data (JSONB)
└── votes (JSONB) - 快取

buddies_interactions (詳細互動表)
├── room_id, user_id
├── restaurant_id, action_type, created_at
└── metadata (JSONB)

🔗 關係：buddies_rooms.id = buddies_interactions.room_id
```

**保留的快取欄位：**
- `votes` - 投票統計快取
- `final_restaurant_data` - 最終結果快取

---

### 方案 B：純 JSONB（簡化）

**適用場景：** 不需要複雜查詢，只需要存儲

#### SwiftTaste 架構

```sql
user_selection_history
├── session_id
├── started_at, completed_at
├── interactions JSONB  -- ✨ 新增：所有互動記錄
    [
      {
        "restaurant_id": "xxx",
        "action": "view",
        "timestamp": "2025-10-28T10:00:00Z"
      },
      {
        "restaurant_id": "xxx",
        "action": "like",
        "timestamp": "2025-10-28T10:00:05Z"
      }
    ]
└── final_restaurant (JSONB)
```

**缺點：**
- ❌ 無法高效查詢「哪些餐廳被查看最多」
- ❌ 無法建立索引
- ❌ JSONB 查詢語法複雜

---

## 🎯 **最終建議：方案 A（完全分離 + 快取）**

### 實施方式

#### 1. SwiftTaste 數據流

```javascript
// 記錄互動到專門的表
await swiftTasteInteractionService.recordView(sessionId, restaurantId);
await swiftTasteInteractionService.recordLike(sessionId, restaurantId);

// 觸發器自動更新快取
// user_selection_history.swipe_count 自動增加
// user_selection_history.liked_restaurants 自動更新
```

#### 2. Buddies 數據流

```javascript
// 記錄互動到專門的表
await buddiesInteractionService.recordVote(roomId, userId, restaurantId);

// 手動更新快取（因為需要即時顯示）
const votes = { [restaurantId]: voteCount };
await buddiesInteractionService.updateRoomVotes(roomId, votes);
```

---

## 📊 查詢策略

### 快速查詢（使用快取）

```sql
-- SwiftTaste：獲取會話基本資料
SELECT swipe_count, liked_restaurants
FROM user_selection_history
WHERE id = 'session-id';

-- Buddies：獲取房間投票結果
SELECT votes, final_restaurant_data
FROM buddies_rooms
WHERE id = 'room-id';
```

### 詳細分析（查詢互動表）

```sql
-- SwiftTaste：分析用戶行為
SELECT
  restaurant_id,
  COUNT(*) FILTER (WHERE action_type = 'view') as views,
  COUNT(*) FILTER (WHERE action_type = 'like') as likes,
  COUNT(*) FILTER (WHERE action_type = 'skip') as skips
FROM swifttaste_interactions
WHERE session_id = 'session-id'
GROUP BY restaurant_id;

-- Buddies：分析群組互動
SELECT
  restaurant_id,
  COUNT(DISTINCT user_id) as unique_voters,
  COUNT(*) FILTER (WHERE action_type = 'vote') as votes
FROM buddies_interactions
WHERE room_id = 'room-id'
GROUP BY restaurant_id;
```

### 合併查詢（使用視圖）

```sql
-- 使用視圖簡化查詢
SELECT * FROM v_swifttaste_sessions_with_interactions
WHERE id = 'session-id';

SELECT * FROM v_buddies_rooms_with_interactions
WHERE id = 'room-id';
```

---

## 🔄 數據同步策略

### 自動同步（觸發器）

適用於：SwiftTaste 的 swipe_count 和 liked_restaurants

```sql
CREATE TRIGGER trg_update_swifttaste_cache
AFTER INSERT ON swifttaste_interactions
FOR EACH ROW
EXECUTE FUNCTION update_selection_history_cache();
```

### 手動同步（程式碼）

適用於：Buddies 的 votes（需要即時顯示）

```javascript
// 每次投票後立即更新
await voteService.vote(roomId, userId, restaurantId);
await buddiesInteractionService.updateRoomVotes(roomId, votes);
```

---

## 🧪 一致性檢查

### 定期執行數據一致性檢查

```sql
-- 檢查 SwiftTaste 快取是否與實際數據一致
SELECT * FROM check_swifttaste_data_consistency();

-- 檢查 Buddies 快取是否與實際數據一致
SELECT * FROM check_buddies_data_consistency();
```

### 自動修復（可選）

```sql
-- 重建 SwiftTaste 快取
UPDATE user_selection_history
SET
  swipe_count = (
    SELECT COUNT(*) FROM swifttaste_interactions
    WHERE session_id = user_selection_history.id
  ),
  liked_restaurants = (
    SELECT json_agg(jsonb_build_object('id', restaurant_id))
    FROM swifttaste_interactions
    WHERE session_id = user_selection_history.id
    AND action_type = 'like'
  )
WHERE mode = 'swifttaste';

-- 重建 Buddies 快取
UPDATE buddies_rooms
SET
  votes = (
    SELECT jsonb_object_agg(restaurant_id, vote_count)
    FROM (
      SELECT restaurant_id, COUNT(*) as vote_count
      FROM buddies_interactions
      WHERE room_id = buddies_rooms.id
      AND action_type = 'vote'
      GROUP BY restaurant_id
    ) as vote_stats
  );
```

---

## 📈 效能考量

### 優點

| 方面 | 快取欄位 | 互動表 |
|-----|---------|--------|
| 查詢速度 | ⚡ 極快（直接讀取） | 🔍 需要聚合查詢 |
| 存儲空間 | 💾 小（摘要） | 💾 大（詳細） |
| 分析能力 | ❌ 有限 | ✅ 強大 |
| 維護成本 | ⚠️ 需要同步 | ✅ 自動一致 |

### 建議

1. **常用查詢** → 使用快取欄位（如 Admin 總覽頁）
2. **詳細分析** → 查詢互動表（如 數據分析頁）
3. **即時顯示** → 使用快取 + 手動更新（如 Buddies 投票）

---

## 🎯 最終架構圖

```
┌─────────────────────────────────────────┐
│         SwiftTaste 模式                  │
├─────────────────────────────────────────┤
│  user_selection_history (摘要 + 快取)    │
│  ├── session_id                          │
│  ├── timestamps                          │
│  ├── swipe_count (快取)                  │
│  └── liked_restaurants (快取)            │
│                                          │
│  swifttaste_interactions (詳細)          │
│  ├── session_id                          │
│  ├── restaurant_id                       │
│  ├── action_type                         │
│  └── created_at                          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│         Buddies 模式                     │
├─────────────────────────────────────────┤
│  buddies_rooms (摘要 + 快取)             │
│  ├── room_id                             │
│  ├── timestamps                          │
│  ├── votes (快取)                        │
│  └── final_restaurant_data (快取)        │
│                                          │
│  buddies_interactions (詳細)             │
│  ├── room_id, user_id                    │
│  ├── restaurant_id                       │
│  ├── action_type                         │
│  └── created_at                          │
└─────────────────────────────────────────┘

🔄 同步策略：
- SwiftTaste: 觸發器自動同步
- Buddies: 程式碼手動同步（即時性要求）
```

---

## ✅ 結論

**採用「完全分離 + 快取」架構**：

1. ✅ **不刪除現有欄位** - 保留快取以提升效能
2. ✅ **新增互動表** - 詳細記錄所有互動
3. ✅ **自動同步** - 觸發器保持一致性
4. ✅ **靈活查詢** - 可以選擇快速或詳細模式

這樣既保留了快速查詢的能力，又提供了詳細分析的可能性，是最佳的折衷方案！🎯
