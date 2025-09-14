import React, { useState, useCallback, useEffect } from 'react';
import MapView from '../components/map/MapView';
import MapSearch from '../components/map/MapSearch';
import LocationButton from '../components/map/LocationButton';
import FavoriteLists from '../components/map/FavoriteLists';
import { authService } from '../services/authService';
import { IoMenuOutline, IoCloseOutline } from 'react-icons/io5';
import './MapPage.css';

export default function MapPage() {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [searchLocation, setSearchLocation] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [favoriteLists, setFavoriteLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [showFavoriteLists, setShowFavoriteLists] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('success'); // success, error
  const [hasRequestedLocation, setHasRequestedLocation] = useState(false);
  const [user, setUser] = useState(null);

  // 載入用戶認證狀態
  useEffect(() => {
    const loadUser = async () => {
      try {
        const result = await authService.getCurrentUser();
        if (result.success && result.user) {
          setUser(result.user);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('載入用戶資料失敗:', error);
        setUser(null);
      }
    };
    
    loadUser();
    
    // 監聽認證狀態變化
    const subscription = authService.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setSelectedList(null);
        setShowFavoriteLists(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 頁面載入時自動請求定位
  useEffect(() => {
    if (!hasRequestedLocation) {
      setHasRequestedLocation(true);
      requestCurrentLocation();
    }
  }, []);

  // 請求當前位置
  const requestCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            name: '我的位置'
          };
          handleLocationFound(location);
        },
        (error) => {
          console.warn('自動定位失敗:', error);
          // 不顯示錯誤訊息，讓用戶手動點擊定位按鈕
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5分鐘內的快取位置可接受
        }
      );
    }
  };

  // 處理搜尋
  const handleSearch = useCallback((searchTerm) => {
    // 這裡可以實現更複雜的搜尋邏輯
    console.log('Searching for:', searchTerm);
  }, []);

  // 處理位置選擇
  const handleLocationSelect = useCallback((location) => {
    setSearchLocation(location);
    showNotificationMessage(`已移動到 ${location.name || '選定位置'}`, 'success');
  }, []);

  // 處理定位成功
  const handleLocationFound = useCallback((location) => {
    setCurrentLocation(location);
    setSearchLocation(location);
    showNotificationMessage('定位成功！', 'success');
  }, []);

  // 處理定位錯誤
  const handleLocationError = useCallback((error) => {
    showNotificationMessage(error, 'error');
  }, []);

  // 處理地點選擇
  const handlePlaceSelect = useCallback((place) => {
    setSelectedPlace(place);
  }, []);

  // 處理收藏切換
  const handleFavoriteToggle = useCallback((place, isFavorite) => {
    // 這個邏輯現在由 FavoriteLists 組件內部的 MapView InfoWindow 處理
    // 這裡只需要顯示通知
    if (isFavorite) {
      showNotificationMessage(`已加入收藏清單`, 'success');
    } else {
      showNotificationMessage(`已從收藏清單移除`, 'success');
    }
  }, []);

  // 處理清單選擇
  const handleListSelect = useCallback((list) => {
    setSelectedList(list);
  }, []);

  // 處理地點加入清單
  const handlePlaceAdd = useCallback(() => {
    showNotificationMessage('地點已加入清單！', 'success');
  }, []);

  // 處理餐廳選擇
  const handleRestaurantSelect = useCallback((restaurant) => {
    console.log('選擇餐廳:', restaurant);
    showNotificationMessage(`已選擇餐廳：${restaurant.name}`, 'success');
  }, []);

  // 處理清單更新
  const handleListUpdate = useCallback((updatedList) => {
    if (selectedList && selectedList.id === updatedList.id) {
      setSelectedList(updatedList);
    }
  }, [selectedList]);

  // 顯示通知消息
  const showNotificationMessage = (message, type = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
    
    // 3秒後自動隱藏
    setTimeout(() => {
      setShowNotification(false);
    }, 3000);
  };

  // 取得收藏的地點ID列表（用於地圖標記）
  const getFavoriteIds = () => {
    if (!selectedList) return [];
    const places = selectedList.places || selectedList.favorite_list_places || [];
    return places.map(place => place.place_id);
  };

  return (
    <div className="map-page">
      {/* 通知消息 */}
      {showNotification && (
        <div className={`notification ${notificationType} ${showNotification ? 'show' : ''}`}>
          <span>{notificationMessage}</span>
          <button 
            className="notification-close"
            onClick={() => setShowNotification(false)}
          >
            <IoCloseOutline />
          </button>
        </div>
      )}

      {/* 頂部控制欄 */}
      <div className="map-controls">
        {/* 搜尋欄 */}
        <div className="search-container">
          <MapSearch
            onSearch={handleSearch}
            onLocationSelect={handleLocationSelect}
            onRestaurantSelect={handleRestaurantSelect}
          />
        </div>

        {/* 右側控制按鈕 */}
        <div className="control-buttons">
          <LocationButton
            onLocationFound={handleLocationFound}
            onLocationError={handleLocationError}
          />
          
          <button
            className={`menu-button ${showFavoriteLists ? 'active' : ''}`}
            onClick={() => setShowFavoriteLists(!showFavoriteLists)}
            title="我的清單"
          >
            {showFavoriteLists ? <IoCloseOutline /> : <IoMenuOutline />}
          </button>
        </div>
      </div>

      {/* 地圖主體 */}
      <div className="map-main">
        <MapView
          center={currentLocation}
          searchLocation={searchLocation}
          onPlaceSelect={handlePlaceSelect}
          onFavoriteToggle={handleFavoriteToggle}
          favorites={selectedList ? (selectedList.places || selectedList.favorite_list_places || []) : []}
        />
      </div>

      {/* 側邊欄 - 收藏清單 */}
      <div className={`map-sidebar ${showFavoriteLists ? 'open' : ''}`}>
        <FavoriteLists
          user={user}
          onListSelect={handleListSelect}
          onPlaceAdd={handlePlaceAdd}
          onListUpdate={handleListUpdate}
          selectedPlace={selectedPlace}
          isOpen={showFavoriteLists}
          onToggle={() => setShowFavoriteLists(!showFavoriteLists)}
        />
      </div>

      {/* 底部資訊欄 */}
      {selectedPlace && (
        <div className="place-info-bar">
          <div className="place-info-content">
            <h3 className="place-info-name">{selectedPlace.name}</h3>
            <p className="place-info-address">{selectedPlace.formatted_address}</p>
            {selectedPlace.rating && (
              <div className="place-info-rating">
                <span className="rating-stars">
                  {'★'.repeat(Math.floor(selectedPlace.rating))}
                  {'☆'.repeat(5 - Math.floor(selectedPlace.rating))}
                </span>
                <span className="rating-text">{selectedPlace.rating}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
