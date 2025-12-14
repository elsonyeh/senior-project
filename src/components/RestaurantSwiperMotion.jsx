import React, { useState, useEffect } from "react";
import { IoHeartOutline, IoHeart } from "react-icons/io5";
import CardStack from "./common/CardStack";
import "./SwiftTasteCard.css";

export default function RestaurantSwiperMotion({
  restaurants,
  onSave,
  onFinish,
  tutorialMode = false,
  onSingleSwipe,
  swipeDirection = "both",
  onNoResults, // 新增：當沒有結果時的回調
  onDislike, // 新增：左滑時的回調
  onSwipe, // 新增：滑動時的回調（用於重置計時器）
  onLike, // 新增：點擊收藏按鈕的回調
  currentUser, // 新增：當前用戶信息
  likedRestaurants = new Set(), // 新增：已收藏的餐廳集合
  likedVersion = 0, // 新增：用於強制重新渲染
}) {
  const [seen, setSeen] = useState([]);
  const [saved, setSaved] = useState([]);
  const [disliked, setDisliked] = useState([]);
  const [renderKey, setRenderKey] = useState(0);

  // 監聽 likedVersion 變化，強制重新渲染
  useEffect(() => {
    setRenderKey(prev => prev + 1);
  }, [likedVersion]);

  const handleSwipe = (dir, r) => {
    // 觸發 onSwipe 回調（用於重置計時器）
    onSwipe?.(dir, r);

    // 如果是教學模式，只處理單次滑動事件
    if (tutorialMode && onSingleSwipe) {
      onSingleSwipe(dir, r);
      return;
    }

    const newSeen = [...seen, r.id];
    setSeen(newSeen);

    if (dir === "right") {
      onSave?.(r);
      setSaved(prev => [...prev, r]);
    } else if (dir === "left") {
      onDislike?.(r);
      setDisliked(prev => [...prev, r]);
    }

    console.log(`🍽️ Restaurant swiped: ${newSeen.length}/${restaurants.length} completed`);

    // 檢查是否所有餐廳都被看完
    if (newSeen.length === restaurants.length) {
      console.log("✅ All restaurants viewed, calling onFinish in 300ms");
      setTimeout(() => {
        // 保持原有行為：總是調用 onFinish，讓結果頁面處理無結果的情況
        console.log("📞 Calling onFinish now");
        onFinish?.();
      }, 300);
    }
  };

  const handleLikeClick = (e, restaurant) => {
    e.stopPropagation(); // 防止觸發卡片滑動
    if (onLike) {
      onLike(restaurant);
    }
  };

  const renderCard = (r) => {
    // 檢查此餐廳是否已收藏
    const isLiked = likedRestaurants.has(r.id);
    console.log(`🎨 Rendering card for ${r.name}, isLiked: ${isLiked}, likedVersion: ${likedVersion}, renderKey: ${renderKey}`);

    return (
      <div className="restaurant-info-blur">
        {/* 收藏按鈕 - 只在用戶登入時顯示 */}
        {onLike && currentUser && (
          <button
            className={`restaurant-like-button ${isLiked ? 'liked' : ''}`}
            onClick={(e) => handleLikeClick(e, r)}
            title={isLiked ? "取消收藏" : "加入收藏"}
          >
            {isLiked ? (
              <IoHeart className="heart-icon filled" />
            ) : (
              <IoHeartOutline className="heart-icon" />
            )}
          </button>
        )}

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
  };

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
