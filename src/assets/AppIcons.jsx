// AppIcons.jsx
// 這個檔案包含所有從公共資料夾載入的圖標組件
import React from 'react';

// 應用 Logo
export const AppLogo = ({ size = 100, className = '' }) => (
  <div className={`app-logo-container ${className}`} style={{ width: size, height: size }}>
    <img 
      src="/images/Salt-Summer-Icon/logo.png"
      alt="來這好呷 Logo" 
      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
    />
  </div>
);

// 飲料相關圖標
// 啤酒
export const BeerIcon = ({ size = 40, className = '' }) => (
  <div className={`food-icon ${className}`} style={{ width: size, height: size }}>
    <img 
      src="/images/Salt-Summer-Icon/Beer.png"
      alt="啤酒" 
      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
    />
  </div>
);

// 酒瓶
export const BottleIcon = ({ size = 40, className = '' }) => (
  <div className={`food-icon ${className}`} style={{ width: size, height: size }}>
    <img 
      src="/images/Salt-Summer-Icon/Bottle.png"
      alt="酒瓶" 
      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
    />
  </div>
);

// 咖啡/茶
export const CoffeeIcon = ({ size = 40, className = '' }) => (
  <div className={`food-icon ${className}`} style={{ width: size, height: size }}>
    <img 
      src="/images/Salt-Summer-Icon/Coffee.png"
      alt="咖啡" 
      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
    />
  </div>
);

// 餐廳類型圖標
// 貓咪茶杯/植物茶
export const TeacupHerbCatIcon = ({ size = 40, className = '' }) => (
  <div className={`restaurant-icon ${className}`} style={{ width: size, height: size }}>
    <img 
      src="/images/Salt-Summer-Icon/Teacup-Herb-Cat.png"
      alt="植物茶" 
      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
    />
  </div>
);

// 角色圖標
// 拿筷子的小貓
export const ChopstickCatIcon = ({ size = 40, className = '' }) => (
  <div className={`character-icon ${className}`} style={{ width: size, height: size }}>
    <img 
      src="/images/Salt-Summer-Icon/Chopstick-Cat.png"
      alt="拿筷子的小貓" 
      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
    />
  </div>
);

// 小兔子/貓
export const PunchableCatIcon = ({ size = 40, className = '' }) => (
  <div className={`character-icon ${className}`} style={{ width: size, height: size }}>
    <img 
      src="/images/Salt-Summer-Icon/Punchable-Cat.png"
      alt="可愛小貓" 
      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
    />
  </div>
);

// 背景圖案
export const BackgroundPattern = ({className = '', opacity = 0.15 }) => (
    <div 
      className={`background-pattern ${className}`} 
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        zIndex: 0,
        backgroundImage: `url(/images/Salt-Summer-Icon/Salt-Summer-Background.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* 使用背景圖片樣式而非 img 標籤 */}
    </div>
  );

// 問題相關圖標
export const QuestionIcon = ({ type = 'default', size = 40, className = '' }) => (
  <div className={`question-icon ${className}`} style={{ width: size, height: size }}>
    <img 
      src={`/images/Salt-Summer-Icon/Coffee.png`} // 使用咖啡圖標作為問題圖標
      alt="問題圖標" 
      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
    />
  </div>
);

// 徽章圖標 - 用於滑動的「收藏」和「跳過」
export const SaveBadgeIcon = ({ size = 40, className = '' }) => (
  <div className={`badge-icon ${className}`} style={{ width: size, height: size }}>
    <img 
      src="/images/Salt-Summer-Icon/badge-save.png"
      alt="收藏徽章" 
      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
    />
  </div>
);

export const SkipBadgeIcon = ({ size = 40, className = '' }) => (
  <div className={`badge-icon ${className}`} style={{ width: size, height: size }}>
    <img 
      src="/images/Salt-Summer-Icon/badge-skip.png"
      alt="跳過徽章" 
      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
    />
  </div>
);

// 創建一個通用的圖標加載器 - 用於動態載入非固定的圖示
export const CustomIcon = ({ src, alt, size = 40, className = '', style = {} }) => (
  <div className={`custom-icon ${className}`} style={{ width: size, height: size, ...style }}>
    <img 
      src={src} 
      alt={alt || '圖標'} 
      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
    />
  </div>
);