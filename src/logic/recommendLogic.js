import { restaurantData } from '../data/localRestaurants';

// 隨機抽取三題趣味問題
export const getRandomFunQuestions = (allQuestions) => {
  const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3);
};

// 根據回答過濾餐廳
export const recommendRestaurants = (basicAnswers, funAnswers) => {
  return restaurantData.filter(r => {
    // 範例邏輯：
    if (basicAnswers.includes("喝") && !r.tags.includes("飲料")) return false;
    if (basicAnswers.includes("辣") && !r.tags.some(tag => tag.includes("辣"))) return false;
    return true; // 其他先不限制
  });
};
