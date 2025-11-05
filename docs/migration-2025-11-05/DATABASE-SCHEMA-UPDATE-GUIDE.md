# DATABASE-SCHEMA.md 更新指南

**目標檔案**: `docs/DATABASE-SCHEMA.md`
**更新日期**: 2025-11-05
**原因**: 資料庫優化後，移除未使用的表、新增歸檔表、修正表名錯誤

---

## 需要的修改

### 1. 更新文件標頭

**修改位置**: 第2-5行

**原內容**:
```markdown
**生成日期**：2025-11-04
**資料庫類型**：PostgreSQL (Supabase)
**表數量**：15
```

**修改為**:
```markdown
**生成日期**：2025-11-05
**資料庫類型**：PostgreSQL (Supabase)
**表數量**：16（活躍表：13，歸檔表：2，系統表：1）
```

---

### 2. 更新目錄（第9-31行）

**移除以下項目**:
```markdown
- [SwiftTaste 模式](#swifttaste-模式)
  - [swifttaste_history](#swifttaste_history)  ← 刪除
  - [selection_history](#selection_history)    ← 刪除
- [Buddies 模式（實時層）](#buddies-模式（實時層）)
  - [buddies_votes](#buddies_votes)             ← 刪除
  - [buddies_questions](#buddies_questions)     ← 刪除
```

**新增以下項目**:
```markdown
- [SwiftTaste 模式](#swifttaste-模式)
  - [user_selection_history](#user_selection_history) ← 新增（正確表名）
- [Buddies 模式（歸檔層）](#buddies-模式（歸檔層）) ← 新增章節
  - [buddies_rooms_archive](#buddies_rooms_archive)  ← 新增
- [系統管理](#系統管理) ← 新增章節
  - [cleanup_logs](#cleanup_logs) ← 新增
```

**完整的新目錄結構**:
```markdown
## 📋 目錄

- [核心資料表](#核心資料表)
  - [restaurants](#restaurants)
  - [restaurant_images](#restaurant_images)
  - [restaurant_reviews](#restaurant_reviews)
- [用戶系統](#用戶系統)
  - [user_profiles](#user_profiles)
  - [user_favorite_lists](#user_favorite_lists)
  - [favorite_list_places](#favorite_list_places)
- [SwiftTaste 模式](#swifttaste-模式)
  - [user_selection_history](#user_selection_history)
- [Buddies 模式（實時層）](#buddies-模式（實時層）)
  - [buddies_rooms](#buddies_rooms)
  - [buddies_members](#buddies_members)
- [Buddies 模式（歸檔層）](#buddies-模式（歸檔層）)
  - [buddies_rooms_archive](#buddies_rooms_archive)
- [Buddies 模式（記錄層）](#buddies-模式（記錄層）)
  - [buddies_events](#buddies_events)
- [問題系統](#問題系統)
  - [fun_questions](#fun_questions)
  - [fun_question_tags](#fun_question_tags)
- [系統管理](#系統管理)
  - [cleanup_logs](#cleanup_logs)
```

---

### 3. 修改 SwiftTaste 模式章節

**找到並刪除**:
- 整個 `### swifttaste_history` 章節（約50行）
- 整個 `### selection_history` 章節（約50行）

**新增以下內容**:

```markdown
## SwiftTaste 模式

### user_selection_history

**用途**：統一選擇歷史記錄

**說明**：記錄用戶在 SwiftTaste 和 Buddies 模式中的所有選擇歷史，用於歷史查詢和未來個人化推薦優化。取代舊的 swifttaste_history 和 selection_history 表。

**核心功能**：
- 統一記錄兩種模式的歷史
- 會話級別追蹤（session_id）
- 時間序列分析
- 用戶偏好學習（未來擴展）
- 與 selection_history（互動記錄）關聯

**欄位結構**：

| 欄位名稱 | 資料類型 | 可空 | 說明 |
|---------|---------|------|------|
| `id` | uuid | ✗ | UUID 主鍵，自動生成 |
| `user_id` | uuid | ✗ | 用戶 ID，關聯到 auth.users |
| `mode` | text | ✗ | 模式：'swifttaste' 或 'buddies' |
| `session_id` | uuid | ✓ | 會話 ID（Buddies 模式為 room_id） |
| `answers` | jsonb | ✓ | 問答答案記錄 |
| `recommendations` | jsonb | ✓ | 推薦結果記錄 |
| `final_restaurant_id` | text | ✓ | 最終選擇的餐廳 ID |
| `final_restaurant_data` | jsonb | ✓ | 最終選擇的餐廳完整數據 |
| `started_at` | timestamptz | ✓ | 會話開始時間 |
| `completed_at` | timestamptz | ✓ | 會話完成時間 |
| `created_at` | timestamptz | ✓ | 記錄創建時間，自動設置為當前時間 |

**關聯關係**：
- 外鍵：`user_id`, `final_restaurant_id`

---
```

---

### 4. 刪除 Buddies 實時層中的未使用表

**找到並完整刪除**:
- 整個 `### buddies_votes` 章節（約60行）
- 整個 `### buddies_questions` 章節（約50行）

**保留**:
- `### buddies_rooms`
- `### buddies_members`

**在 buddies_rooms 章節添加說明**:

在 `**說明**` 段落後添加：

```markdown
**注意**：投票數據和問題集使用 JSONB 格式直接存儲在本表中（votes, member_answers, questions 欄位），而非使用獨立的 buddies_votes 和 buddies_questions 表。這樣設計可以減少 JOIN 操作，提升實時互動效能。
```

---

### 5. 新增「Buddies 模式（歸檔層）」章節

**在「Buddies 模式（實時層）」之後，「Buddies 模式（記錄層）」之前插入**:

```markdown
---

## Buddies 模式（歸檔層）

### buddies_rooms_archive

**用途**：Buddies 房間歸檔

**說明**：歸檔已完成的 Buddies 房間，保留完整數據供歷史分析使用。當房間狀態變為 'completed' 時，系統會自動將房間數據複製到此表。24小時後，主表（buddies_rooms）會自動清理，但歸檔表永久保留。

**核心功能**：
- 完整房間快照（包含所有 JSONB 數據）
- 預計算統計數據（加速分析查詢）
- 永久保存歷史記錄
- 支援數據匯出（防止空間不足）

**欄位結構**：

| 欄位名稱 | 資料類型 | 可空 | 說明 |
|---------|---------|------|------|
| `id` | uuid | ✗ | UUID 主鍵（與原房間ID相同） |
| `room_code` | varchar(6) | ✗ | 6位數房間碼 |
| `host_id` | uuid | ✗ | 房主 ID |
| `host_name` | text | ✓ | 房主名稱 |
| `status` | text | ✓ | 房間狀態（通常為 'completed'） |
| `members_data` | jsonb | ✓ | JSONB 格式成員列表 |
| `member_answers` | jsonb | ✓ | JSONB 格式答題記錄 |
| `collective_answers` | jsonb | ✓ | 群體共識答案 |
| `recommendations` | jsonb | ✓ | JSONB 格式推薦結果 |
| `votes` | jsonb | ✓ | JSONB 格式投票統計 |
| `questions` | jsonb | ✓ | JSONB 格式問題集 |
| `final_restaurant_id` | text | ✓ | 最終選擇的餐廳 ID |
| `final_restaurant_data` | jsonb | ✓ | 最終選擇的餐廳完整數據 |
| `member_count` | integer | ✓ | 參與人數（預計算） |
| `total_votes` | integer | ✓ | 總投票數（預計算） |
| `decision_time_seconds` | integer | ✓ | 決策耗時（秒，預計算） |
| `questions_count` | integer | ✓ | 問題數量（預計算） |
| `recommendations_count` | integer | ✓ | 推薦餐廳數量（預計算） |
| `created_at` | timestamptz | ✓ | 房間創建時間 |
| `questions_started_at` | timestamptz | ✓ | 開始答題時間 |
| `voting_started_at` | timestamptz | ✓ | 開始投票時間 |
| `completed_at` | timestamptz | ✓ | 房間完成時間 |
| `archived_at` | timestamptz | ✓ | 歸檔時間，預設為 now() |
| `schema_version` | text | ✓ | 數據結構版本，預設 '1.0' |
| `archived_by` | text | ✓ | 歸檔來源（'trigger', 'app_service', 'manual'） |

**關聯關係**：
- 原 id 關聯到原 buddies_rooms 表（但房間可能已清理）
- 外鍵：`host_id`, `final_restaurant_id`

**索引**：
- `idx_archive_completed_at` - 完成時間
- `idx_archive_created_at` - 創建時間
- `idx_archive_final_restaurant` - 最終選擇餐廳
- `idx_archive_member_count` - 成員數
- `idx_archive_status` - 狀態
- `idx_archive_host_id` - 房主
- `idx_archive_votes_gin` - JSONB 投票數據（GIN 索引）
- `idx_archive_recommendations_gin` - JSONB 推薦數據（GIN 索引）

---
```

---

### 6. 更新「Buddies 模式（記錄層）」章節

**找到 `### buddies_events` 章節**

**修改 `**說明**` 段落**:

**原內容**:
```markdown
**說明**：記錄所有 Buddies 房間的事件流（創建、加入、投票、離開等），用於審計、統計和問題追蹤。
```

**修改為**:
```markdown
**說明**：✅ **已實施** - 記錄所有 Buddies 房間的事件流（創建、加入、投票、離開等），用於審計、統計和問題追蹤。系統通過觸發器自動記錄關鍵事件，並提供完整的事件查詢和分析功能。
```

**在 `**核心功能**` 後添加**:

```markdown
**支援的事件類型（19種）**：
- **房間生命週期**（4種）：room_created, room_started, room_completed, room_abandoned
- **成員操作**（3種）：member_joined, member_left, member_kicked
- **問題回答**（2種）：question_answered, all_members_completed
- **推薦生成**（2種）：recommendations_generated, recommendations_refreshed
- **投票操作**（3種）：vote_cast, vote_changed, vote_removed
- **最終決策**（2種）：final_selection_made, final_selection_changed
- **系統事件**（2種）：room_archived, room_cleaned
- **錯誤事件**（1種）：error_occurred

**自動觸發器**：
- `trigger_log_room_created` - 房間創建時自動記錄
- `trigger_room_status_change_event` - 房間狀態變化時自動記錄
- `trigger_member_joined_event` - 成員加入時自動記錄

**分析視圖**：
- `buddies_room_timeline` - 房間事件時間線（包含事件間隔時間）
- `buddies_event_stats` - 事件類型統計
```

---

### 7. 新增「系統管理」章節

**在文檔最後（「附錄：資料庫設計原則」之前）插入**:

```markdown
---

## 系統管理

### cleanup_logs

**用途**：清理系統執行日誌

**說明**：記錄自動清理系統的執行歷史，用於監控清理任務狀態、診斷問題和審計。每次執行清理任務（完成房間、未完成房間、舊事件）都會記錄一筆日誌。

**核心功能**：
- 記錄清理執行歷史
- 追蹤清理成功/失敗狀態
- 記錄執行時間與效能
- 支援問題診斷

**欄位結構**：

| 欄位名稱 | 資料類型 | 可空 | 說明 |
|---------|---------|------|------|
| `id` | uuid | ✗ | UUID 主鍵，自動生成 |
| `cleanup_type` | text | ✗ | 清理類型：'completed_rooms', 'abandoned_rooms', 'old_events' |
| `rooms_deleted` | integer | ✓ | 清理的房間數，預設 0 |
| `events_archived` | integer | ✓ | 歸檔的事件數，預設 0 |
| `execution_time_ms` | integer | ✓ | 執行時間（毫秒） |
| `status` | text | ✗ | 狀態：'success', 'partial', 'failed' |
| `error_message` | text | ✓ | 錯誤訊息（如有） |
| `created_at` | timestamptz | ✓ | 記錄創建時間，預設為 now() |

**關聯關係**：
- 無外鍵關聯（系統日誌表）

**索引**：
- `idx_cleanup_logs_created_at` - 創建時間（DESC）
- `idx_cleanup_logs_type` - 清理類型

**相關視圖**：
- `cleanup_health_status` - 清理系統健康狀況（待清理數據、最近清理狀態）
- `cleanup_history_stats` - 清理歷史統計（按日期和類型聚合）

**清理策略**：
- 完成的房間：24小時後自動清理（已歸檔）
- 未完成的房間：30天後自動清理
- 事件記錄：保留1年後歸檔
- 清理日誌：保留90天

**相關函數**：
- `cleanup_completed_rooms()` - 清理24小時前的完成房間
- `cleanup_abandoned_rooms()` - 清理30天前的未完成房間
- `cleanup_old_events()` - 歸檔1年前的事件
- `run_daily_cleanup()` - 執行所有清理任務
- `manual_cleanup_now()` - 手動觸發立即清理
- `check_cleanup_system()` - 檢查清理系統完整性

**監控命令**：
```sql
-- 查看清理健康狀況
SELECT * FROM cleanup_health_status;

-- 查看清理歷史
SELECT * FROM cleanup_history_stats
WHERE cleanup_date >= CURRENT_DATE - interval '7 days';

-- 手動觸發清理
SELECT manual_cleanup_now();
```

---
```

---

### 8. 更新「附錄：資料庫設計原則」

**在「三層架構設計」章節後添加**:

```markdown
### 數據生命週期管理

SwiftTaste 實施完整的數據生命週期管理，確保資料庫長期健康運作：

#### 1. 自動歸檔機制
- **觸發條件**：房間狀態變為 'completed'
- **執行方式**：資料庫觸發器 + 應用層服務
- **目標表**：buddies_rooms → buddies_rooms_archive
- **特點**：完整快照 + 預計算統計數據

#### 2. 自動清理機制
- **執行頻率**：每天凌晨 3:00（pg_cron）
- **清理策略**：
  - 完成房間：24小時後清理（已歸檔）
  - 未完成房間：30天後清理
  - 事件記錄：1年後歸檔
- **安全保障**：只刪除已歸檔的數據

#### 3. 事件流記錄
- **記錄內容**：19 種事件類型
- **觸發方式**：自動觸發器 + 應用層調用
- **用途**：完整審計追蹤、用戶行為分析
- **特點**：不可變日誌（只能新增，不可修改/刪除）

#### 4. 數據匯出
- **工具**：export-archive-data.js
- **格式**：JSON / CSV
- **用途**：防止 Supabase 空間不足，定期備份

#### 5. 監控與維護
- **健康檢查**：check-database-health.js
- **監控視圖**：cleanup_health_status, get_archive_stats()
- **警報條件**：待清理數據過多、清理任務失敗、空間不足

詳見：`docs/DATA-LIFECYCLE-MANAGEMENT.md`

---
```

---

## 驗證清單

更新完成後，請驗證以下內容：

- [ ] 文件標頭日期已更新為 2025-11-05
- [ ] 表數量已更新為 16
- [ ] 目錄中已移除 4 個未使用的表
- [ ] 目錄中已新增 3 個新表
- [ ] SwiftTaste 模式章節只有 user_selection_history
- [ ] Buddies 實時層只有 buddies_rooms, buddies_members
- [ ] 新增了 Buddies 歸檔層章節
- [ ] buddies_events 已標記為「已實施」
- [ ] 新增了系統管理章節
- [ ] 附錄中新增了數據生命週期管理說明

---

## 快速執行（使用腳本重新生成）

如果手動修改太繁瑣，可以考慮重新執行：

```bash
node scripts/export-database-schema.js
```

但需要先更新腳本中的表列表以反映最新的資料庫結構。

---

**更新指南版本：** v1.0
**制定日期：** 2025-11-05
