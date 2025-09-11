import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { QRCode } from "react-qrcode-logo";
import "./BuddiesRoom.css";
import { useQuestions } from "./QuestionLoader";
import QuestionSwiperMotion from "./QuestionSwiperMotion";
import BuddiesRecommendation from "./BuddiesRecommendation";
import QRScannerModal from "./QRScannerModal";
import BuddiesQuestionSwiper from "./BuddiesQuestionSwiper";
import {
  roomService,
  memberService,
  questionService,
  recommendationService,
  cleanupAllSubscriptions
} from "../services/supabaseService";

export default function BuddiesRoom() {
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [userId, setUserId] = useState("");
  const [phase, setPhase] = useState("lobby");
  const [questions, setQuestions] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const [copyingRoom, setCopyingRoom] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Cleanup functions for subscriptions
  const [subscriptionCleanups, setSubscriptionCleanups] = useState([]);

  function ToastNotification({ message, type, visible, onHide }) {
    if (!visible) return null;

    return (
      <div
        className={`toast-notification ${type || "success"}`}
        onClick={onHide}
      >
        <div className="toast-icon">{type === "error" ? "✖" : "✓"}</div>
        <div className="toast-message">{message}</div>
      </div>
    );
  }

  // 初始化用戶ID和處理URL參數
  useEffect(() => {
    const storedUserId = roomService.getOrCreateUserId();
    setUserId(storedUserId);

    const storedName = localStorage.getItem("userName");
    if (storedName) {
      setUserName(storedName);
    }

    // 處理URL參數
    const params = new URLSearchParams(location.search);
    const roomParam = params.get("room") || params.get("roomId");

    if (roomParam) {
      setRoomId(roomParam.toUpperCase());

      // 更新URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("room");
      newUrl.searchParams.delete("roomId");
      window.history.replaceState({}, "", newUrl);
    }

    // 清理函數
    return () => {
      cleanupAllSubscriptions();
      subscriptionCleanups.forEach(cleanup => cleanup());
    };
  }, [location.search]);

  // 監聽房間成員變化
  useEffect(() => {
    if (joined && roomId) {
      const cleanup = memberService.listenRoomMembers(roomId, (membersObj) => {
        console.log("收到成員更新:", membersObj);
        
        // 轉換成陣列格式
        const membersList = Object.values(membersObj).map(member => ({
          id: member.id,
          name: member.name,
          isHost: member.isHost,
          uid: member.id
        }));

        setMembers(membersList);

        // 檢查當前用戶是否為房主
        const currentUser = membersObj[userId];
        if (currentUser && currentUser.isHost) {
          setIsHost(true);
        }
      });

      setSubscriptionCleanups(prev => [...prev, cleanup]);

      return () => cleanup();
    }
  }, [joined, roomId, userId]);

  // 監聽房間狀態變化
  useEffect(() => {
    if (joined && roomId) {
      const cleanup = roomService.listenRoomStatus(roomId, (status) => {
        console.log("房間狀態變化:", status);
        if (status === 'questions') {
          setPhase('questions');
        } else if (status === 'recommend') {
          setPhase('recommend');
        } else if (status === 'completed') {
          setPhase('completed');
        }
      });

      setSubscriptionCleanups(prev => [...prev, cleanup]);

      return () => cleanup();
    }
  }, [joined, roomId]);

  // 監聽問題集變化
  useEffect(() => {
    if (joined && roomId) {
      const cleanup = questionService.listenQuestions(roomId, (questions) => {
        console.log("收到問題集更新:", questions);
        setQuestions(questions);
        if (questions.length > 0 && phase === 'waiting') {
          setPhase('questions');
        }
      });

      setSubscriptionCleanups(prev => [...prev, cleanup]);

      return () => cleanup();
    }
  }, [joined, roomId, phase]);

  // 監聽推薦變化
  useEffect(() => {
    if (joined && roomId) {
      const cleanup = recommendationService.listenRecommendations(roomId, (recommendations) => {
        console.log("收到推薦更新:", recommendations);
        if (recommendations && recommendations.length > 0) {
          setRecommendations(recommendations);
          setPhase('recommend');
        }
      });

      setSubscriptionCleanups(prev => [...prev, cleanup]);

      return () => cleanup();
    }
  }, [joined, roomId]);

  // 創建房間
  const handleCreateRoom = async () => {
    if (!userName.trim()) {
      setError("請輸入你的名稱");
      return;
    }

    setLoading(true);
    setError("");

    try {
      localStorage.setItem("userName", userName);
      
      const response = await roomService.createRoom(userName);

      if (response.success) {
        setRoomId(response.roomId);
        setIsHost(true);
        setJoined(true);
        setPhase("waiting");

        navigate(`/buddies?roomId=${response.roomId}`, { replace: true });
      } else {
        setError(response.error || "房間建立失敗");
      }
    } catch (error) {
      setError("創建房間失敗: " + (error.message || "未知錯誤"));
      console.error("創建房間失敗:", error);
    } finally {
      setLoading(false);
    }
  };

  // 加入房間
  const handleJoinRoom = async (roomIdInput = roomId, nameInput = userName) => {
    if (!nameInput.trim()) {
      setError("請先輸入你的名稱");
      return;
    }

    if (!roomIdInput.trim()) {
      setError("請輸入正確的房號");
      return;
    }

    setLoading(true);
    setError("");

    try {
      localStorage.setItem("userName", nameInput);
      
      const response = await memberService.joinRoom(
        roomIdInput.toUpperCase(),
        userId,
        nameInput
      );

      if (response.success) {
        setRoomId(roomIdInput.toUpperCase());
        setJoined(true);
        setPhase("waiting");
        setIsHost(response.isHost || false);

        // 獲取當前房間成員
        const membersResult = await memberService.getRoomMembers(roomIdInput.toUpperCase());
        if (membersResult.success) {
          const membersList = membersResult.data.map(member => ({
            id: member.user_id,
            name: member.user_name,
            isHost: member.is_host,
            uid: member.user_id
          }));
          setMembers(membersList);
        }

        // 檢查是否有現存的問題集
        const existingQuestions = await questionService.getQuestions(roomIdInput.toUpperCase());
        if (existingQuestions.length > 0) {
          setQuestions(existingQuestions);
          setPhase('questions');
        }

        // 檢查是否有現存的推薦
        const existingRecommendations = await recommendationService.getRecommendations(roomIdInput.toUpperCase());
        if (existingRecommendations.length > 0) {
          setRecommendations(existingRecommendations);
          setPhase('recommend');
        }

        navigate(`/buddies?roomId=${roomIdInput.toUpperCase()}`, {
          replace: true,
        });
      } else {
        if (response.error && 
            (response.error.includes("已關閉") ||
             response.error.includes("已刪除") ||
             response.error.includes("不存在"))) {
          setError(`此房間已不可用，請創建新房間或加入其他房間`);
          
          setTimeout(() => {
            if (window.confirm("此房間已不可用，是否要創建一個新房間？")) {
              setRoomId("");
            }
          }, 500);
        } else {
          setError(response.error || "加入失敗");
        }
      }
    } catch (error) {
      setError("加入房間失敗: " + (error.message || "未知錯誤"));
      console.error("加入房間失敗:", error);
    } finally {
      setLoading(false);
    }
  };

  // 複製房號到剪貼簿
  const copyToClipboard = async () => {
    if (copyingRoom) return;

    setCopyingRoom(true);

    try {
      await navigator.clipboard.writeText(roomId);

      setToast({
        visible: true,
        message: "房號已複製",
        type: "success",
      });

      setTimeout(() => {
        setToast((prev) => ({ ...prev, visible: false }));
        setCopyingRoom(false);
      }, 2000);
    } catch (err) {
      setToast({
        visible: true,
        message: "複製失敗，請手動複製",
        type: "error",
      });

      setTimeout(() => {
        setToast((prev) => ({ ...prev, visible: false }));
        setCopyingRoom(false);
      }, 1500);
    }
  };

  const [sharing, setSharing] = useState(false);

  // 分享房間
  const shareRoom = async () => {
    if (sharing) return;

    setSharing(true);

    const cleanUrl = `${window.location.origin}/buddies?room=${roomId}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "TasteBuddies 房間邀請",
          text: "來加入我的TasteBuddies房間一起選餐廳吧！",
          url: cleanUrl,
        });

        setTimeout(() => {
          setSharing(false);
        }, 2000);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("分享失敗", err);
          setToast({
            visible: true,
            message: "分享失敗",
            type: "error",
          });
        }

        setSharing(false);
      }
    } else {
      try {
        await navigator.clipboard.writeText(cleanUrl);
        setToast({
          visible: true,
          message: "分享連結已複製",
          type: "success",
        });

        setTimeout(() => {
          setToast((prev) => ({ ...prev, visible: false }));
          setSharing(false);
        }, 2000);
      } catch (err) {
        setToast({
          visible: true,
          message: "複製連結失敗",
          type: "error",
        });

        setTimeout(() => {
          setToast((prev) => ({ ...prev, visible: false }));
          setSharing(false);
        }, 2000);
      }
    }
  };

  // 提交答案
  const handleSubmitAnswers = async (answerData) => {
    try {
      let answers, questionTexts, questionSources;

      if (answerData.answers && answerData.questionTexts) {
        answers = answerData.answers;
        questionTexts = answerData.questionTexts;
        questionSources = answerData.questionSources || 
          answerData.questionTexts.map((text) => {
            const isBasic = buddiesBasicQuestions.some(q => q.question === text);
            return isBasic ? "basic" : "fun";
          });
      } else {
        answers = Array.isArray(answerData) ? answerData : Object.values(answerData);
        questionTexts = [
          ...buddiesBasicQuestions.map((q) => q.question),
          ...Array(answers.length - buddiesBasicQuestions.length).fill("趣味問題"),
        ];
        questionSources = answers.map((_, index) =>
          index < buddiesBasicQuestions.length ? "basic" : "fun"
        );
      }

      // 提交答案到 Supabase
      const result = await questionService.submitAnswers(
        roomId,
        userId,
        answers,
        questionTexts,
        questionSources
      );

      if (result.success) {
        setPhase("waiting-recommendations");
        
        // 檢查是否所有成員都已提交答案
        const allAnswers = await questionService.getAllAnswers(roomId);
        const memberCount = members.length;
        
        if (allAnswers.success && allAnswers.data.length >= memberCount) {
          // 所有人都已答題，觸發推薦生成
          // 這裡需要實現推薦生成邏輯
          console.log("所有人已答題，開始生成推薦");
          
          // TODO: 實現推薦生成邏輯
          // 暫時使用模擬數據
          setTimeout(() => {
            setError("推薦功能尚未完整實現，請稍後再試");
            setPhase("waiting");
          }, 2000);
        }
      } else {
        setError(result.error || "提交答案失敗");
      }
    } catch (error) {
      console.error("提交答案失敗:", error);
      setError("提交答案失敗");
    }
  };

  // 開始問答
  const handleStartQuestions = async () => {
    try {
      // 隨機選擇趣味問題
      const randomFun = funQuestions
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

      const basicWithSource = buddiesBasicQuestions.map((q) => ({
        ...q,
        source: "basic",
      }));

      const funWithSource = randomFun.map((q) => ({
        ...q,
        source: "fun",
      }));

      const allQuestions = [...basicWithSource, ...funWithSource];

      // 保存問題集到 Supabase
      const result = await questionService.saveQuestions(roomId, allQuestions);
      
      if (result.success) {
        setQuestions(allQuestions);
        
        // 更新房間狀態
        await roomService.updateRoomStatus(roomId, 'questions');
      } else {
        setError(result.error || "開始問答失敗");
      }
    } catch (error) {
      console.error("開始問答失敗:", error);
      setError("開始問答失敗");
    }
  };

  // 返回首頁
  const handleBackToHome = () => {
    navigate("/");
  };

  // 格式化問題
  const formatQuestionsForSwiper = (questions) =>
    questions.map((q, index) => ({
      id: "q" + index,
      text: q.question,
      leftOption: q.options[0],
      rightOption: q.options[1],
      hasVS: q.question.includes("v.s."),
    }));

  // 渲染不同階段的內容
  const renderPhaseContent = () => {
    switch (phase) {
      case "waiting":
        return (
          <>
            <h3 className="buddies-title">房號：{roomId}</h3>
            <QRCode
              value={`${window.location.origin}/buddies?room=${roomId}`}
              size={190}
              fgColor="#333"
              bgColor="#fff"
              level="M"
              includeMargin={false}
            />
            <div className="room-actions">
              <button
                onClick={copyToClipboard}
                disabled={copyingRoom}
                className={copyingRoom ? "copy-button-active" : "copy-button"}
              >
                {copyingRoom ? "複製中..." : "📋 複製房號"}
              </button>
              <button
                onClick={shareRoom}
                disabled={sharing}
                className={sharing ? "share-button-active" : "share-button"}
              >
                {sharing ? "分享中..." : "🔗 分享連結"}
              </button>
            </div>
            <h4>目前成員：</h4>
            <ul>
              {members.map((m, i) => (
                <li
                  key={m.uid || m.id || i}
                  style={{
                    position: "relative",
                    padding: "8px 40px 8px 15px",
                  }}
                >
                  👤 {m.name || `成員 ${i + 1}`}
                  {m.id === userId && (
                    <span style={{ marginLeft: "0.5rem" }}>（你）</span>
                  )}
                  {m.isHost && <span className="host-badge">主持人</span>}
                </li>
              ))}
            </ul>
            {isHost && (
              <button
                onClick={handleStartQuestions}
                disabled={loading || members.length < 1}
                className="start-button"
              >
                👉 開始答題
              </button>
            )}
            {!isHost && members.length > 0 && (
              <div style={{ marginTop: "1rem", color: "#666" }}>
                <p>等待主持人開始答題...</p>
              </div>
            )}
          </>
        );

      case "questions":
        return (
          <BuddiesQuestionSwiper
            roomId={roomId}
            questions={formatQuestionsForSwiper(questions)}
            onComplete={handleSubmitAnswers}
            members={members}
          />
        );

      case "waiting-recommendations":
        return (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <h3>等待所有人完成答題...</h3>
            <p>系統正在根據大家的答案生成推薦</p>
            <div className="loading-spinner" style={{ margin: "2rem auto" }}>
              <div className="spinner"></div>
            </div>
          </div>
        );

      case "recommend":
        return (
          <BuddiesRecommendation
            roomId={roomId}
            restaurants={recommendations}
            onBack={() => setPhase("waiting")}
          />
        );

      default:
        return (
          <div>
            <h3>歡迎使用 TasteBuddies</h3>
            <p>和朋友一起選擇餐廳！</p>
            <button onClick={handleBackToHome}>返回首頁</button>
          </div>
        );
    }
  };

  const handleRetryRecommendation = () => {
    if (retryCount >= 3) {
      setError("多次嘗試失敗，請重新開始");
      return;
    }

    setRetryCount((prev) => prev + 1);
    setPhase("waiting");
    setError("推薦功能尚未完整實現");
  };

  useEffect(() => {
    console.log("推薦狀態更新:", {
      phase,
      recommendationsCount: recommendations.length,
      hasError: !!error,
    });
  }, [phase, recommendations, error]);

  return (
    <div className="buddies-room">
      <ToastNotification
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
      {!joined ? (
        <>
          <h2>TasteBuddies - 一起選餐廳</h2>
          <input
            placeholder="你的名稱"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            disabled={loading}
          />
          <input
            placeholder="房號（若要加入）"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            disabled={loading}
          />
          <div className="button-group">
            <button
              onClick={handleCreateRoom}
              disabled={loading}
            >
              {loading ? "處理中..." : "建立新房間"}
            </button>
            <button
              onClick={() => handleJoinRoom()}
              disabled={loading}
            >
              {loading ? "處理中..." : "加入房間"}
            </button>
            {!joined && (
              <button
                onClick={() => setShowScanner(true)}
                disabled={loading}
                className="scan-button"
              >
                📷 掃描房號
              </button>
            )}
          </div>
          {showScanner && (
            <QRScannerModal
              onScan={(code) => {
                if (code.includes("room=")) {
                  const match = code.match(/[?&]room=([A-Z0-9]+)/i);
                  if (match && match[1]) {
                    setRoomId(match[1].toUpperCase());
                  } else {
                    setRoomId(code.toUpperCase());
                  }
                } else {
                  setRoomId(code.toUpperCase());
                }
                setShowScanner(false);
              }}
              onClose={() => setShowScanner(false)}
            />
          )}
          {error && (
            <div className="error-message">⚠️ {error}</div>
          )}
        </>
      ) : (
        renderPhaseContent()
      )}
    </div>
  );
}