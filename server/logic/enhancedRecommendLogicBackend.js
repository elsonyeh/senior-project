// enhancedRecommendLogicBackend.fixed.js
// 完整版推薦系統模組 (Node.js CommonJS 格式)
const { funQuestionTagsMap } = require('../data/funQuestionTags');

const WEIGHT = {
  BASIC_MATCH: 10,
  FUN_MATCH: 5,
  GROUP_CONSENSUS: 3,
  POPULARITY: 2,
  DISTANCE: 2,
  RATING: 1.5,
  MIN_SCORE: 1
};

const DISTANCE_THRESHOLDS = {
  NEAR: 2,
  MEDIUM: 5,
  FAR: 10
};

const BASIC_QUESTION_IDENTIFIERS = [
  "今天是一個人還是有朋友？",
  "想吃奢華點還是平價？",
  "想吃正餐還是想喝飲料？",
  "吃一點還是吃飽？",
  "附近吃還是遠一點？",
  "想吃辣的還是不辣？"
];

function isBasicQuestion(text) {
  return BASIC_QUESTION_IDENTIFIERS.some(q => text && text.includes(q));
}

function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function calculateDistance(coord1, coord2) {
  if (!coord1 || !coord2 || !coord1.lat || !coord1.lng || !coord2.lat || !coord2.lng) return 999999;
  const R = 6371;
  const dLat = degreesToRadians(coord2.lat - coord1.lat);
  const dLng = degreesToRadians(coord2.lng - coord1.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(degreesToRadians(coord1.lat)) * Math.cos(degreesToRadians(coord2.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getRandomTen(arr) {
  if (!arr || arr.length <= 10) return arr || [];
  return [...arr].sort(() => 0.5 - Math.random()).slice(0, 10);
}

function getRandomFunQuestions(allQuestions, count = 3) {
  if (!Array.isArray(allQuestions)) return [];
  return [...allQuestions].sort(() => 0.5 - Math.random()).slice(0, count);
}

// 創建基於種子的隨機數生成器
function createSeededRandom(seed) {
  let s = seed || 1;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// 基於種子的隨機排序函數
function seededShuffle(array, seed) {
  const random = createSeededRandom(seed);
  return [...array].sort(() => random() - 0.5);
}

// 修改 calculateMatchScore 函數，與前端邏輯保持一致
function calculateMatchScore(restaurant, basicAnswers, basicQuestions, funAnswers, groupAnswerCounts = null, options = {}) {
  let score = WEIGHT.MIN_SCORE;
  const userCount = options.userCount || 1;
  const strictBasicMatch = options.strictBasicMatch === true;

  const { priceRange, type, is_spicy, suggested_people, tags, rating, reviews, likes, location } = restaurant || {};
  const isSpicy = is_spicy; // 保持向後兼容性
  const restaurantType = type ? type.split(/[,、，]/).map(t => t.trim()) : [];
  const restaurantTags = Array.isArray(tags) ? tags : tags ? [tags] : [];
  if (restaurantType.length > 0) restaurantTags.push(...restaurantType);
  const normalizedTags = restaurantTags
    .filter(Boolean)
    .map(tag => String(tag).toLowerCase());

  // 優先檢查關鍵條件
  if (Array.isArray(basicAnswers)) {
    // 優先檢查「喝」選項 - 必須有喝標籤，否則立即返回最低分
    if (basicAnswers.includes("喝") && !normalizedTags.some(tag => tag === "喝")) {
      return WEIGHT.MIN_SCORE;
    }

    // 優先檢查「吃」選項 - 如果沒有「吃一點」或「吃飽」標籤，立即返回最低分
    if (basicAnswers.includes("吃") &&
      !normalizedTags.some(tag => tag === "吃一點" || tag === "吃飽")) {
      return WEIGHT.MIN_SCORE;
    }

    // 優先檢查「吃一點」選項 - 必須有「吃一點」標籤，否則立即返回最低分
    if (basicAnswers.includes("吃一點") && !normalizedTags.some(tag => tag === "吃一點")) {
      return WEIGHT.MIN_SCORE;
    }

    // 優先檢查「吃飽」選項 - 必須有「吃飽」標籤，否則立即返回最低分
    if (basicAnswers.includes("吃飽") && !normalizedTags.some(tag => tag === "吃飽")) {
      return WEIGHT.MIN_SCORE;
    }
  }

  const answersMap = {};
  if (Array.isArray(basicQuestions) && Array.isArray(basicAnswers)) {
    basicQuestions.forEach((q, i) => {
      if (i < basicAnswers.length && q && q.question) {
        answersMap[q.question] = basicAnswers[i];
      }
    });
  }

  let basicMatchCount = 0;
  let basicMismatchCount = 0;

  const tagMatch = (targets) => normalizedTags.some(tag =>
    targets.some(t => typeof t === 'string' && tag.includes(t.toLowerCase()))
  );

  if (Array.isArray(basicAnswers) && Array.isArray(basicQuestions)) {
    basicAnswers.forEach((answer, index) => {
      if (!answer || index >= basicQuestions.length) return;
      const question = basicQuestions[index];

      // 檢查條件依賴
      if (question.dependsOn) {
        const { question: condQ, answer: condA } = question.dependsOn;

        // 檢查依賴問題的答案是否滿足條件
        const condQIndex = basicQuestions.findIndex(q => q.question === condQ);
        if (condQIndex === -1 || basicAnswers[condQIndex] !== condA) {
          // 如果條件不滿足，跳過此問題的匹配
          return;
        }
      }
      let matched = false;
      switch (answer) {
        case "奢華美食": matched = priceRange === "$$$" || priceRange === "$$"; break;
        case "平價美食": matched = priceRange === "$" || priceRange === "$$"; break;
        case "吃": {
          // 檢查是否有"吃一點"或"吃飽"標籤
          const isEatingPlace = normalizedTags.includes("吃一點") || normalizedTags.includes("吃飽");

          // 如果選擇了「吃」但餐廳沒有吃的相關標籤，給予最低分
          if (!isEatingPlace) {
            score = WEIGHT.MIN_SCORE;
            return score;
          }

          matched = true;
          break;
        }
        case "喝": {
          // 一定要有"喝"標籤才匹配
          const isDrinkPlace = normalizedTags.includes("喝");

          // 如果選擇了「喝」但餐廳沒有「喝」標籤，給予最低分並提前退出
          if (!isDrinkPlace) {
            score = WEIGHT.MIN_SCORE;
            return score; // 提前返回，不再計算其他分數
          }

          matched = true;
          // 增加匹配權重，確保飲料店排名更高
          score += WEIGHT.BASIC_MATCH * 1.5; // 提高喝的匹配權重
          break;
        }
        case "吃一點": {
          // 必須有"吃一點"標籤
          const hasLightMealTag = normalizedTags.includes("吃一點");

          if (!hasLightMealTag) {
            score = WEIGHT.MIN_SCORE;
            return score;
          }

          matched = true;
          break;
        }
        case "吃飽": {
          // 必須有"吃飽"標籤
          const hasFullMealTag = normalizedTags.includes("吃飽");

          if (!hasFullMealTag) {
            score = WEIGHT.MIN_SCORE;
            return score;
          }

          matched = true;
          break;
        }
        case "附近吃": {
          if (options.userLocation && location) {
            matched = calculateDistance(options.userLocation, location) <= DISTANCE_THRESHOLDS.NEAR;
          } else {
            matched = tagMatch(["附近", "便利", "快速"]);
          }
          break;
        }
        case "遠一點": {
          if (options.userLocation && location) {
            matched = calculateDistance(options.userLocation, location) >= DISTANCE_THRESHOLDS.MEDIUM;
          } else {
            matched = tagMatch(["特色", "值得", "遠赴"]);
          }
          break;
        }
        case "辣": matched = isSpicy === true || isSpicy === 'true' || isSpicy === 'both'; break;
        case "不辣": matched = isSpicy === false || isSpicy === 'false' || isSpicy === 'both'; break;
        case "單人": matched = suggested_people && suggested_people.includes("1"); break;
        case "多人": matched = suggested_people && suggested_people.includes("~"); break;
        default: matched = tagMatch([answer]);
      }
      if (matched) {
        score += WEIGHT.BASIC_MATCH;
        basicMatchCount++;
      } else {
        basicMismatchCount++;
      }
    });
  }

  if (strictBasicMatch && basicMismatchCount > 0) return 0;
  // 嚴格基本匹配：必須符合所有基本條件，否則直接返回0分
  if (basicAnswers.length > 0 && basicMatchCount < basicAnswers.length) return 0;

  if (Array.isArray(funAnswers)) {
    funAnswers.forEach(answer => {
      if (!answer) return;
      let matchLevel = 0;

      // 使用映射的標籤代替直接使用答案
      const mappedTags = funQuestionTagsMap[answer] || [answer];

      // 計算匹配程度
      mappedTags.forEach(tag => {
        const safeTag = String(tag || '').toLowerCase();
        const match = normalizedTags.filter(rTag => rTag.includes(safeTag));
        if (match.length > 0) matchLevel += 1 / mappedTags.length; // 根據匹配標籤比例計算分數
      });

      // 乘以權重
      score += Math.min(matchLevel, 1) * WEIGHT.FUN_MATCH;
    });
  }

  if (groupAnswerCounts) {
    Object.entries(groupAnswerCounts).forEach(([answer, count]) => {
      const proportion = count / userCount;
      const matched = normalizedTags.some(tag => tag.includes(answer.toLowerCase?.() || ''));
      if (matched) {
        const consensusWeight = Math.pow(proportion, 2) * WEIGHT.GROUP_CONSENSUS * userCount;
        score += consensusWeight;
      }
    });
  }

  if (typeof rating === 'number' && rating > 0) score += Math.min(rating / 5, 1) * WEIGHT.RATING;
  if (typeof reviews === 'number' && reviews > 0) score += Math.min(reviews / 500, 1) * WEIGHT.POPULARITY;
  if (typeof likes === 'number' && likes > 0) score += Math.min(likes / 100, 1) * WEIGHT.POPULARITY;

  if (options.userLocation && location) {
    const distance = calculateDistance(options.userLocation, location);
    const distanceFactor = Math.max(0, 1 - distance / 10);
    score += distanceFactor * WEIGHT.DISTANCE;
  }

  if (basicMatchCount === basicAnswers.length && basicAnswers.length > 0) {
    score += WEIGHT.BASIC_MATCH * 0.5;
  }

  return score;
}

// 修改 recommendRestaurants 函數，與前端邏輯保持一致
function recommendRestaurants(answers, restaurants, options = {}) {
  if (!Array.isArray(restaurants) || restaurants.length === 0) return [];

  // 獲取基本問題和識別符
  const basicQuestions = options.basicQuestions || [];

  // 保證有識別基本問題的方法（多層次回退機制）
  const basicQuestionIdentifiers = basicQuestions.length > 0 ?
    basicQuestions.map(q => q.question) :
    BASIC_QUESTION_IDENTIFIERS; // 使用預設識別符作為備用

  // 基於問題-答案映射來分類
  let basicAnswers = [];
  let funAnswers = [];

  // 記錄處理方式以便調試
  let processingMethod = "";

  // 處理方式1: 使用 answerQuestionMap 映射關係（優先級最高）
  if (options.answerQuestionMap && Object.keys(options.answerQuestionMap).length > 0) {
    processingMethod = "使用答案-問題映射";

    Object.entries(options.answerQuestionMap).forEach(([index, questionText]) => {
      const answerIndex = parseInt(index);
      if (!isNaN(answerIndex) && answerIndex < answers.length) {
        // 完整匹配或部分匹配基本問題標識符
        if (basicQuestionIdentifiers.includes(questionText) ||
          basicQuestionIdentifiers.some(q => questionText &&
            typeof questionText === 'string' &&
            questionText.includes(q))) {
          basicAnswers.push(answers[answerIndex]);
        } else {
          funAnswers.push(answers[answerIndex]);
        }
      }
    });
  }
  // 處理方式2: 使用問題文本陣列（第二優先級）
  else if (options.questionTexts && options.questionTexts.length > 0) {
    processingMethod = "使用問題文本陣列";

    options.questionTexts.forEach((questionText, index) => {
      if (index < answers.length) {
        // 檢查問題是否是基本問題
        if (basicQuestionIdentifiers.includes(questionText) ||
          basicQuestionIdentifiers.some(q => questionText &&
            typeof questionText === 'string' &&
            questionText.includes(q))) {
          basicAnswers.push(answers[index]);
        } else {
          funAnswers.push(answers[index]);
        }
      }
    });
  }
  // 處理方式3: 使用 questionSources 陣列（第三優先級）
  else if (options.questionSources && options.questionSources.length > 0) {
    processingMethod = "使用問題來源陣列";

    options.questionSources.forEach((source, index) => {
      if (index < answers.length) {
        if (source === 'basic' || isBasicQuestion(source)) {
          basicAnswers.push(answers[index]);
        } else {
          funAnswers.push(answers[index]);
        }
      }
    });
  }
  // 處理方式4: 使用基本問題數量（最基本回退機制）
  else {
    processingMethod = "使用基本問題數量";

    const basicQuestionsCount = options.basicQuestionsCount || basicQuestions.length || 6; // 預設 6 個基本問題
    basicAnswers = answers.slice(0, Math.min(basicQuestionsCount, answers.length));
    funAnswers = answers.slice(Math.min(basicQuestionsCount, answers.length));
  }

  console.log("問題處理方式:", processingMethod);
  console.log("基本問題答案:", basicAnswers);
  console.log("是否包含喝:", basicAnswers.includes("喝"));
  console.log("趣味問題答案:", funAnswers);

  // 儲存原始餐廳列表
  const originalRestaurants = [...restaurants];

  // 添加前置過濾邏輯
  if (basicAnswers.includes("喝")) {
    // 如果選擇了「喝」，先過濾只保留有「喝」標籤的餐廳
    restaurants = restaurants.filter(r => {
      // 確保標籤是數組
      const tags = r.tags ? (Array.isArray(r.tags) ? r.tags : [r.tags]) : [];

      // 嚴格檢查是否有「喝」標籤 - 使用精確匹配而非包含匹配
      return tags.some(tag =>
        typeof tag === 'string' && tag.toLowerCase().trim() === "喝"
      );
    });

    // 如果過濾後沒有餐廳，直接返回空陣列
    if (restaurants.length === 0) {
      console.warn("沒有找到符合「喝」條件的餐廳");
      return [];
    }
  } else if (basicAnswers.includes("吃一點")) {
    // 僅保留有「吃一點」標籤的餐廳
    restaurants = restaurants.filter(r => {
      const tags = r.tags ? (Array.isArray(r.tags) ? r.tags : [r.tags]) : [];
      return tags.some(tag =>
        typeof tag === 'string' && tag.toLowerCase().trim() === "吃一點"
      );
    });

    if (restaurants.length === 0) {
      console.warn("沒有找到符合「吃一點」條件的餐廳");
      return [];
    }
  } else if (basicAnswers.includes("吃飽")) {
    // 僅保留有「吃飽」標籤的餐廳
    restaurants = restaurants.filter(r => {
      const tags = r.tags ? (Array.isArray(r.tags) ? r.tags : [r.tags]) : [];
      return tags.some(tag =>
        typeof tag === 'string' && tag.toLowerCase().trim() === "吃飽"
      );
    });

    if (restaurants.length === 0) {
      console.warn("沒有找到符合「吃飽」條件的餐廳");
      return [];
    }
  }

  // 使用 calculateMatchScore 為每個餐廳打分
  const scoredRestaurants = restaurants.map(restaurant => {
    const score = calculateMatchScore(
      restaurant,
      basicAnswers,
      basicQuestions,
      funAnswers,
      options.groupAnswerCounts,
      {
        ...options,
        strictBasicMatch: options.strictBasicMatch !== false
      }
    );
    return { ...restaurant, matchScore: score };
  });

  // 按分數排序餐廳
  const sortedRestaurants = scoredRestaurants.sort((a, b) => b.matchScore - a.matchScore);
  const minScoreThreshold = options.minScoreThreshold || (WEIGHT.MIN_SCORE * 2);

  // 過濾掉不符合基本條件（分數為0）和分數過低的餐廳
  const filteredRestaurants = sortedRestaurants.filter(r =>
    r.matchScore > 0 && r.matchScore >= minScoreThreshold
  );

  // 關鍵條件下不返回備選項，確保嚴格匹配
  if (options.strictBasicMatch &&
    (basicAnswers.includes("喝") || basicAnswers.includes("吃") ||
      basicAnswers.includes("吃一點") || basicAnswers.includes("吃飽"))) {
    // 如果有種子參數，應用確定性排序，但保持分數排序
    if (options.seed && filteredRestaurants.length > 1) {
      // 先按分數排序，然後在分數相同的情況下使用確定性隨機排序
      return [...filteredRestaurants].sort((a, b) => {
        // 如果分數差距很小(小於0.5)，使用種子隨機排序
        if (Math.abs(a.matchScore - b.matchScore) < 0.5) {
          const seededRandom = createSeededRandom(options.seed);
          return seededRandom() - 0.5;
        }
        // 否則依然按分數排序
        return b.matchScore - a.matchScore;
      });
    }
    return filteredRestaurants; // 不回退到排序列表，寧可返回空
  }

  // 如果沒有符合條件的餐廳，退回到分數最高的10家
  if (filteredRestaurants.length > 0) {
    // 如果有種子參數，應用確定性排序，但保持分數排序
    if (options.seed && filteredRestaurants.length > 1) {
      // 先按分數排序，然後在分數相同的情況下使用確定性隨機排序
      return [...filteredRestaurants].sort((a, b) => {
        // 如果分數差距很小(小於0.5)，使用種子隨機排序
        if (Math.abs(a.matchScore - b.matchScore) < 0.5) {
          const seededRandom = createSeededRandom(options.seed);
          return seededRandom() - 0.5;
        }
        // 否則依然按分數排序
        return b.matchScore - a.matchScore;
      });
    }
    return filteredRestaurants;
  } else {
    // 取排序後的前10家
    const top10 = sortedRestaurants.slice(0, 10);
    // 如果有種子參數，應用確定性排序，但保持分數排序
    if (options.seed && top10.length > 1) {
      // 先按分數排序，然後在分數相同的情況下使用確定性隨機排序
      return [...top10].sort((a, b) => {
        // 如果分數差距很小(小於0.5)，使用種子隨機排序
        if (Math.abs(a.matchScore - b.matchScore) < 0.5) {
          const seededRandom = createSeededRandom(options.seed);
          return seededRandom() - 0.5;
        }
        // 否則依然按分數排序
        return b.matchScore - a.matchScore;
      });
    }
    return top10;
  }
}

// 修改 recommendForGroup 函數中的投票處理邏輯
function recommendForGroup(allUserAnswers, restaurants, options = {}) {
  if (!Array.isArray(allUserAnswers) || allUserAnswers.length === 0) return [];
  if (!Array.isArray(restaurants) || restaurants.length === 0) return [];

  const basicQuestions = options.basicQuestions || [];
  const isHost = options.isHost || false;
  const hostAnswers = options.hostAnswers || [];

  // 處理每個基本問題的答案
  const processedAnswers = basicQuestions.map((question, qIndex) => {
    // 收集所有用戶對這個問題的答案
    const answers = allUserAnswers.map(userAnswers => userAnswers[qIndex]);

    // 計算每個選項的票數，考慮房主權重
    const voteCount = {};
    answers.forEach((answer, userIndex) => {
      if (answer) {
        // 如果是房主的答案，給予雙倍權重
        const weight = (isHost && userIndex === 0) ? 2 : 1;
        voteCount[answer] = (voteCount[answer] || 0) + weight;
      }
    });

    // 找出最高票數
    const maxVotes = Math.max(...Object.values(voteCount));

    // 找出獲得最高票數的選項
    const maxVotedOptions = Object.entries(voteCount)
      .filter(([_, count]) => count === maxVotes)
      .map(([option]) => option);

    // 如果只有一個最高票選項，直接使用
    if (maxVotedOptions.length === 1) {
      return maxVotedOptions[0];
    }

    // 如果有多個最高票選項（平票），優先使用房主的選擇
    if (isHost && hostAnswers[qIndex] && maxVotedOptions.includes(hostAnswers[qIndex])) {
      return hostAnswers[qIndex];
    }

    // 如果房主沒有選擇或房主的選擇不在最高票選項中，使用第一個最高票選項
    return maxVotedOptions[0];
  });

  // 根據處理後的答案過濾餐廳
  const filteredRestaurants = restaurants.filter(restaurant => {
    const score = calculateMatchScore(restaurant, processedAnswers, basicQuestions, [], null, options);
    return score > WEIGHT.MIN_SCORE;
  });

  // 計算每個餐廳的推薦分數
  const scoredRestaurants = filteredRestaurants.map(restaurant => ({
    ...restaurant,
    score: calculateMatchScore(restaurant, processedAnswers, basicQuestions, [], null, options)
  }));

  // 根據分數排序
  return scoredRestaurants.sort((a, b) => b.score - a.score);
}

module.exports = {
  recommendRestaurants,
  calculateMatchScore,
  recommendForGroup,
  calculateDistance,
  degreesToRadians,
  getRandomTen,
  getRandomFunQuestions,
  isBasicQuestion,
  WEIGHT,
  DISTANCE_THRESHOLDS,
  BASIC_QUESTION_IDENTIFIERS
};