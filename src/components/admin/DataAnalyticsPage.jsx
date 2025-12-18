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
    anonymousBuddies: 0
  });

  const [timeTrendData, setTimeTrendData] = useState([]);

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
        timeTrend
      ] = await Promise.all([
        dataAnalyticsService.getOverviewStats(),
        loadSwiftTasteMetrics(),
        loadBuddiesMetrics(),
        loadRestaurantSuccessMetrics(),
        loadFunQuestionStats(),
        loadDemographicAnalysis(),
        loadAnonymousData(),
        loadTimeTrendData()
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
      const completedDuration = completedSessions.reduce((sum, s) => sum + (s.session_duration || 0), 0);
      const avgDuration = completed > 0 ? Math.round(completedDuration / completed) : 0;

      const completionRate = sessions && sessions.length > 0
        ? (completed / sessions.length * 100)
        : 0;

      return {
        totalRooms,
        completedRooms: completed,
        incompleteRooms: incomplete,
        avgMembersPerRoom: parseFloat(avgMembers.toFixed(1)),
        avgSessionDuration: Math.round(avgDuration),
        completionRate: parseFloat(completionRate.toFixed(1)),
        totalVotes,
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

      console.log('Loaded fun questions from DB:', funQuestions);

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

      console.log('Answer to question mapping:', answerToQuestion);

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

      console.log('Question stats:', questionStats);

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

  // 載入匿名用戶數據
  const loadAnonymousData = async () => {
    try {
      const { data: sessions } = await supabase
        .from('user_selection_history')
        .select('mode')
        .is('user_id', null);

      const totalAnonymous = sessions?.length || 0;
      const anonymousSwiftTaste = sessions?.filter(s => s.mode === 'swifttaste').length || 0;
      const anonymousBuddies = sessions?.filter(s => s.mode === 'buddies').length || 0;

      return {
        totalAnonymous,
        anonymousSwiftTaste,
        anonymousBuddies
      };
    } catch (error) {
      console.error('載入匿名數據失敗:', error);
      return {
        totalAnonymous: 0,
        anonymousSwiftTaste: 0,
        anonymousBuddies: 0
      };
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

        <div className="stat-card info">
          <div className="stat-header">
            <div className="stat-icon-wrapper">🎯</div>
          </div>
          <p className="stat-label">總選擇流程</p>
          <h2 className="stat-value">{stats.modes.totalSessions.toLocaleString()}</h2>
          <p className="stat-description">
            完成 {stats.modes.completedSessions} · 未完成 {stats.modes.totalSessions - stats.modes.completedSessions}
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
          <p className="stat-description">
            ST {anonymousData.anonymousSwiftTaste} · BD {anonymousData.anonymousBuddies}
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

      {/* SwiftTaste 模式 */}
      <div className="section-divider">
        <div className="section-divider-line"></div>
        <div className="section-divider-text">🎯 SwiftTaste 模式數據</div>
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
        <div className="section-divider-text">👥 Buddies 模式數據</div>
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
    </div>
  );
}
