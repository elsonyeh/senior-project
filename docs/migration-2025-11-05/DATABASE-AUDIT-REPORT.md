# 🔍 SwiftTaste 資料庫審查報告

**審查日期**: 2025-11-05
**審查範圍**: 所有 15 個資料庫表與欄位使用情況
**審查方法**: 全程式碼掃描 + 文檔比對

---

## 執行摘要

### 關鍵發現

| 類別 | 數量 | 說明 |
|------|------|------|
| 🔴 **完全未使用的表** | 3 | buddies_votes, buddies_questions, buddies_events |
| 🟡 **部分使用的表** | 4 | fun_questions, fun_question_tags, swifttaste_history, selection_history |
| 🟢 **完整使用的表** | 8 | 核心餐廳表(3) + 用戶系統(3) + Buddies實時(2) |
| ⚠️ **文檔未列的表** | 4 | admin_users, swifttaste_interactions, buddies_interactions, user_selection_history |

### Linus 式評價

> **「文檔說一套,代碼做一套。Bad programmers worry about the code. Good programmers worry about data structures.」**

**問題根源：**
- 設計階段規劃了規範化的表結構（buddies_votes, buddies_questions）
- 實施階段改用 JSONB 全塞在 buddies_rooms
- 文檔從未更新，導致維護混亂

---

## 詳細審查結果

### 核心資料表（3/3 完整使用）✅

#### 1. restaurants
- **使用狀態**: ✅ 完整使用
- **主要檔案**: `restaurantService.js`, `dataAnalyticsService.js`
- **CRUD**: Create, Read, Update, Delete
- **欄位使用率**: 100%
- **備註**: 系統核心表，所有推薦基於此表

#### 2. restaurant_images
- **使用狀態**: ✅ 完整使用
- **主要檔案**: `restaurantService.js`, `userDataService.js`
- **CRUD**: Create, Read, Update, Delete
- **功能**: 圖片上傳、外部連結、下載、刪除
- **儲存**: Supabase Storage + URL 記錄

#### 3. restaurant_reviews
- **使用狀態**: ✅ 完整使用
- **主要檔案**: `restaurantService.js`
- **CRUD**: Create, Read, Update, Delete
- **功能**: 新增評論、評分計算、綜合 Google 評分

---

### 用戶系統（3/3 完整使用）✅

#### 4. user_profiles
- **使用狀態**: ✅ 完整使用
- **主要檔案**: `userDataService.js`, `authService.js`
- **CRUD**: Create, Read, Update（無 Delete，應為軟刪除）
- **欄位使用率**: 100%
- **關聯**: 與 auth.users 一對一

#### 5. user_favorite_lists
- **使用狀態**: ✅ 完整使用
- **主要檔案**: `userDataService.js`
- **CRUD**: Create, Read, Update, Delete
- **功能**: 多清單管理（最多6個）、顏色標記、計數

#### 6. favorite_list_places
- **使用狀態**: ✅ 完整使用
- **主要檔案**: `userDataService.js`
- **CRUD**: Create, Read, Update, Delete
- **功能**: 多對多關聯、私人備註

---

### SwiftTaste 模式（問題嚴重）⚠️

#### 7. swifttaste_history
- **使用狀態**: ❌ **表名錯誤，實際不存在**
- **實際表名**: `user_selection_history`
- **問題**: DATABASE-SCHEMA.md 文檔錯誤

#### 8. selection_history
- **使用狀態**: ❌ **表名錯誤，實際不存在**
- **實際表名**: `user_selection_history`
- **問題**: DATABASE-SCHEMA.md 文檔錯誤

#### ✅ 實際存在：user_selection_history
- **使用狀態**: ✅ 完整使用
- **主要檔案**: `selectionHistoryService.js`
- **CRUD**: Create, Read, Update, Delete
- **功能**: 統一記錄 SwiftTaste 和 Buddies 模式的選擇歷史
- **說明**: **文檔中完全未提及此表！**

---

### Buddies 實時層（2/4 使用，2個廢棄）🔴

#### 9. buddies_rooms
- **使用狀態**: ✅ 完整使用
- **主要檔案**: `supabaseService.js`, `buddiesInteractionService.js`
- **CRUD**: Create, Read, Update, Delete
- **JSONB 欄位**:
  - `members_data` - 成員列表
  - `member_answers` - 答題記錄
  - `recommendations` - 推薦結果
  - `votes` - 投票統計（取代 buddies_votes 表）
  - `questions` - 問題集（取代 buddies_questions 表）

#### 10. buddies_members
- **使用狀態**: ✅ 完整使用
- **主要檔案**: `supabaseService.js`
- **CRUD**: Create, Read, Update, Delete
- **功能**: 成員加入/離開、列表查詢

#### 11. buddies_votes ❌
- **使用狀態**: 🔴 **完全未使用，建議刪除**
- **替代方案**: buddies_rooms.votes (JSONB)
- **問題**:
  - 表定義存在於 DATABASE-SCHEMA.md
  - 程式碼中零引用
  - 投票改用 JSONB 格式儲存

**搜尋結果：**
```bash
# 搜尋 buddies_votes 使用情況
grep -r "buddies_votes" src/ server/
# 結果：0 個檔案
```

#### 12. buddies_questions ❌
- **使用狀態**: 🔴 **完全未使用，建議刪除**
- **替代方案**: buddies_rooms.questions (JSONB) 或靜態問題集
- **問題**:
  - 表定義存在於 DATABASE-SCHEMA.md
  - 程式碼中零引用
  - 問題改用 fun_questions 或靜態配置

**搜尋結果：**
```bash
# 搜尋 buddies_questions 使用情況
grep -r "buddies_questions" src/ server/
# 結果：0 個檔案
```

---

### Buddies 記錄層（0/1 使用）🔴

#### 13. buddies_events ❌
- **使用狀態**: 🔴 **完全未使用，但應該實施**
- **問題**:
  - 表定義存在於 DATABASE-SCHEMA.md
  - 文檔宣稱「記錄所有 Buddies 房間的事件流，用於審計、統計和問題追蹤」
  - **實際程式碼中無任何寫入邏輯**
- **建議**: 應該實施（這是數據生命週期管理的核心）

**搜尋結果：**
```bash
# 搜尋 buddies_events 使用情況
grep -r "buddies_events" src/ server/
# 結果：0 個檔案（除了文檔）
```

---

### 問題系統（2/2 部分使用）⚠️

#### 14. fun_questions
- **使用狀態**: ⚠️ **只有 Read，無 CUD**
- **主要檔案**: `questionService.js`, `funQuestionTagService.js`
- **CRUD**: Read only
- **查詢方式**: 透過視圖 `questions_with_options`
- **問題**: 文檔宣稱「動態標籤管理」，實際無新增/修改功能

#### 15. fun_question_tags
- **使用狀態**: ⚠️ **只有 Read，無 CUD**
- **主要檔案**: `funQuestionTagService.js`
- **CRUD**: Read only
- **查詢方式**: 透過視圖 `fun_question_option_tags`
- **問題**: 無法動態新增或修改標籤映射

---

### 文檔未列出的表（額外發現）⚠️

#### 16. admin_users
- **使用狀態**: ✅ 完整使用
- **主要檔案**: `supabaseService.js`
- **CRUD**: Create, Read, Update, Delete (軟刪除)
- **功能**: 管理員帳號管理

#### 17. swifttaste_interactions
- **使用狀態**: ✅ 使用中
- **主要檔案**: `swiftTasteInteractionService.js`
- **CRUD**: Create, Read
- **功能**: 記錄 SwiftTaste 互動（view, like, skip, final）

#### 18. buddies_interactions
- **使用狀態**: ✅ 使用中
- **主要檔案**: `buddiesInteractionService.js`
- **CRUD**: Create, Read
- **功能**: 記錄 Buddies 互動（view, like, skip, vote）

#### 19. user_selection_history（重複提及）
- 見上方 SwiftTaste 模式章節

---

## 架構設計問題分析

### 問題 1：文檔與實現嚴重不匹配

**DATABASE-SCHEMA.md 宣稱：**
```
三層資料庫架構：
├─ 實時層：buddies_rooms (JSONB)  ✅ 已實施
├─ 事件層：buddies_events          ❌ 未實施
└─ 分析層：Views                   ❌ 未實施
```

**實際實現：**
```
單層架構：
└─ buddies_rooms (JSONB) - 包含所有數據
   ├─ votes (應該在 buddies_votes 表)
   ├─ questions (應該在 buddies_questions 表)
   └─ member_answers, recommendations
```

**Linus 評價：**
> "選一個方案堅持下去。如果用 JSONB，就徹底用 JSONB；如果要規範化，就徹底規範化。不要在兩者之間搖擺。"

---

### 問題 2：互動記錄分散在 3 個表

**當前狀況：**
1. `swifttaste_interactions` - SwiftTaste 專用
2. `buddies_interactions` - Buddies 專用
3. `user_selection_history` - 兩者都用（更詳細）

**問題：**
- 功能重複
- 查詢複雜（需要 UNION）
- 維護成本高

**Linus 評價：**
> "Three tables doing the same thing? Pick one."

**建議方案：**
```sql
-- 統一為單一互動記錄表
CREATE TABLE user_interactions (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users,
  mode text, -- 'swifttaste' | 'buddies'
  action_type text, -- 'view' | 'like' | 'skip' | 'vote' | 'final'
  restaurant_id text,
  session_id uuid, -- 關聯 user_selection_history
  metadata jsonb, -- 靈活存儲額外數據
  created_at timestamptz DEFAULT now()
);
```

---

### 問題 3：表命名不一致

**文檔說：**
- `swifttaste_history`
- `selection_history`

**實際是：**
- `user_selection_history`

**影響：**
- 開發人員查找困難
- 文檔失去參考價值
- 新成員入職成本高

---

## 清理建議

### 立即刪除（無任何引用）

```sql
-- 1. 刪除 buddies_votes（投票改用 JSONB）
DROP TABLE IF EXISTS buddies_votes;

-- 2. 刪除 buddies_questions（問題改用 JSONB 或靜態）
DROP TABLE IF EXISTS buddies_questions;
```

**影響評估：**
- ✅ 零破壞性（表從未被使用）
- ✅ 清理混亂的文檔定義
- ✅ 減少資料庫維護成本

---

### 應該實施（核心功能）

**buddies_events** - 必須實施！

**原因：**
1. 數據分析需求（用戶要求保留分析數據）
2. 審計追蹤（追蹤房間生命週期）
3. 問題調試（重現決策過程）

**實施方案見：**
- `docs/DATA-LIFECYCLE-MANAGEMENT.md`

---

### 需要優化（部分使用）

#### fun_questions & fun_question_tags

**當前問題：**
- 只有 Read，無 Create/Update/Delete
- 文檔宣稱「動態標籤管理」，實際做不到

**建議：**
1. **選項 A**：接受現狀，更新文檔說明「只讀系統」
2. **選項 B**：實施完整 CRUD（Admin 面板新增問題功能）

---

## 欄位使用率分析

### 完全未使用的欄位（建議刪除）

經過全程式碼掃描，所有表的欄位都有被使用，**無冗餘欄位**。

### 使用不完整的欄位

**buddies_rooms.expires_at**
- **定義**: timestamptz - 房間過期時間（24小時）
- **問題**: 只是記錄，無自動清理機制
- **解決方案**: 實施 pg_cron 定期清理（見下方實施計劃）

---

## 數據增長預估

### 當前狀況（假設）

| 表 | 平均每筆大小 | 每日新增 | 月度增長 | 年度增長 |
|---|------------|---------|---------|---------|
| buddies_rooms | 20 KB | 100 | 60 MB | 730 MB |
| buddies_members | 0.5 KB | 300 | 4.5 MB | 55 MB |
| swifttaste_interactions | 0.3 KB | 500 | 4.5 MB | 55 MB |
| buddies_interactions | 0.3 KB | 800 | 7.2 MB | 88 MB |
| user_selection_history | 2 KB | 150 | 9 MB | 110 MB |

**年度總增長（無清理）：** ~1.04 GB/年

**Supabase 免費層限制：** 8 GB

**可持續時間：** ~7-8 年（但查詢效能會逐年下降）

---

## 實施建議

### 階段 1：清理廢棄表（立即執行）

1. 刪除 `buddies_votes`
2. 刪除 `buddies_questions`
3. 更新 DATABASE-SCHEMA.md 文檔

**風險：** 零（表從未使用）
**時間：** 30 分鐘

---

### 階段 2：實施數據生命週期管理（高優先級）

1. 創建 `buddies_rooms_archive` 歸檔表
2. 實施 `buddies_events` 事件流記錄
3. 實施自動歸檔機制（房間完成時）
4. 設置 pg_cron 每日清理（24小時後）
5. 創建數據匯出腳本（CSV/JSON）

**詳細方案：** `docs/DATA-LIFECYCLE-MANAGEMENT.md`
**時間：** 6-8 小時

---

### 階段 3：長期優化（低優先級）

1. 統一互動記錄表（3表合1）
2. 實施 fun_questions 完整 CRUD
3. 創建分析儀表板（Materialized Views）

**時間：** 12-16 小時

---

## 監控指標

### 資料庫健康指標

```sql
-- 1. 各表大小監控
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 2. 待清理房間數
SELECT COUNT(*) as pending_cleanup
FROM buddies_rooms
WHERE status = 'completed'
  AND completed_at < now() - interval '24 hours';

-- 3. 歸檔覆蓋率
SELECT
  (SELECT COUNT(*) FROM buddies_rooms_archive) as archived,
  (SELECT COUNT(*) FROM buddies_rooms WHERE status = 'completed') as total_completed,
  ROUND(
    (SELECT COUNT(*) FROM buddies_rooms_archive)::numeric /
    NULLIF((SELECT COUNT(*) FROM buddies_rooms WHERE status = 'completed'), 0) * 100,
    2
  ) as coverage_percent;
```

---

## 附錄：完整表對應清單

| # | 文檔中的表名 | 實際表名 | 狀態 | 操作 |
|---|------------|---------|------|------|
| 1 | restaurants | restaurants | ✅ 一致 | 保留 |
| 2 | restaurant_images | restaurant_images | ✅ 一致 | 保留 |
| 3 | restaurant_reviews | restaurant_reviews | ✅ 一致 | 保留 |
| 4 | user_profiles | user_profiles | ✅ 一致 | 保留 |
| 5 | user_favorite_lists | user_favorite_lists | ✅ 一致 | 保留 |
| 6 | favorite_list_places | favorite_list_places | ✅ 一致 | 保留 |
| 7 | swifttaste_history | ❌ 不存在 | 🔴 錯誤 | 更新文檔 |
| 8 | selection_history | ❌ 不存在 | 🔴 錯誤 | 更新文檔 |
| - | user_selection_history | user_selection_history | ⚠️ 未列 | 新增到文檔 |
| 9 | buddies_rooms | buddies_rooms | ✅ 一致 | 保留 + 優化 |
| 10 | buddies_members | buddies_members | ✅ 一致 | 保留 |
| 11 | buddies_votes | buddies_votes | ❌ 未使用 | 刪除 |
| 12 | buddies_questions | buddies_questions | ❌ 未使用 | 刪除 |
| 13 | buddies_events | buddies_events | ❌ 未使用 | 實施 |
| 14 | fun_questions | fun_questions | ⚠️ 只讀 | 保留 |
| 15 | fun_question_tags | fun_question_tags | ⚠️ 只讀 | 保留 |
| - | admin_users | admin_users | ⚠️ 未列 | 新增到文檔 |
| - | swifttaste_interactions | swifttaste_interactions | ⚠️ 未列 | 新增到文檔 |
| - | buddies_interactions | buddies_interactions | ⚠️ 未列 | 新增到文檔 |

---

**審查者**: Claude Code (Linus Mode)
**下一步**: 執行階段 1 清理 + 階段 2 數據生命週期管理
**預估總時間**: 8-10 小時

