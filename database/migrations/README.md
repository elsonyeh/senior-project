# Database Migrations

這個資料夾包含 SwiftTaste 專案的資料庫遷移腳本。

## 📋 執行順序

如果需要從頭建立資料庫，請依照以下順序執行：

### 1. 核心 Schema

```sql
-- 1. 安全性設定（必須最先執行）
database-security-fixes.sql

-- 2. Buddies 模式基礎架構
create-buddies-schema.sql

-- 3. Realtime 功能啟用
enable-realtime-for-buddies.sql
```

### 2. 功能擴充

```sql
-- 活動合作店家功能
add-event-partner-column.sql

-- 集體答案功能（Buddies 模式）
add-collective-answers-to-buddies-rooms.sql

-- 原子性投票函數
create-increment-votes-function.sql

-- Restaurants 表 RLS 政策
fix-restaurants-rls.sql
```

## 📝 腳本說明

### 核心 Schema

#### `database-security-fixes.sql`
- **用途**: 修復資料庫安全性問題
- **內容**:
  - 建立 `is_admin()` 函數
  - 修復 SECURITY DEFINER Views
  - 啟用 RLS 政策（questions, google_places_cache 等）
- **執行時機**: 專案初始化時必須執行

#### `create-buddies-schema.sql`
- **用途**: 建立 Buddies 群組推薦模式的完整資料表結構
- **內容**:
  - 8 個資料表（rooms, members, questions, answers, etc.）
  - 索引優化
  - RLS 政策
- **執行時機**: 使用 Buddies 功能前必須執行

#### `enable-realtime-for-buddies.sql`
- **用途**: 為 Buddies 相關表啟用 Supabase Realtime 功能
- **內容**: 將 8 個 Buddies 表加入 `supabase_realtime` publication
- **執行時機**: Buddies Schema 建立後執行

### 功能擴充

#### `add-event-partner-column.sql`
- **用途**: 新增活動合作店家標記功能
- **內容**: 在 `restaurants` 表新增 `is_event_partner` 欄位
- **執行時機**: 需要標記活動合作店家時執行

#### `add-collective-answers-to-buddies-rooms.sql`
- **用途**: 新增集體決策答案功能
- **內容**:
  - `collective_answers` 欄位（JSONB）
  - `current_question_index` 欄位
- **執行時機**: 需要多人同步答題功能時執行

#### `create-increment-votes-function.sql`
- **用途**: 建立原子性投票函數
- **內容**: `increment_restaurant_votes()` RPC 函數
- **執行時機**: 需要確保多用戶同時投票正確性時執行

#### `fix-restaurants-rls.sql`
- **用途**: 修復 restaurants 表的 RLS 政策
- **內容**: 公開讀取，只有管理員可編輯
- **執行時機**: 需要保護餐廳資料時執行

## 🔧 使用方式

### 在 Supabase Dashboard 執行

1. 登入 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇專案
3. 前往 **SQL Editor**
4. 複製腳本內容並執行

### 使用 Supabase CLI

```bash
# 連接到專案
supabase link --project-ref your-project-ref

# 執行腳本
supabase db execute -f database/migrations/database-security-fixes.sql
supabase db execute -f database/migrations/create-buddies-schema.sql
# ... 依序執行其他腳本
```

## ⚠️ 注意事項

### 執行前檢查

- ✅ 確認已有資料庫備份
- ✅ 檢查腳本是否適用於當前資料庫版本
- ✅ 閱讀腳本中的註解說明

### 冪等性（Idempotent）

大部分腳本都使用以下模式確保可重複執行：

```sql
CREATE TABLE IF NOT EXISTS ...
ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
DROP POLICY IF EXISTS ...
```

### 執行順序

- 📌 核心 Schema 必須優先執行
- 📌 功能擴充可根據需求選擇性執行
- 📌 某些腳本有依賴關係（如 Realtime 需要先有 Buddies Schema）

## 📚 相關文件

- [Supabase Database Documentation](https://supabase.com/docs/guides/database)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- 專案主文件: `SUPABASE-SETUP.md`

## 🗂️ 已棄用的腳本

以下腳本為一次性修復，已執行完畢並從專案中移除：

- ~~`fix-buddies-votes-constraint.sql`~~ - 修復投票約束
- ~~`fix-fun-question-tags-view.sql`~~ - 修復 View 缺少欄位
- ~~`fix-buddies-schema-missing-columns.sql`~~ - 補充缺少欄位
- ~~`cleanup-buddies-deprecated-columns.sql`~~ - 清理廢棄欄位
- ~~`vacuum-full-buddies-tables.sql`~~ - 資料庫空間回收

這些腳本的功能已整合到核心 Schema 或不再需要。
