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
      // 這裡應該從 Supabase 載入用戶的 SwiftTaste 記錄
      // 暫時使用模擬數據
      const mockHistory = generateMockHistory();
      setHistory(mockHistory);
    } catch (error) {
      console.error('Error loading SwiftTaste history:', error);
    } finally {
      setLoading(false);
    }
  };

  // 生成模擬歷史數據
  const generateMockHistory = () => {
    const mockData = [
      {
        id: 'st_1',
        timestamp: new Date(Date.now() - 3600000).toISOString(), // 1小時前
        mode: 'swifttaste',
        answers: {
          dining_companions: '多人',
          price_level: '奢華美食',
          meal_type: '吃',
          portion_size: '吃飽',
          spice_level: '辣'
        },
        fun_answers: [],
        recommended_restaurant: {
          name: '鼎泰豐',
          address: '台北市大安區信義路二段194號',
          rating: 4.5,
          photo: 'https://images.unsplash.com/photo-1563379091303-2b7035a95648?w=200&h=150&fit=crop',
          reason: '符合您的高級餐廳偏好，適合多人聚餐'
        },
        session_duration: 45 // 秒
      },
      {
        id: 'st_2',
        timestamp: new Date(Date.now() - 86400000).toISOString(), // 1天前
        mode: 'buddies',
        answers: {
          dining_companions: '多人',
          price_level: '平價美食',
          meal_type: '喝',
          portion_size: null,
          spice_level: null
        },
        fun_answers: [
          { question: '貓派v.s.狗派', answer: '貓派' },
          { question: '你是Ｉ人還是Ｅ人', answer: 'Ｉ人' },
          { question: '側背包 v.s. 後背包', answer: '後背包' }
        ],
        recommended_restaurant: {
          name: '春水堂',
          address: '台北市大安區復興南路一段390號',
          rating: 4.3,
          photo: 'https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?w=200&h=150&fit=crop',
          reason: '適合內向型人格的安靜飲品店'
        },
        session_duration: 89
      },
      {
        id: 'st_3',
        timestamp: new Date(Date.now() - 172800000).toISOString(), // 2天前
        mode: 'swifttaste',
        answers: {
          dining_companions: '單人',
          price_level: '平價美食',
          meal_type: '吃',
          portion_size: '吃一點',
          spice_level: '不辣'
        },
        fun_answers: [],
        recommended_restaurant: {
          name: '阿宗麵線',
          address: '台北市萬華區峨眉街8-1號',
          rating: 4.2,
          photo: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=200&h=150&fit=crop',
          reason: '單人用餐友好的小份量選擇'
        },
        session_duration: 32
      }
    ];

    return mockData;
  };

  // 清除歷史記錄
  const clearHistory = async () => {
    if (confirm('確定要清除所有SwiftTaste記錄嗎？這個操作無法復原。')) {
      setHistory([]);
      // 這裡應該調用API刪除後端數據
    }
  };

  // 刪除單個記錄
  const deleteRecord = async (recordId) => {
    setHistory(prev => prev.filter(record => record.id !== recordId));
    // 這裡應該調用API刪除後端數據
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
                  <div className="recommendation-result">
                    <h4 className="result-title">推薦餐廳</h4>
                    <div className="restaurant-card">
                      <div className="restaurant-image-container">
                        <img
                          src={record.recommended_restaurant.photo}
                          alt={record.recommended_restaurant.name}
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
                        <h5 className="restaurant-name">{record.recommended_restaurant.name}</h5>
                        <p className="restaurant-address">{record.recommended_restaurant.address}</p>
                        <div className="restaurant-rating">
                          <span className="rating-stars">
                            {'★'.repeat(Math.floor(record.recommended_restaurant.rating))}
                            {'☆'.repeat(5 - Math.floor(record.recommended_restaurant.rating))}
                          </span>
                          <span className="rating-value">{record.recommended_restaurant.rating}</span>
                        </div>
                        <p className="recommendation-reason">{record.recommended_restaurant.reason}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}