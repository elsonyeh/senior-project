import React, { useState } from "react";
import CardStack from "./common/CardStack";
import "./SwiftTasteCard.css";

export default function RestaurantSwiperMotion({
  restaurants,
  onSave,
  onFinish,
}) {
  const [seen, setSeen] = useState([]);

  const handleSwipe = (dir, r) => {
    if (dir === "right") onSave?.(r);
    const newSeen = [...seen, r.id];
    setSeen(newSeen);
    if (newSeen.length === restaurants.length) {
      setTimeout(onFinish, 300);
    }
  };

  const renderCard = (r) => (
    <div className="restaurant-card centered">
      <div className="restaurant-info-blur">
        <h3>{r.name || "未命名餐廳"}</h3>
        <p>{r.address || "地址未知"}</p>
        <small>{r.type || "類型不明"}</small>
        {typeof r.rating === "number" && (
          <div className="restaurant-rating">⭐ {r.rating.toFixed(1)} 分</div>
        )}
      </div>
    </div>
  );

  const background = (r) =>
    `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${
      r.photoURL || "https://source.unsplash.com/400x300/?restaurant"
    })`;

  return (
    <CardStack
      cards={restaurants.filter((r) => r && r.id && !seen.includes(r.id))}
      onSwipe={handleSwipe}
      renderCard={renderCard}
      background={background}
      centered
    />
  );
}
