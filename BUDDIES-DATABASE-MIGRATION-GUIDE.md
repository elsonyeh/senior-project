# Buddies 模式資料庫遷移指南

本指南說明 Buddies 模式相關的資料庫 Schema 和遷移腳本。

## 📁 SQL 腳本清單

### 1. 主要 Schema 建立腳本

#### `create-buddies-schema.sql`
**用途**: 建立 Buddies 模式的完整資料庫 Schema
**狀態**: ✅ 最新版本（包含版本 1.2 所有欄位）
**執行時機**: 首次設定或重建資料庫時

**包含的表格**:
- `buddies_rooms` - 房間資訊（含集體答案、問題索引）
- `buddies_members` - 成員資訊（含狀態欄位）
- `buddies_questions` - 問題集
- `buddies_answers` - 個人答案
- `buddies_recommendations` - 推薦結果
- `buddies_votes` - 用戶餐廳投票追蹤（追蹤每位用戶投票的餐廳）
- `buddies_restaurant_votes` - 餐廳票數統計（統計每間餐廳的總票數）
- `buddies_final_results` - 最終結果

**重要欄位說明**:

**buddies_rooms**:
- `collective_answers` (JSONB) - 集體決策答案，格式: `{"0": "吃", "1": "平價美食"}`
- `current_question_index` (INTEGER) - 當前題目索引
- `last_updated` (TIMESTAMPTZ) - 最後更新時間

**buddies_members**:
- `status` (TEXT) - 成員狀態: `'active'` 或 `'left'`

---

### 2. 功能增強腳本

#### `enable-realtime-for-buddies.sql`
**用途**: 為所有 Buddies 表格啟用 Supabase Realtime
**狀態**: ✅ 已執行
**執行時機**: Schema 建立後立即執行

**功能**:
- 將 8 個 Buddies 表加入 `supabase_realtime` publication
- 確保所有成員能即時收到資料更新

---

#### `add-collective-answers-to-buddies-rooms.sql`
**用途**: 為 `buddies_rooms` 新增集體決策欄位
**狀態**: ✅ 已執行
**版本**: 1.2（2025-02-03）

**新增欄位**:
- `collective_answers` (JSONB) - 多數決結果
- `current_question_index` (INTEGER) - 問題進度

**注意**: 如果使用最新版 `create-buddies-schema.sql`，此腳本不需要執行（欄位已包含）

---

#### `fix-buddies-votes-constraint.sql`
**用途**: 修復 `buddies_votes` 表的 UNIQUE 約束
**狀態**: ⚠️ 已過時（被 fix-buddies-schema-missing-columns.sql 取代）
**執行時機**: 版本 1.1 更新時

**功能**:
- 將約束從 `(room_id, user_id)` 改為 `(room_id, user_id, restaurant_id)`
- 允許同一用戶為不同餐廳投票

**注意**: 此腳本已被新版修復腳本取代，可忽略

---

#### `cleanup-buddies-deprecated-columns.sql` 🧹 新增
**用途**: 清理舊的、不再使用的欄位以釋放資料庫空間
**狀態**: 🆕 可選執行
**執行時機**: 資料庫從舊版遷移後（確認新欄位正常運作後執行）

**清理項目**:
- `buddies_votes.question_id` - 舊的問題投票欄位
- `buddies_votes.option` - 舊的問題選項欄位
- `buddies_restaurant_votes.user_id` - 錯誤的用戶ID欄位
- 舊的 UNIQUE 約束
- 未使用的索引

**執行後操作**:
- VACUUM FULL 回收磁碟空間

⚠️ **重要警告**:
- 此操作不可逆！執行前請備份資料
- VACUUM FULL 會鎖定表格，建議在低流量時段執行

---

#### `fix-buddies-schema-missing-columns.sql` ⚡ 新增
**用途**: 修復程式碼使用但 Schema 缺少的欄位
**狀態**: 🆕 待執行
**執行時機**: 如果資料庫使用舊版 Schema 建立

**修復項目**:
- `buddies_members.status` - 成員狀態欄位
- `buddies_rooms.last_updated` - 最後更新時間
- `buddies_votes` UNIQUE 約束

---

## 🚀 執行順序

### 新專案建立（從零開始）

如果你要從零建立 Buddies 資料庫：

```sql
-- 步驟 1: 建立完整 Schema（最新版本）
-- 執行: create-buddies-schema.sql

-- 步驟 2: 啟用 Realtime
-- 執行: enable-realtime-for-buddies.sql

-- 完成！無需執行其他腳本
```

### 現有專案更新至版本 1.2

如果你的資料庫是用舊版 Schema 建立的：

```sql
-- 步驟 1: 新增集體答案欄位（如果尚未執行）
-- 執行: add-collective-answers-to-buddies-rooms.sql

-- 步驟 2: 修復缺少的欄位
-- 執行: fix-buddies-schema-missing-columns.sql

-- 步驟 3: 確認 Realtime 已啟用（如果尚未執行）
-- 執行: enable-realtime-for-buddies.sql

-- 步驟 4（可選）: 清理舊欄位以釋放空間
-- ⚠️ 請先確認新功能正常運作再執行此步驟
-- ⚠️ 建議在低流量時段執行
-- 執行: cleanup-buddies-deprecated-columns.sql

-- 完成！
```

---

## ✅ 驗證檢查清單

執行完所有腳本後，執行以下查詢驗證：

### 1. 檢查 buddies_rooms 欄位

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'buddies_rooms'
AND column_name IN (
  'collective_answers',
  'current_question_index',
  'last_updated'
);
```

**預期結果**:
| column_name            | data_type | column_default |
|------------------------|-----------|----------------|
| collective_answers     | jsonb     | '{}'::jsonb    |
| current_question_index | integer   | 0              |
| last_updated           | timestamp | now()          |

---

### 2. 檢查 buddies_members 欄位

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'buddies_members'
AND column_name = 'status';
```

**預期結果**:
| column_name | data_type | column_default |
|-------------|-----------|----------------|
| status      | text      | 'active'       |

---

### 3. 檢查 Realtime 狀態

```sql
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename LIKE 'buddies_%'
ORDER BY tablename;
```

**預期結果**: 應該看到 8 個表格
- buddies_answers
- buddies_final_results
- buddies_members
- buddies_questions
- buddies_recommendations
- buddies_restaurant_votes
- buddies_rooms
- buddies_votes

---

### 4. 檢查索引

```sql
SELECT indexname
FROM pg_indexes
WHERE tablename LIKE 'buddies_%'
AND indexname LIKE 'idx_%'
ORDER BY indexname;
```

**應包含**:
- `idx_buddies_rooms_question_index`
- `idx_buddies_members_status`
- 其他表格的 room_id 索引

---

## 📝 版本歷史

### 版本 1.2 (2025-02-03)
- ✅ 新增集體決策機制
- ✅ 新增 `collective_answers` 和 `current_question_index` 欄位
- ✅ 新增 `buddies_members.status` 欄位
- ✅ 更新 `create-buddies-schema.sql` 包含所有欄位
- ✅ `buddies_votes` 標註為已廢棄

### 版本 1.1 (2025-02-01)
- ✅ 修復 `buddies_votes` 約束允許多餐廳投票
- ✅ 全自動最終結果機制
- ✅ 隨機打亂推薦順序

### 版本 1.0 (2025-01-30)
- ✅ 初始 Buddies Schema 建立
- ✅ 自動跳題機制
- ✅ Realtime 同步功能

---

## ⚠️ 重要注意事項

1. **執行順序很重要**: 必須先建立 Schema，再啟用 Realtime
2. **舊表格保留**: `buddies_votes` 雖然已廢棄但保留以支援舊資料查詢
3. **RLS 已啟用**: 所有表格都啟用 Row Level Security，政策為允許所有人存取（適用於匿名房間）
4. **CASCADE 刪除**: 刪除房間時會自動刪除所有相關資料（成員、答案、投票等）

---

## 🔧 故障排除

### 問題: 欄位不存在錯誤

**錯誤訊息**: `column "collective_answers" does not exist`

**解決方案**: 執行 `add-collective-answers-to-buddies-rooms.sql` 或 `fix-buddies-schema-missing-columns.sql`

---

### 問題: Realtime 不同步

**症狀**: 成員看不到其他人的答案或狀態更新

**解決方案**:
1. 檢查 Realtime 是否已啟用（執行驗證查詢 #3）
2. 如未啟用，執行 `enable-realtime-for-buddies.sql`
3. 檢查 RLS 政策是否正確設定

---

### 問題: 重複投票錯誤

**錯誤訊息**: `duplicate key value violates unique constraint`

**解決方案**:
- 對於 `buddies_votes`: 執行 `fix-buddies-votes-constraint.sql`（但此表已廢棄）
- 對於 `buddies_restaurant_votes`: 此為預期行為，同一用戶不能為同一餐廳投票多次

---

## 📊 完整表格結構參考

### buddies_rooms
| 欄位名稱                | 類型        | 說明                        | 版本  |
|------------------------|-------------|---------------------------|-------|
| id                     | TEXT        | 房間ID（主鍵）              | 1.0   |
| host_id                | TEXT        | 房主ID                     | 1.0   |
| status                 | TEXT        | 房間狀態                    | 1.0   |
| collective_answers     | JSONB       | 集體決策答案                 | 1.2   |
| current_question_index | INTEGER     | 當前題目索引                 | 1.2   |
| last_updated           | TIMESTAMPTZ | 最後更新時間                 | 1.2   |
| created_at             | TIMESTAMPTZ | 建立時間                    | 1.0   |
| updated_at             | TIMESTAMPTZ | 更新時間                    | 1.0   |

### buddies_members
| 欄位名稱   | 類型        | 說明                    | 版本  |
|-----------|-------------|------------------------|-------|
| id        | UUID        | 成員ID（主鍵）           | 1.0   |
| room_id   | TEXT        | 房間ID（外鍵）           | 1.0   |
| user_id   | TEXT        | 用戶ID                  | 1.0   |
| name      | TEXT        | 成員名稱                | 1.0   |
| is_host   | BOOLEAN     | 是否為房主              | 1.0   |
| status    | TEXT        | 成員狀態 (active/left)   | 1.2   |
| joined_at | TIMESTAMPTZ | 加入時間                | 1.0   |

### buddies_questions
| 欄位名稱   | 類型        | 說明              | 版本  |
|-----------|-------------|------------------|-------|
| id        | UUID        | 問題集ID（主鍵）   | 1.0   |
| room_id   | TEXT        | 房間ID（外鍵）     | 1.0   |
| questions | JSONB       | 問題列表          | 1.0   |
| created_at| TIMESTAMPTZ | 建立時間          | 1.0   |

### buddies_answers
| 欄位名稱   | 類型        | 說明              | 版本  |
|-----------|-------------|------------------|-------|
| id        | UUID        | 答案ID（主鍵）     | 1.0   |
| room_id   | TEXT        | 房間ID（外鍵）     | 1.0   |
| user_id   | TEXT        | 用戶ID            | 1.0   |
| answers   | JSONB       | 答案列表          | 1.0   |
| created_at| TIMESTAMPTZ | 建立時間          | 1.0   |

### buddies_recommendations
| 欄位名稱        | 類型        | 說明              | 版本  |
|----------------|-------------|------------------|-------|
| id             | UUID        | 推薦ID（主鍵）     | 1.0   |
| room_id        | TEXT        | 房間ID（外鍵）     | 1.0   |
| recommendations| JSONB       | 推薦餐廳列表       | 1.0   |
| created_at     | TIMESTAMPTZ | 建立時間          | 1.0   |

### buddies_votes（用戶投票追蹤）
| 欄位名稱      | 類型        | 說明                      | 版本  | 狀態  |
|--------------|-------------|--------------------------|-------|-------|
| id           | UUID        | 投票ID（主鍵）             | 1.0   | ✅    |
| room_id      | TEXT        | 房間ID（外鍵）             | 1.0   | ✅    |
| user_id      | TEXT        | 用戶ID                    | 1.0   | ✅    |
| restaurant_id| TEXT        | 餐廳ID                    | 1.2   | ✅    |
| voted_at     | TIMESTAMPTZ | 投票時間                  | 1.2   | ✅    |
| created_at   | TIMESTAMPTZ | 建立時間                  | 1.0   | ✅    |
| ~~question_id~~  | ~~TEXT~~    | ~~問題ID（舊版）~~         | 1.0   | ⚠️ 廢棄 |
| ~~option~~       | ~~TEXT~~    | ~~選項（舊版）~~           | 1.0   | ⚠️ 廢棄 |

**UNIQUE 約束**: `(room_id, user_id, restaurant_id)`

### buddies_restaurant_votes（餐廳票數統計）
| 欄位名稱      | 類型        | 說明                    | 版本  | 狀態  |
|--------------|-------------|------------------------|-------|-------|
| id           | UUID        | 統計ID（主鍵）          | 1.0   | ✅    |
| room_id      | TEXT        | 房間ID（外鍵）          | 1.0   | ✅    |
| restaurant_id| TEXT        | 餐廳ID                 | 1.0   | ✅    |
| vote_count   | INTEGER     | 票數                   | 1.2   | ✅    |
| updated_at   | TIMESTAMPTZ | 更新時間               | 1.2   | ✅    |
| created_at   | TIMESTAMPTZ | 建立時間               | 1.0   | ✅    |
| ~~user_id~~      | ~~TEXT~~    | ~~用戶ID（錯誤欄位）~~  | 1.0   | ⚠️ 廢棄 |

**UNIQUE 約束**: `(room_id, restaurant_id)`

### buddies_final_results
| 欄位名稱      | 類型        | 說明              | 版本  |
|--------------|-------------|------------------|-------|
| id           | UUID        | 結果ID（主鍵）     | 1.0   |
| room_id      | TEXT        | 房間ID（外鍵）     | 1.0   |
| restaurant_id| TEXT        | 最終餐廳ID         | 1.0   |
| created_at   | TIMESTAMPTZ | 建立時間          | 1.0   |

---

## 🗑️ 可刪除的舊欄位清單

以下欄位已不再使用，可透過 `cleanup-buddies-deprecated-columns.sql` 安全刪除：

| 表格                      | 欄位名稱      | 原用途           | 廢棄原因                    |
|--------------------------|--------------|------------------|---------------------------|
| buddies_votes            | question_id  | 問題ID           | 改為餐廳投票追蹤，不再需要問題投票 |
| buddies_votes            | option       | 投票選項          | 同上                       |
| buddies_restaurant_votes | user_id      | 用戶ID（錯誤）    | 此表用於統計總票數，不應記錄個別用戶 |

**清理後節省空間**: 視資料量而定，通常可節省 10-30% 的表格空間

---

## 📞 支援

如遇到資料庫相關問題：
1. 檢查本指南的「驗證檢查清單」確認 Schema 狀態
2. 檢查「完整表格結構參考」確認欄位是否正確
3. 執行「故障排除」中的相關解決方案
4. 檢查 Supabase Dashboard 的 Database Logs
5. 如需清理舊欄位，請先備份後執行 `cleanup-buddies-deprecated-columns.sql`
