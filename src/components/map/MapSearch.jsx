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

      if (!restaurants || restaurants.length === 0) {
        return [];
      }

      const searchLower = searchTerm.toLowerCase().trim();
      if (searchLower.length === 0) return [];

      const filtered = restaurants.filter(restaurant => {
        if (!restaurant) return false;

        // 分別檢查各個欄位
        const name = (restaurant.name || '').toLowerCase();
        const category = (restaurant.category || '').toLowerCase();

        // 處理 tags - 可能是陣列或字串
        let tags = '';
        if (Array.isArray(restaurant.tags)) {
          tags = restaurant.tags.filter(Boolean).join(' ').toLowerCase();
        } else if (restaurant.tags) {
          tags = restaurant.tags.toLowerCase();
        }

        // 檢查是否在 name, category, 或 tags 中找到關鍵字
        const foundInName = name.includes(searchLower);
        const foundInCategory = category.includes(searchLower);
        const foundInTags = tags.includes(searchLower);

        return foundInName || foundInCategory || foundInTags;
      });

      return filtered.slice(0, 10);
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

        if (searchTerm.length > 0) {
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
                // Google Places 搜尋 (using new Places API)
                new Promise(async (resolve, reject) => {
                  try {
                    // 檢查新版 Places API 是否可用
                    if (!window.google?.maps?.places) {
                      console.warn('Google Places API not available, skipping Google Places search');
                      resolve([]);
                      return;
                    }

                    // 使用新版 Places API
                    const { AutocompleteService } = await window.google.maps.importLibrary("places");

                    if (!AutocompleteService) {
                      console.warn('New AutocompleteService not available, using fallback');
                      resolve([]);
                      return;
                    }

                    const autocomplete = new AutocompleteService();
                    autocomplete.getPlacePredictions(
                      {
                        input: searchTerm,
                        componentRestrictions: { country: 'tw' },
                        types: ['restaurant', 'food', 'establishment'],
                        language: 'zh-TW'
                      },
                      (predictions, status) => {
                        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                          resolve(predictions.slice(0, 3));
                        } else if (status === window.google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
                          console.warn('Google Places API request denied - using database only');
                          resolve([]);
                        } else {
                          console.warn('Places API status:', status);
                          resolve([]);
                        }
                      }
                    );
                  } catch (error) {
                    console.warn('Google Places API error:', error);
                    resolve([]);
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

  const handleSuggestionClick = async (suggestion) => {
    try {
      // 檢查是否有 Google Places API 可用
      if (!window.google?.maps?.places) {
        console.warn('Google Places API not available for suggestion click');
        return;
      }

      // 使用新版 Places API
      const { PlacesService } = await window.google.maps.importLibrary("places");
      const placesService = new PlacesService(document.createElement('div'));

      placesService.getDetails(
        {
          placeId: suggestion.place_id,
          fields: ['name', 'geometry', 'formatted_address', 'place_id']
        },
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
      {(showSuggestions || showNoResults) && (suggestions.length > 0 || restaurantSuggestions.length > 0) && (
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
                    <div className="suggestion-details">
                      {restaurant.category && (
                        <span className="suggestion-category-tag">
                          {restaurant.category}
                        </span>
                      )}
                      {restaurant.rating && (
                        <span className="suggestion-rating">
                          ⭐ {restaurant.rating}
                        </span>
                      )}
                    </div>
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