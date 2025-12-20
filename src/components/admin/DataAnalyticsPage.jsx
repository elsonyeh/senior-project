import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, ComposedChart
} from 'recharts';
import { dataAnalyticsService } from '../../services/dataAnalyticsService';
import { supabase } from '../../services/supabaseService.js';
import './DataAnalyticsPage.css';

export default function DataAnalyticsPage() {
  const [timeRange, setTimeRange] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    users: { totalUsers: 0, registeredUsers: 0, activeUsers: 0, anonymousSessions: 0, newUsers: 0 },
    modes: { swiftTasteSessions: 0, buddiesSessions: 0, totalBuddiesRooms: 0, completedSessions: 0, totalSessions: 0, avgDuration: 0 },
    interactions: { totalSwipes: 0, totalLikedRestaurants: 0, finalChoices: 0, avgSatisfaction: 0 },
    restaurants: { totalRecommendations: 0, totalFinalChoices: 0, totalLikes: 0, finalChoices: {}, likedRestaurants: {} },
    demographics: { genderDistribution: {}, ageGroups: {} },
    questions: { basicQuestions: {}, funQuestions: {}, buddiesQuestions: {} }
  });

  const [swiftTasteMetrics, setSwiftTasteMetrics] = useState({
    totalSessions: 0,
    completedSessions: 0,
    incompleteSessions: 0,
    completionRate: 0,
    totalSwipes: 0,
    avgSwipes: 0,
    avgLikes: 0,
    avgDuration: 0,
    conversionRate: 0,
    avgDecisionSpeed: 0
  });

  const [buddiesMetrics, setBuddiesMetrics] = useState({
    totalRooms: 0,
    completedRooms: 0,
    incompleteRooms: 0,
    avgMembersPerRoom: 0,
    avgSessionDuration: 0,
    completionRate: 0,
    totalVotes: 0,
    avgVotesPerRoom: 0
  });

  const [restaurantSuccessData, setRestaurantSuccessData] = useState([]);
  const [allRestaurantRankings, setAllRestaurantRankings] = useState([]);
  const [funQuestionStats, setFunQuestionStats] = useState([]);
  const [demographicAnalysis, setDemographicAnalysis] = useState({
    byAge: [],
    byGender: [],
    crossAnalysis: []
  });
  const [anonymousData, setAnonymousData] = useState({
    totalAnonymous: 0,
    anonymousSwiftTaste: 0,
    anonymousBuddies: 0,
    completelyAnonymous: 0, // 完全匿名（未登錄）
    incompleteProfile: 0    // 已登錄但未完成註冊
  });

  const [timeTrendData, setTimeTrendData] = useState([]);

  // 新增：進階分析數據
  const [userClassification, setUserClassification] = useState(null);
  const [sessionSource, setSessionSource] = useState(null);
  const [modeComparison, setModeComparison] = useState([]);
  const [userActivityRanking, setUserActivityRanking] = useState([]);
  const [conversionStats, setConversionStats] = useState(null);

  const [showSwiftTasteModal, setShowSwiftTasteModal] = useState(false);
  const [showBuddiesModal, setShowBuddiesModal] = useState(false);

  // 詳細數據查看
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailData, setDetailData] = useState({ title: '', data: [], stats: {}, mode: '' });
  const [buddiesRawData, setBuddiesRawData] = useState([]);
  const [swiftTasteRawData, setSwiftTasteRawData] = useState([]);

  // 載入所有數據
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        overviewStats,
        swiftTasteData,
        buddiesData,
        { top20, allRankings },
        funQuestions,
        demographics,
        anonymousStats,
        timeTrend,
        userClassStats,
        sessionSourceStats,
        modeComparisonData,
        userActivityData,
        conversionData
      ] = await Promise.all([
        dataAnalyticsService.getOverviewStats(),
        loadSwiftTasteMetrics(),
        loadBuddiesMetrics(),
        loadRestaurantSuccessMetrics(),
        loadFunQuestionStats(),
        loadDemographicAnalysis(),
        loadAnonymousData(),
        loadTimeTrendData(),
        loadUserClassification(),
        loadSessionSource(),
        loadModeComparison(),
        loadUserActivityRanking(),
        loadConversionStats()
      ]);

      setStats(overviewStats);
      setSwiftTasteMetrics(swiftTasteData);
      setBuddiesMetrics(buddiesData);
      setRestaurantSuccessData(top20);
      setAllRestaurantRankings(allRankings);
      setFunQuestionStats(funQuestions);
      setDemographicAnalysis(demographics);
      setAnonymousData(anonymousStats);
      setTimeTrendData(timeTrend);
      setUserClassification(userClassStats);
      setSessionSource(sessionSourceStats);
      setModeComparison(modeComparisonData);
      setUserActivityRanking(userActivityData);
      setConversionStats(conversionData);

    } catch (err) {
      console.error('載入統計數據失敗:', err);
      setError('載入數據時發生錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 載入 SwiftTaste 指標
  const loadSwiftTasteMetrics = async () => {
    try {
      const { data: sessions } = await supabase
        .from('user_selection_history')
        .select('*')
        .eq('mode', 'swifttaste');

      if (!sessions || sessions.length === 0) {
        setSwiftTasteRawData([]);
        return {
          totalSessions: 0,
          completedSessions: 0,
          incompleteSessions: 0,
          completionRate: 0,
          totalSwipes: 0,
          avgSwipes: 0,
          avgLikes: 0,
          avgDuration: 0,
          conversionRate: 0,
          avgDecisionSpeed: 0
        };
      }

      // 篩選已完成的會話
      const completedSessions = sessions.filter(s => s.completed_at !== null && s.completed_at !== undefined);
      const completed = completedSessions.length;
      const incomplete = sessions.length - completed;

      // 計算總滑動和喜歡（所有會話）
      const totalSwipes = sessions.reduce((sum, s) => sum + (s.swipe_count || 0), 0);
      const totalLikes = sessions.reduce((sum, s) => sum + (s.liked_restaurants?.length || 0), 0);

      // 計算已完成會話的總時長
      const completedDuration = completedSessions.reduce((sum, s) => sum + (s.session_duration || 0), 0);
      const avgDuration = completed > 0 ? Math.round(completedDuration / completed) : 0;

      // 最終選擇次數
      const withFinalChoice = sessions.filter(s => s.final_restaurant).length;

      // 計算平均決策速度（已完成會話的秒/滑動）
      const completedSwipes = completedSessions.reduce((sum, s) => sum + (s.swipe_count || 0), 0);
      const avgDecisionSpeed = completedSwipes > 0 ? completedDuration / completedSwipes : 0;

      // 準備原始數據供詳細查看使用
      const rawData = sessions.map(session => ({
        sessionId: session.id,
        userId: session.user_id || session.session_id,
        swipeCount: session.swipe_count || 0,
        likeCount: session.liked_restaurants?.length || 0,
        duration: session.session_duration || 0,
        decisionSpeed: (session.swipe_count && session.swipe_count > 0)
          ? (session.session_duration / session.swipe_count)
          : 0,
        completed: !!session.completed_at,
        hasFinalChoice: !!session.final_restaurant,
        startedAt: session.started_at
      }));

      setSwiftTasteRawData(rawData);

      return {
        totalSessions: sessions.length,
        completedSessions: completed,
        incompleteSessions: incomplete,
        completionRate: parseFloat((completed / sessions.length * 100).toFixed(1)),
        totalSwipes,
        avgSwipes: parseFloat((totalSwipes / sessions.length).toFixed(1)),
        avgLikes: parseFloat((totalLikes / sessions.length).toFixed(1)),
        avgDuration,
        conversionRate: parseFloat((withFinalChoice / sessions.length * 100).toFixed(1)),
        avgDecisionSpeed: parseFloat(avgDecisionSpeed.toFixed(2))
      };
    } catch (error) {
      console.error('載入 SwiftTaste 指標失敗:', error);
      return {
        totalSessions: 0,
        completedSessions: 0,
        incompleteSessions: 0,
        completionRate: 0,
        totalSwipes: 0,
        avgSwipes: 0,
        avgLikes: 0,
        avgDuration: 0,
        conversionRate: 0,
        avgDecisionSpeed: 0
      };
    }
  };

  // 載入 Buddies 指標
  const loadBuddiesMetrics = async () => {
    try {
      const { data: rooms } = await supabase
        .from('buddies_rooms')
        .select('*');

      // 查詢 buddies_rooms 表結構
      // 已獲取 buddies_rooms 表數據

      const { data: sessions } = await supabase
        .from('user_selection_history')
        .select('*')
        .eq('mode', 'buddies');

      const { data: members } = await supabase
        .from('buddies_members')
        .select('room_id');

      // 從 buddies_rooms 的 votes 欄位統計投票數
      const totalVotesCount = rooms?.reduce((sum, room) => {
        if (room.votes && typeof room.votes === 'object') {
          return sum + Object.keys(room.votes).length;
        }
        return sum;
      }, 0) || 0;

      const totalRooms = rooms?.length || 0;

      // 篩選已完成的會話
      const completedSessions = sessions?.filter(s => s.completed_at !== null && s.completed_at !== undefined) || [];
      const completed = completedSessions.length;
      const incomplete = (sessions?.length || 0) - completed;

      const roomMemberCounts = {};
      members?.forEach(m => {
        roomMemberCounts[m.room_id] = (roomMemberCounts[m.room_id] || 0) + 1;
      });

      const avgMembers = Object.keys(roomMemberCounts).length > 0
        ? Object.values(roomMemberCounts).reduce((sum, c) => sum + c, 0) / Object.keys(roomMemberCounts).length
        : 0;

      const avgVotes = totalRooms > 0 ? totalVotesCount / totalRooms : 0;

      // 計算已完成會話的總時長
      const completedDuration = completedSessions.reduce((sum, s) => {
        let duration = 0;
        if (s.session_duration !== null && s.session_duration !== undefined) {
          duration = s.session_duration;
        } else if (s.started_at && s.completed_at) {
          // 計算時間差（秒）
          const startTime = new Date(s.started_at).getTime();
          const endTime = new Date(s.completed_at).getTime();
          duration = Math.round((endTime - startTime) / 1000);
        }
        return sum + duration;
      }, 0);
      const avgDuration = completed > 0 ? Math.round(completedDuration / completed) : 0;

      const completionRate = sessions && sessions.length > 0
        ? (completed / sessions.length * 100)
        : 0;

      // 準備原始數據供詳細查看使用
      const rawData = (rooms || []).map((room) => {
        const roomSessions = sessions?.filter(s => s.buddies_room_id === room.id) || [];
        const memberCount = roomMemberCounts[room.id] || 0;
        const voteCount = (room.votes && typeof room.votes === 'object') ? Object.keys(room.votes).length : 0;
        const completedSession = roomSessions.find(s => s.completed_at);

        // 計算決策時長：如果 session_duration 是 null，則通過時間差計算
        let duration = 0;
        if (completedSession) {
          if (completedSession.session_duration !== null && completedSession.session_duration !== undefined) {
            duration = completedSession.session_duration;
          } else if (completedSession.started_at && completedSession.completed_at) {
            const startTime = new Date(completedSession.started_at).getTime();
            const endTime = new Date(completedSession.completed_at).getTime();
            duration = Math.round((endTime - startTime) / 1000);
          }
        }

        return {
          roomId: room.id,
          roomCode: room.room_code || room.id,
          memberCount,
          voteCount,
          duration,
          completed: !!completedSession,
          createdAt: room.created_at
        };
      });

      setBuddiesRawData(rawData);

      return {
        totalRooms,
        completedRooms: completed,
        incompleteRooms: incomplete,
        avgMembersPerRoom: parseFloat(avgMembers.toFixed(1)),
        avgSessionDuration: Math.round(avgDuration),
        completionRate: parseFloat(completionRate.toFixed(1)),
        totalVotes: totalVotesCount,
        avgVotesPerRoom: parseFloat(avgVotes.toFixed(1))
      };
    } catch (error) {
      console.error('載入 Buddies 指標失敗:', error);
      return {
        totalRooms: 0,
        completedRooms: 0,
        incompleteRooms: 0,
        avgMembersPerRoom: 0,
        avgSessionDuration: 0,
        completionRate: 0,
        totalVotes: 0,
        avgVotesPerRoom: 0
      };
    }
  };

  // 載入餐廳成功率指標（返回 Top20 和完整排名）
  const loadRestaurantSuccessMetrics = async () => {
    try {
      const { data: sessions } = await supabase
        .from('user_selection_history')
        .select('final_restaurant, recommended_restaurants, session_duration');

      const restaurantStats = {};

      sessions?.forEach(session => {
        if (session.final_restaurant) {
          const name = session.final_restaurant.name || session.final_restaurant.id;
          if (!restaurantStats[name]) {
            restaurantStats[name] = {
              name,
              selectedCount: 0,
              recommendedCount: 0,
              totalDecisionTime: 0
            };
          }
          restaurantStats[name].selectedCount++;
          restaurantStats[name].totalDecisionTime += session.session_duration || 0;
        }

        if (session.recommended_restaurants && Array.isArray(session.recommended_restaurants)) {
          session.recommended_restaurants.forEach(restaurant => {
            const name = restaurant.name || restaurant.id;
            if (!restaurantStats[name]) {
              restaurantStats[name] = {
                name,
                selectedCount: 0,
                recommendedCount: 0,
                totalDecisionTime: 0
              };
            }
            restaurantStats[name].recommendedCount++;
          });
        }
      });

      const allRankings = Object.values(restaurantStats)
        .map(stat => ({
          name: stat.name,
          selectedCount: stat.selectedCount,
          recommendedCount: stat.recommendedCount,
          successRate: stat.recommendedCount > 0
            ? parseFloat((stat.selectedCount / stat.recommendedCount * 100).toFixed(1))
            : 0,
          avgDecisionTime: stat.selectedCount > 0
            ? Math.round(stat.totalDecisionTime / stat.selectedCount)
            : 0
        }))
        .sort((a, b) => b.selectedCount - a.selectedCount);

      return {
        top20: allRankings.slice(0, 20),
        allRankings
      };
    } catch (error) {
      console.error('載入餐廳成功率失敗:', error);
      return { top20: [], allRankings: [] };
    }
  };

  // 載入趣味問題統計（按問題分組，顯示兩個選項的對比）
  const loadFunQuestionStats = async () => {
    try {
      // 1. 載入所有趣味問題定義（使用視圖）
      const { data: questions, error: questionsError } = await supabase
        .from('questions_with_options')
        .select('*');

      if (questionsError) {
        console.error('Error loading questions:', questionsError);
        return [];
      }

      // 過濾出趣味問題
      const funQuestions = questions?.filter(q =>
        q.type === 'fun' && (q.mode === 'swifttaste' || q.mode === 'both')
      ) || [];

      // 已載入趣味問題

      // 2. 建立答案到問題的映射
      const answerToQuestion = {};
      const questionStats = {};

      funQuestions.forEach(q => {
        const option1 = q.option1_text;
        const option2 = q.option2_text;

        if (option1 && option2) {
          // 建立雙向映射
          answerToQuestion[option1] = { questionId: q.id, question: q.question_text, option1, option2 };
          answerToQuestion[option2] = { questionId: q.id, question: q.question_text, option1, option2 };

          // 初始化統計
          questionStats[q.id] = {
            question: q.question_text,
            option1: { text: option1, count: 0 },
            option2: { text: option2, count: 0 },
            totalAnswered: 0
          };
        }
      });

      // 已建立答案到問題的映射

      // 3. 載入所有選擇記錄
      const { data: sessions } = await supabase
        .from('user_selection_history')
        .select('fun_answers');

      // 4. 統計每個答案的選擇次數
      sessions?.forEach(session => {
        const answers = session.fun_answers;
        if (answers && Array.isArray(answers)) {
          answers.forEach(answer => {
            const answerText = typeof answer === 'object' ? JSON.stringify(answer) : String(answer);
            const questionInfo = answerToQuestion[answerText];

            if (questionInfo) {
              const qid = questionInfo.questionId;
              const stats = questionStats[qid];

              if (stats) {
                // 增加該問題被回答的總次數
                stats.totalAnswered++;

                // 增加對應選項的計數
                if (answerText === stats.option1.text) {
                  stats.option1.count++;
                } else if (answerText === stats.option2.text) {
                  stats.option2.count++;
                }
              }
            }
          });
        }
      });

      // 已統計問題數據

      // 5. 轉換為陣列格式，按被回答次數排序
      return Object.values(questionStats)
        .filter(stat => stat.totalAnswered > 0) // 只顯示有被回答過的問題
        .sort((a, b) => b.totalAnswered - a.totalAnswered);

    } catch (error) {
      console.error('載入趣味問題統計失敗:', error);
      return [];
    }
  };


  // 載入人口統計交叉分析
  const loadDemographicAnalysis = async () => {
    try {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, gender, birth_date');

      const { data: sessions } = await supabase
        .from('user_selection_history')
        .select('user_id, mode, final_restaurant, session_duration');

      const profileMap = {};
      profiles?.forEach(p => {
        profileMap[p.id] = p;
      });

      const byAge = {};
      const byGender = {};
      const crossData = {};

      sessions?.forEach(session => {
        const profile = profileMap[session.user_id];
        if (!profile) return;

        const age = profile.birth_date ? new Date().getFullYear() - new Date(profile.birth_date).getFullYear() : null;
        const ageGroup = age ? getAgeGroup(age) : '未知';
        const gender = getGenderLabel(profile.gender);

        // 年齡層分析
        if (!byAge[ageGroup]) {
          byAge[ageGroup] = { swifttaste: 0, buddies: 0, total: 0 };
        }
        byAge[ageGroup][session.mode]++;
        byAge[ageGroup].total++;

        // 性別分析
        if (!byGender[gender]) {
          byGender[gender] = { swifttaste: 0, buddies: 0, total: 0 };
        }
        byGender[gender][session.mode]++;
        byGender[gender].total++;

        // 交叉分析
        const key = `${gender}-${ageGroup}`;
        if (!crossData[key]) {
          crossData[key] = {
            gender,
            ageGroup,
            swifttaste: 0,
            buddies: 0,
            total: 0,
            avgDuration: 0,
            durationCount: 0
          };
        }
        crossData[key][session.mode]++;
        crossData[key].total++;
        if (session.session_duration) {
          crossData[key].avgDuration += session.session_duration;
          crossData[key].durationCount++;
        }
      });

      // 計算平均時長
      Object.values(crossData).forEach(item => {
        if (item.durationCount > 0) {
          item.avgDuration = Math.round(item.avgDuration / item.durationCount);
        }
      });

      return {
        byAge: Object.entries(byAge).map(([age, data]) => ({ ageGroup: age, ...data })),
        byGender: Object.entries(byGender).map(([gender, data]) => ({ gender, ...data })),
        crossAnalysis: Object.values(crossData).filter(item => item.total > 0)
      };
    } catch (error) {
      console.error('載入人口統計分析失敗:', error);
      return { byAge: [], byGender: [], crossAnalysis: [] };
    }
  };

  // 載入匿名用戶數據（使用 Supabase 函數繞過 RLS）
  const loadAnonymousData = async () => {
    try {
      const { data, error } = await supabase.rpc('get_anonymous_user_stats');

      if (error) {
        console.error('調用 get_anonymous_user_stats 失敗:', error);
        return {
          totalAnonymous: 0,
          anonymousSwiftTaste: 0,
          anonymousBuddies: 0,
          completelyAnonymous: 0,
          incompleteProfile: 0
        };
      }

      if (data && data.length > 0) {
        const stats = data[0];
        return {
          totalAnonymous: stats.total_anonymous || 0,
          anonymousSwiftTaste: stats.anonymous_swifttaste || 0,
          anonymousBuddies: stats.anonymous_buddies || 0,
          completelyAnonymous: stats.completely_anonymous || 0,
          incompleteProfile: stats.incomplete_profile || 0
        };
      }

      return {
        totalAnonymous: 0,
        anonymousSwiftTaste: 0,
        anonymousBuddies: 0,
        completelyAnonymous: 0,
        incompleteProfile: 0
      };
    } catch (error) {
      console.error('載入匿名數據失敗:', error);
      return {
        totalAnonymous: 0,
        anonymousSwiftTaste: 0,
        anonymousBuddies: 0,
        completelyAnonymous: 0,
        incompleteProfile: 0
      };
    }
  };

  // 載入用戶分類統計
  const loadUserClassification = async () => {
    try {
      const { data, error } = await supabase.rpc('get_user_classification_stats');
      if (error) {
        console.error('調用 get_user_classification_stats 失敗:', error);
        return null;
      }
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('載入用戶分類統計失敗:', error);
      return null;
    }
  };

  // 載入會話來源分析
  const loadSessionSource = async () => {
    try {
      const { data, error } = await supabase.rpc('get_session_source_stats');
      if (error) {
        console.error('調用 get_session_source_stats 失敗:', error);
        return null;
      }
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('載入會話來源分析失敗:', error);
      return null;
    }
  };

  // 載入模式使用對比
  const loadModeComparison = async () => {
    try {
      const { data, error } = await supabase.rpc('get_mode_usage_comparison');
      if (error) {
        console.error('調用 get_mode_usage_comparison 失敗:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('載入模式使用對比失敗:', error);
      return [];
    }
  };

  // 載入用戶活躍度排行
  const loadUserActivityRanking = async () => {
    try {
      const { data, error } = await supabase.rpc('get_user_activity_ranking', { limit_count: 10 });
      if (error) {
        console.error('調用 get_user_activity_ranking 失敗:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('載入用戶活躍度排行失敗:', error);
      return [];
    }
  };

  // 載入註冊轉化率統計
  const loadConversionStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_registration_conversion_stats');
      if (error) {
        console.error('調用 get_registration_conversion_stats 失敗:', error);
        return null;
      }
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('載入註冊轉化率統計失敗:', error);
      return null;
    }
  };

  // 載入時間趨勢數據
  const loadTimeTrendData = async () => {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeRange);

      const { data: sessions } = await supabase
        .from('user_selection_history')
        .select('started_at, mode, user_id, completed_at')
        .gte('started_at', startDate.toISOString())
        .order('started_at', { ascending: true });

      // 按日期統計
      const dailyStats = {};

      sessions?.forEach(session => {
        const date = new Date(session.started_at).toISOString().split('T')[0];

        if (!dailyStats[date]) {
          dailyStats[date] = {
            date,
            swifttaste: 0,
            buddies: 0,
            total: 0,
            completed: 0,
            registeredUsers: new Set(),
            anonymousUsers: 0
          };
        }

        // 統計各模式使用量
        dailyStats[date][session.mode]++;
        dailyStats[date].total++;

        // 統計完成次數
        if (session.completed_at !== null && session.completed_at !== undefined) {
          dailyStats[date].completed++;
        }

        // 統計用戶類型
        if (session.user_id) {
          dailyStats[date].registeredUsers.add(session.user_id);
        } else {
          dailyStats[date].anonymousUsers++;
        }
      });

      // 轉換為陣列並格式化
      return Object.values(dailyStats).map(stat => ({
        date: stat.date,
        formattedDate: new Date(stat.date).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }),
        swifttaste: stat.swifttaste,
        buddies: stat.buddies,
        total: stat.total,
        completed: stat.completed,
        activeUsers: stat.registeredUsers.size + stat.anonymousUsers,
        registeredUsers: stat.registeredUsers.size,
        anonymousUsers: stat.anonymousUsers
      }));

    } catch (error) {
      console.error('載入時間趨勢數據失敗:', error);
      return [];
    }
  };

  const getAgeGroup = (age) => {
    if (age < 18) return '18歲以下';
    if (age <= 25) return '18-25歲';
    if (age <= 35) return '26-35歲';
    if (age <= 45) return '36-45歲';
    if (age <= 55) return '46-55歲';
    if (age <= 65) return '56-65歲';
    return '65歲以上';
  };

  const getGenderLabel = (gender) => {
    const labels = {
      'male': '男性',
      'female': '女性',
      'other': '其他',
      'prefer_not_to_say': '不願透露'
    };
    return labels[gender] || '未設定';
  };

  const handleRefresh = async () => {
    dataAnalyticsService.clearCache();
    await loadData();
  };

  // 計算統計資訊
  const calculateStats = (values) => {
    if (!values || values.length === 0) {
      return {
        count: 0,
        mean: 0,
        median: 0,
        min: 0,
        max: 0,
        stdDev: 0,
        sum: 0
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / count;

    const median = count % 2 === 0
      ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
      : sorted[Math.floor(count / 2)];

    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    return {
      count,
      mean: parseFloat(mean.toFixed(2)),
      median: parseFloat(median.toFixed(2)),
      min: sorted[0],
      max: sorted[count - 1],
      stdDev: parseFloat(stdDev.toFixed(2)),
      sum
    };
  };

  // 處理點擊指標查看詳細數據（Buddies 模式）
  const handleBuddiesMetricClick = (metricType) => {
    let data = [];
    let title = '';
    let valueKey = '';
    let valueLabel = '';

    // 處理 Buddies 指標點擊

    switch (metricType) {
      case 'duration':
        title = 'Buddies 模式 - 平均決策時長詳細數據';
        valueLabel = '決策時長（秒）';
        valueKey = 'duration';
        data = buddiesRawData.filter(d => d.completed && d.duration > 0).map(d => ({
          label: `${d.roomCode}`,
          value: d.duration,
          additionalInfo: `成員數: ${d.memberCount}`,
          date: new Date(d.createdAt).toLocaleDateString('zh-TW')
        }));
        break;
      case 'members':
        title = 'Buddies 模式 - 房間人數詳細數據';
        valueLabel = '成員數量';
        valueKey = 'memberCount';
        data = buddiesRawData.map(d => ({
          label: `${d.roomCode}`,
          value: d.memberCount,
          additionalInfo: `投票數: ${d.voteCount}`,
          date: new Date(d.createdAt).toLocaleDateString('zh-TW')
        }));
        break;
      case 'votes':
        title = 'Buddies 模式 - 投票數詳細數據';
        valueLabel = '投票數';
        valueKey = 'voteCount';
        data = buddiesRawData.map(d => ({
          label: `${d.roomCode}`,
          value: d.voteCount,
          additionalInfo: `成員數: ${d.memberCount}`,
          date: new Date(d.createdAt).toLocaleDateString('zh-TW')
        }));
        break;
      default:
        return;
    }

    const values = data.map(d => d.value);
    const stats = calculateStats(values);

    // 已計算統計資訊

    setDetailData({
      title,
      valueLabel,
      data,
      stats,
      mode: 'buddies'
    });
    setShowDetailModal(true);
  };

  // 處理點擊指標查看詳細數據（SwiftTaste 模式）
  const handleSwiftTasteMetricClick = (metricType) => {
    let data = [];
    let title = '';
    let valueLabel = '';

    switch (metricType) {
      case 'duration':
        title = 'SwiftTaste 模式 - 決策時長詳細數據';
        valueLabel = '決策時長（秒）';
        data = swiftTasteRawData.filter(d => d.completed).map((d, idx) => ({
          label: `會話 #${idx + 1}`,
          value: d.duration,
          additionalInfo: `滑動次數: ${d.swipeCount}`,
          date: new Date(d.startedAt).toLocaleDateString('zh-TW')
        }));
        break;
      case 'swipes':
        title = 'SwiftTaste 模式 - 滑動次數詳細數據';
        valueLabel = '滑動次數';
        data = swiftTasteRawData.map((d, idx) => ({
          label: `會話 #${idx + 1}`,
          value: d.swipeCount,
          additionalInfo: `喜歡數: ${d.likeCount}`,
          date: new Date(d.startedAt).toLocaleDateString('zh-TW')
        }));
        break;
      case 'decisionSpeed':
        title = 'SwiftTaste 模式 - 每次滑動時長詳細數據';
        valueLabel = '每次滑動時長（秒）';
        data = swiftTasteRawData.filter(d => d.swipeCount > 0).map((d, idx) => ({
          label: `會話 #${idx + 1}`,
          value: parseFloat(d.decisionSpeed.toFixed(2)),
          additionalInfo: `總時長: ${d.duration}秒`,
          date: new Date(d.startedAt).toLocaleDateString('zh-TW')
        }));
        break;
      case 'likes':
        title = 'SwiftTaste 模式 - 喜歡數量詳細數據';
        valueLabel = '喜歡數量';
        data = swiftTasteRawData.map((d, idx) => ({
          label: `會話 #${idx + 1}`,
          value: d.likeCount,
          additionalInfo: `滑動次數: ${d.swipeCount}`,
          date: new Date(d.startedAt).toLocaleDateString('zh-TW')
        }));
        break;
      default:
        return;
    }

    const values = data.map(d => d.value);
    const stats = calculateStats(values);

    setDetailData({
      title,
      valueLabel,
      data,
      stats,
      mode: 'swifttaste'
    });
    setShowDetailModal(true);
  };

  // 處理點擊總會話數查看詳細分析
  const handleTotalSessionsClick = async () => {
    try {
      // 從 Supabase 獲取所有會話的詳細數據
      const { data: allSessions, error } = await supabase
        .from('user_selection_history')
        .select('id, user_id, session_id, mode, started_at, completed_at, session_duration')
        .order('started_at', { ascending: false });

      if (error) {
        console.error('獲取會話數據失敗:', error);
        alert('無法載入會話詳細數據');
        return;
      }

      if (!allSessions || allSessions.length === 0) {
        alert('暫無會話數據');
        return;
      }

      // 準備詳細數據
      const detailRows = allSessions.map((session, idx) => {
        const duration = session.session_duration || 0;
        const isCompleted = session.completed_at !== null;
        const mode = session.mode === 'swifttaste' ? 'SwiftTaste' : 'Buddies';
        const userType = session.user_id ? '已登錄' : '匿名';

        return {
          label: `會話 #${allSessions.length - idx}`,
          value: duration,
          additionalInfo: `${mode} · ${userType} · ${isCompleted ? '✅ 已完成' : '⏸️ 未完成'}`,
          date: new Date(session.started_at).toLocaleString('zh-TW')
        };
      });

      // 計算統計資訊（只統計有效的會話時長）
      const validDurations = allSessions
        .map(s => s.session_duration || 0)
        .filter(d => d > 0);

      const stats = calculateStats(validDurations);

      // 添加額外的統計資訊
      const completedCount = allSessions.filter(s => s.completed_at !== null).length;
      const swiftTasteCount = allSessions.filter(s => s.mode === 'swifttaste').length;
      const buddiesCount = allSessions.filter(s => s.mode === 'buddies').length;
      const anonymousCount = allSessions.filter(s => !s.user_id).length;
      const loggedInCount = allSessions.filter(s => s.user_id).length;

      setDetailData({
        title: '總會話數詳細分析',
        valueLabel: '會話時長（秒）',
        data: detailRows,
        stats: {
          ...stats,
          completedCount,
          completionRate: ((completedCount / allSessions.length) * 100).toFixed(1),
          swiftTasteCount,
          buddiesCount,
          anonymousCount,
          loggedInCount
        },
        mode: 'sessions'
      });
      setShowDetailModal(true);
    } catch (err) {
      console.error('處理會話數據失敗:', err);
      alert('處理數據時發生錯誤');
    }
  };

  // 匯出詳細數據為 CSV
  const exportDetailDataCSV = () => {
    const { title, valueLabel, data, stats, mode } = detailData;

    try {
      let csv = `${title}\n`;
      csv += `匯出時間: ${new Date().toLocaleString('zh-TW')}\n\n`;

      // 統計資訊
      csv += '統計資訊\n';
      csv += `樣本數,${stats.count}\n`;
      csv += `平均值,${stats.mean}\n`;
      csv += `中位數,${stats.median}\n`;
      csv += `標準差,${stats.stdDev}\n`;
      csv += `最小值,${stats.min}\n`;
      csv += `最大值,${stats.max}\n`;
      csv += `總和,${stats.sum}\n`;

      // 額外統計資訊（僅針對總會話數分析）
      if (mode === 'sessions' && stats.completedCount !== undefined) {
        csv += `\n會話分類統計\n`;
        csv += `完成數,${stats.completedCount}\n`;
        csv += `完成率,${stats.completionRate}%\n`;
        csv += `SwiftTaste 會話數,${stats.swiftTasteCount}\n`;
        csv += `Buddies 會話數,${stats.buddiesCount}\n`;
        csv += `匿名會話數,${stats.anonymousCount}\n`;
        csv += `已登錄會話數,${stats.loggedInCount}\n`;
      }
      csv += '\n';

      // 詳細數據
      csv += '詳細數據\n';
      csv += `項目,${valueLabel},附加資訊,日期\n`;
      data.forEach(row => {
        csv += `"${row.label}","${row.value}","${row.additionalInfo}","${row.date}"\n`;
      });

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const filename = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('匯出失敗:', err);
      alert('匯出失敗，請稍後再試');
    }
  };

  // 匯出單一圖表的 CSV
  const exportChartCSV = (data, filename, columns) => {
    try {
      let csv = `${filename}\n匯出時間: ${new Date().toISOString()}\n\n`;

      // 表頭
      csv += columns.join(',') + '\n';

      // 數據行
      data.forEach(row => {
        const values = columns.map(col => {
          const value = row[col] !== undefined ? row[col] : '';
          return `"${value}"`;
        });
        csv += values.join(',') + '\n';
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('匯出失敗:', err);
      alert('匯出失敗，請稍後再試');
    }
  };

  // 匯出完整數據
  const handleExport = async () => {
    try {
      const exportData = {
        '基本統計': stats,
        'SwiftTaste指標': swiftTasteMetrics,
        'Buddies指標': buddiesMetrics,
        '餐廳完整排名': allRestaurantRankings,
        '趣味問題完整統計': funQuestionStats,
        '人口統計': demographicAnalysis,
        '匿名用戶': anonymousData
      };

      const csv = convertToCSV(exportData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `SwiftTaste_完整分析_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('匯出失敗:', err);
    }
  };

  const convertToCSV = (data) => {
    const timestamp = new Date().toISOString();
    let csv = `SwiftTaste 完整數據分析\n匯出時間: ${timestamp}\n\n`;

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

    Object.entries(data).forEach(([section, sectionData]) => {
      csv += `\n=== ${section} ===\n`;
      if (Array.isArray(sectionData)) {
        // 處理陣列數據
        if (sectionData.length > 0) {
          const headers = Object.keys(sectionData[0]);
          csv += headers.join(',') + '\n';
          sectionData.forEach(item => {
            const values = headers.map(h => `"${item[h] !== undefined ? item[h] : ''}"`);
            csv += values.join(',') + '\n';
          });
        }
      } else {
        const flatData = flattenObject(sectionData);
        flatData.forEach(([key, value]) => {
          csv += `"${key}","${value}"\n`;
        });
      }
    });

    return csv;
  };

  useEffect(() => {
    loadData();
  }, [timeRange]);

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">載入數據分析中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-page">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h2 className="error-title">載入失敗</h2>
          <p>{error}</p>
          <button className="retry-button" onClick={loadData}>重試</button>
        </div>
      </div>
    );
  }

  const COLORS = ['#007bff', '#28a745', '#17a2b8', '#6f42c1', '#dc3545', '#20c997', '#6610f2', '#fd7e14'];

  return (
    <div className="analytics-page">
      {/* 頁面標題 */}
      <div className="analytics-header">
        <div className="analytics-title-section">
          <h1>數據分析儀表板</h1>
          <p className="analytics-subtitle">即時監控系統使用狀況與用戶行為數據</p>
        </div>
        <div className="analytics-controls">
          <button className="refresh-button" onClick={handleRefresh}>
            🔄 重新整理
          </button>
          <button className="export-button" onClick={handleExport}>
            📊 匯出完整 CSV
          </button>
        </div>
      </div>

      {/* 總覽統計卡片 */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-header">
            <div className="stat-icon-wrapper">👥</div>
          </div>
          <p className="stat-label">總用戶數</p>
          <h2 className="stat-value">{stats.users.totalUsers.toLocaleString()}</h2>
          <p className="stat-description">
            註冊 {stats.users.registeredUsers} · 匿名 {anonymousData.totalAnonymous}
          </p>
        </div>

        <div className="stat-card success">
          <div className="stat-header">
            <div className="stat-icon-wrapper">✅</div>
          </div>
          <p className="stat-label">活躍用戶</p>
          <h2 className="stat-value">{stats.users.activeUsers.toLocaleString()}</h2>
          <p className="stat-description">過去30天有使用記錄</p>
        </div>

        <div
          className="stat-card info"
          onClick={handleTotalSessionsClick}
          style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '';
          }}
        >
          <div className="stat-header">
            <div className="stat-icon-wrapper">🎯</div>
          </div>
          <p className="stat-label">總選擇流程</p>
          <h2 className="stat-value">{stats.modes.totalSessions.toLocaleString()}</h2>
          <p className="stat-description">
            完成 {stats.modes.completedSessions} · 未完成 {stats.modes.totalSessions - stats.modes.completedSessions}
          </p>
          <p className="stat-description" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
            點擊查看詳細統計 📊
          </p>
        </div>

        <div className="stat-card purple">
          <div className="stat-header">
            <div className="stat-icon-wrapper">👆</div>
          </div>
          <p className="stat-label">總滑動次數</p>
          <h2 className="stat-value">{swiftTasteMetrics.totalSwipes.toLocaleString()}</h2>
          <p className="stat-description">平均每次 {swiftTasteMetrics.avgSwipes} 次滑動</p>
        </div>

        <div className="stat-card teal">
          <div className="stat-header">
            <div className="stat-icon-wrapper">🍽️</div>
          </div>
          <p className="stat-label">餐廳選擇次數</p>
          <h2 className="stat-value">{stats.interactions.finalChoices.toLocaleString()}</h2>
          <p className="stat-description">成功解決吃什麼問題</p>
        </div>

        <div className="stat-card danger">
          <div className="stat-header">
            <div className="stat-icon-wrapper">⭐</div>
          </div>
          <p className="stat-label">平均滿意度</p>
          <h2 className="stat-value">{stats.interactions.avgSatisfaction.toFixed(1)}</h2>
          <p className="stat-description">滿分 5.0</p>
        </div>

        <div className="stat-card indigo">
          <div className="stat-header">
            <div className="stat-icon-wrapper">👤</div>
          </div>
          <p className="stat-label">匿名用戶</p>
          <h2 className="stat-value">{anonymousData.totalAnonymous}</h2>
          <p className="stat-description" style={{ lineHeight: '1.5' }}>
            🔓 未登錄: {anonymousData.completelyAnonymous}<br />
            ⚠️ 未完成註冊: {anonymousData.incompleteProfile}<br />
            <span style={{ fontSize: '0.85em', opacity: 0.8 }}>
              ST {anonymousData.anonymousSwiftTaste} · BD {anonymousData.anonymousBuddies}
            </span>
          </p>
        </div>

        <div className="stat-card success">
          <div className="stat-header">
            <div className="stat-icon-wrapper">🆕</div>
          </div>
          <p className="stat-label">新用戶（30天）</p>
          <h2 className="stat-value">{stats.users.newUsers.toLocaleString()}</h2>
          <p className="stat-description">最近註冊的用戶</p>
        </div>
      </div>

      {/* 進階用戶分析 */}
      {(userClassification || sessionSource || userActivityRanking.length > 0) && (
        <>
          <div className="section-divider">
            <div className="section-divider-line"></div>
            <div className="section-divider-text">📊 進階用戶分析</div>
            <div className="section-divider-line"></div>
          </div>

          <div className="stats-grid">
            {/* 用戶分類概覽 */}
            {userClassification && (
              <div className="stat-card primary" style={{ gridColumn: 'span 2' }}>
                <div className="stat-header">
                  <div className="stat-icon-wrapper">👥</div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#333' }}>用戶分類概覽</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <div style={{ textAlign: 'center', padding: '0.8rem', background: 'rgba(74, 144, 226, 0.1)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.3rem' }}>✅ 已完成註冊</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#4A90E2' }}>
                      {userClassification.registered_users}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.2rem' }}>
                      {((userClassification.registered_users / userClassification.total_users) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '0.8rem', background: 'rgba(255, 159, 64, 0.1)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.3rem' }}>⚠️ 已登錄未註冊</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#FF9F40' }}>
                      {userClassification.incomplete_with_usage}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.2rem' }}>有使用記錄</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '0.8rem', background: 'rgba(153, 102, 255, 0.1)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.3rem' }}>🔓 完全匿名設備</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#9966FF' }}>
                      {userClassification.anonymous_devices}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.2rem' }}>未登錄使用</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '0.8rem', background: 'rgba(200, 200, 200, 0.1)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.3rem' }}>😴 沉睡用戶</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#999' }}>
                      {userClassification.incomplete_without_usage}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.2rem' }}>從未使用</div>
                  </div>
                </div>
              </div>
            )}

            {/* 會話來源分析 */}
            {sessionSource && (
              <div className="stat-card info" style={{ gridColumn: 'span 2' }}>
                <div className="stat-header">
                  <div className="stat-icon-wrapper">📈</div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#333' }}>會話來源分析</h3>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
                    總會話數：<strong>{sessionSource.total_sessions}</strong>
                  </div>
                  {[
                    { label: '已註冊用戶', count: sessionSource.registered_sessions, percent: sessionSource.registered_percentage, color: '#4A90E2' },
                    { label: '完全匿名', count: sessionSource.anonymous_sessions, percent: sessionSource.anonymous_percentage, color: '#9966FF' },
                    { label: '未完成註冊', count: sessionSource.incomplete_sessions, percent: sessionSource.incomplete_percentage, color: '#FF9F40' }
                  ].map((item, idx) => (
                    <div key={idx} style={{ marginBottom: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.85rem', color: '#333' }}>
                        <span>{item.label}</span>
                        <span><strong>{item.count}</strong> ({item.percent}%)</span>
                      </div>
                      <div style={{ height: '8px', background: '#f0f0f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${item.percent}%`,
                          height: '100%',
                          background: item.color,
                          transition: 'width 0.3s ease'
                        }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 模式使用對比 */}
            {modeComparison.length > 0 && (
              <div className="stat-card success" style={{ gridColumn: 'span 2' }}>
                <div className="stat-header">
                  <div className="stat-icon-wrapper">📊</div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#333' }}>模式使用對比</h3>
                </div>
                <div style={{ marginTop: '1.5rem' }}>
                  {modeComparison.map((mode, idx) => {
                    const maxSessions = Math.max(...modeComparison.map(m => m.total_sessions));
                    const modeEmoji = mode.mode === 'swifttaste' ? '🎯' : '👥';
                    const modeName = mode.mode === 'swifttaste' ? 'SwiftTaste' : 'Buddies';

                    return (
                      <div key={idx} style={{ marginBottom: idx < modeComparison.length - 1 ? '2rem' : 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.8rem' }}>
                          <span style={{ fontSize: '1.5rem', marginRight: '0.5rem' }}>{modeEmoji}</span>
                          <span style={{ fontSize: '1rem', fontWeight: '600', color: '#333' }}>{modeName}</span>
                          <span style={{ marginLeft: 'auto', fontSize: '1.2rem', fontWeight: 'bold', color: '#4A90E2' }}>
                            {mode.total_sessions}
                          </span>
                        </div>

                        {/* 總會話條形圖 */}
                        <div style={{ marginBottom: '0.8rem' }}>
                          <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.3rem' }}>
                            總會話數 ({((mode.total_sessions / maxSessions) * 100).toFixed(0)}%)
                          </div>
                          <div style={{ height: '12px', background: '#f0f0f0', borderRadius: '6px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${(mode.total_sessions / maxSessions) * 100}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #4A90E2, #357ABD)',
                              transition: 'width 0.5s ease'
                            }}></div>
                          </div>
                        </div>

                        {/* 用戶類型分佈 */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                          <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(74, 144, 226, 0.1)', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.7rem', color: '#666' }}>✅ 已註冊</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#4A90E2' }}>
                              {mode.registered_sessions}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(153, 102, 255, 0.1)', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.7rem', color: '#666' }}>🔓 匿名</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#9966FF' }}>
                              {mode.anonymous_sessions}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(255, 159, 64, 0.1)', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.7rem', color: '#666' }}>⚠️ 未完成</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#FF9F40' }}>
                              {mode.incomplete_sessions}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 註冊轉化率統計 */}
            {conversionStats && (
              <div className="stat-card warning" style={{ gridColumn: 'span 2' }}>
                <div className="stat-header">
                  <div className="stat-icon-wrapper">📈</div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#333' }}>註冊轉化率統計</h3>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1.5rem' }}>
                    總用戶數：<strong>{conversionStats.total_users}</strong>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    {/* 註冊率 */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto' }}>
                        <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            stroke="#f0f0f0"
                            strokeWidth="8"
                            fill="none"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            stroke="#4A90E2"
                            strokeWidth="8"
                            fill="none"
                            strokeDasharray={`${(conversionStats.registration_rate / 100) * 251.2} 251.2`}
                            style={{ transition: 'stroke-dasharray 0.5s ease' }}
                          />
                        </svg>
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          fontSize: '1.2rem',
                          fontWeight: 'bold',
                          color: '#4A90E2'
                        }}>
                          {conversionStats.registration_rate}%
                        </div>
                      </div>
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                        ✅ 註冊率
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#999' }}>
                        {conversionStats.registered_users} 人
                      </div>
                    </div>

                    {/* 活躍率 */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto' }}>
                        <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            stroke="#f0f0f0"
                            strokeWidth="8"
                            fill="none"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            stroke="#50C878"
                            strokeWidth="8"
                            fill="none"
                            strokeDasharray={`${(conversionStats.activity_rate / 100) * 251.2} 251.2`}
                            style={{ transition: 'stroke-dasharray 0.5s ease' }}
                          />
                        </svg>
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          fontSize: '1.2rem',
                          fontWeight: 'bold',
                          color: '#50C878'
                        }}>
                          {conversionStats.activity_rate}%
                        </div>
                      </div>
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                        🔥 活躍率
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#999' }}>
                        {conversionStats.users_with_activity} 人
                      </div>
                    </div>

                    {/* 沉睡率 */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto' }}>
                        <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            stroke="#f0f0f0"
                            strokeWidth="8"
                            fill="none"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            stroke="#999"
                            strokeWidth="8"
                            fill="none"
                            strokeDasharray={`${(conversionStats.dormant_rate / 100) * 251.2} 251.2`}
                            style={{ transition: 'stroke-dasharray 0.5s ease' }}
                          />
                        </svg>
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          fontSize: '1.2rem',
                          fontWeight: 'bold',
                          color: '#999'
                        }}>
                          {conversionStats.dormant_rate}%
                        </div>
                      </div>
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                        😴 沉睡率
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#999' }}>
                        {conversionStats.dormant_users} 人
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 用戶活躍度排行 */}
          {userActivityRanking.length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#333' }}>
                🏆 用戶活躍度排行 Top {userActivityRanking.length}
              </h3>
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                      <th style={{ padding: '0.8rem', textAlign: 'left', color: '#666', fontWeight: '600' }}>排名</th>
                      <th style={{ padding: '0.8rem', textAlign: 'left', color: '#666', fontWeight: '600' }}>用戶</th>
                      <th style={{ padding: '0.8rem', textAlign: 'center', color: '#666', fontWeight: '600' }}>狀態</th>
                      <th style={{ padding: '0.8rem', textAlign: 'center', color: '#666', fontWeight: '600' }}>總次數</th>
                      <th style={{ padding: '0.8rem', textAlign: 'center', color: '#666', fontWeight: '600' }}>SwiftTaste</th>
                      <th style={{ padding: '0.8rem', textAlign: 'center', color: '#666', fontWeight: '600' }}>Buddies</th>
                      <th style={{ padding: '0.8rem', textAlign: 'left', color: '#666', fontWeight: '600' }}>最後活動</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userActivityRanking.map((user, idx) => (
                      <tr key={user.user_id} style={{
                        borderBottom: '1px solid #f0f0f0',
                        background: idx < 3 ? 'rgba(74, 144, 226, 0.05)' : 'transparent'
                      }}>
                        <td style={{ padding: '0.8rem', fontWeight: 'bold', fontSize: '1.1rem' }}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                        </td>
                        <td style={{ padding: '0.8rem' }}>
                          <div style={{ fontWeight: '500' }}>{user.user_name || '未命名'}</div>
                          <div style={{ fontSize: '0.75rem', color: '#999' }}>{user.user_email}</div>
                        </td>
                        <td style={{ padding: '0.8rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            background: user.is_registered ? '#e8f5e9' : '#fff3e0',
                            color: user.is_registered ? '#2e7d32' : '#e65100',
                            fontWeight: '500'
                          }}>
                            {user.is_registered ? '✅ 已註冊' : '⚠️ 未註冊'}
                          </span>
                        </td>
                        <td style={{ padding: '0.8rem', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>
                          {user.total_sessions}
                        </td>
                        <td style={{ padding: '0.8rem', textAlign: 'center' }}>{user.swifttaste_count}</td>
                        <td style={{ padding: '0.8rem', textAlign: 'center' }}>{user.buddies_count}</td>
                        <td style={{ padding: '0.8rem', fontSize: '0.85rem', color: '#666' }}>
                          {new Date(user.last_activity).toLocaleDateString('zh-TW')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* SwiftTaste 模式 */}
      <div className="section-divider">
        <div className="section-divider-line"></div>
        <div className="section-divider-text">
          🎯 SwiftTaste 模式數據
          <button
            className="detail-view-button"
            onClick={() => setShowSwiftTasteModal(true)}
            style={{ marginLeft: '1rem', fontSize: '0.9rem', padding: '0.3rem 0.8rem' }}
          >
            📊 查看詳情
          </button>
        </div>
        <div className="section-divider-line"></div>
      </div>

      <div className="buddies-stats-container">
        <div className="buddies-metric">
          <div className="buddies-metric-value">{swiftTasteMetrics.totalSessions}</div>
          <div className="buddies-metric-label">總選擇流程</div>
        </div>
        <div className="buddies-metric">
          <div className="buddies-metric-value">{swiftTasteMetrics.completedSessions}</div>
          <div className="buddies-metric-label">完成次數</div>
        </div>
        <div className="buddies-metric">
          <div className="buddies-metric-value">{swiftTasteMetrics.incompleteSessions}</div>
          <div className="buddies-metric-label">未完成次數</div>
        </div>
        <div className="buddies-metric">
          <div className="buddies-metric-value">{swiftTasteMetrics.totalSwipes}</div>
          <div className="buddies-metric-label">總滑動次數</div>
        </div>
        <div className="buddies-metric">
          <div className="buddies-metric-value">{swiftTasteMetrics.avgSwipes}</div>
          <div className="buddies-metric-label">平均滑動次數</div>
        </div>
        <div className="buddies-metric">
          <div className="buddies-metric-value">{swiftTasteMetrics.avgDuration}秒</div>
          <div className="buddies-metric-label">平均決策時長</div>
        </div>
        <div className="buddies-metric">
          <div className="buddies-metric-value">{swiftTasteMetrics.avgDecisionSpeed}秒</div>
          <div className="buddies-metric-label">平均每次滑動時長</div>
        </div>
        <div className="buddies-metric">
          <div className="buddies-metric-value">{swiftTasteMetrics.conversionRate}%</div>
          <div className="buddies-metric-label">選擇成功率</div>
        </div>
      </div>

      {/* Buddies 模式 */}
      <div className="section-divider">
        <div className="section-divider-line"></div>
        <div className="section-divider-text">
          👥 Buddies 模式數據
          <button
            className="detail-view-button"
            onClick={() => setShowBuddiesModal(true)}
            style={{ marginLeft: '1rem', fontSize: '0.9rem', padding: '0.3rem 0.8rem' }}
          >
            📊 查看詳情
          </button>
        </div>
        <div className="section-divider-line"></div>
      </div>

      <div className="buddies-stats-container">
        <div className="buddies-metric">
          <div className="buddies-metric-value">{buddiesMetrics.totalRooms}</div>
          <div className="buddies-metric-label">總房間數</div>
        </div>
        <div className="buddies-metric">
          <div className="buddies-metric-value">{buddiesMetrics.completedRooms}</div>
          <div className="buddies-metric-label">完成次數</div>
        </div>
        <div className="buddies-metric">
          <div className="buddies-metric-value">{buddiesMetrics.incompleteRooms}</div>
          <div className="buddies-metric-label">未完成次數</div>
        </div>
        <div className="buddies-metric">
          <div className="buddies-metric-value">{buddiesMetrics.avgMembersPerRoom}</div>
          <div className="buddies-metric-label">平均房間人數</div>
        </div>
        <div className="buddies-metric">
          <div className="buddies-metric-value">{buddiesMetrics.avgSessionDuration}秒</div>
          <div className="buddies-metric-label">平均決策時長</div>
        </div>
        <div className="buddies-metric">
          <div className="buddies-metric-value">{buddiesMetrics.totalVotes}</div>
          <div className="buddies-metric-label">總投票數</div>
        </div>
        <div className="buddies-metric">
          <div className="buddies-metric-value">{buddiesMetrics.avgVotesPerRoom}</div>
          <div className="buddies-metric-label">平均每房投票數</div>
        </div>
        <div className="buddies-metric">
          <div className="buddies-metric-value">{buddiesMetrics.completionRate}%</div>
          <div className="buddies-metric-label">完成率</div>
        </div>
      </div>

      {/* 圖表區域 */}
      <div className="charts-grid">
        {/* 熱門餐廳 Top 20 */}
        <div className="chart-card full-width">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">熱門餐廳 Top 20</h3>
              <p className="chart-subtitle">選擇次數與推薦成功率</p>
            </div>
            <button
              className="export-button"
              onClick={() => exportChartCSV(
                allRestaurantRankings,
                '餐廳完整排名',
                ['name', 'selectedCount', 'recommendedCount', 'successRate', 'avgDecisionTime']
              )}
            >
              📥 匯出完整排名
            </button>
          </div>
          <div className="chart-container">
            {restaurantSuccessData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={restaurantSuccessData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={150} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="selectedCount" fill="#007bff" name="選擇次數" />
                  <Bar dataKey="recommendedCount" fill="#28a745" name="被推薦次數" />
                  <Line dataKey="successRate" stroke="#dc3545" strokeWidth={2} name="成功率(%)" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart">暫無數據</div>
            )}
          </div>
        </div>

        {/* 餐廳被推薦次數 Top 20 */}
        <div className="chart-card full-width">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">餐廳被推薦次數 Top 20</h3>
              <p className="chart-subtitle">系統推薦給用戶的次數排行</p>
            </div>
            <button
              className="export-button"
              onClick={() => exportChartCSV(
                allRestaurantRankings.sort((a, b) => b.recommendedCount - a.recommendedCount),
                '餐廳被推薦次數完整排名',
                ['name', 'recommendedCount', 'selectedCount', 'successRate']
              )}
            >
              📥 匯出完整排名
            </button>
          </div>
          <div className="chart-container">
            {restaurantSuccessData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...allRestaurantRankings]
                    .sort((a, b) => b.recommendedCount - a.recommendedCount)
                    .slice(0, 20)}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={150} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="recommendedCount" fill="#28a745" name="被推薦次數" />
                  <Bar dataKey="selectedCount" fill="#007bff" name="被選擇次數" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart">暫無數據</div>
            )}
          </div>
        </div>

        {/* 餐廳決策速度 Top 10 */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">最快決策餐廳 Top 10</h3>
              <p className="chart-subtitle">平均決策時長（秒）</p>
            </div>
            <button
              className="export-button"
              onClick={() => exportChartCSV(
                allRestaurantRankings.sort((a, b) => a.avgDecisionTime - b.avgDecisionTime),
                '餐廳決策速度完整排名',
                ['name', 'avgDecisionTime', 'selectedCount']
              )}
            >
              📥 匯出
            </button>
          </div>
          <div className="chart-container">
            {restaurantSuccessData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={restaurantSuccessData.slice(0, 10).sort((a, b) => a.avgDecisionTime - b.avgDecisionTime)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avgDecisionTime" fill="#17a2b8" name="平均決策時長(秒)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart">暫無數據</div>
            )}
          </div>
        </div>

        {/* 推薦成功率 Top 10 */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">推薦成功率 Top 10</h3>
              <p className="chart-subtitle">被選擇 / 被推薦比例</p>
            </div>
            <button
              className="export-button"
              onClick={() => exportChartCSV(
                allRestaurantRankings.filter(r => r.recommendedCount >= 5).sort((a, b) => b.successRate - a.successRate),
                '餐廳推薦成功率完整排名',
                ['name', 'successRate', 'selectedCount', 'recommendedCount']
              )}
            >
              📥 匯出
            </button>
          </div>
          <div className="chart-container">
            {restaurantSuccessData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={restaurantSuccessData.filter(r => r.recommendedCount >= 5).sort((a, b) => b.successRate - a.successRate).slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="successRate" fill="#6f42c1" name="成功率(%)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart">暫無數據</div>
            )}
          </div>
        </div>

        {/* 年齡層使用分析 */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">年齡層使用分析</h3>
              <p className="chart-subtitle">不同年齡層的模式偏好</p>
            </div>
            <button
              className="export-button"
              onClick={() => exportChartCSV(
                demographicAnalysis.byAge,
                '年齡層使用分析',
                ['ageGroup', 'swifttaste', 'buddies', 'total']
              )}
            >
              📥 匯出
            </button>
          </div>
          <div className="chart-container">
            {demographicAnalysis.byAge.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={demographicAnalysis.byAge}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ageGroup" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="swifttaste" fill="#007bff" name="SwiftTaste" stackId="a" />
                  <Bar dataKey="buddies" fill="#6f42c1" name="Buddies" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart">暫無數據</div>
            )}
          </div>
        </div>

        {/* 性別使用分析 */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">性別使用分析</h3>
              <p className="chart-subtitle">不同性別的模式偏好</p>
            </div>
            <button
              className="export-button"
              onClick={() => exportChartCSV(
                demographicAnalysis.byGender,
                '性別使用分析',
                ['gender', 'swifttaste', 'buddies', 'total']
              )}
            >
              📥 匯出
            </button>
          </div>
          <div className="chart-container">
            {demographicAnalysis.byGender.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={demographicAnalysis.byGender}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="gender" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="swifttaste" fill="#007bff" name="SwiftTaste" />
                  <Bar dataKey="buddies" fill="#6f42c1" name="Buddies" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart">暫無數據</div>
            )}
          </div>
        </div>

        {/* 趣味問題統計 - 每個問題顯示兩個選項的對比 */}
        {funQuestionStats && funQuestionStats.length > 0 && funQuestionStats.map((questionData, index) => (
          <div key={index} className="chart-card">
            <div className="chart-header">
              <div>
                <h3 className="chart-title">{questionData.question}</h3>
                <p className="chart-subtitle">被回答 {questionData.totalAnswered} 次 · 兩個選項的選擇對比</p>
              </div>
              <button
                className="export-button"
                onClick={() => exportChartCSV(
                  [
                    { option: questionData.option1.text, count: questionData.option1.count },
                    { option: questionData.option2.text, count: questionData.option2.count }
                  ],
                  questionData.question,
                  ['option', 'count']
                )}
              >
                📥 匯出
              </button>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { option: questionData.option1.text, count: questionData.option1.count },
                    { option: questionData.option2.text, count: questionData.option2.count }
                  ]}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="option" width={150} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#6f42c1" name="選擇次數" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}

        {/* 時間趨勢圖 */}
        <div className="chart-card full-width">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">用戶使用趨勢（近 {timeRange} 天）</h3>
              <p className="chart-subtitle">每日使用量與活躍用戶數</p>
            </div>
            <div className="time-range-selector">
              <button
                className={`time-range-button ${timeRange === 7 ? 'active' : ''}`}
                onClick={() => setTimeRange(7)}
              >
                7天
              </button>
              <button
                className={`time-range-button ${timeRange === 30 ? 'active' : ''}`}
                onClick={() => setTimeRange(30)}
              >
                30天
              </button>
              <button
                className={`time-range-button ${timeRange === 90 ? 'active' : ''}`}
                onClick={() => setTimeRange(90)}
              >
                90天
              </button>
            </div>
            <button
              className="export-button"
              onClick={() => exportChartCSV(
                timeTrendData,
                '時間趨勢統計',
                ['date', 'total', 'swifttaste', 'buddies', 'completed', 'activeUsers', 'registeredUsers', 'anonymousUsers']
              )}
            >
              📥 匯出
            </button>
          </div>
          <div className="chart-container">
            {timeTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timeTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="formattedDate" angle={-45} textAnchor="end" height={80} />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="total"
                    fill="#e3f2fd"
                    stroke="#007bff"
                    name="總使用量"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="swifttaste"
                    stroke="#007bff"
                    strokeWidth={2}
                    name="SwiftTaste"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="buddies"
                    stroke="#6f42c1"
                    strokeWidth={2}
                    name="Buddies"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="activeUsers"
                    stroke="#28a745"
                    strokeWidth={2}
                    name="活躍用戶"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="completed"
                    stroke="#17a2b8"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="完成次數"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart">暫無數據</div>
            )}
          </div>
        </div>
      </div>

      {/* SwiftTaste 詳細數據 Modal */}
      {showSwiftTasteModal && (
        <div className="modal-overlay" onClick={() => setShowSwiftTasteModal(false)}>
          <div className="modal-content" onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSwiftTasteModal(false);
            }
          }} style={{ maxWidth: '900px', maxHeight: '85vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h2>🎯 SwiftTaste 模式詳細數據</h2>
              <button className="modal-close" onClick={() => setShowSwiftTasteModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '20px', color: '#666', fontSize: '14px' }}>
                點擊帶有「點擊查看詳細」標記的指標可查看該項目的詳細統計數據
              </p>
              <div className="detail-metrics-grid">
                <div className="detail-metric-item">
                  <div className="detail-metric-label">
                    <strong>總選擇流程</strong>
                    <span className="metric-description">用戶啟動 SwiftTaste 的總次數</span>
                  </div>
                  <div className="detail-metric-value">{swiftTasteMetrics.totalSessions}</div>
                </div>
                <div className="detail-metric-item">
                  <div className="detail-metric-label">
                    <strong>完成次數</strong>
                    <span className="metric-description">用戶成功選擇到最終餐廳的次數</span>
                  </div>
                  <div className="detail-metric-value">{swiftTasteMetrics.completedSessions}</div>
                </div>
                <div className="detail-metric-item">
                  <div className="detail-metric-label">
                    <strong>未完成次數</strong>
                    <span className="metric-description">用戶中途離開未完成選擇的次數</span>
                  </div>
                  <div className="detail-metric-value">{swiftTasteMetrics.incompleteSessions}</div>
                </div>
                <div className="detail-metric-item">
                  <div className="detail-metric-label">
                    <strong>完成率</strong>
                    <span className="metric-description">完成次數 ÷ 總選擇流程 × 100%</span>
                  </div>
                  <div className="detail-metric-value">{swiftTasteMetrics.completionRate}%</div>
                </div>
                <div className="detail-metric-item">
                  <div className="detail-metric-label">
                    <strong>總滑動次數</strong>
                    <span className="metric-description">所有用戶滑動餐廳卡片的總次數</span>
                  </div>
                  <div className="detail-metric-value">{swiftTasteMetrics.totalSwipes}</div>
                </div>
                <div className="detail-metric-item clickable" onClick={() => handleSwiftTasteMetricClick('swipes')} style={{ cursor: 'pointer' }}>
                  <div className="detail-metric-label">
                    <strong>平均滑動次數</strong>
                    <span className="metric-description">每個用戶平均滑動的卡片數量（點擊查看詳細）</span>
                  </div>
                  <div className="detail-metric-value">{swiftTasteMetrics.avgSwipes}</div>
                </div>
                <div className="detail-metric-item clickable" onClick={() => handleSwiftTasteMetricClick('duration')} style={{ cursor: 'pointer' }}>
                  <div className="detail-metric-label">
                    <strong>平均決策時長</strong>
                    <span className="metric-description">從開始到完成選擇的平均時間（點擊查看詳細）</span>
                  </div>
                  <div className="detail-metric-value">{swiftTasteMetrics.avgDuration} 秒</div>
                </div>
                <div className="detail-metric-item clickable" onClick={() => handleSwiftTasteMetricClick('decisionSpeed')} style={{ cursor: 'pointer' }}>
                  <div className="detail-metric-label">
                    <strong>平均每次滑動時長</strong>
                    <span className="metric-description">用戶在每張卡片上的平均思考時間（點擊查看詳細）</span>
                  </div>
                  <div className="detail-metric-value">{swiftTasteMetrics.avgDecisionSpeed} 秒</div>
                </div>
                <div className="detail-metric-item">
                  <div className="detail-metric-label">
                    <strong>選擇成功率</strong>
                    <span className="metric-description">用戶獲得推薦餐廳的成功比例</span>
                  </div>
                  <div className="detail-metric-value">{swiftTasteMetrics.conversionRate}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Buddies 詳細數據 Modal */}
      {showBuddiesModal && (
        <div className="modal-overlay" onClick={() => setShowBuddiesModal(false)}>
          <div className="modal-content" onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowBuddiesModal(false);
            }
          }} style={{ maxWidth: '900px', maxHeight: '85vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h2>👥 Buddies 模式詳細數據</h2>
              <button className="modal-close" onClick={() => setShowBuddiesModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '20px', color: '#666', fontSize: '14px' }}>
                點擊帶有「點擊查看詳細」標記的指標可查看該項目的詳細統計數據
              </p>
              <div className="detail-metrics-grid">
                <div className="detail-metric-item">
                  <div className="detail-metric-label">
                    <strong>總房間數</strong>
                    <span className="metric-description">創建的 Buddies 房間總數</span>
                  </div>
                  <div className="detail-metric-value">{buddiesMetrics.totalRooms}</div>
                </div>
                <div className="detail-metric-item">
                  <div className="detail-metric-label">
                    <strong>完成次數</strong>
                    <span className="metric-description">房間內成員完成選擇的次數</span>
                  </div>
                  <div className="detail-metric-value">{buddiesMetrics.completedRooms}</div>
                </div>
                <div className="detail-metric-item">
                  <div className="detail-metric-label">
                    <strong>未完成次數</strong>
                    <span className="metric-description">房間內成員未完成選擇的次數</span>
                  </div>
                  <div className="detail-metric-value">{buddiesMetrics.incompleteRooms}</div>
                </div>
                <div className="detail-metric-item">
                  <div className="detail-metric-label">
                    <strong>完成率</strong>
                    <span className="metric-description">完成次數 ÷ 總房間數 × 100%</span>
                  </div>
                  <div className="detail-metric-value">{buddiesMetrics.completionRate}%</div>
                </div>
                <div className="detail-metric-item clickable" onClick={() => handleBuddiesMetricClick('members')} style={{ cursor: 'pointer' }}>
                  <div className="detail-metric-label">
                    <strong>平均房間人數</strong>
                    <span className="metric-description">每個房間的平均參與人數（點擊查看詳細）</span>
                  </div>
                  <div className="detail-metric-value">{buddiesMetrics.avgMembersPerRoom}</div>
                </div>
                <div className="detail-metric-item clickable" onClick={() => handleBuddiesMetricClick('duration')} style={{ cursor: 'pointer' }}>
                  <div className="detail-metric-label">
                    <strong>平均決策時長</strong>
                    <span className="metric-description">房間從創建到完成選擇的平均時間（點擊查看詳細）</span>
                  </div>
                  <div className="detail-metric-value">{buddiesMetrics.avgSessionDuration} 秒</div>
                </div>
                <div className="detail-metric-item">
                  <div className="detail-metric-label">
                    <strong>總投票數</strong>
                    <span className="metric-description">所有房間成員的投票總數</span>
                  </div>
                  <div className="detail-metric-value">{buddiesMetrics.totalVotes}</div>
                </div>
                <div className="detail-metric-item clickable" onClick={() => handleBuddiesMetricClick('votes')} style={{ cursor: 'pointer' }}>
                  <div className="detail-metric-label">
                    <strong>平均每房投票數</strong>
                    <span className="metric-description">每個房間的平均投票次數（點擊查看詳細）</span>
                  </div>
                  <div className="detail-metric-value">{buddiesMetrics.avgVotesPerRoom}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 詳細數據查看 Modal */}
      {showDetailModal && (
        <div className="modal-overlay" onClick={() => {
          setShowDetailModal(false);
          // 根據模式重新打開對應的詳細數據視窗
          if (detailData.mode === 'buddies') {
            setShowBuddiesModal(true);
          } else if (detailData.mode === 'swifttaste') {
            setShowSwiftTasteModal(true);
          }
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1000px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  className="back-button"
                  onClick={() => {
                    setShowDetailModal(false);
                    // 根據模式重新打開對應的詳細數據視窗
                    if (detailData.mode === 'buddies') {
                      setShowBuddiesModal(true);
                    } else if (detailData.mode === 'swifttaste') {
                      setShowSwiftTasteModal(true);
                    }
                  }}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  ← 返回
                </button>
                <h2 style={{ margin: 0 }}>{detailData.title}</h2>
              </div>
              <button className="modal-close" onClick={() => {
                setShowDetailModal(false);
                // 根據模式重新打開對應的詳細數據視窗
                if (detailData.mode === 'buddies') {
                  setShowBuddiesModal(true);
                } else if (detailData.mode === 'swifttaste') {
                  setShowSwiftTasteModal(true);
                }
              }}>✕</button>
            </div>
            <div className="modal-body">
              {/* 統計資訊區塊 */}
              <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '15px', color: '#333' }}>統計資訊</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
                  <div>
                    <div style={{ fontSize: '14px', color: '#666' }}>樣本數</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>{detailData.stats.count}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', color: '#666' }}>平均值</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2196F3' }}>{detailData.stats.mean}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', color: '#666' }}>中位數</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#4CAF50' }}>{detailData.stats.median}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', color: '#666' }}>標準差</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#FF9800' }}>{detailData.stats.stdDev}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', color: '#666' }}>最小值</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#9C27B0' }}>{detailData.stats.min}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', color: '#666' }}>最大值</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#F44336' }}>{detailData.stats.max}</div>
                  </div>
                </div>

                {/* 額外統計資訊（僅針對總會話數分析） */}
                {detailData.mode === 'sessions' && detailData.stats.completedCount !== undefined && (
                  <div style={{ marginTop: '25px', paddingTop: '20px', borderTop: '2px solid #dee2e6' }}>
                    <h4 style={{ marginBottom: '15px', color: '#333', fontSize: '16px' }}>會話分類統計</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                      <div style={{ padding: '12px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                        <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>✅ 完成率</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#4CAF50' }}>
                          {detailData.stats.completionRate}%
                        </div>
                        <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                          {detailData.stats.completedCount} / {detailData.data.length}
                        </div>
                      </div>
                      <div style={{ padding: '12px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                        <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>🎯 SwiftTaste</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2196F3' }}>
                          {detailData.stats.swiftTasteCount}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                          {((detailData.stats.swiftTasteCount / detailData.data.length) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div style={{ padding: '12px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                        <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>👥 Buddies</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#9C27B0' }}>
                          {detailData.stats.buddiesCount}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                          {((detailData.stats.buddiesCount / detailData.data.length) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div style={{ padding: '12px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                        <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>🔓 匿名</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#FF9800' }}>
                          {detailData.stats.anonymousCount}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                          {((detailData.stats.anonymousCount / detailData.data.length) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div style={{ padding: '12px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                        <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>👤 已登錄</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#00BCD4' }}>
                          {detailData.stats.loggedInCount}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
                          {((detailData.stats.loggedInCount / detailData.data.length) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 匯出按鈕 */}
              <div style={{ marginBottom: '20px', textAlign: 'right' }}>
                <button
                  onClick={exportDetailDataCSV}
                  className="export-btn"
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  匯出 CSV
                </button>
              </div>

              {/* 詳細數據表格 */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#e3f2fd' }}>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #2196F3' }}>項目</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #2196F3' }}>{detailData.valueLabel}</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #2196F3' }}>附加資訊</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #2196F3' }}>日期</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailData.data.map((row, index) => (
                      <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f5f5f5' }}>
                        <td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>{row.label}</td>
                        <td style={{ padding: '10px', borderBottom: '1px solid #ddd', fontWeight: 'bold', color: '#2196F3' }}>{row.value}</td>
                        <td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>{row.additionalInfo}</td>
                        <td style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>{row.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {detailData.data.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  暫無數據
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
