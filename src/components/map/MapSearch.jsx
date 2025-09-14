import React, { useState, useRef, useEffect } from 'react';
import { IoSearchOutline, IoCloseOutline } from 'react-icons/io5';
import googleMapsLoader from '../../utils/googleMapsLoader';
import { restaurantService } from '../../services/restaurantService';
import './MapSearch.css';

export default function MapSearch({ onSearch, onLocationSelect, onRestaurantSelect }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [restaurantSuggestions, setRestaurantSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showNoResults, setShowNoResults] = useState(false);
  const searchInputRef = useRef(null);
  const suggestionsTimeoutRef = useRef(null);

  // 搜尋餐廳資料庫
  const searchRestaurantDatabase = async (searchTerm) => {
    try {
      const restaurants = await restaurantService.getRestaurants();

      const filtered = restaurants.filter(restaurant => {
        const name = restaurant.name?.toLowerCase() || '';
        const address = restaurant.address?.toLowerCase() || '';
        const category = restaurant.category?.toLowerCase() || '';
        const description = restaurant.description?.toLowerCase() || '';
        const tags = Array.isArray(restaurant.tags) ?
          restaurant.tags.join(' ').toLowerCase() :
          (restaurant.tags?.toLowerCase() || '');

        const searchLower = searchTerm.toLowerCase();

        // 擴展搜尋關鍵字匹配
        const searchTerms = searchLower.split(' ').filter(term => term.length > 0);

        return searchTerms.some(term => {
          return name.includes(term) ||
                 address.includes(term) ||
                 category.includes(term) ||
                 description.includes(term) ||
                 tags.includes(term) ||
                 // 特殊關鍵字映射
                 (term === '麵' && (
                   name.includes('麵') ||
                   name.includes('拉麵') ||
                   name.includes('麵條') ||
                   name.includes('麵食') ||
                   name.includes('noodle') ||
                   category.includes('麵') ||
                   tags.includes('麵') ||
                   tags.includes('拉麵') ||
                   tags.includes('麵食')
                 )) ||
                 (term === '飯' && (
                   name.includes('飯') ||
                   name.includes('米飯') ||
                   name.includes('炒飯') ||
                   name.includes('便當') ||
                   category.includes('飯') ||
                   tags.includes('飯')
                 )) ||
                 (term === '火鍋' && (
                   name.includes('火鍋') ||
                   name.includes('鍋物') ||
                   category.includes('火鍋') ||
                   tags.includes('火鍋')
                 ))
        });
      });

      console.log(`搜尋「${searchTerm}」找到 ${filtered.length} 間餐廳:`,
        filtered.map(r => r.name));

      return filtered.slice(0, 5); // 增加到 5 個結果
    } catch (error) {
      console.error('Error searching restaurant database:', error);
      return [];
    }
  };

  // Google Places Autocomplete
  useEffect(() => {
    let isMounted = true;

    const initAutocomplete = async () => {
      try {
        await googleMapsLoader.load();

        if (!isMounted || !window.google || !window.google.maps || !window.google.maps.places) return;

        if (searchTerm.length > 2) {
          // 清除之前的timeout
          if (suggestionsTimeoutRef.current) {
            clearTimeout(suggestionsTimeoutRef.current);
          }

          // 設置延遲搜索
          suggestionsTimeoutRef.current = setTimeout(async () => {
            if (!isMounted) return;

            try {
              // 同時搜尋 Google Places 和餐廳資料庫
              const [placePredictions, restaurantMatches] = await Promise.allSettled([
                // Google Places 搜尋 (with error handling for legacy API)
                new Promise((resolve, reject) => {
                  try {
                    if (!window.google.maps.places.AutocompleteService) {
                      console.warn('Google Places AutocompleteService not available, skipping Google Places search');
                      resolve([]);
                      return;
                    }

                    const autocomplete = new window.google.maps.places.AutocompleteService();
                    autocomplete.getPlacePredictions(
                      {
                        input: searchTerm,
                        componentRestrictions: { country: 'tw' },
                        types: ['restaurant', 'food', 'establishment'],
                        language: 'zh-TW'
                      },
                      (predictions, status) => {
                        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                          resolve(predictions.slice(0, 4)); // 減少 Google Places 結果為 4 個
                        } else if (status === window.google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
                          console.warn('Google Places API request denied - using database only');
                          resolve([]);
                        } else {
                          resolve([]);
                        }
                      }
                    );
                  } catch (error) {
                    console.warn('Google Places API error:', error);
                    resolve([]); // 如果 Google Places API 失敗，只使用資料庫搜尋
                  }
                }),
                // 餐廳資料庫搜尋
                searchRestaurantDatabase(searchTerm)
              ]);

              if (!isMounted) return;

              const googleResults = placePredictions.status === 'fulfilled' ? placePredictions.value : [];
              const dbResults = restaurantMatches.status === 'fulfilled' ? restaurantMatches.value : [];

              setSuggestions(googleResults);
              setRestaurantSuggestions(dbResults);

              // 檢查是否有搜尋結果
              const hasResults = googleResults.length > 0 || dbResults.length > 0;
              setShowSuggestions(hasResults);
              setShowNoResults(!hasResults);

            } catch (error) {
              console.error('Error in search:', error);
              if (isMounted) {
                setSuggestions([]);
                setRestaurantSuggestions([]);
                setShowSuggestions(false);
                setShowNoResults(true);
              }
            }
          }, 300);
        } else {
          setSuggestions([]);
          setRestaurantSuggestions([]);
          setShowSuggestions(false);
          setShowNoResults(false);
        }
      } catch (error) {
        console.error('Failed to load Google Maps for autocomplete:', error);
      }
    };

    // 初始檢查餐廳資料（開發用）
    const debugRestaurantData = async () => {
      if (import.meta.env.DEV) {
        try {
          const restaurants = await restaurantService.getRestaurants();
          console.log('餐廳資料庫總數:', restaurants.length);

          // 檢查包含「麵」的餐廳
          const noodleRestaurants = restaurants.filter(r =>
            r.name?.includes('麵') ||
            r.category?.includes('麵') ||
            (Array.isArray(r.tags) && r.tags.some(tag => tag?.includes('麵'))) ||
            (typeof r.tags === 'string' && r.tags.includes('麵'))
          );
          console.log('包含「麵」的餐廳:', noodleRestaurants.length, noodleRestaurants.map(r => r.name));

          // 詳細檢查前幾間餐廳的結構
          console.log('前5間餐廳的資料結構:');
          restaurants.slice(0, 5).forEach((r, i) => {
            console.log(`餐廳${i + 1}:`, {
              name: r.name,
              category: r.category,
              tags: r.tags,
              description: r.description
            });
          });

          // 檢查所有餐廳的標籤
          const allTags = restaurants.reduce((acc, r) => {
            if (r.tags) {
              if (Array.isArray(r.tags)) {
                acc.push(...r.tags);
              } else {
                acc.push(r.tags);
              }
            }
            return acc;
          }, []);
          console.log('所有標籤樣本:', [...new Set(allTags)].slice(0, 20));

        } catch (error) {
          console.error('Debug restaurant data failed:', error);
        }
      }
    };

    debugRestaurantData();
    initAutocomplete();

    return () => {
      isMounted = false;
    };
  }, [searchTerm]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      onSearch(searchTerm);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    try {
      // 檢查是否有 Google Places API 可用
      if (!window.google.maps.places?.PlacesService) {
        console.warn('Google Places API not available for suggestion click');
        return;
      }

      const placesService = new window.google.maps.places.PlacesService(document.createElement('div'));

      placesService.getDetails(
        { placeId: suggestion.place_id },
        (place, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && place.geometry) {
            setSearchTerm(suggestion.description);
            setShowSuggestions(false);
            setShowNoResults(false);
            onLocationSelect({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
              name: place.name,
              address: place.formatted_address
            });
          } else if (status === window.google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
            console.warn('Google Places API request denied for suggestion details');
          } else {
            console.warn('Failed to get place details:', status);
          }
        }
      );
    } catch (error) {
      console.error('Error in handleSuggestionClick:', error);
    }
  };

  const handleRestaurantClick = (restaurant) => {
    setSearchTerm(restaurant.name);
    setShowSuggestions(false);
    setShowNoResults(false);

    // 將餐廳位置傳遞給地圖
    if (restaurant.latitude && restaurant.longitude) {
      onLocationSelect({
        lat: restaurant.latitude,
        lng: restaurant.longitude,
        name: restaurant.name,
        address: restaurant.address
      });
    }

    // 如果有餐廳選擇回調，調用它
    if (onRestaurantSelect) {
      onRestaurantSelect(restaurant);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSuggestions([]);
    setRestaurantSuggestions([]);
    setShowSuggestions(false);
    setShowNoResults(false);
    searchInputRef.current?.focus();
  };

  // 點擊外部關閉建議
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchInputRef.current && !searchInputRef.current.closest('.map-search-container').contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (suggestionsTimeoutRef.current) {
        clearTimeout(suggestionsTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="map-search-container">
      <form onSubmit={handleSearch} className="map-search-form">
        <div className="search-input-wrapper">
          <IoSearchOutline className="search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜尋餐廳、地點..."
            className="search-input"
            onFocus={() => setShowSuggestions(suggestions.length > 0)}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={clearSearch}
              className="clear-search-btn"
              aria-label="清除搜尋"
            >
              <IoCloseOutline />
            </button>
          )}
        </div>
      </form>

      {/* 搜尋建議 */}
      {showSuggestions && (suggestions.length > 0 || restaurantSuggestions.length > 0) && (
        <div className="search-suggestions">
          {/* 餐廳資料庫結果 */}
          {restaurantSuggestions.length > 0 && (
            <>
              <div className="suggestion-category">已儲存餐廳</div>
              {restaurantSuggestions.map((restaurant, index) => (
                <div
                  key={restaurant.id || `restaurant-${index}`}
                  className="suggestion-item restaurant-item"
                  onClick={() => handleRestaurantClick(restaurant)}
                >
                  <div className="restaurant-icon">🍽️</div>
                  <div className="suggestion-text">
                    <div className="suggestion-name">
                      {restaurant.name}
                    </div>
                    <div className="suggestion-address">
                      {restaurant.address}
                    </div>
                    {restaurant.rating && (
                      <div className="suggestion-rating">
                        ⭐ {restaurant.rating}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Google Places 結果 */}
          {suggestions.length > 0 && (
            <>
              {restaurantSuggestions.length > 0 && <div className="suggestion-divider"></div>}
              <div className="suggestion-category">附近地點</div>
              {suggestions.map((suggestion, index) => (
                <div
                  key={suggestion.place_id || index}
                  className="suggestion-item"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <IoSearchOutline className="suggestion-icon" />
                  <div className="suggestion-text">
                    <div className="suggestion-name">
                      {suggestion.structured_formatting.main_text}
                    </div>
                    <div className="suggestion-address">
                      {suggestion.structured_formatting.secondary_text}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* 無搜尋結果 */}
      {showNoResults && searchTerm.length > 2 && (
        <div className="search-suggestions">
          <div className="no-results">
            <div className="no-results-icon">🔍</div>
            <div className="no-results-text">
              沒有找到「{searchTerm}」相關的餐廳或地點
            </div>
            <div className="no-results-hint">
              試試其他關鍵字或檢查拼字
            </div>
          </div>
        </div>
      )}
    </div>
  );
}