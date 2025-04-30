import React, { useState } from "react";
import CardStack from "./common/CardStack";
import "./SwiftTasteCard.css";

export default function QuestionSwiperMotion({ questions, onComplete }) {
  const [answers, setAnswers] = useState({});
  const [lastSwipedId, setLastSwipedId] = useState(null);
  const [lastDirection, setLastDirection] = useState("");

  const handleSwipe = (dir, q) => {
    if (!q) return;
    
    const answer = dir === "right" ? q.rightOption : q.leftOption;
    const updated = { ...answers, [q.id]: answer };
    setAnswers(updated);
    
    if (Object.keys(updated).length === questions.length) {
      onComplete(updated);
    }
  };

  // 處理滑動時的視覺反饋
  const handleLocalSwipe = (dir, item) => {
    if (!item) return;
    setLastSwipedId(item.id);
    setLastDirection(dir);
  };
  
  // 格式化問題文本，處理 v.s. 格式
  const formatQuestionText = (q) => {
    // 檢查文本和 hasVS 標記
    if (!q) return "";
    
    if (q.text && (q.text.includes("v.s.") || q.hasVS)) {
      const parts = q.text.split("v.s.");
      return (
        <div className="question-wrapper">
          <div>{parts[0].trim()}</div>
          <div className="vs-text">v.s.</div>
          <div>{parts[1].trim()}</div>
        </div>
      );
    }
    return q.text;
  };

  // 確保所有問題都有唯一ID和正確結構
  const safeQuestions = Array.isArray(questions) ? questions.map((q, index) => ({
    id: q.id || `q${index}`,
    text: q.text || "",
    leftOption: q.leftOption || "選項 A",
    rightOption: q.rightOption || "選項 B",
    hasVS: q.hasVS || false
  })) : [];

  // 過濾已回答的問題
  const remainingQuestions = safeQuestions.filter(q => !answers[q.id]);

  if (safeQuestions.length === 0) {
    return <div>載入問題中...</div>;
  }

  if (remainingQuestions.length === 0) {
    return <div>所有問題已回答，處理中...</div>;
  }

  return (
    <CardStack
      cards={remainingQuestions}
      badgeType="none"
      onSwipe={handleSwipe}
      onLocalSwipe={handleLocalSwipe}
      renderCard={(q) => (
        <>
          <h3 className="question-text">{formatQuestionText(q)}</h3>
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