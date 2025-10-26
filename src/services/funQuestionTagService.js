import { supabase } from './supabaseService.js';

// 趣味問題標籤服務
let cachedTagsMap = null;
let cachePromise = null;

export const funQuestionTagService = {
  /**
   * 獲取所有趣味問題選項的標籤映射
   * @returns {Promise<Object>} 選項到標籤的映射對象
   */
  async getFunQuestionTagsMap() {
    // 如果已經有緩存，直接返回
    if (cachedTagsMap) {
      console.log('Using cached fun question tags map');
      return cachedTagsMap;
    }

    // 如果正在載入中，等待現有的Promise
    if (cachePromise) {
      console.log('Waiting for existing load promise');
      return await cachePromise;
    }

    // 創建新的載入Promise
    cachePromise = this._loadTagsFromDatabase();
    
    try {
      cachedTagsMap = await cachePromise;
      return cachedTagsMap;
    } catch (error) {
      // 載入失敗時清除Promise，允許重試
      cachePromise = null;
      throw error;
    }
  },

  async _loadTagsFromDatabase() {
    try {
      console.log('Loading fun question tags from database...');
      const startTime = performance.now();
      
      const { data, error } = await supabase
        .from('fun_question_tags_view')
        .select('option_text, tags, weights');

      if (error) throw error;

      // 轉換為映射對象格式
      const tagsMap = {};
      data.forEach(item => {
        tagsMap[item.option_text] = {
          tags: item.tags,
          weights: item.weights
        };
      });

      const loadTime = performance.now() - startTime;
      console.log(`Loaded fun question tags map: ${Object.keys(tagsMap).length} options in ${loadTime.toFixed(2)}ms`);
      return tagsMap;
    } catch (error) {
      console.error('Failed to load fun question tags map:', error);
      
      // 回退到基本的硬編碼映射
      console.log('Using fallback tags map');
      return this.getFallbackTagsMap();
    }
  },

  /**
   * 獲取特定選項的標籤
   * @param {string} optionText - 選項文字
   * @returns {Promise<Array>} 標籤陣列
   */
  async getTagsForOption(optionText) {
    try {
      const { data, error } = await supabase
        .from('fun_question_option_tags')
        .select('tag_name, weight')
        .eq('option_text', optionText)
        .order('tag_name');

      if (error) throw error;

      return data.map(item => ({
        tag: item.tag_name,
        weight: item.weight
      }));
    } catch (error) {
      console.error(`Failed to load tags for option "${optionText}":`, error);
      
      // 回退到基本映射
      const fallbackMap = this.getFallbackTagsMap();
      return fallbackMap[optionText]?.tags.map(tag => ({ tag, weight: 1.0 })) || [];
    }
  },

  /**
   * 計算選項與餐廳標籤的匹配分數
   * @param {string} optionText - 選項文字
   * @param {Array} restaurantTags - 餐廳標籤
   * @param {Object} tagsMap - 標籤映射表（可選，用於批量計算）
   * @param {boolean} detailed - 是否返回詳細資訊
   * @returns {Promise<number|Object>} 匹配分數 (0-1) 或詳細資訊
   */
  async calculateMatchScore(optionText, restaurantTags, tagsMap = null, detailed = false) {
    try {
      // 如果沒有提供映射表，則獲取該選項的標籤
      let optionTags;
      if (tagsMap && tagsMap[optionText]) {
        optionTags = tagsMap[optionText].tags.map((tag, index) => ({
          tag,
          weight: tagsMap[optionText].weights[index] || 1.0
        }));
      } else {
        optionTags = await this.getTagsForOption(optionText);
      }

      if (!optionTags || optionTags.length === 0) {
        return detailed ? { score: 0, matchedTags: [], unmatchedTags: [] } : 0;
      }

      // 正規化餐廳標籤
      const normalizedRestaurantTags = restaurantTags
        .filter(Boolean)
        .map(tag => String(tag).toLowerCase());

      // 計算匹配程度
      let totalWeight = 0;
      let matchedWeight = 0;
      const matchedTags = [];
      const unmatchedTags = [];

      optionTags.forEach(({ tag, weight }) => {
        const safeTag = String(tag || '').toLowerCase();
        totalWeight += weight;

        const isMatched = normalizedRestaurantTags.some(rTag => rTag.includes(safeTag));

        if (isMatched) {
          matchedWeight += weight;
          if (detailed) {
            matchedTags.push({ tag, weight });
          }
        } else if (detailed) {
          unmatchedTags.push({ tag, weight });
        }
      });

      const score = totalWeight > 0 ? matchedWeight / totalWeight : 0;

      return detailed
        ? { score, matchedTags, unmatchedTags, totalWeight, matchedWeight }
        : score;
    } catch (error) {
      console.error('Failed to calculate match score:', error);
      return detailed ? { score: 0, matchedTags: [], unmatchedTags: [] } : 0;
    }
  },

  /**
   * 批量計算多個選項的匹配分數
   * @param {Array} optionTexts - 選項文字陣列
   * @param {Array} restaurantTags - 餐廳標籤
   * @param {boolean} detailed - 是否返回詳細資訊
   * @returns {Promise<number|Object>} 總匹配分數 或 { total, details }
   */
  async calculateBatchMatchScore(optionTexts, restaurantTags, detailed = false) {
    try {
      if (!optionTexts || optionTexts.length === 0) {
        return detailed ? { total: 0, details: [] } : 0;
      }

      // 獲取所有標籤映射
      const tagsMap = await this.getFunQuestionTagsMap();

      let totalScore = 0;
      const details = [];

      for (const optionText of optionTexts) {
        const result = await this.calculateMatchScore(
          optionText,
          restaurantTags,
          tagsMap,
          detailed // 傳遞 detailed 參數
        );

        const score = detailed ? result.score : result;
        totalScore += score;

        if (detailed) {
          details.push({
            option: optionText,
            score: score,
            normalizedScore: score, // 已經是 0-1 的分數
            matchedTags: result.matchedTags || [],
            unmatchedTags: result.unmatchedTags || [],
            totalWeight: result.totalWeight || 0,
            matchedWeight: result.matchedWeight || 0
          });
        }
      }

      const averageScore = totalScore / optionTexts.length;

      return detailed
        ? { total: averageScore, details }
        : averageScore;
    } catch (error) {
      console.error('Failed to calculate batch match score:', error);
      return detailed ? { total: 0, details: [] } : 0;
    }
  },

  /**
   * 清除緩存（用於重新載入）
   */
  clearCache() {
    cachedTagsMap = null;
    cachePromise = null;
    console.log('Cleared fun question tags cache');
  },

  /**
   * 回退的硬編碼標籤映射（基本版本）
   * @returns {Object} 標籤映射對象
   */
  getFallbackTagsMap() {
    return {
      "側背包": { tags: ["精緻", "咖啡廳", "文青", "小店", "現代", "簡約", "工業"], weights: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0] },
      "後背包": { tags: ["戶外", "休閒", "活力", "大型", "鄉村", "舊", "熱情"], weights: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0] },
      "Ｉ人": { tags: ["安靜", "包廂", "隱私", "小店", "簡約", "明亮", "休閒", "優雅", "舒適"], weights: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0] },
      "Ｅ人": { tags: ["熱情", "明亮活潑", "動感十足", "色彩繽紛", "喜氣", "瘋狂", "特別", "鄉村", "活力", "熱鬧", "開放", "聚會"], weights: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0] },
      "貓派": { tags: ["貓", "高級", "寧靜", "簡約", "工業", "優雅", "舒適", "溫馨", "安靜", "文青", "小店"], weights: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0] },
      "狗派": { tags: ["狗", "熱情", "鄉村", "動感十足", "喜氣", "友善", "平價", "活力", "戶外", "開放式廚房", "開放"], weights: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0] }
    };
  }
};

export default funQuestionTagService;