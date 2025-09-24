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
import { getBasicQuestionsForBuddies, getFunQuestions } from "../services/questionService";
import selectionHistoryService from "../services/selectionHistoryService";
import { authService } from "../services/authService";
import { restaurantService } from "../services/restaurantService";
import { recommendRestaurants } from "../logic/enhancedRecommendLogicFrontend";

export default function BuddiesRoom() {
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [userId, setUserId] = useState("");
  const [phase, setPhaseState] = useState("lobby");

  // 包裝 setPhase 來追蹤所有變更
  const setPhase = (newPhase) => {
    const stack = new Error().stack.split('\n');
    console.log("🔄 setPhase 被調用:", {
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
        console.log('無法獲取登入用戶資訊:', error);
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

  // 監聽房間狀態變化（只在加入房間時建立一次）
  useEffect(() => {
    console.log("🔍 監聽房間狀態 useEffect 觸發:", { joined, roomId });

    if (joined && roomId) {
      console.log("✅ 條件滿足，開始設置房間狀態監聽器");
      const cleanup = roomService.listenRoomStatus(roomId, (status) => {
        console.log("🔔 房間狀態變化監聽器觸發:", {
          newStatus: status,
          roomId: roomId,
          timestamp: new Date().toLocaleTimeString()
        });

        if (status === 'waiting') {
          console.log("🔄 設置 phase 為 'waiting'");
          setPhase('waiting');
        } else if (status === 'questions') {
          console.log("🔄 設置 phase 為 'questions'");
          setPhase('questions');
        } else if (status === 'recommend') {
          console.log("🔄 設置 phase 為 'recommend'");
          setPhase('recommend');
        } else if (status === 'completed') {
          console.log("🔄 設置 phase 為 'completed'");
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
        // 移除自動進入答題的邏輯，讓房間狀態監聽器來處理
        // 這樣可以確保只有通過正式的房間狀態變化才會進入答題環節
      });

      setSubscriptionCleanups(prev => [...prev, cleanup]);

      return () => cleanup();
    }
  }, [joined, roomId]);

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

  // 選擇紀錄相關函數
  const startBuddiesSession = async (buddiesRoomId) => {
    try {
      console.log('Starting Buddies selection session for room:', buddiesRoomId);
      setSessionStartTime(new Date());

      const result = await selectionHistoryService.startSession('buddies', {
        user_location: await getCurrentLocation()
      });

      if (result.success) {
        setCurrentSessionId(result.sessionId);
        // 設置 Buddies 房間 ID
        await selectionHistoryService.setBuddiesRoomId(result.sessionId, buddiesRoomId);
        console.log('Buddies session started:', result.sessionId);
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
            console.warn('Location access denied:', error);
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
      console.log('Buddies session completed');
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
      
      const response = await roomService.createRoom(userName);

      if (response.success) {
        setRoomId(response.roomId);
        setIsHost(true);
        setJoined(true);
        setPhase("waiting");

        // 開始 Buddies 選擇會話
        await startBuddiesSession(response.roomId);

        // 獲取房間成員列表
        const membersResult = await memberService.getRoomMembers(response.roomId);
        if (membersResult.success) {
          const membersList = membersResult.data.map(member => ({
            id: member.user_id,
            name: member.user_name,
            isHost: member.is_host,
            uid: member.user_id
          }));
          setMembers(membersList);
          console.log("載入成員列表:", membersList);
        }

        // 確認房間狀態為 waiting
        const roomStatusResult = await roomService.getRoomStatus(response.roomId);
        if (roomStatusResult.success) {
          console.log("🔍 創建房間後檢查狀態:", {
            expectedStatus: 'waiting',
            actualStatus: roomStatusResult.status,
            needsCorrection: roomStatusResult.status !== 'waiting'
          });

          // 即使我們已經設置了 waiting，也確認一下房間狀態
          if (roomStatusResult.status !== 'waiting') {
            console.warn("⚠️ 房間狀態不是 waiting，錯誤地設置 phase 為:", roomStatusResult.status);
            console.warn("🚨 這可能導致自動進入答題階段！");
            // 暫時註解掉這行，強制保持 waiting 狀態
            // setPhase(roomStatusResult.status);
          }
        }

        // 不需要跳轉，直接更新 URL 狀態
        window.history.replaceState({}, '', `/buddies?roomId=${response.roomId}`);

        console.log("房間建立成功，房號:", response.roomId, "當前狀態: waiting");
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
          const membersList = membersResult.data.map(member => ({
            id: member.user_id,
            name: member.user_name,
            isHost: member.is_host,
            uid: member.user_id
          }));
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
          console.log("🔍 加入房間時檢查狀態:", {
            roomId: roomIdInput.toUpperCase(),
            currentStatus,
            willSetPhase: currentStatus
          });

          // 根據房間狀態設置對應的 phase
          if (currentStatus === 'questions') {
            console.warn("⚠️ 房間狀態是 'questions'，將自動進入答題階段");
            setPhase('questions');
          } else if (currentStatus === 'recommend') {
            console.warn("⚠️ 房間狀態是 'recommend'，將自動進入推薦階段");
            setPhase('recommend');
          } else if (currentStatus === 'completed') {
            console.warn("⚠️ 房間狀態是 'completed'，將自動進入完成階段");
            setPhase('completed');
          } else {
            console.log("✅ 房間狀態正常，設置為 waiting");
            setPhase('waiting'); // 默認狀態
          }
        }

        // 不需要跳轉，直接更新 URL 狀態
        window.history.replaceState({}, '', `/buddies?roomId=${roomIdInput.toUpperCase()}`);

        console.log("成功加入房間，房號:", roomIdInput.toUpperCase(), "當前狀態:", roomStatusResult.status);
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
      console.log("🤖 開始生成 Buddies 推薦餐廳...");
      console.log("📊 答案數據:", allAnswersData);
      console.log("❓ 問題列表:", questions);

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

        // 對每個問題取多數決或加權平均
        Object.keys(groupAnswers).forEach(questionIndex => {
          const answers = groupAnswers[questionIndex];
          // 對於 Buddies 模式，我們使用第一個用戶的答案作為代表（可以改進為多數決）
          groupAnswers[questionIndex] = answers[0];
        });
      }

      // 將物件轉換為陣列格式，給推薦算法使用
      const groupAnswersArray = [];
      const maxIndex = Math.max(...Object.keys(groupAnswers).map(k => parseInt(k)));
      for (let i = 0; i <= maxIndex; i++) {
        groupAnswersArray[i] = groupAnswers[i] || '';
      }

      console.log("🔄 轉換後的群組答案陣列:", groupAnswersArray);

      // 調用推薦算法
      const recommendations = recommendRestaurants(
        groupAnswersArray,
        restaurantsData,
        {
          basicQuestions: questions,
          isBuddiesMode: true
        }
      );

      console.log("✅ 推薦餐廳生成完成:", recommendations.length, "間餐廳");

      if (recommendations.length > 0) {
        // 保存推薦結果到 Supabase
        const saveResult = await recommendationService.saveRecommendations(roomId, recommendations);

        if (saveResult.success) {
          console.log("✅ 推薦結果已保存到數據庫");
          setRecommendations(recommendations);
          setPhase("recommend");
        } else {
          console.error("❌ 保存推薦結果失敗:", saveResult.error);
          setError("生成推薦失敗");
        }
      } else {
        console.warn("⚠️ 沒有找到合適的餐廳推薦");
        setError("沒有找到合適的餐廳，請重新嘗試");
      }
    } catch (error) {
      console.error("❌ 生成推薦過程中發生錯誤:", error);
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
        console.log("🎉 所有問題答案提交成功！開始處理完成邏輯...");

        // 只有當這是最終答案提交時才進行後續處理
        console.log("📊 檢查所有成員是否都已完成全部問題...");

        // 檢查是否所有成員都已提交完整答案
        const allAnswers = await questionService.getAllAnswers(roomId);
        const memberCount = members.length;

        // 計算完成答題的成員數（需要檢查每個成員的答案數量是否等於問題總數）
        const questionCount = questions.length;
        let completedMembers = 0;

        if (allAnswers.success && allAnswers.data) {
          allAnswers.data.forEach(memberAnswer => {
            if (memberAnswer.answers && memberAnswer.answers.length >= questionCount) {
              completedMembers++;
            }
          });
        }

        console.log(`完成全部問題的成員數: ${completedMembers}, 總成員數: ${memberCount}, 問題總數: ${questionCount}`);

        if (completedMembers >= memberCount) {
          // 所有人都已完成全部問題
          console.log("✅ 所有成員都已完成全部問題，開始生成推薦");
          setPhase("waiting-recommendations");

          // 生成推薦餐廳
          await generateBuddiesRecommendations(roomId, allAnswers.data, questions);
        } else {
          console.log("⏳ 還有成員未完成全部問題，保持在問題階段");
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
    console.log("🎯 handleStartQuestions 被調用");
    console.log("當前狀態 - roomId:", roomId, "isHost:", isHost, "phase:", phase);

    try {
      // 從資料庫載入基本問題
      console.log("📊 從資料庫載入 Buddies 基本問題...");
      const buddiesBasicQuestions = await getBasicQuestionsForBuddies();
      console.log("📊 載入的基本問題:", buddiesBasicQuestions);

      // 從資料庫載入趣味問題
      console.log("🎉 從資料庫載入 Buddies 趣味問題...");
      const allFunQuestions = await getFunQuestions();
      console.log("🎉 載入的趣味問題數量:", allFunQuestions.length);

      // 隨機選擇3個趣味問題
      const randomFun = allFunQuestions
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

      // 格式化基本問題
      const basicWithSource = buddiesBasicQuestions.map((q) => ({
        question: q.question_text || q.question,
        options: [q.leftOption, q.rightOption],
        source: "basic",
      }));

      // 格式化趣味問題
      const funWithSource = randomFun.map((q) => ({
        question: q.question_text || q.question || q.text,
        options: [q.leftOption, q.rightOption],
        source: "fun",
      }));

      const combinedQuestions = [...basicWithSource, ...funWithSource];
      console.log("❓ 組合後的問題數量:", combinedQuestions.length);

      // 保存問題集到 Supabase
      console.log("💾 開始保存問題集...");
      const result = await questionService.saveQuestions(roomId, combinedQuestions);
      console.log("💾 保存問題集結果:", result);

      if (result.success) {
        setQuestions(combinedQuestions);
        console.log("✅ 設置本地問題集完成");

        // 更新房間狀態
        console.log("🔄 開始更新房間狀態為 'questions'...");
        const statusResult = await roomService.updateRoomStatus(roomId, 'questions');
        console.log("🔄 更新房間狀態結果:", statusResult);

        if (statusResult.success) {
          console.log("✅ 房間狀態更新成功，手動設置 phase 為 'questions'");
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
            userId={userId}
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