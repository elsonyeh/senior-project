// ✅ SwiftTaste.jsx
import React, { useState, useEffect } from "react";
import { basicQuestions } from '../data/basicQuestions';
import { funQuestions } from '../data/funQuestions';
import QuestionSwiperMotion from "./QuestionSwiperMotion";
import RestaurantSwiperMotion from "./RestaurantSwiperMotion";
import ModeSwiperMotion from "./ModeSwiperMotion";
import RecommendationResult from "./RecommendationResult";
import { getRandomFunQuestions, recommendRestaurants } from '../logic/recommendLogic';
import { getDocs, collection } from "firebase/firestore";
import { db } from "../services/firebase";
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
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const snapshot = await getDocs(collection(db, "restaurants"));
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));
        setRestaurantList(data);
      } catch (error) {
        console.error("Failed to fetch restaurants from Firebase:", error);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("mode") === "buddies") {
      const savedRecs = JSON.parse(localStorage.getItem("buddiesRecommendations"));
      if (savedRecs?.length) {
        setSelectedMode("buddies");
        setRecommendations(savedRecs);
        setPhase("recommend");
      }
    }
  }, [location.search]);

  const formatQuestionsForSwiper = (questions) =>
    questions.map((q, index) => ({
      id: "q" + index,
      text: q.question,
      leftOption: q.options[0],
      rightOption: q.options[1],
      hasVS: q.question.includes("v.s.") // Add flag for v.s. formatting
    }));

  const getRandomTen = (arr) => {
    if (arr.length <= 10) return arr;
    return [...arr].sort(() => 0.5 - Math.random()).slice(0, 10);
  };

  const handleModeSelect = (direction) => {
    if (direction === "left") {
      navigate("/buddies", { state: { fromSwiftTaste: true } });
    } else if (direction === "right") {
      setSelectedMode("solo");
      const randomFun = getRandomFunQuestions(funQuestions);
      setAllQuestions([...basicQuestions, ...randomFun]);
      setPhase("questions");
    }
  };

  const handleQuestionComplete = (answersObj) => {
    const answerList = Object.values(answersObj);
    setUserAnswers(answerList);
    const allRecommended = recommendRestaurants(answerList, restaurantList);
    const limited = getRandomTen(allRecommended);
    setRecommendations(limited);
    if (limited.length === 0) {
      setSaved([]);
      setPhase("result");
    } else {
      setPhase("recommend");
    }
  };

  const handleSaveRestaurant = (restaurant) => {
    if (!saved.find((r) => r.id === restaurant.id)) {
      setSaved((prev) => [...prev, restaurant]);
    }
  };

  const handleRestart = () => {
    setPhase("selectMode");
    setRecommendations([]);
    setSaved([]);
    setAllQuestions([]);
    setUserAnswers([]);
  };

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