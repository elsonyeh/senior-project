// 修復 SwiftTaste.jsx 中的 navigate 語法錯誤
// 將 navigate(/buddies?roomId=) 改為 navigate(/buddies?roomId=)

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { roomService, memberService, recommendationService } from "../services/supabaseService";
import { restaurantService } from "../services/restaurantService";
import { funQuestionTagService } from "../services/funQuestionTagService";
import { getBasicQuestionsForSwiftTaste, getFunQuestions } from "../services/questionService";
import { dataValidator } from "../utils/dataValidator";
import selectionHistoryService from "../services/selectionHistoryService";
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
import SponsoredAdModal from "./SponsoredAdModal";
import { getRandomAd } from "../data/sponsoredAds";
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
  const [sponsoredAd, setSponsoredAd] = useState(null);
  const [showSponsoredAd, setShowSponsoredAd] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [showIdleHint, setShowIdleHint] = useState(false);
  const [idleTimer, setIdleTimer] = useState(null);
  const [selectedFunQuestions, setSelectedFunQuestions] = useState([]);
  const [loadingModeSelection, setLoadingModeSelection] = useState(false);
  const [showNoResultsModal, setShowNoResultsModal] = useState(false);

  // 選擇紀錄相關狀態
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessionStartTime, setSessionStartTime] = useState(null);

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
    // 在這些階段啟動停留時間計時器，只排除 buddiesRoom 階段
    const phasesWithIdleTimer = ['selectMode', 'questions', 'funQuestions', 'restaurants', 'result', 'buddiesQuestions', 'buddiesRecommendation', 'buddiesResult'];
    const excludedPhases = ['buddiesRoom']; // 只排除房間階段

    if (phasesWithIdleTimer.includes(phase) && !showOnboarding && !excludedPhases.includes(phase)) {
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

    // 檢查是否需要顯示引導動畫
    const hasSeenOnboardingBefore = localStorage.getItem("hasSeenSwipeOnboarding");
    if (!hasSeenOnboardingBefore) {
      // 延遲顯示，確保頁面已載入
      setTimeout(() => {
        setShowOnboarding(true);
      }, 500);
    }
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
      const rawData = await restaurantService.getRestaurants({
        minRating: 0     // 不限制評分
      });

      // 使用資料驗證器清理和驗證餐廳資料
      const validatedData = dataValidator.validateRestaurantList(rawData);
      console.log(`Successfully loaded and validated ${validatedData.length} restaurants`);

      setRestaurants(validatedData);
    } catch (error) {
      console.error("載入餐廳失敗:", error);
      setError("載入餐廳失敗，請稍後重試");
      // 如果載入失敗，使用空陣列作為備用
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  };

  const handleModeSelect = async (direction) => {
    // 將滑動方向轉換為模式
    const mode = direction === "left" ? "buddies" : "single";
    setSelectedMode(mode);

    // 立即顯示載入動畫
    setLoadingModeSelection(true);

    try {
      // 開始選擇紀錄會話
      await startSelectionSession(mode === "single" ? "swifttaste" : "buddies");

      if (mode === "buddies") {
        setLoadingModeSelection(false);
        setPhase("buddiesRoom");
      } else {
        // 清理之前的保存餐廳記錄
        localStorage.removeItem("savedRestaurants");
        console.log("Cleared previous saved restaurants");

        // 檢查是否已經看過引導動畫
        // 短暫延遲確保動畫可見
        setTimeout(() => {
          setLoadingModeSelection(false);
          setPhase("questions");
        }, 500);
      }
    } catch (error) {
      console.error('Error in mode selection:', error);
      setLoadingModeSelection(false);
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

    // 最終推薦頁面使用10秒計時，其他頁面使用15秒
    const timeout = phase === 'result' ? 10000 : 15000;

    const timer = setTimeout(() => {
      setShowIdleHint(true);
    }, timeout);
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

  // 選擇紀錄相關函數
  const startSelectionSession = async (mode) => {
    try {
      console.log(`Starting ${mode} selection session...`);
      setSessionStartTime(new Date());

      const result = await selectionHistoryService.startSession(mode, {
        user_location: await getCurrentLocation()
      });

      if (result.success) {
        setCurrentSessionId(result.sessionId);
        console.log('Selection session started:', result.sessionId);
      } else {
        console.error('Failed to start session:', result.error);
      }
    } catch (error) {
      console.error('Error starting selection session:', error);
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

  const recordSwipeAction = async () => {
    if (currentSessionId) {
      await selectionHistoryService.incrementSwipeCount(currentSessionId);
    }
  };

  const recordLikedRestaurant = async (restaurant) => {
    if (currentSessionId) {
      await selectionHistoryService.addLikedRestaurant(currentSessionId, restaurant);
    }
  };

  const completeSession = async (finalRestaurant = null) => {
    if (currentSessionId) {
      const completionData = {
        started_at: sessionStartTime?.toISOString(),
        final_restaurant: finalRestaurant
      };

      await selectionHistoryService.completeSession(currentSessionId, completionData);
      console.log('Selection session completed');
    }
  };

  const handleBasicQuestionsComplete = async (answers) => {
    console.log('Basic questions completed with answers:', answers);
    const basicAnswersList = answers.answers || [];
    setBasicAnswers(basicAnswersList);
    basicAnswersRef.current = basicAnswersList;  // 同時存儲到ref中
    console.log('Stored basic answers in ref:', basicAnswersRef.current);

    // 記錄基本答案
    if (currentSessionId) {
      await selectionHistoryService.saveBasicAnswers(currentSessionId, basicAnswersList);
    }

    // 立即顯示載入動畫 (準備趣味問題)
    setLoadingTags(true);

    // 選擇固定的3題趣味問題
    const randomFunQuestions = getRandomFunQuestions(funQuestions, 3);
    setSelectedFunQuestions(randomFunQuestions);
    console.log('Selected fixed fun questions:', randomFunQuestions.map(q => q.text));

    // 短暫延遲確保動畫顯示，然後切換到趣味問題
    setTimeout(() => {
      setLoadingTags(false);
      if (randomFunQuestions.length > 0) {
        setPhase("funQuestions"); // 轉到趣味問題
      } else {
        console.warn('No fun questions available, skipping to restaurants');
        // 如果沒有趣味問題，直接跳到餐廳選擇
        setLoadingRestaurantFilter(true);
        filterRestaurantsByAnswers(basicAnswersList, []);
        setPhase("restaurants");
      }
    }, 500);
  };

  const handleFunQuestionsComplete = async (answers) => {
    console.log('Fun questions completed with answers:', answers);
    const funAnswersList = answers.answers || [];
    setFunAnswers(funAnswersList);

    // 記錄趣味問題答案
    if (currentSessionId) {
      await selectionHistoryService.saveFunAnswers(currentSessionId, funAnswersList);
    }

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

    // 立即顯示載入動畫
    setLoadingRestaurantFilter(true);

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
    
    // 前置過濾：根據正確的資料庫欄位進行篩選
    let filteredRestaurants = restaurants;
    console.log(`Starting with ${restaurants.length} restaurants`);

    // 1. 人數篩選：suggested_people欄位 (一個人 vs 朋友)
    if (basicAnswers.includes("單人")) {
      console.log("Filtering for 單人 restaurants...");
      filteredRestaurants = filteredRestaurants.filter(r => {
        // suggested_people 包含 1 就符合一個人
        const suggestedPeople = r.suggested_people || '';
        const hasOne = suggestedPeople.includes('1');
        if (hasOne) {
          console.log(`✓ Restaurant ${r.name} suitable for 單人 (suggested_people: ${suggestedPeople})`);
        }
        return hasOne;
      });
      console.log(`After 單人 filter: ${filteredRestaurants.length} restaurants`);
    } else if (basicAnswers.includes("多人")) {
      console.log("Filtering for 多人 restaurants...");
      filteredRestaurants = filteredRestaurants.filter(r => {
        // suggested_people 包含 ~ 就是多人
        const suggestedPeople = r.suggested_people || '';
        const hasMultiple = suggestedPeople.includes('~');
        if (hasMultiple) {
          console.log(`✓ Restaurant ${r.name} suitable for 多人 (suggested_people: ${suggestedPeople})`);
        }
        return hasMultiple;
      });
      console.log(`After 多人 filter: ${filteredRestaurants.length} restaurants`);
    }

    // 2. 價格篩選：price_range欄位 (奢華 vs 平價)
    if (basicAnswers.includes("奢華美食")) {
      console.log("Filtering for 奢華美食 restaurants...");
      filteredRestaurants = filteredRestaurants.filter(r => {
        const priceRange = r.price_range;
        let isLuxury = false;

        if (priceRange === 3) {
          isLuxury = true; // 3 為奢侈
        } else if (priceRange === 2) {
          // 2 則是以 70% 的機率在奢侈
          isLuxury = Math.random() < 0.7;
        }

        if (isLuxury) {
          console.log(`✓ Restaurant ${r.name} matches 奢華美食 (price_range: ${priceRange})`);
        }
        return isLuxury;
      });
      console.log(`After 奢華美食 filter: ${filteredRestaurants.length} restaurants`);
    } else if (basicAnswers.includes("平價美食")) {
      console.log("Filtering for 平價美食 restaurants...");
      filteredRestaurants = filteredRestaurants.filter(r => {
        const priceRange = r.price_range;
        let isAffordable = false;

        if (priceRange === 1) {
          isAffordable = true; // 1 為平價
        } else if (priceRange === 2) {
          // 2 則是以 30% 的機率在平價
          isAffordable = Math.random() < 0.3;
        }

        if (isAffordable) {
          console.log(`✓ Restaurant ${r.name} matches 平價美食 (price_range: ${priceRange})`);
        }
        return isAffordable;
      });
      console.log(`After 平價美食 filter: ${filteredRestaurants.length} restaurants`);
    }

    // 3. 飲食類型篩選：tags欄位 (正餐 vs 飲料)
    if (basicAnswers.includes("喝")) {
      console.log("Filtering for 喝 restaurants...");
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
    } else if (basicAnswers.includes("吃一點")) {
      console.log("Filtering for 吃一點 restaurants...");
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
    } else if (basicAnswers.includes("吃飽")) {
      console.log("Filtering for 吃飽 restaurants...");
      filteredRestaurants = filteredRestaurants.filter(r => {
        const tags = r.tags ? (Array.isArray(r.tags) ? r.tags : [r.tags]) : [];
        const hasTag = tags.some(tag =>
          typeof tag === 'string' && tag.toLowerCase().trim() === "吃飽"
        );
        if (hasTag) {
          console.log(`✓ Restaurant ${r.name} has 吃飽 tag:`, tags);
        }
        return hasTag;
      });
      console.log(`After 吃飽 filter: ${filteredRestaurants.length} restaurants`);
    }

    // 4. 辣度篩選：is_spicy欄位 (辣 vs 不辣 vs both)
    if (basicAnswers.includes("辣")) {
      console.log("Filtering for 辣 restaurants...");
      filteredRestaurants = filteredRestaurants.filter(r => {
        // 支援 true、'true' 或 'both'
        const isSpicy = r.is_spicy === true || r.is_spicy === 'true' || r.is_spicy === 'both';
        if (isSpicy) {
          console.log(`✓ Restaurant ${r.name} serves spicy food (is_spicy: ${r.is_spicy})`);
        }
        return isSpicy;
      });
      console.log(`After 辣 filter: ${filteredRestaurants.length} restaurants`);
    } else if (basicAnswers.includes("不辣")) {
      console.log("Filtering for 不辣 restaurants...");
      filteredRestaurants = filteredRestaurants.filter(r => {
        // 支援 false、'false' 或 'both'
        const isNotSpicy = r.is_spicy === false || r.is_spicy === 'false' || r.is_spicy === 'both';
        if (isNotSpicy) {
          console.log(`✓ Restaurant ${r.name} serves non-spicy food (is_spicy: ${r.is_spicy})`);
        }
        return isNotSpicy;
      });
      console.log(`After 不辣 filter: ${filteredRestaurants.length} restaurants`);
    }

    // 檢查是否有餐廳符合條件
    if (filteredRestaurants.length === 0) {
      console.warn("沒有找到符合所有基本條件的餐廳");
      setFilteredRestaurants([]);
      return;
    }
    
    // 計算每個餐廳的匹配分數
    const scoredRestaurants = await Promise.all(filteredRestaurants.map(async restaurant => {
      let score = WEIGHT.MIN_SCORE;
      const { price_range, tags, rating, is_spicy } = restaurant;
      
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
            // 使用正確的price_range欄位：3為奢侈，2則是70%機率匹配奢侈
            matched = price_range === 3 || (price_range === 2 && Math.random() < 0.7);
            if (matched) console.log(`✓ ${restaurant.name} matches 奢華美食 (price_range: ${price_range})`);
            break;

          case "平價美食":
            // 使用正確的price_range欄位：1為平價，2則是30%機率匹配平價
            matched = price_range === 1 || (price_range === 2 && Math.random() < 0.3);
            if (matched) console.log(`✓ ${restaurant.name} matches 平價美食 (price_range: ${price_range})`);
            break;
            
          case "吃":
            // 檢查是否有"吃一點"或"吃飽"標籤
            matched = normalizedTags.includes("吃一點") || normalizedTags.includes("吃飽");
            if (matched) {
              console.log(`✓ ${restaurant.name} matches 吃 (has 吃一點 or 吃飽 tag)`);
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
            // 必須有"吃飽"標籤
            matched = normalizedTags.includes("吃飽");
            if (matched) console.log(`✓ ${restaurant.name} matches 吃飽 (has 吃飽 tag)`);
            break;
            
          case "辣":
            matched = is_spicy === true || is_spicy === 'true' || is_spicy === 'both';
            if (matched) console.log(`✓ ${restaurant.name} matches 辣 (is_spicy: ${is_spicy})`);
            break;

          case "不辣":
            matched = is_spicy === false || is_spicy === 'false' || is_spicy === 'both';
            if (matched) console.log(`✓ ${restaurant.name} matches 不辣 (is_spicy: ${is_spicy})`);
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
      
      // 嚴格基本匹配：必須符合所有基本條件，否則直接排除
      if (basicAnswers.length > 0 && basicMatchCount < basicAnswers.length) {
        // 不符合所有基本條件的餐廳直接返回最低分，確保被過濾掉
        return { ...restaurant, calculatedScore: 0 };
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
    
    // 過濾掉不符合基本條件的餐廳（分數為0）和分數過低的餐廳
    const qualifiedRestaurants = scoredRestaurants.filter(r =>
      r.calculatedScore > 0 && r.calculatedScore >= WEIGHT.MIN_SCORE
    );
    
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

      // 記錄推薦結果
      if (currentSessionId) {
        await selectionHistoryService.saveRecommendations(currentSessionId, selected);
      }

    } catch (error) {
      console.error('Error filtering restaurants:', error);
      setError('篩選餐廳時發生錯誤');
    } finally {
      setLoadingRestaurantFilter(false);
    }
  };

  const getRandomFunQuestions = (questions, count = 3) => {
    if (!Array.isArray(questions) || questions.length === 0) {
      console.warn('No fun questions available');
      return [];
    }

    // 確保不超過可用問題數量
    const actualCount = Math.min(count, questions.length);

    // 使用 Fisher-Yates 洗牌算法確保真正隨機
    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const selected = shuffled.slice(0, actualCount);
    console.log(`Selected ${selected.length} fun questions from ${questions.length} available`);
    return selected;
  };

  const handleSave = async (restaurant) => {
    console.log('Saving restaurant:', restaurant);

    // 記錄用戶喜歡的餐廳
    await recordLikedRestaurant(restaurant);

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

  const handleDislike = (restaurant) => {
    console.log('Disliking restaurant:', restaurant);

    // 單人模式：保存左滑餐廳到本地
    if (selectedMode === "single") {
      const disliked = JSON.parse(localStorage.getItem("dislikedRestaurants") || "[]");

      // 避免重複保存
      const alreadyDisliked = disliked.some(r => r.id === restaurant.id);
      if (!alreadyDisliked) {
        const newDisliked = [...disliked, restaurant];
        localStorage.setItem("dislikedRestaurants", JSON.stringify(newDisliked));
        console.log(`✓ Disliked ${restaurant.name}. Total disliked: ${newDisliked.length}`);
      }
    }
  };

  const handleNoResults = () => {
    console.log("沒有餐廳被選擇，顯示可惜畫面");
    setShowNoResultsModal(true);
  };

  const handleRetrySelection = () => {
    setShowNoResultsModal(false);
    // 重新載入餐廳推薦
    if (basicAnswers.length > 0) {
      handleRestaurantRecommendation(basicAnswers, funAnswers);
    }
    setPhase("restaurants");
  };

  const handleRestaurantFinish = async () => {
    // 完成選擇會話，記錄最終選擇的餐廳（如果有的話）
    const savedRestaurants = JSON.parse(localStorage.getItem("savedRestaurants") || "[]");
    const finalRestaurant = savedRestaurants.length > 0 ? savedRestaurants[0] : null;

    await completeSession(finalRestaurant);

    if (selectedMode === "single") {
      // 隨機顯示贊助廣告（50% 機率）
      if (Math.random() > 0.5) {
        const ad = getRandomAd();
        setSponsoredAd(ad);
        setShowSponsoredAd(true);
      }
      setPhase("result");
    } else if (selectedMode === "buddies") {
      setPhase("buddiesRecommendation");
    }
  };

  const handleBackToStart = () => {
    setPhase("selectMode");
    setSelectedMode(null);
    setUserAnswers([]);
    setBasicAnswers([]);
    setFunAnswers([]);
    setSelectedFunQuestions([]);
    setLoadingModeSelection(false);
    basicAnswersRef.current = [];

    // 清除左滑餐廳記錄
    localStorage.removeItem("dislikedRestaurants");

    // 如果是多人模式，回到房間而不是回到起點
    if (selectedMode === "buddies" && roomId) {
      navigate(`/buddies?roomId=${roomId}`);
    }
  };

  // 使用LoadingOverlay替代文字載入提示

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

      {/* 停留時間提示 - 只排除 buddiesRoom 階段 */}
      {phase !== 'buddiesRoom' && (
        <IdleHint
          show={showIdleHint}
          phase={phase}
          onDismiss={resetIdleTimer}
        />
      )}

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
          questions={selectedFunQuestions.length > 0 ? selectedFunQuestions : []}
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
          onDislike={(...args) => {
            resetIdleTimer();
            handleDislike(...args);
          }}
          onFinish={(...args) => {
            resetIdleTimer();
            handleRestaurantFinish(...args);
          }}
          onSwipe={(...args) => {
            resetIdleTimer(); // 每次滑動重置計時器
            recordSwipeAction(); // 記錄滑動動作
          }}
        />
      )}

      {phase === "result" && (
        <RecommendationResult
          saved={JSON.parse(localStorage.getItem("savedRestaurants") || "[]")}
          alternatives={filteredRestaurants}
          onRetry={handleBackToStart}
          onInteraction={resetIdleTimer} // 添加互動回調
        />
      )}

      {phase === "buddiesRoom" && (
        <BuddiesRoom
          roomId={roomId}
          onRoomCreated={(roomData) => {
            setRoomData(roomData);
            setRoomId(roomData.roomId);
            // Buddies 會話已在 BuddiesRoom 中開始
          }}
          onJoinRoom={(roomData) => {
            setRoomData(roomData);
            setRoomId(roomData.roomId);
            // Buddies 會話已在 BuddiesRoom 中開始
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

      {/* 模式選擇載入動畫 */}
      <LoadingOverlay
        show={loadingModeSelection}
        message="準備開始"
        subMessage="正在初始化問題"
      />

      {/* 初始載入動畫 - selectMode階段的資料載入 */}
      <LoadingOverlay
        show={(loading || questionsLoading) && phase === "selectMode"}
        message="載入中"
        subMessage="正在準備選擇模式..."
      />

      {/* 無結果模態 */}
      {showNoResultsModal && (
        <div className="modal-overlay" onClick={() => setShowNoResultsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">😔</div>
            <h3>有點可惜呢</h3>
            <p>看起來沒有餐廳符合您的喜好，要不要再試一次？</p>
            <div className="modal-buttons">
              <button
                className="retry-button"
                onClick={handleRetrySelection}
              >
                再試一次
              </button>
              <button
                className="back-button"
                onClick={() => {
                  setShowNoResultsModal(false);
                  handleBackToStart();
                }}
              >
                重新開始
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 贊助廣告彈窗 */}
      {showSponsoredAd && sponsoredAd && (
        <SponsoredAdModal
          ad={sponsoredAd}
          onClose={() => {
            setShowSponsoredAd(false);
            resetIdleTimer();
          }}
        />
      )}
    </div>
  );
}
