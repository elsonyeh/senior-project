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
      fullscreenControl: true,
      fullscreenControlOptions: {
        position: window.google.maps.ControlPosition.RIGHT_BOTTOM
      },
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
    infoWindowRef.current = new window.google.maps.InfoWindow();
    
    // 搜尋附近餐廳
    searchNearbyRestaurants(center);
    
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

      // 使用新版 Places API
      const { PlacesService } = await window.google.maps.importLibrary("places");
      const service = new PlacesService(googleMapRef.current);

      // 包裝在 Promise 中以更好地處理錯誤
      const searchPlaces = new Promise((resolve, reject) => {
        const request = {
          location: new window.google.maps.LatLng(location.lat, location.lng),
          radius: 1500, // 1.5公里範圍
          type: ['restaurant'],
          language: 'zh-TW'
        };

        // 添加超時保護
        const timeoutId = setTimeout(() => {
          reject(new Error('Google Places API request timeout'));
        }, 10000);

        try {
          service.nearbySearch(request, (results, status) => {
            clearTimeout(timeoutId);
            console.log('Google Places API status:', status, 'Results:', results?.length);

            if (status === 'OK' && results) {
              resolve({ results, status });
            } else {
              reject(new Error(`Places API error: ${status}`));
            }
          });
        } catch (apiError) {
          clearTimeout(timeoutId);
          reject(apiError);
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

          sortedResults.forEach(place => {
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
          tryFallbackSearch(service, location);
        });

    } catch (error) {
      console.error('Error in searchNearbyRestaurants:', error);
      console.log('使用資料庫餐廳作為備用方案');
    }
  }, []);

  // 備用搜尋方法
  const tryFallbackSearch = useCallback(async (service, location) => {
    if (!service || !location) return;

    try {
      const fallbackRequest = {
        location: new window.google.maps.LatLng(location.lat, location.lng),
        radius: 2000,
        keyword: '餐廳',
        language: 'zh-TW',
        fields: ['name', 'geometry', 'place_id', 'rating', 'formatted_address']
      };

      service.nearbySearch(fallbackRequest, (fallbackResults, fallbackStatus) => {
        console.log('Fallback search status:', fallbackStatus, 'Results:', fallbackResults?.length);

        if (fallbackStatus === 'OK' && fallbackResults) {
          fallbackResults.slice(0, 10).forEach(place => {
            createMarker(place, 'google-fallback');
          });
          console.log(`備用搜尋找到 ${fallbackResults.length} 個結果`);
        } else {
          console.warn('Fallback search also failed:', fallbackStatus);
        }
      });
    } catch (error) {
      console.error('Fallback search error:', error);
    }
  }, []);

  // 顯示資料庫餐廳
  const showDatabaseRestaurants = useCallback((location) => {
    if (!restaurants.length) return;

    // 計算距離並顯示附近的資料庫餐廳
    const nearbyRestaurants = restaurants
      .filter(restaurant => restaurant.latitude && restaurant.longitude)
      .map(restaurant => {
        const distance = calculateDistance(
          location.lat, location.lng,
          restaurant.latitude, restaurant.longitude
        );
        return { ...restaurant, distance };
      })
      .filter(restaurant => restaurant.distance <= 3) // 3公里內
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10);

    nearbyRestaurants.forEach(restaurant => {
      createDatabaseRestaurantMarker(restaurant);
    });

    console.log(`資料庫找到 ${nearbyRestaurants.length} 間附近餐廳`);
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
    if (!infoWindowRef.current) return;

    const content = `
      <div class="map-info-window">
        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${restaurant.name}</h3>
        <p style="margin: 4px 0; font-size: 14px; color: #666;">${restaurant.address || '地址未提供'}</p>
        ${restaurant.category ? `<p style="margin: 4px 0; font-size: 12px; color: #888;">${restaurant.category}</p>` : ''}
        ${restaurant.rating ? `<p style="margin: 4px 0; font-size: 12px;"><span style="color: #ffa500;">★</span> ${restaurant.rating}</p>` : ''}
        <p style="margin: 8px 0 4px 0; font-size: 11px; color: #999;">來源：資料庫</p>
      </div>
    `;

    infoWindowRef.current.setContent(content);
    infoWindowRef.current.open(googleMapRef.current, marker);
  }, []);

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

    marker.addListener('click', () => {
      getPlaceDetails(place.place_id, marker);
    });

    markersRef.current.push(marker);
  }, [favorites]);

  // 取得地點詳細資訊
  const getPlaceDetails = useCallback(async (placeId, marker) => {
    if (!googleMapRef.current || !placeId) return;

    try {
      // 檢查是否有 Google Places API 可用
      if (!window.google?.maps?.places) {
        console.warn('Google Places API not available for place details');
        return;
      }

      // 使用新版 Places API
      const { PlacesService } = await window.google.maps.importLibrary("places");
      const service = new PlacesService(googleMapRef.current);

      service.getDetails({
        placeId: placeId,
        fields: [
          'name', 'formatted_address', 'formatted_phone_number',
          'rating', 'user_ratings_total', 'opening_hours',
          'photos', 'geometry', 'place_id', 'website'
        ]
      }, (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
          setSelectedPlace(place);
          showInfoWindow(place, marker);
        } else if (status === window.google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
          console.warn('Google Places API request denied for place details');
        } else {
          console.warn('Place details request failed:', status);
        }
      });
    } catch (error) {
      console.error('Error in getPlaceDetails:', error);
    }
  }, [onPlaceSelect]);

  // 顯示資訊視窗
  const showInfoWindow = useCallback((place, marker) => {
    if (!infoWindowRef.current || !place) return;

    const isFavorite = favorites.some(fav => fav.place_id === place.place_id);

    // 處理圖片 - 優先使用餐廳資料庫的圖片
    let photo = null;
    if (place.isFromDatabase && place.primaryImage?.image_url) {
      photo = place.primaryImage.image_url;
    } else if (place.photos?.[0]) {
      photo = place.photos[0].getUrl({ maxWidth: 200, maxHeight: 150 });
    }

    const rating = place.rating ? place.rating.toFixed(1) : 'N/A';
    const reviewCount = place.user_ratings_total || 0;

    // 生成收藏清單選項
    const favoriteListsOptions = user && favoriteLists.length > 0
      ? favoriteLists.map(list =>
          `<option value="${list.id}">${list.name} (${list.places?.length || 0})</option>`
        ).join('')
      : '';

    const contentString = `
      <div class="custom-info-window">
        ${photo ? `<img src="${photo}" alt="${place.name}" class="place-photo" />` : ''}
        <div class="place-content">
          <h3 class="place-name">${place.name}</h3>
          ${place.category ? `<p class="place-category">${place.category}</p>` : ''}
          <div class="place-rating">
            <span class="rating-stars">${'★'.repeat(Math.floor(place.rating || 0))}${'☆'.repeat(5 - Math.floor(place.rating || 0))}</span>
            <span class="rating-text">${rating}${reviewCount > 0 ? ` (${reviewCount})` : ''}</span>
          </div>
          <p class="place-address">${place.formatted_address || ''}</p>
          ${place.formatted_phone_number ? `<p class="place-phone">${place.formatted_phone_number}</p>` : ''}

          <div class="place-actions">
            ${user && favoriteLists.length > 0 ? `
              <div class="favorite-section">
                <select class="favorite-list-select" id="favoriteListSelect">
                  <option value="">選擇收藏清單</option>
                  ${favoriteListsOptions}
                </select>
                <button class="add-to-list-btn" onclick="addToFavoriteList('${place.place_id}')">
                  📌 加入清單
                </button>
              </div>
            ` : `
              <button class="favorite-btn ${isFavorite ? 'favorited' : ''}" onclick="toggleFavorite('${place.place_id}')">
                ${isFavorite ? '♥' : '♡'} ${isFavorite ? '已收藏' : '收藏'}
              </button>
            `}
            <button class="navigate-btn" onclick="openNavigation(${place.isFromDatabase ? place.latitude : place.geometry.location.lat()}, ${place.isFromDatabase ? place.longitude : place.geometry.location.lng()})">
              🧭 導航
            </button>
          </div>
        </div>
      </div>
    `;

    infoWindowRef.current.setContent(contentString);
    infoWindowRef.current.open(googleMapRef.current, marker);

    // 全域函數供InfoWindow使用
    window.toggleFavorite = (placeId) => {
      onFavoriteToggle?.(place, !isFavorite);
    };

    window.addToFavoriteList = (placeId) => {
      const select = document.getElementById('favoriteListSelect');
      const selectedListId = select?.value;

      if (!selectedListId) {
        alert('請先選擇一個收藏清單');
        return;
      }

      const selectedList = favoriteLists.find(list => list.id === selectedListId);
      if (selectedList && window.addPlaceToList) {
        window.addPlaceToList(selectedListId, place);
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
          showInfoWindow(restaurantPlace, marker);
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

  // 當搜尋位置改變時，移動地圖中心並搜尋
  useEffect(() => {
    if (searchLocation && googleMapRef.current) {
      const newCenter = new window.google.maps.LatLng(searchLocation.lat, searchLocation.lng);
      googleMapRef.current.setCenter(newCenter);
      googleMapRef.current.setZoom(16);
      searchNearbyRestaurants(searchLocation);
    }
  }, [searchLocation, searchNearbyRestaurants]);

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