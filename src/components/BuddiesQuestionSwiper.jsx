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

  // Use Supabase questions if no questions provided via props
  useEffect(() => {
    if (propQuestions && propQuestions.length > 0) {
      setLocalQuestions(propQuestions);
    } else if (supabaseQuestions && supabaseQuestions.length > 0) {
      setLocalQuestions(supabaseQuestions);
    }
  }, [propQuestions, supabaseQuestions]);

  // Refs
  const hasCompletedRef = useRef(false);
  const answersRef = useRef({});
  const isMountedRef = useRef(true);
  const timeoutRef = useRef(null);
  const questionTextsRef = useRef([]);
  const questionSourcesRef = useRef([]);
  const userId = roomService.getOrCreateUserId();

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
    if (roomId) {
      const cleanup = questionService.listenAnswers(roomId, (answers) => {
        setAllAnswers(answers);
        
        // 計算投票統計
        const stats = {};
        const userData = [];
        
        answers.forEach(answer => {
          if (answer.answers && Array.isArray(answer.answers)) {
            answer.answers.forEach((userAnswer, questionIdx) => {
              if (questionIdx === questionIndex) {
                stats[userAnswer] = (stats[userAnswer] || 0) + 1;
                userData.push({
                  id: answer.user_id,
                  name: members.find(m => m.id === answer.user_id)?.name || '用戶',
                  option: userAnswer,
                  timestamp: new Date(answer.submitted_at).getTime()
                });
              }
            });
          }
        });
        
        setVoteStats({ ...stats, userData });
      });

      return cleanup;
    }
  }, [roomId, questionIndex, members]);

  // 組件卸載時清理
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // 清理所有計時器的函數
  const clearAllTimeouts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
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

      // 記錄當前問題的答案
      answersRef.current[questionIndex] = answer;

      // 記錄問題文本和來源
      if (!questionTextsRef.current[questionIndex]) {
        questionTextsRef.current[questionIndex] = currentQuestion.text;
      }
      if (!questionSourcesRef.current[questionIndex]) {
        questionSourcesRef.current[questionIndex] = currentQuestion.source;
      }

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
        
        setTimeout(() => {
          const finalAnswers = Object.values(answersRef.current);
          const finalQuestionTexts = questionTextsRef.current.filter(Boolean);
          const finalQuestionSources = questionSourcesRef.current.filter(Boolean);

          onComplete({
            answers: finalAnswers,
            questionTexts: finalQuestionTexts,
            questionSources: finalQuestionSources,
          });
        }, 1500);
      } else {
        // 等待一會兒後進入下一題
        timeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setQuestionIndex(nextIndex);
            setWaiting(false);
            clearAllTimeouts();
          }
        }, 2000);
      }
    },
    [currentQuestion, questionIndex, safeQuestions, members, userId, onComplete, getVisibleQuestions, showVoteBubble]
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
            <h3>等待其他成員回答...</h3>
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
                      <div className="vote-percentages">
                        <span className="vote-percentage-left">
                          {leftPercentage}%
                        </span>
                        <span className="vote-percentage-right">
                          {rightPercentage}%
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* 已投票用戶顯示 */}
            <div className="vote-members-section">
              <div className="vote-members-title">
                <span role="img" aria-label="voted">✅</span>
                已作答
              </div>
              <div className="vote-members-list">
                {(() => {
                  if (voteStats.userData && Array.isArray(voteStats.userData)) {
                    return voteStats.userData.map((user) => {
                      const memberInfo = members.find((m) => m.id === user.id);
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
                <span role="img" aria-label="waiting">⏳</span>
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