# 📊 SwiftTaste 資料庫結構文件

**生成日期**：2025-11-04
**資料庫類型**：PostgreSQL (Supabase)
**表數量**：7

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
- [Buddies 模式（實時層）](#buddies-模式（實時層）)
  - [buddies_rooms](#buddies_rooms)
- [Buddies 模式（記錄層）](#buddies-模式（記錄層）)
- [問題系統](#問題系統)

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

## Buddies 模式（實時層）

### buddies_rooms

**用途**：Buddies 房間管理

**說明**：Buddies 群組決策房間，儲存房間狀態、成員資訊、投票數據等。使用 JSONB 格式實現高效能實時互動。

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

## Buddies 模式（記錄層）

## 問題系統

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

