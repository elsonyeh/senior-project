# 🍴 SwiftTaste - 智能餐廳推薦系統

SwiftTaste 是一個創新的餐廳推薦平台，結合了問答式篩選、群組投票機制、地圖探索等功能，幫助使用者快速找到心儀的餐廳。

## 📋 目錄

- [專案概述](#專案概述)
- [核心功能](#核心功能)
- [技術架構](#技術架構)
- [快速開始](#快速開始)
- [開發指南](#開發指南)
- [文檔索引](#文檔索引)
- [授權資訊](#授權資訊)

---

## 🎯 專案概述

### 問題背景

現代人在選擇餐廳時常面臨以下困擾：
- **資訊過載**：搜尋結果過多，難以篩選
- **群體決策困難**：多人聚餐時難以達成共識
- **偏好不明確**：不知道如何描述自己的需求

### 解決方案

SwiftTaste 提供三大核心模式：

1. **SwiftTaste 模式**：個人化問答式推薦
   - 透過基本問題（人數、預算、餐期、辣度）快速篩選
   - 結合趣味問題捕捉使用者隱性偏好
   - 使用加權評分演算法產生精準推薦

2. **Buddies 模式**：群組協作決策
   - 即時多人投票系統（基於 Socket.IO）
   - 房主擁有 2 倍投票權重
   - 群體共識演算法整合多方意見

3. **Map 模式**：地圖式探索
   - Google Maps 整合，視覺化呈現餐廳位置
   - 收藏清單管理（最多 5 個清單）
   - 餐廳評論與評分系統

### 專案特色

- ✅ **Mobile-First 設計**：優化手機使用體驗
- ✅ **即時協作**：群組模式支援即時投票與同步
- ✅ **智能推薦**：嚴格篩選 + 多維度評分
- ✅ **完整用戶系統**：註冊、登入、個人檔案管理
- ✅ **資料持久化**：Supabase 後端，支援離線資料快取

---

## 🚀 核心功能

### 1. SwiftTaste 模式（個人推薦）

**特點：**
- 分層問答設計：基本問題 → 趣味問題
- 嚴格篩選機制：不符合基本條件的餐廳直接排除
- 加權評分系統：
  - 基本匹配：10 分
  - 趣味問題匹配：5 分
  - 熱門度：2 分
  - 距離：2 分
  - 評分：1.5 分

**工作流程：**
```
使用者輸入 → 基本篩選 → 趣味問題匹配 →
加權計分 → 排序 → 推薦 Top 3
```

### 2. Buddies 模式（群組決策）

**特點：**
- 房間系統：房主創建 → 好友加入（房間碼/QR Code）
- 即時投票：贊成/反對/棄權
- 權重機制：房主 2 票，其他成員 1 票
- 共識演算法：群體偏好 × 3 + 個人評分

**房間生命週期：**
```
創建房間 → 邀請好友 → 回答問題 →
即時投票 → 統計結果 → 產生推薦 → 結束
```

### 3. Map 模式（地圖探索）

**特點：**
- Google Maps JavaScript API 整合
- 自訂地圖標記（愛心、數字標記）
- InfoWindow 展示餐廳詳細資訊
- 收藏清單管理（9 種顏色標記）
- 餐廳評論與 5 星評分系統

**收藏清單系統：**
- 預設「我的最愛」清單（紅色，不可刪除）
- 最多 5 個自訂清單
- 9 種顏色標記（青綠、藍、紫、琥珀、粉紅、青、亮紫、橙）
- 智能顏色分配（避免重複）

### 4. 用戶系統

**功能：**
- 註冊/登入（Email + Password）
- Google OAuth 登入（開發中）
- 個人檔案編輯（頭像、名稱、簡介、基本資料）
- 收藏清單管理
- 評論歷史
- SwiftTaste 歷史記錄

---

## 🏗️ 技術架構

### 前端技術棧

```javascript
{
  "核心框架": "React 19",
  "構建工具": "Vite 6.2.3",
  "路由": "React Router v6",
  "狀態管理": "React Context + Local State",
  "即時通訊": "Socket.IO Client",
  "UI庫": "React Icons",
  "動畫": "Framer Motion",
  "樣式": "CSS Modules + 原生 CSS",
  "地圖": "Google Maps JavaScript API"
}
```

### 後端技術棧

```javascript
{
  "運行環境": "Node.js",
  "框架": "Express.js",
  "資料庫": "Supabase (PostgreSQL)",
  "即時通訊": "Socket.IO",
  "認證": "Supabase Auth",
  "儲存": "Supabase Storage (圖片)"
}
```

### 核心依賴項

```json
{
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "react-router-dom": "^7.1.3",
  "@supabase/supabase-js": "^2.47.10",
  "socket.io": "^4.8.1",
  "socket.io-client": "^4.8.1",
  "framer-motion": "^11.15.0",
  "react-icons": "^5.4.0"
}
```

### 資料庫架構

**核心資料表：**
- `restaurants` - 餐廳基本資料（含標籤、價格、位置、辣度）
- `restaurant_images` - 餐廳圖片
- `restaurant_reviews` - 餐廳評論
- `user_profiles` - 用戶檔案
- `user_favorite_lists` - 收藏清單
- `favorite_list_places` - 清單內的餐廳
- `swifttaste_history` - 推薦歷史記錄
- `buddies_rooms` - Buddies 房間
- `buddies_members` - 房間成員
- `buddies_votes` - 投票記錄

**關鍵欄位設計：**
```sql
-- 餐廳表
restaurants.suggested_people: "1" | "~" | "1~"  -- 1人/多人/兩者皆可
restaurants.price_range: 1 | 2 | 3              -- 平價/中價/高價
restaurants.tags: text[]                         -- 標籤陣列
restaurants.is_spicy: 'true' | 'false' | 'both' -- 辣度標記

-- 收藏清單
user_favorite_lists.color: varchar(7)           -- 清單顏色 (#hex)
user_favorite_lists.places_count: integer       -- 地點數量
```

---

## ⚡ 快速開始

### 環境需求

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **Supabase 帳號**：用於資料庫和認證
- **Google Maps API Key**：用於地圖功能

### 安裝步驟

1. **複製專案**
```bash
git clone https://github.com/elsonyeh/senior-project.git
cd SwiftTaste-demo
```

2. **安裝依賴**
```bash
npm install
```

3. **設定環境變數**

創建 `.env` 檔案：
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

在 `index.html` 中設定 Google Maps API Key：
```html
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=places"></script>
```

4. **設定資料庫**

參考 `SUPABASE-SETUP.md` 執行資料庫遷移：
```bash
# 匯入餐廳資料
npm run import-restaurants

# 執行資料庫遷移
npm run migrate-firebase
npm run migrate-questions
```

5. **啟動開發伺服器**
```bash
npm run dev
```

專案會在 `http://localhost:5174` 啟動

6. **啟動 Socket.IO 伺服器（Buddies 模式需要）**
```bash
cd server
node index.js
```

Socket.IO 伺服器會在 `http://localhost:3001` 啟動

---

## 🛠️ 開發指南

### 專案結構

```
SwiftTaste-demo/
├── src/
│   ├── main.jsx              # 應用入口
│   ├── App.jsx               # 主應用（路由 + 導航）
│   ├── pages/                # 頁面組件
│   │   ├── SwiftTastePage.jsx
│   │   ├── BuddiesPage.jsx
│   │   ├── MapPage.jsx
│   │   ├── UserProfilePage.jsx
│   │   └── AdminDashboard.jsx
│   ├── components/           # 可重用組件
│   │   ├── SwiftTaste.jsx
│   │   ├── BuddiesRoom.jsx
│   │   ├── map/              # 地圖相關組件
│   │   ├── profile/          # 個人檔案組件
│   │   └── admin/            # 管理員組件
│   ├── services/             # API 服務層
│   │   ├── supabaseService.js
│   │   ├── authService.js
│   │   ├── userDataService.js
│   │   ├── restaurantService.js
│   │   └── questionService.js
│   ├── logic/                # 業務邏輯
│   │   └── enhancedRecommendLogicFrontend.js
│   ├── data/                 # 靜態資料
│   │   └── funQuestionTagsMap.js
│   └── utils/                # 工具函數
├── server/                   # 後端伺服器
│   ├── index.js              # Express + Socket.IO
│   ├── logic/                # 後端業務邏輯
│   └── data/                 # 後端資料配置
├── database/                 # 資料庫遷移腳本
│   └── migrations/
├── public/                   # 靜態資源
└── docs/                     # 文檔（建議創建）
```

### 開發命令

```bash
# 開發模式（前端）
npm run dev

# 建置專案
npm run build

# 預覽建置結果
npm run preview

# 程式碼檢查
npm run lint

# 資料庫操作
npm run import-restaurants      # 匯入餐廳資料
npm run migrate-firebase        # Firebase 遷移
npm run migrate-questions       # 問題遷移
```

### 程式碼風格

- 使用 **ESLint** 進行程式碼檢查
- 遵循 **React Hooks 規範**
- CSS 命名採用 **BEM 風格**
- 註解使用**繁體中文**

### Git 工作流程

```bash
# 功能開發
git checkout -b feature/your-feature-name
git add .
git commit -m "feat: 新增功能說明"
git push origin feature/your-feature-name

# Commit 訊息格式
feat: 新功能
fix: 修復錯誤
refactor: 重構代碼
docs: 文檔更新
style: 樣式調整
test: 測試相關
chore: 雜項更新
```

---

## 📚 文檔索引

### 核心文檔

- **[CLAUDE.md](./CLAUDE.md)** - Claude Code 開發指南
- **[RECOMMENDATION-LOGIC-DOCUMENTATION.md](./RECOMMENDATION-LOGIC-DOCUMENTATION.md)** - 推薦演算法詳細說明
- **[COLOR-GUIDE.md](./COLOR-GUIDE.md)** - 完整顏色設計系統
- **[SUPABASE-SETUP.md](./SUPABASE-SETUP.md)** - 資料庫設定指南

### 功能文檔

- **[BUDDIES-FLOW-DOCUMENTATION.md](./BUDDIES-FLOW-DOCUMENTATION.md)** - Buddies 模式完整流程
- **[BUDDIES-DATABASE-MIGRATION-GUIDE.md](./BUDDIES-DATABASE-MIGRATION-GUIDE.md)** - Buddies 資料庫遷移
- **[IMAGE-UPLOAD-FEATURES.md](./IMAGE-UPLOAD-FEATURES.md)** - 圖片上傳功能說明
- **[FUN-QUESTION-SCORING-LOGIC.md](./FUN-QUESTION-SCORING-LOGIC.md)** - 趣味問題評分邏輯

### 安全性與遷移

- **[SECURITY.md](./SECURITY.md)** - 安全性政策
- **[DATABASE-SECURITY-SETUP.md](./DATABASE-SECURITY-SETUP.md)** - 資料庫安全配置
- **[MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md)** - 系統遷移指南

### 故障排除

- **[EMAIL-VERIFICATION-TROUBLESHOOTING.md](./EMAIL-VERIFICATION-TROUBLESHOOTING.md)** - 郵件驗證問題排查
- **[RECOMMENDATION-DIAGNOSIS.md](./RECOMMENDATION-DIAGNOSIS.md)** - 推薦系統診斷工具

---

## 🔒 授權資訊

本專案為學術研究專案，版權歸屬於開發團隊。

### 使用的第三方服務

- **Google Maps JavaScript API** - [服務條款](https://developers.google.com/maps/terms)
- **Supabase** - [隱私政策](https://supabase.com/privacy)
- **React** - MIT License
- **Socket.IO** - MIT License

---

## 👥 開發團隊

- **專案負責人**：[您的名字]
- **指導教授**：[教授名字]
- **開發團隊**：SwiftTaste Development Team

---

## 📧 聯絡資訊

- **Email**: [your-email@example.com]
- **GitHub Issues**: [https://github.com/elsonyeh/senior-project/issues](https://github.com/elsonyeh/senior-project/issues)

---

## 🙏 致謝

感謝所有參與測試和提供回饋的使用者，以及開源社群提供的優秀工具和函式庫。

---

**最後更新**：2025-10-27
**版本**：1.0.0
**狀態**：開發中 🚧
