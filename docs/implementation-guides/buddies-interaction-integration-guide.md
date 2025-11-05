# Buddies 互動記錄整合指南

## 概述

本指南說明如何在 Buddies 模式中整合互動記錄功能，確保記錄：
1. **完整會話時長** - 從大廳到完成的各階段耗時
2. **餐廳互動軌跡** - 查看、喜歡、跳過、投票
3. **最終結果** - 最終選定的餐廳及相關資料

---

## 一、前端集成步驟

### 1.1 在 BuddiesRoom.jsx 中記錄時間戳

```javascript
// src/components/BuddiesRoom.jsx

import buddiesInteractionService from '../services/buddiesInteractionService';

// 創建房間時 - 記錄開始時間（created_at 自動記錄）
const handleCreateRoom = async () => {
  // ... 現有邏輯 ...

  if (response.success) {
    // 房間創建成功，created_at 已自動記錄
    logger.info(`房間創建成功，開始時間: ${new Date().toISOString()}`);
  }
};

// 開始答題時 - 記錄 questions_started_at
const handleStartQuestions = async () => {
  if (!isHost) return;

  // 更新房間狀態為 'questions'
  await roomService.updateRoomStatus(roomId, 'questions');

  // 記錄答題開始時間
  await buddiesInteractionService.updateRoomTimestamp(
    roomId,
    'questions_started_at'
  );

  logger.info(`開始答題: ${new Date().toISOString()}`);
};

// 開始投票時 - 記錄 voting_started_at
const handleStartVoting = async () => {
  if (!isHost) return;

  // 更新房間狀態為 'recommend'
  await roomService.updateRoomStatus(roomId, 'recommend');

  // 記錄投票開始時間
  await buddiesInteractionService.updateRoomTimestamp(
    roomId,
    'voting_started_at'
  );

  logger.info(`開始投票: ${new Date().toISOString()}`);
};
```

### 1.2 在 BuddiesRecommendation.jsx 中記錄互動

```javascript
// src/components/BuddiesRecommendation.jsx

import buddiesInteractionService from '../services/buddiesInteractionService';
import { roomService } from '../services/supabaseService';

export default function BuddiesRecommendation({ roomId, restaurants, onFinalResult }) {
  const userId = roomService.getOrCreateUserId();

  // 記錄查看餐廳
  const handleRestaurantView = async (restaurant) => {
    await buddiesInteractionService.recordView(
      roomId,
      userId,
      restaurant.id
    );
    logger.debug(`查看餐廳: ${restaurant.name}`);
  };

  // 記錄喜歡餐廳
  const handleRestaurantLike = async (restaurant) => {
    await buddiesInteractionService.recordLike(
      roomId,
      userId,
      restaurant.id,
      restaurant
    );
    logger.debug(`喜歡餐廳: ${restaurant.name}`);
  };

  // 記錄跳過餐廳
  const handleRestaurantSkip = async (restaurant) => {
    await buddiesInteractionService.recordSkip(
      roomId,
      userId,
      restaurant.id
    );
    logger.debug(`跳過餐廳: ${restaurant.name}`);
  };

  // 記錄投票
  const handleRestaurantVote = async (restaurant) => {
    // 先執行原有的投票邏輯
    await voteService.vote(roomId, userId, restaurant.id);

    // 記錄互動
    await buddiesInteractionService.recordVote(
      roomId,
      userId,
      restaurant.id,
      restaurant
    );

    logger.debug(`投票餐廳: ${restaurant.name}`);
  };

  // 完成投票並確定最終結果
  const handleFinishSwiping = async () => {
    // ... 計算投票結果的邏輯 ...

    if (selectedRestaurant) {
      // 更新房間最終結果（包含 completed_at）
      await buddiesInteractionService.updateRoomFinalResult(
        roomId,
        selectedRestaurant.id,
        selectedRestaurant
      );

      // 同步更新 votes 欄位
      await buddiesInteractionService.updateRoomVotes(roomId, votes);

      // 觸發回調
      onFinalResult(selectedRestaurant);

      logger.info(`最終結果: ${selectedRestaurant.name}`);
    }
  };

  return (
    <RestaurantSwiperMotion
      restaurants={limitedRestaurants}
      onView={handleRestaurantView}
      onLike={handleRestaurantLike}
      onSkip={handleRestaurantSkip}
      onVote={handleRestaurantVote}
      onFinish={handleFinishSwiping}
    />
  );
}
```

### 1.3 在 RestaurantSwiperMotion.jsx 中觸發互動事件

```javascript
// src/components/RestaurantSwiperMotion.jsx

export default function RestaurantSwiperMotion({
  restaurants,
  onView,      // 新增
  onLike,
  onSkip,      // 新增
  onVote,
  onFinish
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // 當餐廳卡片顯示時，記錄查看
  useEffect(() => {
    if (currentIndex < restaurants.length) {
      const currentRestaurant = restaurants[currentIndex];
      onView?.(currentRestaurant);
    }
  }, [currentIndex, restaurants]);

  // 左滑 - 跳過
  const handleSwipeLeft = (restaurant) => {
    onSkip?.(restaurant);
    setCurrentIndex(prev => prev + 1);
  };

  // 右滑 - 喜歡
  const handleSwipeRight = (restaurant) => {
    onLike?.(restaurant);
    setCurrentIndex(prev => prev + 1);
  };

  // 點擊愛心 - 投票
  const handleVoteClick = (restaurant) => {
    onVote?.(restaurant);
  };

  // ... 其他邏輯 ...
}
```

---

## 二、數據分析查詢

### 2.1 查詢完整會話時長

```sql
-- 查詢所有已完成會話的時長統計
SELECT
  id as room_id,
  created_at,
  questions_started_at,
  voting_started_at,
  completed_at,

  -- 計算各階段耗時（秒）
  EXTRACT(EPOCH FROM (questions_started_at - created_at)) as lobby_duration_sec,
  EXTRACT(EPOCH FROM (voting_started_at - questions_started_at)) as questions_duration_sec,
  EXTRACT(EPOCH FROM (completed_at - voting_started_at)) as voting_duration_sec,
  EXTRACT(EPOCH FROM (completed_at - created_at)) as total_duration_sec,

  -- 轉換為人類可讀格式
  TO_CHAR((questions_started_at - created_at), 'MI:SS') as lobby_duration,
  TO_CHAR((voting_started_at - questions_started_at), 'MI:SS') as questions_duration,
  TO_CHAR((completed_at - voting_started_at), 'MI:SS') as voting_duration,
  TO_CHAR((completed_at - created_at), 'MI:SS') as total_duration
FROM buddies_rooms
WHERE completed_at IS NOT NULL
ORDER BY created_at DESC
LIMIT 50;
```

### 2.2 查詢餐廳互動統計

```sql
-- 查詢每個房間的餐廳互動詳情
SELECT
  bi.room_id,
  bi.restaurant_id,
  COUNT(*) FILTER (WHERE bi.action_type = 'view') as view_count,
  COUNT(*) FILTER (WHERE bi.action_type = 'like') as like_count,
  COUNT(*) FILTER (WHERE bi.action_type = 'skip') as skip_count,
  COUNT(*) FILTER (WHERE bi.action_type = 'vote') as vote_count,
  COUNT(DISTINCT bi.user_id) as unique_users,

  -- 計算轉換率
  ROUND(
    COUNT(*) FILTER (WHERE bi.action_type = 'vote')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE bi.action_type = 'view'), 0) * 100,
    2
  ) as vote_conversion_rate,

  -- 獲取第一次和最後一次互動時間
  MIN(bi.created_at) as first_interaction,
  MAX(bi.created_at) as last_interaction
FROM buddies_interactions bi
GROUP BY bi.room_id, bi.restaurant_id
ORDER BY vote_count DESC, view_count DESC;
```

### 2.3 查詢最終結果追蹤

```sql
-- 查詢最終選定的餐廳及相關統計
SELECT
  br.id as room_id,
  br.final_restaurant_id,
  br.final_restaurant_data->>'name' as restaurant_name,
  br.final_restaurant_data->>'address' as restaurant_address,
  br.completed_at,

  -- 會話時長
  EXTRACT(EPOCH FROM (br.completed_at - br.created_at)) as total_time_seconds,
  TO_CHAR((br.completed_at - br.created_at), 'MI:SS') as total_time,

  -- 該餐廳的投票數
  (br.votes->>br.final_restaurant_id)::int as final_votes,

  -- 該餐廳的互動統計
  (SELECT COUNT(*)
   FROM buddies_interactions
   WHERE room_id = br.id
   AND restaurant_id = br.final_restaurant_id
   AND action_type = 'view') as view_count,

  (SELECT COUNT(*)
   FROM buddies_interactions
   WHERE room_id = br.id
   AND restaurant_id = br.final_restaurant_id
   AND action_type = 'like') as like_count,

  (SELECT COUNT(DISTINCT user_id)
   FROM buddies_interactions
   WHERE room_id = br.id
   AND restaurant_id = br.final_restaurant_id) as interaction_user_count,

  -- 房間成員數
  (SELECT COUNT(*) FROM buddies_members WHERE room_id = br.id) as total_members
FROM buddies_rooms br
WHERE br.completed_at IS NOT NULL
ORDER BY br.completed_at DESC
LIMIT 50;
```

### 2.4 平均會話時長趨勢分析

```sql
-- 按日期統計平均會話時長（用於驗證產品是否真的縮短選擇時間）
SELECT
  DATE(created_at) as session_date,
  COUNT(*) as total_sessions,
  ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)))) as avg_duration_sec,
  ROUND(AVG(EXTRACT(EPOCH FROM (questions_started_at - created_at)))) as avg_lobby_sec,
  ROUND(AVG(EXTRACT(EPOCH FROM (voting_started_at - questions_started_at)))) as avg_questions_sec,
  ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - voting_started_at)))) as avg_voting_sec,

  -- 最快和最慢的會話
  MIN(EXTRACT(EPOCH FROM (completed_at - created_at))) as fastest_session_sec,
  MAX(EXTRACT(EPOCH FROM (completed_at - created_at))) as slowest_session_sec
FROM buddies_rooms
WHERE completed_at IS NOT NULL
GROUP BY DATE(created_at)
ORDER BY session_date DESC;
```

---

## 三、數據分析服務更新

### 3.1 更新 dataAnalyticsService.js

```javascript
// src/services/dataAnalyticsService.js

class DataAnalyticsService {
  // 新增：獲取 Buddies 會話時長統計
  async getBuddiesSessionDurationStats() {
    try {
      const { data, error } = await supabase
        .from('buddies_rooms')
        .select('created_at, questions_started_at, voting_started_at, completed_at')
        .not('completed_at', 'is', null);

      if (error) throw error;

      const durations = data.map(session => {
        const start = new Date(session.created_at);
        const end = new Date(session.completed_at);
        const totalSeconds = Math.round((end - start) / 1000);

        return {
          total_seconds: totalSeconds,
          lobby_seconds: session.questions_started_at
            ? Math.round((new Date(session.questions_started_at) - start) / 1000)
            : null,
          questions_seconds: session.voting_started_at && session.questions_started_at
            ? Math.round((new Date(session.voting_started_at) - new Date(session.questions_started_at)) / 1000)
            : null,
          voting_seconds: session.voting_started_at
            ? Math.round((end - new Date(session.voting_started_at)) / 1000)
            : null
        };
      });

      // 計算平均值
      const avgDuration = {
        total: Math.round(durations.reduce((sum, d) => sum + d.total_seconds, 0) / durations.length),
        lobby: Math.round(durations.filter(d => d.lobby_seconds).reduce((sum, d) => sum + d.lobby_seconds, 0) / durations.filter(d => d.lobby_seconds).length),
        questions: Math.round(durations.filter(d => d.questions_seconds).reduce((sum, d) => sum + d.questions_seconds, 0) / durations.filter(d => d.questions_seconds).length),
        voting: Math.round(durations.filter(d => d.voting_seconds).reduce((sum, d) => sum + d.voting_seconds, 0) / durations.filter(d => d.voting_seconds).length)
      };

      return {
        success: true,
        data: {
          sessions_count: durations.length,
          average_duration: avgDuration,
          all_durations: durations
        }
      };
    } catch (error) {
      console.error('Failed to get Buddies session duration stats:', error);
      return { success: false, error: error.message };
    }
  }

  // 新增：獲取餐廳互動統計
  async getRestaurantInteractionStats(roomId = null) {
    try {
      let query = supabase
        .from('buddies_interactions')
        .select('*');

      if (roomId) {
        query = query.eq('room_id', roomId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // 統計各類互動
      const stats = {
        total_interactions: data.length,
        by_action: {
          view: data.filter(i => i.action_type === 'view').length,
          like: data.filter(i => i.action_type === 'like').length,
          skip: data.filter(i => i.action_type === 'skip').length,
          vote: data.filter(i => i.action_type === 'vote').length
        },
        by_restaurant: {}
      };

      // 按餐廳統計
      data.forEach(interaction => {
        if (!stats.by_restaurant[interaction.restaurant_id]) {
          stats.by_restaurant[interaction.restaurant_id] = {
            view: 0,
            like: 0,
            skip: 0,
            vote: 0,
            unique_users: new Set()
          };
        }
        stats.by_restaurant[interaction.restaurant_id][interaction.action_type]++;
        stats.by_restaurant[interaction.restaurant_id].unique_users.add(interaction.user_id);
      });

      // 轉換 Set 為數字
      Object.keys(stats.by_restaurant).forEach(restaurantId => {
        stats.by_restaurant[restaurantId].unique_users = stats.by_restaurant[restaurantId].unique_users.size;
      });

      return { success: true, data: stats };
    } catch (error) {
      console.error('Failed to get restaurant interaction stats:', error);
      return { success: false, error: error.message };
    }
  }
}
```

---

## 四、驗證步驟

### 4.1 執行遷移腳本

```bash
# 1. 執行階段 1 遷移
psql -d your_database < database/migrations/buddies-schema-simplification-phase1.sql

# 2. 驗證新表和欄位已創建
# 在 Supabase Dashboard 或 psql 中執行驗證查詢
```

### 4.2 測試互動記錄

```javascript
// 在瀏覽器 Console 中測試

// 1. 測試記錄查看
await buddiesInteractionService.recordView('TEST_ROOM', 'user_123', 'restaurant_456');

// 2. 測試記錄喜歡
await buddiesInteractionService.recordLike('TEST_ROOM', 'user_123', 'restaurant_456');

// 3. 測試獲取互動摘要
const summary = await buddiesInteractionService.getRoomInteractionSummary('TEST_ROOM');
console.log(summary);

// 4. 測試獲取完整會話數據
const sessionData = await buddiesInteractionService.getRoomSessionData('TEST_ROOM');
console.log(sessionData);
```

### 4.3 驗證數據完整性

```sql
-- 檢查是否有記錄時間戳
SELECT
  COUNT(*) FILTER (WHERE questions_started_at IS NOT NULL) as with_questions_time,
  COUNT(*) FILTER (WHERE voting_started_at IS NOT NULL) as with_voting_time,
  COUNT(*) FILTER (WHERE completed_at IS NOT NULL) as with_completed_time,
  COUNT(*) as total_rooms
FROM buddies_rooms;

-- 檢查互動記錄是否存在
SELECT
  action_type,
  COUNT(*) as count
FROM buddies_interactions
GROUP BY action_type;
```

---

## 五、後續步驟

1. ✅ 執行階段 1 遷移（新增欄位和表）
2. ✅ 更新前端程式碼以記錄互動
3. ⏳ 測試驗證數據記錄正確性
4. ⏳ 運行 1-2 週收集真實數據
5. ⏳ 執行階段 2 遷移（移除舊表）
6. ⏳ 分析數據，驗證產品價值假設

---

## 六、關鍵指標

### 你要追蹤的核心指標：

1. **平均會話時長**
   - 目標：< 5 分鐘（從創建房間到最終選擇）
   - 對比：傳統選餐廳方式（預計 10-30 分鐘）

2. **互動效率**
   - 查看/投票轉換率：> 30%
   - 每個餐廳平均查看時長：< 10 秒

3. **最終選擇滿意度**
   - 最終餐廳獲得的平均票數：> 50% 成員投票
   - 有多少房間成功選出餐廳：> 90%

---

**記住 Linus 的話：「數據結構正確，代碼自然簡潔。」**

這個新架構讓你能清楚地追蹤用戶行為，驗證產品是否真的解決了選餐廳的痛點。
