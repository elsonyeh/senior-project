# 📊 SwiftTaste 資料庫結構文件

**生成日期**：2025-11-05
**資料庫類型**：PostgreSQL (Supabase)
**表數量**：16（活躍表：13，歸檔表：2，系統表：1）

---

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
- [Buddies 模式（實時層）](#buddies-模式實時層)
  - [buddies_rooms](#buddies_rooms)
  - [buddies_members](#buddies_members)
- [Buddies 模式（歸檔層）](#buddies-模式歸檔層)
  - [buddies_rooms_archive](#buddies_rooms_archive)
- [Buddies 模式（記錄層）](#buddies-模式記錄層)
  - [buddies_events](#buddies_events)
- [問題系統](#問題系統)
  - [fun_questions](#fun_questions)
  - [fun_question_tags](#fun_question_tags)
- [系統管理](#系統管理)
  - [cleanup_logs](#cleanup_logs)

---

## 核心資料表

### restaurants

**用途**：餐廳基本資料

**說明**：儲存所有餐廳的基本資訊，包括名稱、地址、座標、標籤、價格區間、辣度等。是系統的核心資料表，所有推薦邏輯都基於此表。

**核心功能**：
- SwiftTaste 模式推薦來源
- Buddies 模式推薦來源
- Map 模式顯示資料
- 支援地理空間查詢（經緯度）
- 標籤系統（tags 陣列）用於趣味問題匹配

**欄位結構**：

| 欄位名稱 | 資料類型 | 可空 | 說明 |
|---------|---------|------|------|
| `id` | text | ✗ | UUID 主鍵，自動生成 |
| `name` | text | ✗ | 名稱 |
| `address` | text | ✓ | - |
| `latitude` | numeric | ✓ | 緯度，用於地理空間查詢 |
| `longitude` | numeric | ✓ | 經度，用於地理空間查詢 |
| `category` | text | ✓ | - |
| `price_range` | integer | ✓ | 價格區間：1（平價）、2（中價）、3（高價） |
| `suggested_people` | text | ✓ | 建議人數："1"（單人）、"~"（多人）、"1~"（兩者皆可） |
| `tags` | text[] | ✓ | 標籤陣列（text[]），用於趣味問題匹配 |
| `is_spicy` | text | ✓ | 辣度標記："true"（辣）、"false"（不辣）、"both"（兩者皆有） |
| `rating` | numeric | ✓ | Google 評分（0-5） |
| `review_count` | integer | ✓ | Google 評論數 |
| `created_at` | timestamptz | ✓ | 記錄創建時間，自動設置為當前時間 |

**關聯關係**：

---

### restaurant_images

**用途**：餐廳圖片管理

**說明**：儲存餐廳的多張圖片，支援主圖和附加圖片。圖片實際存儲在 Supabase Storage，此表記錄圖片 URL 和元數據。

**核心功能**：
- 一對多關聯（一間餐廳多張圖片）
- is_primary 標記主圖
- 支援圖片順序排列
- 與 Supabase Storage 整合

**欄位結構**：

| 欄位名稱 | 資料類型 | 可空 | 說明 |
|---------|---------|------|------|
| `id` | uuid | ✗ | UUID 主鍵，自動生成 |
| `restaurant_id` | text | ✗ | 餐廳 ID，關聯到 restaurants 表 |
| `image_url` | text | ✗ | - |
| `is_primary` | boolean | ✓ | - |
| `order` | integer | ✓ | 排序順序 |
| `created_at` | timestamptz | ✓ | 記錄創建時間，自動設置為當前時間 |

**關聯關係**：
- 此表為關聯表，連接多個實體
- 外鍵：`restaurant_id`

---

### restaurant_reviews

**用途**：餐廳評論系統

**說明**：TasteBuddies 自有評論系統，使用者可對餐廳撰寫評論和評分。與 Google 評論整合顯示綜合評分。

**核心功能**：
- 5星評分系統
- 文字評論
- 用戶認證（需登入）
- 與 Google 評論整合計算綜合評分
- 評論時間記錄

**欄位結構**：

| 欄位名稱 | 資料類型 | 可空 | 說明 |
|---------|---------|------|------|
| `id` | uuid | ✗ | UUID 主鍵，自動生成 |
| `restaurant_id` | text | ✗ | 餐廳 ID，關聯到 restaurants 表 |
| `user_id` | uuid | ✗ | 用戶 ID，關聯到 auth.users |
| `rating` | integer | ✗ | 用戶評分（1-5 星） |
| `review_text` | text | ✓ | 評論內容 |
| `created_at` | timestamptz | ✓ | 記錄創建時間，自動設置為當前時間 |

**關聯關係**：
- 此表為關聯表，連接多個實體
- 外鍵：`restaurant_id`, `user_id`

---

## 用戶系統

### user_profiles

**用途**：用戶個人檔案

**說明**：擴展 Supabase Auth 的用戶資訊，儲存頭像、名稱、簡介等個人化資料。與 auth.users 一對一關聯。

**核心功能**：
- 個人資料編輯
- 頭像上傳
- 用戶統計（收藏數、評論數）
- 與 Supabase Auth 整合

**欄位結構**：

| 欄位名稱 | 資料類型 | 可空 | 說明 |
|---------|---------|------|------|
| `id` | uuid | ✗ | UUID 主鍵，自動生成 |
| `user_id` | uuid | ✗ | 用戶 ID，關聯到 auth.users |
| `username` | text | ✓ | - |
| `avatar_url` | text | ✓ | - |
| `bio` | text | ✓ | - |
| `created_at` | timestamptz | ✓ | 記錄創建時間，自動設置為當前時間 |
| `updated_at` | timestamptz | ✓ | 記錄更新時間，自動更新 |

**關聯關係**：
- 此表為關聯表，連接多個實體
- 外鍵：`user_id`

---

### user_favorite_lists

**用途**：收藏清單管理

**說明**：多清單收藏系統，每個用戶可創建多個收藏清單，每個清單有獨立顏色標記。預設「我的最愛」清單不可刪除。

**核心功能**：
- 最多 6 個清單（1 個預設 + 5 個自訂）
- 9 種顏色標記
- 智能顏色分配
- 清單內餐廳計數
- Map 模式視覺化顯示

**欄位結構**：

| 欄位名稱 | 資料類型 | 可空 | 說明 |
|---------|---------|------|------|
| `id` | uuid | ✗ | UUID 主鍵，自動生成 |
| `user_id` | uuid | ✗ | 用戶 ID，關聯到 auth.users |
| `name` | varchar(50) | ✗ | 名稱 |
| `color` | varchar(7) | ✓ | 清單顏色（HEX 格式，如 #EF4444） |
| `is_default` | boolean | ✓ | 是否為預設「我的最愛」清單 |
| `places_count` | integer | ✓ | 清單內餐廳數量 |
| `created_at` | timestamptz | ✓ | 記錄創建時間，自動設置為當前時間 |

**關聯關係**：
- 此表為關聯表，連接多個實體
- 外鍵：`user_id`

---

### favorite_list_places

**用途**：清單內餐廳關聯

**說明**：多對多關聯表，連接收藏清單和餐廳。支援為每個餐廳添加私人備註。

**核心功能**：
- 多對多關聯（清單 ↔ 餐廳）
- 私人備註功能
- 加入時間記錄
- 支援快速查詢清單內容

**欄位結構**：

| 欄位名稱 | 資料類型 | 可空 | 說明 |
|---------|---------|------|------|
| `id` | uuid | ✗ | UUID 主鍵，自動生成 |
| `list_id` | uuid | ✗ | - |
| `restaurant_id` | text | ✗ | 餐廳 ID，關聯到 restaurants 表 |
| `notes` | text | ✓ | 備註 |
| `added_at` | timestamptz | ✓ | - |

**關聯關係**：
- 此表為關聯表，連接多個實體
- 外鍵：`list_id`, `restaurant_id`

---

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

## Buddies 模式（實時層）

### buddies_rooms

**用途**：Buddies 房間管理

**說明**：Buddies 群組決策房間，儲存房間狀態、成員資訊、投票數據等。使用 JSONB 格式實現高效能實時互動。

**注意**：投票數據和問題集使用 JSONB 格式直接存儲在本表中（votes, member_answers, questions 欄位），而非使用獨立的 buddies_votes 和 buddies_questions 表。這樣設計可以減少 JOIN 操作，提升實時互動效能。

**核心功能**：
- 房間生命週期管理
- 成員列表（JSONB）
- 投票統計（JSONB）
- 房間碼/QR Code 邀請
- 房主權重機制（2倍投票權）
- Socket.IO 即時同步

**欄位結構**：

| 欄位名稱 | 資料類型 | 可空 | 說明 |
|---------|---------|------|------|
| `id` | uuid | ✗ | UUID 主鍵，自動生成 |
| `room_code` | varchar(6) | ✗ | 6位數房間碼，用於好友加入 |
| `host_id` | uuid | ✗ | 房主 ID，擁有 2 倍投票權 |
| `status` | text | ✓ | 房間狀態：waiting、answering、recommending、completed |
| `members_data` | jsonb | ✓ | JSONB 格式成員列表 |
| `votes_data` | jsonb | ✓ | JSONB 格式投票統計 |
| `current_question_index` | integer | ✓ | 當前問題索引 |
| `created_at` | timestamptz | ✓ | 記錄創建時間，自動設置為當前時間 |
| `expires_at` | timestamptz | ✓ | 房間過期時間（24小時） |

**關聯關係**：
- 此表為關聯表，連接多個實體
- 外鍵：`host_id`

---

### buddies_members

**用途**：Buddies 成員管理

**說明**：記錄 Buddies 房間的所有成員資訊，包括用戶ID、加入時間、在線狀態等。與 buddies_rooms 一對多關聯。

**核心功能**：
- 成員列表管理
- 加入時間記錄
- 在線狀態追蹤
- 與房間關聯

**欄位結構**：

| 欄位名稱 | 資料類型 | 可空 | 說明 |
|---------|---------|------|------|
| `id` | uuid | ✗ | UUID 主鍵，自動生成 |
| `room_id` | uuid | ✗ | - |
| `user_id` | uuid | ✗ | 用戶 ID，關聯到 auth.users |
| `username` | text | ✓ | - |
| `is_host` | boolean | ✓ | - |
| `joined_at` | timestamptz | ✓ | - |

**關聯關係**：
- 此表為關聯表，連接多個實體
- 外鍵：`room_id`, `user_id`

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
| `id` | text | ✗ | 主鍵（與原房間ID相同） |
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

## Buddies 模式（記錄層）

### buddies_events

**用途**：Buddies 事件記錄

**說明**：✅ **已實施** - 記錄所有 Buddies 房間的事件流（創建、加入、投票、離開等），用於審計、統計和問題追蹤。系統通過觸發器自動記錄關鍵事件，並提供完整的事件查詢和分析功能。

**核心功能**：
- 完整事件流記錄
- 時間序列分析
- 用戶行為追蹤
- 問題調試與審計

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

**欄位結構**：

| 欄位名稱 | 資料類型 | 可空 | 說明 |
|---------|---------|------|------|
| `id` | uuid | ✗ | UUID 主鍵，自動生成 |
| `room_id` | text | ✗ | 房間 ID（關聯到 buddies_rooms） |
| `event_type` | text | ✗ | 事件類型（19種之一） |
| `user_id` | uuid | ✓ | 用戶 ID，關聯到 auth.users |
| `event_data` | jsonb | ✓ | 事件詳細數據 |
| `created_at` | timestamptz | ✓ | 記錄創建時間，自動設置為當前時間 |

**關聯關係**：
- 外鍵：`room_id`, `user_id`

**索引**：
- `idx_events_room_id` - 房間 ID
- `idx_events_event_type` - 事件類型
- `idx_events_created_at` - 創建時間（DESC）
- `idx_events_user_id` - 用戶 ID
- `idx_events_event_data_gin` - JSONB 事件數據（GIN 索引）
- `idx_events_room_created` - 複合索引（room_id + created_at）
- `idx_events_type_created` - 複合索引（event_type + created_at）

---

## 問題系統

### fun_questions

**用途**：趣味問題管理

**說明**：SwiftTaste 和 Buddies 模式使用的趣味問題庫，用於捕捉用戶隱性偏好。

**核心功能**：
- 問題文本管理
- 選項定義
- 標籤映射配置
- 問題啟用/停用
- 顯示順序控制

**欄位結構**：

| 欄位名稱 | 資料類型 | 可空 | 說明 |
|---------|---------|------|------|
| `id` | uuid | ✗ | UUID 主鍵，自動生成 |
| `question_text` | text | ✗ | - |
| `options` | jsonb | ✓ | - |
| `order` | integer | ✓ | 排序順序 |
| `is_active` | boolean | ✓ | 記錄是否啟用 |

**關聯關係**：
- 此表為關聯表，連接多個實體

---

### fun_question_tags

**用途**：趣味問題標籤映射

**說明**：連接趣味問題選項與餐廳標籤，實現偏好匹配邏輯。一個選項可對應多個標籤。

**核心功能**：
- 選項 → 標籤映射
- 支援一對多關聯
- 標籤權重（未來擴展）
- 動態標籤管理

**欄位結構**：

| 欄位名稱 | 資料類型 | 可空 | 說明 |
|---------|---------|------|------|
| `id` | uuid | ✗ | UUID 主鍵，自動生成 |
| `question_id` | uuid | ✗ | - |
| `option_value` | text | ✗ | - |
| `tags` | text[] | ✓ | - |

**關聯關係**：
- 此表為關聯表，連接多個實體
- 外鍵：`question_id`

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
- 事件記錄：永久保留
- 清理日誌：保留90天

**相關函數**：
- `cleanup_completed_rooms()` - 清理24小時前的完成房間
- `cleanup_abandoned_rooms()` - 清理30天前的未完成房間
- `cleanup_old_events()` - 事件保留策略（目前永久保留）
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

## 附錄：資料庫設計原則

### 三層架構設計

SwiftTaste 採用**三層資料庫架構**，優化不同場景的性能需求：

#### 1. 實時互動層（JSONB）
- **表**：`buddies_rooms`
- **特點**：使用 JSONB 格式存儲動態數據
- **優勢**：
  - 高效能讀寫（減少 JOIN 操作）
  - 靈活的數據結構
  - 支援 Socket.IO 即時同步
- **適用場景**：Buddies 模式群組協作

#### 2. 事件記錄層（Relational）
- **表**：`buddies_events`, `selection_history`, `swifttaste_history`
- **特點**：關聯式結構，完整記錄事件流
- **優勢**：
  - 數據完整性
  - 時間序列分析
  - 審計追蹤
- **適用場景**：歷史查詢、統計分析

#### 3. 分析倉儲層（Views）
- **實現**：未來透過 Views 或 Materialized Views
- **用途**：
  - 複雜統計查詢
  - 報表生成
  - 數據挖掘

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
  - 事件記錄：永久保留
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

詳見：`docs/migration-2025-11-05/DATA-LIFECYCLE-MANAGEMENT.md`

---

### 命名規範

- **表名**：小寫 + 底線分隔（`snake_case`）
- **主鍵**：統一使用 `id` (UUID)
- **外鍵**：`{table}_id` 格式
- **時間戳**：`created_at`, `updated_at`
- **布林值**：`is_` 或 `has_` 前綴

### 性能優化

1. **索引策略**：
   - 主鍵自動索引
   - 外鍵添加索引
   - 常用查詢欄位添加索引

2. **JSONB 優化**：
   - 使用 JSONB 而非 JSON（支援索引）
   - GIN 索引加速查詢

3. **分頁查詢**：
   - 使用 `LIMIT` 和 `OFFSET`
   - 避免 `SELECT *`

### Row Level Security (RLS)

所有用戶相關表都啟用 RLS 政策：

- **用戶數據隔離**：用戶只能訪問自己的數據
- **公開數據**：餐廳、評論等公開可讀
- **管理員權限**：特殊政策允許管理操作

詳見：`SECURITY.md`

---

**文件生成工具**：`scripts/export-database-schema.js`
**維護建議**：資料庫結構變更時重新運行此腳本更新文件

