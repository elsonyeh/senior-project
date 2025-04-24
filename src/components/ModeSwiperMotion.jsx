import React, { useState } from "react";
import CardStack from "./common/CardStack";
import "./SwiftTasteCard.css";

export default function ModeSwiperMotion({ onSelect }) {
  const [lastSwiped, setLastSwiped] = useState("");
  const [direction, setDirection] = useState("");

  const data = [
    {
      id: "mode",
      question: "今天想怎麼吃？",
      left: "👥 一起選",
      right: "🙋 自己吃",
      leftHint: "向左滑和朋友一起選餐廳！",
      rightHint: "向右滑快速單人推薦！"
    }
  ];

  // 處理本地滑動狀態
  const handleLocalSwipe = (dir, item) => {
    setLastSwiped(item.id);
    setDirection(dir);
  };

  return (
    <CardStack
      cards={data}
      badgeType="none"
      onSwipe={(dir) => onSelect(dir === "right" ? "right" : "left")}
      onLocalSwipe={handleLocalSwipe}
      renderCard={(item) => (
        <>
          <h2>{item.question}</h2>
          <div className="mode-choice-row">
            <div className={`mode-choice left ${lastSwiped === item.id && direction === "left" ? "mode-choice-active" : ""}`}>
              <p className={lastSwiped === item.id && direction === "left" ? "option-highlight-text" : ""}>
                {item.left}
              </p>
              <small className="hint-text">{item.leftHint}</small>
            </div>
            <div className={`mode-choice right ${lastSwiped === item.id && direction === "right" ? "mode-choice-active" : ""}`}>
              <p className={lastSwiped === item.id && direction === "right" ? "option-highlight-text" : ""}>
                {item.right}
              </p>
              <small className="hint-text">{item.rightHint}</small>
            </div>
          </div>
        </>
      )}
    />
  );
}