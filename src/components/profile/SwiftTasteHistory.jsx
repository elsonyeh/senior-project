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
  IoTrashOutline,
  IoNavigateOutline
} from 'react-icons/io5';
import selectionHistoryService from '../../services/selectionHistoryService';
import './SwiftTasteHistory.css';

export default function SwiftTasteHistory({ user }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, swifttaste, buddies

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
        console.log('Raw history data:', result.data);

        // 轉換資料格式以相容現有UI，並過濾未完成的記錄
        const formattedHistory = result.data
          .filter(record => {
            console.log(`Record ${record.id}: mode=${record.mode}, completed_at=${record.completed_at}`);

            // 只顯示已完成的記錄（SwiftTaste 和 Buddies 都要檢查）
            return record.completed_at != null;
          })
          .map(record => convertRecordToDisplayFormat(record));

        setHistory(formattedHistory);
        console.log(`Loaded ${formattedHistory.length} history records (SwiftTaste: ${formattedHistory.filter(r => r.mode === 'swifttaste').length}, Buddies: ${formattedHistory.filter(r => r.mode === 'buddies').length})`);
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

    // 處理不同格式的 basic_answers
    // 如果是物件格式（來自 Buddies 模式），直接使用
    if (basicAnswers && typeof basicAnswers === 'object' && !Array.isArray(basicAnswers)) {
      Object.assign(answers, basicAnswers);
    }
    // 如果是陣列格式（來自 SwiftTaste 模式），解析內容
    else if (Array.isArray(basicAnswers)) {
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
    }

    // 轉換趣味問題答案
    const rawFunAnswers = record.fun_answers || [];
    let funAnswers = [];

    // 處理不同格式的 fun_answers
    if (Array.isArray(rawFunAnswers)) {
      funAnswers = rawFunAnswers.map((answer, index) => ({
        question: `趣味問題 ${index + 1}`,
        answer: answer
      }));
    } else if (typeof rawFunAnswers === 'object') {
      // 如果是物件格式，轉換為陣列
      funAnswers = Object.entries(rawFunAnswers).map(([key, value], index) => ({
        question: key || `趣味問題 ${index + 1}`,
        answer: value
      }));
    }

    // 找到推薦的餐廳（優先使用final_restaurant，否則使用第一個推薦餐廳）
    let recommendedRestaurant = null;

    // 輔助函數：從餐廳資料中提取照片 URL
    const getPhotoUrl = (restaurant) => {
      if (!restaurant) return null;

      // 優先檢查 primaryImage 物件（Supabase 資料庫格式）
      if (restaurant.primaryImage?.image_url) {
        return restaurant.primaryImage.image_url;
      }

      // 檢查 allImages 陣列
      if (restaurant.allImages && Array.isArray(restaurant.allImages) && restaurant.allImages.length > 0) {
        const firstImage = restaurant.allImages[0];
        if (typeof firstImage === 'string') return firstImage;
        if (firstImage?.image_url) return firstImage.image_url;
      }

      // 檢查 restaurant_images 陣列
      if (restaurant.restaurant_images && Array.isArray(restaurant.restaurant_images) && restaurant.restaurant_images.length > 0) {
        const firstImage = restaurant.restaurant_images[0];
        if (typeof firstImage === 'string') return firstImage;
        if (firstImage?.image_url) return firstImage.image_url;
      }

      // 檢查其他可能的照片欄位
      if (restaurant.photo_url) return restaurant.photo_url;
      if (restaurant.photoURL) return restaurant.photoURL;
      if (restaurant.photo) return restaurant.photo;

      // 處理 photos 陣列
      if (restaurant.photos && Array.isArray(restaurant.photos)) {
        if (restaurant.photos.length > 0) {
          const firstPhoto = restaurant.photos[0];
          if (typeof firstPhoto === 'string') return firstPhoto;
          if (firstPhoto && typeof firstPhoto === 'object') {
            return firstPhoto.photo_url || firstPhoto.photoURL || firstPhoto.url || firstPhoto.image_url;
          }
        }
      }

      // 處理 photos 物件
      if (restaurant.photos && typeof restaurant.photos === 'object' && !Array.isArray(restaurant.photos)) {
        return restaurant.photos.photo_url || restaurant.photos.photoURL || restaurant.photos.url || restaurant.photos.image_url;
      }

      return null;
    };

    if (record.final_restaurant) {
      console.log(`[Record ${record.id}] final_restaurant:`, JSON.parse(JSON.stringify(record.final_restaurant)));
      const photoUrl = getPhotoUrl(record.final_restaurant);
      console.log(`Restaurant ${record.final_restaurant.name} photo URL:`, photoUrl);
      console.log(`Restaurant ${record.final_restaurant.name} keys:`, Object.keys(record.final_restaurant));

      recommendedRestaurant = {
        name: record.final_restaurant.name || '未知餐廳',
        address: record.final_restaurant.address || record.final_restaurant.vicinity || '地址未提供',
        rating: record.final_restaurant.rating || record.final_restaurant.user_ratings_total || 4.0,
        photo: photoUrl,
        place_id: record.final_restaurant.place_id || record.final_restaurant.id
      };
    } else if (record.recommended_restaurants && record.recommended_restaurants.length > 0) {
      console.log(`[Record ${record.id}] recommended_restaurants[0]:`, record.recommended_restaurants[0]);
      const firstRec = record.recommended_restaurants[0];
      const photoUrl = getPhotoUrl(firstRec);
      console.log(`Restaurant ${firstRec.name} photo:`, photoUrl);

      recommendedRestaurant = {
        name: firstRec.name || '未知餐廳',
        address: firstRec.address || firstRec.vicinity || '地址未提供',
        rating: firstRec.rating || firstRec.user_ratings_total || 4.0,
        photo: photoUrl,
        place_id: firstRec.place_id || firstRec.id
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

  // 前往餐廳
  const navigateToRestaurant = (restaurant) => {
    if (!restaurant) return;
    const query = encodeURIComponent(restaurant.address || restaurant.name);
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${query}`,
      "_blank"
    );
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
    if (filter === 'swifttaste') return record.mode === 'swifttaste';
    if (filter === 'buddies') return record.mode === 'buddies';
    return true;
  });

  // 計算當前篩選的統計資訊
  const getFilteredStats = () => {
    const count = filteredHistory.length;
    const avgDuration = count > 0
      ? Math.round(filteredHistory.reduce((sum, record) => sum + record.session_duration, 0) / count)
      : 0;

    let title = '選擇記錄';
    if (filter === 'swifttaste') {
      title = 'SwiftTaste 記錄';
    } else if (filter === 'buddies') {
      title = 'Buddies 記錄';
    }

    return { count, avgDuration, title };
  };

  const stats = getFilteredStats();

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
            {stats.title}
          </h2>
          <div className="history-stats">
            <span>{stats.count} 次選擇</span>
            <span>•</span>
            <span>{stats.avgDuration} 秒平均</span>
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
              className={`filter-btn ${filter === 'swifttaste' ? 'active' : ''}`}
              onClick={() => setFilter('swifttaste')}
            >
              SwiftTaste
            </button>
            <button
              className={`filter-btn ${filter === 'buddies' ? 'active' : ''}`}
              onClick={() => setFilter('buddies')}
            >
              Buddies
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
            <p>
              {filter === 'swifttaste' && '開始使用 SwiftTaste 來記錄您的美食選擇吧！'}
              {filter === 'buddies' && '開始使用 Buddies 模式與朋友一起選擇餐廳吧！'}
              {filter === 'all' && '開始使用 SwiftTaste 或 Buddies 來記錄您的美食選擇吧！'}
            </p>
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
                      className="delete-record-btn"
                      onClick={() => deleteRecord(record.id)}
                      title="刪除記錄"
                    >
                      <IoTrashOutline />
                    </button>
                  </div>
                </div>

                <div className="record-content">
                  {/* 推薦結果 */}
                  {record.recommended_restaurant && (
                    <div className="recommendation-result">
                      <h4 className="result-title">推薦餐廳</h4>
                      <div className="restaurant-card">
                        <div className="restaurant-image-container">
                          {record.recommended_restaurant.photo ? (
                            <>
                              <img
                                src={record.recommended_restaurant.photo}
                                alt={record.recommended_restaurant.name || '餐廳'}
                                className="restaurant-image"
                                onError={(e) => {
                                  console.error(`Failed to load image for ${record.recommended_restaurant.name}:`, record.recommended_restaurant.photo);
                                  e.target.style.display = 'none';
                                  e.target.nextElementSibling.style.display = 'flex';
                                }}
                              />
                              <div className="restaurant-image-fallback" style={{ display: 'none' }}>
                                <IoRestaurantOutline />
                              </div>
                            </>
                          ) : (
                            <div className="restaurant-image-fallback" style={{ display: 'flex' }}>
                              <IoRestaurantOutline />
                            </div>
                          )}
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
                        </div>

                        <button
                          className="navigate-to-restaurant-btn"
                          onClick={() => navigateToRestaurant(record.recommended_restaurant)}
                          title="前往餐廳"
                        >
                          <IoNavigateOutline />
                          <span>前往</span>
                        </button>
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