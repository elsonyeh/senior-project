import React from "react";
import CardStack from "./common/CardStack";
import "./SwiftTasteCard.css";

export default function ModeSwiperMotion({ onSelect }) {
  const data = [
    {
      id: "mode",
      question: "今天想怎麼吃？",
      left: "👥 一起選",
      right: "🙋 自己吃"
    }
  ];

  const handleSwipe = (dir) => {
    onSelect(dir === "right" ? "right" : "left");
  };

  return (
    <CardStack
      cards={data}
      onSwipe={handleSwipe}
      renderCard={(item) => (
        <>
          <h2>{item.question}</h2>
          <div className="mode-choice-row">
            <div className="mode-choice left"><p>{item.left}</p></div>
            <div className="mode-choice right"><p>{item.right}</p></div>
          </div>
        </>
      )}
    />
  );
}
