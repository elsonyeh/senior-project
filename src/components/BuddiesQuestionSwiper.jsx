import React, { useState, useEffect, useRef, useCallback } from "react";
import socket from "../services/socket";
import QuestionSwiperMotionSingle from "./QuestionSwiperMotionSingle";
import { motion, AnimatePresence } from "framer-motion";
import "./BuddiesVoteStyles.css";

export default function BuddiesQuestionSwiper({
  roomId,
  questions,
  onComplete,
}) {
  // 主要狀態
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [waiting, setWaiting] = useState(false);
  const [voteStats, setVoteStats] = useState({});
  const [voteBubbles, setVoteBubbles] = useState([]); // 改為數組，存儲多個氣泡

  // Refs - 不會觸發重新渲染
  const answersRef = useRef({});
  const isMountedRef = useRef(true);

  // 處理安全的問題格式化（避免在render過程中重複計算）
  const safeQuestions = useRef(
    Array.isArray(questions)
      ? questions.map((q, index) => ({
          id: q.id || `q${index}`,
          text: q.text || "",
          leftOption: q.leftOption || "選項 A",
          rightOption: q.rightOption || "選項 B",
          hasVS: q.hasVS || false,
        }))
      : []
  ).current; // 只計算一次，避免重複計算

  // 從問題中提取文本
  const questionTexts = useRef(safeQuestions.map((q) => q.text)).current;

  // 顯示投票氣泡動畫 - 修改為支持多個氣泡往下疊加，並調整顯示時間為3秒
  const showVoteBubble = useCallback((voteData) => {
    // 避免顯示自己的投票
    if (voteData.senderId === socket.id) return;

    // 創建新的投票氣泡
    const newBubble = {
      id: Date.now(),
      option: voteData.option,
      userName: voteData.userName || "有人",
      timestamp: Date.now(),
    };

    // 添加新氣泡到數組
    setVoteBubbles((prev) => {
      // 限制最多顯示5個氣泡，新的排在上面
      const newBubbles = [newBubble, ...prev].slice(0, 5);
      return newBubbles;
    });

    // 3秒後移除此氣泡
    setTimeout(() => {
      if (isMountedRef.current) {
        setVoteBubbles((prev) =>
          prev.filter((bubble) => bubble.id !== newBubble.id)
        );
      }
    }, 3000);
  }, []);

  // 處理答案提交
  const handleAnswer = useCallback(
    (answer) => {
      setWaiting(true);

      // 保存答案，同時更新ref
      const newAnswers = { ...answersRef.current, [questionIndex]: answer };
      answersRef.current = newAnswers;
      setAnswers(newAnswers);

      // 獲取當前問題的文本
      const questionText = safeQuestions[questionIndex]?.text || "";

      // 獲取用戶名
      const userName = localStorage.getItem("userName") || "用戶";

      // 發送答案到服務器
      socket.emit("submitAnswer", {
        roomId,
        index: questionIndex,
        answer,
        questionText,
        userName,
      });
    },
    [questionIndex, roomId, safeQuestions]
  );

  // 處理Socket事件監聽 - 這是主要的useEffect
  useEffect(() => {
    // 設置組件已掛載標記
    isMountedRef.current = true;

    // 收到下一題信號
    const handleNextQuestion = (data) => {
      if (!isMountedRef.current) return;
      
      // 如果是最後一個人完成滑動，多顯示幾秒結果
      if (data.isLastUser) {
        // 延遲3秒後切換到下一題
        setTimeout(() => {
          setWaiting(false);
          setQuestionIndex(data.nextIndex);
          // 清空投票統計
          setVoteStats({});
        }, 3000);
      } else {
        // 立即切換到下一題
        setWaiting(false);
        setQuestionIndex(data.nextIndex);
        // 清空投票統計
        setVoteStats({});
      }
    };
    // 收到投票統計信息
    const handleVoteStats = (stats) => {
      if (!isMountedRef.current) return;

      // 只在數據真正不同時更新
      setVoteStats((prevStats) => {
        // 避免不必要的狀態更新
        if (JSON.stringify(prevStats) === JSON.stringify(stats)) {
          return prevStats;
        }
        return stats;
      });
    };

    // 收到新投票事件
    const handleNewVote = (voteData) => {
      if (!isMountedRef.current) return;

      // 顯示投票氣泡效果
      showVoteBubble(voteData);

      // 更新投票統計，使用函數式更新避免閉包問題
      setVoteStats((prev) => {
        const newStats = { ...prev };
        const option = voteData.option;
        newStats[option] = (newStats[option] || 0) + 1;
        return newStats;
      });
    };

    // 收到結束信號和餐廳推薦結果
    const handleGroupRecommendations = (recs) => {
      if (!isMountedRef.current) return;

      // 使用ref獲取最新狀態
      const result = {
        answers: Object.values(answersRef.current),
        questionTexts,
      };

      // 調用完成處理函數
      onComplete(result, recs);
    };

    // 註冊事件監聽
    socket.on("nextQuestion", handleNextQuestion);
    socket.on("voteStats", handleVoteStats);
    socket.on("newVote", handleNewVote);
    socket.on("groupRecommendations", handleGroupRecommendations);

    // 清理函數 - 移除所有事件監聽
    return () => {
      isMountedRef.current = false;
      socket.off("nextQuestion", handleNextQuestion);
      socket.off("voteStats", handleVoteStats);
      socket.off("newVote", handleNewVote);
      socket.off("groupRecommendations", handleGroupRecommendations);
    };
  }, [onComplete, questionTexts, showVoteBubble]); // 只依賴穩定的參數

  // 如果所有問題都回答完了，顯示等待結果畫面
  if (questionIndex >= safeQuestions.length) {
    return (
      <div className="all-questions-done">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="done-container"
        >
          <div className="done-icon">✅</div>
          <h3>所有題目都完成了！</h3>
          <p>正在分析大家的答案...</p>
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </motion.div>
      </div>
    );
  }

  // 確保當前問題是有效的
  const currentQuestion = safeQuestions[questionIndex] || null;
  if (!currentQuestion) {
    return <div>載入問題中...</div>;
  }

  return (
    <div>
      {/* 刪除進度條，依照需求移除 */}

      {/* 投票浮動指示器 - 修改為支持多個氣泡依序顯示 */}
      <div className="vote-bubbles-container">
        <AnimatePresence>
          {voteBubbles.map((bubble, index) => (
            <motion.div
              key={bubble.id}
              className="vote-bubble"
              initial={{ opacity: 0, scale: 0.5, x: 0, y: -20 }}
              animate={{
                opacity: 1,
                scale: 1,
                x: 0,
                y: index * 60, // 每個氣泡往下偏移
              }}
              exit={{ opacity: 0, scale: 0.8, x: 50 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              style={{ top: 70 }} // 基礎位置
            >
              <div className="vote-bubble-content">
                <div className="vote-bubble-name">{bubble.userName}</div>
                <div className="vote-bubble-choice">
                  選擇了「{bubble.option}」
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {waiting ? (
        <div className="waiting-container">
          <h3>等待其他人完成第 {questionIndex + 1} 題...</h3>

          {/* 投票統計視覺化 - 使用新的單一條狀設計，修正計票問題 */}
          {Object.keys(voteStats).length > 0 && (
            <div className="vote-status-container">
              <div className="vote-status-header">
                <span className="vote-status-icon">🗳️</span>
                <span className="vote-status-text">大家的選擇</span>
                <span className="vote-status-total">
                  {Object.values(voteStats).reduce((a, b) => a + b, 0)} 票
                </span>
              </div>

              <div className="vote-distribution">
                {/* 獲取選項和對應票數 */}
                {(() => {
                  const options = Object.keys(voteStats);
                  if (options.length < 2) return null;

                  const leftOption = options[0];
                  const rightOption = options[1];
                  const leftCount = voteStats[leftOption] || 0;
                  const rightCount = voteStats[rightOption] || 0;
                  const totalVotes = leftCount + rightCount;

                  // 確保百分比顯示正確且總和為100%
                  let leftPercentage =
                    totalVotes > 0
                      ? Math.round((leftCount / totalVotes) * 100)
                      : 0;
                  let rightPercentage =
                    totalVotes > 0
                      ? Math.round((rightCount / totalVotes) * 100)
                      : 0;

                  // 修正百分比總和為100%
                  if (
                    leftPercentage + rightPercentage !== 100 &&
                    totalVotes > 0
                  ) {
                    if (leftCount > rightCount) {
                      leftPercentage = 100 - rightPercentage;
                    } else {
                      rightPercentage = 100 - leftPercentage;
                    }
                  }

                  return (
                    <div className="vote-progress-single">
                      <div className="vote-options-labels">
                        <div className="vote-option-label left">
                          <span className="vote-option-name">{leftOption}</span>
                          <span className="vote-count">({leftCount})</span>
                        </div>
                        <div className="vote-option-label right">
                          <span className="vote-option-name">
                            {rightOption}
                          </span>
                          <span className="vote-count">({rightCount})</span>
                        </div>
                      </div>

                      <div className="vote-bar-container-single">
                        <motion.div
                          className="vote-bar-left-single"
                          initial={{ width: "0%" }}
                          animate={{ width: `${leftPercentage}%` }}
                          transition={{ duration: 0.8 }}
                        />
                        {totalVotes > 0 && (
                          <motion.div
                            className="vote-percentage-indicator"
                            initial={{ left: "50%" }}
                            animate={{ left: `${leftPercentage}%` }}
                            transition={{ duration: 0.8 }}
                          >
                            {leftPercentage}%
                          </motion.div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      ) : (
        <QuestionSwiperMotionSingle
          question={currentQuestion}
          onAnswer={handleAnswer}
          voteStats={voteStats}
          disableClickToVote={true} // 禁用點擊選擇，只允許滑動
        />
      )}
    </div>
  );
}
