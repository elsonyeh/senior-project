import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import CardStack from "./common/CardStack";
import socket from "../services/socket";
import "./SwiftTasteCard.css";

// 單題同步答題組件 - 專為多人模式設計（移除點擊投票功能）
export default function QuestionSwiperMotionSingle({
  question,
  onAnswer,
  voteStats,
  disableClickToVote = false,
  userId,
}) {
  const [lastDirection, setLastDirection] = useState("");
  const [hasVoted, setHasVoted] = useState(false);
  const [voteData, setVoteData] = useState({ left: 0, right: 0, total: 0 });

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
      if (question) {
        let leftCount = 0;
        let rightCount = 0;

        // 計算所有用戶的投票（包括房主）
        if (voteStats.userData && Array.isArray(voteStats.userData)) {
          voteStats.userData.forEach((vote) => {
            if (vote.option === question.leftOption) {
              leftCount++;
            } else if (vote.option === question.rightOption) {
              rightCount++;
            }
          });
        }

        // 如果有房主投票，確保計入
        if (voteStats.hostVote) {
          if (voteStats.hostVote === question.leftOption) {
            // 檢查是否已經在 userData 中計算過
            const hostInUserData = voteStats.userData?.some(
              (vote) => vote.isHost && vote.option === question.leftOption
            );
            if (!hostInUserData) {
              leftCount++;
            }
          } else if (voteStats.hostVote === question.rightOption) {
            const hostInUserData = voteStats.userData?.some(
              (vote) => vote.isHost && vote.option === question.rightOption
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
  }, [voteStats, question, userId]);

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
      questionId: question?.id
    });

    if (hasVoted) {
      console.log("⚠️ 用戶已投票，忽略此次滑動");
      return; // 防止重複投票
    }

    // 提交答案
    const answer =
      dir === "right"
        ? item
          ? item.rightOption
          : question.rightOption
        : item
        ? item.leftOption
        : question.leftOption;

    console.log("📝 提交答案:", { answer, userId });

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
  const safeQuestion = question
    ? {
        id: question.id || `question-${Date.now()}`,
        text: question.text || "",
        leftOption: question.leftOption || "選項 A",
        rightOption: question.rightOption || "選項 B",
        hasVS: question.hasVS || false,
      }
    : null;

  if (!safeQuestion) {
    return <div>無法載入問題...</div>;
  }

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
      {/* 使用CardStack來實現滑動效果 */}
      <CardStack
        cards={[safeQuestion]}
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
                {renderVoteCount(voteData.left, voteData.total)}
                {voteData.total > 0 && (
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
                {renderVoteCount(voteData.right, voteData.total)}
                {voteData.total > 0 && (
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

            {!hasVoted && voteData.total > 0 && (
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
