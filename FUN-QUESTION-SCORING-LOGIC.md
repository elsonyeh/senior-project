# 趣味問題評分邏輯詳解

## 概述
趣味問題使用**標籤匹配系統**來計算分數，透過 `funQuestionTagService` 將使用者選擇的趣味問題選項對應到餐廳標籤，計算匹配度。

## 資料結構

### 1. 趣味問題標籤映射表
儲存在 Supabase `fun_question_option_tags` 表：

```javascript
{
  option_text: "側背包",    // 選項文字
  tag_name: "精緻",         // 對應的餐廳標籤
  weight: 1.0              // 權重（0-1）
}
```

### 2. 快取映射格式
```javascript
tagsMap = {
  "側背包": {
    tags: ["精緻", "咖啡廳", "文青", "小店", "現代", "簡約", "工業"],
    weights: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
  },
  "後背包": {
    tags: ["戶外", "休閒", "活力", "大型", "鄉村", "舊", "熱情"],
    weights: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
  },
  // ...
}
```

## 評分邏輯

### 步驟1: 載入標籤映射
```javascript
// funQuestionTagService.js: line 151-156
const tagsMap = await this.getFunQuestionTagsMap();
```

- 首次載入從資料庫讀取 `fun_question_tags_view`
- 之後使用快取 `cachedTagsMap`
- 載入失敗時使用 fallback 硬編碼映射

### 步驟2: 單一選項匹配分數計算
```javascript
// funQuestionTagService.js: line 105-143
async calculateMatchScore(optionText, restaurantTags, tagsMap = null) {
  // 1. 獲取選項的標籤和權重
  let optionTags = [
    { tag: "精緻", weight: 1.0 },
    { tag: "咖啡廳", weight: 1.0 },
    // ...
  ];

  // 2. 正規化餐廳標籤（轉小寫）
  const normalizedRestaurantTags = restaurantTags
    .filter(Boolean)
    .map(tag => String(tag).toLowerCase());

  // 3. 計算匹配權重
  let totalWeight = 0;      // 總權重
  let matchedWeight = 0;    // 匹配的權重

  optionTags.forEach(({ tag, weight }) => {
    totalWeight += weight;  // 累加所有標籤權重

    // 使用 includes 進行模糊匹配
    if (normalizedRestaurantTags.some(rTag => rTag.includes(tag.toLowerCase()))) {
      matchedWeight += weight;  // 匹配時累加權重
    }
  });

  // 4. 返回匹配比例 (0-1)
  return totalWeight > 0 ? matchedWeight / totalWeight : 0;
}
```

### 步驟3: 批量計算（多個選項）
```javascript
// funQuestionTagService.js: line 151-168
async calculateBatchMatchScore(optionTexts, restaurantTags) {
  let totalScore = 0;

  // 計算每個選項的匹配分數
  for (const optionText of optionTexts) {
    const score = await this.calculateMatchScore(optionText, restaurantTags, tagsMap);
    totalScore += score;
  }

  // 返回平均分數 (0-1)
  return totalScore / optionTexts.length;
}
```

### 步驟4: 套用權重到最終分數
```javascript
// SwiftTaste.jsx: line 680-692
const WEIGHT = {
  FUN_MATCH: 5  // 趣味問題權重
};

if (funAnswers.length > 0) {
  const funMatchScore = await funQuestionTagService.calculateBatchMatchScore(
    funAnswers,
    restaurantTags
  );

  // 平均匹配分數 (0-1) × 5
  score += funMatchScore * WEIGHT.FUN_MATCH;
}
```

## 計分範例

### 範例1: 單一趣味問題

**用戶選擇**: "側背包"
**選項標籤**: ["精緻", "咖啡廳", "文青", "小店", "現代", "簡約", "工業"] (7個標籤，各權重1.0)

#### 餐廳A的標籤: ["精緻", "咖啡廳", "甜點"]
```
totalWeight = 7.0
matchedWeight = 2.0 (精緻 + 咖啡廳)
匹配分數 = 2.0 / 7.0 = 0.286
最終加分 = 0.286 × 5 = 1.43 分
```

#### 餐廳B的標籤: ["精緻", "咖啡廳", "文青", "現代"]
```
totalWeight = 7.0
matchedWeight = 4.0
匹配分數 = 4.0 / 7.0 = 0.571
最終加分 = 0.571 × 5 = 2.86 分
```

#### 餐廳C的標籤: ["快餐", "平價"]
```
totalWeight = 7.0
matchedWeight = 0
匹配分數 = 0 / 7.0 = 0
最終加分 = 0 × 5 = 0 分
```

### 範例2: 多個趣味問題

**用戶選擇**: ["側背包", "Ｉ人", "貓派"] (3個問題)

#### 餐廳A的標籤: ["精緻", "安靜", "小店", "貓"]
```
側背包匹配: 2/7 = 0.286 (精緻, 小店)
Ｉ人匹配: 3/9 = 0.333 (安靜, 小店, 簡約)
貓派匹配: 4/11 = 0.364 (貓, 簡約, 安靜, 小店)

平均分數 = (0.286 + 0.333 + 0.364) / 3 = 0.328
最終加分 = 0.328 × 5 = 1.64 分
```

#### 餐廳B的標籤: ["熱鬧", "大型", "狗", "活力"]
```
側背包匹配: 0/7 = 0
Ｉ人匹配: 0/9 = 0
貓派匹配: 0/11 = 0

平均分數 = 0
最終加分 = 0 分
```

## 完整分數計算公式

```javascript
總分 = MIN_SCORE (1分)
     + 基本匹配分數 (10分 × 匹配數量)
     + 趣味匹配分數 (5分 × 平均匹配度)
     + 評分加成 (最高1.5分)
     + 完全匹配獎勵 (5分，當所有基本條件符合)
```

### 實例計算

**用戶選擇**:
- 基本: 單人、平價、吃、吃飽、不辣 (5項全符合)
- 趣味: 側背包、Ｉ人、貓派

**餐廳分數**:
```
餐廳A (標籤: 精緻, 安靜, 小店, 貓, 咖啡廳, 簡約):
  = 1 (基礎分)
  + 50 (基本匹配 10×5)
  + 1.64 (趣味匹配，平均0.328×5)
  + 1.5 (評分5星)
  + 5 (完全匹配獎勵)
  = 59.14 分

餐廳B (標籤: 熱鬧, 大型, 狗, 活力):
  = 1 (基礎分)
  + 50 (基本匹配 10×5)
  + 0 (趣味不匹配)
  + 1.2 (評分4星)
  + 5 (完全匹配獎勵)
  = 57.2 分
```

**差距**: 1.94 分（主要來自趣味問題）

## 關鍵特性

### 1. 模糊匹配
```javascript
// 使用 includes 進行部分匹配
rTag.includes(tag.toLowerCase())
```
- "精緻咖啡廳" 可以匹配 "精緻" 和 "咖啡廳"
- "現代簡約" 可以匹配 "現代" 和 "簡約"

### 2. 權重系統
- 每個標籤可設定不同權重（目前全為1.0）
- 未來可調整重要標籤的權重

### 3. 平均分數
- 多個趣味問題取**平均值**，避免問題數量影響
- 3個問題和5個問題的權重相同

### 4. 快取機制
- 首次載入後快取映射表
- 減少資料庫查詢
- 可用 `clearCache()` 重新載入

## 為什麼趣味分數可能都是0？

### 原因1: 餐廳標籤不完整
```javascript
// 餐廳只有基本標籤
restaurant.tags = ["平價", "吃飽", "不辣"]
// 沒有任何趣味標籤（精緻、咖啡廳、安靜等）
→ 所有趣味問題匹配分數 = 0
```

### 原因2: 標籤名稱不一致
```javascript
// 選項標籤: "咖啡廳"
// 餐廳標籤: "cafe" 或 "咖啡店"
→ 無法匹配
```

### 原因3: 映射表缺失
```javascript
// 新增趣味問題但未設定標籤映射
getFunQuestionTagsMap() → 該選項不存在
→ 返回 0 分
```

## 改進建議

### 1. 確保餐廳有趣味標籤
```sql
-- 檢查沒有趣味標籤的餐廳
SELECT name, tags
FROM restaurants
WHERE NOT (
  tags @> ARRAY['精緻'] OR
  tags @> ARRAY['咖啡廳'] OR
  tags @> ARRAY['安靜'] OR
  tags @> ARRAY['熱鬧']
  -- ... 其他趣味標籤
);
```

### 2. 標籤標準化
- 統一標籤命名（咖啡廳 vs cafe）
- 建立標籤同義詞表

### 3. 調整權重
```javascript
// 為重要標籤設定更高權重
{
  "側背包": {
    tags: ["精緻", "咖啡廳", "文青"],
    weights: [1.5, 1.5, 1.0]  // 精緻和咖啡廳權重較高
  }
}
```

### 4. 增加趣味分數權重
```javascript
const WEIGHT = {
  FUN_MATCH: 10  // 從5增加到10
};
```

## 總結

趣味問題評分系統**確實在運作**，但效果取決於：
1. 餐廳是否有完整的趣味標籤
2. 標籤映射表是否涵蓋所有選項
3. 標籤命名是否一致

當餐廳缺少趣味標籤時，趣味分數為0，餐廳只能靠**基本匹配**和**評分**區分，導致分數集中。
