// 管理員資料分析頁面
import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import dataAnalyticsService from '../../services/dataAnalyticsService.js';
import './DataAnalyticsPage.css';

const COLORS = ['#667eea', '#764ba2', '#48bb78', '#ed8936', '#f56565', '#38b2ac'];

const DataAnalyticsPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState(30);
  const [timeTrendData, setTimeTrendData] = useState([]);
  const [locationData, setLocationData] = useState([]);

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  useEffect(() => {
    if (selectedTimeRange) {
      loadTimeTrendData();
    }
  }, [selectedTimeRange]);

  const loadAnalyticsData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      if (forceRefresh) {
        console.log('Force refreshing analytics data...');
        await dataAnalyticsService.clearCache();
      }

      const [overviewStats, locationStats] = await Promise.all([
        dataAnalyticsService.getOverviewStats(),
        dataAnalyticsService.getLocationStats()
      ]);

      console.log('Loaded analytics data:', overviewStats);
      setStats(overviewStats);

      // 轉換地理位置資料為圖表格式
      const locationChartData = Object.entries(locationStats || {})
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // 只顯示前10名

      setLocationData(locationChartData);

    } catch (err) {
      console.error('Failed to load analytics data:', err);
      setError('載入分析資料失敗');
    } finally {
      setLoading(false);
    }
  };

  const loadTimeTrendData = async () => {
    try {
      const trendData = await dataAnalyticsService.getTimeTrendStats(selectedTimeRange);
      setTimeTrendData(trendData || []);
    } catch (err) {
      console.error('Failed to load trend data:', err);
    }
  };

  const handleRefresh = async () => {
    console.log('Manual refresh triggered');
    await dataAnalyticsService.clearCache();
    await loadAnalyticsData(true); // 強制重新整理
    await loadTimeTrendData();
  };

  const handleExport = async (type) => {
    try {
      const csv = await dataAnalyticsService.exportStatsToCsv(type);
      if (csv) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `swifttaste-analytics-${type}-${new Date().toISOString().substring(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">載入分析資料中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-page">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <div className="error-title">{error}</div>
          <button onClick={loadAnalyticsData} className="retry-button">
            重新載入
          </button>
        </div>
      </div>
    );
  }

  const userChartData = stats?.users ? [
    { name: '註冊用戶', value: stats.users.registeredUsers },
    { name: '活躍用戶', value: stats.users.activeUsers },
    { name: '匿名會話', value: stats.users.anonymousSessions }
  ] : [];

  const modeChartData = stats?.modes ? [
    { name: 'SwiftTaste模式', value: stats.modes.swiftTasteSessions },
    { name: 'Buddies模式', value: stats.modes.buddiesSessions }
  ] : [];

  const topRestaurants = stats?.restaurants?.finalChoices ?
    Object.entries(stats.restaurants.finalChoices)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name: name.length > 20 ? name.substring(0, 20) + '...' : name, count }))
    : [];

  const topQuestions = stats?.questions?.basicQuestions ?
    Object.entries(stats.questions.basicQuestions)
      .map(([question, answers]) => ({
        question: `問題 ${question.replace('question_', '')}`,
        totalAnswers: Object.values(answers).reduce((sum, count) => sum + count, 0)
      }))
      .sort((a, b) => b.totalAnswers - a.totalAnswers)
      .slice(0, 5)
    : [];

  return (
    <div className="analytics-page fade-in">
      {/* 標題區 */}
      <div className="analytics-header">
        <div className="container">
          <div className="header-content">
            <div className="header-left">
              <h1>📊 SwiftTaste 資料分析</h1>
              <p>
                最後更新：{stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleString('zh-TW') : '載入中...'}
              </p>
            </div>
            <div className="header-controls">
              <button
                onClick={handleRefresh}
                className="refresh-button"
                disabled={loading}
              >
                🔄 {loading ? '更新中...' : '重新整理'}
              </button>
              <select
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(parseInt(e.target.value))}
                className="time-range-select"
              >
                <option value={7}>過去 7 天</option>
                <option value={30}>過去 30 天</option>
                <option value={90}>過去 90 天</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="analytics-content">
        {/* 總覽卡片 */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon blue">
                <span>👥</span>
              </div>
              <div className="stat-info">
                <h3>總用戶數</h3>
                <div className="stat-value">{stats?.users?.totalUsers || 0}</div>
                <p className="stat-subtitle">
                  本月新增 {stats?.users?.newUsers || 0} 人
                </p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon green">
                <span>🎯</span>
              </div>
              <div className="stat-info">
                <h3>總選擇次數</h3>
                <div className="stat-value">{stats?.modes?.totalSessions || 0}</div>
                <p className="stat-subtitle">
                  完成率 {stats?.modes?.totalSessions > 0 ?
                    Math.round((stats?.modes?.completedSessions || 0) / stats.modes.totalSessions * 100) : 0}%
                </p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon yellow">
                <span>👆</span>
              </div>
              <div className="stat-info">
                <h3>總滑動次數</h3>
                <div className="stat-value">{stats?.interactions?.totalSwipes || 0}</div>
                <p className="stat-subtitle">
                  平均每次 {stats?.modes?.totalSessions > 0 ?
                    Math.round((stats?.interactions?.totalSwipes || 0) / stats.modes.totalSessions) : 0} 次
                </p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon red">
                <span>⭐</span>
              </div>
              <div className="stat-info">
                <h3>平均滿意度</h3>
                <div className="stat-value">
                  {stats?.interactions?.avgSatisfaction || 0}/5
                </div>
                <p className="stat-subtitle">
                  {stats?.interactions?.satisfactionCount || 0} 份評價
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 圖表區域 */}
        <div className="charts-grid">
          {/* 用戶統計圓餅圖 */}
          <div className="chart-card">
            <div className="chart-header">
              <h3 className="chart-title">👥 用戶分布</h3>
              <button
                onClick={() => handleExport('users')}
                className="export-button"
              >
                📊 導出
              </button>
            </div>
            {userChartData.length > 0 ? (
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={userChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {userChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [value, name]}
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-chart">
                📊 暫無用戶資料
              </div>
            )}
          </div>

          {/* 模式使用統計 */}
          <div className="chart-card">
            <div className="chart-header">
              <h3 className="chart-title">🎯 選擇模式統計</h3>
              <button
                onClick={() => handleExport('modes')}
                className="export-button"
              >
                📊 導出
              </button>
            </div>
            {modeChartData.length > 0 ? (
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modeChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    />
                    <Bar dataKey="value" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-chart">
                📊 暫無模式資料
              </div>
            )}
          </div>
        </div>

        {/* 時間趨勢圖 */}
        <div className="chart-card full-width-chart">
          <div className="chart-header">
            <h3 className="chart-title">
              📈 使用趨勢 (過去 {selectedTimeRange} 天)
            </h3>
            <div className="flex items-center gap-4">
              {timeTrendData.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>總會話數: {timeTrendData.reduce((sum, day) => sum + day.total, 0)}</span>
                  <span>•</span>
                  <span>完成率: {Math.round(
                    (timeTrendData.reduce((sum, day) => sum + day.completed, 0) /
                     Math.max(timeTrendData.reduce((sum, day) => sum + day.total, 0), 1)) * 100
                  )}%</span>
                </div>
              )}
              <button
                onClick={() => handleExport('trends')}
                className="export-button"
              >
                📊 導出
              </button>
            </div>
          </div>
          {timeTrendData.length > 0 ? (
            <div className="chart-container" style={{ height: '400px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeTrendData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleDateString('zh-TW')}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="swifttaste"
                    stroke={COLORS[0]}
                    strokeWidth={3}
                    name="SwiftTaste"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="buddies"
                    stroke={COLORS[2]}
                    strokeWidth={3}
                    name="Buddies"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke={COLORS[3]}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="已完成"
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-chart" style={{ height: '400px' }}>
              📈 暫無趨勢資料
            </div>
          )}
        </div>

        {/* 餐廳和問題統計 */}
        <div className="charts-grid">
          {/* 熱門餐廳 */}
          <div className="chart-card">
            <div className="chart-header">
              <h3 className="chart-title">🍽️ 熱門餐廳排行</h3>
              <div className="flex items-center gap-4">
                {topRestaurants.length > 0 && (
                  <span className="text-sm text-gray-600">
                    共 {topRestaurants.reduce((sum, r) => sum + r.count, 0)} 次選擇
                  </span>
                )}
                <button
                  onClick={() => handleExport('restaurants')}
                  className="export-button"
                >
                  📊 導出
                </button>
              </div>
            </div>
            {topRestaurants.length > 0 ? (
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topRestaurants} layout="horizontal" margin={{ top: 20, right: 30, left: 100, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={100}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => value.length > 12 ? value.substring(0, 12) + '...' : value}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    />
                    <Bar dataKey="count" fill={COLORS[4]} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-chart">
                🍽️ 暫無餐廳選擇資料
              </div>
            )}
          </div>

          {/* 問題回答統計 */}
          <div className="chart-card">
            <div className="chart-header">
              <h3 className="chart-title">❓ 問題回答統計</h3>
              <div className="flex items-center gap-4">
                {topQuestions.length > 0 && (
                  <span className="text-sm text-gray-600">
                    共 {topQuestions.reduce((sum, q) => sum + q.totalAnswers, 0)} 次回答
                  </span>
                )}
                <button
                  onClick={() => handleExport('questions')}
                  className="export-button"
                >
                  📊 導出
                </button>
              </div>
            </div>
            {topQuestions.length > 0 ? (
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topQuestions} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="question" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    />
                    <Bar dataKey="totalAnswers" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-chart">
                ❓ 暫無問題回答資料
              </div>
            )}
          </div>
        </div>

        {/* 地理位置統計 */}
        {locationData.length > 0 && (
          <div className="chart-card full-width-chart">
            <div className="chart-header">
              <h3 className="chart-title">📍 地理位置分布</h3>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  覆蓋 {locationData.length} 個地區
                </span>
                <button
                  onClick={() => handleExport('locations')}
                  className="export-button"
                >
                  📊 導出
                </button>
              </div>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={locationData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="city" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                  />
                  <Bar dataKey="count" fill={COLORS[5]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 詳細統計表格 */}
        <div className="details-section">
          <h3 className="details-title">📊 詳細統計數據</h3>
          <div className="details-grid">
            {/* 用戶統計 */}
            <div className="detail-section">
              <h4>👥 用戶統計</h4>
              <ul className="detail-list">
                <li className="detail-item">
                  <span className="detail-label">註冊用戶</span>
                  <span className="detail-value">{stats?.users?.registeredUsers || 0}</span>
                </li>
                <li className="detail-item">
                  <span className="detail-label">活躍用戶</span>
                  <span className="detail-value">{stats?.users?.activeUsers || 0}</span>
                </li>
                <li className="detail-item">
                  <span className="detail-label">匿名會話</span>
                  <span className="detail-value">{stats?.users?.anonymousSessions || 0}</span>
                </li>
                <li className="detail-item">
                  <span className="detail-label">本月新增</span>
                  <span className="detail-value">
                    {stats?.users?.newUsers || 0} 人
                  </span>
                </li>
              </ul>
            </div>

            {/* 互動統計 */}
            <div className="detail-section">
              <h4>🎯 互動統計</h4>
              <ul className="detail-list">
                <li className="detail-item">
                  <span className="detail-label">總滑動次數</span>
                  <span className="detail-value">{stats?.interactions?.totalSwipes?.toLocaleString() || 0}</span>
                </li>
                <li className="detail-item">
                  <span className="detail-label">總點讚數</span>
                  <span className="detail-value">{stats?.interactions?.totalLikedRestaurants?.toLocaleString() || 0}</span>
                </li>
                <li className="detail-item">
                  <span className="detail-label">最終選擇</span>
                  <span className="detail-value">{stats?.interactions?.finalChoices?.toLocaleString() || 0}</span>
                </li>
                <li className="detail-item">
                  <span className="detail-label">平均滿意度</span>
                  <span className="detail-value">
                    {stats?.interactions?.avgSatisfaction || 0}/5 ⭐
                  </span>
                </li>
              </ul>
            </div>

            {/* 會話統計 */}
            <div className="detail-section">
              <h4>⏱️ 會話統計</h4>
              <ul className="detail-list">
                <li className="detail-item">
                  <span className="detail-label">總會話數</span>
                  <span className="detail-value">{stats?.modes?.totalSessions?.toLocaleString() || 0}</span>
                </li>
                <li className="detail-item">
                  <span className="detail-label">完成會話</span>
                  <span className="detail-value">{stats?.modes?.completedSessions?.toLocaleString() || 0}</span>
                </li>
                <li className="detail-item">
                  <span className="detail-label">平均時長</span>
                  <span className="detail-value">{Math.round((stats?.modes?.avgDuration || 0) / 60)} 分鐘</span>
                </li>
                <li className="detail-item">
                  <span className="detail-label">完成率</span>
                  <span className="detail-value">
                    {stats?.modes?.totalSessions > 0 ?
                      Math.round((stats?.modes?.completedSessions || 0) / stats.modes.totalSessions * 100) : 0}%
                  </span>
                </li>
              </ul>
            </div>

            {/* 模式分析 */}
            <div className="detail-section">
              <h4>🔄 模式分析</h4>
              <ul className="detail-list">
                <li className="detail-item">
                  <span className="detail-label">SwiftTaste 模式</span>
                  <span className="detail-value">{stats?.modes?.swiftTasteSessions?.toLocaleString() || 0}</span>
                </li>
                <li className="detail-item">
                  <span className="detail-label">Buddies 模式</span>
                  <span className="detail-value">{stats?.modes?.buddiesSessions?.toLocaleString() || 0}</span>
                </li>
                <li className="detail-item">
                  <span className="detail-label">Buddies 房間</span>
                  <span className="detail-value">{stats?.modes?.totalBuddiesRooms?.toLocaleString() || 0}</span>
                </li>
                <li className="detail-item">
                  <span className="detail-label">最受歡迎模式</span>
                  <span className="detail-value">
                    {(stats?.modes?.swiftTasteSessions || 0) > (stats?.modes?.buddiesSessions || 0)
                      ? 'SwiftTaste' : 'Buddies'}
                  </span>
                </li>
              </ul>
            </div>

            {/* 問題統計 */}
            <div className="detail-section">
              <h4>❓ 問題統計</h4>
              <ul className="detail-list">
                <li className="detail-item">
                  <span className="detail-label">基本問題回答</span>
                  <span className="detail-value">{stats?.questions?.totalBasicAnswers?.toLocaleString() || 0}</span>
                </li>
                <li className="detail-item">
                  <span className="detail-label">趣味問題回答</span>
                  <span className="detail-value">{stats?.questions?.totalFunAnswers?.toLocaleString() || 0}</span>
                </li>
                <li className="detail-item">
                  <span className="detail-label">Buddies 問題</span>
                  <span className="detail-value">{stats?.questions?.totalBuddiesAnswers?.toLocaleString() || 0}</span>
                </li>
                <li className="detail-item">
                  <span className="detail-label">總回答數</span>
                  <span className="detail-value">
                    {(
                      (stats?.questions?.totalBasicAnswers || 0) +
                      (stats?.questions?.totalFunAnswers || 0) +
                      (stats?.questions?.totalBuddiesAnswers || 0)
                    ).toLocaleString()}
                  </span>
                </li>
              </ul>
            </div>

            {/* 餐廳統計 */}
            <div className="detail-section">
              <h4>🍽️ 餐廳統計</h4>
              <ul className="detail-list">
                <li className="detail-item">
                  <span className="detail-label">推薦總數</span>
                  <span className="detail-value">{stats?.restaurants?.totalRecommendations?.toLocaleString() || 0}</span>
                </li>
                <li className="detail-item">
                  <span className="detail-label">最終選擇</span>
                  <span className="detail-value">{stats?.restaurants?.totalFinalChoices?.toLocaleString() || 0}</span>
                </li>
                <li className="detail-item">
                  <span className="detail-label">總點讚數</span>
                  <span className="detail-value">{stats?.restaurants?.totalLikes?.toLocaleString() || 0}</span>
                </li>
                <li className="detail-item">
                  <span className="detail-label">選擇轉換率</span>
                  <span className="detail-value">
                    {stats?.restaurants?.totalRecommendations > 0 ?
                      Math.round((stats?.restaurants?.totalFinalChoices || 0) / stats.restaurants.totalRecommendations * 100) : 0}%
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataAnalyticsPage;