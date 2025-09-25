import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { AnimatePresence } from "framer-motion";
import { motion as Motion } from "framer-motion";
import QuestionSwiperMotionSingle from "./QuestionSwiperMotionSingle";
import "./BuddiesVoteStyles.css";
import { useQuestions } from "./QuestionLoader";
import { 
  questionService, 
  roomService 
} from "../services/supabaseService";

export default function BuddiesQuestionSwiper({
  roomId,
  questions: propQuestions,
  onComplete,
  members = [],
  onQuestionsSync,
  userId: propUserId,
}) {
  // Load questions from Supabase for buddies mode
  const { questions: supabaseQuestions, loading: questionsLoading } = useQuestions('buddies');
  
  // 主要狀態
  const [questionIndex, setQuestionIndex] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [voteStats, setVoteStats] = useState({});
  const [voteBubbles, setVoteBubbles] = useState([]);
  const [localQuestions, setLocalQuestions] = useState(propQuestions || supabaseQuestions);
  const [allAnswers, setAllAnswers] = useState([]);

  // 使用 ref 来存储稳定的引用 - 需要在 useEffect 之前声明
  const safeQuestionsRef = useRef([]);
  const onCompleteRef = useRef(onComplete);
  const hasCompletedRef = useRef(false);
  const answersRef = useRef({});
  const isMountedRef = useRef(true);
  const timeoutRef = useRef(null);
  const questionTextsRef = useRef([]);
  const questionSourcesRef = useRef([]);
  const animationCompleteRef = useRef(false);
  const animationStartTimeRef = useRef(null);
  const userInteractionHandlerRef = useRef(null);

  // 更新 ref 值
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // 确保组件挂载状态正确
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // 直接清理而不依賴函數
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // 清理動畫偵測狀態
      animationCompleteRef.current = false;
      animationStartTimeRef.current = null;

      // 清理事件監聽器
      if (userInteractionHandlerRef.current) {
        document.removeEventListener('click', userInteractionHandlerRef.current);
        document.removeEventListener('touchstart', userInteractionHandlerRef.current);
        userInteractionHandlerRef.current = null;
      }
    };
  }, []);


  // Use Supabase questions if no questions provided via props
  useEffect(() => {
    if (propQuestions && propQuestions.length > 0) {
      setLocalQuestions(propQuestions);
    } else if (supabaseQuestions && supabaseQuestions.length > 0) {
      setLocalQuestions(supabaseQuestions);
    }
  }, [propQuestions, supabaseQuestions]);

  const userId = propUserId || roomService.getOrCreateUserId();

  // 創建基本問題文本列表
  const basicQuestionTexts = useMemo(() => {
    return localQuestions ? localQuestions.map((q) => q.text || q.question) : [];
  }, [localQuestions]);

  // 基於 buddiesBasicQuestions 判斷問題類型
  const isBuddiesBasicQuestion = useCallback(
    (text) => {
      return basicQuestionTexts.includes(text);
    },
    [basicQuestionTexts]
  );

  // 處理安全的問題格式化
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

  // 更新 safeQuestions ref
  useEffect(() => {
    safeQuestionsRef.current = safeQuestions;
  }, [safeQuestions]);

  // 獲取可見問題（簡化版，不處理複雜的跳過邏輯）
  const getVisibleQuestions = useCallback((allQuestions) => {
    return allQuestions;
  }, []);

  // 獲取當前問題
  const currentQuestion = useMemo(() => {
    const visibleQuestions = getVisibleQuestions(safeQuestions);
    return questionIndex < visibleQuestions.length
      ? visibleQuestions[questionIndex]
      : null;
  }, [safeQuestions, questionIndex, getVisibleQuestions]);

  // 監聽答案變化
  useEffect(() => {
    if (!roomId) return;

    console.log("🔄 設置答案監聽器，當前狀態:", {
      roomId,
      questionIndex,
      waiting,
      membersCount: members.length
    });

    const cleanup = questionService.listenAnswers(roomId, (answers) => {
      console.log("📬 收到答案更新:", answers);
      console.log("🎯 當前狀態快照:", {
        waiting,
        questionIndex,
        hasCompleted: hasCompletedRef.current,
        members: members.length
      });
      setAllAnswers(answers);

      // 計算當前題目的投票統計
      const stats = {};
      const userData = [];

      // 計算已答題的用戶ID列表
      const answeredUserIds = new Set();
      const activeMembers = members.filter(m => m.status !== 'left'); // 只計算活躍成員

      answers.forEach(answer => {
        if (answer.answers && Array.isArray(answer.answers)) {
          // 檢查該用戶是否已回答當前題目
          if (answer.answers.length > questionIndex &&
              answer.answers[questionIndex] != null &&
              answer.answers[questionIndex] !== "") {

            // 確保這個用戶還在房間內
            const isActiveMember = activeMembers.some(m => m.id === answer.user_id);
            if (isActiveMember) {
              answeredUserIds.add(answer.user_id);

              const userAnswer = answer.answers[questionIndex];
              stats[userAnswer] = (stats[userAnswer] || 0) + 1;
              userData.push({
                id: answer.user_id,
                name: members.find(m => m.id === answer.user_id)?.name || '用戶',
                option: userAnswer,
                timestamp: new Date(answer.submitted_at).getTime()
              });
            }
          }
        }
      });

      setVoteStats({ ...stats, userData, answeredUserIds: Array.from(answeredUserIds) });

      // 優化的下一題檢查機制 - 強制檢查進度，不管 waiting 狀態
      console.log("🔍 檢查是否需要進入下一題:", {
        waiting,
        hasCompleted: hasCompletedRef.current,
        answersLength: answers.length,
        shouldCheck: !hasCompletedRef.current
      });

      if (!hasCompletedRef.current) {
        const totalActiveMembers = Math.max(1, activeMembers.length); // 至少為1，避免除零錯誤
        const answeredCount = answeredUserIds.size;

        console.log("📊 優化後的答題進度檢查:", {
          questionIndex,
          totalActiveMembers,
          answeredCount,
          answeredUserIds: Array.from(answeredUserIds),
          activeMemberIds: activeMembers.map(m => m.id),
          allMembersData: members.map(m => ({ id: m.id, name: m.name, status: m.status })),
          waiting,
          progressPercentage: Math.round((answeredCount / totalActiveMembers) * 100) + '%'
        });

        // 強化的智能完成檢查：
        // 1. 如果沒有其他成員（單用戶），該用戶答題後立即進入下一題
        // 2. 如果是多用戶，等待所有人回答
        // 3. 特殊處理：如果成員數據為空但有答案，也進入下一題
        const shouldProceed =
          (members.length <= 1 && answeredCount >= 1) || // 單用戶或無成員數據
          (totalActiveMembers === 1 && answeredCount >= 1) || // 只有一個活躍成員
          (totalActiveMembers > 1 && answeredCount >= totalActiveMembers); // 多用戶全部完成

        console.log("🤔 進入下一題條件檢查:", {
          membersLength: members.length,
          totalActiveMembers,
          answeredCount,
          condition1_singleUser: members.length <= 1 && answeredCount >= 1,
          condition2_singleActive: totalActiveMembers === 1 && answeredCount >= 1,
          condition3_multiComplete: totalActiveMembers > 1 && answeredCount >= totalActiveMembers,
          shouldProceed,
          waitingState: waiting // 添加等待狀態到日誌
        });

        // 修改條件：不管 waiting 狀態，只要答題條件滿足就進入下一題
        if (shouldProceed && answeredCount > 0) {
          console.log("✅ 答題條件滿足，準備進入下一題");
          let triggerReason = "未知原因";
          if (members.length <= 1 && answeredCount >= 1) {
            triggerReason = "單用戶模式（成員數≤1）";
          } else if (totalActiveMembers === 1 && answeredCount >= 1) {
            triggerReason = "單活躍成員模式";
          } else if (totalActiveMembers > 1 && answeredCount >= totalActiveMembers) {
            triggerReason = "多用戶全部完成";
          }
          console.log("🎯 觸發條件:", triggerReason);

          // 使用穩定的引用避免競態條件
          const currentQuestionIndex = questionIndex;
          const visibleQuestions = safeQuestionsRef.current;
          const nextIndex = currentQuestionIndex + 1;

          console.log("🔍 下一題檢查詳情:", {
            currentQuestionIndex,
            nextIndex,
            visibleQuestionsLength: visibleQuestions.length,
            isMountedRef: isMountedRef.current
          });

          // 使用智能動畫偵測系統替代硬性延遲
          console.log("🚀 啟動智能動畫偵測系統");
          setupAnimationDetection(nextIndex, visibleQuestions);
        } else {
          // 顯示等待進度
          const waitingTime = Date.now() - (userData[0]?.timestamp || Date.now());
          if (waitingTime > 5000) { // 等待超過5秒時輸出進度
            console.log("⏳ 等待中...", {
              等待時間: Math.round(waitingTime / 1000) + '秒',
              進度: `${answeredCount}/${totalActiveMembers}`,
              缺少回答: activeMembers.filter(m => !answeredUserIds.has(m.id)).map(m => m.name)
            });
          }
        }
      }
    });

    return cleanup;
  }, [roomId, questionIndex, members]); // 移除 waiting 依賴避免循環


  // 智能動畫完成偵測系統
  const handleAnimationComplete = useCallback((nextIndex, visibleQuestions) => {
    console.log("🎬 動畫完成，準備進入下一題:", nextIndex);

    if (isMountedRef.current && !hasCompletedRef.current) {
      if (nextIndex >= visibleQuestions.length) {
        // 所有問題已完成
        console.log("🎉 所有問題已完成，提交最終答案");
        hasCompletedRef.current = true;

        const finalAnswers = Object.values(answersRef.current);
        const finalQuestionTexts = questionTextsRef.current.filter(Boolean);
        const finalQuestionSources = questionSourcesRef.current.filter(Boolean);

        onCompleteRef.current({
          answers: finalAnswers,
          questionTexts: finalQuestionTexts,
          questionSources: finalQuestionSources,
        });
      } else {
        // 進入下一題
        console.log("⏭️ 動畫系統觸發進入下一題:", nextIndex);
        setQuestionIndex(nextIndex);
        setWaiting(false);

        // 重置動畫狀態
        animationCompleteRef.current = false;
        animationStartTimeRef.current = null;
      }
    }
  }, []);

  // 動畫偵測和用戶互動處理
  const setupAnimationDetection = useCallback((nextIndex, visibleQuestions) => {
    console.log("🎭 設置智能動畫偵測系統");

    // 清理之前的事件監聽器
    if (userInteractionHandlerRef.current) {
      document.removeEventListener('click', userInteractionHandlerRef.current);
      document.removeEventListener('touchstart', userInteractionHandlerRef.current);
    }

    // 記錄動畫開始時間
    animationStartTimeRef.current = Date.now();
    animationCompleteRef.current = false;

    // 方法1: 最小等待時間（確保用戶看到動畫）
    const minWaitTime = 1200; // 最少1.2秒

    // 方法2: 動畫週期偵測（等待完整動畫週期）
    const animationCycleTime = 1500; // CSS中定義的動畫週期

    // 方法3: 用戶互動偵測
    const handleUserInteraction = () => {
      const elapsedTime = Date.now() - animationStartTimeRef.current;
      if (elapsedTime >= minWaitTime && !animationCompleteRef.current) {
        console.log("👆 用戶互動觸發，提前進入下一題 (已等待", elapsedTime, "ms)");
        animationCompleteRef.current = true;

        // 清理事件監聽器
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('touchstart', handleUserInteraction);
        userInteractionHandlerRef.current = null;

        handleAnimationComplete(nextIndex, visibleQuestions);
      }
    };

    // 儲存處理器引用並添加用戶互動監聽器
    userInteractionHandlerRef.current = handleUserInteraction;
    document.addEventListener('click', handleUserInteraction, { once: false });
    document.addEventListener('touchstart', handleUserInteraction, { once: false });

    // 設置動畫完成檢查
    const checkAnimationComplete = () => {
      const elapsedTime = Date.now() - animationStartTimeRef.current;

      if (animationCompleteRef.current) {
        // 動畫已完成（用戶互動觸發）
        return;
      }

      // 檢查是否達到一個完整的動畫週期 + 額外觀看時間
      if (elapsedTime >= animationCycleTime + 800) {
        console.log("⏰ 動畫週期完成，自動進入下一題 (等待了", elapsedTime, "ms)");
        animationCompleteRef.current = true;

        // 清理事件監聽器
        if (userInteractionHandlerRef.current) {
          document.removeEventListener('click', userInteractionHandlerRef.current);
          document.removeEventListener('touchstart', userInteractionHandlerRef.current);
          userInteractionHandlerRef.current = null;
        }

        handleAnimationComplete(nextIndex, visibleQuestions);
      } else {
        // 繼續檢查
        setTimeout(checkAnimationComplete, 100);
      }
    };

    // 開始檢查
    setTimeout(checkAnimationComplete, minWaitTime);

    console.log("🎯 動畫偵測配置:", {
      最小等待時間: minWaitTime + "ms",
      動畫週期: animationCycleTime + "ms",
      總最大等待: (animationCycleTime + 800) + "ms",
      用戶可互動: "點擊或觸摸提前進入"
    });

  }, [handleAnimationComplete]);

  // 清理所有計時器和事件監聽器的函數
  const clearAllTimeouts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // 清理動畫偵測狀態
    animationCompleteRef.current = false;
    animationStartTimeRef.current = null;

    // 正確清理事件監聽器
    if (userInteractionHandlerRef.current) {
      document.removeEventListener('click', userInteractionHandlerRef.current);
      document.removeEventListener('touchstart', userInteractionHandlerRef.current);
      userInteractionHandlerRef.current = null;
    }
  }, []);

  // 顯示投票氣泡動畫（簡化版）
  const showVoteBubble = useCallback((voteData) => {
    if (!isMountedRef.current) return;

    const voteId = `${voteData.userId}-${voteData.timestamp || Date.now()}`;
    
    const newBubble = {
      id: voteId,
      option: voteData.option,
      userName: voteData.userName || "有人",
      timestamp: voteData.timestamp || Date.now(),
    };

    setVoteBubbles((prev) => {
      const newBubbles = [newBubble, ...prev].slice(0, 3);
      return newBubbles;
    });

    setTimeout(() => {
      if (isMountedRef.current) {
        setVoteBubbles((prev) => prev.filter((bubble) => bubble.id !== voteId));
      }
    }, 2000);
  }, []);

  // 處理答案
  const handleAnswer = useCallback(
    async (answer) => {
      if (!currentQuestion || hasCompletedRef.current) return;

      try {
        // 記錄當前問題的答案
        answersRef.current[questionIndex] = answer;

        // 記錄問題文本和來源
        if (!questionTextsRef.current[questionIndex]) {
          questionTextsRef.current[questionIndex] = currentQuestion.text;
        }
        if (!questionSourcesRef.current[questionIndex]) {
          questionSourcesRef.current[questionIndex] = currentQuestion.source;
        }

        // 立即提交當前進度到數據庫，用於實時同步
        console.log("📝 立即提交當前答題進度到數據庫");
        const currentAnswers = Object.values(answersRef.current).filter(Boolean);
        const currentQuestionTexts = questionTextsRef.current.filter(Boolean);
        const currentQuestionSources = questionSourcesRef.current.filter(Boolean);

        // 提交到 Supabase (只包含已回答的題目)
        await questionService.submitAnswers(
          roomId,
          userId,
          currentAnswers,
          currentQuestionTexts,
          currentQuestionSources
        );

        // 顯示投票氣泡
        const currentUser = members.find(m => m.id === userId);
        showVoteBubble({
          userId: userId,
          option: answer,
          userName: currentUser?.name || '你',
          timestamp: Date.now()
        });

        // 切換到等待狀態
        setWaiting(true);

        // 檢查是否還有更多問題
        const visibleQuestions = getVisibleQuestions(safeQuestions);
        const nextIndex = questionIndex + 1;

        if (nextIndex >= visibleQuestions.length) {
          // 所有問題已完成
          hasCompletedRef.current = true;

          const completeTimeout = setTimeout(() => {
            if (isMountedRef.current) {
              const finalAnswers = Object.values(answersRef.current);
              const finalQuestionTexts = questionTextsRef.current.filter(Boolean);
              const finalQuestionSources = questionSourcesRef.current.filter(Boolean);

              onComplete({
                answers: finalAnswers,
                questionTexts: finalQuestionTexts,
                questionSources: finalQuestionSources,
              });
            }
          }, 1500);

          // 保存超時引用以便清理
          timeoutRef.current = completeTimeout;
        } else {
          // 在 Buddies 模式下，等待所有人答題完畢才能進入下一題
          console.log("🔄 等待其他成員完成答題，當前題目索引:", questionIndex);

          // 設置備用超時機制，防止永遠卡住（30秒後自動進入下一題）
          const fallbackTimeout = setTimeout(() => {
            if (isMountedRef.current && waiting) {
              console.log("⚠️ 備用超時觸發，強制進入下一題");
              console.log("📊 超時時的狀態:", {
                questionIndex,
                members: members.length,
                answersReceived: allAnswers.length,
                currentAnswers: Object.keys(answersRef.current)
              });

              setQuestionIndex(nextIndex);
              setWaiting(false);
            }
          }, 30000); // 30秒備用超時

          // 保存超時引用以便清理
          timeoutRef.current = fallbackTimeout;
        }
      } catch (error) {
        console.error("處理答案時發生錯誤:", error);
        // 發生錯誤時，確保不會永久卡在等待狀態
        setWaiting(false);
      }
    },
    [currentQuestion, questionIndex, safeQuestions, members, userId, onComplete, getVisibleQuestions, showVoteBubble, clearAllTimeouts]
  );

  // 渲染投票氣泡
  const renderVoteBubbles = () => {
    return (
      <div className="vote-bubbles-container">
        <AnimatePresence>
          {voteBubbles.map((bubble) => (
            <Motion.div
              key={bubble.id}
              className="vote-bubble"
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <span className="vote-bubble-user">{bubble.userName}</span>
              <span className="vote-bubble-option">選擇了 {bubble.option}</span>
            </Motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  };

  if (!currentQuestion) {
    return (
      <div className="question-complete-container">
        <h3>問答完成！</h3>
        <p>正在處理結果...</p>
      </div>
    );
  }

  return (
    <div className="buddies-question-swiper">
      {renderVoteBubbles()}
      
      {waiting ? (
        <div className="waiting-container">
          <div className="waiting-content">
            <h2>等待其他成員回答...</h2>
            <div className="waiting-animation">
              <div className="waiting-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div className="waiting-text">處理中...</div>
            </div>
            <div className="question-preview">
              <p className="question-text">{currentQuestion.text}</p>
            </div>

            {/* 投票統計顯示 */}
            <div className="vote-display-container-single">
              <div className="vote-options-labels">
                <div className="vote-option-label left">
                  <span className="vote-option-name">
                    {currentQuestion.leftOption}
                  </span>
                  <span className="vote-count">
                    {voteStats[currentQuestion.leftOption] || 0} 票
                  </span>
                </div>
                <div className="vote-option-label right">
                  <span className="vote-option-name">
                    {currentQuestion.rightOption}
                  </span>
                  <span className="vote-count">
                    {voteStats[currentQuestion.rightOption] || 0} 票
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
                        style={{
                          backgroundColor: '#4A90E2',
                          position: 'absolute',
                          left: 0,
                          height: '100%',
                          borderRadius: '10px 0 0 10px'
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
                        style={{
                          backgroundColor: '#FF6B6B',
                          position: 'absolute',
                          right: 0,
                          height: '100%',
                          borderRadius: '0 10px 10px 0'
                        }}
                      />
                      {totalVotes > 0 && (
                        <div className="vote-percentages" style={{
                          position: 'absolute',
                          top: '-25px',
                          left: 0,
                          right: 0,
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          color: '#333'
                        }}>
                          <span className="vote-percentage-left" style={{ color: '#4A90E2' }}>
                            {leftPercentage}%
                          </span>
                          <span className="vote-percentage-right" style={{ color: '#FF6B6B' }}>
                            {rightPercentage}%
                          </span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* 投票總數顯示 */}
              {voteStats.answeredUserIds && voteStats.answeredUserIds.length > 0 && (
                <div style={{
                  textAlign: 'center',
                  marginTop: '1rem',
                  fontSize: '0.9rem',
                  color: '#666',
                  backgroundColor: '#f8f9fa',
                  padding: '0.5rem',
                  borderRadius: '8px'
                }}>
                  <span role="img" aria-label="chart">📊</span>
                  {' '}總投票數：{voteStats.answeredUserIds.length} / {members.length}
                </div>
              )}
            </div>

            {/* 已投票用戶顯示 */}
            <div className="vote-members-section">
              <div className="vote-members-title">
                <span role="img" aria-label="voted">✅</span>
                已作答 ({voteStats.answeredUserIds ? voteStats.answeredUserIds.length : 0}/{members.length})
              </div>
              <div className="vote-members-list">
                {voteStats.answeredUserIds && voteStats.answeredUserIds.length > 0 ? (
                  voteStats.answeredUserIds.map((userId) => {
                    const memberInfo = members.find((m) => m.id === userId);
                    const userVote = voteStats.userData?.find(u => u.id === userId);
                    return (
                      <div
                        key={`voter-${userId}`}
                        className="vote-member-item voted"
                      >
                        <span className="vote-member-icon">👤</span>
                        <span className="vote-member-name">
                          {memberInfo?.name || "用戶"}
                        </span>
                        {userVote && (
                          <span className="vote-member-choice">
                            選擇：{userVote.option}
                          </span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="no-voters-message">等待成員作答...</div>
                )}
              </div>
            </div>

            {/* 未投票用戶顯示 */}
            <div className="vote-members-section">
              <div className="vote-members-title">
                <span role="img" aria-label="waiting">⏳</span>
                尚未作答 ({members.length - (voteStats.answeredUserIds ? voteStats.answeredUserIds.length : 0)}/{members.length})
              </div>
              <div className="vote-members-list">
                {(() => {
                  if (members.length === 0) {
                    return <div className="no-voters-message">沒有成員</div>;
                  }

                  const unansweredMembers = members.filter(
                    (member) => !voteStats.answeredUserIds?.includes(member.id)
                  );

                  if (unansweredMembers.length === 0) {
                    return <div className="no-voters-message">所有成員都已作答</div>;
                  }

                  return unansweredMembers.map((member) => (
                    <div
                      key={`waiting-${member.id}`}
                      className="vote-member-item waiting"
                    >
                      <span className="vote-member-icon">👤</span>
                      <span className="vote-member-name">
                        {member.name || "用戶"}
                      </span>
                      <span className="vote-member-status">
                        思考中...
                      </span>
                    </div>
                  ));
                })()}
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
            userId={userId}
          />
        </div>
      )}
    </div>
  );
}