import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import socket from "../services/socket";
import { AnimatePresence } from "framer-motion";
import { motion as Motion } from "framer-motion";
import QuestionSwiperMotionSingle from "./QuestionSwiperMotionSingle";
import "./BuddiesVoteStyles.css";
import { buddiesBasicQuestions } from "../data/buddiesBasicQuestions";

export default function BuddiesQuestionSwiper({
  roomId,
  questions,
  onComplete,
  members = [],
  onQuestionsSync,
}) {
  // 主要狀態
  const [questionIndex, setQuestionIndex] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [voteStats, setVoteStats] = useState({});
  const [voteBubbles, setVoteBubbles] = useState([]); // 改為數組，存儲多個氣泡
  const [localQuestions, setLocalQuestions] = useState(questions);

  // props.questions 變動時自動同步
  useEffect(() => {
    setLocalQuestions(questions);
  }, [questions]);

  // Refs - 不會觸發重新渲染
  const hasCompletedRef = useRef(false);
  const answersRef = useRef({});
  const isMountedRef = useRef(true);
  const timeoutRef = useRef(null);
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

  // 處理安全的問題格式化 - 必須先初始化
  const safeQuestions = useMemo(
    () =>
      Array.isArray(localQuestions)
        ? localQuestions.map((q, index) => ({
            id: q.id || `q${index}`,
            text: q.text || "",
            leftOption: q.leftOption || "選項 A",
            rightOption: q.rightOption || "選項 B",
            hasVS: q.hasVS || false,
            source:
              q.source ||
              (q.text && isBuddiesBasicQuestion(q.text) ? "basic" : "fun"),
          }))
        : [],
    [localQuestions, isBuddiesBasicQuestion]
  );

  // 新增: 根據已有答案過濾問題
  const getVisibleQuestions = useCallback(
    (allQuestions) => {
      // 檢查是否有需要跳過的問題
      const skipSet = voteStats?.skipQuestions
        ? new Set(voteStats.skipQuestions)
        : new Set();

      // 找到「想吃正餐還是想喝飲料」問題的索引
      const eatOrDrinkIndex = allQuestions.findIndex(
        (q) => q.text && q.text.includes("想吃正餐還是想喝飲料")
      );

      // 獲取房主對「吃/喝」問題的選擇
      const hostEatDrinkChoice = voteStats?.hostAnswers?.[eatOrDrinkIndex];

      return allQuestions.filter((q, index) => {
        // 如果這個問題在跳過列表中，不顯示
        if (skipSet.has(index)) {
          console.log(`問題 ${index} 在跳過列表中`);
          return false;
        }

        // 檢查是否是飲食相關問題
        if (q.text && (q.text.includes("吃一點") || q.text.includes("辣的"))) {
          // 如果房主已選擇「喝」，跳過這些問題
          if (hostEatDrinkChoice === "喝") {
            console.log(`問題 ${index} 因為房主選擇了喝而跳過`);
            return false;
          }

          // 如果房主還沒有回答吃/喝問題，且當前問題在吃/喝問題之後，暫時不顯示
          if (!hostEatDrinkChoice && index > eatOrDrinkIndex) {
            console.log(`問題 ${index} 等待房主選擇吃/喝`);
            return false;
          }
        }

        return true;
      });
    },
    [voteStats]
  );

  // 使用 useMemo 獲取當前應該顯示的問題
  const currentQuestion = useMemo(() => {
    const visibleQuestions = getVisibleQuestions(safeQuestions);
    console.log("當前可見問題數量:", visibleQuestions.length);
    return questionIndex < visibleQuestions.length
      ? visibleQuestions[questionIndex]
      : null;
  }, [safeQuestions, questionIndex, getVisibleQuestions]);

  // 清理所有計時器的函數
  const clearAllTimeouts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // 使用 ref 來追蹤已顯示的投票
  const displayedVotesRef = useRef(new Set());

  // 顯示投票氣泡動畫
  const showVoteBubble = useCallback((voteData) => {
    if (!isMountedRef.current) return;

    // 避免顯示自己的投票
    if (voteData.senderId === socket.id) return;

    // 生成唯一的投票 ID
    const voteId = `${voteData.senderId}-${voteData.timestamp || Date.now()}`;

    // 檢查這個投票是否已經顯示過
    if (displayedVotesRef.current.has(voteId)) {
      console.log("Skip duplicate vote bubble:", voteId);
      return;
    }

    // 記錄這個投票已經顯示
    displayedVotesRef.current.add(voteId);

    // 創建新的投票氣泡
    const newBubble = {
      id: voteId,
      option: voteData.option,
      userName: voteData.userName || "有人",
      timestamp: voteData.timestamp || Date.now(),
    };

    // 添加新氣泡到數組
    setVoteBubbles((prev) => {
      // 限制最多顯示3個氣泡
      const newBubbles = [newBubble, ...prev].slice(0, 3);
      return newBubbles;
    });

    // 2秒後移除此氣泡
    setTimeout(() => {
      if (isMountedRef.current) {
        setVoteBubbles((prev) => prev.filter((bubble) => bubble.id !== voteId));
      }
    }, 2000);

    // 30秒後從已顯示集合中移除，允許再次顯示（以防同一用戶在新一輪投票中再次投票）
    setTimeout(() => {
      if (isMountedRef.current) {
        displayedVotesRef.current.delete(voteId);
      }
    }, 30000);
  }, []);

  // 處理投票統計更新
  const handleVoteStatsUpdate = useCallback(
    (stats) => {
      if (!isMountedRef.current) return;

      // 保存跳過問題信息
      if (stats.skipQuestions) {
        console.log("更新需要跳過的問題:", stats.skipQuestions);
      }

      // 更新投票統計
      setVoteStats((prev) => {
        // 合併新的投票數據，保留現有的 hostAnswers
        const updatedStats = {
          ...stats,
          hostAnswers: {
            ...(prev?.hostAnswers || {}),
            ...(stats.hostAnswers || {}),
          },
        };

        // 如果有新的用戶數據，處理投票統計
        if (stats.userData && Array.isArray(stats.userData)) {
          const voteCounts = {};
          const prevUserData = prev?.userData || [];

          // 找出新的投票
          const newVotes = stats.userData.filter((vote) => {
            return !prevUserData.some(
              (prevVote) =>
                prevVote.id === vote.id &&
                prevVote.option === vote.option &&
                prevVote.timestamp === vote.timestamp
            );
          });

          // 計算票數
          stats.userData.forEach((vote) => {
            if (vote.option) {
              voteCounts[vote.option] = (voteCounts[vote.option] || 0) + 1;
            }
          });

          // 顯示新投票的泡泡
          newVotes.forEach((vote) => {
            if (vote.id !== socket.id) {
              const voter = members.find((m) => m.id === vote.id);
              showVoteBubble({
                option: vote.option,
                senderId: vote.id,
                userName: voter ? voter.name : "有人",
                timestamp: vote.timestamp,
              });
            }
          });

          return {
            ...updatedStats,
            ...voteCounts,
            userData: stats.userData,
          };
        }

        return updatedStats;
      });
    },
    [showVoteBubble, members, socket.id]
  );

  // 處理推薦結果
  const handleGroupRecommendations = useCallback(
    (recommendations) => {
      if (!isMountedRef.current || hasCompletedRef.current) return;

      console.log("收到推薦結果:", recommendations);

      // 適應新的數據格式
      let recs = recommendations;
      if (
        recommendations &&
        typeof recommendations === "object" &&
        recommendations.recommendations
      ) {
        recs = recommendations.recommendations;
        console.log("解析推薦數據:", recs.length);
      }

      // 確保推薦結果有效
      if (!Array.isArray(recs) || recs.length === 0) {
        console.error("收到無效的推薦結果");
        return;
      }

      hasCompletedRef.current = true;

      // 清理計時器
      clearAllTimeouts();

      // 調用完成回調
      if (typeof onComplete === "function") {
        // 確保傳遞有效的推薦結果
        const validRecommendations = recs.filter((r) => r && r.id);
        if (validRecommendations.length > 0) {
          console.log("傳遞有效推薦結果到父組件:", validRecommendations.length);
          onComplete(validRecommendations);
        } else {
          console.error("沒有有效的推薦結果");
        }
      }
    },
    [onComplete, clearAllTimeouts]
  );

  useEffect(() => {
    console.log("初始化問題同步監聽");

    // 監聽問題同步事件
    const handleSyncQuestions = (data) => {
      if (!isMountedRef.current) return;
      if (data && data.questions && Array.isArray(data.questions)) {
        setLocalQuestions(data.questions);
        setQuestionIndex(0);
        // 其他重置...
        console.log("收到房間同步問題集:", data.questions.length);

        // 如果使用 props 管理問題集，可以通過回調通知父組件
        if (typeof onQuestionsSync === "function") {
          onQuestionsSync(data.questions);
        }

        // 重置答案和問題進度
        answersRef.current = {};
        questionTextsRef.current = [];
        questionSourcesRef.current = [];

        // 重置為第一題
        setWaiting(false);
        setVoteStats({});
        setVoteBubbles([]);
      }
    };

    socket.on("syncQuestions", handleSyncQuestions);

    return () => {
      socket.off("syncQuestions", handleSyncQuestions);
    };
  }, []);

  // 處理答案提交
  const handleAnswer = useCallback(
    (answer) => {
      if (!isMountedRef.current) return;

      console.log(`提交答案: ${answer}, 題目 ${questionIndex}`);
      setWaiting(true);

      // 檢查是否為房主
      const isCurrentUserHost = members.some(
        (m) => m.id === socket.id && m.isHost
      );
      console.log("當前用戶是否為房主:", isCurrentUserHost);

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

      // 計算所有可見問題（考慮依賴關係）
      const visibleQuestions = getVisibleQuestions(safeQuestions);
      const totalVisibleQuestions = visibleQuestions.length;

      // 檢查是否是最後一題
      const isLastQuestion = questionIndex === totalVisibleQuestions - 1;

      // 發送答案到服務器，包含房主資訊
      socket.emit(
        "submitAnswers",
        {
          roomId,
          answers: answersArray,
          questionTexts: questionTextsArray,
          questionSources: questionSourcesArray,
          index: questionIndex,
          totalQuestions: totalVisibleQuestions,
          isHost: isCurrentUserHost,
          currentAnswerCount: Object.keys(newAnswers).length,
          isLastQuestion,
          answerQuestionMap: questionTextsArray.reduce((map, text, idx) => {
            if (text) map[idx] = text;
            return map;
          }, {}),
        },
        (response) => {
          if (response && !response.success) {
            console.error(`答案提交回調錯誤: ${response.error}`);
            setWaiting(false);
          } else {
            console.log(
              `答案提交成功，當前題目：${questionIndex}/${
                totalVisibleQuestions - 1
              }，是否為房主：${isCurrentUserHost}，是否最後一題：${isLastQuestion}`
            );

            // 如果是最後一題，主動請求推薦結果
            if (isLastQuestion) {
              console.log("這是最後一題，準備請求推薦結果");

              // 構建答案陣列，確保順序正確
              const finalAnswers = [];
              const visibleQuestions = getVisibleQuestions(safeQuestions);

              visibleQuestions.forEach((question, idx) => {
                const answer = answersRef.current[idx];
                if (answer) {
                  finalAnswers.push(answer);
                }
              });

              console.log("最終答案陣列:", finalAnswers);

              // 發送推薦請求
              socket.emit(
                "getBuddiesRecommendations",
                {
                  roomId,
                  answers: finalAnswers,
                  questionTexts: questionTextsArray,
                  questionSources: questionSourcesArray,
                  totalAnswers: finalAnswers.length,
                  isHost: isCurrentUserHost,
                },
                (response) => {
                  if (response && response.success) {
                    console.log("成功請求推薦結果");
                    if (response.recommendations) {
                      handleGroupRecommendations(response.recommendations);
                    }
                  } else {
                    console.error("請求推薦結果失敗:", response?.error);
                    // 如果失敗，3秒後自動重試，最多重試3次
                    let retryCount = 0;
                    const retryInterval = setInterval(() => {
                      if (retryCount < 3) {
                        console.log(`第 ${retryCount + 1} 次重試請求推薦結果`);
                        socket.emit("getBuddiesRecommendations", {
                          roomId,
                          answers: finalAnswers,
                          questionTexts: questionTextsArray,
                          questionSources: questionSourcesArray,
                          totalAnswers: finalAnswers.length,
                          isHost: isCurrentUserHost,
                        });
                        retryCount++;
                      } else {
                        clearInterval(retryInterval);
                        console.error("推薦結果請求重試次數已達上限");
                        // 通知父組件切換到推薦階段，即使沒有收到推薦結果
                        if (typeof onComplete === "function") {
                          onComplete([]);
                        }
                      }
                    }, 3000);
                  }
                }
              );
            }
          }
        }
      );
    },
    [
      questionIndex,
      roomId,
      safeQuestions,
      isBuddiesBasicQuestion,
      getVisibleQuestions,
      members,
      socket.id,
      handleGroupRecommendations,
    ]
  );

  // 處理下一題信號
  const handleNextQuestion = useCallback(
    (data) => {
      console.log(`收到下一題信號: ${JSON.stringify(data)}`);

      if (!isMountedRef.current) return;

      // 清理計時器
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // 獲取下一題索引
      let nextIndex = data.nextIndex;
      const skipSet = new Set(data.skipQuestions || []);

      // 確保不會跳到需要跳過的問題
      while (skipSet.has(nextIndex) && nextIndex < safeQuestions.length) {
        console.log(`跳過問題 ${nextIndex}`);
        nextIndex++;
      }

      console.log(`將跳轉到題目 ${nextIndex}`);

      // 更新 voteStats 中的跳過問題列表
      setVoteStats((prev) => ({
        ...prev,
        skipQuestions: Array.from(skipSet),
        hostAnswers: data.hostAnswers || prev.hostAnswers,
      }));

      // 設置延遲以確保動畫順暢
      const delay = data.isLastUser ? 2000 : 100;
      timeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setQuestionIndex(nextIndex);
          setWaiting(false);
        }
      }, delay);
    },
    [safeQuestions.length]
  );

  // 處理Socket事件監聽 - 這是主要的useEffect
  useEffect(() => {
    console.log("初始化Socket事件監聽，當前題目:", questionIndex);

    isMountedRef.current = true;

    // 處理問題流程更新
    const handleQuestionFlowUpdate = (data) => {
      if (!isMountedRef.current) return;

      console.log("收到問題流程更新:", data);

      // 更新跳過問題的設置
      if (data.skipQuestions) {
        console.log("需要跳過的問題:", data.skipQuestions);
        setVoteStats((prev) => ({
          ...prev,
          skipQuestions: data.skipQuestions,
          hostAnswers: {
            ...(prev.hostAnswers || {}),
            [data.currentIndex]: data.hostChoice,
          },
        }));
      }

      // 如果是當前問題的房主選擇，更新狀態
      if (data.currentIndex === questionIndex) {
        setVoteStats((prev) => ({
          ...prev,
          hostVote: data.hostChoice,
        }));
      }
    };

    // 註冊事件監聽器
    socket.on("updateQuestionFlow", handleQuestionFlowUpdate);
    socket.on("nextQuestion", handleNextQuestion);
    socket.on("voteStats", handleVoteStatsUpdate);
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
    socket.on("connect", sendReadySignal);

    // 清理函數
    return () => {
      console.log("清理Socket事件監聽");
      isMountedRef.current = false;
      socket.off("updateQuestionFlow", handleQuestionFlowUpdate);
      socket.off("nextQuestion", handleNextQuestion);
      socket.off("voteStats", handleVoteStatsUpdate);
      socket.off("groupRecommendations", handleGroupRecommendations);
      socket.off("connect", sendReadySignal);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [questionIndex, roomId, safeQuestions, handleGroupRecommendations]);

  // 組件卸載時清理
  useEffect(() => {
    return () => {
      displayedVotesRef.current.clear();
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
        <Motion.div
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
        </Motion.div>
      </div>
    );
  }

  // 確保當前問題有效
  if (!currentQuestion) {
    return <div>載入問題中...</div>;
  }

  return (
    <div className="question-container">
      {/* 投票浮動指示器 */}
      <div className="vote-bubbles-container">
        <AnimatePresence>
          {voteBubbles.map((bubble) => (
            <Motion.div
              key={bubble.id}
              className="vote-bubble"
              initial={{ opacity: 0, y: -20, x: 20 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, y: 20, x: 20 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <div className="vote-bubble-content">
                <div className="vote-bubble-name">{bubble.userName}</div>
                <div className="vote-bubble-choice">
                  選擇了「{bubble.option}」
                </div>
              </div>
            </Motion.div>
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
                            <Motion.div
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
                            <Motion.div
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
                              <Motion.div
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
                              </Motion.div>
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
