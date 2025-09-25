# SwiftTaste 推薦系統邏輯文檔

**版本**: 1.0
**最後更新**: 2025-01-20
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

### 投票處理機制

1. **收集答案**：收集所有用戶對每個基本問題的答案
2. **計算權重票數**：
   - 一般成員：1票
   - 房主：2票（雙倍權重）
3. **決定最終答案**：
   - 單一最高票：直接採用
   - 多個最高票（平票）：優先使用房主選擇
   - 無房主選擇：使用第一個最高票選項

### 投票算法

```javascript
// 計算每個選項的票數
const voteCount = {};
answers.forEach((answer, userIndex) => {
  if (answer) {
    const weight = (isHost && userIndex === 0) ? 2 : 1;
    voteCount[answer] = (voteCount[answer] || 0) + weight;
  }
});

// 找出最高票數選項
const maxVotes = Math.max(...Object.values(voteCount));
const maxVotedOptions = Object.entries(voteCount)
  .filter(([_, count]) => count === maxVotes)
  .map(([option]) => option);
```

### 推薦生成流程

1. **民主決策**：通過投票確定群組偏好
2. **餐廳篩選**：使用群組決策結果篩選餐廳
3. **評分排序**：使用相同的 `calculateMatchScore` 函數
4. **結果輸出**：返回按分數排序的推薦列表

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

### 2025-01-20 更新
- **標籤統一**：將所有 "飽足" 標籤統一更新為 "吃飽"
- **資料庫欄位修正**：確認使用正確的資料庫欄位映射
- **邏輯一致性**：統一前後端推薦邏輯
- **嚴格基本匹配**：強化基本條件檢查，不符合所有基本條件的餐廳直接排除（返回0分）
- **辣度篩選修正**：修正前後端 `is_spicy` 欄位名稱不一致問題，確保辣度篩選正常工作
- **辣度欄位擴展**：新增 `'both'` 選項，支援同時提供辣和不辣選擇的餐廳

### 受影響的文件
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