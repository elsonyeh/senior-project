import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { QRCode } from "react-qrcode-logo";
import socket from "../services/socket";
import "./BuddiesRoom.css";
import { funQuestions } from "../data/funQuestions";
import QuestionSwiperMotion from "./QuestionSwiperMotion";
import BuddiesRecommendation from "./BuddiesRecommendation";
import QRScannerModal from "./QRScannerModal";
import { buddiesBasicQuestions } from "../data/buddiesBasicQuestions";
import { getRandomFunQuestions } from "../logic/enhancedRecommendLogicFrontend.js";
import BuddiesQuestionSwiper from "./BuddiesQuestionSwiper";

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
  const [socketConnected, setSocketConnected] = useState(false);
  const [connectingToServer, setConnectingToServer] = useState(false);
  const [showConnectionError, setShowConnectionError] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const [copyingRoom, setCopyingRoom] = useState(false);

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
    // 獲取或創建用戶ID
    const storedUserId = getOrCreateUserId();
    setUserId(storedUserId);

    // 從localStorage獲取用戶名
    const storedName = localStorage.getItem("userName");
    if (storedName) {
      setUserName(storedName);
    }

    // 處理URL參數，如果有房間ID則設置
    const params = new URLSearchParams(location.search);
    const roomParam = params.get("room") || params.get("roomId");

    if (roomParam) {
      setRoomId(roomParam.toUpperCase());

      // 更新URL以移除房間ID參數（刷新後不保留房號）
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("room");
      newUrl.searchParams.delete("roomId");
      window.history.replaceState({}, "", newUrl);
    }
  }, [location.search]);

  // 監聽Socket連接
  useEffect(() => {
    // 監聽連接狀態
    const handleConnect = () => {
      console.log("Socket已連接:", socket.id);
      setSocketConnected(true);
      setConnectingToServer(false);
      setShowConnectionError(false);
    };

    const handleDisconnect = () => {
      console.log("Socket已斷開");
      setSocketConnected(false);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    // 已經連接的情況
    if (socket.connected) {
      setSocketConnected(true);
    }

    // 房間成員更新
    socket.on("updateUsers", (userList) => {
      console.log("收到成員更新:", userList);

      // 檢查並更新房主狀態
      const currentUser = userList.find((u) => u.id === socket.id);
      if (currentUser && currentUser.isHost) {
        setIsHost(true);
      } else {
        setIsHost(false);
      }

      setMembers(userList);
    });

    // 開始問答環節
    socket.on("startQuestions", () => {
      console.log("收到開始問答信號");
      // 使用 Buddies 模式特定的基本問題集（已移除"今天是一個人還是有朋友？"問題）
      const randomFun = getRandomFunQuestions(funQuestions, 3);

      // 為問題添加來源標記
      const basicWithSource = buddiesBasicQuestions.map((q) => ({
        ...q,
        source: "basic", // 標記為基本問題
      }));

      const funWithSource = randomFun.map((q) => ({
        ...q,
        source: "fun", // 標記為趣味問題
      }));

      const all = [...basicWithSource, ...funWithSource];
      setQuestions(all);
      setPhase("questions");
    });

    // 接收新投票事件
    socket.on("newVote", (voteData) => {
      console.log("收到新投票:", voteData);
      // 不需要處理，BuddiesQuestionSwiper 組件會自動處理
    });

    // 接收投票統計信息
    socket.on("voteStats", (stats) => {
      console.log("收到投票統計:", stats);
      // 不需要處理，BuddiesQuestionSwiper 組件會自動處理
    });

    // 接收餐廳推薦
    socket.on("groupRecommendations", (recs) => {
      console.log("收到餐廳推薦:", recs.length);
      setRecommendations(recs);
      setPhase("recommend");
      localStorage.setItem("buddiesRecommendations", JSON.stringify(recs));
    });

    // 推薦錯誤處理
    socket.on("recommendError", ({ error }) => {
      setError(`推薦失敗: ${error}`);
      // 回到等待狀態，讓用戶可以重試
      setPhase("waiting");
    });

    // 清理函數
    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("updateUsers");
      socket.off("startQuestions");
      socket.off("newVote");
      socket.off("voteStats");
      socket.off("groupRecommendations");
      socket.off("recommendError");
    };
  }, []);

  // 獲取或創建用戶ID
  const getOrCreateUserId = () => {
    let userId = localStorage.getItem("userId");

    if (!userId) {
      userId = `user_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      localStorage.setItem("userId", userId);
    }

    return userId;
  };

  // 嘗試連接服務器
  const tryConnectServer = (callback) => {
    if (socketConnected) {
      // 已連接，直接執行回調
      if (callback) callback();
      return;
    }

    // 未連接，顯示連接中狀態
    setConnectingToServer(true);
    setShowConnectionError(false);

    // 嘗試建立連接
    socket.connect();

    // 設置超時
    const timeout = setTimeout(() => {
      if (!socketConnected) {
        setConnectingToServer(false);
        setShowConnectionError(true);
      }
    }, 5000);

    // 設置等待連接
    const interval = setInterval(() => {
      if (socketConnected) {
        clearInterval(interval);
        clearTimeout(timeout);
        setConnectingToServer(false);
        setShowConnectionError(false);
        if (callback) callback();
      }
    }, 500);

    // 5秒後清除自身，避免內存泄漏
    setTimeout(() => {
      clearInterval(interval);
    }, 5000);
  };

  // 創建房間
  const handleCreateRoom = async () => {
    if (!userName.trim()) {
      setError("請輸入你的名稱");
      return;
    }

    if (!socketConnected) {
      tryConnectServer(() => handleCreateRoom());
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 保存用戶名
      localStorage.setItem("userName", userName);

      // 使用 socket 創建房間
      socket.emit("createRoom", { userName }, (response) => {
        setLoading(false);

        // 檢查返回值結構
        if (response && response.success && response.roomId) {
          setRoomId(response.roomId);

          // 根據服務器返回來設置房主狀態
          if (response.isHost) {
            setIsHost(true);
          }

          setJoined(true);
          setPhase("waiting");

          // 更新URL以顯示房間ID
          navigate(`/buddies?roomId=${response.roomId}`, { replace: true });
        } else {
          setError((response && response.error) || "房間建立失敗");
        }
      });
    } catch (error) {
      setLoading(false);
      setError("創建房間失敗: " + (error.message || "未知錯誤"));
      console.error("創建房間失敗:", error);
    }
  };

  // 加入房間
  // 修改 handleJoinRoom 函數部分來處理已刪除的房間情況

  const handleJoinRoom = async (roomIdInput = roomId, nameInput = userName) => {
    if (!nameInput.trim()) {
      setError("請先輸入你的名稱");
      return;
    }

    if (!roomIdInput.trim()) {
      setError("請輸入正確的房號");
      return;
    }

    if (!socketConnected) {
      tryConnectServer(() => handleJoinRoom(roomIdInput, nameInput));
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 保存用戶名
      localStorage.setItem("userName", nameInput);

      // 使用 socket 加入房間
      socket.emit(
        "joinRoom",
        {
          roomId: roomIdInput.toUpperCase(),
          userName: nameInput,
        },
        (response) => {
          setLoading(false);

          if (response && response.success) {
            setRoomId(roomIdInput.toUpperCase());
            setJoined(true);
            setPhase("waiting");

            // 根據服務器返回來設置房主狀態
            if (response.isHost) {
              setIsHost(true);
            } else {
              setIsHost(false);
            }

            // 更新URL以顯示房間ID
            navigate(`/buddies?roomId=${roomIdInput.toUpperCase()}`, {
              replace: true,
            });
          } else {
            // 特殊處理已刪除或關閉的房間
            if (
              response.error &&
              (response.error.includes("已關閉") ||
                response.error.includes("已刪除") ||
                response.error.includes("不存在"))
            ) {
              setError(`此房間已不可用，請創建新房間或加入其他房間`);

              // 顯示更友好的錯誤提示，並提供創建新房間的選項
              setTimeout(() => {
                if (window.confirm("此房間已不可用，是否要創建一個新房間？")) {
                  // 清空房號，準備創建新房間
                  setRoomId("");
                }
              }, 500);
            } else {
              // 一般錯誤處理
              setError((response && response.error) || "加入失敗");
            }
          }
        }
      );
    } catch (error) {
      setLoading(false);
      setError("加入房間失敗: " + (error.message || "未知錯誤"));
      console.error("加入房間失敗:", error);
    }
  };

  // 複製房號到剪貼簿
  const copyToClipboard = async () => {
    // 防止重複點擊
    if (copyingRoom) return;

    // 設置按鈕狀態為復制中
    setCopyingRoom(true);

    try {
      await navigator.clipboard.writeText(roomId);

      // 顯示成功通知
      setToast({
        visible: true,
        message: "房號已複製",
        type: "success",
      });

      // 2 秒後自動關閉通知
      setTimeout(() => {
        setToast((prev) => ({ ...prev, visible: false }));
        // 重置按鈕狀態
        setCopyingRoom(false);
      }, 2000);
    } catch (err) {
      // 顯示錯誤通知
      setToast({
        visible: true,
        message: "複製失敗，請手動複製",
        type: "error",
      });

      // 1.5 秒後自動關閉通知
      setTimeout(() => {
        setToast((prev) => ({ ...prev, visible: false }));
        // 重置按鈕狀態
        setCopyingRoom(false);
      }, 1500);
    }
  };

  const [sharing, setSharing] = useState(false);

  // 分享房間 - 僅分享房號，不包含用戶資訊
  const shareRoom = async () => {
    // 防止重複點擊
    if (sharing) return;

    // 設置按鈕狀態為分享中
    setSharing(true);

    // 生成只包含房號的乾淨URL
    const cleanUrl = `${window.location.origin}/buddies?room=${roomId}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "TasteBuddies 房間邀請",
          text: "來加入我的TasteBuddies房間一起選餐廳吧！",
          url: cleanUrl,
        });

        // 即使分享成功，也設置一個計時器來重置按鈕狀態
        setTimeout(() => {
          setSharing(false);
        }, 2000);
      } catch (err) {
        // 忽略用戶取消分享的錯誤
        if (err.name !== "AbortError") {
          console.error("分享失敗", err);
          setToast({
            visible: true,
            message: "分享失敗",
            type: "error",
          });
        }

        // 重置按鈕狀態
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

        // 2秒後關閉通知並重置按鈕狀態
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

        // 2秒後關閉通知並重置按鈕狀態
        setTimeout(() => {
          setToast((prev) => ({ ...prev, visible: false }));
          setSharing(false);
        }, 2000);
      }
    }
  };

  // 提交答案
  const handleSubmitAnswers = (answerData) => {
    // 檢查是否收到結構化的答案數據（含問題文本和來源）
    if (answerData.answers && answerData.questionTexts) {
      // 檢查是否有問題來源信息
      const hasQuestionSources =
        answerData.questionSources &&
        Array.isArray(answerData.questionSources) &&
        answerData.questionSources.length > 0;

      socket.emit("submitAnswers", {
        roomId,
        answers: answerData.answers,
        questionTexts: answerData.questionTexts,
        // 如果有問題來源信息，一併傳遞
        questionSources: hasQuestionSources
          ? answerData.questionSources
          : undefined,
        // 傳遞特定的基本問題集（用於服務端識別基本問題）
        basicQuestions: buddiesBasicQuestions,
      });

      console.log("提交結構化答案:", {
        answers: answerData.answers,
        hasQuestionTexts: Array.isArray(answerData.questionTexts),
        hasQuestionSources: hasQuestionSources,
      });
    } else {
      // 向後兼容的處理方法
      const answers = Array.isArray(answerData)
        ? answerData
        : Object.values(answerData);

      console.log("提交傳統格式答案:", answers.length);

      socket.emit("submitAnswers", {
        roomId,
        answers,
        // 即使使用舊格式，也傳遞正確的基本問題集
        basicQuestions: buddiesBasicQuestions,
      });
    }
    setPhase("waiting-recommendations");
  };

  // 開始問答
  const handleStartQuestions = () => {
    socket.emit("startQuestions", { roomId });
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
            <h3>房號：{roomId}</h3>
            <QRCode
              value={`${window.location.origin}/buddies?room=${roomId}`}
              size={160}
              fgColor="#333"
              bgColor="#fff"
              level="M"
              includeMargin={false}
            />
            <div style={{ margin: "1rem 0" }}>
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
                    padding: "8px 40px 8px 15px", // 增加右側填充為徽章留出空間
                  }}
                >
                  👤 {m.name || `成員 ${i + 1}`}
                  {m.id === socket.id && (
                    <span style={{ marginLeft: "0.5rem" }}>（你）</span>
                  )}
                  {m.isHost && (
                    <span
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: "0.7rem",
                        background: "#ff9f68",
                        color: "white",
                        padding: "2px 6px",
                        borderRadius: "10px",
                      }}
                    >
                      主持人
                    </span>
                  )}
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

  // 重新連接服務器
  const handleRetryConnection = () => {
    setConnectingToServer(true);
    setShowConnectionError(false);
    socket.connect();
    setTimeout(() => {
      if (!socketConnected) {
        setConnectingToServer(false);
        setShowConnectionError(true);
      }
    }, 5000);
  };

  return (
    <div className="buddies-room">
      {/* 通知元件 */}
      <ToastNotification
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
      {!joined ? (
        <>
          <h2>TasteBuddies - 一起選餐廳</h2>

          {/* 連接中狀態顯示 */}
          {connectingToServer && (
            <div
              className="connecting-message"
              style={{ marginBottom: "1rem" }}
            >
              <div
                className="loading-spinner"
                style={{ margin: "0.5rem auto" }}
              >
                <div className="spinner"></div>
              </div>
              <p>正在連接服務器，請稍候...</p>
            </div>
          )}

          {/* 連接失敗時顯示重試按鈕 */}
          {showConnectionError && (
            <div className="error-message" style={{ marginBottom: "1rem" }}>
              ⚠️ 無法連接到服務器
              <button
                onClick={handleRetryConnection}
                style={{
                  marginLeft: "1rem",
                  padding: "0.25rem 0.5rem",
                  fontSize: "0.8rem",
                  background: "#FF6B6B",
                }}
              >
                重試連接
              </button>
            </div>
          )}

          <input
            placeholder="你的名稱"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            disabled={loading || connectingToServer}
          />
          <input
            placeholder="房號（若要加入）"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            disabled={loading || connectingToServer}
          />
          <div>
            <button
              onClick={handleCreateRoom}
              disabled={loading || connectingToServer}
            >
              {loading ? "處理中..." : "建立新房間"}
            </button>
            <button
              onClick={() => handleJoinRoom()}
              disabled={loading || connectingToServer}
            >
              {loading ? "處理中..." : "加入房間"}
            </button>
          </div>
          {!joined && (
            <>
              <button
                onClick={() => setShowScanner(true)}
                disabled={loading || connectingToServer}
              >
                📷 掃描房號
              </button>
              {showScanner && (
                <QRScannerModal
                  onScan={(code) => {
                    // 檢查掃描結果是否是完整URL
                    if (code.includes("room=")) {
                      // 從URL中提取房號
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
            </>
          )}
          {error && !connectingToServer && (
            <div className="error-message">⚠️ {error}</div>
          )}
        </>
      ) : (
        renderPhaseContent()
      )}
    </div>
  );
}
