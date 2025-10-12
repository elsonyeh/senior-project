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

  // 位置平滑算法 - 使用加權移動平均，過濾低精確度樣本
  const smoothPosition = (newLat, newLng, accuracy) => {
    positionHistoryRef.current.push({ lat: newLat, lng: newLng, accuracy, time: Date.now() });

    // 只保留最近5個位置
    if (positionHistoryRef.current.length > 5) {
      positionHistoryRef.current.shift();
    }

    // 過濾掉精確度太差的樣本（>100m），這些通常是 GPS 冷啟動的不準確位置
    const validSamples = positionHistoryRef.current.filter(pos => pos.accuracy <= 100);

    // 如果沒有有效樣本，使用當前位置
    if (validSamples.length === 0) {
      return { lat: newLat, lng: newLng };
    }

    // 如果只有一個有效位置，直接返回
    if (validSamples.length === 1) {
      return { lat: validSamples[0].lat, lng: validSamples[0].lng };
    }

    // 使用加權平均（精確度越高權重越大）
    let totalWeight = 0;
    let weightedLat = 0;
    let weightedLng = 0;

    validSamples.forEach((pos) => {
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
    let goodSampleCount = 0; // 精確度良好的樣本數（<50m）
    const maxSamples = 8; // 增加到8個樣本
    const minAccuracy = 15; // 目標精確度15米
    const goodAccuracy = 50; // 良好精確度50米

    // 清除之前的監聽
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        sampleCount++;

        // 計算良好樣本數
        if (accuracy <= goodAccuracy) {
          goodSampleCount++;
        }

        console.log(`📍 位置樣本 ${sampleCount}/${maxSamples}:`, {
          lat: latitude.toFixed(6),
          lng: longitude.toFixed(6),
          accuracy: `${accuracy.toFixed(1)}m`,
          status: accuracy > 100 ? '❌ 太差，忽略' : accuracy <= 30 ? '✅ 優秀' : '⚠️ 可接受'
        });

        // 記錄最佳精確度
        if (accuracy < bestAccuracy) {
          bestAccuracy = accuracy;
        }

        // 使用平滑算法
        const smoothedPos = smoothPosition(latitude, longitude, accuracy);

        // 當達到以下任一條件時停止：
        // 1. 達到目標精確度（15m）
        // 2. 收集足夠良好樣本（至少4個 <50m 的樣本）
        // 3. 達到最大樣本數
        // 4. 精確度很好（<25米）且有至少3個良好樣本
        const shouldStop =
          accuracy <= minAccuracy ||
          goodSampleCount >= 4 ||
          sampleCount >= maxSamples ||
          (accuracy <= 25 && goodSampleCount >= 3);

        if (shouldStop) {
          // 停止監聽
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }

          setIsLocating(false);
          setIsRelocating(false);
          setHasLocation(true);

          console.log(`✅ 定位完成！`, {
            最佳精確度: `${bestAccuracy.toFixed(1)}m`,
            總樣本數: sampleCount,
            良好樣本數: goodSampleCount,
            最終位置: `${smoothedPos.lat.toFixed(6)}, ${smoothedPos.lng.toFixed(6)}`
          });

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