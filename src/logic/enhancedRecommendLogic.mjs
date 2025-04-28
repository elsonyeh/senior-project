// enhancedRecommendLogic.js
// 優化版餐廳推薦邏輯 - 使用屬性匹配並支援新增問題

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

// 距離閾值 (公里)
const DISTANCE_THRESHOLDS = {
  NEAR: 2,   // 2公里以內算"附近"
  MEDIUM: 5, // 2-5公里算一般距離
  FAR: 10    // 5公里以上算"遠"
};

// 問題與餐廳標籤對應關係配置 - 僅用於趣味問題
const TAG_MAPPINGS = {
  // 基本問題標籤映射 - 保留用於向後兼容
  basic: {
    "單人": ["一人", "單人", "自助", "快餐"],
    "多人": ["多人", "聚會", "合菜", "團體"],
    "奢華美食": ["高級", "精緻", "奢華", "高價位"],
    "平價美食": ["平價", "便宜", "划算", "小吃"],
    "吃": ["正餐", "主食", "飯", "麵", "肉"],
    "喝": ["飲料", "咖啡", "茶", "酒吧"],
    "吃一點": ["小點", "輕食", "下午茶", "點心"],
    "吃飽": ["合菜", "主食", "大份", "飽足"],
    "附近吃": ["便利", "快速", "附近"],
    "遠一點": ["特色", "值得", "遠赴"],
    "辣": ["辣", "麻辣", "川菜", "重口味"],
    "不辣": ["清淡", "溫和", "無辣", "清爽"]
  },
  
  // 趣味問題標籤映射 - 未變更
  fun: {
    // 個性偏好相關
    "側背包": ["精緻", "咖啡廳", "文青", "小店"],
    "後背包": ["戶外", "休閒", "活力", "大型"],
    "I人": ["安靜", "包廂", "隱私", "小店"],
    "E人": ["熱鬧", "活力", "開放", "聚會"],
    
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
 * 計算餐廳與用戶答案的匹配分數 - 使用屬性而非標籤進行基本問題匹配
 * @param {Object} restaurant - 餐廳資料
 * @param {Array} basicAnswers - 基本問題的答案
 * @param {Array} basicQuestions - 基本問題列表（包含問題文本）
 * @param {Array} funAnswers - 趣味問題的答案 
 * @param {Object} groupAnswerCounts - 群組回答統計 (僅多人模式使用)
 * @param {Object} options - 其他選項
 * @return {Number} 匹配分數
 */
const calculateMatchScore = (restaurant, basicAnswers, basicQuestions, funAnswers, groupAnswerCounts = null, options = {}) => {
  let score = WEIGHT.MIN_SCORE; // 最低分數
  const userCount = options.userCount || 1;
  const strictBasicMatch = options.strictBasicMatch === true;
  
  if (!restaurant) return score;
  
  // 從餐廳數據中獲取屬性
  const { priceRange, type, isSpicy, suggestedPeople, tags, rating, reviews, likes, location } = restaurant;
  
  // 將 type 字符串轉換為標準化數組，便於匹配
  const restaurantType = type ? type.split(/[,、，]/).map(t => t.trim()) : [];
  
  // 用於趣味問題匹配的標籤集合
  const restaurantTags = [];
  
  // 處理餐廳標籤 (可能是陣列或字串)
  if (Array.isArray(tags)) {
    restaurantTags.push(...tags);
  } else if (typeof tags === "string") {
    restaurantTags.push(tags);
  }
  
  // 處理餐廳類型也加入標籤集合
  if (Array.isArray(restaurantType) && restaurantType.length > 0) {
    restaurantTags.push(...restaurantType);
  }
  
  // 將標籤轉為小寫以便匹配
  const normalizedTags = restaurantTags.map(tag => String(tag).toLowerCase());
  
  // 計算基本問題匹配分數 - 使用屬性而非標籤
  let basicMatchCount = 0;
  let basicMismatchCount = 0;
  
  // 取得問題文本與答案的映射，用於條件問題判斷
  const answersMap = {};
  if (Array.isArray(basicQuestions) && Array.isArray(basicAnswers)) {
    basicQuestions.forEach((question, index) => {
      if (index < basicAnswers.length && question && question.question) {
        answersMap[question.question] = basicAnswers[index];
      }
    });
  }

  if (Array.isArray(basicAnswers) && Array.isArray(basicQuestions)) {
    basicAnswers.forEach((answer, index) => {
      // 跳過空答案或超出範圍的索引
      if (!answer || index >= basicQuestions.length) return;
      
      const question = basicQuestions[index];
      
      // 跳過條件問題，如果條件不滿足
      if (question.conditionalOn) {
        const condQuestion = question.conditionalOn.question;
        const condAnswer = question.conditionalOn.answer;
        
        // 如果條件問題沒有得到指定答案，則跳過此問題
        if (answersMap[condQuestion] !== condAnswer) {
          return;
        }
      }
      
      let matched = false;
      
      // 根據不同問題類型使用不同的屬性進行匹配
      switch (answer) {
        case '奢華美食':
          matched = priceRange === '$$$' || priceRange === '$$';
          break;
        case '平價美食':
          matched = priceRange === '$' || (priceRange === '$$' && Math.random() > 0.5); // $$ 算半個平價
          break;
        case '吃':
          const foodTypes = ['餐廳', '正餐', '自助', '小吃', '麵', '飯', '肉'];
          const drinkTypes = ['飲料', '咖啡', '茶', '酒吧'];
          
          matched = restaurantType.some(t => foodTypes.includes(t)) &&
                   !restaurantType.some(t => drinkTypes.includes(t));
          break;
        case '喝':
          const drinkTypesList = ['飲料', '咖啡', '茶', '酒吧'];
          
          matched = restaurantType.some(t => drinkTypesList.includes(t));
          break;
        case '吃一點':
          // 使用標籤匹配輕食、小點心類餐廳
          const lightFoodTags = ['輕食', '點心', '下午茶', '小點', '小吃'];
          matched = normalizedTags.some(tag => 
            lightFoodTags.some(t => tag.includes(t.toLowerCase()))
          );
          break;
        case '吃飽':
          // 使用標籤匹配大份量、正餐類餐廳
          const bigMealTags = ['主食', '大份', '飽足', '套餐', '合菜'];
          matched = normalizedTags.some(tag => 
            bigMealTags.some(t => tag.includes(t.toLowerCase()))
          );
          break;
        case '附近吃':
          // 使用距離判斷，2公里以內算附近
          if (options.userLocation && location) {
            const distance = calculateDistance(options.userLocation, location);
            matched = distance <= DISTANCE_THRESHOLDS.NEAR;
          } else {
            // 如果沒有位置信息，使用標籤匹配
            const nearbyTags = ['附近', '便利', '快速'];
            matched = normalizedTags.some(tag => 
              nearbyTags.some(t => tag.includes(t.toLowerCase()))
            );
          }
          break;
        case '遠一點':
          // 使用距離判斷，5公里以上算遠一點
          if (options.userLocation && location) {
            const distance = calculateDistance(options.userLocation, location);
            matched = distance >= DISTANCE_THRESHOLDS.MEDIUM;
          } else {
            // 如果沒有位置信息，使用標籤匹配
            const farTags = ['特色', '值得', '遠赴'];
            matched = normalizedTags.some(tag => 
              farTags.some(t => tag.includes(t.toLowerCase()))
            );
          }
          break;
        case '辣':
          matched = isSpicy === true;
          break;
        case '不辣':
          matched = isSpicy === false;
          break;
        case '單人':
          matched = suggestedPeople && 
                   (suggestedPeople.includes('1') || 
                   (suggestedPeople.includes('~') && 
                   parseInt(suggestedPeople.split('~')[0]) <= 1));
          break;
        case '多人':
          matched = suggestedPeople && 
                   (suggestedPeople.includes('~') && 
                   parseInt(suggestedPeople.split('~')[1]) > 1);
          break;
        default:
          // 對於其他可能的答案，仍使用標籤匹配
          const mappedTags = TAG_MAPPINGS.basic[answer] || [];
          matched = mappedTags.some(tag => 
            normalizedTags.some(rTag => rTag.includes(tag.toLowerCase()))
          );
      }
      
      if (matched) {
        score += WEIGHT.BASIC_MATCH;
        basicMatchCount++;
      } else {
        basicMismatchCount++;
      }
    });
  }
  
  // 如果啟用嚴格匹配基本問題，當有不匹配時直接返回最低分數
  if (strictBasicMatch && basicMismatchCount > 0) {
    return WEIGHT.MIN_SCORE;
  }
  
  // 如果沒有匹配到任何基本條件，大幅降低總分
  if (basicMatchCount === 0 && basicAnswers.length > 0) {
    score = WEIGHT.MIN_SCORE;
  }
  
  // 計算趣味問題匹配分數 - 仍使用標籤匹配
  if (Array.isArray(funAnswers)) {
    funAnswers.forEach(answer => {
      if (!answer) return; // 跳過空答案
      
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
  }
  
  // 如果有群組回答計數，加入群組一致性權重
  if (groupAnswerCounts) {
    Object.entries(groupAnswerCounts).forEach(([answer, count]) => {
      // 計算答案在群組中的占比
      const proportion = count / userCount;
      
      // 檢查是否為基本問題答案
      let matched = false;
      
      // 根據不同問題類型使用不同的屬性進行匹配
      switch (answer) {
        case '奢華美食':
          matched = priceRange === '$$$' || priceRange === '$$';
          break;
        case '平價美食':
          matched = priceRange === '$' || (priceRange === '$$' && Math.random() > 0.5);
          break;
        case '吃':
          const foodTypes = ['餐廳', '正餐', '自助', '小吃', '麵', '飯', '肉'];
          const drinkTypes = ['飲料', '咖啡', '茶', '酒吧'];
          
          matched = restaurantType.some(t => foodTypes.includes(t)) &&
                   !restaurantType.some(t => drinkTypes.includes(t));
          break;
        case '喝':
          const drinkTypesList = ['飲料', '咖啡', '茶', '酒吧'];
          
          matched = restaurantType.some(t => drinkTypesList.includes(t));
          break;
        case '吃一點':
          const lightFoodTags = ['輕食', '點心', '下午茶', '小點', '小吃'];
          matched = normalizedTags.some(tag => 
            lightFoodTags.some(t => tag.includes(t.toLowerCase()))
          );
          break;
        case '吃飽':
          const bigMealTags = ['主食', '大份', '飽足', '套餐', '合菜'];
          matched = normalizedTags.some(tag => 
            bigMealTags.some(t => tag.includes(t.toLowerCase()))
          );
          break;
        case '附近吃':
          if (options.userLocation && location) {
            const distance = calculateDistance(options.userLocation, location);
            matched = distance <= DISTANCE_THRESHOLDS.NEAR;
          } else {
            const nearbyTags = ['附近', '便利', '快速'];
            matched = normalizedTags.some(tag => 
              nearbyTags.some(t => tag.includes(t.toLowerCase()))
            );
          }
          break;
        case '遠一點':
          if (options.userLocation && location) {
            const distance = calculateDistance(options.userLocation, location);
            matched = distance >= DISTANCE_THRESHOLDS.MEDIUM;
          } else {
            const farTags = ['特色', '值得', '遠赴'];
            matched = normalizedTags.some(tag => 
              farTags.some(t => tag.includes(t.toLowerCase()))
            );
          }
          break;
        case '辣':
          matched = isSpicy === true;
          break;
        case '不辣':
          matched = isSpicy === false;
          break;
        case '單人':
          matched = suggestedPeople && 
                   (suggestedPeople.includes('1') || 
                   (suggestedPeople.includes('~') && 
                   parseInt(suggestedPeople.split('~')[0]) <= 1));
          break;
        case '多人':
          matched = suggestedPeople && 
                   (suggestedPeople.includes('~') && 
                   parseInt(suggestedPeople.split('~')[1]) > 1);
          break;
        default:
          // 檢查是否為基本問題答案
          if (answer in TAG_MAPPINGS.basic) {
            // 使用標籤匹配
            const mappedTags = TAG_MAPPINGS.basic[answer] || [];
            matched = mappedTags.some(tag => 
              normalizedTags.some(rTag => rTag.includes(tag.toLowerCase()))
            );
          } else {
            // 檢查是否為趣味問題答案
            const mappedFunTags = TAG_MAPPINGS.fun[answer] || [];
            matched = mappedFunTags.some(tag => 
              normalizedTags.some(rTag => rTag.includes(tag.toLowerCase()))
            );
          }
      }
      
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
  if (typeof rating === 'number' && rating > 0) {
    // 評分通常為1-5，將其轉換為0-1的比例
    const ratingFactor = Math.min(rating / 5, 1);
    score += ratingFactor * WEIGHT.RATING;
  }
  
  // 2. 人氣因素: 瀏覽次數或評價數量越多，分數越高
  if (typeof reviews === 'number' && reviews > 0) {
    // 假設評價數量通常在0-500之間，將其轉換為0-1的比例
    const reviewsFactor = Math.min(reviews / 500, 1);
    score += reviewsFactor * WEIGHT.POPULARITY;
  }
  
  // 3. 喜歡等級: 收藏次數越多，分數越高
  if (typeof likes === 'number' && likes > 0) {
    // 假設喜歡數量通常在0-100之間，將其轉換為0-1的比例
    const likesFactor = Math.min(likes / 100, 1);
    score += likesFactor * WEIGHT.POPULARITY;
  }
  
  // 4. 距離因素: 如果有用戶位置和餐廳位置，可以計算距離
  if (options.userLocation && location) {
    // 使用更適合的距離計算方法
    const distance = calculateDistance(options.userLocation, location);
    
    // 根據用戶的距離偏好給予不同權重
    // 如果用戶選擇"附近吃"，距離近的餐廳得分更高
    // 如果用戶選擇"遠一點"，距離適中的餐廳得分更高
    if (answersMap["附近吃還是遠一點？"] === "附近吃") {
      // 距離越近分數越高
      const distanceFactor = Math.max(0, 1 - distance / DISTANCE_THRESHOLDS.NEAR);
      score += distanceFactor * WEIGHT.DISTANCE * 2; // 加倍權重
    } else if (answersMap["附近吃還是遠一點？"] === "遠一點") {
      // 距離適中（不太近也不太遠）得分最高
      if (distance > DISTANCE_THRESHOLDS.NEAR && distance < DISTANCE_THRESHOLDS.FAR) {
        score += WEIGHT.DISTANCE;
      } else if (distance > DISTANCE_THRESHOLDS.FAR) {
        // 太遠的分數稍微降低
        score += WEIGHT.DISTANCE * 0.7;
      }
    } else {
      // 沒有指定距離偏好，使用一般判斷
      const distanceFactor = Math.max(0, 1 - distance / 10);
      score += distanceFactor * WEIGHT.DISTANCE;
    }
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
  
  // 基本問題集
  const basicQuestions = options.basicQuestions || [];
  
  // 基本問題答案識別
  let basicAnswers = [];
  let funAnswers = [];
  
  // 如果提供了特定的基本問題集和答案問題映射
  if (basicQuestions.length > 0 && options.answerQuestionMap) {
    // 使用問題文本識別基本問題
    const basicQuestionTexts = basicQuestions.map(q => q.question);
    
    // 使用映射找出基本問題的答案
    const basicAnswerIndices = Object.entries(options.answerQuestionMap)
      .filter(([_, question]) => basicQuestionTexts.includes(question))
      .map(([index]) => parseInt(index));
      
    basicAnswers = basicAnswerIndices.map(index => answers[index]);
    funAnswers = answers.filter((_, index) => !basicAnswerIndices.includes(index) && answers[index]);
  } else {
    // 傳統方法 - 使用題號識別
    const basicQuestionsCount = options.basicQuestionsCount || basicQuestions.length || 3;
    basicAnswers = answers.slice(0, basicQuestionsCount);
    funAnswers = answers.slice(basicQuestionsCount);
  }
  
  // 計算每個餐廳的分數
  const scoredRestaurants = restaurants.map(restaurant => {
    const score = calculateMatchScore(
      restaurant, 
      basicAnswers,
      basicQuestions, // 傳遞基本問題集
      funAnswers, 
      options.groupAnswerCounts,
      {
        ...options,
        strictBasicMatch: options.strictBasicMatch !== false
      }
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
  const filteredRestaurants = sortedRestaurants.filter(r => r.matchScore >= minScoreThreshold);
  
  // 如果過濾後沒有餐廳，返回前10個得分最高的餐廳
  if (filteredRestaurants.length === 0) {
    return sortedRestaurants.slice(0, 10);
  }
  
  return filteredRestaurants;
};

/**
 * 根據多個用戶的答案生成群組推薦餐廳
 * @param {Object} allUserAnswers - 所有用戶的答案 {userId: [answers]} 或 {userId: {answers, questionTexts}}
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
  
  // 用於跟踪問題和答案的映射
  const answerQuestionMap = {};
  
  // 處理所有用戶的答案
  Object.values(allUserAnswers).forEach(userAnswers => {
    // 檢查是否是結構化的答案（包含問題文本）
    if (userAnswers && typeof userAnswers === 'object' && userAnswers.answers && userAnswers.questionTexts) {
      // 如果提供了問題文本，使用它們來映射答案到問題
      userAnswers.answers.forEach((answer, index) => {
        if (answer) {
          answerCounts[answer] = (answerCounts[answer] || 0) + 1;
          // 保存答案索引與問題文本的映射
          if (userAnswers.questionTexts[index]) {
            answerQuestionMap[index] = userAnswers.questionTexts[index];
          }
        }
      });
    } else if (Array.isArray(userAnswers)) {
      // 傳統格式 - 僅答案陣列
      userAnswers.forEach((answer, index) => {
        if (answer) {
          answerCounts[answer] = (answerCounts[answer] || 0) + 1;
        }
      });
    }
  });
  
  // 合併所有用戶的答案
  const mergedAnswers = [];
  const userCount = Object.keys(allUserAnswers).length;
  
  // 確定基本問題
  let basicQuestions = [];
  if (options.basicQuestions) {
    // 使用提供的基本問題集
    basicQuestions = options.basicQuestions;
  } else if (options.buddiesBasicQuestions) {
    // 使用 Buddies 專用基本問題集
    basicQuestions = options.buddiesBasicQuestions;
  }
  
  const basicQuestionTexts = basicQuestions.map(q => q.question);
  
  // 針對每個基本問題，採用多數決
  if (basicQuestionTexts.length > 0 && Object.keys(answerQuestionMap).length > 0) {
    // 使用問題文本進行判斷
    basicQuestionTexts.forEach(questionText => {
      // 找到與這個問題相關的所有答案
      const relatedAnswers = {};
      
      // 找出問題索引
      const questionIndices = Object.entries(answerQuestionMap)
        .filter(([_, text]) => text === questionText)
        .map(([index]) => parseInt(index));
      
      // 收集所有用戶針對此問題的答案
      Object.values(allUserAnswers).forEach(userAnswers => {
        if (userAnswers && typeof userAnswers === 'object' && userAnswers.answers && userAnswers.questionTexts) {
          // 使用問題文本映射找到答案
          const answerIndex = userAnswers.questionTexts.findIndex(text => text === questionText);
          if (answerIndex >= 0 && userAnswers.answers[answerIndex]) {
            const answer = userAnswers.answers[answerIndex];
            relatedAnswers[answer] = (relatedAnswers[answer] || 0) + 1;
          }
        } else if (Array.isArray(userAnswers) && questionIndices.length > 0) {
          // 使用問題索引找到答案
          questionIndices.forEach(index => {
            if (userAnswers[index]) {
              const answer = userAnswers[index];
              relatedAnswers[answer] = (relatedAnswers[answer] || 0) + 1;
            }
          });
        }
      });
      
      // 找出最多人選擇的答案
      let maxCount = 0;
      let majorityAnswer = null;
      
      Object.entries(relatedAnswers).forEach(([answer, count]) => {
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
          answerCounts[majorityAnswer] = (answerCounts[majorityAnswer] || 0) + 
            Math.floor(maxCount / userCount * WEIGHT.GROUP_CONSENSUS);
        }
      }
    });
  } else {
    // 傳統方法 - 使用題號
    const basicQuestionsCount = options.basicQuestionsCount || basicQuestions.length || 3;
    
    for (let i = 0; i < basicQuestionsCount; i++) {
      const answersForThisQuestion = {};
      
      // 收集針對此問題的所有答案
      Object.values(allUserAnswers).forEach(userAnswers => {
        if (Array.isArray(userAnswers) && userAnswers[i]) {
          answersForThisQuestion[userAnswers[i]] = (answersForThisQuestion[userAnswers[i]] || 0) + 1;
        } else if (userAnswers && typeof userAnswers === 'object' && Array.isArray(userAnswers.answers) && userAnswers.answers[i]) {
          answersForThisQuestion[userAnswers.answers[i]] = (answersForThisQuestion[userAnswers.answers[i]] || 0) + 1;
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
          answerCounts[majorityAnswer] = (answerCounts[majorityAnswer] || 0) + 
            Math.floor(maxCount / userCount * WEIGHT.GROUP_CONSENSUS);
        }
      }
    }
  }
  
  // 處理趣味問題 - 採用興趣聚合算法
  // 將所有趣味問題的答案按受歡迎程度排序
  const funAnswersByPopularity = {};
  
  if (basicQuestionTexts.length > 0 && Object.keys(answerQuestionMap).length > 0) {
    // 使用問題文本進行判斷
    Object.values(allUserAnswers).forEach(userAnswers => {
      if (userAnswers && typeof userAnswers === 'object' && userAnswers.answers && userAnswers.questionTexts) {
        userAnswers.answers.forEach((answer, index) => {
          if (answer && !basicQuestionTexts.includes(userAnswers.questionTexts[index])) {
            funAnswersByPopularity[answer] = (funAnswersByPopularity[answer] || 0) + 1;
          }
        });
      }
    });
  } else {
    // 傳統方法 - 使用題號
    const basicQuestionsCount = options.basicQuestionsCount || basicQuestions.length || 3;
    
    Object.values(allUserAnswers).forEach(userAnswers => {
      if (Array.isArray(userAnswers)) {
        const funAnswers = userAnswers.slice(basicQuestionsCount);
        funAnswers.forEach(answer => {
          if (answer) {
            funAnswersByPopularity[answer] = (funAnswersByPopularity[answer] || 0) + 1;
          }
        });
      } else if (userAnswers && typeof userAnswers === 'object' && Array.isArray(userAnswers.answers)) {
        const funAnswers = userAnswers.answers.slice(basicQuestionsCount);
        funAnswers.forEach(answer => {
          if (answer) {
            funAnswersByPopularity[answer] = (funAnswersByPopularity[answer] || 0) + 1;
          }
        });
      }
    });
  }
  
  // 選擇前3個最受歡迎的趣味答案
  const popularFunAnswers = Object.entries(funAnswersByPopularity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(entry => entry[0]);
  
  // 將趣味問題答案添加到合併答案中
  popularFunAnswers.forEach(answer => {
    if (!mergedAnswers.includes(answer)) {
      mergedAnswers.push(answer);
    }
  });
  
  // 使用增強的推薦邏輯，確保傳遞必要的參數
  return recommendRestaurants(mergedAnswers, restaurants, {
    ...options,
    groupAnswerCounts: answerCounts,
    userCount: userCount,
    answerQuestionMap: answerQuestionMap,
    basicQuestions: basicQuestions, // 傳遞基本問題集
    // 確保嚴格匹配基本問題
    strictBasicMatch: options.strictBasicMatch !== false
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