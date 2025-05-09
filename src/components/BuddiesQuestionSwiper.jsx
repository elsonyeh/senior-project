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
  const [waitingText, setWaitingText] = useState("等待其他人回答...");
  // 新增：追蹤是否顯示結果倒計時
  const [showingResults, setShowingResults] = useState(false);
  const hasCompletedRef = useRef(false);

  // Refs - 不會觸發重新渲染
  const answersRef = useRef({});
  const isMountedRef = useRef(true);
  const timeoutRef = useRef(null);

  // 新增：記錄問題文本和問題來源
  const questionTextsRef = useRef([]);
  const questionSourcesRef = useRef([]);

  // 處理安全的問題格式化（避免在render過程中重複計算）
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
            (q.text &&
            // 基於問題文本判斷來源
            (q.text.includes("想吃奢華點還是平價") ||
              q.text.includes("想吃正餐還是想喝飲料") ||
              q.text.includes("吃一點還是吃飽") ||
              q.text.includes("附近吃還是遠一點") ||
              q.text.includes("想吃辣的還是不辣") ||
              q.text.includes("今天是一個人還是有朋友"))
              ? "basic"
              : "fun"), // 自動識別基本問題
        }))
      : []
  ).current; // 只計算一次，避免重複計算

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

  // 顯示投票氣泡動畫 - 修改為支持多個氣泡往下疊加，並調整顯示時間為3秒
  const showVoteBubble = useCallback((voteData) => {
    if (!isMountedRef.current) return;

    // 避免顯示自己的投票
    if (voteData.senderId === socket.id) return;

    // 創建新的投票氣泡
    const newBubble = {
      id: Date.now() + Math.random(), // 確保唯一ID
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
  // 處理答案提交
  const handleAnswer = useCallback(
    (answer) => {
      if (!isMountedRef.current) return;

      console.log(`提交答案: ${answer}, 題目 ${questionIndex}`);
      setWaiting(true);

      // 保存答案，同時更新ref
      const newAnswers = { ...answersRef.current, [questionIndex]: answer };
      answersRef.current = newAnswers;
      setAnswers(newAnswers);

      // 獲取當前問題的文本和來源
      const questionText = safeQuestions[questionIndex]?.text || "";
      const questionSource = safeQuestions[questionIndex]?.source || "fun"; // 默認為趣味問題

      // 保存問題文本和來源到ref中
      questionTextsRef.current[questionIndex] = questionText;
      questionSourcesRef.current[questionIndex] = questionSource;

      // 獲取用戶名
      const userName = localStorage.getItem("userName") || "用戶";

      // 構建完整答案數據
      const answersArray = Object.values(newAnswers);
      const questionTextsArray = [...questionTextsRef.current];
      const questionSourcesArray = [...questionSourcesRef.current];

      // 發送答案到服務器，確保使用正確的事件名稱 "submitAnswers"
      console.log(
        `發送答案到服務器: roomId=${roomId}, index=${questionIndex}, answersLength=${answersArray.length}`
      );

      socket.emit(
        "submitAnswers",
        {
          roomId,
          answers: answersArray,
          questionTexts: questionTextsArray,
          questionSources: questionSourcesArray,
          index: questionIndex,
        },
        (response) => {
          // 處理服務器響應
          if (response && !response.success) {
            console.error(`答案提交回調錯誤: ${response.error}`);
          } else {
            console.log("答案提交成功");
          }
        }
      );

      // 模擬本地投票狀態更新
      setVoteStats((prev) => {
        const updated = { ...prev };
        updated[answer] = (updated[answer] || 0) + 1;
        return updated;
      });
    },
    [questionIndex, roomId, safeQuestions]
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

    // 收到新投票事件 - 保存投票用戶資訊
    const handleNewVote = (voteData) => {
      if (!isMountedRef.current) return;

      // 顯示投票氣泡效果
      showVoteBubble(voteData);

      // 更新投票統計，使用函數式更新避免閉包問題
      setVoteStats((prev) => {
        const newStats = { ...prev };
        const option = voteData.option;
        newStats[option] = (newStats[option] || 0) + 1;

        // 保存投票用戶資訊
        if (!newStats.userData) {
          newStats.userData = [];
        }

        // 添加用戶資訊到列表
        newStats.userData.push({
          id: voteData.senderId || `user-${Date.now()}`,
          name: voteData.userName || "匿名用戶",
          option: option,
          timestamp: Date.now(),
        });

        return newStats;
      });
    };

    // 收到結束信號和餐廳推薦結果
    // 在 BuddiesQuestionSwiper.jsx 中改進推薦接收處理
    const handleGroupRecommendations = (recs) => {
      if (!isMountedRef.current) return;

      // 防止重複調用 onComplete
      if (hasCompletedRef.current) {
        console.log("已經處理過推薦結果，忽略重複事件");
        return;
      }

      console.log(
        "收到餐廳推薦結果:",
        recs ? recs.length : 0,
        "當前題目:",
        questionIndex
      );

      // 確保接收到有效數據
      if (!recs || !Array.isArray(recs) || recs.length === 0) {
        console.error("收到的推薦結果無效:", recs);
        return;
      }

      // 使用ref獲取最新狀態
      const result = {
        answers: Object.values(answersRef.current),
        questionTexts: questionTextsRef.current,
        questionSources: questionSourcesRef.current,
      };

      // 標記為已完成，防止重複調用
      hasCompletedRef.current = true;

      // 關鍵：確保一定調用onComplete
      console.log("準備調用onComplete函數");
      try {
        onComplete(result, recs);
        console.log("已調用onComplete函數");
      } catch (error) {
        console.error("調用onComplete出錯:", error);
        // 重新設置標記，允許再次嘗試
        hasCompletedRef.current = false;
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
        <div className="waiting-container">
          {/* 等待動畫移至頂部並放大 */}
          <div className="waiting-animation">
            <div className="waiting-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div className="waiting-text">{waitingText}</div>
          </div>

          {/* 投票統計視覺化 - 修復顯示邏輯 */}
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
                  .reduce((sum, [_, count]) => sum + count, 0)}{" "}
                票
              </div>
            </div>

            <div className="vote-distribution">
              {/* 直接顯示問題的兩個選項 */}
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

                      // 計算百分比，確保總和為100%
                      let leftPercentage =
                        totalVotes > 0
                          ? Math.round((leftCount / totalVotes) * 100)
                          : 0;
                      let rightPercentage = 100 - leftPercentage;

                      // 總是返回 motion.div，即使百分比為 0
                      return (
                        <motion.div
                          className={`vote-bar-left-single ${
                            showingResults ? "vote-pulse" : ""
                          }`}
                          initial={{ width: "0%" }}
                          animate={{ width: `${leftPercentage}%` }}
                          transition={{
                            duration: 0.8,
                            type: "spring",
                            stiffness: 80,
                            damping: 15,
                          }}
                        />
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* 投票人員頭像顯示 */}
            <div className="vote-participants">
              <div className="vote-participants-title">投票中的成員</div>
              <div className="vote-participants-avatars">
                {(() => {
                  if (!currentQuestion) return null;

                  const leftOption = currentQuestion.leftOption;
                  const rightOption = currentQuestion.rightOption;
                  const leftCount = voteStats[leftOption] || 0;
                  const rightCount = voteStats[rightOption] || 0;
                  const voterAvatars = [];

                  // 為左側選項創建頭像
                  for (let i = 0; i < leftCount; i++) {
                    voterAvatars.push(
                      <div
                        key={`left-voter-${i}`}
                        className="vote-participant-avatar"
                        style={{
                          backgroundColor: "#6874E8",
                          animationDelay: `${i * 0.1}s`,
                        }}
                      >
                        👤
                        <span className="vote-participant-name">
                          {`選擇${leftOption}`}
                        </span>
                      </div>
                    );
                  }

                  // 為右側選項創建頭像
                  for (let i = 0; i < rightCount; i++) {
                    voterAvatars.push(
                      <div
                        key={`right-voter-${i}`}
                        className="vote-participant-avatar"
                        style={{
                          backgroundColor: "#FF6B6B",
                          animationDelay: `${(i + leftCount) * 0.1}s`,
                        }}
                      >
                        👤
                        <span className="vote-participant-name">
                          {`選擇${rightOption}`}
                        </span>
                      </div>
                    );
                  }

                  return voterAvatars.length > 0 ? (
                    voterAvatars
                  ) : (
                    <div className="no-voters-message">等待成員投票...</div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <QuestionSwiperMotionSingle
          question={currentQuestion}
          onAnswer={handleAnswer}
          voteStats={voteStats}
          disableClickToVote={true}
        />
      )}
    </div>
  );
}
