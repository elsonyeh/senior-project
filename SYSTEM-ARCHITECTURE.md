# SwiftTaste 系統架構文件

**文件類型**：技術規範文件（Technical Specification Document）
**文件版本**：1.0
**最後更新**：2025-10-27
**文件狀態**：正式版本
**適用對象**：系統架構師、開發工程師、學術研究

---

## 摘要

SwiftTaste 是一個基於 Web 的智能餐廳推薦系統，採用前後端分離架構，整合了問答式推薦、群體協作決策、地圖探索等功能。本文件詳細描述系統的技術架構、模組設計、資料流向、API 規範以及核心演算法實作，適用於學術論文撰寫、系統維護及擴展開發。

**關鍵字**：餐廳推薦系統、協同過濾、即時協作、React、Supabase、Socket.IO

---

## 目錄

1. [系統概述](#1-系統概述)
2. [技術架構](#2-技術架構)
3. [前端架構](#3-前端架構)
4. [後端架構](#4-後端架構)
5. [資料庫設計](#5-資料庫設計)
6. [API 設計](#6-api-設計)
7. [核心模組](#7-核心模組)
8. [資料流向](#8-資料流向)
9. [安全性設計](#9-安全性設計)
10. [效能優化](#10-效能優化)
11. [部署架構](#11-部署架構)
12. [系統擴展性](#12-系統擴展性)
13. [參考文獻](#13-參考文獻)

---

## 1. 系統概述

### 1.1 研究背景與動機

現代餐飲選擇面臨三大挑戰：
1. **資訊過載問題（Information Overload）**：搜尋引擎返回大量結果，使用者難以快速篩選
2. **群體決策困難（Group Decision Making）**：多人聚餐時難以達成共識
3. **偏好表達模糊（Preference Ambiguity）**：使用者無法精確描述自身需求

### 1.2 系統目標

SwiftTaste 系統旨在解決上述問題，提供以下核心功能：

**目標 1：個人化精準推薦**
- 透過結構化問答快速捕捉使用者偏好
- 使用加權評分演算法產生精準推薦
- 支援基本條件（人數、預算、餐期、辣度）與趣味問題

**目標 2：群體協作決策**
- 即時多人投票系統
- 權重分配機制（房主 2 票）
- 群體共識演算法

**目標 3：地圖式探索**
- 整合 Google Maps API
- 收藏清單管理
- 評論與評分系統

### 1.3 系統特色

| 特色 | 說明 | 實作方式 |
|-----|------|---------|
| **智能篩選** | 嚴格基本條件匹配 + 趣味問題偏好 | 多維度加權評分 |
| **即時協作** | 多人同步投票與決策 | Socket.IO WebSocket |
| **Mobile-First** | 優化手機使用體驗 | 響應式設計 + 觸控優化 |
| **離線支援** | 本地資料快取 | LocalStorage + Service Worker |
| **可擴展性** | 模組化設計 | 分層架構 + 依賴注入 |

---

## 2. 技術架構

### 2.1 整體架構圖

```
┌─────────────────────────────────────────────────────────────────┐
│                        使用者介面層（UI Layer）                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ React Components│ │ CSS Modules │ │ Framer Motion│          │
│  │  (JSX + Hooks) │ │ BEM Naming  │ │  (Animations) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                      狀態管理層（State Layer）                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │React Context │  │ Local State  │  │  React Router│          │
│  │   (Global)   │  │  (Component) │  │  (Navigation)│          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                      業務邏輯層（Logic Layer）                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  推薦演算法            │  標籤映射           │  評分計算    │  │
│  │  (Recommendation)    │  (Tag Mapping)    │  (Rating)   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                      服務層（Service Layer）                       │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐      │
│  │ Auth      │ │Restaurant │ │User Data  │ │Question   │      │
│  │ Service   │ │  Service  │ │  Service  │ │ Service   │      │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘      │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                      通訊層（Communication Layer）                 │
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │  Supabase Client │         │  Socket.IO Client│             │
│  │  (REST + Auth)   │         │   (WebSocket)    │             │
│  └──────────────────┘         └──────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                       後端層（Backend Layer）                      │
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │  Supabase        │         │  Socket.IO Server│             │
│  │  (PostgreSQL)    │         │  (Express.js)    │             │
│  │  - Database      │         │  - Room Mgmt     │             │
│  │  - Auth          │         │  - Vote Sync     │             │
│  │  - Storage       │         │  - Real-time     │             │
│  └──────────────────┘         └──────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                      外部服務層（External Services）               │
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │  Google Maps API │         │  Google Places   │             │
│  │  - Map Display   │         │  - Search        │             │
│  │  - Markers       │         │  - Details       │             │
│  └──────────────────┘         └──────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 架構設計原則

**1. 關注點分離（Separation of Concerns）**
- UI 層：僅負責視覺呈現
- 業務邏輯層：封裝核心演算法
- 資料層：處理資料存取

**2. 依賴反轉（Dependency Inversion）**
- 高層模組不依賴底層模組
- 透過服務層抽象資料來源

**3. 單一職責（Single Responsibility）**
- 每個模組只負責一項功能
- 提高可測試性與可維護性

**4. 開放封閉原則（Open-Closed Principle）**
- 對擴展開放，對修改封閉
- 透過配置檔案調整行為

### 2.3 技術選型理由

| 技術 | 選擇理由 | 替代方案 |
|-----|---------|---------|
| **React 19** | 虛擬 DOM 效能、豐富生態系、Hooks API | Vue.js, Angular |
| **Vite** | 極快的開發體驗、原生 ESM | Webpack, Parcel |
| **Supabase** | 開源、PostgreSQL、內建認證 | Firebase, AWS Amplify |
| **Socket.IO** | 自動降級、房間管理、簡單 API | WebSocket 原生, PeerJS |
| **CSS Modules** | 作用域隔離、零運行時成本 | Styled-components, Tailwind |

---

## 3. 前端架構

### 3.1 目錄結構

```
src/
├── main.jsx                    # 應用入口點
├── App.jsx                     # 根組件（路由 + 導航）
│
├── pages/                      # 頁面級組件
│   ├── SwiftTastePage.jsx     # SwiftTaste 模式頁面
│   ├── BuddiesPage.jsx        # Buddies 模式頁面
│   ├── MapPage.jsx            # 地圖探索頁面
│   ├── UserProfilePage.jsx    # 用戶個人頁面
│   └── AdminDashboard.jsx     # 管理員後台
│
├── components/                 # 可重用組件
│   ├── SwiftTaste.jsx         # SwiftTaste 核心邏輯
│   ├── BuddiesRoom.jsx        # Buddies 房間
│   ├── BottomNav.jsx          # 底部導航欄
│   │
│   ├── map/                   # 地圖相關組件
│   │   ├── MapView.jsx        # 地圖主視圖
│   │   ├── MapSearch.jsx      # 地圖搜尋
│   │   ├── FavoriteLists.jsx  # 收藏清單
│   │   ├── RestaurantDetailModal.jsx  # 餐廳詳細彈窗
│   │   └── RestaurantReviews.jsx      # 餐廳評論
│   │
│   ├── profile/               # 個人檔案組件
│   │   ├── ProfileHeader.jsx  # 檔案頭部
│   │   ├── ProfileMenu.jsx    # 個人選單
│   │   ├── MyLists.jsx        # 我的清單
│   │   ├── MyReviews.jsx      # 我的評論
│   │   ├── AuthModal.jsx      # 登入/註冊彈窗
│   │   └── PageWrapper.jsx    # 頁面包裝器
│   │
│   ├── admin/                 # 管理員組件
│   │   ├── RestaurantManager.jsx
│   │   ├── RecommendationTester.jsx
│   │   └── RestaurantGeocoder.jsx
│   │
│   └── common/                # 通用組件
│       ├── ConfirmDialog.jsx  # 確認對話框
│       └── LoadingOverlay.jsx # 載入遮罩
│
├── services/                   # 服務層（API 封裝）
│   ├── supabaseService.js     # Supabase 客戶端
│   ├── authService.js         # 認證服務
│   ├── userDataService.js     # 用戶資料服務
│   ├── restaurantService.js   # 餐廳資料服務
│   └── questionService.js     # 問題資料服務
│
├── logic/                      # 業務邏輯層
│   └── enhancedRecommendLogicFrontend.js  # 推薦演算法
│
├── data/                       # 靜態資料與配置
│   └── funQuestionTagsMap.js  # 趣味問題標籤映射
│
└── utils/                      # 工具函數
    └── ...                     # 輔助函數
```

### 3.2 元件設計模式

**1. 容器/展示組件模式（Container/Presentational Pattern）**

```javascript
// 容器組件：負責邏輯與資料
export default function MyReviewsContainer({ user }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReviews();
  }, [user]);

  const loadReviews = async () => {
    const result = await restaurantReviewService.getUserReviews(user.id);
    setReviews(result.reviews);
    setLoading(false);
  };

  return <MyReviewsPresentation reviews={reviews} loading={loading} />;
}

// 展示組件：僅負責渲染
function MyReviewsPresentation({ reviews, loading }) {
  if (loading) return <Loading />;
  return <div>{reviews.map(r => <ReviewCard key={r.id} {...r} />)}</div>;
}
```

**2. Hooks 複用模式（Custom Hooks Pattern）**

```javascript
// 自訂 Hook：封裝可重用邏輯
function useFavoriteLists(user) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadLists();
  }, [user]);

  const loadLists = async () => {
    const result = await userDataService.getFavoriteLists(user.id);
    setLists(result.lists);
    setLoading(false);
  };

  const createList = async (name) => {
    const result = await userDataService.createFavoriteList(user.id, { name });
    if (result.success) {
      setLists([...lists, result.list]);
    }
  };

  return { lists, loading, createList };
}

// 使用自訂 Hook
function FavoriteLists({ user }) {
  const { lists, loading, createList } = useFavoriteLists(user);
  // ...
}
```

**3. Context 狀態共享模式（Context Sharing Pattern）**

```javascript
// 創建 Context
export const NavContext = createContext();

// 提供者組件
export function NavProvider({ children }) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <NavContext.Provider value={{ isAuthModalOpen, setIsAuthModalOpen }}>
      {children}
    </NavContext.Provider>
  );
}

// 消費者組件
function SomeComponent() {
  const { isAuthModalOpen, setIsAuthModalOpen } = useContext(NavContext);
  // ...
}
```

### 3.3 狀態管理策略

**分層狀態管理：**

```
全域狀態 (React Context)
├── 認證狀態（user, isAuthenticated）
├── 導航狀態（currentPage, isNavVisible）
└── 通知狀態（notifications）

頁面狀態 (Page Component State)
├── 資料列表（restaurants, reviews, lists）
├── 載入狀態（loading, error）
└── UI 狀態（isModalOpen, selectedItem）

元件狀態 (Local Component State)
├── 表單輸入（inputValue, formData）
├── UI 互動（isHovered, isExpanded）
└── 臨時資料（tempSelection, dragPosition）
```

**狀態更新原則：**
1. **向上提升（Lift State Up）**：多個子組件需要共享的狀態提升到共同父組件
2. **就近管理（Keep State Close）**：僅單一組件使用的狀態保持在該組件內
3. **不可變更新（Immutable Updates）**：使用擴展運算符或 immer 確保不可變性

---

## 4. 後端架構

### 4.1 Supabase 架構

**4.1.1 PostgreSQL 資料庫**

```
Supabase PostgreSQL Instance
├── Schema: public
│   ├── Tables (資料表)
│   │   ├── restaurants
│   │   ├── restaurant_images
│   │   ├── restaurant_reviews
│   │   ├── user_profiles
│   │   ├── user_favorite_lists
│   │   ├── favorite_list_places
│   │   ├── swifttaste_history
│   │   ├── buddies_rooms
│   │   ├── buddies_members
│   │   └── buddies_votes
│   │
│   ├── Views (視圖)
│   │   └── restaurant_with_ratings (聚合查詢優化)
│   │
│   ├── Functions (函數)
│   │   ├── calculate_combined_rating()
│   │   └── increment_places_count()
│   │
│   └── Triggers (觸發器)
│       ├── on_review_insert (更新評分)
│       └── on_list_place_change (更新計數)
│
├── Auth (認證系統)
│   ├── Users Table
│   ├── JWT Token Management
│   └── OAuth Providers (Google, Apple)
│
├── Storage (儲存系統)
│   ├── Bucket: avatars (用戶頭像)
│   ├── Bucket: restaurant-images (餐廳圖片)
│   └── RLS Policies (行級安全策略)
│
└── Realtime (即時訂閱)
    ├── buddies_votes (投票即時更新)
    └── restaurant_reviews (評論即時更新)
```

**4.1.2 Row Level Security (RLS) 策略**

```sql
-- 用戶只能讀取和修改自己的收藏清單
CREATE POLICY "Users can view their own lists"
  ON user_favorite_lists
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own lists"
  ON user_favorite_lists
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lists"
  ON user_favorite_lists
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 所有人可以讀取餐廳資料
CREATE POLICY "Anyone can view restaurants"
  ON restaurants
  FOR SELECT
  TO public
  USING (true);

-- 已登入用戶可以新增評論
CREATE POLICY "Authenticated users can add reviews"
  ON restaurant_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

### 4.2 Socket.IO 伺服器架構

**4.2.1 伺服器結構**

```javascript
// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5174",
    methods: ["GET", "POST"]
  }
});

// 房間資料結構
const rooms = new Map(); // roomId => Room Object

class Room {
  constructor(roomId, hostId, hostName) {
    this.roomId = roomId;
    this.hostId = hostId;
    this.hostName = hostName;
    this.members = new Map(); // socketId => Member Object
    this.votes = new Map();   // memberId => Vote Object
    this.status = 'waiting';  // waiting, answering, voting, finished
    this.questions = [];
    this.answers = new Map(); // memberId => Answers Array
    this.createdAt = new Date();
  }

  addMember(socketId, userId, userName) {
    this.members.set(socketId, {
      socketId,
      userId,
      userName,
      isHost: userId === this.hostId,
      joinedAt: new Date()
    });
  }

  removeMember(socketId) {
    this.members.delete(socketId);
    if (this.members.size === 0) {
      return true; // 房間應被刪除
    }
    return false;
  }

  getVoteWeight(userId) {
    return userId === this.hostId ? 2 : 1; // 房主 2 票
  }
}

// Socket.IO 事件處理
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // 創建房間
  socket.on('createRoom', ({ roomId, hostId, hostName }) => {
    const room = new Room(roomId, hostId, hostName);
    rooms.set(roomId, room);
    socket.join(roomId);
    room.addMember(socket.id, hostId, hostName);
    socket.emit('roomCreated', { roomId, room: roomToJSON(room) });
  });

  // 加入房間
  socket.on('joinRoom', ({ roomId, userId, userName }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: '房間不存在' });
      return;
    }
    socket.join(roomId);
    room.addMember(socket.id, userId, userName);

    // 通知房間所有成員
    io.to(roomId).emit('memberJoined', {
      member: { userId, userName },
      members: Array.from(room.members.values())
    });
  });

  // 提交投票
  socket.on('submitVote', ({ roomId, memberId, restaurantId, vote }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const weight = room.getVoteWeight(memberId);
    room.votes.set(`${memberId}_${restaurantId}`, {
      memberId,
      restaurantId,
      vote, // 'yes', 'no', 'abstain'
      weight,
      timestamp: new Date()
    });

    // 即時同步所有成員
    io.to(roomId).emit('voteUpdated', {
      votes: Array.from(room.votes.values())
    });
  });

  // 斷線處理
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    // 從所有房間中移除該 socket
    rooms.forEach((room, roomId) => {
      if (room.members.has(socket.id)) {
        const shouldDelete = room.removeMember(socket.id);
        if (shouldDelete) {
          rooms.delete(roomId);
        } else {
          io.to(roomId).emit('memberLeft', {
            members: Array.from(room.members.values())
          });
        }
      }
    });
  });
});

server.listen(3001, () => {
  console.log('Socket.IO server running on port 3001');
});
```

**4.2.2 事件流程圖**

```
房間創建流程：
┌─────────┐    createRoom    ┌─────────────┐    roomCreated    ┌─────────┐
│  Client │ ───────────────→ │ Socket.IO   │ ───────────────→ │  Client │
│ (Host)  │                  │   Server    │                  │ (Host)  │
└─────────┘                  └─────────────┘                  └─────────┘
                                    │
                                    │ room.set(roomId, Room)
                                    ↓
                              [記憶體儲存]

成員加入流程：
┌─────────┐    joinRoom      ┌─────────────┐  memberJoined    ┌─────────┐
│  Client │ ───────────────→ │ Socket.IO   │ ───────────────→ │ All in  │
│ (Member)│                  │   Server    │                  │  Room   │
└─────────┘                  └─────────────┘                  └─────────┘

投票同步流程：
┌─────────┐   submitVote     ┌─────────────┐  voteUpdated     ┌─────────┐
│  Client │ ───────────────→ │ Socket.IO   │ ───────────────→ │ All in  │
│ (Any)   │                  │   Server    │                  │  Room   │
└─────────┘                  └─────────────┘                  └─────────┘
                                    │
                                    │ room.votes.set()
                                    ↓
                              [即時計算統計]
```

---

## 5. 資料庫設計

### 5.1 實體關係圖（ERD）

```
┌─────────────────────────────────────────────────────────────────┐
│                        核心實體（Core Entities）                   │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐           ┌──────────────────┐
│   restaurants    │ 1       * │restaurant_images │
│──────────────────│◄──────────┤──────────────────│
│ id (PK)          │           │ id (PK)          │
│ name             │           │ restaurant_id(FK)│
│ address          │           │ image_url        │
│ latitude         │           │ is_primary       │
│ longitude        │           │ display_order    │
│ rating           │           └──────────────────┘
│ price_range      │
│ suggested_people │           ┌──────────────────┐
│ tags[]           │ 1       * │restaurant_reviews│
│ is_spicy         │◄──────────┤──────────────────│
│ category         │           │ id (PK)          │
└──────────────────┘           │ restaurant_id(FK)│
                               │ user_id (FK)     │
                               │ rating (1-5)     │
                               │ comment          │
                               │ created_at       │
                               └──────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        用戶實體（User Entities）                   │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐           ┌──────────────────────┐
│  user_profiles   │ 1       * │user_favorite_lists   │
│──────────────────│◄──────────┤──────────────────────│
│ id (PK)          │           │ id (PK)              │
│ email            │           │ user_id (FK)         │
│ name             │           │ name                 │
│ avatar_url       │           │ description          │
│ bio              │           │ color                │
│ gender           │           │ is_public            │
│ birth_date       │           │ places_count         │
│ occupation       │           │ created_at           │
│ location         │           │ updated_at           │
│ created_at       │           └──────────────────────┘
└──────────────────┘                      │
        │                                 │ *
        │                                 ↓
        │ 1                    ┌──────────────────────┐
        │                      │favorite_list_places  │
        │                      │──────────────────────│
        │                      │ id (PK)              │
        │                      │ list_id (FK)         │
        │                      │ restaurant_id (FK)   │
        │                      │ notes                │
        │                      │ added_at             │
        │                      └──────────────────────┘
        │ *
        ↓
┌──────────────────┐
│swifttaste_history│
│──────────────────│
│ id (PK)          │
│ user_id (FK)     │
│ basic_answers    │
│ fun_answers      │
│ recommendations  │
│ created_at       │
└──────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Buddies 實體（Buddies Entities）             │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐           ┌──────────────────┐
│  buddies_rooms   │ 1       * │ buddies_members  │
│──────────────────│◄──────────┤──────────────────│
│ id (PK)          │           │ id (PK)          │
│ room_code        │           │ room_id (FK)     │
│ host_id (FK)     │           │ user_id (FK)     │
│ status           │           │ display_name     │
│ question_set     │           │ is_host          │
│ created_at       │           │ joined_at        │
│ updated_at       │           │ answers          │
└──────────────────┘           └──────────────────┘
        │ 1                             │ *
        │ *                             ↓
        ↓                    ┌──────────────────┐
┌──────────────────┐         │  buddies_votes   │
│ buddies_questions│         │──────────────────│
│──────────────────│         │ id (PK)          │
│ id (PK)          │         │ room_id (FK)     │
│ room_id (FK)     │         │ member_id (FK)   │
│ question_text    │         │ restaurant_id(FK)│
│ question_type    │         │ vote_type        │
│ options          │         │ created_at       │
│ order_index      │         └──────────────────┘
└──────────────────┘
```

### 5.2 核心資料表詳細規格

#### 5.2.1 restaurants（餐廳表）

| 欄位名 | 資料型別 | 約束 | 說明 |
|-------|---------|------|------|
| id | uuid | PK, NOT NULL | 主鍵（Google Place ID 或自動生成） |
| name | varchar(255) | NOT NULL | 餐廳名稱 |
| address | text | | 完整地址 |
| latitude | numeric(10,8) | | 緯度座標 |
| longitude | numeric(11,8) | | 經度座標 |
| rating | numeric(2,1) | CHECK (rating >= 0 AND rating <= 5) | Google 評分 (0-5) |
| user_ratings_total | integer | DEFAULT 0 | Google 評論總數 |
| price_range | integer | CHECK (price_range IN (1,2,3)) | 價格區間：1=平價, 2=中價, 3=奢華 |
| suggested_people | varchar(10) | CHECK (suggested_people IN ('1','~','1~')) | 建議人數：1=單人, ~=多人, 1~=皆可 |
| tags | text[] | | 標籤陣列（用於趣味問題匹配） |
| is_spicy | varchar(10) | CHECK (is_spicy IN ('true','false','both')) | 辣度標記 |
| category | varchar(100) | | 餐廳分類 |
| place_id | varchar(255) | UNIQUE | Google Place ID |
| created_at | timestamptz | DEFAULT now() | 創建時間 |
| updated_at | timestamptz | DEFAULT now() | 更新時間 |

**索引設計：**
```sql
CREATE INDEX idx_restaurants_location ON restaurants USING gist (
  ll_to_earth(latitude, longitude)
); -- 地理位置索引（GiST）

CREATE INDEX idx_restaurants_price ON restaurants (price_range);
CREATE INDEX idx_restaurants_tags ON restaurants USING gin (tags);
CREATE INDEX idx_restaurants_rating ON restaurants (rating DESC);
```

#### 5.2.2 user_favorite_lists（收藏清單表）

| 欄位名 | 資料型別 | 約束 | 說明 |
|-------|---------|------|------|
| id | uuid | PK, NOT NULL | 主鍵 |
| user_id | uuid | FK, NOT NULL | 用戶 ID (外鍵至 user_profiles) |
| name | varchar(100) | NOT NULL | 清單名稱 |
| description | text | | 清單描述 |
| color | varchar(7) | NOT NULL, DEFAULT '#ff6b35' | 清單顏色（HEX 格式） |
| is_public | boolean | DEFAULT false | 是否公開 |
| places_count | integer | DEFAULT 0 | 地點數量（自動維護） |
| created_at | timestamptz | DEFAULT now() | 創建時間 |
| updated_at | timestamptz | DEFAULT now() | 更新時間 |

**約束：**
```sql
-- 每個用戶最多 5 個清單
CREATE OR REPLACE FUNCTION check_list_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM user_favorite_lists WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'User cannot have more than 5 favorite lists';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_list_limit
  BEFORE INSERT ON user_favorite_lists
  FOR EACH ROW EXECUTE FUNCTION check_list_limit();
```

#### 5.2.3 restaurant_reviews（餐廳評論表）

| 欄位名 | 資料型別 | 約束 | 說明 |
|-------|---------|------|------|
| id | uuid | PK, NOT NULL | 主鍵 |
| restaurant_id | uuid | FK, NOT NULL | 餐廳 ID |
| user_id | uuid | FK, NOT NULL | 用戶 ID |
| rating | integer | CHECK (rating >= 1 AND rating <= 5) | 評分 (1-5) |
| comment | text | | 評論內容 |
| created_at | timestamptz | DEFAULT now() | 創建時間 |
| updated_at | timestamptz | DEFAULT now() | 更新時間 |

**唯一約束：**
```sql
-- 每個用戶對每間餐廳只能留一則評論
CREATE UNIQUE INDEX idx_unique_user_restaurant_review
  ON restaurant_reviews (user_id, restaurant_id);
```

**觸發器：更新餐廳評分**
```sql
CREATE OR REPLACE FUNCTION update_restaurant_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- 重新計算餐廳的 TasteBuddies 評分
  UPDATE restaurants
  SET updated_at = now()
  WHERE id = NEW.restaurant_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_review_change
  AFTER INSERT OR UPDATE OR DELETE ON restaurant_reviews
  FOR EACH ROW EXECUTE FUNCTION update_restaurant_rating();
```

### 5.3 資料完整性設計

**5.3.1 外鍵約束**

```sql
-- 收藏清單必須屬於有效用戶
ALTER TABLE user_favorite_lists
  ADD CONSTRAINT fk_user_favorite_lists_user
  FOREIGN KEY (user_id) REFERENCES user_profiles(id)
  ON DELETE CASCADE;

-- 評論必須關聯有效餐廳和用戶
ALTER TABLE restaurant_reviews
  ADD CONSTRAINT fk_reviews_restaurant
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
  ON DELETE CASCADE;

ALTER TABLE restaurant_reviews
  ADD CONSTRAINT fk_reviews_user
  FOREIGN KEY (user_id) REFERENCES user_profiles(id)
  ON DELETE CASCADE;
```

**5.3.2 CHECK 約束**

```sql
-- 評分必須在 1-5 之間
ALTER TABLE restaurant_reviews
  ADD CONSTRAINT check_rating_range
  CHECK (rating >= 1 AND rating <= 5);

-- 價格區間必須為 1, 2, 3
ALTER TABLE restaurants
  ADD CONSTRAINT check_price_range
  CHECK (price_range IN (1, 2, 3));

-- 顏色必須為有效的 HEX 格式
ALTER TABLE user_favorite_lists
  ADD CONSTRAINT check_color_format
  CHECK (color ~ '^#[0-9A-Fa-f]{6}$');
```

---

## 6. API 設計

### 6.1 RESTful API 規範（Supabase）

**6.1.1 認證 API**

```javascript
// 註冊
POST /auth/v1/signup
Request:
{
  "email": "user@example.com",
  "password": "securePassword123",
  "options": {
    "data": {
      "name": "User Name",
      "bio": "User bio"
    }
  }
}
Response:
{
  "user": { "id": "uuid", "email": "...", ... },
  "session": { "access_token": "jwt", ... }
}

// 登入
POST /auth/v1/token?grant_type=password
Request:
{
  "email": "user@example.com",
  "password": "securePassword123"
}
Response:
{
  "access_token": "jwt",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "..."
}

// 登出
POST /auth/v1/logout
Headers: { "Authorization": "Bearer {access_token}" }
Response: { "success": true }
```

**6.1.2 餐廳 API**

```javascript
// 查詢餐廳列表（含篩選）
GET /rest/v1/restaurants?select=*&price_range=eq.1&tags=cs.{吃飽}
Headers: { "apikey": "{anon_key}" }
Response:
[
  {
    "id": "uuid",
    "name": "Restaurant Name",
    "address": "...",
    "price_range": 1,
    "tags": ["吃飽", "日式"],
    ...
  }
]

// 取得單一餐廳詳細資訊
GET /rest/v1/restaurants?id=eq.{restaurant_id}&select=*,restaurant_images(*),restaurant_reviews(*)
Response:
{
  "id": "uuid",
  "name": "...",
  "restaurant_images": [...],
  "restaurant_reviews": [...]
}
```

**6.1.3 收藏清單 API**

```javascript
// 取得用戶所有收藏清單
GET /rest/v1/user_favorite_lists?user_id=eq.{userId}&select=*,favorite_list_places(*)
Headers: { "Authorization": "Bearer {access_token}" }
Response:
[
  {
    "id": "uuid",
    "name": "我的最愛",
    "color": "#ef4444",
    "places_count": 5,
    "favorite_list_places": [...]
  }
]

// 創建新收藏清單
POST /rest/v1/user_favorite_lists
Headers: { "Authorization": "Bearer {access_token}" }
Request:
{
  "user_id": "uuid",
  "name": "清單名稱",
  "color": "#3b82f6"
}
Response:
{
  "id": "uuid",
  "name": "清單名稱",
  "created_at": "2025-10-27T..."
}

// 添加餐廳到清單
POST /rest/v1/favorite_list_places
Request:
{
  "list_id": "uuid",
  "restaurant_id": "uuid",
  "notes": "Optional notes"
}
```

**6.1.4 評論 API**

```javascript
// 新增評論
POST /rest/v1/restaurant_reviews
Headers: { "Authorization": "Bearer {access_token}" }
Request:
{
  "restaurant_id": "uuid",
  "user_id": "uuid",
  "rating": 5,
  "comment": "Very good restaurant!"
}

// 查詢餐廳評論
GET /rest/v1/restaurant_reviews?restaurant_id=eq.{id}&select=*,user_profiles(name,avatar_url)
Response:
[
  {
    "id": "uuid",
    "rating": 5,
    "comment": "...",
    "created_at": "...",
    "user_profiles": {
      "name": "User Name",
      "avatar_url": "..."
    }
  }
]
```

### 6.2 WebSocket API 規範（Socket.IO）

**6.2.1 連線管理**

```javascript
// 客戶端連線
const socket = io('http://localhost:3001', {
  auth: {
    token: userToken
  }
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});
```

**6.2.2 房間管理事件**

```javascript
// 創建房間
socket.emit('createRoom', {
  roomId: 'ABCD1234',
  hostId: 'user_uuid',
  hostName: 'Host Name'
});

socket.on('roomCreated', (data) => {
  console.log('Room created:', data.roomId);
});

// 加入房間
socket.emit('joinRoom', {
  roomId: 'ABCD1234',
  userId: 'user_uuid',
  userName: 'User Name'
});

socket.on('memberJoined', (data) => {
  console.log('New member:', data.member);
  console.log('All members:', data.members);
});

// 離開房間
socket.emit('leaveRoom', {
  roomId: 'ABCD1234'
});

socket.on('memberLeft', (data) => {
  console.log('Member left:', data.memberId);
  console.log('Remaining members:', data.members);
});
```

**6.2.3 問答與投票事件**

```javascript
// 提交答案
socket.emit('submitAnswers', {
  roomId: 'ABCD1234',
  memberId: 'user_uuid',
  basicAnswers: ['單人', '平價美食', '吃飽', '不辣'],
  funAnswers: ['輕鬆自在', '快速方便']
});

socket.on('answersSubmitted', (data) => {
  console.log('Answers submitted:', data.memberId);
});

// 提交投票
socket.emit('submitVote', {
  roomId: 'ABCD1234',
  memberId: 'user_uuid',
  restaurantId: 'restaurant_uuid',
  vote: 'yes' // 'yes', 'no', 'abstain'
});

socket.on('voteUpdated', (data) => {
  console.log('Current votes:', data.votes);
  // data.votes = [
  //   { memberId: '...', restaurantId: '...', vote: 'yes', weight: 2 },
  //   ...
  // ]
});
```

**6.2.4 錯誤處理**

```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error.message);
  // 根據錯誤類型進行處理
  switch(error.code) {
    case 'ROOM_NOT_FOUND':
      alert('房間不存在');
      break;
    case 'ROOM_FULL':
      alert('房間已滿');
      break;
    case 'UNAUTHORIZED':
      alert('未授權操作');
      break;
    default:
      alert('發生未知錯誤');
  }
});
```

---

## 7. 核心模組

### 7.1 推薦演算法模組

**7.1.1 模組架構**

```javascript
// src/logic/enhancedRecommendLogicFrontend.js

// 模組輸出介面
export const recommendLogic = {
  // 主函數：產生推薦清單
  generateRecommendations: (restaurants, answers, userLocation) => {
    const scoredRestaurants = restaurants
      .map(r => calculateScore(r, answers, userLocation))
      .filter(r => r.score > WEIGHT.MIN_SCORE)
      .sort((a, b) => b.score - a.score);

    return scoredRestaurants.slice(0, 10);
  },

  // 輔助函數：計算單一餐廳分數
  calculateScore: (restaurant, answers, userLocation) => { ... },

  // 標籤匹配函數
  matchTags: (restaurantTags, answerTags) => { ... },

  // 距離計算函數
  calculateDistance: (lat1, lng1, lat2, lng2) => { ... }
};
```

**7.1.2 核心演算法流程**

```javascript
function calculateScore(restaurant, userAnswers, userLocation) {
  let score = 0;
  const { basicAnswers, funAnswers } = userAnswers;

  // ═══════════════════════════════════════════════════════
  // 步驟 1：基本問題匹配（嚴格篩選）
  // ═══════════════════════════════════════════════════════
  let basicMatchCount = 0;

  basicAnswers.forEach(answer => {
    let matched = false;

    switch(answer) {
      case "單人":
        matched = restaurant.suggested_people.includes("1");
        break;

      case "多人":
        matched = restaurant.suggested_people.includes("~");
        break;

      case "奢華美食":
        if (restaurant.price_range === 3) {
          matched = true;
        } else if (restaurant.price_range === 2) {
          matched = Math.random() < 0.7; // 70% 機率
        }
        break;

      case "平價美食":
        if (restaurant.price_range === 1) {
          matched = true;
        } else if (restaurant.price_range === 2) {
          matched = Math.random() < 0.3; // 30% 機率
        }
        break;

      case "吃":
        const hasMeal = restaurant.tags.some(tag =>
          tag.includes("吃一點") || tag.includes("吃飽")
        );
        matched = hasMeal;
        break;

      case "喝":
        matched = restaurant.tags.includes("喝");
        break;

      case "辣":
        matched = restaurant.is_spicy === 'true' || restaurant.is_spicy === 'both';
        break;

      case "不辣":
        matched = restaurant.is_spicy === 'false' || restaurant.is_spicy === 'both';
        break;

      default:
        matched = false;
    }

    if (matched) {
      score += WEIGHT.BASIC_MATCH; // +10 分
      basicMatchCount++;
    }
  });

  // ★ 嚴格篩選：必須符合所有基本條件
  if (basicAnswers.length > 0 && basicMatchCount < basicAnswers.length) {
    return { ...restaurant, score: 0 }; // 直接排除
  }

  // ═══════════════════════════════════════════════════════
  // 步驟 2：趣味問題匹配（偏好加分）
  // ═══════════════════════════════════════════════════════
  funAnswers.forEach(answer => {
    const mappedTags = funQuestionTagsMap[answer] || [];

    mappedTags.forEach(tag => {
      if (restaurant.tags.includes(tag)) {
        score += WEIGHT.FUN_MATCH; // +5 分
      }
    });
  });

  // ═══════════════════════════════════════════════════════
  // 步驟 3：評分權重（餐廳品質）
  // ═══════════════════════════════════════════════════════
  if (restaurant.rating > 0) {
    score += (restaurant.rating / 5) * WEIGHT.RATING; // 最高 +1.5 分
  }

  // ═══════════════════════════════════════════════════════
  // 步驟 4：熱門度權重（評論數量）
  // ═══════════════════════════════════════════════════════
  if (restaurant.user_ratings_total > 0) {
    const popularityScore = Math.min(
      restaurant.user_ratings_total / 100,
      1
    ) * WEIGHT.POPULARITY; // 最高 +2 分
    score += popularityScore;
  }

  // ═══════════════════════════════════════════════════════
  // 步驟 5：距離權重（地理位置）
  // ═══════════════════════════════════════════════════════
  if (userLocation && restaurant.latitude && restaurant.longitude) {
    const distance = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      restaurant.latitude,
      restaurant.longitude
    );

    // 距離衰減函數：0-1km = 滿分, 1-5km = 線性衰減, >5km = 0 分
    let distanceScore = 0;
    if (distance <= 1) {
      distanceScore = WEIGHT.DISTANCE; // +2 分
    } else if (distance <= 5) {
      distanceScore = WEIGHT.DISTANCE * ((5 - distance) / 4); // 線性衰減
    }
    score += distanceScore;
  }

  return {
    ...restaurant,
    score: Math.round(score * 100) / 100 // 四捨五入到小數點後 2 位
  };
}
```

**7.1.3 標籤映射配置**

```javascript
// src/data/funQuestionTagsMap.js

export const funQuestionTagsMap = {
  // 氛圍類
  "輕鬆自在": ["咖啡廳", "輕食", "早午餐", "甜點", "喝"],
  "隆重慶祝": ["高級", "精緻", "西式", "日式", "牛排"],
  "社交聚會": ["火鍋", "吃到飽", "熱炒", "串燒", "居酒屋"],

  // 速度類
  "快速方便": ["快餐", "便當", "小吃", "麵店", "飯糰"],
  "慢慢享受": ["精緻", "高級", "咖啡廳", "下午茶"],

  // 食量類
  "吃飽": ["吃飽", "吃到飽", "便當", "定食"],
  "吃一點": ["吃一點", "輕食", "甜點", "喝"],

  // 口味類
  "濃郁風味": ["重口味", "川菜", "湘菜", "串燒"],
  "清爽健康": ["輕食", "沙拉", "健康餐", "蔬食"],

  // 價位類
  "物超所值": ["平價", "小吃", "便當", "麵店"],
  "奢華享受": ["高級", "精緻", "牛排", "日式料理"],

  // ... 更多映射
};
```

### 7.2 Buddies 群組演算法模組

**7.2.1 群體共識計算**

```javascript
// server/logic/buddiesRecommendLogic.js

function calculateGroupScore(restaurant, allMemberAnswers, votes, hostId) {
  let score = 0;

  // ═══════════════════════════════════════════════════════
  // 步驟 1：計算群體基本匹配
  // ═══════════════════════════════════════════════════════
  const basicAgreementCount = calculateBasicAgreement(
    restaurant,
    allMemberAnswers,
    hostId
  );

  score += basicAgreementCount * WEIGHT.BASIC_MATCH;

  // ═══════════════════════════════════════════════════════
  // 步驟 2：趣味問題群體偏好
  // ═══════════════════════════════════════════════════════
  const funPreferenceScore = calculateFunPreference(
    restaurant,
    allMemberAnswers
  );

  score += funPreferenceScore * WEIGHT.FUN_MATCH;

  // ═══════════════════════════════════════════════════════
  // 步驟 3：群體共識加成
  // ═══════════════════════════════════════════════════════
  const consensusBonus = calculateConsensusBonus(
    restaurant.id,
    votes,
    allMemberAnswers.length
  );

  score += consensusBonus * WEIGHT.GROUP_CONSENSUS;

  // ═══════════════════════════════════════════════════════
  // 步驟 4：其他權重（同 SwiftTaste）
  // ═══════════════════════════════════════════════════════
  score += calculateRatingScore(restaurant);
  score += calculatePopularityScore(restaurant);
  score += calculateDistanceScore(restaurant, averageLocation);

  return {
    ...restaurant,
    score: Math.round(score * 100) / 100,
    consensusBonus,
    basicAgreementCount
  };
}

// 計算基本問題群體共識
function calculateBasicAgreement(restaurant, allMemberAnswers, hostId) {
  let agreementCount = 0;

  allMemberAnswers.forEach(({ memberId, basicAnswers }) => {
    const weight = (memberId === hostId) ? 2 : 1; // 房主 2 倍權重

    basicAnswers.forEach(answer => {
      if (matchesBasicCriteria(restaurant, answer)) {
        agreementCount += weight;
      }
    });
  });

  return agreementCount;
}

// 計算共識加成
function calculateConsensusBonus(restaurantId, votes, totalMembers) {
  const restaurantVotes = votes.filter(v => v.restaurantId === restaurantId);

  let yesVotes = 0;
  let noVotes = 0;

  restaurantVotes.forEach(vote => {
    if (vote.vote === 'yes') {
      yesVotes += vote.weight;
    } else if (vote.vote === 'no') {
      noVotes += vote.weight;
    }
  });

  // 共識度 = (贊成票數 - 反對票數) / 總成員數
  const consensusRatio = (yesVotes - noVotes) / totalMembers;

  // 共識加成 = 共識度 × 最大加成
  return consensusRatio * WEIGHT.GROUP_CONSENSUS;
}
```

**7.2.2 投票統計演算法**

```javascript
function calculateVoteStatistics(votes, members) {
  const stats = new Map(); // restaurantId => { yes, no, abstain, totalWeight }

  votes.forEach(vote => {
    const { restaurantId, vote: voteType, weight } = vote;

    if (!stats.has(restaurantId)) {
      stats.set(restaurantId, {
        yes: 0,
        no: 0,
        abstain: 0,
        totalWeight: 0
      });
    }

    const stat = stats.get(restaurantId);
    stat[voteType] += weight;
    stat.totalWeight += weight;
  });

  // 計算每家餐廳的共識度
  const results = Array.from(stats.entries()).map(([restaurantId, stat]) => {
    const totalPossibleWeight = members.reduce((sum, m) =>
      sum + (m.isHost ? 2 : 1), 0
    );

    return {
      restaurantId,
      yesCount: stat.yes,
      noCount: stat.no,
      abstainCount: stat.abstain,
      consensusRate: (stat.yes - stat.no) / totalPossibleWeight,
      participationRate: stat.totalWeight / totalPossibleWeight
    };
  });

  return results.sort((a, b) => b.consensusRate - a.consensusRate);
}
```

---

## 8. 資料流向

### 8.1 SwiftTaste 模式資料流

```
使用者互動（User Interaction）
          │
          ↓
┌──────────────────────────────────┐
│   React Component                │
│   (SwiftTaste.jsx)              │
│   - 問題顯示                      │
│   - 答案收集                      │
│   - UI 更新                       │
└──────────────────────────────────┘
          │
          │ handleSubmit(answers)
          ↓
┌──────────────────────────────────┐
│   服務層（Service Layer）         │
│   questionService.js             │
│   - 驗證答案格式                  │
│   - 呼叫推薦邏輯                  │
└──────────────────────────────────┘
          │
          │ answers + userLocation
          ↓
┌──────────────────────────────────┐
│   業務邏輯層（Logic Layer）       │
│   enhancedRecommendLogicFrontend.js│
│   - 計算評分                      │
│   - 篩選排序                      │
│   - 返回 Top 10                   │
└──────────────────────────────────┘
          │
          │ recommendations[]
          ↓
┌──────────────────────────────────┐
│   React Component                │
│   (RecommendationResult.jsx)    │
│   - 顯示推薦結果                  │
│   - 卡片輪播                      │
│   - 儲存歷史記錄                  │
└──────────────────────────────────┘
          │
          │ saveHistory()
          ↓
┌──────────────────────────────────┐
│   Supabase Database              │
│   swifttaste_history 表           │
│   - 儲存推薦記錄                  │
└──────────────────────────────────┘
```

### 8.2 Buddies 模式資料流

```
房主創建房間（Host Creates Room）
          │
          ↓
┌──────────────────────────────────┐
│   React Component (BuddiesRoom)  │
│   - 生成房間碼（8碼）             │
│   - 顯示 QR Code                  │
└──────────────────────────────────┘
          │
          │ socket.emit('createRoom')
          ↓
┌──────────────────────────────────┐
│   Socket.IO Server               │
│   - 創建 Room 物件                │
│   - 加入房主為成員                │
│   - 廣播房間創建事件              │
└──────────────────────────────────┘
          │
          ↓
成員加入房間（Members Join）
          │
          │ socket.emit('joinRoom')
          ↓
┌──────────────────────────────────┐
│   Socket.IO Server               │
│   - 驗證房間存在                  │
│   - 添加成員到 Room               │
│   - 即時同步所有成員              │
└──────────────────────────────────┘
          │
          ↓
問答階段（Answering Phase）
          │
          │ socket.emit('submitAnswers')
          ↓
┌──────────────────────────────────┐
│   Socket.IO Server               │
│   - 儲存成員答案                  │
│   - 檢查是否所有人已回答          │
│   - 觸發推薦計算                  │
└──────────────────────────────────┘
          │
          │ answers from all members
          ↓
┌──────────────────────────────────┐
│   Business Logic                 │
│   buddiesRecommendLogic.js       │
│   - 群體共識計算                  │
│   - 加權評分                      │
│   - 返回候選清單                  │
└──────────────────────────────────┘
          │
          │ candidates[]
          ↓
投票階段（Voting Phase）
          │
          │ socket.emit('submitVote')
          ↓
┌──────────────────────────────────┐
│   Socket.IO Server               │
│   - 記錄投票（含權重）            │
│   - 即時同步所有成員              │
│   - 計算投票統計                  │
└──────────────────────────────────┘
          │
          │ socket.on('voteUpdated')
          ↓
┌──────────────────────────────────┐
│   React Component                │
│   - 即時更新投票UI                │
│   - 顯示共識進度條                │
│   - 標示房主投票（2票）           │
└──────────────────────────────────┘
          │
          ↓
結果階段（Result Phase）
          │
          │ finalizeResults()
          ↓
┌──────────────────────────────────┐
│   Socket.IO Server               │
│   - 結合投票與評分                │
│   - 產生最終推薦                  │
│   - 廣播結果給所有成員            │
└──────────────────────────────────┘
```

### 8.3 地圖探索資料流

```
使用者開啟地圖（User Opens Map）
          │
          ↓
┌──────────────────────────────────┐
│   React Component (MapView)      │
│   - 初始化 Google Maps            │
│   - 獲取用戶位置                  │
└──────────────────────────────────┘
          │
          │ loadFavoriteLists()
          ↓
┌──────────────────────────────────┐
│   Service Layer                  │
│   userDataService.getFavoriteLists()│
│   - 查詢用戶所有清單              │
│   - 包含清單內的餐廳              │
└──────────────────────────────────┘
          │
          │ Supabase REST API
          ↓
┌──────────────────────────────────┐
│   Supabase Database              │
│   - user_favorite_lists          │
│   - favorite_list_places         │
│   - restaurants                  │
│   - restaurant_images            │
└──────────────────────────────────┘
          │
          │ lists[] with places[]
          ↓
┌──────────────────────────────────┐
│   React Component (MapView)      │
│   - 渲染地圖標記                  │
│   - 按清單顏色分類                │
│   - 綁定 InfoWindow              │
└──────────────────────────────────┘
          │
          ↓
使用者點擊標記（User Clicks Marker）
          │
          │ marker.onClick()
          ↓
┌──────────────────────────────────┐
│   React Component                │
│   - 打開 InfoWindow               │
│   - 顯示餐廳基本資訊              │
│   - 提供"查看詳細"按鈕            │
└──────────────────────────────────┘
          │
          │ openDetailModal()
          ↓
┌──────────────────────────────────┐
│   React Component                │
│   (RestaurantDetailModal)        │
│   - 載入詳細資訊                  │
│   - 顯示評論列表                  │
│   - 提供收藏/評論操作            │
└──────────────────────────────────┘
          │
          │ 使用者新增評論
          ↓
┌──────────────────────────────────┐
│   Service Layer                  │
│   restaurantReviewService.addReview()│
│   - 驗證使用者未重複評論          │
│   - 插入評論到資料庫              │
│   - 觸發評分更新                  │
└──────────────────────────────────┘
          │
          │ Supabase REST API + Trigger
          ↓
┌──────────────────────────────────┐
│   Supabase Database              │
│   - INSERT restaurant_reviews    │
│   - TRIGGER 更新餐廳評分          │
│   - 重新計算 combinedRating       │
└──────────────────────────────────┘
```

---

## 9. 安全性設計

### 9.1 認證與授權

**9.1.1 JWT Token 機制**

```
使用者登入流程：
┌────────┐      1. POST /auth/login      ┌──────────────┐
│ Client │ ─────────────────────────────→│  Supabase    │
│        │      email + password         │  Auth Server │
│        │                                │              │
│        │←─────────────────────────────┤              │
│        │      2. Return JWT Token      └──────────────┘
│        │         + Refresh Token
│        │
│        │      3. Store in Memory/LocalStorage
│        │
│        │      4. API Request with Token
│        │      Authorization: Bearer {JWT}
│        │ ────────────────────────────→┌──────────────┐
│        │                               │  Supabase    │
│        │                               │  REST API    │
│        │                               │              │
│        │      5. Verify Token          │  ┌─────────┐ │
│        │ ←────────────────────────────│  │ Verify  │ │
│        │      6. Return Protected Data │  │ JWT     │ │
└────────┘                               │  └─────────┘ │
                                         └──────────────┘

Token 內容（解碼後）：
{
  "aud": "authenticated",
  "exp": 1698765432,
  "sub": "user_uuid",
  "email": "user@example.com",
  "app_metadata": {},
  "user_metadata": {
    "name": "User Name",
    "avatar_url": "..."
  },
  "role": "authenticated"
}
```

**9.1.2 Row Level Security (RLS) 實作**

```sql
-- 政策 1：用戶只能查看自己的收藏清單
CREATE POLICY "Users can view own lists"
  ON user_favorite_lists
  FOR SELECT
  USING (auth.uid() = user_id);

-- 政策 2：用戶只能創建屬於自己的清單
CREATE POLICY "Users can create own lists"
  ON user_favorite_lists
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 政策 3：用戶只能修改自己的清單
CREATE POLICY "Users can update own lists"
  ON user_favorite_lists
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 政策 4：用戶只能刪除自己的清單
CREATE POLICY "Users can delete own lists"
  ON user_favorite_lists
  FOR DELETE
  USING (auth.uid() = user_id);

-- 政策 5：所有人可以查看餐廳資料
CREATE POLICY "Anyone can view restaurants"
  ON restaurants
  FOR SELECT
  TO public
  USING (true);

-- 政策 6：只有已登入用戶可以新增評論
CREATE POLICY "Authenticated users can add reviews"
  ON restaurant_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    NOT EXISTS (
      SELECT 1 FROM restaurant_reviews
      WHERE user_id = auth.uid()
        AND restaurant_id = NEW.restaurant_id
    )
  );

-- 政策 7：用戶只能刪除自己的評論
CREATE POLICY "Users can delete own reviews"
  ON restaurant_reviews
  FOR DELETE
  USING (auth.uid() = user_id);
```

### 9.2 資料驗證

**9.2.1 前端驗證**

```javascript
// 輸入驗證工具函數
const validators = {
  // 電子郵件驗證
  email: (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(email)) {
      return '請輸入有效的電子郵件地址';
    }
    return null;
  },

  // 密碼強度驗證
  password: (password) => {
    if (password.length < 8) {
      return '密碼長度至少需要 8 個字元';
    }
    if (!/[A-Z]/.test(password)) {
      return '密碼必須包含至少一個大寫字母';
    }
    if (!/[a-z]/.test(password)) {
      return '密碼必須包含至少一個小寫字母';
    }
    if (!/[0-9]/.test(password)) {
      return '密碼必須包含至少一個數字';
    }
    return null;
  },

  // 評論長度驗證
  comment: (comment) => {
    if (comment.length > 200) {
      return '評論長度不能超過 200 字';
    }
    if (comment.trim().length === 0) {
      return '評論不能為空';
    }
    return null;
  },

  // 清單名稱驗證
  listName: (name) => {
    if (name.trim().length === 0) {
      return '清單名稱不能為空';
    }
    if (name.length > 50) {
      return '清單名稱不能超過 50 字';
    }
    if (name === '我的最愛') {
      return '不能使用保留名稱';
    }
    return null;
  }
};

// 使用範例
function handleSubmit(formData) {
  const errors = {};

  const emailError = validators.email(formData.email);
  if (emailError) errors.email = emailError;

  const passwordError = validators.password(formData.password);
  if (passwordError) errors.password = passwordError;

  if (Object.keys(errors).length > 0) {
    setFormErrors(errors);
    return;
  }

  // 驗證通過，提交資料
  submitForm(formData);
}
```

**9.2.2 後端驗證（Supabase 函數）**

```sql
-- 資料庫層面的驗證函數
CREATE OR REPLACE FUNCTION validate_restaurant_review()
RETURNS TRIGGER AS $$
BEGIN
  -- 驗證評分範圍
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  -- 驗證評論長度
  IF LENGTH(NEW.comment) > 200 THEN
    RAISE EXCEPTION 'Comment cannot exceed 200 characters';
  END IF;

  -- 驗證用戶未重複評論
  IF EXISTS (
    SELECT 1 FROM restaurant_reviews
    WHERE user_id = NEW.user_id
      AND restaurant_id = NEW.restaurant_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'User has already reviewed this restaurant';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_review_validity
  BEFORE INSERT OR UPDATE ON restaurant_reviews
  FOR EACH ROW EXECUTE FUNCTION validate_restaurant_review();
```

### 9.3 XSS 與 CSRF 防護

**9.3.1 XSS 防護**

```javascript
// 使用 DOMPurify 淨化使用者輸入
import DOMPurify from 'dompurify';

function sanitizeInput(userInput) {
  return DOMPurify.sanitize(userInput, {
    ALLOWED_TAGS: [], // 不允許任何 HTML 標籤
    ALLOWED_ATTR: []  // 不允許任何屬性
  });
}

// React 組件中使用
function ReviewComment({ comment }) {
  const sanitizedComment = sanitizeInput(comment);

  return (
    <div className="review-comment">
      {sanitizedComment}
    </div>
  );
}

// 對於需要顯示富文本的情況
function RichTextDisplay({ htmlContent }) {
  const cleanHTML = DOMPurify.sanitize(htmlContent, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em'],
    ALLOWED_ATTR: []
  });

  return (
    <div
      dangerouslySetInnerHTML={{ __html: cleanHTML }}
    />
  );
}
```

**9.3.2 CSRF 防護**

```javascript
// Supabase 自動處理 CSRF Token
// 透過 JWT + Same-Site Cookie 策略

// 前端配置
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// 所有請求自動包含 CSRF Token
const { data, error } = await supabase
  .from('restaurants')
  .select('*');
// Supabase 自動添加 X-Supabase-CSRF-Token header
```

### 9.4 Rate Limiting

```javascript
// 使用 Supabase Edge Functions 實作 Rate Limiting

// supabase/functions/rate-limit/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RATE_LIMIT_WINDOW = 60000; // 1 分鐘
const MAX_REQUESTS = 100; // 每分鐘最多 100 次請求

serve(async (req) => {
  const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 檢查 IP 是否超過請求限制
  const { data: requests, error } = await supabase
    .from('api_rate_limits')
    .select('request_count, last_reset')
    .eq('ip_address', clientIP)
    .single();

  if (error && error.code !== 'PGRST116') {
    return new Response('Internal Server Error', { status: 500 });
  }

  const now = Date.now();
  let requestCount = 1;
  let lastReset = now;

  if (requests) {
    if (now - requests.last_reset > RATE_LIMIT_WINDOW) {
      // 重置計數器
      requestCount = 1;
      lastReset = now;
    } else {
      requestCount = requests.request_count + 1;
      lastReset = requests.last_reset;

      if (requestCount > MAX_REQUESTS) {
        return new Response('Too Many Requests', {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((lastReset + RATE_LIMIT_WINDOW - now) / 1000))
          }
        });
      }
    }
  }

  // 更新請求計數
  await supabase
    .from('api_rate_limits')
    .upsert({
      ip_address: clientIP,
      request_count: requestCount,
      last_reset: lastReset
    });

  return new Response('OK', { status: 200 });
});
```

---

## 10. 效能優化

### 10.1 前端效能優化

**10.1.1 React 效能優化**

```javascript
// 1. React.memo：避免不必要的重新渲染
const RestaurantCard = React.memo(({ restaurant, onClick }) => {
  return (
    <div className="restaurant-card" onClick={() => onClick(restaurant.id)}>
      <img src={restaurant.image} alt={restaurant.name} />
      <h3>{restaurant.name}</h3>
      <p>{restaurant.rating} ★</p>
    </div>
  );
}, (prevProps, nextProps) => {
  // 自訂比較函數：只有 restaurant.id 改變時才重新渲染
  return prevProps.restaurant.id === nextProps.restaurant.id;
});

// 2. useMemo：快取昂貴的計算結果
function RestaurantList({ restaurants, filters }) {
  const filteredRestaurants = useMemo(() => {
    console.log('Filtering restaurants...');
    return restaurants
      .filter(r => r.price_range <= filters.maxPrice)
      .sort((a, b) => b.rating - a.rating);
  }, [restaurants, filters]); // 只有依賴變更時才重新計算

  return (
    <div>
      {filteredRestaurants.map(r => (
        <RestaurantCard key={r.id} restaurant={r} />
      ))}
    </div>
  );
}

// 3. useCallback：快取回調函數
function ParentComponent() {
  const [count, setCount] = useState(0);

  // 不使用 useCallback：每次渲染都會創建新函數
  const handleClickBad = () => {
    console.log('Clicked');
  };

  // 使用 useCallback：函數只創建一次
  const handleClickGood = useCallback(() => {
    console.log('Clicked');
  }, []); // 空依賴陣列表示函數永不改變

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
      <ChildComponent onClick={handleClickGood} />
    </div>
  );
}

// 4. 虛擬列表：處理大量資料
import { FixedSizeList as List } from 'react-window';

function VirtualizedRestaurantList({ restaurants }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      <RestaurantCard restaurant={restaurants[index]} />
    </div>
  );

  return (
    <List
      height={600}
      itemCount={restaurants.length}
      itemSize={150}
      width="100%"
    >
      {Row}
    </List>
  );
}
```

**10.1.2 程式碼分割（Code Splitting）**

```javascript
// 使用 React.lazy 和 Suspense 進行路由級別的程式碼分割

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoadingOverlay from './components/LoadingOverlay';

// 懶載入頁面組件
const SwiftTastePage = lazy(() => import('./pages/SwiftTastePage'));
const BuddiesPage = lazy(() => import('./pages/BuddiesPage'));
const MapPage = lazy(() => import('./pages/MapPage'));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingOverlay show={true} message="載入中..." />}>
        <Routes>
          <Route path="/" element={<SwiftTastePage />} />
          <Route path="/buddies" element={<BuddiesPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/profile" element={<UserProfilePage />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

// Vite 配置優化
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-socket': ['socket.io-client'],
          'vendor-maps': ['@googlemaps/js-api-loader']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
};
```

**10.1.3 圖片優化**

```javascript
// 1. 延遲載入圖片
function LazyImage({ src, alt, placeholder }) {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [imageRef, setImageRef] = useState();

  useEffect(() => {
    let observer;

    if (imageRef && imageSrc === placeholder) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setImageSrc(src);
            observer.unobserve(imageRef);
          }
        });
      });
      observer.observe(imageRef);
    }

    return () => {
      if (observer && imageRef) {
        observer.unobserve(imageRef);
      }
    };
  }, [imageRef, imageSrc, src, placeholder]);

  return (
    <img
      ref={setImageRef}
      src={imageSrc}
      alt={alt}
      className="lazy-image"
    />
  );
}

// 2. 響應式圖片（使用 srcset）
function ResponsiveImage({ imageUrl, alt }) {
  const generateSrcSet = (url) => {
    // 假設圖片服務支援動態調整大小
    return `
      ${url}?w=320 320w,
      ${url}?w=640 640w,
      ${url}?w=1024 1024w
    `;
  };

  return (
    <img
      src={`${imageUrl}?w=640`}
      srcSet={generateSrcSet(imageUrl)}
      sizes="(max-width: 320px) 320px, (max-width: 640px) 640px, 1024px"
      alt={alt}
      loading="lazy"
    />
  );
}

// 3. WebP 格式支援
function OptimizedImage({ src, alt }) {
  const webpSrc = src.replace(/\.(jpg|jpeg|png)$/, '.webp');

  return (
    <picture>
      <source srcSet={webpSrc} type="image/webp" />
      <source srcSet={src} type="image/jpeg" />
      <img src={src} alt={alt} loading="lazy" />
    </picture>
  );
}
```

### 10.2 資料庫效能優化

**10.2.1 查詢優化**

```sql
-- 1. 使用物化視圖（Materialized View）加速複雜查詢

CREATE MATERIALIZED VIEW restaurant_summary AS
SELECT
  r.id,
  r.name,
  r.address,
  r.latitude,
  r.longitude,
  r.price_range,
  r.tags,
  -- 預先計算 Google 評分
  r.rating AS google_rating,
  r.user_ratings_total AS google_rating_count,
  -- 預先計算 TasteBuddies 評分
  COALESCE(AVG(rr.rating), 0) AS tastebuddies_rating,
  COUNT(rr.id) AS tastebuddies_rating_count,
  -- 預先計算綜合評分
  CASE
    WHEN r.user_ratings_total > 0 AND COUNT(rr.id) > 0 THEN
      (r.rating * r.user_ratings_total + COALESCE(AVG(rr.rating), 0) * COUNT(rr.id))
      / (r.user_ratings_total + COUNT(rr.id))
    WHEN COUNT(rr.id) > 0 THEN
      COALESCE(AVG(rr.rating), 0)
    WHEN r.user_ratings_total > 0 THEN
      r.rating
    ELSE
      0
  END AS combined_rating,
  -- 預先計算最新評論時間
  MAX(rr.created_at) AS latest_review_at
FROM restaurants r
LEFT JOIN restaurant_reviews rr ON r.id = rr.restaurant_id
GROUP BY r.id, r.name, r.address, r.latitude, r.longitude, r.price_range, r.tags, r.rating, r.user_ratings_total;

-- 建立索引
CREATE INDEX idx_restaurant_summary_combined_rating
  ON restaurant_summary (combined_rating DESC);

-- 定期刷新物化視圖（每小時一次）
CREATE OR REPLACE FUNCTION refresh_restaurant_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY restaurant_summary;
END;
$$ LANGUAGE plpgsql;

-- 使用 pg_cron 排程刷新
SELECT cron.schedule('refresh-restaurant-summary', '0 * * * *', 'SELECT refresh_restaurant_summary()');

-- 2. 使用索引加速地理位置查詢

-- 安裝 PostGIS 擴展
CREATE EXTENSION IF NOT EXISTS postgis;

-- 添加地理位置欄位
ALTER TABLE restaurants
  ADD COLUMN geom geometry(Point, 4326);

-- 從現有座標生成幾何資料
UPDATE restaurants
SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE longitude IS NOT NULL AND latitude IS NOT NULL;

-- 建立 GiST 索引
CREATE INDEX idx_restaurants_geom
  ON restaurants USING GIST (geom);

-- 使用空間查詢查找附近餐廳
-- 查找距離使用者位置 5 公里內的餐廳
SELECT
  id,
  name,
  ST_Distance(
    geom,
    ST_SetSRID(ST_MakePoint(121.5654, 25.0330), 4326)::geography
  ) / 1000 AS distance_km
FROM restaurants
WHERE ST_DWithin(
  geom,
  ST_SetSRID(ST_MakePoint(121.5654, 25.0330), 4326)::geography,
  5000 -- 5000 公尺
)
ORDER BY distance_km ASC
LIMIT 20;
```

**10.2.2 連線池配置**

```javascript
// Supabase 客戶端配置
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public'
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: { 'x-application-name': 'SwiftTaste' }
  },
  // 配置連線池（Supabase 自動管理）
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// 伺服器端連線池配置（使用 pg 驅動）
import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: 5432,
  max: 20, // 最大連線數
  idleTimeoutMillis: 30000, // 閒置超時
  connectionTimeoutMillis: 2000, // 連線超時
});

// 使用連線池執行查詢
async function getRestaurants(filters) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM restaurant_summary WHERE price_range = $1',
      [filters.price_range]
    );
    return result.rows;
  } finally {
    client.release(); // 釋放連線回連線池
  }
}
```

### 10.3 快取策略

**10.3.1 前端快取**

```javascript
// 1. LocalStorage 快取靜態資料
class LocalStorageCache {
  constructor(namespace, ttl = 3600000) { // 預設 1 小時
    this.namespace = namespace;
    this.ttl = ttl;
  }

  set(key, value) {
    const item = {
      value,
      timestamp: Date.now(),
      ttl: this.ttl
    };
    localStorage.setItem(`${this.namespace}:${key}`, JSON.stringify(item));
  }

  get(key) {
    const itemStr = localStorage.getItem(`${this.namespace}:${key}`);
    if (!itemStr) return null;

    try {
      const item = JSON.parse(itemStr);
      const now = Date.now();

      if (now - item.timestamp > item.ttl) {
        // 過期，刪除並返回 null
        this.delete(key);
        return null;
      }

      return item.value;
    } catch (error) {
      console.error('Cache parse error:', error);
      return null;
    }
  }

  delete(key) {
    localStorage.removeItem(`${this.namespace}:${key}`);
  }

  clear() {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(`${this.namespace}:`)) {
        localStorage.removeItem(key);
      }
    });
  }
}

// 使用範例
const restaurantCache = new LocalStorageCache('restaurants', 1800000); // 30 分鐘

async function fetchRestaurants(filters) {
  const cacheKey = JSON.stringify(filters);

  // 1. 檢查快取
  const cached = restaurantCache.get(cacheKey);
  if (cached) {
    console.log('Cache hit!');
    return cached;
  }

  // 2. 快取未命中，查詢 API
  console.log('Cache miss, fetching from API...');
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('price_range', filters.price_range);

  if (error) throw error;

  // 3. 存入快取
  restaurantCache.set(cacheKey, data);

  return data;
}

// 2. React Query 快取（推薦方案）
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function useRestaurants(filters) {
  return useQuery({
    queryKey: ['restaurants', filters],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('price_range', filters.price_range);

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 分鐘內視為新鮮
    cacheTime: 30 * 60 * 1000, // 30 分鐘後清除快取
  });
}

function RestaurantList({ filters }) {
  const { data: restaurants, isLoading, error } = useRestaurants(filters);

  if (isLoading) return <Loading />;
  if (error) return <Error message={error.message} />;

  return (
    <div>
      {restaurants.map(r => <RestaurantCard key={r.id} {...r} />)}
    </div>
  );
}
```

**10.3.2 伺服器端快取（Redis）**

```javascript
// 使用 Redis 快取頻繁查詢的資料
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
  password: process.env.REDIS_PASSWORD,
  db: 0
});

class RedisCache {
  async get(key) {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key, value, ttlSeconds = 3600) {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  }

  async delete(key) {
    await redis.del(key);
  }

  async deletePattern(pattern) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

const cache = new RedisCache();

// 快取推薦結果
async function generateRecommendations(userId, answers) {
  const cacheKey = `recommendations:${userId}:${hashAnswers(answers)}`;

  // 1. 檢查快取
  const cached = await cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // 2. 生成推薦
  const recommendations = await runRecommendationLogic(answers);

  // 3. 存入快取（15 分鐘）
  await cache.set(cacheKey, recommendations, 900);

  return recommendations;
}

// 當餐廳資料更新時，清除相關快取
async function onRestaurantUpdate(restaurantId) {
  // 清除所有包含該餐廳的推薦快取
  await cache.deletePattern(`recommendations:*`);
}
```

---

## 11. 部署架構

### 11.1 生產環境架構

```
                                 Internet
                                     │
                                     ↓
                        ┌────────────────────────┐
                        │   Vercel CDN (Global)  │
                        │  - Static Assets       │
                        │  - Frontend Build      │
                        │  - Edge Functions      │
                        └────────────────────────┘
                                     │
                 ┌───────────────────┼───────────────────┐
                 │                   │                   │
                 ↓                   ↓                   ↓
      ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
      │   React App      │ │  Socket.IO Server│ │  Supabase Cloud  │
      │   (SPA)          │ │  (Render/Railway)│ │  (PostgreSQL)    │
      │                  │ │                  │ │                  │
      │  - Vite Build    │ │  - Express.js    │ │  - Database      │
      │  - React 19      │ │  - Socket.IO     │ │  - Auth          │
      │  - React Router  │ │  - Room Mgmt     │ │  - Storage       │
      │  - Service Worker│ │  - Vote Sync     │ │  - Realtime      │
      └──────────────────┘ └──────────────────┘ └──────────────────┘
               │                     │                   │
               │                     │                   │
               └─────────────────────┼───────────────────┘
                                     │
                                     ↓
                        ┌────────────────────────┐
                        │  External Services     │
                        │                        │
                        │  - Google Maps API     │
                        │  - Google Places API   │
                        │  - Sentry (Monitoring) │
                        └────────────────────────┘
```

### 11.2 部署流程

**11.2.1 前端部署（Vercel）**

```yaml
# vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ],
  "env": {
    "VITE_SUPABASE_URL": "@supabase-url",
    "VITE_SUPABASE_ANON_KEY": "@supabase-anon-key"
  }
}

# GitHub Actions 自動部署
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

**11.2.2 Socket.IO 伺服器部署（Render/Railway）**

```yaml
# render.yaml
services:
  - type: web
    name: swifttaste-socket-server
    env: node
    buildCommand: npm install
    startCommand: node server/index.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3001
      - key: FRONTEND_URL
        value: https://swifttaste.vercel.app
    healthCheckPath: /health
    autoDeploy: true
```

```dockerfile
# Dockerfile (替代方案)
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY server/ ./server/

EXPOSE 3001

CMD ["node", "server/index.js"]
```

**11.2.3 環境變數管理**

```bash
# .env.production
VITE_SUPABASE_URL=https://[project-id].supabase.co
VITE_SUPABASE_ANON_KEY=[anon-key]
VITE_GOOGLE_MAPS_API_KEY=[api-key]
VITE_SOCKET_SERVER_URL=https://swifttaste-socket.onrender.com

# 使用 Vercel CLI 設定環境變數
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production

# 使用 Render CLI 設定環境變數
render env set NODE_ENV production
render env set FRONTEND_URL https://swifttaste.vercel.app
```

### 11.3 監控與日誌

**11.3.1 Sentry 錯誤追蹤**

```javascript
// src/main.jsx
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [new BrowserTracing()],
    tracesSampleRate: 1.0,
    environment: 'production',
    beforeSend(event, hint) {
      // 過濾敏感資訊
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
      }
      return event;
    }
  });
}

// 錯誤邊界
function App() {
  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <BrowserRouter>
        <Routes>
          {/* ... */}
        </Routes>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  );
}
```

**11.3.2 效能監控**

```javascript
// Web Vitals 監控
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics({ name, value, id }) {
  // 發送到分析服務
  const body = JSON.stringify({ name, value, id });

  if (navigator.sendBeacon) {
    navigator.sendBeacon('/analytics', body);
  } else {
    fetch('/analytics', { body, method: 'POST', keepalive: true });
  }
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

---

## 12. 系統擴展性

### 12.1 水平擴展

**12.1.1 前端擴展**
- **CDN 分發**：靜態資源通過 Vercel Edge Network 全球分發
- **負載均衡**：Vercel 自動處理流量分配
- **無狀態設計**：前端應用完全無狀態，可無限擴展

**12.1.2 Socket.IO 伺服器擴展**

```javascript
// 使用 Redis Adapter 實現多伺服器同步
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

io.adapter(createAdapter(pubClient, subClient));

// 多伺服器架構
/*
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Socket.IO    │    │ Socket.IO    │    │ Socket.IO    │
│ Server 1     │    │ Server 2     │    │ Server 3     │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                  ┌────────▼────────┐
                  │  Redis Cluster  │
                  │  (Pub/Sub)      │
                  └─────────────────┘
*/
```

**12.1.3 資料庫擴展**
- **讀寫分離**：主資料庫處理寫入，複本資料庫處理讀取
- **垂直分割**：按功能模組分割資料庫（使用者、餐廳、評論）
- **水平分割（Sharding）**：按地理區域或雜湊值分割資料

```sql
-- 地理區域分片範例
-- Shard 1: 台北地區餐廳
CREATE TABLE restaurants_taipei (
  CHECK (location = 'Taipei')
) INHERITS (restaurants);

-- Shard 2: 台中地區餐廳
CREATE TABLE restaurants_taichung (
  CHECK (location = 'Taichung')
) INHERITS (restaurants);

-- 建立規則自動路由查詢
CREATE RULE restaurants_insert_taipei AS
ON INSERT TO restaurants
WHERE (NEW.location = 'Taipei')
DO INSTEAD
INSERT INTO restaurants_taipei VALUES (NEW.*);
```

### 12.2 功能擴展

**12.2.1 外掛系統設計**

```javascript
// 定義外掛介面
class RecommendationPlugin {
  constructor(name, version) {
    this.name = name;
    this.version = version;
  }

  // 必須實作的方法
  calculateScore(restaurant, userPreferences) {
    throw new Error('Must implement calculateScore method');
  }

  // 可選的鉤子
  beforeRecommend(restaurants) {
    return restaurants;
  }

  afterRecommend(recommendations) {
    return recommendations;
  }
}

// 外掛管理器
class PluginManager {
  constructor() {
    this.plugins = [];
  }

  register(plugin) {
    if (!(plugin instanceof RecommendationPlugin)) {
      throw new Error('Plugin must extend RecommendationPlugin');
    }
    this.plugins.push(plugin);
    console.log(`Plugin registered: ${plugin.name} v${plugin.version}`);
  }

  executeHook(hookName, data) {
    return this.plugins.reduce((result, plugin) => {
      if (typeof plugin[hookName] === 'function') {
        return plugin[hookName](result);
      }
      return result;
    }, data);
  }

  calculateAggregateScore(restaurant, userPreferences) {
    return this.plugins.reduce((totalScore, plugin) => {
      return totalScore + plugin.calculateScore(restaurant, userPreferences);
    }, 0);
  }
}

// 範例外掛：社群推薦加分
class SocialRecommendationPlugin extends RecommendationPlugin {
  constructor() {
    super('SocialRecommendation', '1.0.0');
  }

  calculateScore(restaurant, userPreferences) {
    // 如果餐廳是朋友推薦的，加 5 分
    if (userPreferences.friendRecommendations?.includes(restaurant.id)) {
      return 5;
    }
    return 0;
  }
}

// 使用外掛系統
const pluginManager = new PluginManager();
pluginManager.register(new SocialRecommendationPlugin());
// 可以動態添加更多外掛...
```

**12.2.2 API 版本控制**

```javascript
// API 版本路由設計
// /api/v1/* - 版本 1（舊版，維護模式）
// /api/v2/* - 版本 2（當前版本）
// /api/v3/* - 版本 3（開發中）

// Supabase Edge Functions 版本控制
// supabase/functions/recommend-v1/index.ts
export default async (req) => {
  return new Response(
    JSON.stringify({ version: 'v1', deprecated: true }),
    { headers: { 'Content-Type': 'application/json' } }
  );
};

// supabase/functions/recommend-v2/index.ts
export default async (req) => {
  const { answers, location } = await req.json();
  const recommendations = await generateRecommendationsV2(answers, location);
  return new Response(
    JSON.stringify({ version: 'v2', data: recommendations }),
    { headers: { 'Content-Type': 'application/json' } }
  );
};

// 前端 API 適配層
class ApiClient {
  constructor(version = 'v2') {
    this.version = version;
    this.baseUrl = `${SUPABASE_URL}/functions/v1`;
  }

  async getRecommendations(answers, location) {
    const endpoint = `${this.baseUrl}/recommend-${this.version}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ answers, location }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });
    return response.json();
  }
}

// 使用時可以切換版本
const apiClient = new ApiClient('v2');
const recommendations = await apiClient.getRecommendations(answers, location);
```

---

## 13. 參考文獻

### 13.1 技術文檔

1. React Official Documentation. (2025). *React 19 Documentation*. Retrieved from https://react.dev/
2. Supabase Inc. (2025). *Supabase Documentation*. Retrieved from https://supabase.com/docs
3. Socket.IO Team. (2025). *Socket.IO Documentation*. Retrieved from https://socket.io/docs/v4/
4. Google Developers. (2025). *Google Maps JavaScript API*. Retrieved from https://developers.google.com/maps/documentation/javascript
5. Vite Team. (2025). *Vite Documentation*. Retrieved from https://vitejs.dev/

### 13.2 學術論文

1. Ricci, F., Rokach, L., & Shapira, B. (2015). *Recommender Systems Handbook* (2nd ed.). Springer.
2. Adomavicius, G., & Tuzhilin, A. (2005). Toward the next generation of recommender systems: A survey of the state-of-the-art and possible extensions. *IEEE Transactions on Knowledge and Data Engineering*, 17(6), 734-749.
3. Konstan, J. A., & Riedl, J. (2012). Recommender systems: from algorithms to user experience. *User Modeling and User-Adapted Interaction*, 22(1-2), 101-123.
4. McNee, S. M., Riedl, J., & Konstan, J. A. (2006). Being accurate is not enough: how accuracy metrics have hurt recommender systems. In *CHI'06 extended abstracts on Human factors in computing systems* (pp. 1097-1101).

### 13.3 技術標準

1. W3C. (2024). *Web Content Accessibility Guidelines (WCAG) 2.2*. Retrieved from https://www.w3.org/TR/WCAG22/
2. OWASP Foundation. (2024). *OWASP Top 10 - 2024*. Retrieved from https://owasp.org/www-project-top-ten/
3. PostgreSQL Global Development Group. (2024). *PostgreSQL 15 Documentation*. Retrieved from https://www.postgresql.org/docs/15/

---

**文件結束**

**版本歷史：**
- v1.0 (2025-10-27) - 初版發布

**維護者：**
SwiftTaste Development Team

**聯絡方式：**
- GitHub: https://github.com/elsonyeh/senior-project
- Email: [your-email@example.com]

---

**附錄：縮寫對照表**

| 縮寫 | 全名 | 中文 |
|-----|------|------|
| API | Application Programming Interface | 應用程式介面 |
| CDN | Content Delivery Network | 內容傳遞網路 |
| CORS | Cross-Origin Resource Sharing | 跨來源資源共享 |
| CRUD | Create, Read, Update, Delete | 增刪查改 |
| CSRF | Cross-Site Request Forgery | 跨站請求偽造 |
| ERD | Entity-Relationship Diagram | 實體關係圖 |
| HMR | Hot Module Replacement | 熱模組替換 |
| JWT | JSON Web Token | JSON 網頁令牌 |
| RLS | Row Level Security | 行級安全 |
| SPA | Single Page Application | 單頁應用 |
| SQL | Structured Query Language | 結構化查詢語言 |
| UI | User Interface | 使用者介面 |
| UUID | Universally Unique Identifier | 通用唯一識別碼 |
| XSS | Cross-Site Scripting | 跨站腳本攻擊 |
