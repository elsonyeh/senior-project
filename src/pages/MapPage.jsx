import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import MapView from '../components/map/MapView';
import MapSearch from '../components/map/MapSearch';
import LocationButton from '../components/map/LocationButton';
import FavoriteLists from '../components/map/FavoriteLists';
import RestaurantDetailModal from '../components/map/RestaurantDetailModal';
import { authService } from '../services/authService';
import { useNavContext } from '../App';
import { IoMenuOutline, IoCloseOutline } from 'react-icons/io5';
import './MapPage.css';

export default function MapPage() {
  const location = useLocation();
  const [currentLocation, setCurrentLocation] = useState(null);
  const [searchLocation, setSearchLocation] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [favoriteLists, setFavoriteLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [showFavoriteLists, setShowFavoriteLists] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('success'); // success, error
  const [hasRequestedLocation, setHasRequestedLocation] = useState(false);
  const [user, setUser] = useState(null);
  const [refreshListsTrigger, setRefreshListsTrigger] = useState(0); // 用於觸發清單重新載入
  const { isNavCollapsed, setIsNavCollapsed } = useNavContext();
  const mapViewRef = useRef(null);
  const interactionTimeoutRef = useRef(null);
  const lastInteractionRef = useRef(Date.now());
  const mapPositionSaveTimeoutRef = useRef(null);

  // localStorage 鍵名
  const MAP_POSITION_KEY = 'swiftTaste_mapPosition';
  const HAS_AUTO_LOCATED_KEY = 'swiftTaste_hasAutoLocated';

  // 從 localStorage 讀取保存的地圖位置
  const getSavedMapPosition = () => {
    try {
      const saved = localStorage.getItem(MAP_POSITION_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('讀取地圖位置失敗:', error);
      return null;
    }
  };

  // 保存地圖位置到 localStorage（使用防抖）
  const saveMapPosition = useCallback((position) => {
    // 清除之前的定時器
    if (mapPositionSaveTimeoutRef.current) {
      clearTimeout(mapPositionSaveTimeoutRef.current);
    }

    // 設置新的定時器，500ms 後保存（防抖）
    mapPositionSaveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(MAP_POSITION_KEY, JSON.stringify({
          lat: position.lat,
          lng: position.lng,
          zoom: position.zoom,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error('保存地圖位置失敗:', error);
      }
    }, 500);
  }, []);

  // 檢查是否已經自動定位過
  const hasAutoLocated = () => {
    return localStorage.getItem(HAS_AUTO_LOCATED_KEY) === 'true';
  };

  // 標記已自動定位
  const markAutoLocated = () => {
    localStorage.setItem(HAS_AUTO_LOCATED_KEY, 'true');
  };

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
        setFavoriteLists([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 處理從其他頁面導航過來的餐廳資料
  useEffect(() => {
    if (location.state?.selectedPlace) {
      setSelectedPlace(location.state.selectedPlace);
      // 清除 location state 以避免重複觸發
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // 地圖互動檢測和導航欄自動收合
  useEffect(() => {
    // 處理點擊導航欄以外的區域時收合導航欄
    const handleClickOutsideNav = (event) => {
      // 如果導航欄已收合，不做任何操作
      if (isNavCollapsed) return;

      // 檢查點擊的元素是否在導航欄內
      const navElement = document.querySelector('.floating-nav-container');
      if (navElement && !navElement.contains(event.target)) {
        setIsNavCollapsed(true);
      }
    };

    const handleMapInteraction = () => {
      lastInteractionRef.current = Date.now();

      // 如果導航欄已收合，不做任何操作
      if (isNavCollapsed) return;

      // 清除之前的定時器
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }

      // 設置新的定時器，1.5秒後收合導航欄
      interactionTimeoutRef.current = setTimeout(() => {
        const timeSinceLastInteraction = Date.now() - lastInteractionRef.current;
        if (timeSinceLastInteraction >= 1400) { // 略小於延遲時間以確保準確性
          setIsNavCollapsed(true);
        }
      }, 1500);
    };

    // 添加全局點擊事件監聽器
    document.addEventListener('click', handleClickOutsideNav);
    document.addEventListener('touchstart', handleClickOutsideNav);

    const mapContainer = mapViewRef.current;
    if (mapContainer) {
      // 監聽各種地圖互動事件
      const events = [
        'touchstart', 'touchmove', 'touchend',
        'mousedown', 'mousemove', 'mouseup',
        'wheel', 'scroll'
      ];

      events.forEach(event => {
        mapContainer.addEventListener(event, handleMapInteraction, { passive: true });
      });

      return () => {
        // 移除全局事件監聽器
        document.removeEventListener('click', handleClickOutsideNav);
        document.removeEventListener('touchstart', handleClickOutsideNav);

        events.forEach(event => {
          mapContainer.removeEventListener(event, handleMapInteraction);
        });
        if (interactionTimeoutRef.current) {
          clearTimeout(interactionTimeoutRef.current);
        }
      };
    }

    // 如果沒有地圖容器，仍然需要清理全局事件監聽器
    return () => {
      document.removeEventListener('click', handleClickOutsideNav);
      document.removeEventListener('touchstart', handleClickOutsideNav);
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, [isNavCollapsed]);

  // 處理導航欄展開
  const handleNavExpand = useCallback(() => {
    setIsNavCollapsed(false);
    lastInteractionRef.current = Date.now();

    // 清除自動收合定時器
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
  }, []);

  // 顯示通知消息
  const showNotificationMessage = useCallback((message, type = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);

    // 2秒後自動隱藏
    setTimeout(() => {
      setShowNotification(false);
    }, 2000);
  }, []);

  // 設置全域函數供InfoWindow使用
  useEffect(() => {
    window.addPlaceToList = async (listId, place) => {
      try {
        const { userDataService } = await import('../services/userDataService');

        const placeData = {
          place_id: place.place_id,
          name: place.name,
          address: place.formatted_address || place.address || '',
          rating: place.rating || null,
          latitude: place.latitude || place.geometry?.location?.lat?.() || null,
          longitude: place.longitude || place.geometry?.location?.lng?.() || null,
          category: place.category || '',
          photo_url: place.photos?.[0]?.getUrl({ maxWidth: 200 }) || place.primaryImage?.image_url || null,
          notes: ''
        };

        const result = await userDataService.addPlaceToList(listId, placeData);

        if (result.success) {
          showNotificationMessage('已加入收藏清單！', 'success');
          // 重新載入清單數據（包含圖片）
          const favListsResult = await userDataService.getFavoriteLists(user.id, user.email, { includeImages: true });
          if (favListsResult.success) {
            // 保持與初始載入相同的資料格式轉換
            setFavoriteLists(favListsResult.lists.map(list => ({
              ...list,
              places: (list.favorite_list_places || []).map(place => ({
                ...place,
                place_id: place.restaurant_id || place.place_id,
                restaurant_id: place.restaurant_id || place.place_id,
                // 從關聯的餐廳資料取得詳細資訊
                name: place.restaurants?.name || place.name,
                address: place.restaurants?.address || place.address,
                rating: place.restaurants?.rating || place.rating,
                latitude: place.restaurants?.latitude || place.latitude,
                longitude: place.restaurants?.longitude || place.longitude,
                category: place.restaurants?.category || place.category
              }))
            })));
            // 觸發 FavoriteLists 組件重新載入
            setRefreshListsTrigger(prev => prev + 1);
          }
        } else {
          showNotificationMessage(result.error || '加入收藏失敗', 'error');
        }
      } catch (error) {
        console.error('加入收藏清單錯誤:', error);
        showNotificationMessage('加入收藏失敗，請重試', 'error');
      }
    };

    return () => {
      delete window.addPlaceToList;
    };
  }, [user, showNotificationMessage]);

  // 載入用戶的收藏清單
  useEffect(() => {
    const loadFavoriteLists = async () => {
      if (!user) {
        setFavoriteLists([]);
        return;
      }

      try {
        const { userDataService } = await import('../services/userDataService');
        const result = await userDataService.getFavoriteLists(user.id, user.email, { includeImages: true });

        if (result.success) {

          // 如果餐廳資料沒有經緯度，從資料庫重新載入完整餐廳資料
          const restaurantIds = [];
          result.lists.forEach(list => {
            (list.favorite_list_places || []).forEach(place => {
              if (place.restaurant_id && (!place.restaurants?.latitude || !place.restaurants?.longitude)) {
                restaurantIds.push(place.restaurant_id);
              }
            });
          });

          // 載入完整餐廳資料
          let fullRestaurantsMap = {};
          if (restaurantIds.length > 0) {
            const { restaurantService } = await import('../services/restaurantService');
            const allRestaurants = await restaurantService.getRestaurants();
            fullRestaurantsMap = Object.fromEntries(
              allRestaurants.map(r => [r.id, r])
            );

          }

          setFavoriteLists(result.lists.map(list => ({
            ...list,
            places: (list.favorite_list_places || []).map(place => {
              // 優先使用完整餐廳資料
              const fullRestaurant = fullRestaurantsMap[place.restaurant_id];
              const restaurantData = fullRestaurant || place.restaurants;

              return {
                ...place,
                place_id: place.restaurant_id || place.place_id,
                restaurant_id: place.restaurant_id || place.place_id,
                // 從完整餐廳資料或關聯資料取得詳細資訊
                name: restaurantData?.name || place.name,
                address: restaurantData?.address || place.address,
                rating: restaurantData?.rating || place.rating,
                latitude: restaurantData?.latitude || place.latitude,
                longitude: restaurantData?.longitude || place.longitude,
                category: restaurantData?.category || place.category
              };
            })
          })));
        } else {
          console.error('載入收藏清單失敗:', result.error);
          setFavoriteLists([]);
        }
      } catch (error) {
        console.error('載入收藏清單錯誤:', error);
        setFavoriteLists([]);
      }
    };

    loadFavoriteLists();
  }, [user]);

  // 頁面載入時自動請求定位或恢復保存的位置
  useEffect(() => {
    if (!hasRequestedLocation) {
      setHasRequestedLocation(true);

      // 檢查是否有保存的地圖位置
      const savedPosition = getSavedMapPosition();

      if (savedPosition) {
        // 如果有保存的位置，恢復它
        console.log('📍 恢復保存的地圖位置:', savedPosition);
        const restoredLocation = {
          lat: savedPosition.lat,
          lng: savedPosition.lng,
          name: '上次位置'
        };
        setSearchLocation(restoredLocation);
        setCurrentLocation(restoredLocation);
      } else if (!hasAutoLocated()) {
        // 只有在沒有保存位置且從未自動定位過時，才自動檢測定位
        console.log('📍 首次訪問，自動請求定位');
        requestCurrentLocation();
      } else {
        // 已經自動定位過但沒有保存位置（可能用戶清除了緩存）
        // 設置一個默認位置（台北101）
        console.log('📍 使用地圖默認位置');
        const defaultLocation = {
          lat: 25.0330,
          lng: 121.5654,
          name: '台北101'
        };
        setSearchLocation(defaultLocation);
        setCurrentLocation(defaultLocation);
      }
    }
  }, []);

  // 請求當前位置（帶降級策略）
  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      return;
    }

    // 首先嘗試高精度定位
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
        console.warn('高精度定位失敗:', error);

        // 如果高精度定位超時或失敗，自動降級到低精度模式
        if (error.code === 3 || error.code === 2) { // TIMEOUT or POSITION_UNAVAILABLE
          console.log('嘗試低精度定位...');

          navigator.geolocation.getCurrentPosition(
            (position) => {
              const location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                name: '我的位置'
              };
              handleLocationFound(location);
            },
            (fallbackError) => {
              console.warn('低精度定位也失敗:', fallbackError);
              // 靜默失敗，讓用戶手動點擊定位按鈕
            },
            {
              enableHighAccuracy: false, // 使用低精度模式
              timeout: 10000, // 低精度模式超時時間較短
              maximumAge: 60000 // 允許使用1分鐘內的緩存位置
            }
          );
        }
        // 如果是權限被拒絕，不嘗試降級，讓用戶手動點擊定位按鈕
      },
      {
        enableHighAccuracy: true, // 首先嘗試高精度定位
        timeout: 25000, // 增加超時時間到25秒
        maximumAge: 0 // 不使用緩存，確保獲得最新位置
      }
    );
  };

  // 處理搜尋
  const handleSearch = useCallback((searchTerm) => {
    // 這裡可以實現更複雜的搜尋邏輯
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

    // 標記已自動定位（僅在首次自動定位時標記）
    markAutoLocated();
  }, []);

  // 處理重新定位
  const handleRelocate = useCallback((location) => {
    setCurrentLocation(location);
    setSearchLocation(location);
    showNotificationMessage('重新定位成功！', 'success');
  }, []);

  // 處理定位錯誤
  const handleLocationError = useCallback((error) => {
    showNotificationMessage(error, 'error');
  }, []);

  // 處理地點選擇 - 只設置 selectedPlace,不自動打開 Modal
  const handlePlaceSelect = useCallback((place) => {
    setSelectedPlace(place);
    // 不再自動設置 selectedRestaurant,改由評論按鈕觸發
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
    // 如果點擊的是當前選中的清單，取消選擇（只顯示「我的最愛」）
    if (selectedList && selectedList.id === list.id && list.name !== '我的最愛') {
      // 找到「我的最愛」清單並切換回去
      const myFavoriteList = favoriteLists.find(l => l.name === '我的最愛');
      setSelectedList(myFavoriteList || null);
    } else {
      setSelectedList(list);
    }
  }, [selectedList, favoriteLists]);

  // 處理地點加入清單
  const handlePlaceAdd = useCallback(() => {
    showNotificationMessage('地點已加入清單！', 'success');
  }, []);

  // 處理餐廳選擇
  const handleRestaurantSelect = useCallback((restaurant) => {
    showNotificationMessage(`已選擇餐廳：${restaurant.name}`, 'success');
    // 將選中的餐廳傳遞給 MapView 以打開其 InfoWindow
    setSelectedPlace({
      ...restaurant,
      place_id: restaurant.id,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude
    });
  }, []);

  // 處理地圖位置變化
  const handleMapMove = useCallback((center, zoom) => {
    // 保存地圖位置到 localStorage
    saveMapPosition({
      lat: center.lat,
      lng: center.lng,
      zoom: zoom
    });
  }, [saveMapPosition]);

  // 處理清單更新
  const handleListUpdate = useCallback((updatedList) => {
    if (selectedList && selectedList.id === updatedList.id) {
      setSelectedList(updatedList);
    }
  }, [selectedList]);

  // 處理清單變更（新增或刪除清單）
  const handleListsChange = useCallback(() => {
    // 觸發 MapPage 重新載入清單
    setRefreshListsTrigger(prev => prev + 1);
  }, []);

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
        <div className={`map-notification map-${notificationType} ${showNotification ? 'map-show' : ''}`}>
          <span>{notificationMessage}</span>
          <button 
            className="map-notification-close"
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
            onRelocate={handleRelocate}
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
      <div className="map-main" ref={mapViewRef}>
        <MapView
          center={currentLocation}
          searchLocation={searchLocation}
          onPlaceSelect={handlePlaceSelect}
          onFavoriteToggle={handleFavoriteToggle}
          favorites={selectedList ? (selectedList.places || selectedList.favorite_list_places || []) : []}
          user={user}
          favoriteLists={favoriteLists}
          selectedList={selectedList}
          selectedRestaurant={selectedPlace}
          onRestaurantClick={setSelectedRestaurant}
          onMapMove={handleMapMove}
        />
      </div>

      {/* 側邊欄 - 收藏清單 */}
      <div className={`map-sidebar ${showFavoriteLists ? 'open' : ''}`}>
        <FavoriteLists
          user={user}
          onListSelect={handleListSelect}
          onPlaceAdd={handlePlaceAdd}
          onListUpdate={handleListUpdate}
          onListsChange={handleListsChange}
          selectedPlace={selectedPlace}
          isOpen={showFavoriteLists}
          onToggle={() => setShowFavoriteLists(!showFavoriteLists)}
          refreshTrigger={refreshListsTrigger}
        />
      </div>

      {/* 餐廳詳情模態框 */}
      {selectedRestaurant && (
        <RestaurantDetailModal
          restaurant={selectedRestaurant}
          user={user}
          onClose={() => setSelectedRestaurant(null)}
        />
      )}

    </div>
  );
}
