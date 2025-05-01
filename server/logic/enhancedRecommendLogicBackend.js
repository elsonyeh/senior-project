// enhancedRecommendLogicBackend.fixed.js
// 完整版推薦系統模組 (Node.js CommonJS 格式)

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
    const a = Math.sin(dLat/2)**2 + Math.cos(degreesToRadians(coord1.lat)) * Math.cos(degreesToRadians(coord2.lat)) * Math.sin(dLng/2)**2;
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
  
    const tagMatch = (targets) => normalizedTags.some(tag => targets.some(t => tag && tag.toLowerCase && tag.toLowerCase && tag.toLowerCase() && tag.toLowerCase() && tag.toLowerCase && tag.toLowerCase && tag.toLowerCase && tag.toLowerCase && tag.toLowerCase && tag.toLowerCase && tag.toLowerCase && tag.toLowerCase && tag.toLowerCase && tag.toLowerCase && tag.toLowerCase && tag.toLowerCase && tag.toLowerCase));
  
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
    const filtered = sortedRestaurants.filter(r => r.matchScore >= minScoreThreshold);
    return filtered.length > 0 ? filtered : sortedRestaurants.slice(0, 10);
  }
  
  function recommendForGroup(allUserAnswers, restaurants, options = {}) {
    if (!allUserAnswers || Object.keys(allUserAnswers).length === 0) return [];
  
    const userCount = Object.keys(allUserAnswers).length;
    const answerCounts = {};
    const questionSources = {};
    const answerQuestionMap = {};
  
    Object.values(allUserAnswers).forEach(user => {
      const { answers, questionTexts, questionSources: qs } = user;
      if (answers && questionTexts) {
        answers.forEach((ans, i) => {
          if (!ans) return;
          answerCounts[ans] = (answerCounts[ans] || 0) + 1;
          answerQuestionMap[i] = questionTexts[i];
          questionSources[i] = qs ? qs[i] : isBasicQuestion(questionTexts[i]) ? 'basic' : 'fun';
        });
      } else if (Array.isArray(user)) {
        user.forEach(ans => {
          if (!ans) return;
          answerCounts[ans] = (answerCounts[ans] || 0) + 1;
        });
      }
    });
  
    const basicIndices = [];
    const funIndices = [];
    Object.entries(questionSources).forEach(([i, source]) => {
      if (source === 'basic') basicIndices.push(Number(i));
      else funIndices.push(Number(i));
    });
  
    const mergedAnswers = [];
    basicIndices.forEach(index => {
      const counts = {};
      Object.values(allUserAnswers).forEach(user => {
        const a = Array.isArray(user) ? user[index] : user.answers?.[index];
        if (a) counts[a] = (counts[a] || 0) + 1;
      });
      let majority = null, max = 0;
      Object.entries(counts).forEach(([ans, cnt]) => {
        if (cnt > max) [majority, max] = [ans, cnt];
      });
      if (majority) {
        mergedAnswers.push(majority);
        if (max > userCount / 2) {
          answerCounts[majority] = (answerCounts[majority] || 0) + Math.floor(max / userCount * WEIGHT.GROUP_CONSENSUS);
        }
      }
    });
  
    const funCounts = {};
    funIndices.forEach(index => {
      Object.values(allUserAnswers).forEach(user => {
        const a = Array.isArray(user) ? user[index] : user.answers?.[index];
        if (a) funCounts[a] = (funCounts[a] || 0) + 1;
      });
    });
    const topFun = Object.entries(funCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a]) => a);
    topFun.forEach(a => { if (!mergedAnswers.includes(a)) mergedAnswers.push(a); });
  
    const enhancedOptions = {
      ...options,
      groupAnswerCounts: answerCounts,
      userCount,
      answerQuestionMap,
      basicQuestions: options.basicQuestions || [],
      questionSources: mergedAnswers.map((_, i) => basicIndices.includes(i) ? 'basic' : 'fun')
    };
  
    return recommendRestaurants(mergedAnswers, restaurants, enhancedOptions);
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
  