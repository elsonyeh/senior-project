import React, { useState } from "react";
import CardStack from "./common/CardStack";
import "./SwiftTasteCard.css";

export default function QuestionSwiperMotion({ questions, onComplete }) {
  const [answers, setAnswers] = useState({});
  const [lastSwipedId, setLastSwipedId] = useState(null);
  const [lastDirection, setLastDirection] = useState("");

  const handleSwipe = (dir, q) => {
    const answer = dir === "right" ? q.rightOption : q.leftOption;
    const updated = { ...answers, [q.id]: answer };
    setAnswers(updated);
    if (Object.keys(updated).length === questions.length) {
      onComplete(updated);
    }
  };

  // 處理滑動時的視覺反饋
  const handleLocalSwipe = (dir, item) => {
    setLastSwipedId(item.id);
    setLastDirection(dir);
  };

  return (
    <CardStack
      cards={questions}
      badgeType="none"
      onSwipe={handleSwipe}
      onLocalSwipe={handleLocalSwipe}
      renderCard={(q) => (
        <>
          <h3 className="question-text">{q.text}</h3>
          <div className="options-display">
            <div className={`left ${lastSwipedId === q.id && lastDirection === "left" ? "option-active" : ""}`}>
              <p className={lastSwipedId === q.id && lastDirection === "left" ? "option-highlight-text" : ""}>
                {q.leftOption}
              </p>
            </div>
            <div className={`right ${lastSwipedId === q.id && lastDirection === "right" ? "option-active" : ""}`}>
              <p className={lastSwipedId === q.id && lastDirection === "right" ? "option-highlight-text" : ""}>
                {q.rightOption}
              </p>
            </div>
          </div>
        </>
      )}
    />
  );
}