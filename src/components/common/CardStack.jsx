import React, { useState } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform
} from "framer-motion";
import "../SwiftTasteCard.css";

export default function CardStack({ cards, onSwipe, renderCard, background, centered }) {
  const [visibleCards, setVisibleCards] = useState(cards);

  const handleSwipe = (dir, item) => {
    const remaining = visibleCards.filter((c) => c.id !== item.id);
    setVisibleCards(remaining);
    onSwipe?.(dir, item);
  };

  return (
    <div className="motion-swiper-container">
      <AnimatePresence mode="popLayout">
        {visibleCards.slice(0, 3).reverse().map((item, index, arr) => {
          const position = arr.length - index - 1;
          return (
            <SwipeableCard
              key={item.id}
              item={item}
              position={position}
              onSwipe={handleSwipe}
              render={renderCard}
              background={background?.(item)}
              isRestaurant={Boolean(background)}
              centered={centered}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function SwipeableCard({ item, position, onSwipe, render, background, isRestaurant, centered }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-20, 20]);
  const likeOpacity = useTransform(x, [30, 80], [0, 1]);
  const nopeOpacity = useTransform(x, [-80, -30], [1, 0]);

  const isTop = position === 0;   // Top card
  const topOffset = position * 18 + 20;     // 每張下移 14px
  const scaleOffset = 1 - position * 0.04;      // 每張略縮小 4%
  const blur = position > 0 ? 3 * position : 0;     // Blur effect for cards below the top card

  return (
    <motion.div
      className={`motion-card ${isRestaurant ? 'restaurant-card' : ''} ${centered ? 'centered' : ''}`}
      style={{
        position: "absolute",
        x,
        rotate,
        zIndex: 10 - position,
        top: topOffset,
        scale: scaleOffset,
        backgroundImage: background || undefined,
        filter: blur ? `blur(${blur}px)` : "none",
        boxShadow: isTop
          ? "0 12px 28px rgba(0,0,0,0.25)"
          : "0 4px 12px rgba(0,0,0,0.1)"
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(e, info) => {
        if (info.offset.x > 80) {
          onSwipe("right", item);
        } else if (info.offset.x < -80) {
          onSwipe("left", item);
        }
      }}
      initial={{ opacity: 0, scale: scaleOffset }}
      animate={{ opacity: 1, scale: scaleOffset }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {render(item)}

      <motion.div className="badge like" style={{ opacity: likeOpacity }}>
        👍 喜歡
      </motion.div>

      <motion.div className="badge nope" style={{ opacity: nopeOpacity }}>
        👎 不喜歡
      </motion.div>
    </motion.div>
  );
}
