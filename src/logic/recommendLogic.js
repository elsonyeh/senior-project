// 隨機抽取三題趣味問題
export const getRandomFunQuestions = (allQuestions) => {
  const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3);
};

// 根據回答過濾餐廳（支援 Firebase 資料格式 + 容錯處理）
export const recommendRestaurants = (answers, restaurants) => {
  return restaurants.filter((r) => {
    // 🔍 標準化價格：$ -> 低, $$ -> 中, $$$ -> 高
    const priceMap = { "$": "低", "$$": "中", "$$$": "高" };
    const normalizedPrice = priceMap[r.priceRange] || r.priceRange;

    // 🔍 處理 suggestedPeople 字串變陣列（如 "1~4" → 推論含單人與多人）
    let peopleTags = [];
    if (Array.isArray(r.suggestedPeople)) {
      peopleTags = r.suggestedPeople;
    } else if (typeof r.suggestedPeople === "string") {
      const n = r.suggestedPeople;
      if (n.includes("1")) peopleTags.push("單人");
      if (n.match(/[2-9]/)) peopleTags.push("多人");
    }

    if (answers.includes("喝") && !r.tags?.some(tag => tag.includes("飲") || tag.includes("喝"))) return false;
    if (answers.includes("辣") && !r.isSpicy) return false;

    if (answers.includes("奢華美食") && normalizedPrice !== "高") return false;
    if (answers.includes("平價美食") && normalizedPrice !== "低") return false;

    if (answers.includes("單人") && !peopleTags.includes("單人")) return false;
    if (answers.includes("多人") && !peopleTags.includes("多人")) return false;

    return true;
  });
};