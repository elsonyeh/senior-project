import React, { useState, useEffect } from "react";
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
  // 全域狀態追蹤目前顯示哪個徽章
  const [activeBadge, setActiveBadge] = useState(null);

  // 處理卡片滑動方向顯示對應徽章
  const handleLocalBadge = (dir) => {
    setActiveBadge(dir);
  };

  // 重置徽章
  const resetBadge = () => {
    setActiveBadge(null);
  };

  return (
    <div className="motion-swiper-container">
      {/* 固定位置的徽章 */}
      {badgeType === "like-nope" && (
        <>
          <div
            className={`fixed-badge like ${
              activeBadge === "right" ? "visible" : ""
            }`}
          >
            <span className="badge-icon">✓</span> 收藏
          </div>
          <div
            className={`fixed-badge nope ${
              activeBadge === "left" ? "visible" : ""
            }`}
          >
            <span className="badge-icon">✗</span> 跳過
          </div>
        </>
      )}

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
                  resetBadge(); // 卡片消失後重置徽章
                }}
                onLocalSwipe={(dir, item) => {
                  if (dir === "reset") {
                    resetBadge();
                  } else {
                    handleLocalBadge(dir);
                  }
                  // 同時還要調用原始 onLocalSwipe 讓選項高亮等功能正常運作
                  onLocalSwipe?.(dir, item);
                }}
                render={renderCard}
                background={background?.(item)}
                isRestaurant={Boolean(background)}
                centered={centered}
                badgeType="none" // 不使用卡片內的徽章
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

  // 從x值轉換出箭頭的透明度，實現更流暢的視覺反饋
  const leftArrowOpacity = useTransform(x, [-100, -30, 0], [1, 0.7, 0.4]);
  const rightArrowOpacity = useTransform(x, [0, 30, 100], [0.4, 0.7, 1]);

  const isTop = position === 0;
  const topOffset = position * 14 + 20;
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

      {isTop && (
        <div className="swipe-arrows-container">
          {/* 左邊箭頭指示 */}
          <motion.div
            className="swipe-arrow-indicator left"
            style={{ opacity: leftArrowOpacity }}
          >
            <div className="new-arrow-icon">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M19 12H5"
                  stroke="#FF6B6B"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 19L5 12L12 5"
                  stroke="#FF6B6B"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </motion.div>

          {/* 右邊箭頭指示 */}
          <motion.div
            className="swipe-arrow-indicator right"
            style={{ opacity: rightArrowOpacity }}
          >
            <div className="new-arrow-icon">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5 12H19"
                  stroke="#2ECC71"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 5L19 12L12 19"
                  stroke="#2ECC71"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
