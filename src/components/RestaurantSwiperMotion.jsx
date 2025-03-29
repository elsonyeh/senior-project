import React, { useState } from "react";
import "./SwiftTasteCard.css";
import {
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
} from "framer-motion";

export default function RestaurantSwiperMotion({ restaurants, onSave }) {
  const [cards, setCards] = useState(restaurants);

  const handleSwipe = (direction, restaurant) => {
    if (direction === "right") {
      onSave(restaurant);
    }

    setCards((prevCards) => prevCards.filter((r) => r.id !== restaurant.id));
  };

  return (
    <div className="motion-swiper-container">
      <AnimatePresence mode="wait">
        {cards.slice(0, 1).map((restaurant) => (
          <SwipeRestaurantCard
            key={restaurant.id}
            restaurant={restaurant}
            onSwipe={handleSwipe}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function SwipeRestaurantCard({ restaurant, onSwipe }) {
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

  return (
    <motion.div
      className="motion-card"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      initial={{ x: 0, opacity: 0, scale: 0.95 }} // ✅ 不偏移、輕微縮小
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ duration: 0.25, ease: "easeOut" }} // ✅ 顯示更快
    >
      <h3>{restaurant.name}</h3>
      <p>{restaurant.description}</p>
      <small>
        {restaurant.type} | {restaurant.vibe} | {restaurant.price}
      </small>

      <motion.div className="badge like" style={{ opacity: likeOpacity }}>
        👍 收藏
      </motion.div>

      <motion.div className="badge nope" style={{ opacity: nopeOpacity }}>
        👎 略過
      </motion.div>
    </motion.div>
  );
}
