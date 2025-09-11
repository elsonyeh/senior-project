import React, { useState } from "react";
import CardStack from "./common/CardStack";
import "./SwiftTasteCard.css";

export default function QuestionSwiperMotion({ questions, onComplete }) {
  const [answers, setAnswers] = useState({});
  const [lastSwipedId, setLastSwipedId] = useState(null);
  const [lastDirection, setLastDirection] = useState("");

  // 處理哪些問題應該顯示的邏輯
  const getVisibleQuestions = (allQuestions, currentAnswers) => {
    return allQuestions.filter((question) => {
      // 檢查是否為與食物相關的問題（應該在選擇"喝"時跳過）
      if (question.text) {
        const shouldSkipWhenDrinking = 
          question.text.includes("吃一點還是吃飽") ||
          question.text.includes("想吃辣的還是不辣") ||
          question.text.includes("吃一點") ||
          question.text.includes("吃飽") ||
          question.text.includes("辣的") ||
          question.text.includes("不辣");

        if (shouldSkipWhenDrinking) {
          // 找到"吃還是喝"的問題
          const eatOrDrinkQuestion = allQuestions.find(
            (q) => q.text && (
              q.text.includes("想吃正餐還是想喝飲料") ||
              q.text.includes("吃") && q.text.includes("喝")
            )
          );

          if (eatOrDrinkQuestion && currentAnswers[eatOrDrinkQuestion.id] === "喝") {
            console.log(`Skipping food-related question: "${question.text}" because user chose "喝"`);
            return false; // 如果選擇了"喝"，則不顯示這些問題
          }
        }
      }

      return true; // 其他問題都顯示
    });
  };

  const handleSwipe = (dir, q) => {
    if (!q) return;

    const answer = dir === "right" ? q.rightOption : q.leftOption;
    const updated = { ...answers, [q.id]: answer };
    setAnswers(updated);

    // 問題完成時，添加調試日誌
    console.log("Collected answers:", updated);

    // 檢查是否所有非依賴問題都已回答
    const visibleQuestions = getVisibleQuestions(safeQuestions, updated);
    console.log(`Visible questions after update: ${visibleQuestions.length}/${safeQuestions.length}`);
    console.log('Visible question texts:', visibleQuestions.map(q => q.text));
    
    const allQuestionsAnswered = visibleQuestions.every((question) => {
      // 如果問題有依賴且依賴條件不滿足，則不需要回答
      if (question.dependsOn) {
        const { question: dependQuestion, answer: dependAnswer } =
          question.dependsOn;
        const dependQuestionObj = safeQuestions.find(
          (q) => q.text === dependQuestion
        );
        if (
          dependQuestionObj &&
          updated[dependQuestionObj.id] !== dependAnswer
        ) {
          return true; // 跳過這個問題，不需要答案
        }
      }

      // 否則檢查是否已回答
      return updated[question.id] !== undefined;
    });

    if (allQuestionsAnswered) {
      // 收集問題文本和問題來源(如果有)，構建結構化數據
      const questionTexts = questions.map((q) => q.text || "");
      const questionSources = questions.map((q) => q.source || "");

      // 檢查是否有問題來源信息
      const hasQuestionSources = questionSources.some((source) => source);

      // 構建結構化答案數據
      const structuredAnswers = {
        answers: Object.values(updated), // 轉換為數組格式
        questionTexts: questionTexts,
        rawAnswers: updated  // 添加原始答案對象以便調試
      };

      // 如果有問題來源信息，加入返回數據
      if (hasQuestionSources) {
        structuredAnswers.questionSources = questionSources;
      }
      
      console.log("Final structured answers:", structuredAnswers);

      // 將結構化數據傳遞給完成處理函數
      onComplete(structuredAnswers);
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
  const safeQuestions = Array.isArray(questions)
    ? questions.map((q, index) => ({
        id: q.id || `q${index}`,
        text: q.text || "",
        leftOption: q.leftOption || "選項 A",
        rightOption: q.rightOption || "選項 B",
        hasVS: q.hasVS || false,
        source: q.source || "", // 增加來源屬性
        dependsOn: q.dependsOn || null, // 確保添加依賴屬性
      }))
    : [];

  // 先過濾出符合條件依賴的問題
  const visibleQuestions = getVisibleQuestions(safeQuestions, answers);

  // 再過濾已回答的問題
  const remainingQuestions = visibleQuestions.filter((q) => !answers[q.id]);

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
            <div
              className={`left ${
                lastSwipedId === q.id && lastDirection === "left"
                  ? "option-active"
                  : ""
              }`}
            >
              <p
                className={
                  lastSwipedId === q.id && lastDirection === "left"
                    ? "option-highlight-text"
                    : ""
                }
              >
                {q.leftOption}
              </p>
            </div>
            <div
              className={`right ${
                lastSwipedId === q.id && lastDirection === "right"
                  ? "option-active"
                  : ""
              }`}
            >
              <p
                className={
                  lastSwipedId === q.id && lastDirection === "right"
                    ? "option-highlight-text"
                    : ""
                }
              >
                {q.rightOption}
              </p>
            </div>
          </div>
        </>
      )}
    />
  );
}
