import React, { useState, useEffect } from "react";
import "./SwiftTasteCard.css";
import {
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
} from "framer-motion";

export default function RestaurantSwiperMotion({ restaurants, onSave, onFinish }) {
  const [cards, setCards] = useState([]);

  useEffect(() => {
    if (Array.isArray(restaurants)) {
      // 過濾掉無效或缺 id 的資料
      const validRestaurants = restaurants.filter(r => r && r.id);
      setCards(validRestaurants);
    } else {
      setCards([]);
    }
  }, [restaurants]);

  const handleSwipe = (direction, restaurant) => {
    if (direction === "right") {
      onSave?.(restaurant);
    }

    const remaining = cards.filter((r) => r.id !== restaurant.id);
    setCards(remaining);

    if (remaining.length === 0 && onFinish) {
      setTimeout(() => onFinish(), 400);
    }
  };

  if (!Array.isArray(restaurants)) {
    return <div className="motion-swiper-container">餐廳資料未準備好</div>;
  }

  return (
    <div className="motion-swiper-container">
      <AnimatePresence mode="wait">
        {cards.length > 0 ? (
          cards.slice(0, 1).map((restaurant) =>
            restaurant && typeof restaurant === "object" ? (
              <SwipeRestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                onSwipe={handleSwipe}
              />
            ) : null
          )
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SwipeRestaurantCard({ restaurant, onSwipe }) {
  if (!restaurant || typeof restaurant !== "object") {
    return null;
  }

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-20, 20]);
  const likeOpacity = useTransform(x, [50, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-150, -50], [1, 0]);

  const handleDragEnd = (event, info) => {
    if (info.offset.x > 150) {
      onSwipe("right", restaurant);
    } else if (info.offset.x < -150) {
      onSwipe("left", restaurant);
    }
  };

  const fallbackURL = "https://source.unsplash.com/400x300/?restaurant";
  const backgroundImage = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${restaurant.photoURL || fallbackURL})`;

  return (
    <motion.div
      className="motion-card restaurant-card"
      style={{ x, rotate, backgroundImage }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      initial={{ x: 0, opacity: 0, scale: 0.95 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div className="restaurant-overlay">
        <h3>{restaurant.name || "未命名餐廳"}</h3>
        <p>{restaurant.address || "地址未知"}</p>
        <small>{restaurant.type || "類型不明"}</small>
        {typeof restaurant.rating === "number" && (
          <div className="restaurant-rating">⭐ {restaurant.rating.toFixed(1)} 分</div>
        )}
      </div>

      <motion.div className="badge like" style={{ opacity: likeOpacity }}>
        👍 收藏
      </motion.div>

      <motion.div className="badge nope" style={{ opacity: nopeOpacity }}>
        👎 略過
      </motion.div>
    </motion.div>
  );
}
