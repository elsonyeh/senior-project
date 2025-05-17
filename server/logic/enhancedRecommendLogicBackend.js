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

// 修改 calculateMatchScore 函數，與前端邏輯保持一致
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

  // 優先檢查關鍵條件
  if (Array.isArray(basicAnswers)) {
    // 優先檢查「喝」選項 - 必須有喝標籤，否則立即返回最低分
    if (basicAnswers.includes("喝") && !normalizedTags.some(tag => tag === "喝")) {
      return WEIGHT.MIN_SCORE;
    }

    // 優先檢查「吃」選項 - 如果沒有「吃一點」或「飽足」標籤，立即返回最低分
    if (basicAnswers.includes("吃") &&
      !normalizedTags.some(tag => tag === "吃一點" || tag === "飽足")) {
      return WEIGHT.MIN_SCORE;
    }

    // 優先檢查「吃一點」選項 - 必須有「吃一點」標籤，否則立即返回最低分
    if (basicAnswers.includes("吃一點") && !normalizedTags.some(tag => tag === "吃一點")) {
      return WEIGHT.MIN_SCORE;
    }

    // 優先檢查「吃飽」選項 - 必須有「飽足」標籤，否則立即返回最低分
    if (basicAnswers.includes("吃飽") && !normalizedTags.some(tag => tag === "飽足")) {
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
    // 僅保留有「飽足」標籤的餐廳
    restaurants = restaurants.filter(r => {
      const tags = r.tags ? (Array.isArray(r.tags) ? r.tags : [r.tags]) : [];
      return tags.some(tag =>
        typeof tag === 'string' && tag.toLowerCase().trim() === "飽足"
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

  // 過濾掉分數過低的餐廳
  const filteredRestaurants = sortedRestaurants.filter(r => r.matchScore >= minScoreThreshold);

  // 關鍵條件下不返回備選項，確保嚴格匹配
  if (options.strictBasicMatch &&
    (basicAnswers.includes("喝") || basicAnswers.includes("吃") ||
      basicAnswers.includes("吃一點") || basicAnswers.includes("吃飽"))) {
    return filteredRestaurants; // 不回退到排序列表，寧可返回空
  }

  // 如果沒有符合條件的餐廳，退回到分數最高的10家
  return filteredRestaurants.length > 0 ? filteredRestaurants : sortedRestaurants.slice(0, 10);
}

// 保持之前修改的 recommendForGroup 函數不變，已包含房主優先和投票機制
function recommendForGroup(allUserAnswers, restaurants, options = {}) {
  if (!allUserAnswers || Object.keys(allUserAnswers).length === 0) return [];

  // 獲取用戶數量和房主ID
  const userCount = Object.keys(allUserAnswers).length;
  const hostId = options.hostId || null; // 從 options 中獲取房主ID

  // 統計每個答案的出現次數和對應的用戶
  const answerCounts = {}; // 記錄每個答案的出現次數
  const answerUsers = {}; // 記錄選擇每個答案的用戶
  const questionSources = {}; // 記錄問題來源（基本問題還是趣味問題）
  const answerQuestionMap = {}; // 記錄答案對應的問題文本

  // 記錄每個用戶的選擇
  const userSelections = {}; // 用於記錄每個用戶選擇了哪些答案

  // 處理所有用戶的答案
  Object.entries(allUserAnswers).forEach(([userId, user]) => {
    userSelections[userId] = []; // 初始化用戶選擇數組

    // 處理結構化答案（包含問題文本和來源）
    if (user.answers && Array.isArray(user.answers) && user.questionTexts) {
      user.answers.forEach((ans, i) => {
        if (!ans) return;
        // 記錄答案出現次數
        answerCounts[ans] = (answerCounts[ans] || 0) + 1;
        // 記錄選擇此答案的用戶
        if (!answerUsers[ans]) answerUsers[ans] = [];
        answerUsers[ans].push(userId);
        // 記錄問題來源
        if (user.questionSources && user.questionSources[i]) {
          questionSources[i] = user.questionSources[i];
        } else {
          // 根據問題文本猜測來源
          const isBasic = isBasicQuestion(user.questionTexts[i]);
          questionSources[i] = isBasic ? 'basic' : 'fun';
        }
        // 記錄答案對應的問題
        answerQuestionMap[i] = user.questionTexts[i];
        // 記錄用戶選擇
        userSelections[userId].push(ans);
      });
    }
    // 處理簡單的答案數組 
    else if (Array.isArray(user)) {
      user.forEach((ans, i) => {
        if (!ans) return;
        answerCounts[ans] = (answerCounts[ans] || 0) + 1;
        if (!answerUsers[ans]) answerUsers[ans] = [];
        answerUsers[ans].push(userId);
        // 根據索引猜測問題來源
        questionSources[i] = i < options.basicQuestionsCount ? 'basic' : 'fun';
        // 記錄用戶選擇
        userSelections[userId].push(ans);
      });
    }
  });

  // 區分基本問題和趣味問題索引
  const basicIndices = [];
  const funIndices = [];
  Object.entries(questionSources).forEach(([i, source]) => {
    if (source === 'basic') basicIndices.push(Number(i));
    else funIndices.push(Number(i));
  });

  // 處理基本問題的投票結果
  // 對每個基本問題，選取票數最高的選項
  const mergedAnswers = [];
  basicIndices.forEach(index => {
    const counts = {};
    let hostChoice = null;

    // 統計所有用戶的選擇
    Object.entries(allUserAnswers).forEach(([userId, user]) => {
      let answer;
      if (user.answers && Array.isArray(user.answers)) {
        answer = user.answers[index];
      } else if (Array.isArray(user)) {
        answer = user[index];
      }

      if (answer) {
        counts[answer] = (counts[answer] || 0) + 1;
        // 記錄房主的選擇
        if (userId === hostId) {
          hostChoice = answer;
        }
      }
    });

    // 找出最高票數的選項
    let majorityChoice = null;
    let maxVotes = 0;

    Object.entries(counts).forEach(([choice, votes]) => {
      if (votes > maxVotes) {
        majorityChoice = choice;
        maxVotes = votes;
      }
      // 如果出現平票且其中一個是房主選擇的，優先選擇房主的
      else if (votes === maxVotes && choice === hostChoice) {
        majorityChoice = choice;
      }
    });

    // 如果有最高票選項，添加到合併答案中
    if (majorityChoice) {
      mergedAnswers.push(majorityChoice);
    }
  });

  // 處理趣味問題的投票結果
  // 選取前3個最受歡迎的選項
  const funCounts = {};
  funIndices.forEach(index => {
    Object.entries(allUserAnswers).forEach(([userId, user]) => {
      let answer;
      if (user.answers && Array.isArray(user.answers)) {
        answer = user.answers[index];
      } else if (Array.isArray(user)) {
        answer = user[index];
      }

      if (answer) {
        funCounts[answer] = (funCounts[answer] || 0) + 1;
      }
    });
  });

  // 對趣味問題答案按票數排序，優先考慮房主的選擇
  const sortedFunChoices = Object.entries(funCounts).sort((a, b) => {
    // 如果票數相同且其中一個是房主選擇的，優先選擇房主的
    if (a[1] === b[1]) {
      const aIsHostChoice = hostId && answerUsers[a[0]] && answerUsers[a[0]].includes(hostId);
      const bIsHostChoice = hostId && answerUsers[b[0]] && answerUsers[b[0]].includes(hostId);
      if (aIsHostChoice && !bIsHostChoice) return -1;
      if (!aIsHostChoice && bIsHostChoice) return 1;
    }
    return b[1] - a[1]; // 仍然以票數排序
  });

  // 選取前3個最受歡迎的趣味選項
  const topFunChoices = sortedFunChoices.slice(0, 3).map(([choice]) => choice);
  topFunChoices.forEach(choice => {
    if (!mergedAnswers.includes(choice)) {
      mergedAnswers.push(choice);
    }
  });

  // 設置增強的選項
  const enhancedOptions = {
    ...options,
    groupAnswerCounts: answerCounts,
    userCount,
    answerQuestionMap,
    basicQuestions: options.basicQuestions || [],
    questionSources: mergedAnswers.map((_, i) =>
      i < basicIndices.length ? 'basic' : 'fun'
    ),
    // 添加房主信息，用於後續處理
    hostId,
    hostSelections: hostId && userSelections[hostId] ? userSelections[hostId] : [],
    // 添加用戶選擇信息
    userSelections,
    // 添加答案用戶映射
    answerUsers
  };

  // 使用 recommendRestaurants 生成推薦
  let recommendedRestaurants = recommendRestaurants(mergedAnswers, restaurants, enhancedOptions);

  // 如果有房主，根據房主選擇進一步優化排序
  if (hostId && userSelections[hostId] && userSelections[hostId].length > 0 && recommendedRestaurants.length > 0) {
    // 定義一個更精確的函數來計算與房主偏好的匹配度
    const calculateHostPreferenceScore = (restaurant, hostSelections) => {
      // 參數驗證
      if (!restaurant || !hostSelections || !Array.isArray(hostSelections) || hostSelections.length === 0) {
        return 0;
      }

      // 獲取餐廳標籤 - 包括類型和標籤
      const restaurantTags = [];

      // 從餐廳類型獲取標籤
      if (restaurant.type) {
        restaurantTags.push(...restaurant.type.split(/[,、，]/).map(t => t.trim().toLowerCase()));
      }

      // 從餐廳標籤獲取標籤
      if (restaurant.tags) {
        const tags = Array.isArray(restaurant.tags) ? restaurant.tags : [restaurant.tags];
        restaurantTags.push(...tags.map(t => typeof t === 'string' ? t.toLowerCase() : ''));
      }

      // 如果沒有標籤則返回0
      if (restaurantTags.length === 0) return 0;

      // 計算精確匹配分數
      let hostMatchScore = 0;

      // 針對房主的每個選擇進行評分
      hostSelections.forEach(hostChoice => {
        if (!hostChoice) return; // 跳過無效選擇

        const lowerHostChoice = typeof hostChoice === 'string' ? hostChoice.toLowerCase() : '';

        // 檢查餐廳標籤是否精確匹配房主選擇
        if (restaurantTags.some(tag => tag === lowerHostChoice)) {
          hostMatchScore += 2.0; // 精確匹配給予較高分數
        }
        // 檢查是否部分匹配
        else if (restaurantTags.some(tag => tag.includes(lowerHostChoice) || lowerHostChoice.includes(tag))) {
          hostMatchScore += 1.0; // 部分匹配給予中等分數
        }

        // 檢查標籤映射表中是否有相關映射
        if (funQuestionTagsMap[hostChoice]) {
          const mappedTags = funQuestionTagsMap[hostChoice];

          // 遍歷映射標籤
          mappedTags.forEach(mappedTag => {
            if (!mappedTag) return; // 跳過無效標籤

            const lowerMappedTag = typeof mappedTag === 'string' ? mappedTag.toLowerCase() : '';

            // 檢查精確匹配
            if (restaurantTags.some(tag => tag === lowerMappedTag)) {
              hostMatchScore += 1.0; // 映射標籤精確匹配
            }
            // 檢查部分匹配
            else if (restaurantTags.some(tag => tag.includes(lowerMappedTag) || lowerMappedTag.includes(tag))) {
              hostMatchScore += 0.5; // 映射標籤部分匹配
            }
          });
        }
      });

      // 對分數進行歸一化處理，避免極端值
      return Math.min(hostMatchScore, 10); // 設置上限為10分
    };

    // 增加一個小的優化，優先展示與房主選擇匹配的餐廳
    recommendedRestaurants = recommendedRestaurants.map(restaurant => {
      const hostPreferenceScore = calculateHostPreferenceScore(restaurant);
      return {
        ...restaurant,
        hostPreferenceScore
      };
    });

    // 重新排序，考慮原始匹配分數和房主偏好分數
    recommendedRestaurants.sort((a, b) => {
      // 如果匹配分數接近（差距小於2分），優先考慮房主偏好
      if (Math.abs(a.matchScore - b.matchScore) < 2) {
        return b.hostPreferenceScore - a.hostPreferenceScore;
      }
      // 如果匹配分數相差不大（差距小於5分），部分考慮房主偏好
      else if (Math.abs(a.matchScore - b.matchScore) < 5) {
        // 綜合考慮匹配分數和房主偏好，權重比例為7:3
        return (b.matchScore * 0.7 + b.hostPreferenceScore * 0.3) -
          (a.matchScore * 0.7 + a.hostPreferenceScore * 0.3);
      }
      // 否則仍按原始匹配分數排序
      return b.matchScore - a.matchScore;
    });

  }

  return recommendedRestaurants;
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