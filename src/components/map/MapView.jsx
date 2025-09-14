import React, { useEffect, useRef, useState, useCallback } from 'react';
import { IoHeartOutline, IoHeart, IoInformationCircleOutline, IoNavigateOutline } from 'react-icons/io5';
import googleMapsLoader from '../../utils/googleMapsLoader';
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
  favorites = []
}) {
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);

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
      zoomControl: true,
      zoomControlOptions: {
        position: window.google.maps.ControlPosition.RIGHT_BOTTOM
      },
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
  const searchNearbyRestaurants = useCallback((location) => {
    if (!googleMapRef.current || !window.google || !location) return;

    try {
      const service = new window.google.maps.places.PlacesService(googleMapRef.current);

      const request = {
        location: new window.google.maps.LatLng(location.lat, location.lng),
        radius: 1500, // 1.5公里範圍
        type: ['restaurant'],
        language: 'zh-TW',
        keyword: '餐廳 美食' // 增加關鍵字搜尋
      };

      service.nearbySearch(request, (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          clearMarkers();

          // 按評分排序，優先顯示高評分餐廳
          const sortedResults = results
            .filter(place => place.rating && place.rating > 3.0) // 過濾評分低於3.0的
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .slice(0, 25); // 增加到25個結果

          sortedResults.forEach(place => {
            createMarker(place);
          });

          console.log(`找到 ${sortedResults.length} 間餐廳`);
        } else {
          console.warn('Places search failed:', status);

          // 如果搜尋失敗，嘗試更廣泛的搜尋
          if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            const fallbackRequest = {
              location: new window.google.maps.LatLng(location.lat, location.lng),
              radius: 2000, // 擴大搜尋範圍到2公里
              keyword: '餐廳 食物 美食 restaurant',
              language: 'zh-TW'
            };

            service.nearbySearch(fallbackRequest, (fallbackResults, fallbackStatus) => {
              if (fallbackStatus === window.google.maps.places.PlacesServiceStatus.OK && fallbackResults) {
                clearMarkers();
                fallbackResults.slice(0, 15).forEach(place => {
                  createMarker(place);
                });
                console.log(`備用搜尋找到 ${fallbackResults.length} 個結果`);
              }
            });
          }
        }
      });
    } catch (error) {
      console.error('Error in searchNearbyRestaurants:', error);
    }
  }, []);

  // 創建標記
  const createMarker = useCallback((place) => {
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
      title: `${place.name} ${rating > 0 ? `(${rating}★)` : ''}`,
      icon: {
        url: isFavorite
          ? `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="%23ff6b35"%3E%3Cpath d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/%3E%3C/svg%3E`
          : `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="${encodeURIComponent(iconColor)}"%3E%3Cpath d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/%3E%3C/svg%3E`,
        scaledSize: new window.google.maps.Size(isFavorite ? 36 : 32, isFavorite ? 36 : 32),
        anchor: new window.google.maps.Point(isFavorite ? 18 : 16, isFavorite ? 36 : 32)
      },
      animation: place.rating >= 4.5 ? window.google.maps.Animation.DROP : null
    });

    marker.addListener('click', () => {
      getPlaceDetails(place.place_id, marker);
    });

    markersRef.current.push(marker);
  }, [favorites]);

  // 取得地點詳細資訊
  const getPlaceDetails = useCallback((placeId, marker) => {
    if (!googleMapRef.current || !placeId) return;

    try {
      const service = new window.google.maps.places.PlacesService(googleMapRef.current);
      
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
          onPlaceSelect?.(place);
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
    const photo = place.photos?.[0]?.getUrl({ maxWidth: 200, maxHeight: 150 });
    const rating = place.rating ? place.rating.toFixed(1) : 'N/A';
    const reviewCount = place.user_ratings_total || 0;

    const contentString = `
      <div class="custom-info-window">
        ${photo ? `<img src="${photo}" alt="${place.name}" class="place-photo" />` : ''}
        <div class="place-content">
          <h3 class="place-name">${place.name}</h3>
          <div class="place-rating">
            <span class="rating-stars">${'★'.repeat(Math.floor(place.rating || 0))}${'☆'.repeat(5 - Math.floor(place.rating || 0))}</span>
            <span class="rating-text">${rating} (${reviewCount})</span>
          </div>
          <p class="place-address">${place.formatted_address || ''}</p>
          ${place.formatted_phone_number ? `<p class="place-phone">${place.formatted_phone_number}</p>` : ''}
          <div class="place-actions">
            <button class="favorite-btn ${isFavorite ? 'favorited' : ''}" onclick="toggleFavorite('${place.place_id}')">
              ${isFavorite ? '♥' : '♡'} ${isFavorite ? '已收藏' : '收藏'}
            </button>
            <button class="navigate-btn" onclick="openNavigation(${place.geometry.location.lat()}, ${place.geometry.location.lng()})">
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

    window.openNavigation = (lat, lng) => {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      window.open(url, '_blank');
    };
  }, [favorites, onFavoriteToggle]);

  // 清除所有標記
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(marker => {
      marker.setMap(null);
    });
    markersRef.current = [];
  }, []);

  // 載入 Google Maps API
  useEffect(() => {
    let isMounted = true;

    const loadMaps = async () => {
      try {
        await googleMapsLoader.load();
        if (isMounted) {
          initializeMap();
        }
      } catch (error) {
        console.error('Failed to load Google Maps:', error);
      }
    };

    loadMaps();

    return () => {
      isMounted = false;
    };
  }, [initializeMap]);

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