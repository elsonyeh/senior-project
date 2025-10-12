import React, { useState, useEffect } from 'react';
import {
  IoRefreshOutline,
  IoStopOutline,
  IoCheckmarkCircleOutline,
  IoAlertCircleOutline,
  IoTimeOutline,
  IoRestaurantOutline,
  IoStarOutline,
  IoCloseOutline
} from 'react-icons/io5';
import { restaurantService } from '../../services/restaurantService';
import restaurantRatingService from '../../services/restaurantRatingService';
import './RestaurantRatingUpdater.css';

export default function RestaurantRatingUpdater() {
  const [restaurants, setRestaurants] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState(null);
  const [updateResults, setUpdateResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [updateOptions, setUpdateOptions] = useState({
    batchSize: 5,
    delay: 1000,
    forceUpdate: false,
    maxAge: 0, // 天，預設為 0 不跳過任何餐廳
    limitCount: 5, // 限制更新數量，預設為 5 便於測試
    priorityMode: 'no_rating' // 'oldest' | 'never' | 'no_rating' | 'all'
  });
  const [showManualMatch, setShowManualMatch] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [unmatchedRestaurants, setUnmatchedRestaurants] = useState([]);
  const [isLoadingUnmatched, setIsLoadingUnmatched] = useState(false);
  const [showRestaurantSelector, setShowRestaurantSelector] = useState(false);
  const [showSearchRestaurant, setShowSearchRestaurant] = useState(false);
  const [searchRestaurantQuery, setSearchRestaurantQuery] = useState('');
  const [filteredRestaurants, setFilteredRestaurants] = useState([]);

  // 載入餐廳列表
  const loadRestaurants = async () => {
    setIsLoading(true);
    try {
      const data = await restaurantService.getRestaurants();
      setRestaurants(data);
      console.log(`載入了 ${data.length} 間餐廳`);
    } catch (error) {
      console.error('載入餐廳失敗:', error);
      alert('載入餐廳清單失敗');
    } finally {
      setIsLoading(false);
    }
  };

  // 開始更新評分
  const startRatingUpdate = async () => {
    if (restaurants.length === 0) {
      alert('請先載入餐廳清單');
      return;
    }

    setIsUpdating(true);
    setProgress(null);
    setUpdateResults(null);
    setShowResults(false);

    try {
      const options = {
        batchSize: parseInt(updateOptions.batchSize),
        delay: parseInt(updateOptions.delay),
        forceUpdate: updateOptions.forceUpdate,
        maxAge: parseInt(updateOptions.maxAge) * 24 * 60 * 60 * 1000, // 轉換為毫秒
        limitCount: parseInt(updateOptions.limitCount) || 0,
        priorityMode: updateOptions.priorityMode
      };

      console.log('🎛️ 更新選項:', updateOptions);
      console.log('📋 最終選項:', options);
      console.log('🏪 總餐廳數量:', restaurants.length);

      // 預先檢查會有多少餐廳符合更新條件
      if (!options.forceUpdate && options.maxAge > 0) {
        const now = new Date();
        const eligible = restaurants.filter(r => {
          if (!r.name || (!r.latitude || !r.longitude)) return false;
          if (r.rating_updated_at) {
            const lastUpdate = new Date(r.rating_updated_at);
            const timeDiff = now - lastUpdate;
            return timeDiff >= options.maxAge;
          }
          return true;
        });
        console.log(`📊 符合更新條件的餐廳數量: ${eligible.length}`);
      }

      const results = await restaurantRatingService.updateRestaurantRatings(
        restaurants,
        (progressData) => {
          setProgress(progressData);
        },
        options
      );

      setUpdateResults(results);
      setShowResults(true);

      // 更新完成後重新載入餐廳列表
      await loadRestaurants();

    } catch (error) {
      console.error('更新評分失敗:', error);
      alert(`更新失敗: ${error.message}`);
    } finally {
      setIsUpdating(false);
      setProgress(null);
    }
  };

  // 停止更新
  const stopUpdate = () => {
    restaurantRatingService.stopUpdate();
    setIsUpdating(false);
    setProgress(null);
  };


  // 載入無法匹配的餐廳
  const loadUnmatchedRestaurants = async () => {
    if (restaurants.length === 0) {
      alert('請先載入餐廳清單');
      return;
    }

    setIsLoadingUnmatched(true);
    try {
      const unmatched = await restaurantRatingService.getUnmatchedRestaurants(restaurants);
      setUnmatchedRestaurants(unmatched);

      if (unmatched.length === 0) {
        alert('🎉 所有餐廳都可以自動匹配！');
      } else {
        setShowRestaurantSelector(true);
      }
    } catch (error) {
      console.error('載入無法匹配餐廳失敗:', error);
      alert(`載入失敗: ${error.message}`);
    } finally {
      setIsLoadingUnmatched(false);
    }
  };

  // 開啟手動匹配功能
  const openManualMatch = (restaurant = null) => {
    if (restaurant) {
      setSelectedRestaurant(restaurant);
      setManualSearchQuery(restaurant.name);
    } else {
      // 如果沒有指定餐廳，顯示選擇器
      if (unmatchedRestaurants.length === 0) {
        loadUnmatchedRestaurants();
        return;
      }
      setShowRestaurantSelector(true);
      return;
    }

    setSearchResults([]);
    setShowManualMatch(true);
    setShowRestaurantSelector(false);
  };

  // 手動搜尋 Google Places
  const manualSearchPlaces = async () => {
    if (!selectedRestaurant || !manualSearchQuery.trim()) {
      alert('請輸入搜尋關鍵字');
      return;
    }

    setIsSearching(true);
    try {
      const results = await restaurantRatingService.manualSearchPlaces(
        selectedRestaurant,
        manualSearchQuery.trim()
      );
      setSearchResults(results);

      if (results.length === 0) {
        alert('沒有找到相關的餐廳，請嘗試不同的搜尋關鍵字');
      }
    } catch (error) {
      console.error('手動搜尋失敗:', error);
      alert(`搜尋失敗: ${error.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  // 選擇並更新餐廳
  const selectAndUpdateRestaurant = async (selectedPlace) => {
    try {
      const result = await restaurantRatingService.manualUpdateRestaurant(
        selectedRestaurant.id,
        selectedPlace
      );

      if (result.success) {
        const coordsText = selectedPlace.latitude && selectedPlace.longitude
          ? `\n座標: (${selectedPlace.latitude.toFixed(6)}, ${selectedPlace.longitude.toFixed(6)})`
          : '';

        alert(`✅ 更新成功！\n餐廳: ${selectedRestaurant.name}\n評分: ${selectedPlace.rating}\n評分數: ${selectedPlace.user_ratings_total}${coordsText}`);

        // 從無法匹配列表中移除此餐廳
        const updatedUnmatched = restaurantRatingService.removeFromUnmatchedList(selectedRestaurant.id);
        setUnmatchedRestaurants(updatedUnmatched);

        // 關閉手動匹配對話框
        setShowManualMatch(false);
        setSelectedRestaurant(null);
        setSearchResults([]);

        // 重新載入餐廳清單
        await loadRestaurants();
      }
    } catch (error) {
      console.error('手動更新失敗:', error);
      alert(`更新失敗: ${error.message}`);
    }
  };

  // 移除單一餐廳從無法匹配列表
  const removeUnmatchedRestaurant = (restaurantId) => {
    const updatedUnmatched = restaurantRatingService.removeFromUnmatchedList(restaurantId);
    setUnmatchedRestaurants(updatedUnmatched);
  };

  // 清空所有無法匹配的餐廳
  const clearAllUnmatched = () => {
    if (confirm('確定要清空所有無法匹配的餐廳嗎？')) {
      restaurantRatingService.clearUnmatchedList();
      setUnmatchedRestaurants([]);
    }
  };

  // 開啟餐廳搜尋對話框
  const openSearchRestaurant = () => {
    setShowSearchRestaurant(true);
    setSearchRestaurantQuery('');
    setFilteredRestaurants([]);
  };

  // 搜尋餐廳
  const handleSearchRestaurant = (query) => {
    setSearchRestaurantQuery(query);

    if (!query.trim()) {
      setFilteredRestaurants([]);
      return;
    }

    const filtered = restaurants.filter(r =>
      r.name.toLowerCase().includes(query.toLowerCase()) ||
      (r.address && r.address.toLowerCase().includes(query.toLowerCase()))
    );

    setFilteredRestaurants(filtered.slice(0, 20)); // 限制顯示 20 個結果
  };

  // 選擇餐廳進行重新匹配
  const selectRestaurantForRematch = (restaurant) => {
    setShowSearchRestaurant(false);
    openManualMatch(restaurant);
  };

  // 清除餐廳的 Google Places 綁定資料
  const clearGoogleData = async (clearCoordinates = false) => {
    if (!selectedRestaurant) return;

    const confirmMessage = clearCoordinates
      ? `確定要清除「${selectedRestaurant.name}」的以下資料嗎？\n\n• Google Place ID\n• 評分和評分數\n• 經緯度座標\n\n此操作無法復原！`
      : `確定要清除「${selectedRestaurant.name}」的以下資料嗎？\n\n• Google Place ID\n• 評分和評分數\n\n座標將保留。此操作無法復原！`;

    if (!confirm(confirmMessage)) return;

    try {
      const result = await restaurantRatingService.clearRestaurantGoogleData(
        selectedRestaurant.id,
        clearCoordinates
      );

      if (result.success) {
        const clearedItems = clearCoordinates
          ? 'Place ID、評分和座標'
          : 'Place ID 和評分';

        alert(`✅ 清除成功！\n餐廳: ${selectedRestaurant.name}\n已清除: ${clearedItems}`);

        // 關閉對話框
        setShowManualMatch(false);
        setSelectedRestaurant(null);
        setSearchResults([]);

        // 重新載入餐廳清單
        await loadRestaurants();
      }
    } catch (error) {
      console.error('清除 Google 資料失敗:', error);
      alert(`清除失敗: ${error.message}`);
    }
  };

  // 清空 Place ID 快取
  const clearPlaceIdCache = () => {
    if (confirm('確定要清空 Place ID 快取嗎？\n這會讓下次更新重新搜尋所有餐廳。')) {
      restaurantRatingService.clearPlaceIdCache();
      alert('✅ Place ID 快取已清空');
    }
  };

  // 重置更新時間（測試用）
  const resetUpdateTimestamps = async () => {
    if (restaurants.length === 0) {
      alert('請先載入餐廳清單');
      return;
    }

    const count = prompt('要重置多少間餐廳的更新時間？', '10');
    if (!count) return;

    const numCount = parseInt(count);
    if (isNaN(numCount) || numCount <= 0) {
      alert('請輸入有效的數量');
      return;
    }

    if (!confirm(`確定要重置 ${numCount} 間餐廳的更新時間嗎？\n這是測試功能，會將 rating_updated_at 設為 null。`)) {
      return;
    }

    try {
      setIsLoading(true);
      const resetCount = await restaurantRatingService.resetUpdateTimestamps(restaurants, numCount);
      alert(`✅ 成功重置 ${resetCount} 間餐廳的更新時間`);
      await loadRestaurants();
    } catch (error) {
      console.error('重置更新時間失敗:', error);
      alert(`重置失敗: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 批次補充缺少的座標
  const fillMissingCoordinates = async () => {
    if (restaurants.length === 0) {
      alert('請先載入餐廳清單');
      return;
    }

    const missingCoords = restaurants.filter(r => !r.latitude || !r.longitude);

    if (missingCoords.length === 0) {
      alert('✅ 所有餐廳都有座標資訊');
      return;
    }

    if (!confirm(`找到 ${missingCoords.length} 間缺少座標的餐廳\n\n是否要自動從地址獲取座標？\n（需要 Google Maps API）`)) {
      return;
    }

    try {
      setIsLoading(true);
      const result = await restaurantRatingService.fillMissingCoordinates(missingCoords);
      alert(`✅ 完成座標補充\n成功: ${result.success} 間\n失敗: ${result.failed} 間`);
      await loadRestaurants();
    } catch (error) {
      console.error('補充座標失敗:', error);
      alert(`補充座標失敗: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 獲取快取統計
  const getCacheStats = () => {
    const cache = restaurantRatingService.loadPlaceIdCache();
    const unmatchedFromStorage = restaurantRatingService.loadUnmatchedFromStorage();
    return {
      cachedPlaces: Object.keys(cache).length,
      unmatchedStored: unmatchedFromStorage.length
    };
  };

  // 計算統計資訊
  const getRestaurantStats = () => {
    const total = restaurants.length;
    const withRating = restaurants.filter(r => r.rating).length;
    const withUserRatings = restaurants.filter(r => r.user_ratings_total > 0).length;
    const neverUpdated = restaurants.filter(r => !r.rating_updated_at).length;
    const recentlyUpdated = restaurants.filter(r => {
      if (!r.rating_updated_at) return false;
      const updatedAt = new Date(r.rating_updated_at);
      const daysDiff = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7;
    }).length;
    const updatedButNoRating = restaurants.filter(r => r.rating_updated_at && !r.rating).length;
    const missingCoords = restaurants.filter(r => !r.latitude || !r.longitude).length;

    const cacheStats = getCacheStats();

    return {
      total,
      withRating,
      withUserRatings,
      neverUpdated,
      recentlyUpdated,
      updatedButNoRating,
      missingCoords,
      cachedPlaces: cacheStats.cachedPlaces,
      unmatchedStored: cacheStats.unmatchedStored
    };
  };

  const stats = getRestaurantStats();

  useEffect(() => {
    loadRestaurants();
  }, []);

  return (
    <div className="restaurant-rating-updater">
      <div className="updater-header">
        <h2 className="updater-title">
          <IoRestaurantOutline className="title-icon" />
          餐廳評分更新工具
        </h2>
        <p className="updater-description">
          使用 Google Places API 批次更新餐廳評分資訊
        </p>
      </div>

      {/* 統計資訊 */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">總餐廳數</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.withRating}</div>
          <div className="stat-label">有評分</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.withUserRatings}</div>
          <div className="stat-label">有評分數</div>
        </div>
        <div className="stat-card" style={{ backgroundColor: '#fff3cd', borderColor: '#ffc107' }}>
          <div className="stat-value">{stats.neverUpdated}</div>
          <div className="stat-label">從未更新</div>
        </div>
        <div className="stat-card" style={{ backgroundColor: '#f8d7da', borderColor: '#dc3545' }}>
          <div className="stat-value">{stats.updatedButNoRating}</div>
          <div className="stat-label">已檢查但無評分</div>
        </div>
        <div className="stat-card" style={{ backgroundColor: '#e2e3e5', borderColor: '#6c757d' }}>
          <div className="stat-value">{stats.missingCoords}</div>
          <div className="stat-label" title="缺少經緯度座標，無法使用 Google Places API 更新">缺少座標</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.recentlyUpdated}</div>
          <div className="stat-label">近 7 天更新</div>
        </div>
        <div className="stat-card cache-stat">
          <div className="stat-value">{stats.cachedPlaces}</div>
          <div className="stat-label">已快取匹配</div>
        </div>
        <div className="stat-card unmatched-stat">
          <div className="stat-value">{stats.unmatchedStored}</div>
          <div className="stat-label">無法匹配</div>
        </div>
      </div>

      {/* 更新選項 */}
      <div className="update-options">
        <h3>更新設定</h3>
        <div className="options-grid">
          <div className="option-group">
            <label>批次大小</label>
            <select
              value={updateOptions.batchSize}
              onChange={(e) => setUpdateOptions(prev => ({
                ...prev,
                batchSize: e.target.value
              }))}
              disabled={isUpdating}
            >
              <option value="3">3 (安全)</option>
              <option value="5">5 (推薦)</option>
              <option value="10">10 (快速)</option>
            </select>
            <small>每次並行處理的餐廳數量</small>
          </div>

          <div className="option-group">
            <label>批次延遲 (毫秒)</label>
            <select
              value={updateOptions.delay}
              onChange={(e) => setUpdateOptions(prev => ({
                ...prev,
                delay: e.target.value
              }))}
              disabled={isUpdating}
            >
              <option value="500">500ms (快)</option>
              <option value="1000">1s (推薦)</option>
              <option value="2000">2s (安全)</option>
            </select>
          </div>

          <div className="option-group">
            <label>跳過最近更新 (天)</label>
            <select
              value={updateOptions.maxAge}
              onChange={(e) => setUpdateOptions(prev => ({
                ...prev,
                maxAge: e.target.value
              }))}
              disabled={isUpdating}
            >
              <option value="0">不跳過</option>
              <option value="1">跳過 1 天內</option>
              <option value="3">跳過 3 天內</option>
              <option value="7">跳過 7 天內 (推薦)</option>
              <option value="30">跳過 30 天內</option>
            </select>
            <small>跳過在指定天數內已更新的餐廳</small>
          </div>

          <div className="option-group">
            <label>更新數量限制</label>
            <select
              value={updateOptions.limitCount}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0;
                console.log('🔢 更新數量限制設定為:', value);
                setUpdateOptions(prev => ({
                  ...prev,
                  limitCount: value
                }));
              }}
              disabled={isUpdating}
            >
              <option value="0">全部餐廳</option>
              <option value="5">5 間</option>
              <option value="10">10 間</option>
              <option value="20">20 間</option>
              <option value="50">50 間</option>
              <option value="100">100 間</option>
            </select>
            <small>總共要更新的餐廳數量</small>
          </div>

          <div className="option-group">
            <label>優先模式</label>
            <select
              value={updateOptions.priorityMode}
              onChange={(e) => setUpdateOptions(prev => ({
                ...prev,
                priorityMode: e.target.value
              }))}
              disabled={isUpdating}
            >
              <option value="no_rating">無評分優先 (推薦)</option>
              <option value="never">從未更新優先</option>
              <option value="oldest">最久未更新優先</option>
              <option value="all">全部 (不排序)</option>
            </select>
            <small>建議使用「無評分優先」來更新缺少評分的餐廳</small>
          </div>

          <div className="option-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={updateOptions.forceUpdate}
                onChange={(e) => setUpdateOptions(prev => ({
                  ...prev,
                  forceUpdate: e.target.checked
                }))}
                disabled={isUpdating}
              />
              強制更新所有餐廳
            </label>
          </div>
        </div>
      </div>

      {/* 控制按鈕 */}
      <div className="update-controls">
        <button
          className="btn btn-primary"
          onClick={startRatingUpdate}
          disabled={isUpdating || isLoading || restaurants.length === 0}
        >
          <IoRefreshOutline className={`btn-icon ${isUpdating ? 'spinning' : ''}`} />
          {isUpdating ? '更新中...' : '開始更新評分'}
        </button>

        {isUpdating && (
          <button
            className="btn btn-secondary"
            onClick={stopUpdate}
          >
            <IoStopOutline className="btn-icon" />
            停止更新
          </button>
        )}

        <button
          className="btn btn-outline"
          onClick={loadRestaurants}
          disabled={isUpdating || isLoading}
        >
          <IoRefreshOutline className={`btn-icon ${isLoading ? 'spinning' : ''}`} />
          重新載入
        </button>

        <button
          className="btn btn-outline"
          onClick={() => openManualMatch()}
          disabled={isUpdating || isLoading || restaurants.length === 0 || isLoadingUnmatched}
          style={{ backgroundColor: '#6f42c1', borderColor: '#6f42c1', color: 'white' }}
        >
          <IoStarOutline className={`btn-icon ${isLoadingUnmatched ? 'spinning' : ''}`} />
          {isLoadingUnmatched ? '檢查中...' : '手動匹配餐廳'}
        </button>

        <button
          className="btn btn-outline"
          onClick={openSearchRestaurant}
          disabled={isUpdating || isLoading || restaurants.length === 0}
          style={{ backgroundColor: '#28a745', borderColor: '#28a745', color: 'white' }}
        >
          <IoRestaurantOutline className="btn-icon" />
          搜尋餐廳重新匹配
        </button>

        <button
          className="btn btn-outline"
          onClick={clearPlaceIdCache}
          disabled={isUpdating || isLoading}
          style={{ backgroundColor: '#ffc107', borderColor: '#ffc107', color: '#000' }}
        >
          <IoAlertCircleOutline className="btn-icon" />
          清空快取
        </button>

        <button
          className="btn btn-outline"
          onClick={resetUpdateTimestamps}
          disabled={isUpdating || isLoading || restaurants.length === 0}
          style={{ backgroundColor: '#e83e8c', borderColor: '#e83e8c', color: 'white' }}
          title="測試功能：重置指定數量餐廳的更新時間"
        >
          <IoTimeOutline className="btn-icon" />
          重置時間戳
        </button>

        {stats.missingCoords > 0 && (
          <button
            className="btn btn-outline"
            onClick={fillMissingCoordinates}
            disabled={isUpdating || isLoading || restaurants.length === 0}
            style={{ backgroundColor: '#17a2b8', borderColor: '#17a2b8', color: 'white' }}
            title={`補充 ${stats.missingCoords} 間餐廳的座標`}
          >
            <IoRefreshOutline className="btn-icon" />
            補充座標 ({stats.missingCoords})
          </button>
        )}
      </div>

      {/* 進度顯示 */}
      {progress && (
        <div className="progress-section">
          <div className="progress-header">
            <h3>更新進度</h3>
            <div className="progress-stats">
              {progress.processed} / {progress.total}
            </div>
          </div>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${(progress.processed / progress.total) * 100}%`
              }}
            ></div>
          </div>

          <div className="progress-details">
            <div className="detail-item success">
              <IoCheckmarkCircleOutline />
              已更新: {progress.updated}
            </div>
            <div className="detail-item warning">
              <IoTimeOutline />
              已跳過: {progress.skipped}
            </div>
            <div className="detail-item error">
              <IoAlertCircleOutline />
              失敗: {progress.failed}
            </div>
          </div>

          {progress.currentRestaurant && (
            <div className="current-restaurant">
              正在處理: {progress.currentRestaurant}
            </div>
          )}
        </div>
      )}

      {/* 結果顯示 */}
      {showResults && updateResults && (
        <div className="results-modal-overlay">
          <div className="results-modal">
            <div className="modal-header">
              <h3>更新完成</h3>
              <button
                className="close-btn"
                onClick={() => setShowResults(false)}
              >
                <IoCloseOutline />
              </button>
            </div>

            <div className="modal-content">
              <div className="results-summary">
                <div className="summary-item">
                  <span className="label">總處理數:</span>
                  <span className="value">{updateResults.processed}</span>
                </div>
                <div className="summary-item success">
                  <span className="label">成功更新:</span>
                  <span className="value">{updateResults.updated}</span>
                </div>
                <div className="summary-item warning">
                  <span className="label">跳過:</span>
                  <span className="value">{updateResults.skipped}</span>
                </div>
                <div className="summary-item error">
                  <span className="label">失敗:</span>
                  <span className="value">{updateResults.failed}</span>
                </div>
              </div>

              {updateResults.details.length > 0 && (
                <div className="results-details">
                  <h4>詳細結果</h4>
                  <div className="details-list">
                    {updateResults.details.slice(0, 50).map((detail, index) => (
                      <div key={index} className={`detail-row ${detail.status}`}>
                        <span className="restaurant-name">{detail.name}</span>
                        <span className="detail-status">
                          {detail.status === 'updated' && (
                            <>
                              <IoStarOutline />
                              {detail.oldRating || 'N/A'} → {detail.newRating}
                              {detail.userRatingsTotal && ` (${detail.userRatingsTotal} 評論)`}
                            </>
                          )}
                          {detail.status === 'skipped' && (
                            <>
                              <IoTimeOutline />
                              {detail.reason}
                            </>
                          )}
                          {detail.status === 'failed' && (
                            <>
                              <IoAlertCircleOutline />
                              {detail.error}
                            </>
                          )}
                        </span>
                      </div>
                    ))}
                    {updateResults.details.length > 50 && (
                      <div className="more-results">
                        還有 {updateResults.details.length - 50} 個結果...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-primary"
                onClick={() => setShowResults(false)}
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 手動匹配模態對話框 */}
      {showManualMatch && selectedRestaurant && (
        <div className="results-modal-overlay">
          <div className="results-modal" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>手動匹配餐廳</h3>
              <button
                className="close-btn"
                onClick={() => setShowManualMatch(false)}
              >
                <IoCloseOutline />
              </button>
            </div>

            <div className="modal-content">
              <div className="manual-match-info">
                <h4>目標餐廳資訊</h4>
                <div className="restaurant-info">
                  <p><strong>名稱:</strong> {selectedRestaurant.name}</p>
                  <p><strong>地址:</strong> {selectedRestaurant.address || '無地址'}</p>
                  <p><strong>目前評分:</strong> {selectedRestaurant.rating || 'N/A'}</p>
                  <p><strong>評分數:</strong> {selectedRestaurant.user_ratings_total || 0}</p>
                  {selectedRestaurant.latitude && selectedRestaurant.longitude && (
                    <p style={{ fontFamily: 'monospace', color: '#666' }}>
                      <strong>目前座標:</strong> ({selectedRestaurant.latitude.toFixed(6)}, {selectedRestaurant.longitude.toFixed(6)})
                    </p>
                  )}
                  {selectedRestaurant.google_place_id && (
                    <p style={{ fontSize: '12px', color: '#999' }}>
                      <strong>Place ID:</strong> {selectedRestaurant.google_place_id}
                    </p>
                  )}
                </div>

                {/* 清除 Google 資料按鈕 */}
                {(selectedRestaurant.google_place_id || selectedRestaurant.rating) && (
                  <div style={{
                    marginTop: '15px',
                    padding: '12px',
                    backgroundColor: '#fff3cd',
                    borderRadius: '6px',
                    border: '1px solid #ffc107'
                  }}>
                    <div style={{ fontSize: '13px', color: '#856404', marginBottom: '10px' }}>
                      ⚠️ 如果此餐廳的 Google 資料有誤，可以清除後重新搜尋匹配
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        className="btn btn-outline"
                        onClick={() => clearGoogleData(false)}
                        style={{
                          backgroundColor: '#ffc107',
                          borderColor: '#ffc107',
                          color: '#000',
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        🗑️ 清除 Place ID & 評分
                      </button>
                      <button
                        className="btn btn-outline"
                        onClick={() => clearGoogleData(true)}
                        style={{
                          backgroundColor: '#dc3545',
                          borderColor: '#dc3545',
                          color: 'white',
                          fontSize: '13px',
                          padding: '8px 12px'
                        }}
                      >
                        🗑️ 清除全部（含座標）
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="search-section">
                <h4>搜尋 Google Places</h4>
                <div className="search-input-group">
                  <input
                    type="text"
                    value={manualSearchQuery}
                    onChange={(e) => setManualSearchQuery(e.target.value)}
                    placeholder="輸入餐廳名稱或地址進行搜尋"
                    disabled={isSearching}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={manualSearchPlaces}
                    disabled={isSearching || !manualSearchQuery.trim()}
                  >
                    <IoRefreshOutline className={`btn-icon ${isSearching ? 'spinning' : ''}`} />
                    {isSearching ? '搜尋中...' : '搜尋'}
                  </button>
                </div>
              </div>

              {searchResults.length > 0 && (
                <div className="search-results">
                  <h4>搜尋結果 ({searchResults.length} 個)</h4>
                  <div className="results-list">
                    {searchResults.map((place, index) => (
                      <div key={index} className="place-result">
                        <div className="place-info">
                          <div className="place-name">{place.name}</div>
                          <div className="place-address">{place.address}</div>
                          <div className="place-stats">
                            <span className="rating">
                              <IoStarOutline />
                              {place.rating || 'N/A'}
                            </span>
                            <span className="reviews">
                              ({place.user_ratings_total || 0} 評論)
                            </span>
                            {place.distance && (
                              <span className="distance">
                                距離: {place.distance.toFixed(2)} km
                              </span>
                            )}
                            <span className="similarity">
                              相似度: {(place.nameSimilarity * 100).toFixed(1)}%
                            </span>
                          </div>
                          {place.latitude && place.longitude && (
                            <div className="place-coordinates" style={{
                              marginTop: '8px',
                              fontSize: '12px',
                              color: '#666',
                              fontFamily: 'monospace'
                            }}>
                              📍 座標: ({place.latitude.toFixed(6)}, {place.longitude.toFixed(6)})
                            </div>
                          )}
                        </div>
                        <button
                          className="btn btn-success"
                          onClick={() => selectAndUpdateRestaurant(place)}
                        >
                          <IoCheckmarkCircleOutline />
                          選擇此餐廳
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowManualMatch(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 搜尋餐廳重新匹配模態對話框 */}
      {showSearchRestaurant && (
        <div className="results-modal-overlay">
          <div className="results-modal" style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h3>搜尋餐廳重新匹配</h3>
              <button
                className="close-btn"
                onClick={() => setShowSearchRestaurant(false)}
              >
                <IoCloseOutline />
              </button>
            </div>

            <div className="modal-content">
              <div className="search-section" style={{ marginBottom: '20px' }}>
                <input
                  type="text"
                  value={searchRestaurantQuery}
                  onChange={(e) => handleSearchRestaurant(e.target.value)}
                  placeholder="輸入餐廳名稱或地址搜尋..."
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    border: '2px solid #ddd',
                    borderRadius: '6px'
                  }}
                  autoFocus
                />
              </div>

              {searchRestaurantQuery && filteredRestaurants.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                  找不到符合「{searchRestaurantQuery}」的餐廳
                </div>
              )}

              {filteredRestaurants.length > 0 && (
                <div className="unmatched-restaurants-list">
                  {filteredRestaurants.map((restaurant) => (
                    <div key={restaurant.id} className="unmatched-restaurant-item">
                      <div className="restaurant-basic-info">
                        <div className="restaurant-name">{restaurant.name}</div>
                        <div className="restaurant-address">
                          📍 {restaurant.address || '無地址資訊'}
                        </div>
                        <div className="restaurant-current-rating">
                          ⭐ 目前評分: {restaurant.rating || 'N/A'}
                          ({restaurant.user_ratings_total || 0} 評論)
                        </div>
                        {restaurant.latitude && restaurant.longitude && (
                          <div style={{
                            fontSize: '12px',
                            color: '#666',
                            fontFamily: 'monospace',
                            marginTop: '4px'
                          }}>
                            📍 座標: ({restaurant.latitude.toFixed(6)}, {restaurant.longitude.toFixed(6)})
                          </div>
                        )}
                        {restaurant.google_place_id && (
                          <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                            Place ID: {restaurant.google_place_id}
                          </div>
                        )}
                      </div>
                      <div className="restaurant-actions">
                        <button
                          className="btn btn-primary"
                          onClick={() => selectRestaurantForRematch(restaurant)}
                        >
                          <IoStarOutline />
                          重新匹配
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!searchRestaurantQuery && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                  請輸入餐廳名稱或地址開始搜尋
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowSearchRestaurant(false)}
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 餐廳選擇器模態對話框 */}
      {showRestaurantSelector && (
        <div className="results-modal-overlay">
          <div className="results-modal" style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h3>選擇要手動匹配的餐廳</h3>
              <button
                className="close-btn"
                onClick={() => setShowRestaurantSelector(false)}
              >
                <IoCloseOutline />
              </button>
            </div>

            <div className="modal-content">
              <div className="restaurant-selector-info">
                <p>
                  <strong>找到 {unmatchedRestaurants.length} 間無法自動匹配的餐廳</strong>
                </p>
                <p>請選擇要進行手動匹配的餐廳：</p>
              </div>

              <div className="unmatched-restaurants-list">
                {unmatchedRestaurants.map((restaurant, index) => (
                  <div key={restaurant.id || index} className="unmatched-restaurant-item">
                    <div className="restaurant-basic-info">
                      <div className="restaurant-name">{restaurant.name}</div>
                      <div className="restaurant-address">
                        📍 {restaurant.address || '無地址資訊'}
                      </div>
                      <div className="restaurant-current-rating">
                        ⭐ 目前評分: {restaurant.rating || 'N/A'}
                        ({restaurant.user_ratings_total || 0} 評論)
                      </div>
                      <div className="unmatch-reason">
                        ❌ {restaurant.reason}
                      </div>
                    </div>
                    <div className="restaurant-actions">
                      <button
                        className="btn btn-primary"
                        onClick={() => openManualMatch(restaurant)}
                      >
                        <IoStarOutline />
                        手動匹配
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => removeUnmatchedRestaurant(restaurant.id)}
                        title="已解決，從列表中移除"
                      >
                        <IoCheckmarkCircleOutline />
                        移除
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {unmatchedRestaurants.length === 0 && (
                <div className="no-unmatched-restaurants">
                  <p>🎉 目前沒有無法匹配的餐廳</p>
                  <p>您可以直接執行批次更新，或手動選擇特定餐廳進行匹配。</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => loadUnmatchedRestaurants()}
                disabled={isLoadingUnmatched}
              >
                <IoRefreshOutline className={`btn-icon ${isLoadingUnmatched ? 'spinning' : ''}`} />
                重新檢查
              </button>
              {unmatchedRestaurants.length > 0 && (
                <button
                  className="btn btn-outline"
                  onClick={clearAllUnmatched}
                  style={{ backgroundColor: '#dc3545', borderColor: '#dc3545', color: 'white' }}
                >
                  <IoAlertCircleOutline />
                  清空全部
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={() => setShowRestaurantSelector(false)}
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}