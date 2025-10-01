import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { QRCode } from "react-qrcode-logo";
import "./BuddiesRoom.css";
import { useQuestions } from "./QuestionLoader";
import QuestionSwiperMotion from "./QuestionSwiperMotion";
import BuddiesRecommendation from "./BuddiesRecommendation";
import QRScannerModal from "./QRScannerModal";
import BuddiesQuestionSwiper from "./BuddiesQuestionSwiper";
import LoadingOverlay from "./LoadingOverlay";
import {
  roomService,
  memberService,
  questionService,
  recommendationService,
  cleanupAllSubscriptions
} from "../services/supabaseService";
import { getBasicQuestionsForBuddies, getFunQuestions } from "../services/questionService";
import selectionHistoryService from "../services/selectionHistoryService";
import { authService } from "../services/authService";
import { restaurantService } from "../services/restaurantService";
import { recommendRestaurants } from "../logic/enhancedRecommendLogicFrontend";
import logger from "../utils/logger";

export default function BuddiesRoom() {
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [userId, setUserId] = useState("");
  const [phase, setPhaseState] = useState("lobby");
  const [currentUser, setCurrentUser] = useState(null); // 當前登入用戶
  const [loadingRecommendations, setLoadingRecommendations] = useState(false); // 載入推薦動畫

  // 獲取用戶頭貼URL的輔助函數
  const getUserAvatarUrl = (member) => {
    // 如果用戶已登入，優先通過ID匹配（現在真實用戶使用真實ID）
    if (currentUser && (member.id === currentUser.id || member.user_id === currentUser.id)) {
      const avatarUrl = currentUser.user_metadata?.avatar_url || currentUser.avatar_url;
      if (avatarUrl) {
        logger.debug(`✅ 找到用戶頭貼 (ID匹配): ${member.name} -> ${avatarUrl.substring(0, 50)}...`);
        return avatarUrl;
      }
    }

    // 備用方案：通過姓名匹配（為了向後兼容）
    if (currentUser && member.name && currentUser.user_metadata?.name === member.name) {
      const avatarUrl = currentUser.user_metadata?.avatar_url || currentUser.avatar_url;
      if (avatarUrl) {
        logger.debug(`✅ 找到用戶頭貼 (姓名匹配): ${member.name} -> ${avatarUrl.substring(0, 50)}...`);
        return avatarUrl;
      }
    }

    // 對於其他用戶，目前沒有頭貼資料
    return null;
  };

  // 生成基於名稱的預設頭貼
  const generateDefaultAvatar = (name) => {
    if (!name) return null;

    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const colors = [
      '#ff6b35', '#22c55e', '#3b82f6', '#8b5cf6',
      '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const bgColor = colors[Math.abs(hash) % colors.length];

    return `data:image/svg+xml,${encodeURIComponent(`
      <svg width="80" height="80" xmlns="http://www.w3.org/2000/svg">
        <circle cx="40" cy="40" r="40" fill="${bgColor}"/>
        <text x="50%" y="50%" text-anchor="middle" dy="0.3em" font-family="system-ui" font-size="24" fill="white" font-weight="600">${initials}</text>
      </svg>
    `)}`;
  };

  // 包裝 setPhase 來追蹤所有變更
  const setPhase = (newPhase) => {
    const stack = new Error().stack.split('\n');
    logger.debug("🔄 setPhase 被調用:", {
      from: phase,
      to: newPhase,
      calledFrom: stack[2], // 調用者
      fullStack: stack.slice(1, 4) // 前3層調用
    });
    setPhaseState(newPhase);
  };
  const [questions, setQuestions] = useState([]);

  // 使用 hook 載入問題集
  const { questions: allQuestions } = useQuestions('buddies');

  // 監控關鍵狀態變化
  React.useEffect(() => {
    logger.debug("🔍 關鍵狀態更新:", {
      phase: phase,
      isHost: isHost,
      joined: joined,
      roomId: roomId,
      userId: userId,
      userName: userName,
      membersCount: members.length,
      currentUserLoggedIn: !!currentUser
    });
  }, [phase, isHost, joined, roomId, userId, userName, members.length, currentUser]);
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

  // 選擇紀錄相關狀態
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessionStartTime, setSessionStartTime] = useState(null);

  function ToastNotification({ message, type, visible, onHide }) {
    if (!visible) return null;

    return (
      <div
        className={`buddies-toast-notification ${type || "success"}`}
        onClick={onHide}
      >
        <div className="buddies-toast-icon">{type === "error" ? "✖" : "✓"}</div>
        <div className="buddies-toast-message">{message}</div>
      </div>
    );
  }

  // 檢查當前用戶登入狀態
  useEffect(() => {
    const checkCurrentUser = async () => {
      try {
        const result = await authService.getCurrentUser();
        if (result.success && result.user) {
          setCurrentUser(result.user);
          logger.info("當前登入用戶:", result.user);

          // 如果用戶已登入，自動填入姓名
          if (result.user.user_metadata?.name) {
            setUserName(result.user.user_metadata.name);
          }

          logger.info('=== CURRENT USER LOADED ===', {
            userId: result.user.id,
            name: result.user.user_metadata?.name,
            avatarUrl: result.user.user_metadata?.avatar_url || result.user.avatar_url
          });
        }
      } catch (error) {
        console.error("檢查用戶登入狀態失敗:", error);
      }
    };

    checkCurrentUser();
  }, []);

  // 初始化用戶ID和處理URL參數
  useEffect(() => {
    // 如果用戶已登入，使用真實用戶ID，否則使用臨時ID
    const finalUserId = currentUser?.id || roomService.getOrCreateUserId();
    setUserId(finalUserId);

    logger.info('=== USER ID INITIALIZED ===', {
      currentUserId: currentUser?.id,
      temporaryId: roomService.getOrCreateUserId(),
      finalUserId: finalUserId,
      isLoggedIn: !!currentUser,
      usingRealId: !!currentUser?.id
    });

    // 優先檢查是否有登入用戶
    const initUserName = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (currentUser.success && currentUser.user) {
          // 如果有登入用戶，使用其名稱
          const displayName = currentUser.user.user_metadata?.name ||
                            currentUser.user.user_metadata?.full_name ||
                            currentUser.user.email?.split('@')[0] ||
                            '';
          if (displayName) {
            setUserName(displayName);
            return;
          }
        }
      } catch (error) {
        logger.info('無法獲取登入用戶資訊:', error);
      }

      // 如果沒有登入用戶，使用本地儲存的名稱
      const storedName = localStorage.getItem("userName");
      if (storedName) {
        setUserName(storedName);
      }
    };

    initUserName();

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
  }, [location.search, currentUser]);

  // 監聽房間成員變化
  useEffect(() => {
    if (joined && roomId) {
      const cleanup = memberService.listenRoomMembers(roomId, (membersObj) => {
        logger.info("收到成員更新:", membersObj);

        // 轉換成陣列格式
        const membersList = Object.values(membersObj).map(member => {
          const avatarUrl = getUserAvatarUrl(member);
          return {
            id: member.id,
            name: member.name,
            isHost: member.isHost,
            uid: member.id,
            avatar: avatarUrl || generateDefaultAvatar(member.name)
          };
        });

        setMembers(membersList);

        // 檢查當前用戶是否為房主
        const currentUserFromMembers = membersObj[userId];
        if (currentUserFromMembers && currentUserFromMembers.isHost) {
          setIsHost(true);
        }
      });

      setSubscriptionCleanups(prev => [...prev, cleanup]);

      return () => cleanup();
    }
  }, [joined, roomId, userId]);

  // 監聽房間狀態變化（只在加入房間時建立一次）
  useEffect(() => {
    logger.debug("🔍 監聽房間狀態 useEffect 觸發:", { joined, roomId });

    if (joined && roomId) {
      logger.debug("✅ 條件滿足，開始設置房間狀態監聽器");
      const cleanup = roomService.listenRoomStatus(roomId, (status) => {
        logger.debug("🔔 房間狀態變化監聽器觸發:", {
          newStatus: status,
          roomId: roomId,
          timestamp: new Date().toLocaleTimeString()
        });

        if (status === 'waiting') {
          logger.debug("🔄 設置 phase 為 'waiting'");
          setPhase('waiting');
        } else if (status === 'questions') {
          logger.debug("🔄 設置 phase 為 'questions'");
          setPhase('questions');
        } else if (status === 'recommend') {
          logger.debug("🔄 設置 phase 為 'recommend'");
          setPhase('recommend');
        } else if (status === 'completed') {
          logger.debug("🔄 設置 phase 為 'completed'");
          setPhase('completed');
        }
      });

      setSubscriptionCleanups(prev => [...prev, cleanup]);

      return () => cleanup();
    }
  }, [joined, roomId, currentUser]);

  // 監聽問題集變化
  useEffect(() => {
    if (joined && roomId) {
      const cleanup = questionService.listenQuestions(roomId, (questions) => {
        logger.info("收到問題集更新:", questions);
        setQuestions(questions);
        // 移除自動進入答題的邏輯，讓房間狀態監聽器來處理
        // 這樣可以確保只有通過正式的房間狀態變化才會進入答題環節
      });

      setSubscriptionCleanups(prev => [...prev, cleanup]);

      return () => cleanup();
    }
  }, [joined, roomId, currentUser]);

  // 監聽推薦變化
  useEffect(() => {
    if (joined && roomId) {
      const cleanup = recommendationService.listenRecommendations(roomId, async (recommendations) => {
        logger.info("收到推薦更新:", recommendations);
        if (recommendations && recommendations.length > 0) {
          setRecommendations(recommendations);
          setPhase('recommend');

          // 儲存 Buddies 使用紀錄（只有登入用戶才儲存）
          if (currentUser) {
            try {
              await selectionHistoryService.saveBuddiesHistory({
                roomId: roomId,
                isHost: isHost,
                roomMembers: members,
                recommendations: recommendations,
                selectedRestaurant: recommendations[0], // 假設第一個是主要推薦
                startTime: localStorage.getItem('buddies_session_start') || new Date().toISOString(),
                answers: {}, // 這裡可以從其他地方獲取答案資料
                questionTexts: questions.map(q => q.question) || []
              });
              logger.debug("✅ Buddies 歷史已儲存");
            } catch (error) {
              console.error('❌ 儲存 Buddies 歷史失敗:', error);
            }
          }
        }
      });

      setSubscriptionCleanups(prev => [...prev, cleanup]);

      return () => cleanup();
    }
  }, [joined, roomId, currentUser]);

  // 選擇紀錄相關函數
  const startBuddiesSession = async (buddiesRoomId) => {
    try {
      logger.info('Starting Buddies selection session for room:', buddiesRoomId);
      setSessionStartTime(new Date());

      const result = await selectionHistoryService.startSession('buddies', {
        user_location: await getCurrentLocation()
      });

      if (result.success) {
        setCurrentSessionId(result.sessionId);
        // 設置 Buddies 房間 ID
        await selectionHistoryService.setBuddiesRoomId(result.sessionId, buddiesRoomId);
        logger.info('Buddies session started:', result.sessionId);
      } else {
        console.error('Failed to start Buddies session:', result.error);
      }
    } catch (error) {
      console.error('Error starting Buddies session:', error);
    }
  };

  const getCurrentLocation = async () => {
    return new Promise((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              timestamp: new Date().toISOString()
            });
          },
          (error) => {
            logger.warn('Location access denied:', error);
            resolve(null);
          },
          { timeout: 10000 }
        );
      } else {
        resolve(null);
      }
    });
  };

  const completeBuddiesSession = async (finalRestaurant = null) => {
    if (currentSessionId) {
      const completionData = {
        started_at: sessionStartTime?.toISOString(),
        final_restaurant: finalRestaurant
      };

      await selectionHistoryService.completeSession(currentSessionId, completionData);
      logger.info('Buddies session completed');
    }
  };

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
      
      const response = await roomService.createRoom(userName, userId);

      if (response.success) {
        setRoomId(response.roomId);
        setIsHost(true);
        setJoined(true);
        setPhase("waiting");

        // 記錄 Buddies 會話開始時間
        localStorage.setItem('buddies_session_start', new Date().toISOString());

        // 開始 Buddies 選擇會話
        await startBuddiesSession(response.roomId);

        // 獲取房間成員列表
        const membersResult = await memberService.getRoomMembers(response.roomId);
        if (membersResult.success) {
          const membersList = membersResult.data.map(member => {
            const memberObj = { id: member.user_id, name: member.user_name };
            const avatarUrl = getUserAvatarUrl(memberObj);
            return {
              id: member.user_id,
              name: member.user_name,
              isHost: member.is_host,
              uid: member.user_id,
              avatar: avatarUrl || generateDefaultAvatar(member.user_name)
            };
          });
          setMembers(membersList);
          logger.info("載入成員列表:", membersList);
        }

        // 確認房間狀態為 waiting
        const roomStatusResult = await roomService.getRoomStatus(response.roomId);
        if (roomStatusResult.success) {
          logger.debug("🔍 創建房間後檢查狀態:", {
            expectedStatus: 'waiting',
            actualStatus: roomStatusResult.status,
            needsCorrection: roomStatusResult.status !== 'waiting'
          });

          // 即使我們已經設置了 waiting，也確認一下房間狀態
          if (roomStatusResult.status !== 'waiting') {
            logger.warn("⚠️ 房間狀態不是 waiting，錯誤地設置 phase 為:", roomStatusResult.status);
            logger.warn("🚨 這可能導致自動進入答題階段！");
            // 暫時註解掉這行，強制保持 waiting 狀態
            // setPhase(roomStatusResult.status);
          }
        }

        // 不需要跳轉，直接更新 URL 狀態
        window.history.replaceState({}, '', `/buddies?roomId=${response.roomId}`);

        logger.info("房間建立成功，房號:", response.roomId, "當前狀態: waiting");
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

        // 開始 Buddies 選擇會話
        await startBuddiesSession(roomIdInput.toUpperCase());

        // 獲取當前房間成員
        const membersResult = await memberService.getRoomMembers(roomIdInput.toUpperCase());
        if (membersResult.success) {
          const membersList = membersResult.data.map(member => {
            const memberObj = { id: member.user_id, name: member.user_name };
            const avatarUrl = getUserAvatarUrl(memberObj);
            return {
              id: member.user_id,
              name: member.user_name,
              isHost: member.is_host,
              uid: member.user_id,
              avatar: avatarUrl || generateDefaultAvatar(member.user_name)
            };
          });
          setMembers(membersList);
        }

        // 檢查是否有現存的問題集（只載入數據，不改變 phase）
        const existingQuestions = await questionService.getQuestions(roomIdInput.toUpperCase());
        if (existingQuestions.length > 0) {
          setQuestions(existingQuestions);
          // 不在這裡設置 phase，讓房間狀態監聽器來決定
        }

        // 檢查是否有現存的推薦（只載入數據，不改變 phase）
        const existingRecommendations = await recommendationService.getRecommendations(roomIdInput.toUpperCase());
        if (existingRecommendations.length > 0) {
          setRecommendations(existingRecommendations);
          // 不在這裡設置 phase，讓房間狀態監聽器來決定
        }

        // 獲取房間當前狀態並設置對應的 phase
        const roomStatusResult = await roomService.getRoomStatus(roomIdInput.toUpperCase());
        if (roomStatusResult.success) {
          const currentStatus = roomStatusResult.status;
          logger.debug("🔍 加入房間時檢查狀態:", {
            roomId: roomIdInput.toUpperCase(),
            currentStatus,
            willSetPhase: currentStatus
          });

          // 根據房間狀態設置對應的 phase
          if (currentStatus === 'questions') {
            logger.warn("⚠️ 房間狀態是 'questions'，將自動進入答題階段");
            setPhase('questions');
          } else if (currentStatus === 'recommend') {
            logger.warn("⚠️ 房間狀態是 'recommend'，將自動進入推薦階段");
            setPhase('recommend');
          } else if (currentStatus === 'completed') {
            logger.warn("⚠️ 房間狀態是 'completed'，將自動進入完成階段");
            setPhase('completed');
          } else {
            logger.debug("✅ 房間狀態正常，設置為 waiting");
            setPhase('waiting'); // 默認狀態
          }
        }

        // 不需要跳轉，直接更新 URL 狀態
        window.history.replaceState({}, '', `/buddies?roomId=${roomIdInput.toUpperCase()}`);

        logger.info("成功加入房間，房號:", roomIdInput.toUpperCase(), "當前狀態:", roomStatusResult.status);
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

  // 生成 Buddies 推薦餐廳
  const generateBuddiesRecommendations = async (roomId, allAnswersData, questions) => {
    try {
      logger.debug("🤖 開始生成 Buddies 推薦餐廳...");
      logger.debug("📊 答案數據:", allAnswersData);
      logger.info("❓ 問題列表:", questions);

      // 獲取餐廳數據
      const restaurantsData = await restaurantService.getRestaurants();
      if (!restaurantsData || !Array.isArray(restaurantsData)) {
        throw new Error("無法獲取餐廳數據");
      }

      // 轉換 Buddies 答案數據為適合推薦算法的格式
      const groupAnswers = {};

      // 處理群組答案數據，取得多數用戶的選擇
      if (Array.isArray(allAnswersData)) {
        allAnswersData.forEach((userAnswer, index) => {
          if (userAnswer && userAnswer.answers && Array.isArray(userAnswer.answers)) {
            userAnswer.answers.forEach((answer, answerIndex) => {
              if (!groupAnswers[answerIndex]) {
                groupAnswers[answerIndex] = [];
              }
              groupAnswers[answerIndex].push(answer);
            });
          }
        });

        // 對每個問題取多數決
        Object.keys(groupAnswers).forEach(questionIndex => {
          const answers = groupAnswers[questionIndex];

          // 統計每個答案的出現次數
          const answerCounts = {};
          answers.forEach(answer => {
            answerCounts[answer] = (answerCounts[answer] || 0) + 1;
          });

          // 找出出現次數最多的答案
          let maxCount = 0;
          let mostCommonAnswer = answers[0]; // 預設值

          Object.entries(answerCounts).forEach(([answer, count]) => {
            if (count > maxCount) {
              maxCount = count;
              mostCommonAnswer = answer;
            }
          });

          groupAnswers[questionIndex] = mostCommonAnswer;
          logger.debug(`📊 問題 ${questionIndex} 多數決結果: ${mostCommonAnswer} (${maxCount}/${answers.length} 票)`);
        });
      }

      // 將物件轉換為陣列格式，給推薦算法使用
      const groupAnswersArray = [];
      const maxIndex = Math.max(...Object.keys(groupAnswers).map(k => parseInt(k)));
      for (let i = 0; i <= maxIndex; i++) {
        groupAnswersArray[i] = groupAnswers[i] || '';
      }

      logger.debug("🔄 轉換後的群組答案陣列:", groupAnswersArray);

      // 調用推薦算法
      const recommendations = recommendRestaurants(
        groupAnswersArray,
        restaurantsData,
        {
          basicQuestions: questions,
          isBuddiesMode: true
        }
      );

      logger.debug("✅ 推薦餐廳生成完成:", recommendations.length, "間餐廳");

      if (recommendations.length > 0) {
        // 保存推薦結果到 Supabase
        const saveResult = await recommendationService.saveRecommendations(roomId, recommendations);

        if (saveResult.success) {
          logger.debug("✅ 推薦結果已保存到數據庫");
          setRecommendations(recommendations);

          // 關閉載入動畫，切換到推薦階段
          setLoadingRecommendations(false);
          setPhase("recommend");
        } else {
          console.error("❌ 保存推薦結果失敗:", saveResult.error);
          setLoadingRecommendations(false);
          setError("生成推薦失敗");
        }
      } else {
        logger.warn("⚠️ 沒有找到合適的餐廳推薦");
        setLoadingRecommendations(false);
        setError("沒有找到合適的餐廳，請重新嘗試");
      }
    } catch (error) {
      console.error("❌ 生成推薦過程中發生錯誤:", error);
      setLoadingRecommendations(false);
      setError("生成推薦時發生錯誤");
    }
  };

  // 提交答案
  const handleSubmitAnswers = async (answerData) => {
    try {
      let answers, questionTexts, questionSources;

      // 定義基本問題（與 handleStartQuestions 中相同）
      const buddiesBasicQuestions = [
        { question: "今天是一個人還是有朋友？", options: ["單人", "多人"] },
        { question: "想吃奢華點還是平價？", options: ["奢華美食", "平價美食"] },
        { question: "想吃正餐還是想喝飲料？", options: ["吃", "喝"] },
        { question: "吃一點還是吃飽？", options: ["吃一點", "吃飽"] },
        { question: "想吃辣的還是不辣？", options: ["辣", "不辣"] }
      ];

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

      // 記錄答案到選擇歷史
      if (currentSessionId) {
        // 分離基本答案和趣味答案
        const basicAnswersList = [];
        const funAnswersList = [];

        answers.forEach((answer, index) => {
          if (questionSources[index] === 'basic') {
            basicAnswersList.push(answer);
          } else {
            funAnswersList.push(answer);
          }
        });

        await selectionHistoryService.saveBasicAnswers(currentSessionId, basicAnswersList);
        await selectionHistoryService.saveFunAnswers(currentSessionId, funAnswersList);
      }

      if (result.success) {
        logger.debug("🎉 所有問題答案提交成功！開始處理完成邏輯...");

        // 只有當這是最終答案提交時才進行後續處理
        logger.debug("📊 檢查所有成員是否都已完成全部問題...");

        // 檢查是否所有成員都已提交完整答案
        const allAnswers = await questionService.getAllAnswers(roomId);
        const memberCount = members.length;

        // 計算可見問題數量（排除依賴問題）
        // 注意：用戶的答案數組長度等於他們實際回答的可見問題數量
        // 所以我們應該檢查是否所有用戶都完成了答題，而不是比較固定的問題數量

        let completedMembers = 0;
        let maxAnswerLength = 0;

        if (allAnswers.success && allAnswers.data) {
          allAnswers.data.forEach(memberAnswer => {
            if (memberAnswer.answers && memberAnswer.answers.length > 0) {
              maxAnswerLength = Math.max(maxAnswerLength, memberAnswer.answers.length);
            }
          });

          // 檢查每個成員是否都達到了最大答案長度（即完成了所有可見問題）
          allAnswers.data.forEach(memberAnswer => {
            if (memberAnswer.answers && memberAnswer.answers.length >= maxAnswerLength && maxAnswerLength > 0) {
              completedMembers++;
            }
          });
        }

        logger.info(`完成全部問題的成員數: ${completedMembers}, 總成員數: ${memberCount}, 最大答案長度: ${maxAnswerLength}, 原始問題總數: ${questions.length}`);

        if (completedMembers >= memberCount) {
          // 所有人都已完成全部問題
          logger.debug("✅ 所有成員都已完成全部問題，開始生成推薦");

          // 啟用載入動畫
          setLoadingRecommendations(true);

          // 生成推薦餐廳
          await generateBuddiesRecommendations(roomId, allAnswers.data, questions);
        } else {
          logger.debug("⏳ 還有成員未完成全部問題，保持在問題階段");
          // 保持在問題階段，讓 BuddiesQuestionSwiper 繼續處理
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
    logger.debug("🎯 handleStartQuestions 被調用");
    logger.info("當前狀態 - roomId:", roomId, "isHost:", isHost, "phase:", phase);

    try {
      // 從資料庫載入基本問題
      logger.debug("📊 從資料庫載入 Buddies 基本問題...");
      const buddiesBasicQuestions = await getBasicQuestionsForBuddies();
      logger.debug("📊 載入的基本問題:", buddiesBasicQuestions);

      // 從資料庫載入趣味問題
      logger.debug("🎉 從資料庫載入 Buddies 趣味問題...");
      const allFunQuestions = await getFunQuestions();
      logger.debug("🎉 載入的趣味問題數量:", allFunQuestions.length);

      // 隨機選擇3個趣味問題
      const randomFun = allFunQuestions
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

      // 格式化基本問題
      const basicWithSource = buddiesBasicQuestions.map((q) => {
        let dependsOnConverted = null;

        // 如果有依賴，需要將 questionId 轉換為問題文本
        if (q.dependsOn && q.dependsOn.questionId) {
          const dependentQ = buddiesBasicQuestions.find(
            dq => dq.id === q.dependsOn.questionId
          );

          if (dependentQ) {
            dependsOnConverted = {
              question: dependentQ.question_text || dependentQ.question,
              answer: q.dependsOn.answer
            };
          }
        }

        return {
          question: q.question_text || q.question,
          options: [q.leftOption, q.rightOption],
          source: "basic",
          dependsOn: dependsOnConverted
        };
      });

      // 格式化趣味問題
      const funWithSource = randomFun.map((q) => ({
        question: q.question_text || q.question || q.text,
        options: [q.leftOption, q.rightOption],
        source: "fun",
        dependsOn: null // 趣味問題通常沒有依賴
      }));

      const combinedQuestions = [...basicWithSource, ...funWithSource];
      logger.info("❓ 組合後的問題數量:", combinedQuestions.length);

      // 保存問題集到 Supabase
      logger.debug("💾 開始保存問題集...");
      const result = await questionService.saveQuestions(roomId, combinedQuestions);
      logger.debug("💾 保存問題集結果:", result);

      if (result.success) {
        setQuestions(combinedQuestions);
        logger.debug("✅ 設置本地問題集完成");

        // 更新房間狀態
        logger.debug("🔄 開始更新房間狀態為 'questions'...");
        const statusResult = await roomService.updateRoomStatus(roomId, 'questions');
        logger.debug("🔄 更新房間狀態結果:", statusResult);

        if (statusResult.success) {
          logger.debug("✅ 房間狀態更新成功，手動設置 phase 為 'questions'");
          setPhase('questions');
        }
      } else {
        console.error("❌ 保存問題集失敗:", result.error);
        setError(result.error || "開始問答失敗");
      }
    } catch (error) {
      console.error("❌ handleStartQuestions 異常:", error);
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
      leftOption: q.options[0]?.option_text || q.options[0],
      rightOption: q.options[1]?.option_text || q.options[1],
      hasVS: q.question.includes("v.s."),
      dependsOn: q.dependsOn, // 保留依賴關係
    }));

  // 渲染不同階段的內容
  const renderPhaseContent = () => {
    switch (phase) {
      case "waiting":
        return (
          <div className="buddies-waiting-container">
            <h2 className="buddies-waiting-title">房間已建立</h2>
            <div className="buddies-room-info">
              <h4 className="buddies-room-number">房號：{roomId}</h4>
              <div className="buddies-qr-container">
                <QRCode
                  value={`${window.location.origin}/buddies?room=${roomId}`}
                  size={160}
                  fgColor="#333"
                  bgColor="#fff"
                  level="M"
                  includeMargin={false}
                />
              </div>
            </div>
            <div className="buddies-room-actions">
              <button
                onClick={copyToClipboard}
                disabled={copyingRoom}
                className={copyingRoom ? "buddies-copy-button-active" : "buddies-copy-button"}
              >
                {copyingRoom ? "複製中..." : "📋 複製房號"}
              </button>
              <button
                onClick={shareRoom}
                disabled={sharing}
                className={sharing ? "buddies-share-button-active" : "buddies-share-button"}
              >
                {sharing ? "分享中..." : "🔗 分享連結"}
              </button>
            </div>
            <div className="buddies-members-section">
              <h4 className="buddies-members-title">目前成員 ({members.length})</h4>
              <div className="buddies-members-list">
                {members.map((m, i) => (
                  <div
                    key={m.uid || m.id || i}
                    className="buddies-member-item"
                  >
                    <div className="buddies-member-avatar">
                      {m.avatar && m.avatar.startsWith('data:image/svg+xml') ? (
                        <img
                          src={m.avatar}
                          alt={m.name || `成員${i + 1}`}
                          className="buddies-avatar-image"
                        />
                      ) : m.avatar ? (
                        <img
                          src={m.avatar}
                          alt={m.name || `成員${i + 1}`}
                          className="buddies-avatar-image"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className="buddies-avatar-fallback"
                        style={{ display: m.avatar ? 'none' : 'flex' }}
                      >
                        {(m.name || `成員${i + 1}`).charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="buddies-member-info">
                      <span className="buddies-member-name">
                        {m.name || `成員 ${i + 1}`}
                        {m.id === userId && <span className="buddies-member-you">（你）</span>}
                      </span>
                      {m.isHost && <span className="buddies-host-badge">主持人</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="buddies-action-section">
              {isHost && (
                <button
                  onClick={handleStartQuestions}
                  disabled={loading || members.length < 1}
                  className="buddies-start-button"
                >
                  🚀 開始答題
                </button>
              )}
              {!isHost && members.length > 0 && (
                <div className="buddies-waiting-message">
                  <p>⏳ 等待主持人開始答題...</p>
                </div>
              )}
            </div>
          </div>
        );

      case "questions":
        return (
          <BuddiesQuestionSwiper
            roomId={roomId}
            questions={formatQuestionsForSwiper(questions)}
            onComplete={handleSubmitAnswers}
            members={members}
            userId={userId}
          />
        );


      case "recommend":
        return (
          <BuddiesRecommendation
            roomId={roomId}
            restaurants={recommendations}
            onBack={() => setPhase("waiting")}
            onComplete={(finalRestaurant) => {
              // 記錄最終選擇的餐廳
              completeBuddiesSession(finalRestaurant);
            }}
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
    logger.info("推薦狀態更新:", {
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
        <div className="buddies-entrance-container">
          <h2 className="buddies-main-title">TasteBuddies - 一起選餐廳</h2>
          <input
            className="buddies-name-input"
            placeholder="你的名稱"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            disabled={loading}
          />
          <input
            className="buddies-room-input"
            placeholder="房號（若要加入）"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            disabled={loading}
          />
          <div className="buddies-button-group">
            <button
              className="buddies-create-button"
              onClick={handleCreateRoom}
              disabled={loading}
            >
              {loading ? "處理中..." : "建立新房間"}
            </button>
            <button
              className="buddies-join-button"
              onClick={() => handleJoinRoom()}
              disabled={loading}
            >
              {loading ? "處理中..." : "加入房間"}
            </button>
            {!joined && (
              <button
                onClick={() => setShowScanner(true)}
                disabled={loading}
                className="buddies-scan-button"
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
            <div className="buddies-error-message">⚠️ {error}</div>
          )}
        </div>
      ) : (
        renderPhaseContent()
      )}

      {/* Buddies 推薦生成載入動畫 */}
      <LoadingOverlay
        show={loadingRecommendations}
        message="分析大家的喜好中"
        subMessage="正在根據所有成員的答案生成最適合的餐廳推薦..."
      />
    </div>
  );
}