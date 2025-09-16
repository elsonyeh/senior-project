// Google Maps API 單例載入器
class GoogleMapsLoader {
  constructor() {
    this.isLoaded = false;
    this.isLoading = false;
    this.callbacks = [];
    this.error = null;
  }

  // 載入 Google Maps API
  load() {
    return new Promise((resolve, reject) => {
      // 如果已經載入，直接返回
      if (this.isLoaded && window.google && window.google.maps) {
        resolve(window.google.maps);
        return;
      }

      // 如果有錯誤，拒絕
      if (this.error) {
        reject(this.error);
        return;
      }

      // 加入回調佇列
      this.callbacks.push({ resolve, reject });

      // 如果正在載入，等待
      if (this.isLoading) {
        return;
      }

      // 開始載入
      this.isLoading = true;

      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        const error = new Error('Google Maps API key not found');
        this.handleError(error);
        return;
      }

      // 檢查是否已經有 script 標籤
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        // 如果已經有 script 但還沒載入完成，等待載入
        this.waitForGoogleMaps();
        return;
      }

      // 創建 script 標籤 - 使用新版 Places API
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=maps,places&language=zh-TW&loading=async&v=weekly`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        this.waitForGoogleMaps();
      };

      script.onerror = (error) => {
        this.handleError(new Error('Failed to load Google Maps API'));
      };

      document.head.appendChild(script);
    });
  }

  // 等待 Google Maps API 完全載入
  waitForGoogleMaps() {
    const checkGoogleMaps = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        this.isLoaded = true;
        this.isLoading = false;
        this.resolveCallbacks(window.google.maps);
        // 發送全域事件
        window.dispatchEvent(new CustomEvent('googleMapsLoaded', { detail: window.google.maps }));
        window.googleMapsLoaded = true;
      } else {
        // 繼續等待
        setTimeout(checkGoogleMaps, 100);
      }
    };

    checkGoogleMaps();
  }

  // 處理錯誤
  handleError(error) {
    this.error = error;
    this.isLoading = false;
    this.callbacks.forEach(({ reject }) => reject(error));
    this.callbacks = [];
    console.error('Google Maps API loading error:', error);
  }

  // 解析所有回調
  resolveCallbacks(googleMaps) {
    this.callbacks.forEach(({ resolve }) => resolve(googleMaps));
    this.callbacks = [];
  }
}

// 創建單例實例
const googleMapsLoader = new GoogleMapsLoader();

export default googleMapsLoader;