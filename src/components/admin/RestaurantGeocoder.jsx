import React, { useState, useEffect } from 'react';
import { restaurantService } from '../../services/restaurantService';
import googleMapsLoader from '../../utils/googleMapsLoader';
import './RestaurantGeocoder.css';

export default function RestaurantGeocoder() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({ total: 0, missing: 0, updated: 0 });
  const [mapsLoaded, setMapsLoaded] = useState(false);

  useEffect(() => {
    // 載入 Google Maps API
    googleMapsLoader.load()
      .then(() => {
        console.log('✅ Google Maps API 已載入');
        setMapsLoaded(true);
        loadRestaurants();
      })
      .catch(error => {
        console.error('❌ Google Maps API 載入失敗:', error);
      });
  }, []);

  const loadRestaurants = async () => {
    setLoading(true);
    try {
      const data = await restaurantService.getRestaurants();
      const missingCoords = data.filter(r => !r.latitude || !r.longitude);

      setRestaurants(missingCoords);
      setStats({
        total: data.length,
        missing: missingCoords.length,
        updated: 0
      });
    } catch (error) {
      console.error('載入餐廳失敗:', error);
    }
    setLoading(false);
  };

  const geocodeAddress = async (address) => {
    if (!address) return null;

    try {
      const geocoder = new window.google.maps.Geocoder();

      return new Promise((resolve, reject) => {
        geocoder.geocode({ address: address }, (results, status) => {
          if (status === 'OK' && results[0]) {
            const location = results[0].geometry.location;
            resolve({
              latitude: location.lat(),
              longitude: location.lng()
            });
          } else {
            reject(new Error(`Geocoding failed: ${status}`));
          }
        });
      });
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  const updateRestaurantCoordinates = async (restaurant) => {
    try {
      const coords = await geocodeAddress(restaurant.address);

      if (coords) {
        // 更新資料庫
        const { supabase } = await import('../../services/supabaseService');
        const { error } = await supabase
          .from('restaurants')
          .update({
            latitude: coords.latitude,
            longitude: coords.longitude,
            updated_at: new Date().toISOString()
          })
          .eq('id', restaurant.id);

        if (error) throw error;

        console.log(`✅ 更新 ${restaurant.name}:`, coords);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ 更新 ${restaurant.name} 失敗:`, error);
      return false;
    }
  };

  const batchUpdateCoordinates = async () => {
    if (!window.confirm(`確定要更新 ${restaurants.length} 間餐廳的經緯度嗎？`)) {
      return;
    }

    setProcessing(true);
    let updated = 0;

    for (const restaurant of restaurants) {
      const success = await updateRestaurantCoordinates(restaurant);
      if (success) updated++;

      // 更新進度
      setStats(prev => ({ ...prev, updated }));

      // 避免超過 API 配額，每次請求間隔 200ms
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    setProcessing(false);
    alert(`完成！成功更新 ${updated} / ${restaurants.length} 間餐廳`);
    loadRestaurants();
  };

  const updateSingleRestaurant = async (restaurant) => {
    setProcessing(true);
    const success = await updateRestaurantCoordinates(restaurant);
    setProcessing(false);

    if (success) {
      alert(`✅ ${restaurant.name} 更新成功！`);
      loadRestaurants();
    } else {
      alert(`❌ ${restaurant.name} 更新失敗，請檢查地址是否正確`);
    }
  };

  if (!mapsLoaded) {
    return <div className="geocoder-loading">載入 Google Maps API 中...</div>;
  }

  if (loading) {
    return <div className="geocoder-loading">載入餐廳資料中...</div>;
  }

  return (
    <div className="restaurant-geocoder">
      <h2>餐廳經緯度更新工具</h2>

      <div className="geocoder-stats">
        <div className="stat-item">
          <span className="stat-label">總餐廳數：</span>
          <span className="stat-value">{stats.total}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">缺少經緯度：</span>
          <span className="stat-value warn">{stats.missing}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">已更新：</span>
          <span className="stat-value success">{stats.updated}</span>
        </div>
      </div>

      {restaurants.length === 0 ? (
        <div className="geocoder-empty">
          ✅ 所有餐廳都有經緯度資料！
        </div>
      ) : (
        <>
          <div className="geocoder-actions">
            <button
              className="batch-update-btn"
              onClick={batchUpdateCoordinates}
              disabled={processing}
            >
              {processing ? '處理中...' : `批次更新全部 (${restaurants.length})`}
            </button>
            <button
              className="refresh-btn"
              onClick={loadRestaurants}
              disabled={processing}
            >
              重新載入
            </button>
          </div>

          <div className="restaurants-list">
            <table>
              <thead>
                <tr>
                  <th>餐廳名稱</th>
                  <th>地址</th>
                  <th>經緯度</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {restaurants.map(restaurant => (
                  <tr key={restaurant.id}>
                    <td>{restaurant.name}</td>
                    <td>{restaurant.address || '無地址'}</td>
                    <td className="coords">
                      {restaurant.latitude && restaurant.longitude
                        ? `${restaurant.latitude.toFixed(6)}, ${restaurant.longitude.toFixed(6)}`
                        : '缺少'}
                    </td>
                    <td>
                      <button
                        className="update-single-btn"
                        onClick={() => updateSingleRestaurant(restaurant)}
                        disabled={processing || !restaurant.address}
                      >
                        更新
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {processing && (
        <div className="processing-overlay">
          <div className="processing-message">
            正在處理... ({stats.updated} / {restaurants.length})
          </div>
        </div>
      )}
    </div>
  );
}
