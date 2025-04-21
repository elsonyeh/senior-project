import React, { useState, useEffect } from "react";
import { basicQuestions } from '../data/basicQuestions';
import { funQuestions } from '../data/funQuestions';
import QuestionSwiperMotion from "./QuestionSwiperMotion";
import RestaurantSwiperMotion from "./RestaurantSwiperMotion";   
import ModeSwiperMotion from "./ModeSwiperMotion";
import { getRandomFunQuestions, recommendRestaurants } from '../logic/recommendLogic';
import { getDocs, collection } from "firebase/firestore";
import { db } from "../services/firebase";
import { useNavigate } from "react-router-dom";
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

  const formatQuestionsForSwiper = (questions) =>
    questions.map((q, index) => ({
      id: "q" + index,
      text: q.question,
      leftOption: q.options[0],
      rightOption: q.options[1],
    }));

  const getRandomTen = (arr) => {
    if (arr.length <= 10) return arr;
    return [...arr].sort(() => 0.5 - Math.random()).slice(0, 10);
  };

  const handleModeSelect = (direction) => {
    if (direction === "left") {
      navigate("/buddies");
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
    setPhase("recommend");
  };

  const handleSaveRestaurant = (restaurant) => {
    if (!saved.find((r) => r.id === restaurant.id)) {
      setSaved([...saved, restaurant]);
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
          {recommendations.length === 0 ? (
            <p>目前沒有符合條件的推薦！</p>
          ) : (
            <RestaurantSwiperMotion
              restaurants={recommendations}
              onSave={handleSaveRestaurant}
              showAddressAndPhoto={true}
            />
          )}
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
    </div>
  );
}