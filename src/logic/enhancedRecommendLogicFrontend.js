// enhancedRecommendLogicFrontend.js
// 修正語法錯誤、重複定義、與不合法 switch-case 寫法，並補上完整 matchScore 邏輯
import { funQuestionTagsMap } from '../data/funQuestionTags';

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

function isBasicQuestion(q) {
  return BASIC_QUESTION_IDENTIFIERS.some(keyword => q && q.includes(keyword));
}

function degreesToRadians(deg) {
  return deg * (Math.PI / 180);
}

function calculateDistance(c1, c2) {
  if (!c1 || !c2 || !c1.lat || !c1.lng || !c2.lat || !c2.lng) return 999999;
  const R = 6371;
  const dLat = degreesToRadians(c2.lat - c1.lat);
  const dLng = degreesToRadians(c2.lng - c1.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(degreesToRadians(c1.lat)) * Math.cos(degreesToRadians(c2.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getRandomTen(arr) {
  if (!arr || arr.length <= 10) return arr || [];
  return [...arr].sort(() => 0.5 - Math.random()).slice(0, 10);
}

function getRandomFunQuestions(allQuestions, count = 3) {
  if (!Array.isArray(allQuestions)) return [];
  return [...allQuestions].sort(() => 0.5 - Math.random()).slice(0, count);
}

function calculateMatchScore(restaurant, basicAnswers, basicQuestions, funAnswers, _, options = {}) {
  let score = WEIGHT.MIN_SCORE;
  const strictBasicMatch = options.strictBasicMatch === true;

  const { priceRange, type, isSpicy, suggestedPeople, tags, rating, reviews, likes, location } = restaurant || {};
  const restaurantType = type ? type.split(/[,、，]/).map(t => t.trim()) : [];
  const restaurantTags = Array.isArray(tags) ? tags : tags ? [tags] : [];
  if (restaurantType.length > 0) restaurantTags.push(...restaurantType);
  const normalizedTags = restaurantTags
    .filter(Boolean)
    .map(tag => String(tag).toLowerCase());

  //優先檢查關鍵條件
  if (Array.isArray(basicAnswers)) {
    // 優先檢查「喝」選項 - 必須有喝標籤，否則立即返回最低分
    if (basicAnswers.includes("喝") && !normalizedTags.includes("喝")) {
      return WEIGHT.MIN_SCORE;
    }

    // 優先檢查「吃」選項 - 如果沒有「吃一點」或「飽足」標籤，立即返回最低分
    if (basicAnswers.includes("吃") &&
      !normalizedTags.includes("吃一點") &&
      !normalizedTags.includes("飽足")) {
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

  const tagMatch = (targets) => normalizedTags.some(tag => targets.some(t => typeof t === 'string' && tag.includes(t.toLowerCase())));

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
          // 檢查是否有"吃一點"或"飽足"標籤
          const isEatingPlace = normalizedTags.includes("吃一點") || normalizedTags.includes("飽足");

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
          // 必須有"飽足"標籤
          const hasFullMealTag = normalizedTags.includes("飽足");

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
        case "辣": matched = isSpicy === true; break;
        case "不辣": matched = isSpicy === false; break;
        case "單人": matched = suggestedPeople && suggestedPeople.includes("1"); break;
        case "多人": matched = suggestedPeople && suggestedPeople.includes("~"); break;
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

  if (strictBasicMatch && basicMismatchCount > 0) return WEIGHT.MIN_SCORE;
  if (basicMatchCount === 0 && basicAnswers.length > 0) score = WEIGHT.MIN_SCORE;

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


function recommendRestaurants(answers, restaurants, options = {}) {
  if (!Array.isArray(restaurants) || restaurants.length === 0) {
    console.warn("無效的餐廳列表");
    return [];
  }

  // 獲取基本問題和識別符
  const basicQuestions = options.basicQuestions || [];
  const basicQuestionIdentifiers = basicQuestions.length > 0 ?
    basicQuestions.map(q => q.question) :
    BASIC_QUESTION_IDENTIFIERS;

  let basicAnswers = [];
  let funAnswers = [];

  // 處理答案分類
  if (options.answerQuestionMap) {
    console.log("使用答案-問題映射處理答案");
    Object.entries(options.answerQuestionMap).forEach(([, data]) => {
      const { text, answer, source } = data;
      if (answer) {
        if (source === 'basic' || basicQuestionIdentifiers.some(q => text && text.includes(q))) {
          basicAnswers.push(answer);
        } else {
          funAnswers.push(answer);
        }
      }
    });
  } else if (Array.isArray(answers)) {
    console.log("使用答案陣列處理答案");
    // 前6個為基本問題答案
    basicAnswers = answers.slice(0, 6);
    funAnswers = answers.slice(6);
  }

  console.log("基本問題答案:", basicAnswers);
  console.log("趣味問題答案:", funAnswers);

  // 第一階段：硬性條件過濾
  let filteredRestaurants = [...restaurants];

  // 處理基本條件篩選
  if (basicAnswers.includes("喝")) {
    filteredRestaurants = filteredRestaurants.filter(r =>
      r.tags && Array.isArray(r.tags) && r.tags.some(tag =>
        typeof tag === 'string' && tag.toLowerCase().trim() === "喝"
      )
    );
    console.log("喝的篩選後餐廳數量:", filteredRestaurants.length);
  } else if (basicAnswers.includes("吃一點")) {
    filteredRestaurants = filteredRestaurants.filter(r =>
      r.tags && Array.isArray(r.tags) && r.tags.some(tag =>
        typeof tag === 'string' && tag.toLowerCase().trim() === "吃一點"
      )
    );
    console.log("吃一點篩選後餐廳數量:", filteredRestaurants.length);
  } else if (basicAnswers.includes("吃飽")) {
    filteredRestaurants = filteredRestaurants.filter(r =>
      r.tags && Array.isArray(r.tags) && r.tags.some(tag =>
        typeof tag === 'string' && tag.toLowerCase().trim() === "飽足"
      )
    );
    console.log("吃飽篩選後餐廳數量:", filteredRestaurants.length);
  }

  // 價格篩選
  if (basicAnswers.includes("奢華美食")) {
    filteredRestaurants = filteredRestaurants.filter(r =>
      r.priceRange === "$$$" || r.priceRange === "$$"
    );
  } else if (basicAnswers.includes("平價美食")) {
    filteredRestaurants = filteredRestaurants.filter(r =>
      r.priceRange === "$" || r.priceRange === "$$"
    );
  }

  // 辣度篩選
  if (basicAnswers.includes("辣")) {
    filteredRestaurants = filteredRestaurants.filter(r => r.isSpicy === true);
  } else if (basicAnswers.includes("不辣")) {
    filteredRestaurants = filteredRestaurants.filter(r => r.isSpicy === false);
  }

  console.log("基本條件篩選後餐廳數量:", filteredRestaurants.length);

  // 如果沒有符合基本條件的餐廳，直接返回空陣列
  if (filteredRestaurants.length === 0) {
    console.warn("沒有符合基本條件的餐廳");
    return [];
  }

  // 第二階段：計算匹配分數
  const scoredRestaurants = filteredRestaurants.map(restaurant => {
    const score = calculateMatchScore(
      restaurant,
      basicAnswers,
      basicQuestions,
      funAnswers,
      null,
      {
        ...options,
        strictBasicMatch: true
      }
    );
    return { ...restaurant, matchScore: score };
  });

  // 按分數排序並過濾低分餐廳
  const sortedRestaurants = scoredRestaurants
    .sort((a, b) => b.matchScore - a.matchScore)
    .filter(r => r.matchScore > WEIGHT.MIN_SCORE);

  console.log("計算分數後的餐廳數量:", sortedRestaurants.length);
  if (sortedRestaurants.length > 0) {
    console.log("最高分:", sortedRestaurants[0].matchScore);
    console.log("最低分:", sortedRestaurants[sortedRestaurants.length - 1].matchScore);
  }

  // 返回前10名餐廳
  return sortedRestaurants.slice(0, 10);
}
export {
  recommendRestaurants,
  calculateMatchScore,
  calculateDistance,
  degreesToRadians,
  getRandomTen,
  getRandomFunQuestions,
  isBasicQuestion,
  WEIGHT,
  DISTANCE_THRESHOLDS,
  BASIC_QUESTION_IDENTIFIERS
};