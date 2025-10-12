import React, { useState, useRef, useEffect } from 'react';
import { IoLocateOutline, IoLocateSharp } from 'react-icons/io5';
import './LocationButton.css';

export default function LocationButton({ onLocationFound, onLocationError, onRelocate }) {
  const [isLocating, setIsLocating] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const [isRelocating, setIsRelocating] = useState(false);
  const watchIdRef = useRef(null);
  const positionHistoryRef = useRef([]);

  // 清理函數：組件卸載時停止監聽
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  // 位置平滑算法 - 使用加權移動平均
  const smoothPosition = (newLat, newLng, accuracy) => {
    positionHistoryRef.current.push({ lat: newLat, lng: newLng, accuracy, time: Date.now() });

    // 只保留最近5個位置
    if (positionHistoryRef.current.length > 5) {
      positionHistoryRef.current.shift();
    }

    // 如果只有一個位置，直接返回
    if (positionHistoryRef.current.length === 1) {
      return { lat: newLat, lng: newLng };
    }

    // 使用加權平均（精確度越高權重越大）
    let totalWeight = 0;
    let weightedLat = 0;
    let weightedLng = 0;

    positionHistoryRef.current.forEach((pos) => {
      // 權重 = 1 / 精確度 (精確度越低數字越大，所以倒數)
      const weight = 1 / (pos.accuracy || 50);
      totalWeight += weight;
      weightedLat += pos.lat * weight;
      weightedLng += pos.lng * weight;
    });

    return {
      lat: weightedLat / totalWeight,
      lng: weightedLng / totalWeight
    };
  };

  // 使用連續定位來提高精確度
  const getCurrentLocationWithWatch = (forceRelocate = false) => {
    if (!navigator.geolocation) {
      onLocationError?.('您的瀏覽器不支援定位功能');
      return;
    }

    if (forceRelocate) {
      setIsRelocating(true);
    } else {
      setIsLocating(true);
    }

    // 清空歷史記錄
    positionHistoryRef.current = [];

    let bestAccuracy = Infinity;
    let sampleCount = 0;
    const maxSamples = 5; // 收集5個樣本
    const minAccuracy = 20; // 目標精確度20米

    // 清除之前的監聽
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        sampleCount++;

        console.log(`📍 位置樣本 ${sampleCount}:`, {
          lat: latitude.toFixed(6),
          lng: longitude.toFixed(6),
          accuracy: `${accuracy.toFixed(1)}m`
        });

        // 記錄最佳精確度
        if (accuracy < bestAccuracy) {
          bestAccuracy = accuracy;
        }

        // 使用平滑算法
        const smoothedPos = smoothPosition(latitude, longitude, accuracy);

        // 當達到以下任一條件時停止：
        // 1. 達到目標精確度
        // 2. 收集足夠樣本
        // 3. 精確度已經很好（<30米）且有至少3個樣本
        const shouldStop =
          accuracy <= minAccuracy ||
          sampleCount >= maxSamples ||
          (accuracy <= 30 && sampleCount >= 3);

        if (shouldStop) {
          // 停止監聽
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }

          setIsLocating(false);
          setIsRelocating(false);
          setHasLocation(true);

          console.log(`✅ 定位完成！最佳精確度: ${bestAccuracy.toFixed(1)}m`);

          const finalLocation = {
            lat: smoothedPos.lat,
            lng: smoothedPos.lng,
            accuracy: bestAccuracy
          };

          if (forceRelocate) {
            onRelocate?.(finalLocation);
          } else {
            onLocationFound?.(finalLocation);
          }

          // 2秒後重置狀態
          setTimeout(() => {
            setHasLocation(false);
          }, 2000);
        }
      },
      (error) => {
        // 清除監聽
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }

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
        timeout: 20000, // 增加到20秒
        maximumAge: 0
      }
    );
  };

  const getCurrentLocation = getCurrentLocationWithWatch;

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