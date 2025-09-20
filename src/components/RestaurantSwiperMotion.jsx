import React, { useState } from "react";
import CardStack from "./common/CardStack";
import "./SwiftTasteCard.css";

export default function RestaurantSwiperMotion({
  restaurants,
  onSave,
  onFinish,
  tutorialMode = false,
  onSingleSwipe,
  swipeDirection = "both",
}) {
  const [seen, setSeen] = useState([]);

  const handleSwipe = (dir, r) => {
    // 如果是教學模式，只處理單次滑動事件
    if (tutorialMode && onSingleSwipe) {
      onSingleSwipe(dir, r);
      return;
    }

    if (dir === "right") onSave?.(r);
    const newSeen = [...seen, r.id];
    setSeen(newSeen);
    if (newSeen.length === restaurants.length) {
      setTimeout(onFinish, 300);
    }
  };

  const renderCard = (r) => (
    <div className="restaurant-info-blur">
      <h3>{r.name || "未命名餐廳"}</h3>
      <p>{r.address || "地址未知"}</p>
      <small>{r.category || "類型不明"}</small>
      {typeof r.rating === "number" && r.rating > 0 && (
        <div className="restaurant-rating">⭐ {r.rating.toFixed(1)} 分</div>
      )}
      {r.tags && r.tags.length > 0 && (
        <div className="restaurant-tags">
          {r.tags.slice(0, 3).map((tag, index) => (
            <span key={index} className="tag">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );

  const background = (r) => {
    // 優先使用 primaryImage，然後是 allImages 中的第一張，最後是預設圖片
    let imageUrl = r.primaryImage?.image_url ||
                   (r.allImages && r.allImages.length > 0 ? r.allImages[0]?.image_url : null) ||
                   (r.restaurant_images && r.restaurant_images.length > 0 ? r.restaurant_images[0]?.image_url : null) ||
                   r.photoURL || // 支援舊格式
                   r.image_url || // 支援其他格式
                   r.photo || // 支援教學模式的格式
                   r.photos?.[0] || // 支援教學模式的格式
                   `https://source.unsplash.com/400x300/restaurant,food/?${r.name || 'restaurant'}`;

    // 確保 URL 有效
    if (!imageUrl || imageUrl === 'null') {
      imageUrl = `https://source.unsplash.com/400x300/restaurant,food/?${r.name || 'restaurant'}`;
    }

    // 添加除錯日誌
    console.log(`Restaurant ${r.name} background image:`, {
      primaryImage: r.primaryImage?.image_url,
      allImages: r.allImages?.length,
      photo: r.photo,
      photos: r.photos?.length,
      finalUrl: imageUrl
    });

    return {
      backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${imageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    };
  };

  return (
    <div
      className="restaurant-swiper-container"
      style={{ height: "70vh", position: "relative" }}
    >
      <CardStack
        cards={restaurants.filter((r) => r && r.id && !seen.includes(r.id))}
        onSwipe={handleSwipe}
        renderCard={renderCard}
        background={background}
        centered
        swipeDirection={swipeDirection}
      />
    </div>
  );
}
