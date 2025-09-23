// 資料分析服務 - 整合 SwiftTaste 和 Buddies 資料統計
import { supabase } from './supabaseService.js';
import { authService } from './authService.js';

class DataAnalyticsService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5分鐘快取
  }

  // 清除快取
  clearCache() {
    this.cache.clear();
    console.log('Analytics cache cleared');
  }

  // 強制重新載入所有統計數據
  async forceRefresh() {
    this.clearCache();
    const userStats = await this.getUserStats();
    const modeStats = await this.getModeStats();
    const interactionStats = await this.getInteractionStats();

    console.log('Refreshed analytics data:', {
      userStats,
      modeStats,
      interactionStats
    });

    return {
      userStats,
      modeStats,
      interactionStats
    };
  }

  // 獲取快取或執行查詢
  async getCachedData(key, queryFn) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const data = await queryFn();
      this.cache.set(key, {
        data,
        timestamp: Date.now()
      });
      return data;
    } catch (error) {
      console.error(`Failed to get ${key}:`, error);
      return null;
    }
  }

  // 獲取用戶統計
  async getUserStats() {
    return await this.getCachedData('userStats', async () => {
      try {
        let registeredUsers = 0;
        let activeUsers = 0;
        let newUsers = 0;
        let anonymousSessions = 0;

        // 主要數據來源：user_profiles 表格獲取註冊用戶數
        try {
          const { count: totalProfilesCount } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true });

          registeredUsers = totalProfilesCount || 0;

          // 獲取最近30天新註冊的用戶
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const { count: newUsersCount } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', thirtyDaysAgo.toISOString());

          newUsers = newUsersCount || 0;

          // 獲取活躍用戶數（最近30天有使用記錄的用戶）
          const { data: recentSessions } = await supabase
            .from('user_selection_history')
            .select('user_id')
            .gte('started_at', thirtyDaysAgo.toISOString())
            .not('user_id', 'is', null);

          if (recentSessions) {
            const activeUserIds = new Set(recentSessions.map(s => s.user_id));
            activeUsers = activeUserIds.size;
          }

        } catch (profilesError) {
          console.warn('user_profiles not available:', profilesError);
          registeredUsers = 0;
          newUsers = 0;
        }

        // 獲取匿名會話數（從 user_selection_history 中沒有 user_id 的記錄）
        try {
          const { count: anonymousCount } = await supabase
            .from('user_selection_history')
            .select('*', { count: 'exact', head: true })
            .is('user_id', null);

          anonymousSessions = anonymousCount || 0;
        } catch (historyError) {
          console.warn('user_selection_history not available:', historyError);
          anonymousSessions = 0;
        }

        const totalUsers = registeredUsers + anonymousSessions;

        console.log('User stats:', {
          registeredUsers,
          activeUsers,
          anonymousSessions,
          newUsers,
          totalUsers
        });

        return {
          registeredUsers,
          activeUsers,
          anonymousSessions,
          newUsers,
          totalUsers
        };
      } catch (error) {
        console.error('Error in getUserStats:', error);
        return {
          registeredUsers: 0,
          activeUsers: 0,
          anonymousSessions: 0,
          newUsers: 0,
          totalUsers: 0
        };
      }
    });
  }

  // 獲取選擇模式統計
  async getModeStats() {
    return await this.getCachedData('modeStats', async () => {
      try {
        // 先獲取所有資料進行統計（簡化查詢）
        const { data: allSessions, error } = await supabase
          .from('user_selection_history')
          .select('mode, completed_at, session_duration');

        if (error) {
          console.warn('Failed to get mode stats:', error);
          return {
            swiftTasteSessions: 0,
            buddiesSessions: 0,
            totalBuddiesRooms: 0,
            completedSessions: 0,
            totalSessions: 0,
            avgDuration: 0
          };
        }

        // 統計各種模式
        let swiftTasteSessions = 0;
        let buddiesSessionsFromHistory = 0;
        let completedSessions = 0;
        let totalDuration = 0;
        let durationCount = 0;

        allSessions?.forEach(session => {
          if (session.mode === 'swifttaste') {
            swiftTasteSessions++;
          } else if (session.mode === 'buddies') {
            buddiesSessionsFromHistory++;
          }

          if (session.completed_at) {
            completedSessions++;
          }

          if (session.session_duration && session.session_duration > 0) {
            totalDuration += session.session_duration;
            durationCount++;
          }
        });

        // Buddies 房間總數（嘗試查詢，失敗時設為 0）
        let totalBuddiesRooms = 0;
        try {
          const { count } = await supabase
            .from('buddies_rooms')
            .select('*', { count: 'exact', head: true });
          totalBuddiesRooms = count || 0;
        } catch (roomError) {
          console.warn('Failed to get buddies rooms count:', roomError);
        }

        const avgDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;

        // 如果沒有任何會話數據，返回空統計
        if (swiftTasteSessions === 0 && buddiesSessionsFromHistory === 0) {
          return {
            swiftTasteSessions: 0,
            buddiesSessions: 0,
            totalBuddiesRooms,
            completedSessions: 0,
            totalSessions: 0,
            avgDuration: 0
          };
        }

        return {
          swiftTasteSessions,
          buddiesSessions: buddiesSessionsFromHistory,
          totalBuddiesRooms,
          completedSessions,
          totalSessions: swiftTasteSessions + buddiesSessionsFromHistory,
          avgDuration
        };
      } catch (error) {
        console.error('Error in getModeStats:', error);
        return {
          swiftTasteSessions: 0,
          buddiesSessions: 0,
          totalBuddiesRooms: 0,
          completedSessions: 0,
          totalSessions: 0,
          avgDuration: 0
        };
      }
    });
  }

  // 獲取用戶互動統計
  async getInteractionStats() {
    return await this.getCachedData('interactionStats', async () => {
      try {
        // 嘗試獲取所有記錄進行統計
        const { data: allRecords, error } = await supabase
          .from('user_selection_history')
          .select('*');

        if (error) {
          console.error('Error fetching interaction stats:', error);
          return {
            totalSwipes: 0,
            totalLikedRestaurants: 0,
            finalChoices: 0,
            avgSatisfaction: 0,
            satisfactionCount: 0
          };
        }

        let totalSwipes = 0;
        let totalLikedRestaurants = 0;
        let finalChoices = 0;
        let satisfactionSum = 0;
        let satisfactionCount = 0;

        allRecords?.forEach(record => {
          // 統計滑動次數
          totalSwipes += record.swipe_count || 0;

          // 統計喜歡的餐廳
          const liked = record.liked_restaurants || [];
          if (Array.isArray(liked)) {
            totalLikedRestaurants += liked.length;
          }

          // 統計最終選擇
          if (record.final_restaurant) {
            finalChoices++;
          }

          // 統計滿意度
          if (record.user_satisfaction) {
            satisfactionSum += record.user_satisfaction;
            satisfactionCount++;
          }
        });

        const avgSatisfaction = satisfactionCount > 0 ? satisfactionSum / satisfactionCount : 0;

        // 如果沒有任何互動數據，返回空統計
        if (totalSwipes === 0 && totalLikedRestaurants === 0 && finalChoices === 0) {
          return {
            totalSwipes: 0,
            totalLikedRestaurants: 0,
            finalChoices: 0,
            avgSatisfaction: 0,
            satisfactionCount: 0
          };
        }

        return {
          totalSwipes,
          totalLikedRestaurants,
          finalChoices,
          avgSatisfaction: parseFloat(avgSatisfaction.toFixed(2)),
          satisfactionCount
        };
      } catch (error) {
        console.error('Failed to get interaction stats:', error);
        return {
          totalSwipes: 0,
          totalLikedRestaurants: 0,
          finalChoices: 0,
          avgSatisfaction: 0,
          satisfactionCount: 0
        };
      }
    });
  }

  // 獲取問題統計
  async getQuestionStats() {
    return await this.getCachedData('questionStats', async () => {
      // 從 SwiftTaste 模式獲取問題統計
      const { data: swiftTasteData } = await supabase
        .from('user_selection_history')
        .select('basic_answers, fun_answers')
        .eq('mode', 'swifttaste');

      // 從 Buddies 系統獲取問題統計
      const { data: buddiesAnswersData } = await supabase
        .from('buddies_answers')
        .select('answers, question_texts');

      // 處理基本問題統計
      const basicAnswers = swiftTasteData?.filter(d => d.basic_answers && Array.isArray(d.basic_answers)).map(d => d.basic_answers) || [];
      const basicQuestionStats = this.processQuestionAnswers(basicAnswers);

      // 處理趣味問題統計
      const funAnswers = swiftTasteData?.filter(d => d.fun_answers && Array.isArray(d.fun_answers)).map(d => d.fun_answers) || [];
      const funQuestionStats = this.processQuestionAnswers(funAnswers);

      // 處理 Buddies 問題統計
      const buddiesQuestionStats = this.processBuddiesAnswers(buddiesAnswersData || []);

      return {
        basicQuestions: basicQuestionStats,
        funQuestions: funQuestionStats,
        buddiesQuestions: buddiesQuestionStats,
        totalBasicAnswers: basicAnswers.length,
        totalFunAnswers: funAnswers.length,
        totalBuddiesAnswers: buddiesAnswersData?.length || 0
      };
    });
  }

  // 處理問題答案統計
  processQuestionAnswers(answersArray) {
    const questionStats = {};

    answersArray.forEach(answers => {
      if (Array.isArray(answers)) {
        answers.forEach((answer, index) => {
          const questionKey = `question_${index + 1}`;
          if (!questionStats[questionKey]) {
            questionStats[questionKey] = {};
          }

          const answerValue = typeof answer === 'object' ? JSON.stringify(answer) : String(answer);
          questionStats[questionKey][answerValue] = (questionStats[questionKey][answerValue] || 0) + 1;
        });
      }
    });

    return questionStats;
  }

  // 處理 Buddies 答案統計
  processBuddiesAnswers(answersData) {
    const questionStats = {};

    answersData.forEach(record => {
      const answers = record.answers || [];
      const questionTexts = record.question_texts || [];

      answers.forEach((answer, index) => {
        const questionText = questionTexts[index] || `Question ${index + 1}`;
        const questionKey = questionText.substring(0, 50); // 限制長度

        if (!questionStats[questionKey]) {
          questionStats[questionKey] = {};
        }

        const answerValue = typeof answer === 'object' ? JSON.stringify(answer) : String(answer);
        questionStats[questionKey][answerValue] = (questionStats[questionKey][answerValue] || 0) + 1;
      });
    });

    return questionStats;
  }

  // 獲取餐廳統計
  async getRestaurantStats() {
    return await this.getCachedData('restaurantStats', async () => {
      // 從 SwiftTaste 獲取餐廳資料
      const { data: swiftTasteData } = await supabase
        .from('user_selection_history')
        .select('recommended_restaurants, final_restaurant, liked_restaurants')
        .eq('mode', 'swifttaste');

      // 從所有記錄獲取最終選擇
      const { data: allFinalChoices } = await supabase
        .from('user_selection_history')
        .select('final_restaurant');

      // 從所有記錄獲取喜愛餐廳
      const { data: allLikedData } = await supabase
        .from('user_selection_history')
        .select('liked_restaurants');

      // 從 Buddies 推薦統計
      const { data: buddiesRecommendedData } = await supabase
        .from('buddies_recommendations')
        .select('restaurants');

      // 處理推薦餐廳統計
      const recommendedRestaurants = swiftTasteData?.filter(d => d.recommended_restaurants).map(d => d.recommended_restaurants) || [];
      const recommendedStats = this.processRestaurantData(recommendedRestaurants);

      // 處理最終選擇統計
      const finalChoices = allFinalChoices?.filter(d => d.final_restaurant).map(d => d.final_restaurant) || [];
      const finalChoiceStats = this.processRestaurantData(finalChoices);

      // 處理喜愛餐廳統計
      const likedRestaurants = allLikedData?.filter(d => d.liked_restaurants).map(d => d.liked_restaurants) || [];
      const likedStats = this.processRestaurantData(likedRestaurants);

      // 處理 Buddies 推薦統計
      const buddiesRecommended = buddiesRecommendedData?.map(d => d.restaurants) || [];
      const buddiesRecommendedStats = this.processRestaurantData(buddiesRecommended);

      return {
        recommendedRestaurants: recommendedStats,
        finalChoices: finalChoiceStats,
        likedRestaurants: likedStats,
        buddiesRecommended: buddiesRecommendedStats,
        totalRecommendations: Object.values(recommendedStats).reduce((sum, count) => sum + count, 0),
        totalFinalChoices: Object.values(finalChoiceStats).reduce((sum, count) => sum + count, 0),
        totalLikes: Object.values(likedStats).reduce((sum, count) => sum + count, 0)
      };
    });
  }

  // 處理餐廳資料統計
  processRestaurantData(restaurantArrays) {
    const restaurantStats = {};

    restaurantArrays.forEach(restaurants => {
      if (Array.isArray(restaurants)) {
        restaurants.forEach(restaurant => {
          if (restaurant && (restaurant.name || restaurant.id)) {
            const key = restaurant.name || restaurant.id || 'Unknown';
            restaurantStats[key] = (restaurantStats[key] || 0) + 1;
          }
        });
      } else if (restaurants && (restaurants.name || restaurants.id)) {
        const key = restaurants.name || restaurants.id || 'Unknown';
        restaurantStats[key] = (restaurantStats[key] || 0) + 1;
      }
    });

    return restaurantStats;
  }

  // 獲取時間趨勢統計
  async getTimeTrendStats(days = 30) {
    return await this.getCachedData(`timeTrend_${days}`, async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: sessionData } = await supabase
        .from('user_selection_history')
        .select('started_at, mode, completed_at')
        .gte('started_at', startDate.toISOString())
        .order('started_at', { ascending: true });

      // 按日期統計
      const dailyStats = {};

      sessionData?.forEach(session => {
        const date = new Date(session.started_at).toDateString();

        if (!dailyStats[date]) {
          dailyStats[date] = {
            date,
            swifttaste: 0,
            buddies: 0,
            completed: 0,
            total: 0
          };
        }

        dailyStats[date][session.mode]++;
        dailyStats[date].total++;

        if (session.completed_at) {
          dailyStats[date].completed++;
        }
      });

      return Object.values(dailyStats);
    });
  }

  // 獲取地理位置統計
  async getLocationStats() {
    return await this.getCachedData('locationStats', async () => {
      const { data: locationData } = await supabase
        .from('user_selection_history')
        .select('user_location');

      const locationStats = {};

      locationData?.forEach(record => {
        const location = record.user_location;
        if (location && location.address) {
          // 簡化地址到城市層級
          const city = this.extractCityFromAddress(location.address);
          locationStats[city] = (locationStats[city] || 0) + 1;
        }
      });

      return locationStats;
    });
  }

  // 從地址提取城市
  extractCityFromAddress(address) {
    if (!address) return 'Unknown';

    // 台灣地址格式處理
    const cityMatches = address.match(/(台北市|新北市|桃園市|台中市|台南市|高雄市|基隆市|新竹市|嘉義市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|宜蘭縣|花蓮縣|台東縣|澎湖縣|金門縣|連江縣)/);

    if (cityMatches) {
      return cityMatches[1];
    }

    // 如果沒有匹配到，返回前幾個字
    return address.substring(0, 10);
  }

  // 獲取用戶人口統計分析
  async getUserDemographics() {
    return await this.getCachedData('userDemographics', async () => {
      try {
        const { data: profiles, error } = await supabase
          .from('user_profiles')
          .select('gender, birth_date, occupation, location, created_at')
          .not('gender', 'is', null)
          .or('birth_date.not.is.null,occupation.not.is.null,location.not.is.null');

        if (error) {
          console.warn('Failed to get user demographics:', error);
          return {
            genderDistribution: {},
            ageGroups: {},
            occupationCategories: {},
            locationDistribution: {},
            totalProfilesWithData: 0
          };
        }

        const genderStats = {};
        const ageStats = {};
        const occupationStats = {};
        const locationStats = {};

        const currentYear = new Date().getFullYear();

        profiles?.forEach(profile => {
          // 性別統計
          if (profile.gender) {
            const genderLabel = this.getGenderLabel(profile.gender);
            genderStats[genderLabel] = (genderStats[genderLabel] || 0) + 1;
          }

          // 年齡組統計（基於生日計算）
          if (profile.birth_date) {
            const birthYear = new Date(profile.birth_date).getFullYear();
            const age = currentYear - birthYear;
            const ageGroup = this.getAgeGroup(age);
            ageStats[ageGroup] = (ageStats[ageGroup] || 0) + 1;
          }

          // 職業統計
          if (profile.occupation) {
            const occupation = profile.occupation.trim();
            if (occupation) {
              occupationStats[occupation] = (occupationStats[occupation] || 0) + 1;
            }
          }

          // 地理位置統計
          if (profile.location) {
            const location = profile.location.trim();
            if (location) {
              locationStats[location] = (locationStats[location] || 0) + 1;
            }
          }
        });

        return {
          genderDistribution: genderStats,
          ageGroups: ageStats,
          occupationCategories: occupationStats,
          locationDistribution: locationStats,
          totalProfilesWithData: profiles?.length || 0
        };
      } catch (error) {
        console.error('Error in getUserDemographics:', error);
        return {
          genderDistribution: {},
          ageGroups: {},
          occupationCategories: {},
          locationDistribution: {},
          totalProfilesWithData: 0
        };
      }
    });
  }

  // 獲取性別標籤
  getGenderLabel(gender) {
    const genderLabels = {
      'male': '男性',
      'female': '女性',
      'other': '其他',
      'prefer_not_to_say': '不願透露'
    };
    return genderLabels[gender] || '未設定';
  }

  // 獲取年齡組
  getAgeGroup(age) {
    if (age < 18) return '18歲以下';
    if (age <= 25) return '18-25歲';
    if (age <= 35) return '26-35歲';
    if (age <= 45) return '36-45歲';
    if (age <= 55) return '46-55歲';
    if (age <= 65) return '56-65歲';
    return '65歲以上';
  }

  // 獲取總覽統計
  async getOverviewStats() {
    const [userStats, modeStats, interactionStats, questionStats, restaurantStats, userDemographics] = await Promise.all([
      this.getUserStats(),
      this.getModeStats(),
      this.getInteractionStats(),
      this.getQuestionStats(),
      this.getRestaurantStats(),
      this.getUserDemographics()
    ]);

    return {
      users: userStats,
      modes: modeStats,
      interactions: interactionStats,
      questions: questionStats,
      restaurants: restaurantStats,
      demographics: userDemographics,
      lastUpdated: new Date().toISOString()
    };
  }

  // 獲取實時統計（不使用快取）
  async getLiveStats() {
    this.clearCache();
    return await this.getOverviewStats();
  }

  // 導出統計資料為 CSV
  async exportStatsToCsv(statsType = 'overview') {
    try {
      let data;

      switch (statsType) {
        case 'users':
          data = await this.getUserStats();
          break;
        case 'modes':
          data = await this.getModeStats();
          break;
        case 'interactions':
          data = await this.getInteractionStats();
          break;
        case 'restaurants':
          data = await this.getRestaurantStats();
          break;
        default:
          data = await this.getOverviewStats();
      }

      return this.convertToCSV(data, statsType);
    } catch (error) {
      console.error('Failed to export stats to CSV:', error);
      return null;
    }
  }

  // 轉換資料為 CSV 格式
  convertToCSV(data, type) {
    const timestamp = new Date().toISOString().substring(0, 10);
    let csv = `SwiftTaste Analytics Export - ${type}\nExported on: ${timestamp}\n\n`;

    const flattenObject = (obj, prefix = '') => {
      let result = [];
      for (const key in obj) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          result = result.concat(flattenObject(value, newKey));
        } else {
          result.push([newKey, value]);
        }
      }
      return result;
    };

    const flatData = flattenObject(data);
    csv += 'Metric,Value\n';
    flatData.forEach(([key, value]) => {
      csv += `"${key}","${value}"\n`;
    });

    return csv;
  }
}

// 創建單例實例
export const dataAnalyticsService = new DataAnalyticsService();

// 導出類別以供測試使用
export { DataAnalyticsService };

export default dataAnalyticsService;