import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import CardStack from "./common/CardStack";
import socket from "../services/socket";
import "./SwiftTasteCard.css";

// 單題同步答題組件 - 專為多人模式設計（移除點擊投票功能）
export default function QuestionSwiperMotionSingle({
  question, // 單個問題（向後相容）
  questions, // 新增：問題數組（提升流暢度）
  onAnswer,
  voteStats,
  disableClickToVote = false,
  userId,
  disabled = false, // 新增：禁用滑動
}) {
  const [lastDirection, setLastDirection] = useState("");
  const [hasVoted, setHasVoted] = useState(false);
  const [voteData, setVoteData] = useState({ left: 0, right: 0, total: 0 });

  // 使用 questions 數組（如果提供）或單個 question
  const questionList = questions || (question ? [question] : []);
  const currentQuestion = questionList[0]; // 總是使用第一個問題作為當前問題

  // 使用ref存儲voteStats以避免無限循環更新
  const voteStatsRef = useRef(voteStats);

  // 只有當實際值改變時才更新state，避免不必要的渲染
  useEffect(() => {
    if (
      voteStats &&
      JSON.stringify(voteStats) !== JSON.stringify(voteStatsRef.current)
    ) {
      voteStatsRef.current = voteStats;

      // 提取左右選項的票數，考慮所有用戶的投票
      if (currentQuestion) {
        let leftCount = 0;
        let rightCount = 0;

        // 計算所有用戶的投票（包括房主）
        if (voteStats.userData && Array.isArray(voteStats.userData)) {
          voteStats.userData.forEach((vote) => {
            if (vote.option === currentQuestion.leftOption) {
              leftCount++;
            } else if (vote.option === currentQuestion.rightOption) {
              rightCount++;
            }
          });
        }

        // 如果有房主投票，確保計入
        if (voteStats.hostVote) {
          if (voteStats.hostVote === currentQuestion.leftOption) {
            // 檢查是否已經在 userData 中計算過
            const hostInUserData = voteStats.userData?.some(
              (vote) => vote.isHost && vote.option === currentQuestion.leftOption
            );
            if (!hostInUserData) {
              leftCount++;
            }
          } else if (voteStats.hostVote === currentQuestion.rightOption) {
            const hostInUserData = voteStats.userData?.some(
              (vote) => vote.isHost && vote.option === currentQuestion.rightOption
            );
            if (!hostInUserData) {
              rightCount++;
            }
          }
        }

        // 更新投票數據
        setVoteData({
          left: leftCount,
          right: rightCount,
          total: leftCount + rightCount,
        });

        // 檢查當前用戶是否已投票
        console.log("🔍 檢查用戶投票狀態:", {
          userId,
          voteStatsUserData: voteStats.userData,
          hasUserVoted: voteStats.userData?.some((vote) => vote.id === userId)
        });

        const hasUserVoted = voteStats.userData?.some(
          (vote) => vote.id === userId
        );
        setHasVoted(hasUserVoted);
      }
    }
  }, [voteStats, currentQuestion, userId]);

  // 處理滑動時的視覺反饋
  const handleLocalSwipe = (dir) => {
    setLastDirection(dir);
  };

  // 處理最終滑動提交
  const handleSwipe = (dir, item) => {
    console.log("🎯 handleSwipe 被調用:", {
      dir,
      hasVoted,
      userId,
      questionId: currentQuestion?.id,
      disabled
    });

    if (disabled) {
      console.log("⚠️ 組件已禁用，忽略此次滑動");
      return; // 禁用時不允許滑動
    }

    // 移除 hasVoted 本地檢查，避免快速滑動時被阻止
    // 父組件會通過 disabled prop 控制是否允許滑動
    // if (hasVoted) {
    //   console.log("⚠️ 用戶已投票，忽略此次滑動");
    //   return;
    // }

    // 提交答案
    const answer =
      dir === "right"
        ? item
          ? item.rightOption
          : currentQuestion.rightOption
        : item
        ? item.leftOption
        : currentQuestion.leftOption;

    console.log("📝 提交答案:", { answer, userId });

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

  // 確保 question 對象格式正確，並轉換為數組供 CardStack 使用
  const safeQuestions = questionList
    .filter(q => q) // 移除 null/undefined
    .map((q, index) => ({
      id: q.id || `question-${Date.now()}-${index}`,
      text: q.text || "",
      leftOption: q.leftOption || "選項 A",
      rightOption: q.rightOption || "選項 B",
      hasVS: q.hasVS || false,
    }));

  if (safeQuestions.length === 0) {
    return <div>無法載入問題...</div>;
  }

  const currentSafeQuestion = safeQuestions[0]; // 當前要顯示的問題

  // 計算投票百分比
  const calculatePercentage = (count, total) => {
    if (total === 0) return 0;
    return Math.round((count / total) * 100);
  };

  // 渲染投票數顯示
  const renderVoteCount = (count, total) => {
    if (total <= 0) return null;
    const percentage = calculatePercentage(count, total);
    return (
      <div className="live-vote-count">
        <span className="vote-number">{count} 票</span>
        <span className="vote-percentage">({percentage}%)</span>
      </div>
    );
  };

  return (
    <div className="question-swiper-container">
      {/* 使用CardStack來實現滑動效果，傳入數組以支持多張卡片 */}
      <CardStack
        cards={safeQuestions}
        badgeType="none"
        onSwipe={handleSwipe}
        onLocalSwipe={handleLocalSwipe}
        renderCard={(q) => (
          <>
            <h3 className="question-text">{formatQuestionText(q)}</h3>

            {/* 選項顯示 */}
            <div className="options-display">
              <div
                className={`left ${
                  lastDirection === "left" ? "option-active" : ""
                }`}
              >
                <p
                  className={
                    lastDirection === "left" ? "option-highlight-text" : ""
                  }
                >
                  {q.leftOption}
                </p>
                {/* 只在非等待狀態時顯示投票統計 */}
                {!disabled && renderVoteCount(voteData.left, voteData.total)}
                {!disabled && voteData.total > 0 && (
                  <motion.div
                    className="vote-percentage-bar"
                    initial={{ width: "0%" }}
                    animate={{
                      width: `${calculatePercentage(
                        voteData.left,
                        voteData.total
                      )}%`,
                      transition: { duration: 0.5 },
                    }}
                  />
                )}
              </div>

              <div
                className={`right ${
                  lastDirection === "right" ? "option-active" : ""
                }`}
              >
                <p
                  className={
                    lastDirection === "right" ? "option-highlight-text" : ""
                  }
                >
                  {q.rightOption}
                </p>
                {/* 只在非等待狀態時顯示投票統計 */}
                {!disabled && renderVoteCount(voteData.right, voteData.total)}
                {!disabled && voteData.total > 0 && (
                  <motion.div
                    className="vote-percentage-bar"
                    initial={{ width: "0%" }}
                    animate={{
                      width: `${calculatePercentage(
                        voteData.right,
                        voteData.total
                      )}%`,
                      transition: { duration: 0.5 },
                    }}
                  />
                )}
              </div>
            </div>

            {/* 只在非等待狀態時顯示已投票提示 */}
            {!disabled && hasVoted && (
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

            {/* 只在非等待狀態時顯示投票人數指示器 */}
            {!disabled && !hasVoted && voteData.total > 0 && (
              <motion.div
                className="live-votes-indicator"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <span className="live-votes-icon">👥</span>
                <span className="live-votes-text">
                  {voteData.total} 人已投票
                </span>
              </motion.div>
            )}
          </>
        )}
      />
    </div>
  );
}
