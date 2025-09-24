// dataValidator.js - 溫和的資料驗證工具

export const dataValidator = {
  /**
   * 驗證並清理餐廳資料，保持寬容的處理方式
   * @param {Object} restaurant - 餐廳資料
   * @returns {Object} 清理後的餐廳資料和警告
   */
  validateAndSanitizeRestaurant(restaurant) {
    const warnings = [];

    if (!restaurant || typeof restaurant !== 'object') {
      console.warn('Invalid restaurant object:', restaurant);
      return null;
    }

    // 建立清理後的餐廳物件
    const sanitized = { ...restaurant };

    // ID 檢查（必要）
    if (!restaurant.id) {
      warnings.push('Missing restaurant ID - using fallback');
      sanitized.id = `unknown_${Date.now()}_${Math.random()}`;
    }

    // 名稱檢查（必要）
    if (!restaurant.name || typeof restaurant.name !== 'string') {
      warnings.push('Invalid restaurant name - using fallback');
      sanitized.name = `未知餐廳_${sanitized.id}`;
    }

    // 標籤正規化
    sanitized.tags = this.normalizeTags(restaurant.tags, warnings);

    // 建議人數正規化
    sanitized.suggested_people = this.normalizeSuggestedPeople(restaurant.suggested_people, warnings);

    // 價格範圍正規化
    sanitized.price_range = this.normalizePriceRange(restaurant.price_range, warnings);

    // 辣度正規化
    sanitized.is_spicy = this.normalizeSpicy(restaurant.is_spicy, warnings);

    // 評分正規化
    sanitized.rating = this.normalizeRating(restaurant.rating, warnings);

    // 活躍狀態確保
    if (typeof restaurant.is_active !== 'boolean') {
      warnings.push('Invalid is_active status - defaulting to true');
      sanitized.is_active = true;
    }

    // 輸出警告但不阻斷
    if (warnings.length > 0) {
      console.warn(`Restaurant ${sanitized.name} (${sanitized.id}) data issues:`, warnings);
    }

    return sanitized;
  },

  normalizeTags(tags, warnings) {
    if (!tags) return [];

    if (Array.isArray(tags)) {
      const cleanTags = tags
        .filter(tag => tag && typeof tag === 'string')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      if (cleanTags.length !== tags.length) {
        warnings.push(`Cleaned ${tags.length - cleanTags.length} invalid tags`);
      }

      return cleanTags;
    }

    if (typeof tags === 'string' && tags.trim()) {
      return [tags.trim()];
    }

    warnings.push('Invalid tags format - defaulting to empty array');
    return [];
  },

  normalizeSuggestedPeople(people, warnings) {
    if (typeof people === 'string') return people;
    if (people === null || people === undefined) return '';

    warnings.push('Invalid suggested_people format - converting to string');
    return String(people);
  },

  normalizePriceRange(range, warnings) {
    if (range === null || range === undefined) {
      warnings.push('Missing price_range - defaulting to 2');
      return 2;
    }

    const num = Number(range);
    if (isNaN(num)) {
      warnings.push(`Invalid price_range "${range}" - defaulting to 2`);
      return 2;
    }

    const normalized = Math.max(1, Math.min(3, Math.round(num)));
    if (normalized !== num) {
      warnings.push(`Adjusted price_range from ${num} to ${normalized}`);
    }

    return normalized;
  },

  normalizeSpicy(spicy, warnings) {
    if (spicy === null || spicy === undefined) return null;

    // 支援新的格式：'true', 'false', 'both'
    if (typeof spicy === 'string') {
      const lower = spicy.toLowerCase().trim();

      // 直接支援的字串值
      if (['true', 'false', 'both'].includes(lower)) {
        return lower;
      }

      // 智能轉換
      if (['yes', '是', '辣', '1'].includes(lower)) {
        warnings.push(`Converted spicy "${spicy}" to 'true'`);
        return 'true';
      }
      if (['no', '否', '不辣', '0'].includes(lower)) {
        warnings.push(`Converted spicy "${spicy}" to 'false'`);
        return 'false';
      }
      if (['both', '都有', '兩種', 'both_spicy_nonspicy'].includes(lower)) {
        warnings.push(`Converted spicy "${spicy}" to 'both'`);
        return 'both';
      }
    }

    // 向後兼容 boolean 值
    if (typeof spicy === 'boolean') {
      const converted = spicy ? 'true' : 'false';
      warnings.push(`Converted boolean spicy ${spicy} to '${converted}'`);
      return converted;
    }

    warnings.push(`Invalid is_spicy value "${spicy}" - defaulting to null`);
    return null;
  },

  normalizeRating(rating, warnings) {
    if (rating === null || rating === undefined) return 0;

    const num = Number(rating);
    if (isNaN(num)) {
      warnings.push(`Invalid rating "${rating}" - defaulting to 0`);
      return 0;
    }

    const normalized = Math.max(0, Math.min(5, num));
    if (normalized !== num) {
      warnings.push(`Adjusted rating from ${num} to ${normalized}`);
    }

    return normalized;
  },

  /**
   * 批量驗證餐廳列表
   * @param {Array} restaurants - 餐廳列表
   * @returns {Array} 清理後的餐廳列表
   */
  validateRestaurantList(restaurants) {
    if (!Array.isArray(restaurants)) {
      console.warn('Restaurants is not an array:', typeof restaurants);
      return [];
    }

    const validatedRestaurants = [];
    let invalidCount = 0;

    restaurants.forEach((restaurant, index) => {
      const validated = this.validateAndSanitizeRestaurant(restaurant);
      if (validated) {
        validatedRestaurants.push(validated);
      } else {
        invalidCount++;
        console.warn(`Skipped invalid restaurant at index ${index}`);
      }
    });

    if (invalidCount > 0) {
      console.warn(`Total invalid restaurants skipped: ${invalidCount}/${restaurants.length}`);
    }

    console.log(`Successfully validated ${validatedRestaurants.length} restaurants`);
    return validatedRestaurants;
  }
};

// 種子隨機函數（用於一致性但有時間變化）
function seededRandom(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) / 2147483648;
}

export { seededRandom };