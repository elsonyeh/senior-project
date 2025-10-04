# SwiftTaste 推薦系統診斷報告

## 問題現象
未打亂順序時，推薦餐廳會：
1. 都是最新新增的餐廳
2. 按照新增順序顯示
3. 懷疑推薦系統未正常運作

## 根本原因分析

### 1. 資料載入順序
```javascript
// restaurantService.js: line 29
.order('created_at', { ascending: false })
```
- 餐廳從資料庫載入時，預設按 `created_at` **降序**排列
- **結果**：新增的餐廳在陣列最前面

### 2. 分數計算與排序邏輯

**完整推薦流程：**
```javascript
// SwiftTaste.jsx: line 707-728

// 步驟1: 過濾掉不符合基本條件的餐廳（分數為0）
const qualifiedRestaurants = scoredRestaurants.filter(r =>
  r.calculatedScore > 0 && r.calculatedScore >= WEIGHT.MIN_SCORE
);

// 步驟2: 按分數由高到低排序
const sortedRestaurants = qualifiedRestaurants.length > 0 ?
  qualifiedRestaurants.sort((a, b) => b.calculatedScore - a.calculatedScore) :
  scoredRestaurants.sort((a, b) => b.calculatedScore - a.calculatedScore);

// 步驟3: 選出分數最高的前10名
const topTen = sortedRestaurants.slice(0, 10);

// 步驟4: 使用 Fisher-Yates 洗牌算法打亂前10名的順序
const shuffled = [...topTen];
for (let i = shuffled.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
}

// 步驟5: 顯示給用戶
setFilteredRestaurants(shuffled);
```

#### 關鍵特性：
- **嚴格篩選**：只有符合所有基本條件的餐廳才會被納入排序
- **分數優先**：按計算分數（基本 + 趣味 + 評分 + 獎勵）由高到低排序
- **Top 10**：只選出分數最高的前 10 家餐廳
- **隨機順序**：打亂 Top 10 避免每次都看到相同順序

### 3. 為什麼分數會相同？

#### 分數計算公式：
```javascript
const WEIGHT = {
  BASIC_MATCH: 10,      // 基本匹配
  FUN_MATCH: 5,         // 趣味匹配
  RATING: 1.5,          // 評分權重
  MIN_SCORE: 1          // 最低分數
};
```

#### 典型場景：
假設用戶選擇：
- 基本問題：單人、平價美食、吃、吃飽、不辣
- 趣味問題：3個問題

**情況1：只有基本匹配的餐廳**
- 餐廳A：符合所有5個基本條件 = 10 × 5 + 5(獎勵) + 1.5(評分) = **56.5分**
- 餐廳B：符合所有5個基本條件 = 10 × 5 + 5(獎勵) + 1.2(評分) = **56.2分**
- 餐廳C：符合所有5個基本條件 = 10 × 5 + 5(獎勵) + 1.5(評分) = **56.5分**

**結果**：A 和 C 分數相同（56.5），會按原始順序排列

**情況2：趣味問題加成**
- 如果沒有趣味問題匹配標籤，很多餐廳的趣味分數都是 0
- 導致大量餐廳只有基本分數 + 評分
- 評分差異很小（1-5星 × 1.5 = 最多1.5分差距）

### 4. 價格範圍匹配邏輯（已修正）

#### Price Range 匹配：
```javascript
case "平價美食":
  matched = price_range === 1 || price_range === 2;

case "奢華美食":
  matched = price_range === 3 || price_range === 2;
```

**設計理念**：
- `price_range === 1`：純平價，只匹配「平價美食」
- `price_range === 2`：中價位，**同時匹配**「平價美食」和「奢華美食」
- `price_range === 3`：奢華，只匹配「奢華美食」
- 確保推薦結果穩定，不受隨機因素影響

**歷史問題（已修正）**：
- 舊版使用 `Math.random()` 導致每次計算分數時結果不穩定
- 2025-01 修正：移除隨機性，改為確定性匹配邏輯

### 5. 「吃」和「喝」類型匹配邏輯

#### 統一標籤匹配：
```javascript
case "吃":
case "喝":
  const safeAnswer = String(answer || '').toLowerCase();
  matched = safeAnswer.length > 0 && normalizedTags.some(tag =>
    tag && typeof tag === 'string' && tag.includes(safeAnswer)
  );
  if (matched) {
    score += WEIGHT.BASIC_MATCH;
    basicMatchCount++;
  }
  break;
```

**設計理念**：
- 使用標籤匹配系統：檢查餐廳標籤中是否包含「吃」或「喝」
- 避免重複加分：在 switch 內直接處理加分邏輯
- 分量匹配：「吃一點」和「吃飽」計入匹配數量但不額外加分（已透過「吃」匹配）

**「喝」類型特殊處理**：
- 選擇「喝」時，不包含分量選項（吃一點/吃飽）
- basicAnswers 只包含：人數、價格、類型（喝）、辣度

## 推薦系統運作流程總結

### 完整步驟（SwiftTaste.jsx: line 560-728）

**1. 計算所有餐廳分數**
```javascript
const scoredRestaurants = await Promise.all(restaurants.map(async (restaurant) => {
  let score = WEIGHT.MIN_SCORE; // 基礎分 1 分
  let basicMatchCount = 0;

  // 1.1 基本條件匹配（人數、價格、類型、分量、辣度）
  basicAnswers.forEach(answer => {
    if (matched) {
      score += WEIGHT.BASIC_MATCH; // 每項 +10 分
      basicMatchCount++;
    }
  });

  // 1.2 嚴格篩選：不符合所有基本條件 → 分數歸零
  if (basicMatchCount < basicAnswers.length) {
    return { ...restaurant, calculatedScore: 0 };
  }

  // 1.3 趣味問題匹配（標籤匹配系統）
  const funMatchScore = await funQuestionTagService.calculateBatchMatchScore(funAnswers, tags);
  score += funMatchScore * WEIGHT.FUN_MATCH; // +5 分 × 匹配度

  // 1.4 評分加成
  score += (rating / 5) * WEIGHT.RATING; // 最高 +1.5 分

  // 1.5 完全匹配獎勵
  if (basicMatchCount === basicAnswers.length) {
    score += WEIGHT.BASIC_MATCH * 0.5; // +5 分
  }

  return { ...restaurant, calculatedScore: score };
}));
```

**2. 過濾不合格餐廳**
```javascript
const qualifiedRestaurants = scoredRestaurants.filter(r =>
  r.calculatedScore > 0 && r.calculatedScore >= WEIGHT.MIN_SCORE
);
```

**3. 按分數排序**
```javascript
const sortedRestaurants = qualifiedRestaurants.sort((a, b) =>
  b.calculatedScore - a.calculatedScore
);
```

**4. 選出分數最高的前10名**
```javascript
const topTen = sortedRestaurants.slice(0, 10);
```

**5. Fisher-Yates 洗牌打亂順序**
```javascript
const shuffled = [...topTen];
for (let i = shuffled.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
}
```

**6. 顯示給用戶**
```javascript
setFilteredRestaurants(shuffled); // 最終推薦的 10 家餐廳
```

### 為什麼需要打亂？

- **Fisher-Yates 洗牌**：確保每個排列的機率相同
- **避免排序偏見**：即使分數相同，也不會總是顯示相同順序
- **用戶體驗**：每次推薦都有新鮮感，增加探索樂趣
- **公平性**：分數相同的餐廳獲得均等的曝光機會

## 推薦系統運作狀態

### ✅ 推薦系統**正常運作**

**核心特性：**

1. **嚴格基本條件篩選**
   - 必須符合所有基本問題答案（人數、價格、類型、分量、辣度）
   - 不符合任一條件 → 分數歸零 → 被排除

2. **多維度分數計算**
   - 基本匹配：每項 10 分（最高 50 分）
   - 趣味匹配：標籤匹配度 × 5 分（最高約 5 分）
   - 評分加成：餐廳評分 / 5 × 1.5（最高 1.5 分）
   - 完全匹配獎勵：5 分

3. **Top 10 機制**
   - 從所有符合條件的餐廳中，選出**分數最高的前 10 家**
   - 打亂這 10 家的順序後顯示
   - 確保推薦品質（高分）+ 探索樂趣（隨機）

4. **分數區分度**
   - 主要差異來源：趣味問題匹配度 + 餐廳評分
   - 基本條件相同的餐廳，分數可能接近（差距 1-6 分）
   - 打亂順序確保分數相近的餐廳獲得均等曝光

## 建議改進方案

### 選項1：增加分數區分度
```javascript
// 加入更多差異化因素
- 距離權重
- 人氣度權重（收藏數、點擊數）
- 新鮮度衰減（避免總是推薦新餐廳）
```

### 選項2：改進趣味問題標籤
- 確保每家餐廳都有足夠的標籤
- 提高趣味問題匹配的權重

### 選項3：維持現狀 + 打亂
- 接受「符合條件的餐廳分數相近」的現實
- 用打亂確保公平性
- **這是目前採用的方案**

## 結論

### ✅ 推薦系統完整且正確運作

**推薦流程（已驗證）：**
1. ✅ 計算所有餐廳分數（基本 + 趣味 + 評分 + 獎勵）
2. ✅ 嚴格篩選：只保留符合所有基本條件的餐廳
3. ✅ 按分數排序：由高到低
4. ✅ **選出 Top 10**：分數最高的前 10 家
5. ✅ Fisher-Yates 洗牌：打亂順序
6. ✅ 顯示給用戶：最終推薦的 10 家餐廳

**設計優勢：**
- **品質保證**：只推薦分數最高的 10 家餐廳
- **探索樂趣**：每次推薦順序隨機，增加新鮮感
- **公平曝光**：分數相近的餐廳獲得均等機會
- **用戶體驗**：避免「總是看到同樣的餐廳」

**關鍵修正記錄：**

**2025-01-04：移除隨機性與統一匹配邏輯**
- 移除 `Math.random()` 隨機價格匹配，改為確定性邏輯
- 統一「吃」和「喝」的標籤匹配邏輯
- 修正加分機制避免重複計分
- 確保 SwiftTaste 和 RecommendationTester 邏輯完全一致

**2025-01-03：修正 Top 10 選取問題**
- 修正了排序後未正確取 Top 10 的問題
- 確保推薦的餐廳都是**分數最高的前 10 家**，而非所有符合條件的餐廳
