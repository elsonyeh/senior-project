// enhancedRecommendLogicFrontend.js
// 修正語法錯誤、重複定義、與不合法 switch-case 寫法，並補上完整 matchScore 邏輯

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
  const a = Math.sin(dLat/2)**2 + Math.cos(degreesToRadians(c1.lat)) * Math.cos(degreesToRadians(c2.lat)) * Math.sin(dLng/2)**2;
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

function calculateMatchScore(restaurant, basicAnswers, basicQuestions, funAnswers, groupAnswerCounts = null, options = {}) {
  let score = WEIGHT.MIN_SCORE;
  const userCount = options.userCount || 1;
  const strictBasicMatch = options.strictBasicMatch === true;

  const { priceRange, type, isSpicy, suggestedPeople, tags, rating, reviews, likes, location } = restaurant || {};
  const restaurantType = type ? type.split(/[,、，]/).map(t => t.trim()) : [];
  const restaurantTags = Array.isArray(tags) ? tags : tags ? [tags] : [];
  if (restaurantType.length > 0) restaurantTags.push(...restaurantType);
  const normalizedTags = restaurantTags
    .filter(Boolean)
    .map(tag => String(tag).toLowerCase());

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
      if (question.conditionalOn) {
        const { question: condQ, answer: condA } = question.conditionalOn;
        if (answersMap[condQ] !== condA) return;
      }
      let matched = false;
      switch (answer) {
        case "奢華美食": matched = priceRange === "$$$" || priceRange === "$$"; break;
        case "平價美食": matched = priceRange === "$" || priceRange === "$$"; break;
        case "吃": {
          const food = ["餐廳", "正餐", "飯", "麵"];
          const drink = ["咖啡", "茶", "酒吧"];
          matched = restaurantType.some(t => food.includes(t)) && !restaurantType.some(t => drink.includes(t));
          break;
        }
        case "喝": matched = restaurantType.some(t => ["咖啡", "飲料", "茶", "酒吧"].includes(t)); break;
        case "吃一點": matched = tagMatch(["輕食", "小點", "點心", "下午茶"]); break;
        case "吃飽": matched = tagMatch(["合菜", "飽足", "套餐", "主食"]); break;
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
      const mappedTags = [answer];
      mappedTags.forEach(tag => {
        const safeTag = String(tag || '').toLowerCase();
        const match = normalizedTags.filter(rTag => rTag.includes(safeTag));
        if (match.length > 0) matchLevel += 0.5;
      });
      score += Math.min(matchLevel, 1) * WEIGHT.FUN_MATCH;
    });
  }

  if (groupAnswerCounts) {
    Object.entries(groupAnswerCounts).forEach(([answer, count]) => {
      const proportion = count / userCount;
      const matched = normalizedTags.some(tag => tag.includes((answer || '').toLowerCase?.() || ''));
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


function recommendRestaurants(answers, restaurants, options = {}) {
  if (!Array.isArray(restaurants) || restaurants.length === 0) return [];

  const basicQuestions = options.basicQuestions || [];
  let basicAnswers = [];
  let funAnswers = [];

  if (options.questionSources) {
    options.questionSources.forEach((source, index) => {
      if (index < answers.length) {
        if (source === 'basic' || isBasicQuestion(source)) {
          basicAnswers.push(answers[index]);
        } else {
          funAnswers.push(answers[index]);
        }
      }
    });
  } else if (basicQuestions.length > 0 && options.answerQuestionMap) {
    const basicQuestionTexts = basicQuestions.map(q => q.question);
    const basicAnswerIndices = Object.entries(options.answerQuestionMap)
      .filter(([, question]) => basicQuestionTexts.includes(question) || isBasicQuestion(question))
      .map(([index]) => parseInt(index));

    basicAnswers = basicAnswerIndices.map(index => answers[index]);
    funAnswers = answers.filter((_, index) => !basicAnswerIndices.includes(index) && answers[index]);
  } else {
    const basicQuestionsCount = options.basicQuestionsCount || basicQuestions.length || 3;
    basicAnswers = answers.slice(0, basicQuestionsCount);
    funAnswers = answers.slice(basicQuestionsCount);
  }

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

  const sortedRestaurants = scoredRestaurants.sort((a, b) => b.matchScore - a.matchScore);
  const minScoreThreshold = options.minScoreThreshold || (WEIGHT.MIN_SCORE * 2);
  const filteredRestaurants = sortedRestaurants.filter(r => r.matchScore >= minScoreThreshold);
  return filteredRestaurants.length > 0 ? filteredRestaurants : sortedRestaurants.slice(0, 10);
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
