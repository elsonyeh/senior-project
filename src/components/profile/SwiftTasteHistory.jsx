import React, { useState, useEffect } from 'react';
import {
  IoTimeOutline,
  IoRestaurantOutline,
  IoCheckmarkOutline,
  IoPersonOutline,
  IoFastFoodOutline,
  IoWineOutline,
  IoFlameOutline,
  IoPeopleOutline,
  IoRefreshOutline,
  IoTrashOutline
} from 'react-icons/io5';
import selectionHistoryService from '../../services/selectionHistoryService';
import './SwiftTasteHistory.css';

export default function SwiftTasteHistory({ user }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, solo, group

  useEffect(() => {
    loadSwiftTasteHistory();
  }, [user]);

  // 載入SwiftTaste歷史記錄
  const loadSwiftTasteHistory = async () => {
    try {
      setLoading(true);
      console.log('Loading user selection history...');

      // 從 Supabase 載入用戶的選擇記錄
      const result = await selectionHistoryService.getUserHistory(50);

      if (result.success) {
        // 轉換資料格式以相容現有UI
        const formattedHistory = result.data.map(record => convertRecordToDisplayFormat(record));
        setHistory(formattedHistory);
        console.log(`Loaded ${formattedHistory.length} history records`);
      } else {
        console.error('Failed to load history:', result.error);
        // 如果載入失敗，顯示空陣列
        setHistory([]);
      }
    } catch (error) {
      console.error('Error loading SwiftTaste history:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  // 轉換資料庫記錄到顯示格式
  const convertRecordToDisplayFormat = (record) => {
    // 轉換基本答案為物件格式
    const answers = {};
    const basicAnswers = record.basic_answers || [];

    // 根據答案內容推斷欄位
    basicAnswers.forEach(answer => {
      if (['單人', '多人'].includes(answer)) {
        answers.dining_companions = answer;
      } else if (['平價美食', '奢華美食'].includes(answer)) {
        answers.price_level = answer;
      } else if (['吃', '喝'].includes(answer)) {
        answers.meal_type = answer;
      } else if (['吃一點', '吃飽'].includes(answer)) {
        answers.portion_size = answer;
      } else if (['辣', '不辣'].includes(answer)) {
        answers.spice_level = answer;
      }
    });

    // 轉換趣味問題答案
    const funAnswers = (record.fun_answers || []).map((answer, index) => ({
      question: `趣味問題 ${index + 1}`,
      answer: answer
    }));

    // 找到推薦的餐廳（優先使用final_restaurant，否則使用第一個推薦餐廳）
    let recommendedRestaurant = null;
    if (record.final_restaurant) {
      recommendedRestaurant = {
        name: record.final_restaurant.name || '未知餐廳',
        address: record.final_restaurant.address || record.final_restaurant.vicinity || '地址未提供',
        rating: record.final_restaurant.rating || record.final_restaurant.user_ratings_total || 4.0,
        photo: record.final_restaurant.photos?.[0] || record.final_restaurant.photo ||
               record.final_restaurant.photoURL || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=150&fit=crop',
        reason: '根據您的喜好推薦'
      };
    } else if (record.recommended_restaurants && record.recommended_restaurants.length > 0) {
      const firstRec = record.recommended_restaurants[0];
      recommendedRestaurant = {
        name: firstRec.name || '未知餐廳',
        address: firstRec.address || firstRec.vicinity || '地址未提供',
        rating: firstRec.rating || firstRec.user_ratings_total || 4.0,
        photo: firstRec.photos?.[0] || firstRec.photo || firstRec.photoURL ||
               'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=150&fit=crop',
        reason: '根據您的喜好推薦'
      };
    }

    return {
      id: record.id,
      timestamp: record.started_at || record.created_at,
      mode: record.mode,
      answers,
      fun_answers: funAnswers,
      recommended_restaurant: recommendedRestaurant,
      session_duration: record.session_duration || 0
    };
  };

  // 清除歷史記錄
  const clearHistory = async () => {
    if (confirm('確定要清除所有SwiftTaste記錄嗎？這個操作無法復原。')) {
      try {
        const result = await selectionHistoryService.clearAllHistory();
        if (result.success) {
          setHistory([]);
          console.log('History cleared successfully');
        } else {
          console.error('Failed to clear history:', result.error);
          alert('清除失敗，請稍後再試');
        }
      } catch (error) {
        console.error('Error clearing history:', error);
        alert('清除失敗，請稍後再試');
      }
    }
  };

  // 刪除單個記錄
  const deleteRecord = async (recordId) => {
    try {
      const result = await selectionHistoryService.deleteSession(recordId);
      if (result.success) {
        setHistory(prev => prev.filter(record => record.id !== recordId));
        console.log('Record deleted successfully:', recordId);
      } else {
        console.error('Failed to delete record:', result.error);
        alert('刪除失敗，請稍後再試');
      }
    } catch (error) {
      console.error('Error deleting record:', error);
      alert('刪除失敗，請稍後再試');
    }
  };

  // 重新執行SwiftTaste
  const retrySwiftTaste = (record) => {
    // 這裡可以跳轉到SwiftTaste頁面並預填答案
    console.log('Retry SwiftTaste with answers:', record.answers);
    window.location.href = '/swift';
  };

  // 格式化時間
  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInMs = now - date;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInMinutes < 60) return `${diffInMinutes}分鐘前`;
    if (diffInHours < 24) return `${diffInHours}小時前`;
    if (diffInDays === 1) return '昨天';
    return date.toLocaleDateString('zh-TW', {
      month: 'short',
      day: 'numeric'
    });
  };

  // 格式化持續時間
  const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分`;
  };

  // 取得答案圖標
  const getAnswerIcon = (key, value) => {
    if (key === 'dining_companions') {
      return value === '單人' ? <IoPersonOutline /> : <IoPeopleOutline />;
    }
    if (key === 'meal_type') {
      return value === '吃' ? <IoFastFoodOutline /> : <IoWineOutline />;
    }
    if (key === 'spice_level') {
      return value === '辣' ? <IoFlameOutline /> : <IoCheckmarkOutline />;
    }
    return <IoCheckmarkOutline />;
  };

  // 過濾記錄
  const filteredHistory = history.filter(record => {
    if (filter === 'all') return true;
    if (filter === 'solo') return record.answers.dining_companions === '單人';
    if (filter === 'group') return record.answers.dining_companions === '多人';
    return true;
  });

  if (loading) {
    return (
      <div className="swifttaste-history-loading">
        <div className="loading-spinner"></div>
        <p>載入記錄中...</p>
      </div>
    );
  }

  return (
    <div className="swifttaste-history-container">
      {/* 標題區域 */}
      <div className="history-header">
        <div className="header-left">
          <h2 className="history-title">
            <IoTimeOutline className="title-icon" />
            SwiftTaste 記錄
          </h2>
          <div className="history-stats">
            <span>{history.length} 次選擇</span>
            <span>•</span>
            <span>{Math.round(history.reduce((sum, record) => sum + record.session_duration, 0) / history.length) || 0} 秒平均</span>
          </div>
        </div>
        
        <div className="header-actions">
          {/* 篩選按鈕 */}
          <div className="filter-buttons">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              全部
            </button>
            <button
              className={`filter-btn ${filter === 'solo' ? 'active' : ''}`}
              onClick={() => setFilter('solo')}
            >
              單人
            </button>
            <button
              className={`filter-btn ${filter === 'group' ? 'active' : ''}`}
              onClick={() => setFilter('group')}
            >
              多人
            </button>
          </div>
          
          {/* 清除按鈕 */}
          {history.length > 0 && (
            <button
              className="clear-history-btn"
              onClick={clearHistory}
              title="清除所有記錄"
            >
              <IoTrashOutline />
            </button>
          )}
        </div>
      </div>

      {/* 記錄列表 */}
      <div className="history-content">
        {filteredHistory.length === 0 ? (
          <div className="empty-history">
            <IoRestaurantOutline className="empty-icon" />
            <h3>還沒有記錄</h3>
            <p>開始使用 SwiftTaste 來記錄您的美食選擇吧！</p>
          </div>
        ) : (
          <div className="history-list">
            {filteredHistory.map(record => (
              <div key={record.id} className="history-record">
                <div className="record-header">
                  <div className="record-meta">
                    <div className="record-mode">
                      <span className={`mode-badge ${record.mode}`}>
                        {record.mode === 'swifttaste' ? 'SwiftTaste' : 'Buddies'}
                      </span>
                      <span className="record-time">
                        {formatTimestamp(record.timestamp)}
                      </span>
                    </div>
                    <div className="record-duration">
                      用時 {formatDuration(record.session_duration)}
                    </div>
                  </div>
                  
                  <div className="record-actions">
                    <button
                      className="retry-btn"
                      onClick={() => retrySwiftTaste(record)}
                      title="再次選擇"
                    >
                      <IoRefreshOutline />
                    </button>
                    <button
                      className="delete-record-btn"
                      onClick={() => deleteRecord(record.id)}
                      title="刪除記錄"
                    >
                      <IoTrashOutline />
                    </button>
                  </div>
                </div>

                <div className="record-content">
                  {/* 答案摘要 */}
                  <div className="answers-summary">
                    <h4 className="summary-title">您的選擇</h4>
                    <div className="answers-grid">
                      {Object.entries(record.answers).map(([key, value]) => 
                        value && (
                          <div key={key} className="answer-item">
                            {getAnswerIcon(key, value)}
                            <span className="answer-text">{value}</span>
                          </div>
                        )
                      )}
                    </div>
                    
                    {/* 趣味問題答案 */}
                    {record.fun_answers && record.fun_answers.length > 0 && (
                      <div className="fun-answers">
                        <div className="fun-answers-header">趣味選擇</div>
                        <div className="fun-answers-list">
                          {record.fun_answers.map((funAnswer, index) => (
                            <div key={index} className="fun-answer-item">
                              <span className="fun-question">{funAnswer.question}</span>
                              <span className="fun-answer">{funAnswer.answer}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 推薦結果 */}
                  {record.recommended_restaurant && (
                    <div className="recommendation-result">
                      <h4 className="result-title">推薦餐廳</h4>
                      <div className="restaurant-card">
                        <div className="restaurant-image-container">
                          <img
                            src={record.recommended_restaurant.photo || '/default-restaurant.jpg'}
                            alt={record.recommended_restaurant.name || '餐廳'}
                            className="restaurant-image"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextElementSibling.style.display = 'flex';
                            }}
                          />
                          <div className="restaurant-image-fallback">
                            <IoRestaurantOutline />
                          </div>
                        </div>

                        <div className="restaurant-info">
                          <h5 className="restaurant-name">{record.recommended_restaurant.name || '未知餐廳'}</h5>
                          <p className="restaurant-address">{record.recommended_restaurant.address || '地址未提供'}</p>
                          {record.recommended_restaurant.rating && (
                            <div className="restaurant-rating">
                              <span className="rating-stars">
                                {'★'.repeat(Math.floor(record.recommended_restaurant.rating))}
                                {'☆'.repeat(5 - Math.floor(record.recommended_restaurant.rating))}
                              </span>
                              <span className="rating-value">{record.recommended_restaurant.rating}</span>
                            </div>
                          )}
                          {record.recommended_restaurant.reason && (
                            <p className="recommendation-reason">{record.recommended_restaurant.reason}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}