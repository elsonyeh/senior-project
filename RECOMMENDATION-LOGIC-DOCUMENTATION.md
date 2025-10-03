# SwiftTaste 推薦系統邏輯文檔

**版本**: 1.2
**最後更新**: 2025-02-03
**狀態**: 生產版本

---

## 📋 概述

SwiftTaste 推薦系統包含兩種核心模式：
- **SwiftTaste 模式**：個人化單人推薦
- **Buddies 模式**：多人群體推薦

兩種模式都基於相同的評分機制，但在輸入處理和篩選邏輯上有所差異。

---

## 🔧 核心配置

### 權重常數 (WEIGHT)

```javascript
const WEIGHT = {
  BASIC_MATCH: 10,     // 基本問題匹配權重
  FUN_MATCH: 5,        // 趣味問題匹配權重
  GROUP_CONSENSUS: 3,  // 群組共識獎勵（僅 Buddies 模式）
  POPULARITY: 2,       // 人氣權重
  DISTANCE: 2,         // 距離權重
  RATING: 1.5,         // 評分權重
  MIN_SCORE: 1         // 最低分數閾值
};
```

### 基本問題識別符

```javascript
const BASIC_QUESTION_IDENTIFIERS = [
  "今天是一個人還是有朋友？",
  "想吃奢華點還是平價？",
  "想吃正餐還是想喝飲料？",
  "吃一點還是吃飽？",
  "附近吃還是遠一點？",
  "想吃辣的還是不辣？"
];
```

---

## 🎯 SwiftTaste 模式（單人推薦）

### 數據庫欄位對應

| 問題類型 | 用戶選項 | 對應資料庫欄位 | 篩選邏輯 |
|---------|---------|---------------|----------|
| **人數** | 單人 | `suggested_people` | 包含 "1" |
| | 多人 | `suggested_people` | 包含 "~" |
| **價格** | 奢華美食 | `price_range` | 3=奢侈, 2=70%機率 |
| | 平價美食 | `price_range` | 1=平價, 2=30%機率 |
| **餐點類型** | 喝 | `tags` | 包含 "喝" 標籤 |
| | 吃一點 | `tags` | 包含 "吃一點" 標籤 |
| | 吃飽 | `tags` | 包含 "吃飽" 標籤 |
| **辣度** | 辣 | `is_spicy` | `'true'` 或 `'both'` |
| | 不辣 | `is_spicy` | `'false'` 或 `'both'` |

### 篩選流程

1. **前置篩選**：根據基本問題答案進行資料庫欄位篩選
2. **評分計算**：為每家餐廳計算匹配分數
3. **排序選擇**：按分數排序並選出前10名

### 評分計算邏輯

```javascript
// 基本匹配評分（必須完全符合所有基本條件）
let basicMatchCount = 0;

basicAnswers.forEach(answer => {
  let matched = false;

  switch(answer) {
    case "奢華美食":
      matched = price_range === 3 || (price_range === 2 && Math.random() < 0.7);
      break;
    case "平價美食":
      matched = price_range === 1 || (price_range === 2 && Math.random() < 0.3);
      break;
    case "吃":
      matched = normalizedTags.includes("吃一點") || normalizedTags.includes("吃飽");
      break;
    // ... 其他匹配邏輯
  }

  if (matched) {
    score += WEIGHT.BASIC_MATCH;
    basicMatchCount++;
  }
});

// 嚴格基本匹配：必須符合所有基本條件，否則直接排除
if (basicAnswers.length > 0 && basicMatchCount < basicAnswers.length) {
  return 0; // 直接返回0分，確保被過濾掉
}
```

### 特殊處理機制

1. **嚴格基本匹配**：餐廳必須符合**所有**基本條件，不符合任一條件直接排除
2. **機率性價格匹配**：price_range = 2 時使用機率分配
3. **餐點類型層級**："吃" 匹配 "吃一點" 或 "吃飽"
4. **趣味問題標籤映射**：使用 `funQuestionTagsMap` 進行語意匹配
5. **評分加權**：餐廳評分轉換為 0-1 權重後加入總分
6. **零分過濾**：評分為0的餐廳在最終篩選階段被完全排除

---

## 👥 Buddies 模式（多人推薦）

### 流程概覽

Buddies 模式分為三個主要階段：

1. **問答階段**：所有成員回答相同的問題
2. **滑卡階段**：成員獨立滑動選擇餐廳
3. **結果階段**：展示投票結果和最終推薦

### 問答階段 (Questions Phase)

**同步機制**：
- 所有成員看到相同的問題順序
- 每位成員獨立作答
- 當所有成員完成當前題目時，**自動同步進入下一題**
- 使用動畫偵測系統，確保所有人看完動畫後一起跳題

**自動跳題邏輯** (BuddiesQuestionSwiper.jsx:204-266)：
```javascript
// 檢查所有活躍成員是否都已回答
const totalActiveMembers = members.filter(m => m.status !== 'left').length;
const answeredCount = answeredUserIds.size;

const shouldProceed =
  (totalActiveMembers === 1 && answeredCount >= 1) ||  // 單人模式
  (totalActiveMembers > 1 && answeredCount >= totalActiveMembers);  // 多人全部完成

if (shouldProceed) {
  // 等待動畫完成後才進入下一題
  setupAnimationDetection(nextIndex, visibleQuestions);
}
```

**集體決策機制（版本 1.2 新增）**：

為確保所有成員基於相同的條件題邏輯看到統一的問題序列，Buddies 模式實作了完整的多數決與集體答案系統：

1. **資料庫 Schema**：
   ```sql
   -- buddies_rooms 表新增欄位
   ALTER TABLE buddies_rooms
   ADD COLUMN collective_answers JSONB DEFAULT '{}'::jsonb;
   ADD COLUMN current_question_index INTEGER DEFAULT 0;
   ```

2. **集體答案儲存格式**：
   ```json
   {
     "0": "吃",
     "1": "平價美食",
     "2": "附近吃",
     "3": "不辣"
   }
   ```
   - 鍵為原始題目索引（originalIndex）
   - 值為該題的多數決答案

3. **多數決計算邏輯** (BuddiesQuestionSwiper.jsx:339-375)：
   ```javascript
   // 當所有人完成答題後計算多數決
   if (shouldProceed && answeredCount > 0) {
     if (Object.keys(stats).length > 0) {
       let majorityAnswer = null;
       let maxVotes = 0;

       Object.entries(stats).forEach(([answer, count]) => {
         if (typeof count === 'number' && count > maxVotes) {
           maxVotes = count;
           majorityAnswer = answer;
         }
       });

       if (majorityAnswer) {
         const originalIndex = currentQ?.originalIndex ?? questionIndex;
         roomService.updateCollectiveAnswer(roomId, originalIndex, majorityAnswer);
       }
     }
   }
   ```

4. **條件題判斷邏輯修改** (BuddiesQuestionSwiper.jsx:149-167)：
   ```javascript
   // 版本 1.1（舊版）- 使用個人答案
   const dependentAnswer = answersRef.current[dependentQuestionIndex];

   // 版本 1.2（當前）- 使用集體答案
   const dependentAnswer = collectiveAnswers[dependentQuestionIndex.toString()];

   if (dependentAnswer === q.dependsOn.answer) {
     visibleQuestions.push({ ...q, originalIndex });
   }
   ```

5. **即時同步機制** (BuddiesQuestionSwiper.jsx:113-129)：
   ```javascript
   useEffect(() => {
     if (!roomId) return;

     // 監聽房間狀態更新
     const cleanup = roomService.listenRoomStatus(roomId, async (status, roomData) => {
       const roomInfo = await roomService.getRoomInfo(roomId);
       if (roomInfo.success && roomInfo.data) {
         const newCollectiveAnswers = roomInfo.data.collective_answers || {};
         setCollectiveAnswers(newCollectiveAnswers);
       }
     });

     return cleanup;
   }, [roomId]);
   ```

**重要改進**：
- ✅ **統一問題序列**：所有成員基於集體決策看到相同的條件題
- ✅ **民主決策**：多數決機制確保群體意見被採納
- ✅ **即時同步**：透過 Supabase Realtime 確保所有成員即時更新
- ✅ **無需重刷**：所有邏輯自動進行，不需手動刷新頁面

**投票處理機制（已棄用）**：

> **注意**：以下機制在版本 1.2 已被集體決策系統取代，保留僅供參考

1. **收集答案**：收集所有用戶對每個基本問題的答案
2. **計算權重票數**：
   - 一般成員：1票
   - 房主：2票（雙倍權重）
3. **決定最終答案**：
   - 單一最高票：直接採用
   - 多個最高票（平票）：優先使用房主選擇
   - 無房主選擇：使用第一個最高票選項

### 投票算法

#### 版本 1.0（舊版）- 已棄用
```javascript
// 舊版：使用第一個用戶的答案作為代表
groupAnswers[questionIndex] = answers[0];
```

#### 版本 1.1（當前）- 多數決機制
```javascript
// 新版：統計所有用戶答案，採用多數決
const answerCounts = {};
answers.forEach(answer => {
  answerCounts[answer] = (answerCounts[answer] || 0) + 1;
});

// 找出出現次數最多的答案
let maxCount = 0;
let mostCommonAnswer = answers[0]; // 預設值

Object.entries(answerCounts).forEach(([answer, count]) => {
  if (count > maxCount) {
    maxCount = count;
    mostCommonAnswer = answer;
  }
});

groupAnswers[questionIndex] = mostCommonAnswer;
```

### 滑卡階段 (Recommendation Phase)

**餐廳推薦一致性**：

#### 版本 1.0（舊版）- 已棄用
- 按 matchScore 排序選出前10名
- **不打亂順序**，所有成員看到完全相同的排序

#### 版本 1.1（當前）- 隨機打亂邏輯
- 使用**多數決**計算群組共識答案 (BuddiesRoom.jsx:735-758)
- 基於群組共識答案計算 matchScore
- 按分數排序選出前10名
- 使用房間ID作為種子打亂前10名順序 (BuddiesRecommendation.jsx:164-166)
- **確保同房間所有成員看到相同順序，但不同房間順序不同**
- 限制推薦數量為前10家最匹配餐廳

```javascript
// 版本 1.1 排序邏輯
const sortedByScore = [...restaurants].sort(
  (a, b) => (b.matchScore || 0) - (a.matchScore || 0)
);
const topTen = sortedByScore.slice(0, 10);

// 使用房間ID作為種子打亂前10名
const shuffledTopTen = seededShuffle(topTen, roomSeed);
```

**滑卡邏輯**：
- 每位成員**獨立滑動**，不需等待他人
- 右滑收藏餐廳時自動投票
- 實時顯示投票進度：`{votedUsersCount}/{totalMembers}`

**完成檢測** (BuddiesRecommendation.jsx:197-223)：
```javascript
// 監聽投票更新並檢查所有人是否完成
const votedResult = await voteService.getVotedUsersCount(roomId);
const actualVotedCount = votedResult.count;

// 所有成員都已投票時自動進入結果階段
if (actualVotedCount >= totalMembers && totalMembers > 0) {
  handleFinishSwiping();
}
```

### 結果階段 (Result Phase)

**投票統計**：
- 從 `buddies_votes` 表查詢每位用戶的投票
- 從 `buddies_restaurant_votes` 表查詢餐廳總票數
- 在結果頁面顯示每間餐廳的得票數

**資料庫約束** (版本 1.1 更新)：
```sql
-- 版本 1.0（舊版）- 已棄用
UNIQUE (room_id, user_id)  -- 每人每房間只能投一次票

-- 版本 1.1（當前）
UNIQUE (room_id, user_id, restaurant_id)  -- 允許同一用戶為不同餐廳投票
```

**最終結果計算**：

#### 版本 1.0（舊版）- 已棄用
1. 計算最高票餐廳
2. **手動點擊「確認選擇」按鈕**
3. 由點擊的用戶寫入資料庫（缺少 userId 參數會失敗）

#### 版本 1.1（當前）- 全自動邏輯
1. 所有成員投票完畢後**自動觸發**
2. 找出得票最高的餐廳
3. 若有平票，使用確定性隨機選擇（基於房間ID種子）
4. **自動寫入 `buddies_final_results` 表**
5. 通過 Realtime 訂閱**廣播給所有成員**
6. 所有人同時看到結果 + 紙屑動畫 🎉

```javascript
// 版本 1.1 自動確認邏輯 (BuddiesRecommendation.jsx:107-128)
if (selectedRestaurant) {
  const result = await finalResultService.finalizeRestaurant(
    roomId,
    selectedRestaurant,
    userId  // 修復：添加缺少的 userId 參數
  );

  if (result.success) {
    setFinalResult(selectedRestaurant);
    setShowConfetti(true);
    setPhase("result");
  }
}
```

**票數顯示** (RecommendationResult.css - 版本 1.1 更新)：
```css
/* 版本 1.0（舊版）- 綠色 */
.votes-badge-top-right {
  background-color: rgba(40, 167, 69, 0.95);
}

/* 版本 1.1（當前）- 橘色主題 */
.votes-badge-top-right {
  background-color: rgba(253, 150, 61, 0.95);
  color: white;
}
```

### 推薦生成流程

1. **民主決策**：通過投票確定群組偏好
2. **餐廳篩選**：使用群組決策結果篩選餐廳
3. **評分排序**：使用相同的 `calculateMatchScore` 函數
4. **結果輸出**：返回按分數排序的推薦列表
5. **票數統計**：展示每間餐廳的投票結果

---

## 🔄 共同評分系統

### calculateMatchScore 函數

兩種模式都使用相同的評分函數確保一致性：

```javascript
function calculateMatchScore(restaurant, basicAnswers, basicQuestions, funAnswers, userLocation, options) {
  let score = WEIGHT.MIN_SCORE;

  // 1. 基本問題匹配
  basicAnswers.forEach(answer => {
    // 根據answer類型進行匹配判斷
    if (matched) {
      score += WEIGHT.BASIC_MATCH;
    }
  });

  // 2. 趣味問題匹配
  if (funAnswers.length > 0) {
    const funMatchScore = calculateFunQuestionMatch(funAnswers, restaurantTags);
    score += funMatchScore * WEIGHT.FUN_MATCH;
  }

  // 3. 評分權重
  if (rating > 0) {
    score += Math.min(rating / 5, 1) * WEIGHT.RATING;
  }

  // 4. 完全匹配獎勵
  if (basicMatchCount === basicAnswers.length) {
    score += WEIGHT.BASIC_MATCH * 0.5;
  }

  return score;
}
```

---

## 📊 趣味問題標籤映射

趣味問題通過預定義的標籤映射表進行語意匹配：

```javascript
// 範例映射
const funQuestionTagsMap = {
  "側背包": ["精緻","咖啡廳", "文青", "小店","現代","簡約","工業"],
  "後背包": ["戶外", "休閒", "活力", "大型","鄉村", "舊", "熱情"],
  "力大無窮": ["鄉村", "復古", "台式", "日式", "明亮活潑", "動感十足", "喜氣", "友善", "瘋狂", "舊", "吃飽", "重口味", "大份量", "烤肉"]
  // ... 更多映射
};
```

---

## ⚠️ 重要更新記錄

### 2025-02-03 - 版本 1.2 集體決策系統
- **集體答案機制**：新增 `collective_answers` JSONB 欄位儲存多數決結果
- **多數決算法**：當所有成員完成答題後自動計算最高票答案
- **條件題統一**：所有成員基於集體答案看到相同的 dependsOn 條件題序列
- **即時同步**：透過 Supabase Realtime 即時廣播集體決策給所有成員
- **問題索引追蹤**：新增 `current_question_index` 欄位追蹤房間統一進度
- **資料庫遷移**：新增 `add-collective-answers-to-buddies-rooms.sql` 腳本
- **服務層方法**：新增 `updateCollectiveAnswer()` 方法至 roomService

### 2025-02-01 - 版本 1.1 核心功能修復
- **多數決機制**：改用統計所有成員答案的多數決，取代舊版「使用第一個用戶答案」的邏輯
- **隨機打亂邏輯**：基於房間ID打亂前10名餐廳順序，增加推薦多樣性
- **資料庫約束修復**：修改 `buddies_votes` 表約束為 `(room_id, user_id, restaurant_id)` 允許同一用戶為不同餐廳投票
- **全自動最終結果**：所有成員投票完畢後自動計算並廣播最終餐廳，移除手動「確認選擇」按鈕
- **UI 主題統一**：投票票數徽章改為橘色 (#FD963D)，與導航按鈕顏色一致
- **物件渲染修復**：修復 `BuddiesRoom.jsx` 中 option 物件直接渲染導致的錯誤

### 2025-01-30 - Buddies 模式重大改進
- **自動跳題機制**：所有成員答題完成後自動進入下一題，無需重刷頁面
- **動畫同步**：使用動畫偵測系統確保所有成員看完動畫後一起跳題 (1.2-2.3秒)
- **餐廳推薦一致性**：使用房間ID種子確保所有成員看到相同的餐廳順序
- **獨立滑卡**：成員可獨立滑動選擇餐廳，不需等待他人
- **投票完成檢測**：正確追蹤已投票用戶數，所有人投票後自動進入結果
- **票數顯示**：結果頁面顯示每間餐廳的得票數

### 2025-01-20 更新
- **標籤統一**：將所有 "飽足" 標籤統一更新為 "吃飽"
- **資料庫欄位修正**：確認使用正確的資料庫欄位映射
- **邏輯一致性**：統一前後端推薦邏輯
- **嚴格基本匹配**：強化基本條件檢查，不符合所有基本條件的餐廳直接排除（返回0分）
- **辣度篩選修正**：修正前後端 `is_spicy` 欄位名稱不一致問題，確保辣度篩選正常工作
- **辣度欄位擴展**：新增 `'both'` 選項，支援同時提供辣和不辣選擇的餐廳

### 受影響的文件

**2025-02-03 更新（版本 1.2）**:
- `src/components/BuddiesQuestionSwiper.jsx` - 集體答案同步、多數決計算、條件題邏輯修改
- `src/services/supabaseService.js` - 新增 `updateCollectiveAnswer()` 方法
- `add-collective-answers-to-buddies-rooms.sql` - 資料庫 Schema 遷移腳本
- `RECOMMENDATION-LOGIC-DOCUMENTATION.md` - 本文件

**2025-02-01 更新（版本 1.1）**:
- `src/components/BuddiesRoom.jsx` - 多數決邏輯、修復 option 物件渲染
- `src/components/BuddiesRecommendation.jsx` - 隨機打亂邏輯、全自動最終結果、移除手動確認按鈕
- `src/components/RecommendationResult.css` - 票數顏色改為橘色主題
- `src/services/supabaseService.js` - 修復 `finalizeRestaurant` 缺少 userId 參數
- `fix-buddies-votes-constraint.sql` - 資料庫約束修復腳本
- `RECOMMENDATION-LOGIC-DOCUMENTATION.md` - 本文件

**2025-01-30 更新（版本 1.0）**:
- `src/components/BuddiesQuestionSwiper.jsx` - 自動跳題邏輯
- `src/components/BuddiesRecommendation.jsx` - 投票完成檢測、滑卡階段
- `src/components/RecommendationResult.jsx` - 票數顯示
- `src/services/supabaseService.js` - 新增 `getVotedUsersCount()` 方法
- `RECOMMENDATION-LOGIC-DOCUMENTATION.md` - 本文件

**2025-01-20 更新**:
- `src/components/SwiftTaste.jsx`
- `src/data/funQuestionTags.js`
- `server/data/funQuestionTags.js`
- `server/logic/enhancedRecommendLogicBackend.js`
- `src/logic/enhancedRecommendLogicFrontend.js`

---

## 🔧 技術實現細節

### 文件結構

```
src/
├── components/
│   ├── SwiftTaste.jsx              // 單人模式主組件
│   └── BuddiesRoom.jsx             // 多人模式主組件
├── logic/
│   └── enhancedRecommendLogicFrontend.js  // 前端推薦邏輯
├── data/
│   └── funQuestionTags.js          // 趣味問題標籤映射
└── services/
    └── supabaseService.js          // 資料庫服務

server/
├── logic/
│   └── enhancedRecommendLogicBackend.js   // 後端推薦邏輯
└── data/
    └── funQuestionTags.js          // 後端標籤映射
```

### 資料庫 Schema

```sql
-- restaurants 表相關欄位
restaurants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  suggested_people TEXT,        -- "1", "~", "1~" 等
  price_range INTEGER,          -- 1=平價, 2=中等, 3=奢華
  tags TEXT[],                 -- 包含餐點類型和其他標籤
  is_spicy BOOLEAN,            -- 辣度標記
  rating DECIMAL,              -- 餐廳評分
  is_active BOOLEAN DEFAULT true
);
```

---

## 🚀 效能優化建議

1. **索引優化**：
   ```sql
   CREATE INDEX idx_restaurants_active ON restaurants(is_active);
   CREATE INDEX idx_restaurants_price_range ON restaurants(price_range);
   CREATE INDEX idx_restaurants_tags ON restaurants USING GIN(tags);
   ```

2. **查詢優化**：
   - 優先使用精確欄位篩選減少候選集
   - 標籤查詢使用 GIN 索引提升效能

3. **快取策略**：
   - 趣味問題標籤映射結果快取
   - 常用篩選組合結果快取

---

## 📝 維護指南

### 修改推薦邏輯時需要更新的文件

1. **核心邏輯文件**：
   - `src/logic/enhancedRecommendLogicFrontend.js`
   - `server/logic/enhancedRecommendLogicBackend.js`

2. **UI組件**：
   - `src/components/SwiftTaste.jsx`
   - `src/components/BuddiesRoom.jsx`

3. **配置文件**：
   - `src/data/funQuestionTags.js`
   - `server/data/funQuestionTags.js`

4. **文檔**：
   - `RECOMMENDATION-LOGIC-DOCUMENTATION.md` (本文件)

### 測試檢查清單

- [ ] SwiftTaste 模式基本篩選功能
- [ ] Buddies 模式投票機制
- [ ] 評分計算準確性
- [ ] 邊界條件處理
- [ ] 資料庫查詢效能
- [ ] 前後端邏輯一致性

---

## 📞 支援與問題回報

如發現推薦邏輯問題或需要功能增強，請：

1. 檢查本文檔確認當前邏輯設計
2. 驗證資料庫資料正確性
3. 確認前後端代碼一致性
4. 提供具體的問題描述和重現步驟

---

**文檔維護者**: 開發團隊
**下次審查時間**: 功能更新時同步更新