import React, { useState } from 'react';
import { IoLocateOutline, IoLocateSharp } from 'react-icons/io5';
import './LocationButton.css';

export default function LocationButton({ onLocationFound, onLocationError, onRelocate }) {
  const [isLocating, setIsLocating] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const [isRelocating, setIsRelocating] = useState(false);

  const getCurrentLocation = (forceRelocate = false) => {
    if (!navigator.geolocation) {
      onLocationError?.('您的瀏覽器不支援定位功能');
      return;
    }

    if (forceRelocate) {
      setIsRelocating(true);
    } else {
      setIsLocating(true);
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setIsLocating(false);
        setIsRelocating(false);
        setHasLocation(true);

        if (forceRelocate) {
          onRelocate?.({
            lat: latitude,
            lng: longitude
          });
        } else {
          onLocationFound?.({
            lat: latitude,
            lng: longitude
          });
        }

        // 2秒後重置狀態
        setTimeout(() => {
          setHasLocation(false);
        }, 2000);
      },
      (error) => {
        setIsLocating(false);
        setIsRelocating(false);
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
        maximumAge: forceRelocate ? 0 : 60000 // 重新定位時不使用緩存
      }
    );
  };

  return (
    <button
      className={`location-button ${isLocating ? 'locating' : ''} ${isRelocating ? 'relocating' : ''} ${hasLocation ? 'location-found' : ''}`}
      onClick={() => hasLocation ? getCurrentLocation(true) : getCurrentLocation(false)}
      disabled={isLocating || isRelocating}
      title={isLocating ? '定位中...' : isRelocating ? '重新定位中...' : hasLocation ? '重新定位' : '定位到我的位置'}
    >
      <div className="location-icon-wrapper">
        {hasLocation ? (
          <IoLocateSharp className="location-icon" />
        ) : (
          <IoLocateOutline className="location-icon" />
        )}
        
        {(isLocating || isRelocating) && (
          <>
            <div className={`location-pulse-ring ${isRelocating ? 'relocating-ring' : ''}`}></div>
            <div className={`location-pulse-ring ${isRelocating ? 'relocating-ring' : ''}`}></div>
            <div className={`location-pulse-ring ${isRelocating ? 'relocating-ring' : ''}`}></div>
            <div className={`location-pulse-ring ${isRelocating ? 'relocating-ring' : ''}`}></div>
          </>
        )}
      </div>
      
    </button>
  );
}