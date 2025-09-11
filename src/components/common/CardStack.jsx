import React, { useState, useEffect, useRef } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
} from "framer-motion";
import "../SwiftTasteCard.css";

export default function CardStack({
  cards = [], // 提供默認空陣列
  onSwipe,
  onLocalSwipe,
  renderCard,
  background,
  centered,
  badgeType = "like-nope",
}) {
  const [visibleCards, setVisibleCards] = useState([]);
  // 全域狀態追蹤目前顯示哪個徽章
  const [activeBadge, setActiveBadge] = useState(null);
  
  // 使用ref來追蹤上一次的cards，避免不必要的重新渲染
  const prevCardsRef = useRef([]);

  // 只有當cards真正改變時才更新visibleCards
  useEffect(() => {
    // 創建一個簡單的比較函數，僅檢查ID是否相同
    const areCardArraysEqual = (prev, curr) => {
      if (!prev || !curr) return false;
      if (prev.length !== curr.length) return false;
      
      // 只比較id，避免無限循環
      for (let i = 0; i < prev.length; i++) {
        if (!prev[i] || !curr[i] || prev[i].id !== curr[i].id) {
          return false;
        }
      }
      return true;
    };
    
    // 只有當cards真正改變時才更新state
    if (!areCardArraysEqual(prevCardsRef.current, cards)) {
      prevCardsRef.current = cards;
      setVisibleCards(cards || []);
    }
  }, [cards]);

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
        {(visibleCards || [])
          .slice(0, 3)
          .reverse()
          .map((item, index, arr) => {
            if (!item) return null; // 防止 undefined 項目
            const position = arr.length - index - 1;
            const itemKey = item.id || `card-${index}`; // 使用回退值作為 key
            
            return (
              <SwipeableCard
                key={itemKey}
                item={item}
                position={position}
                onSwipe={(dir, item) => {
                  if (!item) return;
                  const remaining = visibleCards.filter(
                    (c) => c && c.id !== item.id
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
  const topOffset = position * 18 + 20;  // 計算每張卡片的垂直位置(下一張卡片向下偏移18px)
  const isTopCard = position === 0;     // 判斷是否為最上層的卡片
  const scaleOffset = 1 - position * 0.04;  // 計算縮放比例，讓下方的卡片看起來更小(縮小0.04%)
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
        ...(typeof background === 'object' ? background : { backgroundImage: background }),
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