import React, { useState } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
} from "framer-motion";
import "../SwiftTasteCard.css";

export default function CardStack({
  cards,
  onSwipe,
  onLocalSwipe,
  renderCard,
  background,
  centered,
  badgeType = "like-nope",
}) {
  const [visibleCards, setVisibleCards] = useState(cards);

  return (
    <div className="motion-swiper-container">
      <AnimatePresence mode="popLayout">
        {visibleCards
          .slice(0, 3)
          .reverse()
          .map((item, index, arr) => {
            const position = arr.length - index - 1;
            return (
              <SwipeableCard
                key={item.id}
                item={item}
                position={position}
                onSwipe={(dir, item) => {
                  const remaining = visibleCards.filter(
                    (c) => c.id !== item.id
                  );
                  setVisibleCards(remaining);
                  onSwipe?.(dir, item);
                }}
                onLocalSwipe={onLocalSwipe}
                render={renderCard}
                background={background?.(item)}
                isRestaurant={Boolean(background)}
                centered={centered}
                badgeType={badgeType}
              />
            );
          })}
      </AnimatePresence>
    </div>
  );
}

function SwipeableCard({
  item,
  position,
  onSwipe,
  onLocalSwipe,
  render,
  background,
  isRestaurant,
  centered,
  badgeType,
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-20, 20]);
  const likeOpacity = useTransform(x, [30, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, -30], [1, 0]);
  const likeScale = useTransform(x, [30, 100], [0.95, 1.1]);
  const nopeScale = useTransform(x, [-100, -30], [1.1, 0.95]);

  // 從x值轉換出箭頭的透明度，實現更流暢的視覺反饋
  const leftArrowOpacity = useTransform(x, [-100, -30, 0], [1, 0.7, 0.4]);
  const rightArrowOpacity = useTransform(x, [0, 30, 100], [0.4, 0.7, 1]);

  const isTop = position === 0;
  const topOffset = position * 18 + 20;
  const scaleOffset = 1 - position * 0.04;
  const blur = position > 0 ? 3 * position : 0;

  // 處理拖拽中的狀態更新
  const handleDrag = (_, info) => {
    // 當右滑超過30px時，觸發本地樣式變化
    if (info.offset.x > 30) {
      onLocalSwipe?.("right", item);
    } 
    // 當左滑超過30px時，觸發本地樣式變化
    else if (info.offset.x < -30) {
      onLocalSwipe?.("left", item);
    }
  };

  return (
    <motion.div
      className={`motion-card ${isRestaurant ? "restaurant-card" : ""} ${
        centered ? "centered" : ""
      }`}
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
          : "0 4px 12px rgba(0,0,0,0.1)",
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDrag={handleDrag}
      onDragEnd={(e, info) => {
        if (info.offset.x > 80) {
          onLocalSwipe?.("right", item);
          onSwipe("right", item);
        } else if (info.offset.x < -80) {
          onLocalSwipe?.("left", item);
          onSwipe("left", item);
        } else {
          // 如果滑動距離不夠，重置本地樣式
          onLocalSwipe?.("reset", item);
        }
      }}
      initial={{ opacity: 0, scale: scaleOffset }}
      animate={{ opacity: 1, scale: scaleOffset }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {render(item)}
      
      {isTop && badgeType === "like-nope" && (
        <>
          <motion.div
            className="badge like"
            style={{ opacity: likeOpacity, scale: likeScale }}
          >
            喜歡
          </motion.div>
          <motion.div
            className="badge nope"
            style={{ opacity: nopeOpacity, scale: nopeScale }}
          >
            下一個
          </motion.div>
        </>
      )}
      
      {isTop && (
        <div className="swipe-arrows-container">
          {/* 左邊箭頭指示 */}
          <motion.div 
            className="swipe-arrow-indicator left"
            style={{ opacity: leftArrowOpacity }}
          >
            <div className="tinder-arrow-icon">
              <div className="arrow-line"></div>
              <div className="arrow-head"></div>
            </div>
          </motion.div>
          
          {/* 右邊箭頭指示 */}
          <motion.div 
            className="swipe-arrow-indicator right"
            style={{ opacity: rightArrowOpacity }}
          >
            <div className="tinder-arrow-icon">
              <div className="arrow-line"></div>
              <div className="arrow-head"></div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}