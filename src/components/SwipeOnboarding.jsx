import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QuestionSwiperMotion from './QuestionSwiperMotion';
import RestaurantSwiperMotion from './RestaurantSwiperMotion';
import './SwipeOnboarding.css';
import './SwiftTasteCard.css';

// 教學用問題滑動組件
const TutorialQuestionSwiper = ({ questions, onSwipe, swipeDirection = "both" }) => {
  const handleSwipe = (dir, question) => {
    onSwipe(dir, question);
  };

  return (
    <div className="tutorial-swiper-container">
      <QuestionSwiperMotion 
        questions={questions}
        onComplete={(answers) => {
          // 在教學模式中不處理完成事件，只處理單個滑動
          console.log('Tutorial questions completed, but not recording');
        }}
        tutorialMode={true}
        onSingleSwipe={handleSwipe}
        swipeDirection={swipeDirection}
      />
    </div>
  );
};

// 教學用餐廳滑動組件
const TutorialRestaurantSwiper = ({ restaurants, onSwipe, swipeDirection = "both" }) => {
  const handleSwipe = (dir, restaurant) => {
    onSwipe(dir, restaurant);
  };

  return (
    <div className="tutorial-swiper-container">
      <RestaurantSwiperMotion 
        restaurants={restaurants}
        onSave={() => {
          // 在教學模式中不保存
          console.log('Tutorial save, but not recording');
        }}
        onFinish={() => {
          // 在教學模式中不處理完成
          console.log('Tutorial finish, but not recording');
        }}
        tutorialMode={true}
        onSingleSwipe={handleSwipe}
        swipeDirection={swipeDirection}
      />
    </div>
  );
};

const SwipeOnboarding = ({ onComplete, onInteractiveStep, questions, restaurants }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [userHasSwiped, setUserHasSwiped] = useState(false);
  const [isInteractiveMode, setIsInteractiveMode] = useState(false);

  const steps = [
    {
      title: "歡迎來到 SwiftTaste！",
      subtitle: "透過簡單的左右滑動，快速找到完美餐廳",
      icon: "🍽️",
      animation: "welcome",
      showCard: false,
      interactive: false
    },
    {
      title: "試試看右滑選擇！",
      subtitle: "這是真實的問題卡片，試著向右滑動選擇「內用」",
      icon: "👉",
      animation: "swipeRight",
      showCard: true,
      interactive: true,
      cardData: {
        text: "你想要",
        leftOption: "外帶",
        rightOption: "內用",
        type: "question",
        id: "tutorial-1"
      }
    },
    {
      title: "很好！再試試左滑",
      subtitle: "現在向左滑動選擇「輕食」",
      icon: "👈",
      animation: "swipeLeft",
      showCard: true,
      interactive: true,
      cardData: {
        text: "你比較想要",
        leftOption: "輕食",
        rightOption: "正餐",
        type: "question",
        id: "tutorial-2"
      }
    },
    {
      title: "完美！現在試試餐廳卡片",
      subtitle: "右滑收藏這家餐廳",
      icon: "❤️",
      animation: "interactive",
      showCard: true,
      interactive: true,
      cardData: {
        name: "美味小館",
        category: "中式料理",
        address: "台北市信義區",
        rating: 4.5,
        tags: ["家庭聚餐", "平價"],
        type: "restaurant",
        id: "tutorial-restaurant-1",
        swipeDirection: "right"
      }
    },
    {
      title: "很好！再試試左滑跳過",
      subtitle: "左滑跳過這家餐廳",
      icon: "✗",
      animation: "interactive",
      showCard: true,
      interactive: true,
      cardData: {
        name: "普通餐廳",
        category: "快餐",
        address: "台北市中山區",
        rating: 3.2,
        tags: ["快速", "便宜"],
        type: "restaurant",
        id: "tutorial-restaurant-2",
        swipeDirection: "left"
      }
    },
    {
      title: "太棒了！你已經學會了",
      subtitle: "現在開始你的真正美食之旅吧！",
      icon: "🎉",
      animation: "celebration",
      showCard: false,
      interactive: false
    }
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      setUserHasSwiped(false); // 重置滑動狀態
      setIsInteractiveMode(false);
    } else {
      // 完成教學
      setIsVisible(false);
      setTimeout(() => {
        onComplete();
      }, 500);
    }
  };

  // 處理用戶在互動模式下的滑動
  const handleInteractiveSwipe = (direction, cardData) => {
    console.log(`Tutorial swipe: ${direction} on card:`, cardData);
    setUserHasSwiped(true);
    
    // 給用戶一些反饋時間
    setTimeout(() => {
      nextStep();
    }, 800);
  };

  // 檢查當前步驟是否為互動式
  const currentStepData = steps[currentStep];
  const isCurrentStepInteractive = currentStepData.interactive;

  const skipTutorial = () => {
    setIsVisible(false);
    setTimeout(() => {
      onComplete();
    }, 500);
  };

  // 渲染真實的互動卡片組件
  const renderInteractiveCard = (cardData, isInteractive) => {
    if (!isInteractive) {
      // 非互動模式，渲染靜態演示卡片
      return renderDemoCard(cardData);
    }

    // 互動模式，使用真實的滑動組件
    if (cardData.type === "question") {
      // 根據步驟設置滑動方向限制
      const swipeDirection = currentStep === 1 ? "right" : currentStep === 2 ? "left" : "both";
      return (
        <TutorialQuestionSwiper 
          questions={[cardData]}
          onSwipe={handleInteractiveSwipe}
          swipeDirection={swipeDirection}
        />
      );
    } else if (cardData.type === "restaurant") {
      // 餐廳卡片根據cardData中的swipeDirection設置
      return (
        <TutorialRestaurantSwiper 
          restaurants={[cardData]}
          onSwipe={handleInteractiveSwipe}
          swipeDirection={cardData.swipeDirection || "both"}
        />
      );
    }
    return null;
  };

  // 渲染靜態演示卡片（保持原有功能）
  const renderDemoCard = (cardData) => {
    if (cardData.type === "question") {
      return (
        <div className="motion-card demo-card">
          <div className="question-wrapper">
            <h2 className="question-text">{cardData.text}</h2>
            <div className="options-display">
              <div className="left">{cardData.leftOption}</div>
              <div className="right">{cardData.rightOption}</div>
            </div>
          </div>
        </div>
      );
    } else if (cardData.type === "restaurant") {
      return (
        <div className="motion-card demo-card">
          <div className="restaurant-info">
            <h2 className="restaurant-name">{cardData.name}</h2>
            <div className="restaurant-category">{cardData.category}</div>
            <div className="restaurant-rating">
              ⭐ {cardData.rating}
            </div>
            <div className="restaurant-address">{cardData.address}</div>
            <div className="restaurant-tags">
              {cardData.tags.map((tag, index) => (
                <span key={index} className="tag">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (!isVisible) return null;

  return (
    <motion.div 
      className="swipe-onboarding"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="onboarding-content">
        <button 
          className="skip-button"
          onClick={skipTutorial}
        >
          跳過
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            className="step-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className={`step-animation ${steps[currentStep].animation}`}>
              {!steps[currentStep].showCard ? (
                <motion.div
                  className="step-icon"
                  animate={{
                    scale: [1, 1.1, 1],
                    rotate: steps[currentStep].animation === 'welcome' ? [0, 5, -5, 0] : 0
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatType: "loop"
                  }}
                >
                  {steps[currentStep].icon}
                </motion.div>
              ) : (
                <div className="card-demo-container">
                  {/* 真實卡片演示 */}
                  <motion.div
                    className="demo-card-wrapper"
                    animate={{
                      x: steps[currentStep].animation === 'swipeRight' ? [0, 150, 0] 
                         : steps[currentStep].animation === 'swipeLeft' ? [0, -150, 0]
                         : steps[currentStep].animation === 'interactive' ? (
                           currentStep === 3 ? [0, 150, 0] : // 右滑收藏餐廳
                           currentStep === 4 ? [0, -150, 0] : [0, 150, 0] // 左滑跳過餐廳
                         ) : 0,
                      rotate: steps[currentStep].animation === 'swipeRight' ? [0, 20, 0] 
                             : steps[currentStep].animation === 'swipeLeft' ? [0, -20, 0]
                             : steps[currentStep].animation === 'interactive' ? (
                               currentStep === 3 ? [0, 20, 0] : // 右滑收藏餐廳
                               currentStep === 4 ? [0, -20, 0] : [0, 20, 0] // 左滑跳過餐廳
                             ) : 0,
                      scale: steps[currentStep].animation === 'interactive' ? [1, 1.02, 1] : 1
                    }}
                    transition={{
                      duration: steps[currentStep].animation === 'interactive' ? 2.5 : 2.5,
                      repeat: Infinity,
                      repeatType: "loop",
                      delay: 0.5,
                      ease: "easeInOut"
                    }}
                  >
                    {renderInteractiveCard(steps[currentStep].cardData, isCurrentStepInteractive)}
                  </motion.div>

                  {/* 滑動方向指示 */}
                  {(steps[currentStep].animation === 'swipeRight' || 
                    steps[currentStep].animation === 'swipeLeft' ||
                    steps[currentStep].animation === 'interactive') && (
                    <div className="swipe-indicators">
                      {steps[currentStep].animation === 'swipeRight' && (
                        <motion.div 
                          className="swipe-indicator right-indicator"
                          animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.1, 1] }}
                          transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                        >
                          👉 選擇右邊
                        </motion.div>
                      )}
                      {steps[currentStep].animation === 'swipeLeft' && (
                        <motion.div 
                          className="swipe-indicator left-indicator"
                          animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.1, 1] }}
                          transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                        >
                          👈 選擇左邊
                        </motion.div>
                      )}
                      {steps[currentStep].animation === 'interactive' && (
                        <>
                          {currentStep === 3 && (
                            <motion.div 
                              className="swipe-indicator right-indicator"
                              animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.1, 1] }}
                              transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                            >
                              ❤️ 收藏餐廳
                            </motion.div>
                          )}
                          {currentStep === 4 && (
                            <motion.div 
                              className="swipe-indicator left-indicator"
                              animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.1, 1] }}
                              transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                            >
                              ✗ 跳過餐廳
                            </motion.div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <h2 className="step-title">{steps[currentStep].title}</h2>
            <p className="step-subtitle">{steps[currentStep].subtitle}</p>
          </motion.div>
        </AnimatePresence>

        <div className="step-indicators">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`step-indicator ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
            />
          ))}
        </div>

        <div className="onboarding-actions">
          {currentStep < steps.length - 1 ? (
            <motion.button
              className="next-button"
              onClick={nextStep}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              下一步
            </motion.button>
          ) : (
            <motion.button
              className="start-button"
              onClick={nextStep}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              開始使用 🎉
            </motion.button>
          )}
        </div>
      </div>

      {/* 手指滑動指示器 - 只在需要滑動演示時顯示 */}
      {(currentStep === 1 || currentStep === 2 || currentStep === 3 || currentStep === 4) && (
        <div className="swipe-hint">
          <motion.div
            className="finger-icon"
            animate={{
              x: currentStep === 1 ? [0, 60, 0] : 
                 currentStep === 2 ? [0, -60, 0] :
                 currentStep === 3 ? [0, 60, 0] :
                 currentStep === 4 ? [0, -60, 0] : 0,
              opacity: [0.5, 1, 0.5]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              repeatType: "loop"
            }}
          >
            👆
          </motion.div>
          <motion.p 
            className="swipe-text"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {currentStep === 1 ? "試著滑動看看！" : 
             currentStep === 2 ? "或是這樣滑動" :
             currentStep === 3 ? "滑動收藏餐廳" :
             currentStep === 4 ? "滑動跳過餐廳" : ""}
          </motion.p>
        </div>
      )}
    </motion.div>
  );
};

export default SwipeOnboarding;