// SwiftTaste.jsx
import React, { useState, useEffect } from "react";
import { basicQuestions } from "../data/basicQuestions";
import { funQuestions } from "../data/funQuestions";
import QuestionSwiperMotion from "./QuestionSwiperMotion";
import RestaurantSwiperMotion from "./RestaurantSwiperMotion";
import ModeSwiperMotion from "./ModeSwiperMotion";
import RecommendationResult from "./RecommendationResult";
import {
  getRestaurants,
  getRecommendationsFromFirebase,
  saveRecommendationsToFirebase,
  listenRoomRecommendations,
} from "../services/firebaseService";
import {
  getRandomFunQuestions,
  recommendRestaurants,
  getRandomTen,
} from "../logic/enhancedRecommendLogicFrontend.js";
import { useNavigate, useLocation } from "react-router-dom";
import "./SwiftTasteCard.css";

export default function SwiftTaste() {
  const [phase, setPhase] = useState("selectMode");
  const [recommendations, setRecommendations] = useState([]);
  const [saved, setSaved] = useState([]);
  const [restaurantList, setRestaurantList] = useState([]);
  const [selectedMode, setSelectedMode] = useState(null);
  const [allQuestions, setAllQuestions] = useState([]);
  const [userAnswers, setUserAnswers] = useState([]);
  const [roomId, setRoomId] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // 從Firebase獲取餐廳資料
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 使用新的Firebase服務獲取餐廳數據
        const data = await getRestaurants();
        setRestaurantList(data);
      } catch (error) {
        console.error("Failed to fetch restaurants from Firebase:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 處理URL參數，檢查是否從多人模式進入
  useEffect(() => {
    const params = new URLSearchParams(location.search);

    // 檢查是否是多人模式
    if (params.get("mode") === "buddies") {
      const roomIdParam = params.get("roomId");

      if (roomIdParam) {
        setRoomId(roomIdParam);
        setSelectedMode("buddies");

        // 檢查本地存儲中是否有餐廳推薦
        const savedRecsJson = localStorage.getItem("buddiesRecommendations");

        if (savedRecsJson) {
          try {
            const savedRecs = JSON.parse(savedRecsJson);
            if (savedRecs?.length) {
              setRecommendations(savedRecs);
              setPhase("recommend");
              return;
            }
          } catch (e) {
            console.error("Error parsing saved recommendations:", e);
          }
        }

        // 從Firebase獲取房間推薦數據
        const fetchRoomData = async () => {
          try {
            const roomRecs = await getRecommendationsFromFirebase(roomIdParam);

            if (roomRecs?.length) {
              setRecommendations(roomRecs);
              localStorage.setItem(
                "buddiesRecommendations",
                JSON.stringify(roomRecs)
              );
              setPhase("recommend");
            } else {
              // 如果沒有推薦，設置為選擇模式
              setPhase("selectMode");
            }
          } catch (error) {
            console.error("Failed to fetch room recommendations:", error);
            setPhase("selectMode");
          }
        };

        fetchRoomData();

        // 監聽房間推薦變化
        const unsubscribe = listenRoomRecommendations(
          roomIdParam,
          (updatedRecs) => {
            if (updatedRecs?.length) {
              setRecommendations(updatedRecs);
              localStorage.setItem(
                "buddiesRecommendations",
                JSON.stringify(updatedRecs)
              );
              setPhase("recommend");
            }
          }
        );

        return () => {
          // 清理監聽
          if (typeof unsubscribe === "function") {
            unsubscribe();
          }
        };
      }
    }
  }, [location.search]);

  // 格式化問題以適應滑動器
  const formatQuestionsForSwiper = (questions) =>
    questions.map((q, index) => ({
      id: "q" + index,
      text: q.question,
      leftOption: q.options[0],
      rightOption: q.options[1],
      hasVS: q.question.includes("v.s."), // 標記v.s.格式問題
      dependsOn: q.dependsOn // 保留問題依賴關係
    }));

  // 處理模式選擇（單人/多人）
  const handleModeSelect = (direction) => {
    if (direction === "left") {
      // 前往多人模式
      navigate("/buddies", { state: { fromSwiftTaste: true } });
    } else if (direction === "right") {
      // 單人模式
      setSelectedMode("solo");
      // 隨機抽取3題趣味問題
      const randomFun = getRandomFunQuestions(funQuestions, 3);
      setAllQuestions([...basicQuestions, ...randomFun]);
      setPhase("questions");
    }
  };

  // 處理問題回答完成
  const handleQuestionComplete = async (answersObj) => {
    if (loading || !restaurantList.length) {
      console.error("餐廳數據尚未加載完成");
      return;
    }

    console.log("收到的答案對象:", answersObj);

    // 1. 提取答案列表 - 支援多種格式
    let answerList = [];

    // 如果答案是一個結構化對象，正確提取
    if (answersObj && typeof answersObj === "object") {
      if (Array.isArray(answersObj.answers)) {
        // 新格式：使用 answers 陣列
        answerList = answersObj.answers;
      } else if (answersObj.rawAnswers) {
        // 使用原始答案對象
        answerList = Object.values(answersObj.rawAnswers);
      } else {
        // 舊格式：直接是答案對象
        answerList = Object.values(answersObj);
      }
    }

    console.log("處理後的答案列表:", answerList);
    console.log("包含喝選項:", answerList.includes("喝"));
    
    // 保存用戶回答
    setUserAnswers(answerList);

    // 2. 創建問題-答案映射關係
    const answerQuestionMap = {};
    const questionTexts = [];
    
    // 從 questionTexts 提取問題文本
    if (answersObj.questionTexts && Array.isArray(answersObj.questionTexts)) {
      answersObj.questionTexts.forEach((text, index) => {
        if (index < answerList.length) {
          answerQuestionMap[index] = text;
          questionTexts.push(text);
        }
      });
    }
    // 從問題ID-答案映射中提取
    else {
      // 直接從 answerObj 提取 (q0, q1, q2...)
      Object.entries(answersObj).forEach(([id, answer]) => {
        if (id.startsWith('q')) {
          const index = parseInt(id.replace("q", ""));
          const question = allQuestions[index];
          if (question) {
            answerQuestionMap[index] = question.text || question.question;
            questionTexts[index] = question.text || question.question;
          }
        }
      });
    }

    console.log("問題-答案映射:", answerQuestionMap);
    console.log("問題文本列表:", questionTexts);

    // 3. 使用增強版推薦邏輯
    const recommendedRestaurants = recommendRestaurants(answerList, restaurantList, {
      basicQuestions: basicQuestions,
      answerQuestionMap: answerQuestionMap,
      questionTexts: questionTexts,
      strictBasicMatch: true
    });

    // 4. 如果是多人模式且有房間ID，保存結果到Firebase
    if (selectedMode === "buddies" && roomId) {
      try {
        await saveRecommendationsToFirebase(roomId, recommendedRestaurants);
      } catch (error) {
        console.error("Failed to save recommendations to Firebase:", error);
      }
    }

    // 5. 限制推薦餐廳數量
    const limited = getRandomTen(recommendedRestaurants);
    setRecommendations(limited);

    // 6. 設置下一階段
    if (!limited || limited.length === 0) {
      setSaved([]);
      setPhase("result");
    } else {
      setPhase("recommend");
    }
  };

  // 保存用戶喜歡的餐廳
  const handleSaveRestaurant = (restaurant) => {
    if (!restaurant || !restaurant.id) return;

    if (!saved.find((r) => r.id === restaurant.id)) {
      setSaved((prev) => [...prev, restaurant]);
    }
  };

  // 重新開始
  const handleRestart = () => {
    setPhase("selectMode");
    setRecommendations([]);
    setSaved([]);
    setAllQuestions([]);
    setUserAnswers([]);
    // 如果是多人模式，回到房間而不是回到起點
    if (selectedMode === "buddies" && roomId) {
      navigate(`/buddies?roomId=${roomId}`);
    }
  };

  if (loading && phase === "selectMode") {
    return (
      <div style={{ textAlign: "center", padding: "20px" }}>
        <h2>載入中...</h2>
        <p>正在準備美食推薦</p>
      </div>
    );
  }

  return (
    <div>
      {phase === "selectMode" && (
        <ModeSwiperMotion onSelect={handleModeSelect} />
      )}

      {phase === "questions" && (
        <QuestionSwiperMotion
          questions={formatQuestionsForSwiper(allQuestions)}
          onComplete={handleQuestionComplete}
        />
      )}

      {phase === "recommend" && (
        <>
          <h2>
            推薦餐廳 🍜（{selectedMode === "solo" ? "自己吃" : "一起選"}）
          </h2>
          <RestaurantSwiperMotion
            restaurants={recommendations}
            onSave={handleSaveRestaurant}
            onFinish={() => setPhase("result")}
          />
          <h3>已收藏餐廳 ⭐</h3>
          <ul>
            {saved.map((r) => (
              <li key={r.id}>{r.name}</li>
            ))}
          </ul>
          <button className="btn-restart" onClick={handleRestart}>
            🔄 重新選擇
          </button>
        </>
      )}

      {phase === "result" && (
        <RecommendationResult saved={saved} onRetry={handleRestart} />
      )}
    </div>
  );
}