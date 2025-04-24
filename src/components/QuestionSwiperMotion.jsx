import React, { useState } from "react";
import CardStack from "./common/CardStack";
import "./SwiftTasteCard.css";

export default function QuestionSwiperMotion({ questions, onComplete }) {
  const [answers, setAnswers] = useState({});

  const handleSwipe = (dir, q) => {
    const answer = dir === "right" ? q.rightOption : q.leftOption;
    const updated = { ...answers, [q.id]: answer };
    setAnswers(updated);
    if (Object.keys(updated).length === questions.length) {
      onComplete(updated);
    }
  };

  return (
    <CardStack
      cards={questions}
      onSwipe={handleSwipe}
      renderCard={(q) => (
        <>
          <h3 className="question-text">{q.text}</h3>
          <div className="options-display">
            <div className="left">{q.leftOption}</div>
            <div className="right">{q.rightOption}</div>
          </div>
        </>
      )}
    />
  );
}
