import React, { useState, useEffect, useRef, useCallback } from "react";
import socket from "../services/socket";
import QuestionSwiperMotionSingle from "./QuestionSwiperMotionSingle";
import { motion, AnimatePresence } from "framer-motion";
import "./BuddiesVoteStyles.css";
import { buddiesBasicQuestions } from "../data/buddiesBasicQuestions";

export default function BuddiesQuestionSwiper({
  roomId,
  questions,
  onComplete,
  members = [], // 添加這個參數並設置默認值
}) {
  // 主要狀態
  const [questionIndex, setQuestionIndex] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [voteStats, setVoteStats] = useState({});
  const [voteBubbles, setVoteBubbles] = useState([]); // 改為數組，存儲多個氣泡
  const hasCompletedRef = useRef(false);

  // Refs - 不會觸發重新渲染
  const answersRef = useRef({});
  const isMountedRef = useRef(true);
  const timeoutRef = useRef(null);

  // 新增：記錄問題文本和問題來源
  const questionTextsRef = useRef([]);
  const questionSourcesRef = useRef([]);

  // 創建基本問題文本列表，用於判斷
  const basicQuestionTexts = useRef(
    buddiesBasicQuestions.map((q) => q.question)
  ).current;

  // 基於 buddiesBasicQuestions 判斷問題類型
  const isBuddiesBasicQuestion = useCallback(
    (text) => {
      return basicQuestionTexts.includes(text);
    },
    [basicQuestionTexts]
  );

  // 處理安全的問題格式化
  const safeQuestions = useRef(
    Array.isArray(questions)
      ? questions.map((q, index) => ({
          id: q.id || `q${index}`,
          text: q.text || "",
          leftOption: q.leftOption || "選項 A",
          rightOption: q.rightOption || "選項 B",
          hasVS: q.hasVS || false,
          source:
            q.source ||
            (q.text && isBuddiesBasicQuestion(q.text) ? "basic" : "fun"),
        }))
      : []
  ).current;

  // 從問題中提取文本和來源
  const questionTexts = useRef(safeQuestions.map((q) => q.text)).current;
  const questionSources = useRef(safeQuestions.map((q) => q.source)).current;

  // 清理所有計時器的函數
  const clearAllTimeouts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // 顯示投票氣泡動畫
  const showVoteBubble = useCallback((voteData) => {
    if (!isMountedRef.current) return;

    // 避免顯示自己的投票
    if (voteData.senderId === socket.id) return;

    // 創建新的投票氣泡
    const newBubble = {
      id: Date.now() + Math.random(),
      option: voteData.option,
      userName: voteData.userName || "有人",
      timestamp: Date.now(),
    };

    // 添加新氣泡到數組
    setVoteBubbles((prev) => {
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
      if (!isMountedRef.current) return;

      console.log(`提交答案: ${answer}, 題目 ${questionIndex}`);
      setWaiting(true);

      // 保存答案，同時更新ref
      const newAnswers = { ...answersRef.current, [questionIndex]: answer };
      answersRef.current = newAnswers;

      // 獲取當前問題的文本和來源
      const questionText = safeQuestions[questionIndex]?.text || "";
      const questionSource =
        safeQuestions[questionIndex]?.source ||
        (isBuddiesBasicQuestion(questionText) ? "basic" : "fun");

      // 保存問題文本和來源到ref中
      questionTextsRef.current[questionIndex] = questionText;
      questionSourcesRef.current[questionIndex] = questionSource;

      // 構建完整答案數據
      const answersArray = Object.values(newAnswers);
      const questionTextsArray = [...questionTextsRef.current];
      const questionSourcesArray = [...questionSourcesRef.current];

      // 發送答案到服務器
      console.log(
        `發送答案到服務器: roomId=${roomId}, index=${questionIndex}, answersLength=${answersArray.length}, totalQuestions=${safeQuestions.length}`
      );

      socket.emit(
        "submitAnswers",
        {
          roomId,
          answers: answersArray,
          questionTexts: questionTextsArray,
          questionSources: questionSourcesArray,
          index: questionIndex,
          totalQuestions: safeQuestions.length,
          currentAnswerCount: Object.keys(newAnswers).length,
          basicQuestions: buddiesBasicQuestions,
        },
        (response) => {
          if (response && !response.success) {
            console.error(`答案提交回調錯誤: ${response.error}`);
          } else {
            console.log(
              `答案提交成功，當前題目：${questionIndex}/${
                safeQuestions.length - 1
              }`
            );
          }
        }
      );
    },
    [questionIndex, roomId, safeQuestions, isBuddiesBasicQuestion]
  );

  // 處理Socket事件監聽 - 這是主要的useEffect
  useEffect(() => {
    console.log("初始化Socket事件監聽，當前題目:", questionIndex);

    // 設置組件已掛載標記
    isMountedRef.current = true;

    // 在組件內部創建timeoutRef，確保每個實例都有自己的引用
    const timeoutRef = { current: null };

    // 收到下一題信號 - 重新設計此函數
    const handleNextQuestion = (data) => {
      console.log(`收到下一題信號: ${JSON.stringify(data)}`);

      if (!isMountedRef.current) return;

      // 先清理任何現有的計時器
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // 重要：強制確保數據轉換為數字類型
      const nextIndex =
        data && typeof data.nextIndex !== "undefined"
          ? Number(data.nextIndex)
          : questionIndex + 1;

      // 防止退步，確保新題目索引大於當前索引
      if (nextIndex <= questionIndex) {
        console.warn(
          `收到的題目索引 ${nextIndex} 不大於當前索引 ${questionIndex}，忽略`
        );
        return;
      }

      // 檢查是否為最後一個用戶完成的信號
      if (data && data.isLastUser) {
        console.log("所有用戶已完成選擇，將在2秒後切換到題目:", nextIndex);

        // 更新等待文本
        const waitingElement = document.querySelector(".waiting-text");
        if (waitingElement) {
          waitingElement.textContent = "所有人都完成了！即將進入下一題...";
        }

        // 延遲2秒後再切換題目，讓用戶看到結果
        timeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            console.log("2秒後切換到題目:", nextIndex);
            setQuestionIndex(nextIndex);
            setVoteStats({});
            setWaiting(false);

            // 重置等待文本 (如果使用DOM操作的話)
            const waitingElement = document.querySelector(".waiting-text");
            if (waitingElement) {
              waitingElement.textContent = "等待其他人回答...";
            }
          }
        }, 2000);
      } else {
        // 如果不是最後一個用戶，仍然添加少量延遲以避免同步問題
        timeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            console.log("立即切換到題目:", nextIndex);
            setQuestionIndex(nextIndex);
            setVoteStats({});
            setWaiting(false);
          }
        }, 100);
      }
    };

    const handleVoteStats = (stats) => {
      if (!isMountedRef.current) return;

      // 直接更新狀態，不進行比較
      setVoteStats(stats);

      // 添加調試日誌
      console.log("更新投票統計:", stats);
    };

    // 收到新投票事件 - 保存投票用戶資訊
    const handleNewVote = (voteData) => {
      if (!isMountedRef.current) return;

      // 驗證投票數據
      if (!voteData || typeof voteData !== "object") {
        console.error("無效的投票數據格式");
        return;
      }

      // 更新投票統計
      setVoteStats((prev) => {
        const newStats = { ...prev };
        if (!newStats.userData) {
          newStats.userData = [];
        }

        // 確保不重複添加
        const existingVote = newStats.userData.find(
          (u) => u.id === voteData.senderId
        );
        if (!existingVote) {
          newStats.userData.push({
            id: voteData.senderId || `user-${Date.now()}`,
            name: voteData.userName || "匿名用戶",
            option: voteData.option,
            timestamp: Date.now(),
          });
        }

        return newStats;
      });
    };

    // 收到結束信號和餐廳推薦結果
    // 在 BuddiesQuestionSwiper.jsx 中改進推薦接收處理
    const handleGroupRecommendations = (recs) => {
      if (!isMountedRef.current) return;

      // 檢查是否真的完成了所有問題
      const answeredQuestionsCount = Object.keys(answersRef.current).length;
      if (answeredQuestionsCount < safeQuestions.length) {
        console.warn(
          `收到推薦結果，但尚未完成所有問題 (${answeredQuestionsCount}/${safeQuestions.length})`
        );
        return;
      }

      console.log("收到餐廳推薦結果:", recs?.length, "家餐廳");

      // 確保接收到有效數據
      if (!recs || !Array.isArray(recs) || recs.length === 0) {
        console.error("收到的推薦結果無效:", recs);
        return;
      }

      // 使用 ref 獲取最新狀態
      const result = {
        answers: Object.values(answersRef.current),
        questionTexts: questionTextsRef.current,
        questionSources: questionSourcesRef.current,
      };

      // 調用 onComplete
      try {
        onComplete(result, recs);
        console.log("已調用 onComplete 函數");
      } catch (error) {
        console.error("調用 onComplete 出錯:", error);
      }
    };

    // 註冊事件監聽
    socket.on("nextQuestion", handleNextQuestion);
    socket.on("voteStats", handleVoteStats);
    socket.on("newVote", handleNewVote);
    socket.on("groupRecommendations", handleGroupRecommendations);

    // 發送準備就緒信號
    const sendReadySignal = () => {
      if (socket.connected) {
        console.log("發送客戶端就緒信號:", {
          roomId,
          currentIndex: questionIndex,
        });
        socket.emit("clientReady", { roomId, currentIndex: questionIndex });
      }
    };

    // 連接時發送就緒信號
    sendReadySignal();

    // 重新連接時也發送就緒信號
    socket.on("connect", sendReadySignal);

    // 清理函數 - 移除所有事件監聽和計時器
    return () => {
      console.log("清理Socket事件監聽");
      isMountedRef.current = false;
      socket.off("nextQuestion", handleNextQuestion);
      socket.off("voteStats", handleVoteStats);
      socket.off("newVote", handleNewVote);
      socket.off("groupRecommendations", handleGroupRecommendations);
      socket.off("connect", sendReadySignal);

      // 清理計時器
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [questionIndex, roomId, showVoteBubble]);

  // 清理組件時的副作用
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      isMountedRef.current = false;
    };
  }, []);

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

  const updateVoteBar = () => {
    const leftCount = parseInt(voteStats[currentQuestion.leftOption]) || 0;
    const rightCount = parseInt(voteStats[currentQuestion.rightOption]) || 0;
    const totalVotes = leftCount + rightCount;

    // 確保數值有效
    if (isNaN(leftCount) || isNaN(rightCount)) {
      console.error("無效的投票數據:", voteStats);
      return 0;
    }

    return totalVotes > 0 ? Math.round((leftCount / totalVotes) * 100) : 50; // 預設顯示 50%
  };

  return (
    <div className="question-container">
      {/* 投票浮動指示器 - 支持多個氣泡依序顯示 */}
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
        <div className="waiting-overlay">
          <div className="waiting-container">
            {/* 等待動畫 */}
            <div className="waiting-animation">
              <div className="waiting-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div className="waiting-text">等待其他人回答...</div>
            </div>

            {/* 投票統計視覺化 */}
            <div className="vote-status-container">
              <div className="vote-status-header">
                <div className="vote-status-title">
                  <span className="vote-status-icon">🗳️</span>
                  <span className="vote-status-text">大家的選擇</span>
                </div>
                <div className="vote-status-total">
                  {Object.entries(voteStats)
                    .filter(
                      ([key, value]) =>
                        key !== "userData" && typeof value === "number"
                    )
                    .reduce((sum, [, count]) => sum + count, 0)}{" "}
                  票
                </div>
              </div>

              <div className="vote-distribution">
                {currentQuestion && (
                  <div className="vote-progress-single">
                    <div className="vote-options-labels">
                      <div className="vote-option-label left">
                        <span className="vote-option-name">
                          {currentQuestion.leftOption}
                        </span>
                        <span className="vote-count">
                          {voteStats[currentQuestion.leftOption] || 0}
                        </span>
                      </div>
                      <div className="vote-option-label right">
                        <span className="vote-option-name">
                          {currentQuestion.rightOption}
                        </span>
                        <span className="vote-count">
                          {voteStats[currentQuestion.rightOption] || 0}
                        </span>
                      </div>
                    </div>

                    <div className="vote-bar-container-single">
                      {(() => {
                        const leftOption = currentQuestion.leftOption;
                        const rightOption = currentQuestion.rightOption;
                        const leftCount = voteStats[leftOption] || 0;
                        const rightCount = voteStats[rightOption] || 0;
                        const totalVotes = leftCount + rightCount;

                        // 計算百分比
                        const leftPercentage =
                          totalVotes > 0
                            ? Math.round((leftCount / totalVotes) * 100)
                            : 0;
                        const rightPercentage =
                          totalVotes > 0
                            ? Math.round((rightCount / totalVotes) * 100)
                            : 0;

                        return (
                          <>
                            <motion.div
                              className="vote-bar-left-single"
                              initial={{ width: "0%" }}
                              animate={{ width: `${leftPercentage}%` }}
                              transition={{
                                duration: 0.8,
                                type: "spring",
                                stiffness: 80,
                                damping: 15,
                              }}
                            />
                            <motion.div
                              className="vote-bar-right-single"
                              initial={{ width: "0%" }}
                              animate={{ width: `${rightPercentage}%` }}
                              transition={{
                                duration: 0.8,
                                type: "spring",
                                stiffness: 80,
                                damping: 15,
                              }}
                            />
                            {totalVotes > 0 && (
                              <motion.div
                                className="vote-percentage-indicator"
                                initial={{ opacity: 0 }}
                                animate={{
                                  opacity: 1,
                                  left: `${leftPercentage}%`,
                                }}
                                transition={{
                                  duration: 0.8,
                                  type: "spring",
                                  stiffness: 80,
                                  damping: 15,
                                }}
                              >
                                {leftPercentage}%
                              </motion.div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* 等待人員顯示 */}
              <div className="vote-members-section">
                <div className="vote-members-title">
                  <span role="img" aria-label="voted">
                    🗳️
                  </span>
                  等待中的成員
                </div>
                <div className="vote-members-list">
                  {(() => {
                    // 檢查是否有用戶數據
                    if (
                      voteStats.userData &&
                      Array.isArray(voteStats.userData)
                    ) {
                      return voteStats.userData.map((user) => {
                        // 從 members 數組中找到對應的用戶資訊
                        const memberInfo = members.find(
                          (m) => m.id === user.id
                        );
                        return (
                          <div
                            key={`voter-${user.id}`}
                            className="vote-member-item voted"
                          >
                            <span className="vote-member-icon">👤</span>
                            <span className="vote-member-name">
                              {memberInfo?.name || user.name || "用戶"}
                            </span>
                          </div>
                        );
                      });
                    }
                    return (
                      <div className="no-voters-message">等待成員投票...</div>
                    );
                  })()}
                </div>
              </div>

              {/* 未投票用戶顯示 */}
              <div className="vote-members-section">
                <div className="vote-members-title">
                  <span role="img" aria-label="waiting">
                    ⏳
                  </span>
                  尚未作答
                </div>
                <div className="vote-members-list">
                  {members.length > 0 &&
                  voteStats.userData &&
                  Array.isArray(voteStats.userData) ? (
                    members
                      .filter(
                        (m) => !voteStats.userData.some((u) => u.id === m.id)
                      )
                      .map((member) => (
                        <div
                          key={`waiting-${member.id}`}
                          className="vote-member-item waiting"
                        >
                          <span className="vote-member-icon">👤</span>
                          <span className="vote-member-name">
                            {member.name || "用戶"}
                          </span>
                        </div>
                      ))
                  ) : (
                    <div className="no-voters-message">所有成員都已投票</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="question-active-container">
          <QuestionSwiperMotionSingle
            question={currentQuestion}
            onAnswer={handleAnswer}
            voteStats={voteStats}
            disableClickToVote={true}
          />
        </div>
      )}
    </div>
  );
}
