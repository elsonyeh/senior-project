import React, { useEffect, useRef, useState, useCallback } from 'react';
import { IoHeartOutline, IoHeart, IoInformationCircleOutline, IoNavigateOutline } from 'react-icons/io5';
import googleMapsLoader from '../../utils/googleMapsLoader';
import { restaurantService } from '../../services/restaurantService';
import './MapView.css';

// 台北101的座標作為預設中心點
const DEFAULT_CENTER = { lat: 25.0330, lng: 121.5654 };
const DEFAULT_ZOOM = 15;

export default function MapView({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  searchLocation = null,
  onPlaceSelect,
  onFavoriteToggle,
  favorites = [],
  user = null,
  favoriteLists = []
}) {
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantMarkers, setRestaurantMarkers] = useState([]);

  // 載入餐廳資料庫
  const loadRestaurants = useCallback(async () => {
    try {
      const restaurantData = await restaurantService.getRestaurants();
      setRestaurants(restaurantData);
      console.log(`載入了 ${restaurantData.length} 間餐廳`);
    } catch (error) {
      console.error('載入餐廳資料失敗:', error);
    }
  }, []);

  // 初始化Google地圖
  const initializeMap = useCallback(() => {
    if (!window.google || !window.google.maps || !mapRef.current) {
      console.error('Google Maps API not loaded');
      return;
    }

    const mapOptions = {
      center: center,
      zoom: zoom,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      zoomControl: false,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'on' }]
        },
        {
          featureType: 'poi.business',
          stylers: [{ visibility: 'on' }]
        }
      ]
    };

    googleMapRef.current = new window.google.maps.Map(mapRef.current, mapOptions);
    
    // 初始化InfoWindow
    infoWindowRef.current = new window.google.maps.InfoWindow({
      maxWidth: 300,
      disableAutoPan: false
    });
    
    // 只顯示資料庫餐廳，不搜尋 Google Places 附近餐廳
    // searchNearbyRestaurants(center); // 已關閉以節省 API 費用
    
    setMapLoaded(true);
  }, [center, zoom]);

  // 搜尋附近餐廳
  const searchNearbyRestaurants = useCallback(async (location) => {
    if (!googleMapRef.current || !window.google || !location) return;

    // 先顯示資料庫餐廳作為備用方案
    showDatabaseRestaurants(location);

    try {
      // 檢查是否有 Google Places API 可用
      if (!window.google?.maps?.places) {
        console.warn('Google Places API not available, using database restaurants only');
        return;
      }

      // 使用新版 Places API (New)
      const { Place } = await window.google.maps.importLibrary("places");

      // 使用新版 Places API 的 searchNearby 方法
      const searchPlaces = new Promise(async (resolve, reject) => {
        try {
          const request = {
            fields: ['displayName', 'location', 'rating', 'userRatingCount', 'priceLevel'],
            locationRestriction: {
              center: { lat: location.lat, lng: location.lng },
              radius: 1500
            },
            includedTypes: ['restaurant'],
            maxResultCount: 20,
          };

          // 添加超時保護
          const timeoutId = setTimeout(() => {
            reject(new Error('Google Places API request timeout'));
          }, 10000);

          try {
            const { places } = await Place.searchNearby(request);
            clearTimeout(timeoutId);
            console.log('Google Places API (New) Results:', places?.length);
            console.log('First place object:', places?.[0]);

            if (places && places.length > 0) {
              // 轉換為舊格式以保持相容性
              const convertedResults = places.map(place => {
                // 新版API的坐標訪問方式
                let lat = null;
                let lng = null;

                // 嘗試多種坐標訪問方式
                if (place.location) {
                  // 方式1: 直接訪問 lat/lng 屬性
                  if (typeof place.location.lat === 'number' && typeof place.location.lng === 'number') {
                    lat = place.location.lat;
                    lng = place.location.lng;
                  }
                  // 方式2: 調用 lat()/lng() 函數
                  else if (typeof place.location.lat === 'function' && typeof place.location.lng === 'function') {
                    lat = place.location.lat();
                    lng = place.location.lng();
                  }
                  // 方式3: 檢查 toJSON() 方法
                  else if (typeof place.location.toJSON === 'function') {
                    const coords = place.location.toJSON();
                    lat = coords.lat;
                    lng = coords.lng;
                  }
                }

                console.log('Place coordinates for', place.displayName, ':', { lat, lng, location: place.location });

                if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
                  console.warn('Invalid coordinates for place:', place.displayName, { lat, lng, location: place.location });
                  return null;
                }

                return {
                  name: place.displayName,
                  geometry: {
                    location: {
                      lat: lat,
                      lng: lng
                    }
                  },
                  rating: place.rating,
                  place_id: place.id,
                  place_obj: place, // Store the original Place object
                  user_ratings_total: place.userRatingCount
                };
              }).filter(Boolean); // 過濾掉null值
              resolve({ results: convertedResults, status: 'OK' });
            } else {
              reject(new Error('No places found'));
            }
          } catch (apiError) {
            clearTimeout(timeoutId);
            reject(apiError);
          }
        } catch (error) {
          reject(error);
        }
      });

      // 處理搜尋結果
      searchPlaces
        .then(({ results }) => {
          // 清除之前的標記（但保留資料庫餐廳）
          clearGoogleMarkers();

          // 按評分排序，優先顯示高評分餐廳
          const sortedResults = results
            .filter(place => place.rating && place.rating > 3.0)
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .slice(0, 20);

          sortedResults.forEach((place, index) => {
            console.log(`Creating Google Places marker ${index + 1}:`, place.name, place.place_id);
            createMarker(place, 'google');
          });

          console.log(`Google Places 找到 ${sortedResults.length} 間餐廳`);
        })
        .catch(error => {
          console.warn('Google Places API failed:', error.message);
          console.log('繼續使用資料庫餐廳');

          // 如果是 API 配額或權限問題，不要繼續嘗試
          if (error.message.includes('REQUEST_DENIED') ||
              error.message.includes('OVER_QUERY_LIMIT')) {
            console.warn('API 配額或權限問題，停止使用 Google Places API');
            return;
          }

          // 只有在其他錯誤的情況下才嘗試備用搜尋
          tryFallbackSearch(location);
        });

    } catch (error) {
      console.error('Error in searchNearbyRestaurants:', error);
      console.log('使用資料庫餐廳作為備用方案');
    }
  }, []);

  // 備用搜尋方法（使用新版API）
  const tryFallbackSearch = useCallback(async (location) => {
    if (!location) return;

    try {
      const { Place } = await window.google.maps.importLibrary("places");

      const fallbackRequest = {
        fields: ['displayName', 'location', 'rating', 'userRatingCount', 'formattedAddress'],
        locationRestriction: {
          center: { lat: location.lat, lng: location.lng },
          radius: 2000
        },
        includedTypes: ['restaurant', 'food'],
        maxResultCount: 10
      };

      const { places } = await Place.searchNearby(fallbackRequest);
      console.log('Fallback search results:', places?.length);

      if (places && places.length > 0) {
        places.forEach(place => {
          // 驗證坐標有效性 - 使用相同的多重檢測邏輯
          let lat = null;
          let lng = null;

          if (place.location) {
            if (typeof place.location.lat === 'number' && typeof place.location.lng === 'number') {
              lat = place.location.lat;
              lng = place.location.lng;
            }
            else if (typeof place.location.lat === 'function' && typeof place.location.lng === 'function') {
              lat = place.location.lat();
              lng = place.location.lng();
            }
            else if (typeof place.location.toJSON === 'function') {
              const coords = place.location.toJSON();
              lat = coords.lat;
              lng = coords.lng;
            }
          }

          if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
            console.warn('Invalid coordinates for fallback place:', place.displayName, { lat, lng, location: place.location });
            return;
          }

          const convertedPlace = {
            name: place.displayName,
            geometry: {
              location: {
                lat: lat,
                lng: lng
              }
            },
            rating: place.rating,
            place_id: place.id,
            place_obj: place, // Store the original Place object
            formatted_address: place.formattedAddress
          };
          createMarker(convertedPlace, 'google-fallback');
        });
        console.log(`備用搜尋找到 ${places.length} 個結果`);
      }
    } catch (error) {
      console.error('Fallback search error:', error);
    }
  }, []);

  // 顯示資料庫餐廳
  const showDatabaseRestaurants = useCallback((location) => {
    if (!restaurants.length) return;

    // 清除之前的資料庫餐廳標記
    markersRef.current.forEach(marker => {
      if (marker.markerType === 'database') {
        marker.setMap(null);
      }
    });
    markersRef.current = markersRef.current.filter(marker => marker.markerType !== 'database');

    // 顯示所有資料庫餐廳（不限制距離，與初始載入一樣）
    const validRestaurants = restaurants
      .filter(restaurant => restaurant.latitude && restaurant.longitude);

    validRestaurants.forEach(restaurant => {
      createDatabaseRestaurantMarker(restaurant);
    });

    console.log(`資料庫顯示 ${validRestaurants.length} 間餐廳`);
  }, [restaurants]);

  // 計算兩點之間的距離（公里）
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371; // 地球半徑（公里）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  // 清除Google標記
  const clearGoogleMarkers = useCallback(() => {
    markersRef.current.forEach(marker => {
      if (marker.markerType && marker.markerType.startsWith('google')) {
        marker.setMap(null);
      }
    });
    markersRef.current = markersRef.current.filter(marker =>
      !marker.markerType || !marker.markerType.startsWith('google')
    );
  }, []);

  // 創建資料庫餐廳標記
  const createDatabaseRestaurantMarker = useCallback((restaurant) => {
    if (!googleMapRef.current || !restaurant.latitude || !restaurant.longitude) return;

    const isFavorite = favorites.some(fav =>
      fav.place_id === restaurant.id || fav.name === restaurant.name
    );

    const marker = new window.google.maps.Marker({
      position: { lat: restaurant.latitude, lng: restaurant.longitude },
      map: googleMapRef.current,
      title: `${restaurant.name} ${restaurant.rating ? `(${restaurant.rating}★)` : ''} - 資料庫`,
      icon: {
        url: `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="%23FF6B35"%3E%3Cpath d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/%3E%3C/svg%3E`,
        scaledSize: new window.google.maps.Size(32, 32),
        anchor: new window.google.maps.Point(16, 32)
      }
    });

    marker.markerType = 'database';
    marker.restaurantData = restaurant;

    marker.addListener('click', () => {
      showDatabaseRestaurantInfo(restaurant, marker);
    });

    markersRef.current.push(marker);
  }, [favorites]);

  // 顯示資料庫餐廳資訊
  const showDatabaseRestaurantInfo = useCallback((restaurant, marker) => {
    if (!infoWindowRef.current) {
      console.error('InfoWindow not initialized');
      return;
    }

    console.log('showDatabaseRestaurantInfo called:', restaurant.name);

    const isFavorite = favorites.some(fav =>
      fav.place_id === restaurant.id || fav.name === restaurant.name
    );

    // 處理圖片 - 優先使用餐廳資料庫的圖片
    let photo = null;
    if (restaurant.primaryImage?.image_url) {
      photo = restaurant.primaryImage.image_url;
    }

    const rating = restaurant.rating ? restaurant.rating.toFixed(1) : 'N/A';

    // 生成收藏清單選項
    const favoriteListsOptions = user && favoriteLists.length > 0
      ? favoriteLists.map(list =>
          `<option value="${list.id}">${list.name} (${list.favorite_list_places?.length || 0})</option>`
        ).join('')
      : '';

    const contentString = `
      <div class="google-places-info-window" id="database-restaurant-${restaurant.id}">
        <button class="custom-close-btn" onclick="closeInfoWindow()">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M11 1L1 11M1 1l10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        ${photo ? `<img src="${photo}" alt="${restaurant.name}" class="info-place-photo google-places-photo" />` : ''}
        <div class="info-place-content google-places-content">
          <h3 class="info-place-name google-places-name">${restaurant.name}</h3>
          ${restaurant.category ? `<p class="info-place-category google-places-category">${restaurant.category}</p>` : ''}
          <div class="info-place-rating google-places-rating">
            <span class="info-rating-stars google-places-stars">${'★'.repeat(Math.floor(restaurant.rating || 0))}${'☆'.repeat(5 - Math.floor(restaurant.rating || 0))}</span>
            <span class="info-rating-text google-places-rating-text">${rating}</span>
            ${restaurant.user_ratings_total ? `<span class="info-rating-count google-places-rating-count"> (${restaurant.user_ratings_total})</span>` : ''}
          </div>
          <p class="info-place-address google-places-address">${restaurant.address || '地址未提供'}</p>

          <div class="info-place-actions google-places-actions">
            ${user ? (favoriteLists.length > 0 ? `
              <div class="favorite-section google-places-favorite-section">
                <div class="restaurant-select-wrapper">
                  <div class="restaurant-select" id="databaseCustomSelect" onclick="toggleDatabaseDropdown()">
                    <span class="restaurant-select-text">選擇收藏清單</span>
                    <span class="restaurant-select-arrow">▼</span>
                  </div>
                  <div class="restaurant-options" id="databaseCustomOptions" style="display: none;">
                    ${favoriteLists.map(list => `
                      <div class="restaurant-option" data-value="${list.id}" onclick="selectDatabaseOption('${list.id}', '${list.name}')">
                        ${list.name} (${list.favorite_list_places?.length || 0})
                      </div>
                    `).join('')}
                  </div>
                </div>
                <button class="add-to-list-btn google-places-add-btn" onclick="addToDatabaseFavoriteList('${restaurant.id}')">
                  📌 加入清單
                </button>
              </div>
            ` : `
              <button class="favorite-btn google-places-favorite-btn ${isFavorite ? 'favorited' : ''}" onclick="toggleDatabaseFavorite('${restaurant.id}')">
                ${isFavorite ? '♥' : '♡'} ${isFavorite ? '已收藏' : '收藏'}
              </button>
            `) : `
              <div class="login-prompt" style="text-align: center; color: #6b7280; font-size: 0.875rem; margin: 8px 0;">
                <p>請先登入才能使用收藏功能</p>
              </div>
            `}
            <button class="info-navigate-btn google-places-navigate-btn" onclick="openNavigation(${restaurant.latitude}, ${restaurant.longitude})">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              前往餐廳
            </button>
          </div>
        </div>
      </div>
    `;

    // 強制立即顯示 InfoWindow
    infoWindowRef.current.close(); // 先關閉任何現有的 InfoWindow

    // 使用 requestAnimationFrame 確保在下一個渲染週期執行
    requestAnimationFrame(() => {
      try {
        infoWindowRef.current.setContent(contentString);
        infoWindowRef.current.open(googleMapRef.current, marker);

        // 立即套用樣式修正
        setTimeout(() => {
          const iwCh = document.querySelector('.gm-style-iw-ch');
          const infoWindow = document.querySelector('.google-places-info-window');
          const iwContainer = document.querySelector('.gm-style-iw');

          if (iwCh && infoWindow) {
            iwCh.style.paddingTop = '0px';
          }
          if (iwContainer) {
            iwContainer.style.display = 'block';
            iwContainer.style.visibility = 'visible';
            iwContainer.style.zIndex = '999999';
          }
        }, 50);

      } catch (error) {
        console.error('Error opening InfoWindow:', error);
      }
    });

    // 全域函數供InfoWindow使用
    window.toggleDatabaseFavorite = (restaurantId) => {
      // 轉換為Google Places格式以使用現有的收藏功能
      const restaurantPlace = {
        place_id: restaurant.id,
        name: restaurant.name,
        formatted_address: restaurant.address,
        rating: restaurant.rating,
        category: restaurant.category,
        primaryImage: restaurant.primaryImage,
        isFromDatabase: true,
        geometry: {
          location: {
            lat: () => parseFloat(restaurant.latitude),
            lng: () => parseFloat(restaurant.longitude)
          }
        }
      };
      onFavoriteToggle?.(restaurantPlace, !isFavorite);
    };

    // 自訂下拉選單函數
    window.toggleDatabaseDropdown = () => {
      const options = document.getElementById('databaseCustomOptions');
      const arrow = document.querySelector('#databaseCustomSelect .restaurant-select-arrow');
      if (options.style.display === 'none') {
        options.style.display = 'block';
        arrow.style.transform = 'rotate(180deg)';
      } else {
        options.style.display = 'none';
        arrow.style.transform = 'rotate(0deg)';
      }
    };

    window.selectDatabaseOption = (value, text) => {
      const selectText = document.querySelector('#databaseCustomSelect .restaurant-select-text');
      const options = document.getElementById('databaseCustomOptions');
      const arrow = document.querySelector('#databaseCustomSelect .restaurant-select-arrow');

      selectText.textContent = text;
      selectText.dataset.value = value;
      options.style.display = 'none';
      arrow.style.transform = 'rotate(0deg)';
    };

    window.addToDatabaseFavoriteList = async (restaurantId) => {
      const selectText = document.querySelector('#databaseCustomSelect .restaurant-select-text');
      const selectedListId = selectText?.dataset.value;

      if (!selectedListId) {
        alert('請先選擇一個收藏清單');
        return;
      }

      const selectedList = favoriteLists.find(list => list.id === selectedListId);

      if (selectedList && window.addPlaceToList) {
        // 轉換為Google Places格式
        const restaurantPlace = {
          place_id: restaurant.id,
          name: restaurant.name,
          formatted_address: restaurant.address,
          rating: restaurant.rating,
          category: restaurant.category,
          primaryImage: restaurant.primaryImage,
          isFromDatabase: true,
          geometry: {
            location: {
              lat: () => parseFloat(restaurant.latitude),
              lng: () => parseFloat(restaurant.longitude)
            }
          }
        };

        await window.addPlaceToList(selectedListId, restaurantPlace);
      }
    };

    // 全域導航函數
    window.openNavigation = (lat, lng) => {
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile) {
        // 手機版使用 Google Maps app
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
      } else {
        // 桌面版開啟 Google Maps 網頁版
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
      }
    };

    window.closeInfoWindow = () => {
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }
    };
  }, [favorites, onFavoriteToggle, user, favoriteLists]);

  // 創建標記（修改版本以支持類型）
  const createMarker = useCallback((place, markerType = 'google') => {
    if (!googleMapRef.current || !place.geometry?.location) return;

    const isFavorite = favorites.some(fav => fav.place_id === place.place_id);
    const rating = place.rating || 0;

    // 根據評分選擇圖標顏色
    let iconColor = '#666'; // 預設灰色
    if (rating >= 4.5) {
      iconColor = '#4CAF50'; // 綠色（優秀）
    } else if (rating >= 4.0) {
      iconColor = '#FFC107'; // 黃色（很好）
    } else if (rating >= 3.5) {
      iconColor = '#FF9800'; // 橙色（不錯）
    } else if (rating >= 3.0) {
      iconColor = '#FF5722'; // 紅橙色（一般）
    }

    const marker = new window.google.maps.Marker({
      position: place.geometry.location,
      map: googleMapRef.current,
      title: `${place.name} ${rating > 0 ? `(${rating}★)` : ''} ${markerType === 'google-fallback' ? '- 備用搜尋' : ''}`,
      icon: {
        url: isFavorite
          ? `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="%23ff6b35"%3E%3Cpath d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/%3E%3C/svg%3E`
          : `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="${encodeURIComponent(iconColor)}"%3E%3Cpath d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/%3E%3C/svg%3E`,
        scaledSize: new window.google.maps.Size(isFavorite ? 36 : 32, isFavorite ? 36 : 32),
        anchor: new window.google.maps.Point(isFavorite ? 18 : 16, isFavorite ? 36 : 32)
      },
      animation: place.rating >= 4.5 ? window.google.maps.Animation.DROP : null
    });

    marker.markerType = markerType;
    marker.placeData = place;
    console.log('Marker created with placeData:', place.name, 'has place_obj:', !!place.place_obj);

    marker.addListener('click', () => {
      console.log('Google Places marker clicked:', place.name, place.place_id);
      console.log('Marker placeData:', marker.placeData);
      getPlaceDetails(place.place_id, marker);
    });

    markersRef.current.push(marker);
  }, [favorites]);

  // 取得地點詳細資訊
  const getPlaceDetails = useCallback(async (placeId, marker) => {
    console.log('getPlaceDetails called with placeId:', placeId);
    if (!googleMapRef.current || !placeId) return;

    try {
      // 檢查是否有 Google Places API 可用
      if (!window.google?.maps?.places) {
        console.warn('Google Places API not available for place details');
        return;
      }

      let place;

      // 檢查marker是否已經有Place對象
      if (marker.placeData?.place_obj) {
        console.log('Using existing Place object');
        place = marker.placeData.place_obj;

        // 確保已經有必要的字段
        await place.fetchFields({
          fields: [
            'displayName', 'formattedAddress', 'nationalPhoneNumber',
            'rating', 'userRatingCount', 'regularOpeningHours',
            'photos', 'location', 'id', 'websiteURI'
          ]
        });
      } else {
        console.log('Creating new Place object');
        // 使用新版 Places API 獲取詳細資訊
        const { Place } = await window.google.maps.importLibrary("places");

        place = new Place({
          id: placeId,
          requestedLanguage: 'zh-TW'
        });

        await place.fetchFields({
          fields: [
            'displayName', 'formattedAddress', 'nationalPhoneNumber',
            'rating', 'userRatingCount', 'regularOpeningHours',
            'photos', 'location', 'id', 'websiteURI'
          ]
        });
      }

      // 驗證坐標有效性 - 使用相同的多重檢測邏輯
      let lat = null;
      let lng = null;

      if (place.location) {
        if (typeof place.location.lat === 'number' && typeof place.location.lng === 'number') {
          lat = place.location.lat;
          lng = place.location.lng;
        }
        else if (typeof place.location.lat === 'function' && typeof place.location.lng === 'function') {
          lat = place.location.lat();
          lng = place.location.lng();
        }
        else if (typeof place.location.toJSON === 'function') {
          const coords = place.location.toJSON();
          lat = coords.lat;
          lng = coords.lng;
        }
      }

      if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
        console.warn('Invalid coordinates for place details:', place.displayName, { lat, lng, location: place.location });
        return;
      }

      // 轉換為舊格式以保持相容性
      const convertedPlace = {
        name: place.displayName,
        formatted_address: place.formattedAddress,
        formatted_phone_number: place.nationalPhoneNumber,
        rating: place.rating,
        user_ratings_total: place.userRatingCount,
        opening_hours: place.regularOpeningHours,
        photos: place.photos,
        geometry: {
          location: {
            lat: () => lat,
            lng: () => lng
          }
        },
        place_id: place.id,
        website: place.websiteURI
      };

      setSelectedPlace(convertedPlace);
      console.log('Calling showInfoWindow with convertedPlace:', convertedPlace.name);
      showInfoWindow(convertedPlace, marker);
    } catch (error) {
      console.error('Error in getPlaceDetails:', error);
    }
  }, [onPlaceSelect]);

  // 顯示資訊視窗（使用原生 InfoWindow 但自定義內容）
  const showInfoWindow = useCallback((place, marker) => {
    if (!infoWindowRef.current || !place) return;

    console.log('showInfoWindow called for Google Places:', place.name);

    const isFavorite = favorites.some(fav => fav.place_id === place.place_id);

    // 處理圖片 - 優先使用餐廳資料庫的圖片
    let photo = null;
    if (place.isFromDatabase && place.primaryImage?.image_url) {
      photo = place.primaryImage.image_url;
    } else if (place.photos?.[0]) {
      // 新版Google Places API照片處理
      try {
        if (typeof place.photos[0].getURI === 'function') {
          // 新版API使用 getURI
          photo = place.photos[0].getURI({ maxWidth: 300, maxHeight: 140 });
        } else if (typeof place.photos[0].getUrl === 'function') {
          // 舊版API使用 getUrl
          photo = place.photos[0].getUrl({ maxWidth: 300, maxHeight: 140 });
        } else if (place.photos[0].uri) {
          // 直接使用uri屬性
          photo = place.photos[0].uri;
        }
      } catch (error) {
        console.warn('Error getting photo URL:', error);
        photo = null;
      }
    }

    const rating = place.rating ? place.rating.toFixed(1) : 'N/A';
    const reviewCount = place.user_ratings_total || 0;

    // 生成收藏清單選項
    const favoriteListsOptions = user && favoriteLists.length > 0
      ? favoriteLists.map(list =>
          `<option value="${list.id}">${list.name} (${list.favorite_list_places?.length || 0})</option>`
        ).join('')
      : '';

    const contentString = `
      <div class="google-places-info-window" id="google-places-${place.place_id}">
        <button class="custom-close-btn" onclick="closeInfoWindow()">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M11 1L1 11M1 1l10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        ${photo ? `<img src="${photo}" alt="${place.name}" class="info-place-photo google-places-photo" />` : ''}
        <div class="info-place-content google-places-content">
          <h3 class="info-place-name google-places-name">${place.name}</h3>
          ${place.category ? `<p class="info-place-category google-places-category">${place.category}</p>` : ''}
          <div class="info-place-rating google-places-rating">
            <span class="info-rating-stars google-places-stars">${'★'.repeat(Math.floor(place.rating || 0))}${'☆'.repeat(5 - Math.floor(place.rating || 0))}</span>
            <span class="info-rating-text google-places-rating-text">${rating}${reviewCount > 0 ? ` (${reviewCount})` : ''}</span>
          </div>
          <p class="info-place-address google-places-address">${place.formatted_address || ''}</p>
          ${place.formatted_phone_number ? `<p class="info-place-phone google-places-phone">${place.formatted_phone_number}</p>` : ''}

          <div class="info-place-actions google-places-actions">
            ${user && favoriteLists.length > 0 ? `
              <div class="favorite-section google-places-favorite-section">
                <div class="restaurant-select-wrapper">
                  <div class="restaurant-select" id="googleCustomSelect" onclick="toggleGoogleDropdown()">
                    <span class="restaurant-select-text">選擇收藏清單</span>
                    <span class="restaurant-select-arrow">▼</span>
                  </div>
                  <div class="restaurant-options" id="googleCustomOptions" style="display: none;">
                    ${favoriteLists.map(list => `
                      <div class="restaurant-option" data-value="${list.id}" onclick="selectGoogleOption('${list.id}', '${list.name}')">
                        ${list.name} (${list.favorite_list_places?.length || 0})
                      </div>
                    `).join('')}
                  </div>
                </div>
                <button class="add-to-list-btn google-places-add-btn" onclick="addToFavoriteList('${place.place_id}')">
                  📌 加入清單
                </button>
              </div>
            ` : `
              <button class="favorite-btn google-places-favorite-btn ${isFavorite ? 'favorited' : ''}" onclick="toggleFavorite('${place.place_id}')">
                ${isFavorite ? '♥' : '♡'} ${isFavorite ? '已收藏' : '收藏'}
              </button>
            `}
            <button class="info-navigate-btn google-places-navigate-btn" onclick="openNavigation(${place.isFromDatabase ? place.latitude : place.geometry.location.lat()}, ${place.isFromDatabase ? place.longitude : place.geometry.location.lng()})">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              前往餐廳
            </button>
          </div>
        </div>
      </div>
    `;

    infoWindowRef.current.setContent(contentString);
    infoWindowRef.current.open(googleMapRef.current, marker);

    // 移除Google Places InfoWindow的padding-top
    setTimeout(() => {
      const iwCh = document.querySelector('.gm-style-iw-ch');
      if (iwCh && document.querySelector('.google-places-info-window')) {
        iwCh.style.paddingTop = '0px';
      }
    }, 100);

    // 全域函數供InfoWindow使用
    window.toggleFavorite = (placeId) => {
      onFavoriteToggle?.(place, !isFavorite);
    };

    window.closeInfoWindow = () => {
      infoWindowRef.current.close();
    };

    window.toggleGoogleDropdown = () => {
      const options = document.getElementById('googleCustomOptions');
      const arrow = document.querySelector('#googleCustomSelect .restaurant-select-arrow');
      if (options.style.display === 'none') {
        options.style.display = 'block';
        arrow.style.transform = 'rotate(180deg)';
      } else {
        options.style.display = 'none';
        arrow.style.transform = 'rotate(0deg)';
      }
    };

    window.selectGoogleOption = (value, text) => {
      const selectText = document.querySelector('#googleCustomSelect .restaurant-select-text');
      const options = document.getElementById('googleCustomOptions');
      const arrow = document.querySelector('#googleCustomSelect .restaurant-select-arrow');

      selectText.textContent = text;
      selectText.dataset.value = value;
      options.style.display = 'none';
      arrow.style.transform = 'rotate(0deg)';
    };

    window.addToFavoriteList = async (placeId) => {
      const selectText = document.querySelector('#googleCustomSelect .restaurant-select-text');
      const selectedListId = selectText?.dataset.value;

      if (!selectedListId) {
        alert('請先選擇一個收藏清單');
        return;
      }

      const selectedList = favoriteLists.find(list => list.id === selectedListId);
      if (selectedList && window.addPlaceToList) {
        await window.addPlaceToList(selectedListId, place);
      }
    };

    window.openNavigation = (lat, lng) => {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      window.open(url, '_blank');
    };
  }, [favorites, onFavoriteToggle, user, favoriteLists]);


  // 清除所有標記
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(marker => {
      marker.setMap(null);
    });
    markersRef.current = [];
  }, []);

  // 創建餐廳資料庫標記
  const createRestaurantMarkers = useCallback(() => {
    if (!googleMapRef.current || restaurants.length === 0) return;

    // 清除現有的餐廳標記
    restaurantMarkers.forEach(marker => marker.setMap(null));

    const newMarkers = restaurants
      .filter(restaurant => restaurant.latitude && restaurant.longitude)
      .map(restaurant => {
        const isFavorite = favorites.some(fav =>
          fav.place_id === restaurant.id ||
          (fav.name && fav.name.toLowerCase() === restaurant.name.toLowerCase())
        );

        const iconColor = isFavorite ? '#ff6b35' : '#4CAF50';
        const iconSize = isFavorite ? 36 : 28;

        const marker = new window.google.maps.Marker({
          position: {
            lat: parseFloat(restaurant.latitude),
            lng: parseFloat(restaurant.longitude)
          },
          map: googleMapRef.current,
          title: `${restaurant.name} ${restaurant.rating ? `(${restaurant.rating}★)` : ''}`,
          icon: {
            url: isFavorite ?
              `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="${encodeURIComponent(iconColor)}"%3E%3Cpath d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/%3E%3C/svg%3E` :
              `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="${encodeURIComponent(iconColor)}"%3E%3Cpath d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/%3E%3C/svg%3E`,
            scaledSize: new window.google.maps.Size(iconSize, iconSize),
            anchor: new window.google.maps.Point(iconSize / 2, iconSize)
          }
        });

        // 添加點擊事件
        marker.addListener('click', () => {
          const restaurantPlace = {
            name: restaurant.name,
            formatted_address: restaurant.address,
            place_id: restaurant.id,
            rating: restaurant.rating,
            category: restaurant.category,
            primaryImage: restaurant.primaryImage,
            isFromDatabase: true,
            geometry: {
              location: {
                lat: () => parseFloat(restaurant.latitude),
                lng: () => parseFloat(restaurant.longitude)
              }
            }
          };

          setSelectedPlace(restaurantPlace);
          showDatabaseRestaurantInfo(restaurant, marker);
          onPlaceSelect?.(restaurantPlace);
        });

        return marker;
      });

    setRestaurantMarkers(newMarkers);
    console.log(`創建了 ${newMarkers.length} 個餐廳標記`);
  }, [restaurants, favorites, onPlaceSelect]);

  // 載入 Google Maps API
  useEffect(() => {
    let isMounted = true;

    const loadMaps = async () => {
      try {
        console.log('🗺️ 開始載入 Google Maps API...');
        console.log('📊 環境檢查:', {
          apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? '已設定' : '❌ 未設定',
          domain: window.location.hostname,
          protocol: window.location.protocol
        });

        await googleMapsLoader.load();

        if (isMounted) {
          console.log('✅ Google Maps API 載入成功');
          initializeMap();
        }
      } catch (error) {
        console.error('❌ Google Maps API 載入失敗:', error);
        console.error('🔍 錯誤分析:', {
          message: error.message,
          stack: error.stack,
          apiKeyExists: !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
          apiKeyPrefix: import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.substring(0, 10) + '...',
          currentDomain: window.location.origin,
          isLocalhost: window.location.hostname === 'localhost',
          isVercel: window.location.hostname.includes('vercel.app')
        });

        // 如果是配額或權限問題，顯示資料庫餐廳
        if (error.message.includes('REQUEST_DENIED') ||
            error.message.includes('API key') ||
            error.message.includes('quota')) {
          console.warn('🔄 Google Maps API 不可用，只顯示資料庫餐廳');
        }
      }
    };

    loadMaps();

    return () => {
      isMounted = false;
    };
  }, [initializeMap]);

  // 載入餐廳資料
  useEffect(() => {
    console.log('📊 開始載入餐廳資料...');
    loadRestaurants();
  }, [loadRestaurants]);

  // 當地圖載入完成且有餐廳資料時創建標記
  useEffect(() => {
    if (mapLoaded && restaurants.length > 0) {
      createRestaurantMarkers();
    }
  }, [mapLoaded, restaurants, favorites, createRestaurantMarkers]);

  // 當搜尋位置改變時，移動地圖中心（不搜尋附近餐廳）
  useEffect(() => {
    if (searchLocation && googleMapRef.current) {
      const newCenter = new window.google.maps.LatLng(searchLocation.lat, searchLocation.lng);
      googleMapRef.current.setCenter(newCenter);
      googleMapRef.current.setZoom(16);
      // 不再搜尋附近餐廳，只顯示資料庫餐廳
      // searchNearbyRestaurants(searchLocation); // 已關閉以節省 API 費用
    }
  }, [searchLocation]);


  // 清理函數
  useEffect(() => {
    return () => {
      // 清理全域函數
      delete window.toggleFavorite;
      delete window.openNavigation;
    };
  }, []);

  return (
    <div className="map-view-container">
      <div
        ref={mapRef}
        className="google-map"
        style={{ width: '100%', height: '100%' }}
      />

      {!mapLoaded && (
        <div className="map-loading">
          <div className="loading-spinner"></div>
          <p>載入地圖中...</p>
        </div>
      )}

    </div>
  );
}