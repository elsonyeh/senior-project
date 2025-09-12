// 修復 SwiftTaste.jsx 中的 navigate 語法錯誤
// 將 navigate(/buddies?roomId=) 改為 navigate(/buddies?roomId=)

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { roomService, memberService, recommendationService } from "../services/supabaseService";
import { restaurantService } from "../services/restaurantService";
import { funQuestionTagService } from "../services/funQuestionTagService";
import { getBasicQuestionsForSwiftTaste, getFunQuestions } from "../services/questionService";
import ModeSwiperMotion from "./ModeSwiperMotion";
import QuestionSwiperMotion from "./QuestionSwiperMotion";
import QuestionSwiperMotionSingle from "./QuestionSwiperMotionSingle";
import RestaurantSwiperMotion from "./RestaurantSwiperMotion";
import RecommendationResult from "./RecommendationResult";
import BuddiesRoom from "./BuddiesRoom";
import BuddiesQuestionSwiper from "./BuddiesQuestionSwiper";
import BuddiesRecommendation from "./BuddiesRecommendation";
import BuddiesResultPage from "../pages/BuddiesResultPage";
import LoadingOverlay from "./LoadingOverlay";
import SwipeOnboarding from "./SwipeOnboarding";
import IdleHint from "./IdleHint";
import "./SwiftTasteCard.css";

export default function SwiftTaste() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [phase, setPhase] = useState("selectMode");
  const [selectedMode, setSelectedMode] = useState(null);
  const [userAnswers, setUserAnswers] = useState([]);
  const [basicAnswers, setBasicAnswers] = useState([]);
  const [funAnswers, setFunAnswers] = useState([]);
  const basicAnswersRef = useRef([]);  // 用於可靠地存儲基本答案
  const [restaurants, setRestaurants] = useState([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingRestaurantFilter, setLoadingRestaurantFilter] = useState(false);
  const [error, setError] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [finalResult, setFinalResult] = useState(null);
  const [funQuestionTagsMap, setFunQuestionTagsMap] = useState({});
  const [loadingTags, setLoadingTags] = useState(false);
  const [basicQuestions, setBasicQuestions] = useState([]);
  const [funQuestions, setFunQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [showIdleHint, setShowIdleHint] = useState(false);
  const [idleTimer, setIdleTimer] = useState(null);
  
  // Current questions being shown
  const currentQuestions = phase === 'questions' ? basicQuestions : (phase === 'funQuestions' ? funQuestions : []);

  // 從 URL 參數獲取房間ID
  useEffect(() => {
    const urlRoomId = searchParams.get("roomId");
    if (urlRoomId) {
      setRoomId(urlRoomId);
      setSelectedMode("buddies");
      setPhase("buddiesRoom");
    }
  }, [searchParams]);

  // 監聽phase變化，管理停留時間提示
  useEffect(() => {
    // 在這些階段啟動停留時間計時器
    const phasesWithIdleTimer = ['selectMode', 'questions', 'funQuestions', 'restaurants'];
    
    if (phasesWithIdleTimer.includes(phase) && !showOnboarding) {
      startIdleTimer();
    } else {
      clearIdleTimer();
    }

    // 清理函數
    return () => {
      clearIdleTimer();
    };
  }, [phase, showOnboarding]);

  // 載入餐廳資料和問題
  useEffect(() => {
    loadRestaurants();
    loadQuestions();
    // 預載入趣味問題標籤映射（不阻塞UI，不顯示載入動畫）
    loadFunQuestionTagsMap(false).catch(err => {
      console.warn('Pre-loading fun question tags failed:', err);
    });
  }, []);

  const loadQuestions = async () => {
    try {
      setQuestionsLoading(true);
      
      // 載入SwiftTaste基本問題（包含所有基本問題）
      const basicQs = await getBasicQuestionsForSwiftTaste();
      setBasicQuestions(basicQs);
      
      // 載入趣味問題
      const funQs = await getFunQuestions();
      setFunQuestions(funQs);
      
      console.log(`Loaded ${basicQs.length} basic questions and ${funQs.length} fun questions`);
    } catch (error) {
      console.error('Error loading questions:', error);
      setError('載入問題失敗');
    } finally {
      setQuestionsLoading(false);
    }
  };

  const loadFunQuestionTagsMap = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoadingTags(true);
      }
      console.log('Loading fun question tags map...');
      const tagsMap = await funQuestionTagService.getFunQuestionTagsMap();
      setFunQuestionTagsMap(tagsMap);
      console.log('Loaded fun question tags map with', Object.keys(tagsMap).length, 'options');
      return tagsMap;
    } catch (error) {
      console.error('Failed to load fun question tags map:', error);
      // 使用回退映射
      const fallbackMap = funQuestionTagService.getFallbackTagsMap();
      setFunQuestionTagsMap(fallbackMap);
      return fallbackMap;
    } finally {
      if (showLoading) {
        setLoadingTags(false);
      }
    }
  };

  const loadRestaurants = async () => {
    try {
      setLoading(true);
      // 從 Supabase 載入餐廳資料
      const data = await restaurantService.getRestaurants({
        featured: false, // 載入所有餐廳，不只是推薦餐廳
        minRating: 0     // 不限制評分
      });
      setRestaurants(data);
    } catch (error) {
      console.error("載入餐廳失敗:", error);
      setError("載入餐廳失敗，請稍後重試");
      // 如果載入失敗，使用空陣列作為備用
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  };

  const handleModeSelect = (direction) => {
    // 將滑動方向轉換為模式
    const mode = direction === "left" ? "buddies" : "single";
    setSelectedMode(mode);
    if (mode === "buddies") {
      setPhase("buddiesRoom");
    } else {
      // 清理之前的保存餐廳記錄
      localStorage.removeItem("savedRestaurants");
      console.log("Cleared previous saved restaurants");
      
      // 檢查是否已經看過引導動畫
      const hasSeenOnboardingBefore = localStorage.getItem("hasSeenSwipeOnboarding");
      if (!hasSeenOnboardingBefore) {
        setShowOnboarding(true);
      } else {
        setPhase("questions");
      }
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setHasSeenOnboarding(true);
    localStorage.setItem("hasSeenSwipeOnboarding", "true");
    setPhase("questions");
  };

  // 用於開發測試：重置引導動畫狀態
  const resetOnboarding = () => {
    localStorage.removeItem("hasSeenSwipeOnboarding");
    setHasSeenOnboarding(false);
    setShowOnboarding(false);
    console.log("Onboarding reset - will show again on next single mode selection");
  };

  // 用於開發測試：強制顯示引導動畫
  const forceShowOnboarding = () => {
    setShowOnboarding(true);
    console.log("Forcing onboarding to show");
  };

  // 停留時間管理
  const startIdleTimer = () => {
    clearIdleTimer(); // 清除之前的計時器
    const timer = setTimeout(() => {
      setShowIdleHint(true);
    }, 15000); // 15秒後顯示提示
    setIdleTimer(timer);
  };

  const clearIdleTimer = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      setIdleTimer(null);
    }
    setShowIdleHint(false);
  };

  const resetIdleTimer = () => {
    clearIdleTimer();
    startIdleTimer();
  };

  const handleBasicQuestionsComplete = (answers) => {
    console.log('Basic questions completed with answers:', answers);
    const basicAnswersList = answers.answers || [];
    setBasicAnswers(basicAnswersList);
    basicAnswersRef.current = basicAnswersList;  // 同時存儲到ref中
    console.log('Stored basic answers in ref:', basicAnswersRef.current);
    setPhase("funQuestions"); // 轉到趣味問題
  };

  const handleFunQuestionsComplete = async (answers) => {
    console.log('Fun questions completed with answers:', answers);
    const funAnswersList = answers.answers || [];
    setFunAnswers(funAnswersList);
    
    // 使用ref中的基本答案，確保數據正確
    const currentBasicAnswers = basicAnswersRef.current;
    console.log('Using basic answers from ref:', currentBasicAnswers);
    console.log('Using fun answers:', funAnswersList);
    
    if (currentBasicAnswers.length === 0) {
      console.error('Basic answers are empty! This should not happen.');
      // 如果基本答案為空，回到基本問題
      setPhase("questions");
      return;
    }
    
    // 確保標籤映射已載入
    if (Object.keys(funQuestionTagsMap).length === 0 && !loadingTags) {
      console.log('Fun question tags not loaded, loading now...');
      await loadFunQuestionTagsMap(true); // 這時需要顯示載入動畫
    }
    
    await filterRestaurantsByAnswers(currentBasicAnswers, funAnswersList);
    setPhase("restaurants"); // 轉到餐廳推薦
  };

  const filterRestaurantsByAnswers = async (basic, fun) => {
    console.log('Filtering restaurants with basic:', basic, 'fun:', fun);
    setLoadingRestaurantFilter(true);
    
    try {
      // 處理答案格式 - 檢查是否已經是字串陣列
      const basicAnswers = Array.isArray(basic) ? 
        (typeof basic[0] === 'string' ? basic : basic.map(answer => answer.selectedOption || answer)) : 
        [];
      const funAnswers = Array.isArray(fun) ? 
        (typeof fun[0] === 'string' ? fun : fun.map(answer => answer.selectedOption || answer)) : 
        [];
    
    console.log('Basic answers:', basicAnswers);
    console.log('Fun answers:', funAnswers);
    
    // 權重常數（基於後端邏輯）
    const WEIGHT = {
      BASIC_MATCH: 10,
      FUN_MATCH: 5,
      RATING: 1.5,
      MIN_SCORE: 1
    };
    
    // 前置過濾：嚴格匹配關鍵條件
    let filteredRestaurants = restaurants;
    console.log(`Starting with ${restaurants.length} restaurants`);
    
    if (basicAnswers.includes("喝")) {
      console.log("Filtering for 喝 restaurants...");
      // 如果選擇了「喝」，只保留有「喝」標籤的餐廳
      filteredRestaurants = filteredRestaurants.filter(r => {
        const tags = r.tags ? (Array.isArray(r.tags) ? r.tags : [r.tags]) : [];
        const hasTag = tags.some(tag => 
          typeof tag === 'string' && tag.toLowerCase().trim() === "喝"
        );
        if (hasTag) {
          console.log(`✓ Restaurant ${r.name} has 喝 tag:`, tags);
        }
        return hasTag;
      });
      console.log(`After 喝 filter: ${filteredRestaurants.length} restaurants`);
      
      if (filteredRestaurants.length === 0) {
        console.warn("沒有找到符合「喝」條件的餐廳");
        setFilteredRestaurants([]);
        return;
      }
    } else if (basicAnswers.includes("吃一點")) {
      console.log("Filtering for 吃一點 restaurants...");
      // 只保留有「吃一點」標籤的餐廳
      filteredRestaurants = filteredRestaurants.filter(r => {
        const tags = r.tags ? (Array.isArray(r.tags) ? r.tags : [r.tags]) : [];
        const hasTag = tags.some(tag =>
          typeof tag === 'string' && tag.toLowerCase().trim() === "吃一點"
        );
        if (hasTag) {
          console.log(`✓ Restaurant ${r.name} has 吃一點 tag:`, tags);
        }
        return hasTag;
      });
      console.log(`After 吃一點 filter: ${filteredRestaurants.length} restaurants`);
      
      if (filteredRestaurants.length === 0) {
        console.warn("沒有找到符合「吃一點」條件的餐廳");
        setFilteredRestaurants([]);
        return;
      }
    } else if (basicAnswers.includes("吃飽")) {
      console.log("Filtering for 吃飽 restaurants...");
      // 只保留有「飽足」標籤的餐廳
      filteredRestaurants = filteredRestaurants.filter(r => {
        const tags = r.tags ? (Array.isArray(r.tags) ? r.tags : [r.tags]) : [];
        const hasTag = tags.some(tag =>
          typeof tag === 'string' && tag.toLowerCase().trim() === "飽足"
        );
        if (hasTag) {
          console.log(`✓ Restaurant ${r.name} has 飽足 tag:`, tags);
        }
        return hasTag;
      });
      console.log(`After 飽足 filter: ${filteredRestaurants.length} restaurants`);
      
      if (filteredRestaurants.length === 0) {
        console.warn("沒有找到符合「飽足」條件的餐廳");
        setFilteredRestaurants([]);
        return;
      }
    } else {
      console.log("No critical filtering needed, proceeding with all restaurants");
    }
    
    // 計算每個餐廳的匹配分數
    const scoredRestaurants = await Promise.all(filteredRestaurants.map(async restaurant => {
      let score = WEIGHT.MIN_SCORE;
      const { price_range, tags, rating, isSpicy } = restaurant;
      
      // 正規化餐廳標籤
      const restaurantTags = Array.isArray(tags) ? tags : (tags ? [tags] : []);
      const normalizedTags = restaurantTags
        .filter(Boolean)
        .filter(tag => tag !== null && tag !== undefined)
        .map(tag => String(tag || '').toLowerCase())
        .filter(tag => tag.length > 0);
      
      let basicMatchCount = 0;
      
      // 處理基本問題匹配
      basicAnswers.forEach(answer => {
        let matched = false;
        
        switch(answer) {
          case "奢華美食":
            // 根據後端邏輯：價格範圍是 $$$ 或 $$
            matched = price_range === "$$$" || price_range === "$$";
            if (matched) console.log(`✓ ${restaurant.name} matches 奢華美食 (price: ${price_range})`);
            break;
            
          case "平價美食":
            // 根據後端邏輯：價格範圍是 $ 或 $$
            matched = price_range === "$" || price_range === "$$";
            if (matched) console.log(`✓ ${restaurant.name} matches 平價美食 (price: ${price_range})`);
            break;
            
          case "吃":
            // 檢查是否有"吃一點"或"飽足"標籤
            matched = normalizedTags.includes("吃一點") || normalizedTags.includes("飽足");
            if (matched) {
              console.log(`✓ ${restaurant.name} matches 吃 (has 吃一點 or 飽足 tag)`);
              score += WEIGHT.BASIC_MATCH; // 避免重複加分
            }
            break;
            
          case "喝":
            // 必須有"喝"標籤
            matched = normalizedTags.includes("喝");
            if (matched) {
              console.log(`✓ ${restaurant.name} matches 喝`);
              score += WEIGHT.BASIC_MATCH * 1.5; // 提高喝的匹配權重
            }
            break;
            
          case "吃一點":
            // 必須有"吃一點"標籤
            matched = normalizedTags.includes("吃一點");
            if (matched) console.log(`✓ ${restaurant.name} matches 吃一點`);
            break;
            
          case "吃飽":
            // 必須有"飽足"標籤
            matched = normalizedTags.includes("飽足");
            if (matched) console.log(`✓ ${restaurant.name} matches 吃飽 (has 飽足 tag)`);
            break;
            
          case "辣":
            matched = isSpicy === true;
            if (matched) console.log(`✓ ${restaurant.name} matches 辣 (isSpicy: ${isSpicy})`);
            break;
            
          case "不辣":
            matched = isSpicy === false;
            if (matched) console.log(`✓ ${restaurant.name} matches 不辣 (isSpicy: ${isSpicy})`);
            break;
            
          case "單人":
            // 檢查建議人數是否包含"1"
            matched = restaurant.suggested_people && restaurant.suggested_people.includes("1");
            if (matched) console.log(`✓ ${restaurant.name} matches 單人 (suggested_people: ${restaurant.suggested_people})`);
            break;
            
          case "多人":
            // 檢查建議人數是否包含"~"（表示多人）
            matched = restaurant.suggested_people && restaurant.suggested_people.includes("~");
            if (matched) console.log(`✓ ${restaurant.name} matches 多人 (suggested_people: ${restaurant.suggested_people})`);
            break;
            
          default:
            // 其他答案用標籤匹配
            const safeAnswer = String(answer || '').toLowerCase();
            matched = safeAnswer.length > 0 && normalizedTags.some(tag => 
              tag && typeof tag === 'string' && tag.includes(safeAnswer)
            );
            if (matched) console.log(`✓ ${restaurant.name} matches ${answer} via tag matching`);
            break;
        }
        
        // 只對非特殊情況加基本分數（吃和喝已經在上面處理過加分）
        if (matched && !['吃', '喝'].includes(answer)) {
          score += WEIGHT.BASIC_MATCH;
          basicMatchCount++;
        } else if (matched && ['吃一點', '吃飽'].includes(answer)) {
          // 對吃一點和吃飽也計入匹配數量
          basicMatchCount++;
        }
      });
      
      // 如果沒有任何基本匹配，給予最低分
      if (basicMatchCount === 0 && basicAnswers.length > 0) {
        score = WEIGHT.MIN_SCORE;
      }
      
      // 處理趣味問題匹配（使用Supabase標籤映射）
      if (funAnswers.length > 0) {
        // 使用批量計算匹配分數
        const funMatchScore = await funQuestionTagService.calculateBatchMatchScore(
          funAnswers, 
          restaurantTags
            .filter(tag => tag !== null && tag !== undefined && tag !== '')
            .map(tag => String(tag || ''))
            .filter(tag => tag.length > 0)
        );
        
        score += funMatchScore * WEIGHT.FUN_MATCH;
      }
      
      // 加入評分權重
      if (typeof rating === 'number' && rating > 0) {
        score += Math.min(rating / 5, 1) * WEIGHT.RATING;
      }
      
      // 如果完全匹配所有基本問題，給予額外獎勵
      if (basicMatchCount === basicAnswers.length && basicAnswers.length > 0) {
        score += WEIGHT.BASIC_MATCH * 0.5;
      }
      
      return { ...restaurant, calculatedScore: score };
    }));
    
    // 過濾掉分數過低的餐廳
    const minScoreThreshold = WEIGHT.MIN_SCORE * 2;
    const qualifiedRestaurants = scoredRestaurants.filter(r => r.calculatedScore >= minScoreThreshold);
    
    // 按分數排序，選出前10名
    const sortedRestaurants = qualifiedRestaurants.length > 0 ? 
      qualifiedRestaurants.sort((a, b) => b.calculatedScore - a.calculatedScore) :
      scoredRestaurants.sort((a, b) => b.calculatedScore - a.calculatedScore).slice(0, 10);
    
    const selected = sortedRestaurants.slice(0, 10);
    
    console.log(`Filtered ${selected.length} restaurants from ${restaurants.length} total`);
    console.log('Selected restaurants:', selected.map(r => ({ 
      name: r.name, 
      score: r.calculatedScore.toFixed(2), 
      tags: r.tags,
      price: r.price_range 
      })));
      
      setFilteredRestaurants(selected);
      
    } catch (error) {
      console.error('Error filtering restaurants:', error);
      setError('篩選餐廳時發生錯誤');
    } finally {
      setLoadingRestaurantFilter(false);
    }
  };

  const getRandomFunQuestions = (questions, count = 3) => {
    const shuffled = [...questions].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  const handleSave = (restaurant) => {
    console.log('Saving restaurant:', restaurant);
    // 單人模式：直接保存到本地
    if (selectedMode === "single") {
      const saved = JSON.parse(localStorage.getItem("savedRestaurants") || "[]");
      
      // 避免重複保存相同餐廳
      const alreadySaved = saved.some(r => r.id === restaurant.id || r.name === restaurant.name);
      if (!alreadySaved) {
        const newSaved = [...saved, restaurant];
        localStorage.setItem("savedRestaurants", JSON.stringify(newSaved));
        console.log(`✓ Saved ${restaurant.name} to localStorage. Total saved: ${newSaved.length}`);
      } else {
        console.log(`Restaurant ${restaurant.name} already saved, skipping.`);
      }
    }
  };

  const handleRestaurantFinish = () => {
    if (selectedMode === "single") {
      setPhase("result");
    } else if (selectedMode === "buddies") {
      setPhase("buddiesRecommendation");
    }
  };

  const handleBackToStart = () => {
    setPhase("selectMode");
    setSelectedMode(null);
    setUserAnswers([]);
    // 如果是多人模式，回到房間而不是回到起點
    if (selectedMode === "buddies" && roomId) {
      navigate(`/buddies?roomId=${roomId}`);
    }
  };

  if ((loading || questionsLoading) && phase === "selectMode") {
    return (
      <div style={{ textAlign: "center", padding: "20px" }}>
        <h2>載入中...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "20px" }}>
        <h2>錯誤</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>重新整理</button>
      </div>
    );
  }

  return (
    <div className="swift-taste">
      {/* 開發測試按鈕 */}
      {import.meta.env.DEV && (
        <div className="dev-controls">
          <button 
            onClick={forceShowOnboarding}
            className="dev-btn dev-btn-show"
          >
            🎯 測試引導動畫
          </button>
          <button 
            onClick={resetOnboarding}
            className="dev-btn dev-btn-reset"
          >
            🔄 重置引導狀態
          </button>
        </div>
      )}

      {/* 停留時間提示 */}
      <IdleHint 
        show={showIdleHint} 
        phase={phase} 
        onDismiss={resetIdleTimer} 
      />

      {/* SwiftTaste 引導動畫 */}
      {showOnboarding && (
        <SwipeOnboarding onComplete={handleOnboardingComplete} />
      )}
      
      {phase === "selectMode" && (
        <ModeSwiperMotion onSelect={(direction) => {
          resetIdleTimer(); // 重置計時器
          handleModeSelect(direction);
        }} />
      )}

      {phase === "questions" && (
        <QuestionSwiperMotion
          questions={basicQuestions}
          onComplete={(answers) => {
            resetIdleTimer();
            handleBasicQuestionsComplete(answers);
          }}
          onBack={handleBackToStart}
          onSwipe={resetIdleTimer} // 每次滑動重置計時器
        />
      )}

      {phase === "funQuestions" && (
        <QuestionSwiperMotion
          questions={getRandomFunQuestions(funQuestions, 3)}
          onComplete={(answers) => {
            resetIdleTimer();
            handleFunQuestionsComplete(answers);
          }}
          onBack={() => setPhase("questions")}
          onSwipe={resetIdleTimer} // 每次滑動重置計時器
        />
      )}

      {phase === "restaurants" && (
        <RestaurantSwiperMotion
          restaurants={filteredRestaurants.length > 0 ? filteredRestaurants : restaurants}
          onSave={(...args) => {
            resetIdleTimer();
            handleSave(...args);
          }}
          onFinish={(...args) => {
            resetIdleTimer();
            handleRestaurantFinish(...args);
          }}
          onSwipe={resetIdleTimer} // 每次滑動重置計時器
        />
      )}

      {phase === "result" && (
        <RecommendationResult
          saved={JSON.parse(localStorage.getItem("savedRestaurants") || "[]")}
          alternatives={filteredRestaurants}
          onRetry={handleBackToStart}
        />
      )}

      {phase === "buddiesRoom" && (
        <BuddiesRoom
          roomId={roomId}
          onRoomCreated={(roomData) => {
            setRoomData(roomData);
            setRoomId(roomData.roomId);
          }}
          onJoinRoom={(roomData) => {
            setRoomData(roomData);
            setRoomId(roomData.roomId);
          }}
          onStartQuestions={() => setPhase("buddiesQuestions")}
          onBack={handleBackToStart}
        />
      )}

      {phase === "buddiesQuestions" && (
        <BuddiesQuestionSwiper
          roomId={roomId}
          onFinish={() => setPhase("buddiesRecommendation")}
          onBack={() => setPhase("buddiesRoom")}
        />
      )}

      {phase === "buddiesRecommendation" && (
        <BuddiesRecommendation
          roomId={roomId}
          onFinish={() => setPhase("buddiesResult")}
          onBack={() => setPhase("buddiesRoom")}
        />
      )}

      {phase === "buddiesResult" && (
        <BuddiesResultPage
          roomId={roomId}
          onBack={handleBackToStart}
        />
      )}

      {/* 趣味問題標籤載入動畫 */}
      <LoadingOverlay 
        show={loadingTags}
        message="準備趣味問題中"
        subMessage="正在載入問題標籤映射表..."
      />

      {/* 餐廳篩選載入動畫 */}
      <LoadingOverlay 
        show={loadingRestaurantFilter}
        message="分析您的喜好中"
        subMessage="正在根據您的選擇篩選最適合的餐廳..."
      />
    </div>
  );
}
