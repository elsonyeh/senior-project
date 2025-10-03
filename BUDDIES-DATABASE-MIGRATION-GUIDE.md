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
- `buddies_votes` - 問題投票（已廢棄但保留）
- `buddies_restaurant_votes` - 餐廳投票
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
**狀態**: ✅ 已執行（版本 1.1）
**執行時機**: 版本 1.1 更新時

**功能**:
- 將約束從 `(room_id, user_id)` 改為 `(room_id, user_id, restaurant_id)`
- 允許同一用戶為不同餐廳投票

**注意**: 此表在版本 1.2 已不再使用

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

## 📞 支援

如遇到資料庫相關問題：
1. 檢查本指南的「驗證檢查清單」確認 Schema 狀態
2. 執行「故障排除」中的相關解決方案
3. 檢查 Supabase Dashboard 的 Database Logs
