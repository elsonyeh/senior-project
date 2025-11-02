# 完整數據追蹤實施指南

## 📋 目標

確保 **SwiftTaste** 和 **Buddies** 兩種模式都能完整記錄：
1. **會話時長** - 各階段的詳細耗時
2. **互動軌跡** - 查看、喜歡、跳過、投票等所有動作
3. **最終結果** - 最終選定的餐廳及相關數據
4. **Admin 頁面** - 所有數據都能在資料分析頁面查看

---

## 🗂️ 文件清單

### 資料庫遷移腳本
1. ✅ `database/migrations/add-swifttaste-interactions-table.sql` - SwiftTaste 互動表
2. ✅ `database/migrations/buddies-schema-simplification-phase1.sql` - Buddies 新架構

### 服務文件
3. ✅ `src/services/swiftTasteInteractionService.js` - SwiftTaste 互動服務
4. ✅ `src/services/buddiesInteractionService.js` - Buddies 互動服務

### 前端組件（需要更新）
5. ⏳ `src/components/SwiftTaste.jsx` - 需整合互動記錄
6. ⏳ `src/components/BuddiesRoom.jsx` - 需整合時間戳記錄
7. ⏳ `src/components/BuddiesRecommendation.jsx` - 需整合互動記錄
8. ⏳ `src/components/RestaurantSwiperMotion.jsx` - 需觸發互動事件
9. ⏳ `src/components/admin/DataAnalyticsPage.jsx` - 需顯示新數據

---

## 🚀 實施步驟

### 階段 1：執行資料庫遷移

#### 1.1 SwiftTaste 互動表

```bash
# 在 Supabase SQL Editor 執行
database/migrations/add-swifttaste-interactions-table.sql
```

**驗證：**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name = 'swifttaste_interactions';

SELECT column_name FROM information_schema.columns
WHERE table_name = 'user_selection_history'
AND column_name LIKE '%_started_at';
```

#### 1.2 Buddies 新架構

```bash
# 在 Supabase SQL Editor 執行
database/migrations/buddies-schema-simplification-phase1.sql
```

**驗證：**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name = 'buddies_interactions';

SELECT column_name FROM information_schema.columns
WHERE table_name = 'buddies_rooms'
AND column_name IN ('voting_started_at', 'completed_at', 'votes', 'final_restaurant_id');
```

---

### 階段 2：更新 SwiftTaste 組件

#### 2.1 在 SwiftTaste.jsx 中新增互動記錄

**檔案：** `src/components/SwiftTaste.jsx`

**步驟 1：導入服務**

```javascript
// 在文件頂部新增
import swiftTasteInteractionService from '../services/swiftTasteInteractionService';
```

**步驟 2：記錄時間戳**

```javascript
// 在 handleBasicQuestionsComplete 函數開始處
const handleBasicQuestionsComplete = async (answers) => {
  // ✨ 新增：記錄開始答題時間戳
  if (currentSessionId) {
    await swiftTasteInteractionService.updateSessionTimestamp(
      currentSessionId,
      'questions_started_at'
    );
  }

  // ... 現有邏輯 ...
};

// 在 handleFunQuestionsComplete 函數開始處
const handleFunQuestionsComplete = async (answers) => {
  // ✨ 新增：記錄開始趣味問題時間戳
  if (currentSessionId) {
    await swiftTasteInteractionService.updateSessionTimestamp(
      currentSessionId,
      'fun_questions_started_at'
    );
  }

  // ... 現有邏輯 ...
};

// 在 filterRestaurantsByAnswers 函數開始處（進入餐廳選擇階段時）
const filterRestaurantsByAnswers = async (basicAnswers, funAnswers) => {
  // ✨ 新增：記錄開始查看餐廳時間戳
  if (currentSessionId) {
    await swiftTasteInteractionService.updateSessionTimestamp(
      currentSessionId,
      'restaurants_started_at'
    );
  }

  // ... 現有邏輯 ...
};
```

**步驟 3：在 RestaurantSwiperMotion 中記錄互動**

找到 `<RestaurantSwiperMotion>` 組件的使用處（約在第 966 行）：

```javascript
{phase === "restaurants" && (
  <RestaurantSwiperMotion
    restaurants={filteredRestaurants}
    // ✨ 新增：記錄查看
    onView={async (restaurant) => {
      if (currentSessionId) {
        await swiftTasteInteractionService.recordView(
          currentSessionId,
          null, // userId 如果有登入用戶可以傳入
          restaurant.id
        );
      }
    }}
    // ✨ 修改：記錄喜歡（原有的 onSave）
    onSave={async (restaurant) => {
      if (currentSessionId) {
        await swiftTasteInteractionService.recordLike(
          currentSessionId,
          null,
          restaurant.id,
          restaurant
        );
      }
      await handleSave(restaurant);
    }}
    // ✨ 新增：記錄跳過
    onSkip={async (restaurant) => {
      if (currentSessionId) {
        await swiftTasteInteractionService.recordSkip(
          currentSessionId,
          null,
          restaurant.id
        );
      }
    }}
    onFinish={(...args) => {
      clearIdleTimer();
      handleRestaurantFinish(...args);
    }}
    onSwipe={(...args) => {
      resetIdleTimer();
      recordSwipeAction();
    }}
  />
)}
```

**步驟 4：記錄最終選擇**

在 `completeSession` 函數中（約在第 341 行）：

```javascript
const completeSession = async (finalRestaurant = null) => {
  if (currentSessionId) {
    // ✨ 新增：記錄最終選擇
    if (finalRestaurant) {
      await swiftTasteInteractionService.recordFinalChoice(
        currentSessionId,
        null,
        finalRestaurant.id,
        finalRestaurant
      );
    }

    // 原有邏輯
    const completionData = {
      started_at: sessionStartTime?.toISOString(),
      final_restaurant: finalRestaurant
    };

    await selectionHistoryService.completeSession(currentSessionId, completionData);
    console.log('Selection session completed');
  }
};
```

#### 2.2 更新 RestaurantSwiperMotion.jsx

**檔案：** `src/components/RestaurantSwiperMotion.jsx`

**步驟：新增 onView 和 onSkip 回調**

```javascript
export default function RestaurantSwiperMotion({
  restaurants,
  onView,      // ✨ 新增
  onSave,
  onSkip,      // ✨ 新增
  onFinish,
  onSwipe
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // ✨ 新增：當餐廳卡片顯示時，觸發 onView
  useEffect(() => {
    if (currentIndex < restaurants.length) {
      const currentRestaurant = restaurants[currentIndex];
      onView?.(currentRestaurant);
    }
  }, [currentIndex, restaurants, onView]);

  // 左滑 - 跳過
  const handleSwipeLeft = (restaurant) => {
    onSkip?.(restaurant);  // ✨ 新增
    onSwipe?.();
    setCurrentIndex(prev => prev + 1);
  };

  // 右滑 - 喜歡
  const handleSwipeRight = (restaurant) => {
    onSave?.(restaurant);
    onSwipe?.();
    setCurrentIndex(prev => prev + 1);
  };

  // ... 其他邏輯保持不變 ...
}
```

---

### 階段 3：更新 Buddies 組件

#### 3.1 在 BuddiesRoom.jsx 中記錄時間戳

**檔案：** `src/components/BuddiesRoom.jsx`

**步驟 1：導入服務**

```javascript
// 在文件頂部新增
import buddiesInteractionService from '../services/buddiesInteractionService';
```

**步驟 2：記錄時間戳**

```javascript
// 在 handleStartQuestions 函數中（需要新增此函數）
const handleStartQuestions = async () => {
  if (!isHost) return;

  // 更新房間狀態為 'questions'
  await roomService.updateRoomStatus(roomId, 'questions');

  // ✨ 記錄答題開始時間
  await buddiesInteractionService.updateRoomTimestamp(
    roomId,
    'questions_started_at'
  );
};

// 當房間狀態變為 'recommend' 時（在 useEffect 中監聽）
useEffect(() => {
  if (phase === 'recommend' && roomId) {
    // ✨ 記錄投票開始時間
    buddiesInteractionService.updateRoomTimestamp(
      roomId,
      'voting_started_at'
    );
  }
}, [phase, roomId]);
```

#### 3.2 在 BuddiesRecommendation.jsx 中記錄互動

**檔案：** `src/components/BuddiesRecommendation.jsx`

**步驟 1：導入服務**

```javascript
// 在文件頂部新增
import buddiesInteractionService from '../services/buddiesInteractionService';
```

**步驟 2：記錄互動**

```javascript
// 在 RestaurantSwiperMotion 使用處添加回調
<RestaurantSwiperMotion
  restaurants={limitedRestaurants}
  // ✨ 新增：記錄查看
  onView={async (restaurant) => {
    await buddiesInteractionService.recordView(
      roomId,
      userId,
      restaurant.id
    );
  }}
  // ✨ 修改：記錄喜歡
  onSave={async (restaurant) => {
    await buddiesInteractionService.recordLike(
      roomId,
      userId,
      restaurant.id,
      restaurant
    );
    // ... 原有的保存邏輯 ...
  }}
  // ✨ 新增：記錄跳過
  onSkip={async (restaurant) => {
    await buddiesInteractionService.recordSkip(
      roomId,
      userId,
      restaurant.id
    );
  }}
  // ... 其他 props ...
/>

// 在投票處理函數中
const handleVote = async (restaurant) => {
  // 原有的投票邏輯
  await voteService.vote(roomId, userId, restaurant.id);

  // ✨ 新增：記錄投票互動
  await buddiesInteractionService.recordVote(
    roomId,
    userId,
    restaurant.id,
    restaurant
  );
};

// 在 handleFinishSwiping 函數中
const handleFinishSwiping = async () => {
  // ... 計算投票結果 ...

  if (selectedRestaurant) {
    // ✨ 更新房間最終結果（包含 completed_at）
    await buddiesInteractionService.updateRoomFinalResult(
      roomId,
      selectedRestaurant.id,
      selectedRestaurant
    );

    // ✨ 同步更新 votes 欄位
    await buddiesInteractionService.updateRoomVotes(roomId, votes);

    // 觸發回調
    onFinalResult?.(selectedRestaurant);
  }
};
```

---

### 階段 4：更新 DataAnalyticsPage

#### 4.1 新增互動統計區塊

**檔案：** `src/components/admin/DataAnalyticsPage.jsx`

**步驟 1：新增狀態**

```javascript
const [interactionStats, setInteractionStats] = useState({
  swiftTaste: {
    totalInteractions: 0,
    viewCount: 0,
    likeCount: 0,
    skipCount: 0,
    avgInteractionsPerSession: 0
  },
  buddies: {
    totalInteractions: 0,
    viewCount: 0,
    likeCount: 0,
    skipCount: 0,
    voteCount: 0
  }
});

const [durationAnalysis, setDurationAnalysis] = useState({
  swiftTaste: {
    avgTotal: 0,
    avgQuestions: 0,
    avgFunQuestions: 0,
    avgRestaurants: 0
  },
  buddies: {
    avgTotal: 0,
    avgLobby: 0,
    avgQuestions: 0,
    avgVoting: 0
  }
});
```

**步驟 2：新增查詢函數**

```javascript
// 載入互動統計
const loadInteractionStats = async () => {
  try {
    // SwiftTaste 互動
    const { data: swiftTasteInteractions } = await supabase
      .from('swifttaste_interactions')
      .select('action_type, session_id');

    const swiftTasteStats = {
      totalInteractions: swiftTasteInteractions?.length || 0,
      viewCount: swiftTasteInteractions?.filter(i => i.action_type === 'view').length || 0,
      likeCount: swiftTasteInteractions?.filter(i => i.action_type === 'like').length || 0,
      skipCount: swiftTasteInteractions?.filter(i => i.action_type === 'skip').length || 0
    };

    // 計算平均互動數
    const uniqueSessions = new Set(swiftTasteInteractions?.map(i => i.session_id) || []);
    swiftTasteStats.avgInteractionsPerSession = uniqueSessions.size > 0
      ? (swiftTasteStats.totalInteractions / uniqueSessions.size).toFixed(1)
      : 0;

    // Buddies 互動
    const { data: buddiesInteractions } = await supabase
      .from('buddies_interactions')
      .select('action_type, room_id');

    const buddiesStats = {
      totalInteractions: buddiesInteractions?.length || 0,
      viewCount: buddiesInteractions?.filter(i => i.action_type === 'view').length || 0,
      likeCount: buddiesInteractions?.filter(i => i.action_type === 'like').length || 0,
      skipCount: buddiesInteractions?.filter(i => i.action_type === 'skip').length || 0,
      voteCount: buddiesInteractions?.filter(i => i.action_type === 'vote').length || 0
    };

    setInteractionStats({
      swiftTaste: swiftTasteStats,
      buddies: buddiesStats
    });

    return { swiftTaste: swiftTasteStats, buddies: buddiesStats };
  } catch (error) {
    console.error('載入互動統計失敗:', error);
    return null;
  }
};

// 載入時長分析
const loadDurationAnalysis = async () => {
  try {
    // SwiftTaste 時長
    const { data: swiftTasteSessions } = await supabase
      .from('user_selection_history')
      .select('started_at, questions_started_at, fun_questions_started_at, restaurants_started_at, completed_at')
      .eq('mode', 'swifttaste')
      .not('completed_at', 'is', null);

    const swiftTasteDurations = swiftTasteSessions?.map(s => {
      const start = new Date(s.started_at);
      const end = new Date(s.completed_at);
      const total = Math.round((end - start) / 1000);

      const questions = s.questions_started_at
        ? Math.round((new Date(s.questions_started_at) - start) / 1000)
        : null;

      const funQuestions = s.fun_questions_started_at && s.questions_started_at
        ? Math.round((new Date(s.fun_questions_started_at) - new Date(s.questions_started_at)) / 1000)
        : null;

      const restaurants = s.restaurants_started_at
        ? Math.round((end - new Date(s.restaurants_started_at)) / 1000)
        : null;

      return { total, questions, funQuestions, restaurants };
    }) || [];

    const swiftTasteAvg = {
      avgTotal: swiftTasteDurations.length > 0
        ? Math.round(swiftTasteDurations.reduce((sum, d) => sum + d.total, 0) / swiftTasteDurations.length)
        : 0,
      avgQuestions: swiftTasteDurations.filter(d => d.questions).length > 0
        ? Math.round(swiftTasteDurations.filter(d => d.questions).reduce((sum, d) => sum + d.questions, 0) / swiftTasteDurations.filter(d => d.questions).length)
        : 0,
      avgFunQuestions: swiftTasteDurations.filter(d => d.funQuestions).length > 0
        ? Math.round(swiftTasteDurations.filter(d => d.funQuestions).reduce((sum, d) => sum + d.funQuestions, 0) / swiftTasteDurations.filter(d => d.funQuestions).length)
        : 0,
      avgRestaurants: swiftTasteDurations.filter(d => d.restaurants).length > 0
        ? Math.round(swiftTasteDurations.filter(d => d.restaurants).reduce((sum, d) => sum + d.restaurants, 0) / swiftTasteDurations.filter(d => d.restaurants).length)
        : 0
    };

    // Buddies 時長
    const { data: buddiesRooms } = await supabase
      .from('buddies_rooms')
      .select('created_at, questions_started_at, voting_started_at, completed_at')
      .not('completed_at', 'is', null);

    const buddiesDurations = buddiesRooms?.map(r => {
      const start = new Date(r.created_at);
      const end = new Date(r.completed_at);
      const total = Math.round((end - start) / 1000);

      const lobby = r.questions_started_at
        ? Math.round((new Date(r.questions_started_at) - start) / 1000)
        : null;

      const questions = r.voting_started_at && r.questions_started_at
        ? Math.round((new Date(r.voting_started_at) - new Date(r.questions_started_at)) / 1000)
        : null;

      const voting = r.voting_started_at
        ? Math.round((end - new Date(r.voting_started_at)) / 1000)
        : null;

      return { total, lobby, questions, voting };
    }) || [];

    const buddiesAvg = {
      avgTotal: buddiesDurations.length > 0
        ? Math.round(buddiesDurations.reduce((sum, d) => sum + d.total, 0) / buddiesDurations.length)
        : 0,
      avgLobby: buddiesDurations.filter(d => d.lobby).length > 0
        ? Math.round(buddiesDurations.filter(d => d.lobby).reduce((sum, d) => sum + d.lobby, 0) / buddiesDurations.filter(d => d.lobby).length)
        : 0,
      avgQuestions: buddiesDurations.filter(d => d.questions).length > 0
        ? Math.round(buddiesDurations.filter(d => d.questions).reduce((sum, d) => sum + d.questions, 0) / buddiesDurations.filter(d => d.questions).length)
        : 0,
      avgVoting: buddiesDurations.filter(d => d.voting).length > 0
        ? Math.round(buddiesDurations.filter(d => d.voting).reduce((sum, d) => sum + d.voting, 0) / buddiesDurations.filter(d => d.voting).length)
        : 0
    };

    setDurationAnalysis({
      swiftTaste: swiftTasteAvg,
      buddies: buddiesAvg
    });

    return { swiftTaste: swiftTasteAvg, buddies: buddiesAvg };
  } catch (error) {
    console.error('載入時長分析失敗:', error);
    return null;
  }
};
```

**步驟 3：在 loadData 中調用**

```javascript
const loadData = async () => {
  try {
    setLoading(true);
    setError(null);

    const [
      overviewStats,
      swiftTasteData,
      buddiesData,
      { top20, allRankings },
      funQuestions,
      demographics,
      anonymousStats,
      timeTrend,
      interactions,    // ✨ 新增
      durations        // ✨ 新增
    ] = await Promise.all([
      dataAnalyticsService.getOverviewStats(),
      loadSwiftTasteMetrics(),
      loadBuddiesMetrics(),
      loadRestaurantSuccessMetrics(),
      loadFunQuestionStats(),
      loadDemographicAnalysis(),
      loadAnonymousData(),
      loadTimeTrendData(),
      loadInteractionStats(),      // ✨ 新增
      loadDurationAnalysis()       // ✨ 新增
    ]);

    // ... 設置狀態 ...
  } catch (err) {
    console.error('載入統計數據失敗:', err);
    setError('載入數據時發生錯誤，請稍後再試');
  } finally {
    setLoading(false);
  }
};
```

**步驟 4：在 UI 中顯示**

```jsx
{/* 新增互動統計卡片 */}
<div className="analytics-card">
  <h3>📊 用戶互動統計</h3>

  <h4>SwiftTaste 模式</h4>
  <div className="metrics-grid">
    <div className="metric">
      <span className="metric-label">總互動數</span>
      <span className="metric-value">{interactionStats.swiftTaste.totalInteractions}</span>
    </div>
    <div className="metric">
      <span className="metric-label">查看</span>
      <span className="metric-value">{interactionStats.swiftTaste.viewCount}</span>
    </div>
    <div className="metric">
      <span className="metric-label">喜歡</span>
      <span className="metric-value">{interactionStats.swiftTaste.likeCount}</span>
    </div>
    <div className="metric">
      <span className="metric-label">跳過</span>
      <span className="metric-value">{interactionStats.swiftTaste.skipCount}</span>
    </div>
    <div className="metric">
      <span className="metric-label">平均互動/會話</span>
      <span className="metric-value">{interactionStats.swiftTaste.avgInteractionsPerSession}</span>
    </div>
  </div>

  <h4>Buddies 模式</h4>
  <div className="metrics-grid">
    <div className="metric">
      <span className="metric-label">總互動數</span>
      <span className="metric-value">{interactionStats.buddies.totalInteractions}</span>
    </div>
    <div className="metric">
      <span className="metric-label">查看</span>
      <span className="metric-value">{interactionStats.buddies.viewCount}</span>
    </div>
    <div className="metric">
      <span className="metric-label">喜歡</span>
      <span className="metric-value">{interactionStats.buddies.likeCount}</span>
    </div>
    <div className="metric">
      <span className="metric-label">跳過</span>
      <span className="metric-value">{interactionStats.buddies.skipCount}</span>
    </div>
    <div className="metric">
      <span className="metric-label">投票</span>
      <span className="metric-value">{interactionStats.buddies.voteCount}</span>
    </div>
  </div>
</div>

{/* 新增時長分析卡片 */}
<div className="analytics-card">
  <h3>⏱️ 會話時長分析</h3>

  <h4>SwiftTaste 平均時長</h4>
  <div className="metrics-grid">
    <div className="metric">
      <span className="metric-label">總時長</span>
      <span className="metric-value">{durationAnalysis.swiftTaste.avgTotal}s</span>
    </div>
    <div className="metric">
      <span className="metric-label">答題階段</span>
      <span className="metric-value">{durationAnalysis.swiftTaste.avgQuestions}s</span>
    </div>
    <div className="metric">
      <span className="metric-label">趣味問題</span>
      <span className="metric-value">{durationAnalysis.swiftTaste.avgFunQuestions}s</span>
    </div>
    <div className="metric">
      <span className="metric-label">選擇餐廳</span>
      <span className="metric-value">{durationAnalysis.swiftTaste.avgRestaurants}s</span>
    </div>
  </div>

  <h4>Buddies 平均時長</h4>
  <div className="metrics-grid">
    <div className="metric">
      <span className="metric-label">總時長</span>
      <span className="metric-value">{durationAnalysis.buddies.avgTotal}s</span>
    </div>
    <div className="metric">
      <span className="metric-label">等待階段</span>
      <span className="metric-value">{durationAnalysis.buddies.avgLobby}s</span>
    </div>
    <div className="metric">
      <span className="metric-label">答題階段</span>
      <span className="metric-value">{durationAnalysis.buddies.avgQuestions}s</span>
    </div>
    <div className="metric">
      <span className="metric-label">投票階段</span>
      <span className="metric-value">{durationAnalysis.buddies.avgVoting}s</span>
    </div>
  </div>
</div>
```

---

## ✅ 驗證清單

### 資料庫驗證

```sql
-- 1. 檢查 SwiftTaste 互動表
SELECT COUNT(*) as total_interactions,
       COUNT(DISTINCT session_id) as unique_sessions
FROM swifttaste_interactions;

-- 2. 檢查 Buddies 互動表
SELECT COUNT(*) as total_interactions,
       COUNT(DISTINCT room_id) as unique_rooms
FROM buddies_interactions;

-- 3. 檢查時間戳欄位
SELECT
  COUNT(*) FILTER (WHERE questions_started_at IS NOT NULL) as has_q_time,
  COUNT(*) FILTER (WHERE fun_questions_started_at IS NOT NULL) as has_f_time,
  COUNT(*) FILTER (WHERE restaurants_started_at IS NOT NULL) as has_r_time
FROM user_selection_history
WHERE mode = 'swifttaste';

-- 4. 檢查 Buddies 時間戳
SELECT
  COUNT(*) FILTER (WHERE questions_started_at IS NOT NULL) as has_q_time,
  COUNT(*) FILTER (WHERE voting_started_at IS NOT NULL) as has_v_time,
  COUNT(*) FILTER (WHERE completed_at IS NOT NULL) as has_c_time
FROM buddies_rooms;
```

### 前端驗證

```javascript
// 在瀏覽器 Console 測試

// 1. 測試 SwiftTaste 互動記錄
await swiftTasteInteractionService.recordView('test-session-id', null, 'restaurant-123');
await swiftTasteInteractionService.recordLike('test-session-id', null, 'restaurant-123');

// 2. 測試 Buddies 互動記錄
await buddiesInteractionService.recordView('test-room-id', 'user-123', 'restaurant-456');
await buddiesInteractionService.recordVote('test-room-id', 'user-123', 'restaurant-456');

// 3. 檢查數據
await swiftTasteInteractionService.getSessionData('test-session-id');
await buddiesInteractionService.getRoomSessionData('test-room-id');
```

---

## 📊 預期結果

完成後，你將能夠：

### SwiftTaste 模式
- ✅ 查看平均完成時長（總時長、各階段時長）
- ✅ 查看用戶互動統計（查看、喜歡、跳過次數）
- ✅ 查看最終選擇的餐廳
- ✅ 計算轉換率（view → like → final）

### Buddies 模式
- ✅ 查看平均會話時長（等待、答題、投票階段）
- ✅ 查看群組互動統計（查看、喜歡、跳過、投票）
- ✅ 查看最終結果餐廳及票數
- ✅ 分析成員參與度

### Admin 頁面
- ✅ 即時查看所有統計數據
- ✅ 比較兩種模式的效率
- ✅ 追蹤時長趨勢
- ✅ 驗證產品假設（是否縮短選擇時間）

---

## 🎯 成功指標

| 指標 | SwiftTaste 目標 | Buddies 目標 |
|-----|----------------|-------------|
| 平均完成時長 | < 3 分鐘 | < 5 分鐘 |
| 互動轉換率 | view → like > 30% | view → vote > 40% |
| 完成率 | > 70% | > 80% |
| 最終選擇率 | > 60% | > 90% |

---

**準備好開始實施了嗎？從階段 1 的資料庫遷移開始！** 🚀
