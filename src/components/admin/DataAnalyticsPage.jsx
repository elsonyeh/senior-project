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

  // 載入所有數據
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        overviewStats,
        swiftTasteData,
        buddiesData,
        restaurantSuccess,
        funQuestions,
        demographics,
        anonymousStats
      ] = await Promise.all([
        dataAnalyticsService.getOverviewStats(),
        loadSwiftTasteMetrics(),
        loadBuddiesMetrics(),
        loadRestaurantSuccessMetrics(),
        loadFunQuestionStats(),
        loadDemographicAnalysis(),
        loadAnonymousData()
      ]);

      setStats(overviewStats);
      setSwiftTasteMetrics(swiftTasteData);
      setBuddiesMetrics(buddiesData);
      setRestaurantSuccessData(restaurantSuccess);
      setFunQuestionStats(funQuestions);
      setDemographicAnalysis(demographics);
      setAnonymousData(anonymousStats);

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

      const completed = sessions.filter(s => s.completed_at).length;
      const incomplete = sessions.length - completed;
      const totalSwipes = sessions.reduce((sum, s) => sum + (s.swipe_count || 0), 0);
      const totalLikes = sessions.reduce((sum, s) => sum + (s.liked_restaurants?.length || 0), 0);
      const totalDuration = sessions.reduce((sum, s) => sum + (s.session_duration || 0), 0);
      const withFinalChoice = sessions.filter(s => s.final_restaurant).length;

      // 計算平均決策速度（秒/滑動）
      const avgDecisionSpeed = totalSwipes > 0 ? totalDuration / totalSwipes : 0;

      return {
        totalSessions: sessions.length,
        completedSessions: completed,
        incompleteSessions: incomplete,
        completionRate: parseFloat((completed / sessions.length * 100).toFixed(1)),
        totalSwipes,
        avgSwipes: parseFloat((totalSwipes / sessions.length).toFixed(1)),
        avgLikes: parseFloat((totalLikes / sessions.length).toFixed(1)),
        avgDuration: Math.round(totalDuration / sessions.length),
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

      const { data: votes } = await supabase
        .from('buddies_votes')
        .select('room_id');

      const totalRooms = rooms?.length || 0;
      const completed = sessions?.filter(s => s.completed_at).length || 0;
      const incomplete = (sessions?.length || 0) - completed;

      const roomMemberCounts = {};
      members?.forEach(m => {
        roomMemberCounts[m.room_id] = (roomMemberCounts[m.room_id] || 0) + 1;
      });

      const avgMembers = Object.keys(roomMemberCounts).length > 0
        ? Object.values(roomMemberCounts).reduce((sum, c) => sum + c, 0) / Object.keys(roomMemberCounts).length
        : 0;

      const totalVotes = votes?.length || 0;
      const avgVotes = totalRooms > 0 ? totalVotes / totalRooms : 0;

      const totalDuration = sessions?.reduce((sum, s) => sum + (s.session_duration || 0), 0) || 0;
      const avgDuration = sessions && sessions.length > 0 ? totalDuration / sessions.length : 0;

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

  // 載入餐廳成功率指標
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

      return Object.values(restaurantStats)
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
        .sort((a, b) => b.selectedCount - a.selectedCount)
        .slice(0, 20);
    } catch (error) {
      console.error('載入餐廳成功率失敗:', error);
      return [];
    }
  };

  // 載入趣味問題統計
  const loadFunQuestionStats = async () => {
    try {
      const { data: sessions } = await supabase
        .from('user_selection_history')
        .select('fun_answers');

      const funStats = {};

      sessions?.forEach(session => {
        const answers = session.fun_answers;
        if (answers && Array.isArray(answers)) {
          answers.forEach((answer, index) => {
            const questionKey = `趣味問題 ${index + 1}`;
            if (!funStats[questionKey]) {
              funStats[questionKey] = {};
            }
            const answerValue = typeof answer === 'object' ? JSON.stringify(answer) : String(answer);
            funStats[questionKey][answerValue] = (funStats[questionKey][answerValue] || 0) + 1;
          });
        }
      });

      return Object.entries(funStats).map(([question, answers]) => ({
        question,
        data: Object.entries(answers)
          .map(([answer, count]) => ({ answer, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      }));
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

  const handleExport = async () => {
    try {
      // 組合所有數據
      const exportData = {
        '基本統計': stats,
        'SwiftTaste指標': swiftTasteMetrics,
        'Buddies指標': buddiesMetrics,
        '餐廳成功率': restaurantSuccessData,
        '趣味問題': funQuestionStats,
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
      const flatData = flattenObject(sectionData);
      flatData.forEach(([key, value]) => {
        csv += `"${key}","${value}"\n`;
      });
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

        {/* 餐廳決策速度 Top 10 */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">最快決策餐廳 Top 10</h3>
              <p className="chart-subtitle">平均決策時長（秒）</p>
            </div>
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

        {/* 趣味問題統計 - 顯示前3個問題 */}
        {funQuestionStats.slice(0, 3).map((questionData, idx) => (
          <div className="chart-card" key={idx}>
            <div className="chart-header">
              <div>
                <h3 className="chart-title">{questionData.question}</h3>
                <p className="chart-subtitle">用戶選擇分佈 Top 10</p>
              </div>
            </div>
            <div className="chart-container">
              {questionData.data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={questionData.data}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ answer, count }) => `${answer}: ${count}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {questionData.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-chart">暫無數據</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
