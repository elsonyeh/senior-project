import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import CardStack from "./common/CardStack";
import "./SwiftTasteCard.css";

// 單題同步答題組件 - 專為多人模式設計（移除點擊投票功能）
export default function QuestionSwiperMotionSingle({ 
  question, 
  onAnswer, 
  voteStats, 
  disableClickToVote = false 
}) {
  const [lastDirection, setLastDirection] = useState("");
  const [hasVoted, setHasVoted] = useState(false);
  const [voteData, setVoteData] = useState({ left: 0, right: 0 });
  
  // 使用ref存儲voteStats以避免無限循環更新
  const voteStatsRef = useRef(voteStats);

  // 只有當實際值改變時才更新state，避免不必要的渲染
  useEffect(() => {
    if (voteStats && JSON.stringify(voteStats) !== JSON.stringify(voteStatsRef.current)) {
      voteStatsRef.current = voteStats;
      
      // 提取左右選項的票數
      if (question) {
        const leftCount = voteStats[question.leftOption] || 0;
        const rightCount = voteStats[question.rightOption] || 0;
        
        setVoteData({
          left: leftCount,
          right: rightCount
        });
      }
    }
  }, [voteStats, question]);

  // 處理滑動時的視覺反饋
  const handleLocalSwipe = (dir) => {
    setLastDirection(dir);
  };

  // 處理最終滑動提交
  const handleSwipe = (dir, item) => {
    if (hasVoted) return; // 防止重複投票
    
    // 提交答案
    const answer = dir === "right" ? 
                  (item ? item.rightOption : question.rightOption) : 
                  (item ? item.leftOption : question.leftOption);
    
    setHasVoted(true);
    // 調用父組件的答案處理函數
    onAnswer(answer);
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

  // 確保 question 對象格式正確
  const safeQuestion = question ? {
    id: question.id || `question-${Date.now()}`,
    text: question.text || "",
    leftOption: question.leftOption || "選項 A",
    rightOption: question.rightOption || "選項 B",
    hasVS: question.hasVS || false
  } : null;

  if (!safeQuestion) {
    return <div>無法載入問題...</div>;
  }

  // 計算投票百分比
  const totalVotes = voteData.left + voteData.right;
  const leftPercentage = totalVotes > 0 ? Math.round((voteData.left / totalVotes) * 100) : 50;
  const rightPercentage = 100 - leftPercentage;

  return (
    <div className="question-swiper-container">
      {/* 使用CardStack來實現滑動效果 */}
      <CardStack
        cards={[safeQuestion]} // 確保這是一個數組，包含一個有效的問題對象
        badgeType="none"
        onSwipe={handleSwipe}
        onLocalSwipe={handleLocalSwipe}
        renderCard={(q) => (
          <>
            <h3 className="question-text">{formatQuestionText(q)}</h3>
            
            {/* 選項顯示 */}
            <div className="options-display">
              <div className={`left ${lastDirection === "left" ? "option-active" : ""}`}>
                <p className={lastDirection === "left" ? "option-highlight-text" : ""}>
                  {q.leftOption}
                </p>
                {voteData.left > 0 && !hasVoted && (
                  <div className="live-vote-count">
                    {voteData.left} 票
                  </div>
                )}
              </div>
              
              <div className={`right ${lastDirection === "right" ? "option-active" : ""}`}>
                <p className={lastDirection === "right" ? "option-highlight-text" : ""}>
                  {q.rightOption}
                </p>
                {voteData.right > 0 && !hasVoted && (
                  <div className="live-vote-count">
                    {voteData.right} 票
                  </div>
                )}
              </div>
            </div>
            
            {hasVoted && (
              <motion.div   
                className="vote-hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <p>已提交答案，等待其他人...</p>
                <div className="vote-waiting-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </motion.div>
            )}

            {!hasVoted && (
              <motion.div 
                className="swipe-hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <p>左右滑動卡片進行選擇</p>
                
                {/* 實時投票人數顯示 */}
                {totalVotes > 0 && (
                  <div className="live-votes-indicator">
                    <span className="live-votes-icon">👥</span> 
                    <span className="live-votes-text">{totalVotes} 人已投票</span>
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}
      />
    </div>
  );
}