import React, { useState } from 'react';
import { IoLocateOutline, IoLocateSharp } from 'react-icons/io5';
import './LocationButton.css';

export default function LocationButton({ onLocationFound, onLocationError }) {
  const [isLocating, setIsLocating] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      onLocationError?.('您的瀏覽器不支援定位功能');
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setIsLocating(false);
        setHasLocation(true);
        
        onLocationFound?.({
          lat: latitude,
          lng: longitude
        });

        // 3秒後重置狀態
        setTimeout(() => {
          setHasLocation(false);
        }, 3000);
      },
      (error) => {
        setIsLocating(false);
        let errorMessage = '定位失敗';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = '定位權限被拒絕，請在瀏覽器設定中允許定位';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = '無法取得位置資訊';
            break;
          case error.TIMEOUT:
            errorMessage = '定位超時，請重試';
            break;
          default:
            errorMessage = '定位發生錯誤，請重試';
            break;
        }
        
        onLocationError?.(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000 // 使用1分鐘內的緩存位置
      }
    );
  };

  return (
    <button
      className={`location-button ${isLocating ? 'locating' : ''} ${hasLocation ? 'located' : ''}`}
      onClick={getCurrentLocation}
      disabled={isLocating}
      title={isLocating ? '定位中...' : hasLocation ? '已定位' : '定位到我的位置'}
    >
      <div className="location-icon-wrapper">
        {hasLocation ? (
          <IoLocateSharp className="location-icon" />
        ) : (
          <IoLocateOutline className="location-icon" />
        )}
        
        {isLocating && (
          <div className="location-pulse-ring"></div>
        )}
      </div>
      
      {/* 定位成功提示 */}
      {hasLocation && (
        <div className="location-success-indicator">
          <div className="success-dot"></div>
        </div>
      )}
    </button>
  );
}