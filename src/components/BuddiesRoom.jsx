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
  const [retryCount, setRetryCount] = useState(0);

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

      // 使用房間ID作為種子，確保同一房間生成相同的問題
      const seed = roomId
        .split("")
        .reduce((sum, char) => sum + char.charCodeAt(0), 0);
      console.log("使用房間ID生成固定問題序列，種子值:", seed);

      // 使用種子來創建一個固定的問題序列
      const shuffledQuestions = getSeededShuffledArray(funQuestions, seed);
      const randomFun = shuffledQuestions.slice(0, 3);

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

    // 添加基於種子的數組打亂函數 (在組件內部或外部都可以)
    function getSeededShuffledArray(array, seed) {
      // 創建一個新數組，避免修改原始數組
      const arrayCopy = [...array];

      // 簡單的種子隨機數生成器
      let currentSeed = seed;
      const random = function () {
        currentSeed = (currentSeed * 9301 + 49297) % 233280;
        return currentSeed / 233280;
      };

      // Fisher-Yates 洗牌算法
      for (let i = arrayCopy.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [arrayCopy[i], arrayCopy[j]] = [arrayCopy[j], arrayCopy[i]];
      }

      return arrayCopy;
    }

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
      console.log("收到餐廳推薦:", recs?.length, "家餐廳");

      if (!recs || !Array.isArray(recs) || recs.length === 0) {
        console.error("收到無效的推薦數據");
        setError("推薦生成失敗，請重試");
        setPhase("waiting");
        return;
      }

      // 確保推薦結果有效
      const validRecommendations = recs.filter((r) => r && r.id);

      if (validRecommendations.length === 0) {
        console.error("推薦結果無效");
        setError("推薦結果無效，請重試");
        setPhase("waiting");
        return;
      }

      // 強制更新狀態
      setRecommendations([]);
      setPhase("waiting");

      // 使用 setTimeout 確保狀態更新順序
      setTimeout(() => {
        setRecommendations(validRecommendations);
        setPhase("recommend");
        console.log(
          "已切換到推薦階段，推薦餐廳數量:",
          validRecommendations.length
        );
      }, 100);
    });

    // 推薦錯誤處理
    socket.on("recommendError", ({ error }) => {
      console.error("推薦生成錯誤:", error);
      setError(error || "推薦生成失敗，請重試");
      setPhase("waiting");
    });

    // 提交答案
    socket.on(
      "submitAnswers",
      function (
        {
          roomId,
          answers,
          questionTexts,
          questionSources,
          index,
          basicQuestions,
        },
        callback
      ) {
        // ... 其他代碼 ...

        // 確保 room.questionUserData 已初始化
        if (!room.questionUserData) {
          room.questionUserData = {};
        }
        if (!room.questionUserData[currentIndex]) {
          room.questionUserData[currentIndex] = [];
        }

        // 初始化問題統計
        const questionStats = {
          userData: [],
        };

        // 添加當前用戶的投票數據
        if (userAnswer) {
          const userInfo = {
            id: socket.id,
            name: userName,
            option: userAnswer,
            timestamp: Date.now(),
          };

          // 檢查是否已經投票
          const existingVoteIndex = room.questionUserData[
            currentIndex
          ].findIndex((vote) => vote.id === socket.id);

          if (existingVoteIndex === -1) {
            // 新投票
            room.questionUserData[currentIndex].push(userInfo);
          } else {
            // 更新現有投票
            room.questionUserData[currentIndex][existingVoteIndex] = userInfo;
          }
        }

        // 重新計算所有票數
        const voteCounts = {};
        room.questionUserData[currentIndex].forEach((vote) => {
          voteCounts[vote.option] = (voteCounts[vote.option] || 0) + 1;
        });

        // 更新統計對象
        questionStats.userData = [...room.questionUserData[currentIndex]];
        Object.assign(questionStats, voteCounts);

        // 立即發送更新的投票統計
        io.to(roomId).emit("voteStats", questionStats);

        // 發送新投票通知
        if (userAnswer) {
          io.to(roomId).emit("newVote", {
            option: userAnswer,
            senderId: socket.id,
            userName: userName,
          });
        }

        // 檢查是否所有用戶都已完成答題
        const memberCount = Object.keys(room.members || {}).length;
        const answerCount = Object.keys(room.answers || {}).length;

        if (answerCount >= memberCount) {
          console.log(`[${roomId}] 所有用戶已完成答題，生成推薦`);

          // 更新房間狀態
          room.status = "generating_recommendations";

          // 獲取餐廳數據
          getRestaurants()
            .then((restaurants) => {
              if (!restaurants || restaurants.length === 0) {
                throw new Error("無法獲取餐廳數據");
              }

              // 生成推薦
              const recommendations = enhancedLogic.recommendForGroup(
                room.answers,
                restaurants,
                {
                  basicQuestions: room.basicQuestions || [],
                  strictBasicMatch: true,
                  minBasicMatchRatio: 0.5,
                  basicMatchWeight: enhancedLogic.WEIGHT.BASIC_MATCH * 1.5,
                  answerQuestionMap: room.answerQuestionMap || {},
                }
              );

              if (!recommendations || recommendations.length === 0) {
                throw new Error("無法生成推薦結果");
              }

              // 保存推薦結果
              room.recommendations = recommendations;
              room.stage = "vote";
              room.status = "recommendation_ready";

              // 先保存到 Firebase
              return saveRecommendationsToFirebase(
                roomId,
                recommendations
              ).then(() => {
                // 發送推薦結果給所有用戶
                io.to(roomId).emit("groupRecommendations", recommendations);
                console.log(
                  `[${roomId}] 已發送 ${recommendations.length} 家餐廳推薦`
                );
              });
            })
            .catch((error) => {
              console.error(`[${roomId}] 生成推薦失敗:`, error);
              io.to(roomId).emit("recommendError", { error: error.message });
              room.status = "questions"; // 重置狀態
            });
        }
      }
    );

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

      // 如果沒有問題來源信息，根據 buddiesBasicQuestions 生成
      const generatedSources = !hasQuestionSources
        ? answerData.questionTexts.map((text) => {
            // 使用 buddiesBasicQuestions 判斷問題類型
            const isBasic = buddiesBasicQuestions.some(
              (q) => q.question === text
            );
            return isBasic ? "basic" : "fun";
          })
        : null;

      socket.emit("submitAnswers", {
        roomId,
        answers: answerData.answers,
        questionTexts: answerData.questionTexts,
        // 優先使用現有問題來源，否則使用生成的來源
        questionSources: hasQuestionSources
          ? answerData.questionSources
          : generatedSources,
        // 傳遞特定的基本問題集
        basicQuestions: buddiesBasicQuestions,
      });

      console.log("提交結構化答案:", {
        answers: answerData.answers,
        hasQuestionTexts: Array.isArray(answerData.questionTexts),
        hasQuestionSources: hasQuestionSources,
        basicQuestionsCount: buddiesBasicQuestions.length,
      });
    } else {
      // 向後兼容的處理方法
      const answers = Array.isArray(answerData)
        ? answerData
        : Object.values(answerData);

      // 為舊格式生成問題來源（根據順序判斷）
      // 假設前 buddiesBasicQuestions.length 個答案是基本問題的答案
      const generatedSources = answers.map((_, index) =>
        index < buddiesBasicQuestions.length ? "basic" : "fun"
      );

      socket.emit("submitAnswers", {
        roomId,
        answers,
        // 添加問題文本數組（如果可能的話）
        questionTexts: [
          ...buddiesBasicQuestions.map((q) => q.question),
          ...Array(answers.length - buddiesBasicQuestions.length).fill(
            "趣味問題"
          ),
        ],
        // 添加生成的問題來源
        questionSources: generatedSources,
        // 傳遞正確的基本問題集
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
                    padding: "8px 40px 8px 15px", // 增加右側填充為徽章留出空間
                  }}
                >
                  👤 {m.name || `成員 ${i + 1}`}
                  {m.id === socket.id && (
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
            members={members} //傳遞成員數據
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

  const handleRetryRecommendation = () => {
    if (retryCount >= 3) {
      setError("多次嘗試失敗，請重新開始");
      return;
    }

    setRetryCount((prev) => prev + 1);
    setPhase("waiting");

    // 重新請求推薦
    socket.emit("getBuddiesRecommendations", { roomId }, (response) => {
      if (response.success && response.recommendations) {
        setRecommendations(response.recommendations);
        setPhase("recommend");
      } else {
        setError(response.error || "推薦生成失敗");
      }
    });
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
          <div className="button-group">
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
            {!joined && (
              <button
                onClick={() => setShowScanner(true)}
                disabled={loading || connectingToServer}
                className="scan-button"
              >
                📷 掃描房號
              </button>
            )}
          </div>
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
