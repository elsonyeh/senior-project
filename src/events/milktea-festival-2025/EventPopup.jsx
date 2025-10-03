import { useState, useEffect } from 'react';
import './EventPopup.css';
import posterImage from './poster.jpg';

const EventPopup = () => {
  const [isVisible, setIsVisible] = useState(false);
  const POPUP_INTERVAL = 30 * 60 * 1000; // 30分鐘
  const STORAGE_KEY = 'milktea_festival_last_shown';
  const ENABLE_TESTING = true; // 測試模式：改為 false 恢復正常

  useEffect(() => {
    const checkAndShowPopup = () => {
      // 測試模式：每次刷新都顯示
      if (ENABLE_TESTING) {
        setIsVisible(true);
        return;
      }

      // 正常模式：30分鐘顯示一次
      const lastShown = localStorage.getItem(STORAGE_KEY);
      const now = Date.now();

      if (!lastShown || now - parseInt(lastShown) >= POPUP_INTERVAL) {
        setIsVisible(true);
        localStorage.setItem(STORAGE_KEY, now.toString());
      }
    };

    // 初次檢查
    checkAndShowPopup();

    // 設定定時檢查（每30分鐘）
    const intervalId = setInterval(checkAndShowPopup, POPUP_INTERVAL);

    return () => clearInterval(intervalId);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="event-popup-overlay" onClick={handleClose}>
      <div className="event-popup-content" onClick={(e) => e.stopPropagation()}>
        <button className="event-popup-close" onClick={handleClose}>
          ✕
        </button>
        <img
          src={posterImage}
          alt="鹽埕奶茶節活動海報"
          className="event-popup-poster"
        />
      </div>
    </div>
  );
};

export default EventPopup;
