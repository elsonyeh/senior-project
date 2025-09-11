import React, { useState, useRef, useEffect } from 'react';
import { IoSearchOutline, IoCloseOutline } from 'react-icons/io5';
import './MapSearch.css';

export default function MapSearch({ onSearch, onLocationSelect }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef(null);
  const suggestionsTimeoutRef = useRef(null);

  // Google Places Autocomplete
  useEffect(() => {
    const initAutocomplete = () => {
      if (!window.google || !window.google.maps || !window.google.maps.places) return;
      
      if (searchTerm.length > 2) {
        // 清除之前的timeout
        if (suggestionsTimeoutRef.current) {
          clearTimeout(suggestionsTimeoutRef.current);
        }
        
        // 設置延遲搜索
        suggestionsTimeoutRef.current = setTimeout(() => {
          try {
            const autocomplete = new window.google.maps.places.AutocompleteService();
            autocomplete.getPlacePredictions(
              {
                input: searchTerm,
                componentRestrictions: { country: 'tw' }, // 限制在台灣
                types: ['restaurant', 'food', 'establishment'] // 優先顯示餐廳
              },
              (predictions, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                  setSuggestions(predictions.slice(0, 6)); // 限制顯示6個建議
                  setShowSuggestions(true);
                } else {
                  setSuggestions([]);
                  setShowSuggestions(false);
                }
              }
            );
          } catch (error) {
            console.error('Error getting place predictions:', error);
            setSuggestions([]);
            setShowSuggestions(false);
          }
        }, 300); // 300ms延遲
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };

    if (window.googleMapsLoaded) {
      initAutocomplete();
    } else {
      const handleMapsLoaded = () => {
        initAutocomplete();
      };
      window.addEventListener('googleMapsLoaded', handleMapsLoaded);
      return () => window.removeEventListener('googleMapsLoaded', handleMapsLoaded);
    }
  }, [searchTerm]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      onSearch(searchTerm);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    const placesService = new window.google.maps.places.PlacesService(document.createElement('div'));
    
    placesService.getDetails(
      { placeId: suggestion.place_id },
      (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place.geometry) {
          setSearchTerm(suggestion.description);
          setShowSuggestions(false);
          onLocationSelect({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            name: place.name,
            address: place.formatted_address
          });
        }
      }
    );
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSuggestions([]);
    setShowSuggestions(false);
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
      {showSuggestions && suggestions.length > 0 && (
        <div className="search-suggestions">
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
        </div>
      )}
    </div>
  );
}