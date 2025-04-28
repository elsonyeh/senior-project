// enhancedRecommendLogic.js
// 優化版餐廳推薦邏輯 - 結合基本問題和趣味問題的標籤權重系統

// 常量定義 - 各種問題類型的權重基礎值
const WEIGHT = {
  BASIC_MATCH: 10,    // 基本問題匹配的權重
  FUN_MATCH: 5,       // 趣味問題匹配的權重
  GROUP_CONSENSUS: 3, // 多人一致性的額外權重
  POPULARITY: 2,      // 餐廳人氣因素的權重
  DISTANCE: 2,        // 距離因素的權重
  RATING: 1.5,        // 評分因素的權重
  MIN_SCORE: 1        // 最低分數，確保所有餐廳至少有機會被推薦
};

// 問題與餐廳標籤對應關係配置
const TAG_MAPPINGS = {
  // 基本問題標籤映射
  basic: {
    "單人": ["一人", "單人", "自助", "快餐"],
    "多人": ["多人", "聚會", "合菜", "團體"],
    "奢華美食": ["高級", "精緻", "奢華", "高價位"],
    "平價美食": ["平價", "便宜", "划算", "小吃"],
    "吃": ["正餐", "主食", "飯", "麵", "肉"],
    "喝": ["飲料", "咖啡", "茶", "酒吧"],
    "辣": ["辣", "麻辣", "川菜", "重口味"],
    "不辣": ["清淡", "溫和", "無辣", "清爽"]
  },
  
  // 趣味問題標籤映射 - 將趣味問題選項映射到可能相關的餐廳標籤
  fun: {
    // 個性偏好相關
    "側背包": ["精緻", "咖啡廳", "文青", "小店"],
    "後背包": ["戶外", "休閒", "活力", "大型"],
    "I": ["安靜", "包廂", "隱私", "小店"],
    "E": ["熱鬧", "活力", "開放", "聚會"],
    
    // 溫度偏好可能連結到食物溫度或環境
    "夏天沒有冷氣": ["冰品", "涼拌", "清爽", "消暑"],
    "冬天只能穿短袖": ["熱湯", "火鍋", "暖和", "熱食"],
    "一生只能喝熱水": ["熱飲", "茶館", "熱食", "湯品"],
    "一生只能喝冰水": ["冰飲", "冰品", "冷食", "清爽"],
    
    // 食物偏好直接關聯
    "愛吃的東西都只能嘗一口": ["精緻", "多樣", "拼盤", "小份"],
    "只能吃不想吃的東西": ["大份", "親民", "家常", "飽足"],
    "黑巧克力": ["苦甜", "成熟", "濃郁", "深度"],
    "白巧克力": ["甜食", "溫和", "輕盈", "甜點"],
    "飯": ["米食", "中式", "家常", "簡餐"],
    "麵": ["麵食", "義式", "拉麵", "快餐"],
    
    // 環境偏好可能連結到餐廳環境
    "一個人在無人島生活": ["安靜", "私密", "包廂", "獨特"],
    "24小時跟一群人待在一起": ["熱鬧", "開放", "聚會", "連鎖"],
    "刺激冒險": ["特色", "異國", "創新", "獨特"],
    "平凡": ["家常", "傳統", "親民", "連鎖"],
    
    // 其他偏好可轉換為餐廳風格
    "會飛": ["頂樓", "景觀", "高處", "開放"],
    "力大無窮": ["大份量", "烤肉", "重口味", "飽足"],
    "消除蚊子": ["室內", "精緻", "空調", "舒適"],
    "消除蟑螂": ["乾淨", "衛生", "明亮", "精緻"],
    "回到過去": ["復古", "傳統", "老店", "經典"],
    "去未來": ["創新", "現代", "科技", "異國"],
    "亞洲": ["亞洲", "日式", "韓式", "中式"],
    "歐洲": ["歐式", "義式", "法式", "西式"],
    "貓派": ["溫馨", "安靜", "文青", "小店"],
    "狗派": ["活力", "戶外", "友善", "開放"],
    "高腳杯": ["酒吧", "精緻", "高級", "西式"],
    "低腳杯": ["居酒屋", "輕鬆", "平價", "親民"]
  }
};

/**
 * 隨機抽取指定數量的趣味問題
 * @param {Array} allQuestions - 所有趣味問題列表
 * @param {Number} count - 需要抽取的問題數量
 * @return {Array} 隨機抽取的問題
 */
export const getRandomFunQuestions = (allQuestions, count = 3) => {
  const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

/**
 * 計算餐廳與用戶答案的匹配分數
 * @param {Object} restaurant - 餐廳資料
 * @param {Array} basicAnswers - 基本問題的答案
 * @param {Array} funAnswers - 趣味問題的答案 
 * @param {Object} groupAnswerCounts - 群組回答統計 (僅多人模式使用)
 * @param {Object} options - 其他選項
 * @return {Number} 匹配分數
 */
const calculateMatchScore = (restaurant, basicAnswers, funAnswers, groupAnswerCounts = null, options = {}) => {
  let score = WEIGHT.MIN_SCORE; // 最低分數
  const userCount = options.userCount || 1;
  
  // 從餐廳數據中獲取所有標籤並標準化
  const restaurantTags = [];
  
  // 處理餐廳標籤 (可能是陣列或字串)
  if (Array.isArray(restaurant.tags)) {
    restaurantTags.push(...restaurant.tags);
  } else if (typeof restaurant.tags === "string") {
    restaurantTags.push(restaurant.tags);
  }
  
  // 處理餐廳類型
  if (restaurant.type) {
    restaurantTags.push(restaurant.type);
  }
  
  // 價格等級標準化: $ -> 低, $$ -> 中, $$$ -> 高
  const priceMap = { "$": "低", "$$": "中", "$$$": "高" };
  const normalizedPrice = priceMap[restaurant.priceRange] || restaurant.priceRange;
  restaurantTags.push(normalizedPrice);
  
  // 處理建議人數
  if (Array.isArray(restaurant.suggestedPeople)) {
    restaurantTags.push(...restaurant.suggestedPeople);
  } else if (typeof restaurant.suggestedPeople === "string") {
    const n = restaurant.suggestedPeople;
    if (n.includes("1")) restaurantTags.push("單人");
    if (n.match(/[2-9]/)) restaurantTags.push("多人");
  }
  
  // 處理辣度
  if (restaurant.isSpicy) {
    restaurantTags.push("辣");
  } else {
    restaurantTags.push("不辣");
  }
  
  // 所有餐廳標籤轉為小寫以方便匹配
  const normalizedTags = restaurantTags.map(tag => String(tag).toLowerCase());
  
  // 計算基本問題匹配分數 - 這些是硬性條件，高權重
  let basicMatchCount = 0;
  
  basicAnswers.forEach(answer => {
    // 從標籤映射中獲取相應的標籤組
    const mappedTags = TAG_MAPPINGS.basic[answer] || [];
    
    // 檢查餐廳是否包含這些標籤
    const matched = mappedTags.some(tag => 
      normalizedTags.some(rTag => rTag.includes(tag.toLowerCase()))
    );
    
    if (matched) {
      score += WEIGHT.BASIC_MATCH;
      basicMatchCount++;
    }
  });
  
  // 如果沒有匹配到任何基本條件，大幅降低總分
  if (basicMatchCount === 0 && basicAnswers.length > 0) {
    score = WEIGHT.MIN_SCORE;
  }
  
  // 計算趣味問題匹配分數 - 這些是軟性條件，中等權重
  funAnswers.forEach(answer => {
    // 從標籤映射中獲取相應的標籤組
    const mappedTags = TAG_MAPPINGS.fun[answer] || [];
    
    // 檢查餐廳是否包含這些標籤，計算匹配程度
    let matchLevel = 0;
    
    mappedTags.forEach(tag => {
      const tagMatches = normalizedTags.filter(rTag => 
        rTag.includes(tag.toLowerCase())
      );
      
      if (tagMatches.length > 0) {
        // 根據匹配到的標籤數量增加匹配等級
        matchLevel += 0.5;
      }
    });
    
    // 將匹配等級轉換為分數
    score += Math.min(matchLevel, 1) * WEIGHT.FUN_MATCH;
  });
  
  // 如果有群組回答計數，加入群組一致性權重
  if (groupAnswerCounts) {
    Object.entries(groupAnswerCounts).forEach(([answer, count]) => {
      // 計算答案在群組中的占比
      const proportion = count / userCount;
      
      // 從標籤映射中獲取相應的標籤組
      const isBasic = answer in TAG_MAPPINGS.basic;
      const mappedTags = isBasic 
        ? TAG_MAPPINGS.basic[answer] || []
        : TAG_MAPPINGS.fun[answer] || [];
      
      // 檢查餐廳是否包含這些標籤
      const matched = mappedTags.some(tag => 
        normalizedTags.some(rTag => rTag.includes(tag.toLowerCase()))
      );
      
      if (matched) {
        // 根據選擇此答案的人數比例增加權重
        // 答案的共識程度越高，權重越大
        const consensusWeight = Math.pow(proportion, 2) * WEIGHT.GROUP_CONSENSUS * userCount;
        score += consensusWeight;
      }
    });
  }
  
  // 加入餐廳本身屬性的分數
  
  // 1. 評分因素: 評分越高，分數越高
  if (typeof restaurant.rating === 'number' && restaurant.rating > 0) {
    // 評分通常為1-5，將其轉換為0-1的比例
    const ratingFactor = Math.min(restaurant.rating / 5, 1);
    score += ratingFactor * WEIGHT.RATING;
  }
  
  // 2. 人氣因素: 瀏覽次數或評價數量越多，分數越高
  if (typeof restaurant.reviews === 'number' && restaurant.reviews > 0) {
    // 假設評價數量通常在0-500之間，將其轉換為0-1的比例
    const reviewsFactor = Math.min(restaurant.reviews / 500, 1);
    score += reviewsFactor * WEIGHT.POPULARITY;
  }
  
  // 3. 喜歡等級: 收藏次數越多，分數越高
  if (typeof restaurant.likes === 'number' && restaurant.likes > 0) {
    // 假設喜歡數量通常在0-100之間，將其轉換為0-1的比例
    const likesFactor = Math.min(restaurant.likes / 100, 1);
    score += likesFactor * WEIGHT.POPULARITY;
  }
  
  // 4. 距離因素: 如果有用戶位置和餐廳位置，可以計算距離
  if (options.userLocation && restaurant.location) {
    // 使用更適合的距離計算方法
    const distance = calculateDistance(options.userLocation, restaurant.location);
    
    // 假設可接受的最大距離為10公里，將距離轉換為0-1的比例 (距離越近，分數越高)
    const distanceFactor = Math.max(0, 1 - distance / 10);
    score += distanceFactor * WEIGHT.DISTANCE;
  }
  
  // 5. 特殊條件調整: 如果特別符合某些特殊條件，額外加分
  // 例如: 符合所有基本問題和大部分趣味問題
  if (basicMatchCount === basicAnswers.length && 
      basicAnswers.length > 0) {
    // 完全符合基本問題的額外獎勵
    score += WEIGHT.BASIC_MATCH * 0.5;
  }
  
  return score;
};

/**
 * 根據用戶回答推薦餐廳
 * @param {Array} answers - 用戶的回答
 * @param {Array} restaurants - 所有餐廳列表
 * @param {Object} options - 配置選項
 * @return {Array} 排序後的推薦餐廳列表
 */
export const recommendRestaurants = (answers, restaurants, options = {}) => {
  if (!Array.isArray(restaurants) || restaurants.length === 0) {
    return [];
  }
  
  // 基本問題答案 - 通常是前5個(或根據實際情況)
  const basicQuestionsCount = options.basicQuestionsCount || 5;
  const basicAnswers = answers.slice(0, basicQuestionsCount);
  
  // 趣味問題答案 - 剩餘的答案
  const funAnswers = answers.slice(basicQuestionsCount);
  
  // 計算每個餐廳的分數
  const scoredRestaurants = restaurants.map(restaurant => {
    const score = calculateMatchScore(
      restaurant, 
      basicAnswers,
      funAnswers, 
      options.groupAnswerCounts,
      options
    );
    
    return {
      ...restaurant,
      matchScore: score
    };
  });
  
  // 按分數降序排序
  const sortedRestaurants = scoredRestaurants.sort((a, b) => b.matchScore - a.matchScore);
  
  // 返回分數大於最低門檻的餐廳 (預設最低分數的2倍)
  const minScoreThreshold = options.minScoreThreshold || (WEIGHT.MIN_SCORE * 2);
  return sortedRestaurants.filter(r => r.matchScore >= minScoreThreshold);
};

/**
 * 根據多個用戶的答案生成群組推薦餐廳
 * @param {Object} allUserAnswers - 所有用戶的答案 {userId: [answers]}
 * @param {Array} restaurants - 所有餐廳列表
 * @param {Object} options - 配置選項
 * @return {Array} 排序後的推薦餐廳列表
 */
export const recommendForGroup = (allUserAnswers, restaurants, options = {}) => {
  if (!allUserAnswers || Object.keys(allUserAnswers).length === 0) {
    return [];
  }
  
  // 統計每個答案被選擇的次數
  const answerCounts = {};
  const basicQuestionsCount = options.basicQuestionsCount || 5;
  
  // 處理所有用戶的答案
  Object.values(allUserAnswers).forEach(userAnswers => {
    if (Array.isArray(userAnswers)) {
      userAnswers.forEach((answer, index) => {
        // 確保答案是字符串並且有效
        if (answer) {
          answerCounts[answer] = (answerCounts[answer] || 0) + 1;
        }
      });
    }
  });
  
  // 合併所有用戶的答案
  const mergedAnswers = [];
  const userCount = Object.keys(allUserAnswers).length;
  
  // 處理基本問題 - 採用多數決
  for (let i = 0; i < basicQuestionsCount; i++) {
    const answersForThisQuestion = {};
    
    // 收集針對此問題的所有答案
    Object.values(allUserAnswers).forEach(userAnswers => {
      if (Array.isArray(userAnswers) && userAnswers[i]) {
        answersForThisQuestion[userAnswers[i]] = (answersForThisQuestion[userAnswers[i]] || 0) + 1;
      }
    });
    
    // 找出最多人選擇的答案
    let maxCount = 0;
    let majorityAnswer = null;
    
    Object.entries(answersForThisQuestion).forEach(([answer, count]) => {
      if (count > maxCount) {
        maxCount = count;
        majorityAnswer = answer;
      }
    });
    
    if (majorityAnswer) {
      mergedAnswers.push(majorityAnswer);
      
      // 如果有超過半數選擇，則提高此答案的權重
      if (maxCount > userCount / 2) {
        // 增加一個權重因子，表示多數人的共識
        answerCounts[majorityAnswer] = (answerCounts[majorityAnswer] || 0) + Math.floor(maxCount / userCount * WEIGHT.GROUP_CONSENSUS);
      }
    }
  }
  
  // 處理趣味問題 - 採用興趣聚合算法
  // 將所有趣味問題的答案按受歡迎程度排序
  const funAnswersByPopularity = {};
  
  Object.values(allUserAnswers).forEach(userAnswers => {
    if (Array.isArray(userAnswers)) {
      const funAnswers = userAnswers.slice(basicQuestionsCount);
      funAnswers.forEach(answer => {
        if (answer) {
          funAnswersByPopularity[answer] = (funAnswersByPopularity[answer] || 0) + 1;
        }
      });
    }
  });
  
  // 選擇前3個最受歡迎的趣味答案
  const popularFunAnswers = Object.entries(funAnswersByPopularity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(entry => entry[0]);
  
  mergedAnswers.push(...popularFunAnswers);
  
  // 使用增強的推薦邏輯
  return recommendRestaurants(mergedAnswers, restaurants, {
    ...options,
    groupAnswerCounts: answerCounts,
    userCount: userCount
  });
};

/**
 * 計算兩個座標點之間的距離 (公里)
 * @param {Object} coord1 - 第一個座標，格式 {lat, lng}
 * @param {Object} coord2 - 第二個座標，格式 {lat, lng}
 * @return {Number} 以公里為單位的距離
 */
function calculateDistance(coord1, coord2) {
  // 如果缺少座標數據，返回一個很大的值表示無法計算
  if (!coord1 || !coord2 || !coord1.lat || !coord1.lng || !coord2.lat || !coord2.lng) {
    return 999999;
  }
  
  // 使用球面三角法計算距離 (Haversine公式)
  const R = 6371; // 地球半徑，單位為公里
  const dLat = degreesToRadians(coord2.lat - coord1.lat);
  const dLon = degreesToRadians(coord2.lng - coord1.lng);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(degreesToRadians(coord1.lat)) * Math.cos(degreesToRadians(coord2.lat)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * 將度數轉換為弧度
 * @param {Number} degrees - 角度值 (度)
 * @return {Number} 弧度值
 */
function degreesToRadians(degrees) {
  return degrees * (Math.PI/180);
}

// 為了與舊版推薦邏輯兼容，保留原有函數名稱和參數
export const getRandomTen = (arr) => {
  if (!arr || arr.length <= 10) return arr || [];
  return [...arr].sort(() => 0.5 - Math.random()).slice(0, 10);
};