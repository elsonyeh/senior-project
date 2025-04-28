import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import RestaurantSwiperMotion from "./RestaurantSwiperMotion";
import RecommendationResult from "./RecommendationResult";
import { 
  voteForRestaurant, 
  listenVotes, 
  finalizeRestaurant, 
  listenFinalRestaurant 
} from "../services/firebaseService";
import "./RecommendationResult.css";
import "./SwiftTasteCard.css";

export default function BuddiesRecommendation({ roomId, restaurants = [], onBack }) {
  const [phase, setPhase] = useState("recommend");
  const [saved, setSaved] = useState([]);
  const [votes, setVotes] = useState({});
  const [userVoted, setUserVoted] = useState(false);
  const [finalResult, setFinalResult] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [limitedRestaurants, setLimitedRestaurants] = useState([]);
  const navigate = useNavigate();

  // 限制推薦餐廳數量為10家
  useEffect(() => {
    // 隨機選取餐廳（數量限制）
    const getRandomTen = (arr) => {
      if (!arr || arr.length <= 10) return arr || [];
      return [...arr].sort(() => 0.5 - Math.random()).slice(0, 10);
    };
    
    // 設置限制後的餐廳列表
    setLimitedRestaurants(getRandomTen(restaurants));
  }, [restaurants]);

  // 監聽投票和最終結果
  useEffect(() => {
    if (!roomId) return;

    // 查詢用戶是否已投票
    const userId = localStorage.getItem("userId");
    if (userId) {
      const voted = localStorage.getItem(`voted_${roomId}_${userId}`);
      if (voted) {
        setUserVoted(true);
      }
    }

    // 監聽投票更新
    const unsubscribeVotes = listenVotes(roomId, (votesData) => {
      if (votesData) {
        setVotes(votesData);
      }
    });

    // 監聽最終結果
    const unsubscribeFinal = listenFinalRestaurant(roomId, (finalData) => {
      if (finalData && finalData.id) {
        // 找到最終選擇的餐廳
        const finalRestaurant = restaurants.find(r => r.id === finalData.id);
        if (finalRestaurant) {
          setFinalResult(finalRestaurant);
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000);
          setPhase("result");
        }
      }
    });

    return () => {
      unsubscribeVotes();
      unsubscribeFinal();
    };
  }, [roomId, restaurants]);

  // 保存用戶收藏的餐廳
  const handleSaveRestaurant = async (restaurant) => {
    if (!restaurant || !restaurant.id) return;

    // 檢查是否已存在
    if (!saved.find(r => r.id === restaurant.id)) {
      // 添加到收藏列表
      setSaved(prev => [...prev, restaurant]);

      // 同時為該餐廳投票
      await handleVote(restaurant.id);
    }
  };

  // 處理用戶投票
  const handleVote = async (restaurantId) => {
    if (!roomId || userVoted) return;

    try {
      const result = await voteForRestaurant(roomId, restaurantId);
      if (result.success) {
        // 標記為已投票
        setUserVoted(true);
        const userId = localStorage.getItem("userId");
        if (userId) {
          localStorage.setItem(`voted_${roomId}_${userId}`, "true");
        }
      }
    } catch (error) {
      console.error("投票失敗", error);
    }
  };

  // 確認最終選擇的餐廳
  const handleFinalize = async () => {
    if (!roomId || saved.length === 0) return;
    
    try {
      // 如果有多個收藏，選擇第一個
      const selectedRestaurant = saved[0];
      
      const result = await finalizeRestaurant(roomId, selectedRestaurant);
      if (result.success) {
        setFinalResult(selectedRestaurant);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
        setPhase("result");
      }
    } catch (error) {
      console.error("選擇餐廳失敗", error);
    }
  };

  // 返回房間
  const handleBackToRoom = () => {
    navigate(`/buddies?roomId=${roomId}`);
  };

  // 重新開始
  const handleRestart = () => {
    if (onBack) {
      onBack();
    } else {
      navigate("/");
    }
  };

  // 滑動完所有推薦的餐廳後
  const handleFinishSwiping = () => {
    setPhase("result");
    // 自動選擇第一個儲存的餐廳作為最終選擇
    if (saved.length > 0 && !finalResult) {
      handleFinalize();
    }
  };

  // 渲染五彩紙屑
  const renderConfetti = () => {
    return showConfetti && (
      <div className="confetti-container">
        {Array.from({ length: 80 }).map((_, i) => (
          <div 
            key={i} 
            className="confetti" 
            style={{
              left: `${Math.random() * 100}%`,
              backgroundColor: `hsl(${Math.random() * 360}, 80%, 60%)`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${1 + Math.random() * 3}s`
            }}
          />
        ))}
      </div>
    );
  };

  // 如果處於結果階段
  if (phase === "result") {
    return (
      <div className="recommend-screen">
        {renderConfetti()}
        
        <RecommendationResult 
          saved={finalResult ? [finalResult] : saved} 
          onRetry={handleRestart}
          // 添加額外的返回房間按鈕
          extraButton={
            <motion.button 
              className="btn-restart"
              style={{ background: '#6874E8', marginTop: '1rem' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleBackToRoom}
            >
              👥 回到房間
            </motion.button>
          }
          roomMode={true}
        />
      </div>
    );
  }

  // 沒有推薦餐廳的情況
  if (!limitedRestaurants || limitedRestaurants.length === 0) {
    return (
      <div className="recommend-screen">
        <div className="empty-result">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2>😅 沒有符合條件的餐廳</h2>
            <p>大家太挑了嗎？不如放寬一點條件再試試</p>
            <motion.button 
              className="btn-restart"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRestart}
            >
              🔄 回到首頁
            </motion.button>
            <motion.button 
              className="btn-restart"
              style={{ background: '#6874E8', marginLeft: '1rem' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleBackToRoom}
            >
              👥 回到房間
            </motion.button>
          </motion.div>
        </div>
      </div>
    );
  }

  // 推薦階段 - 使用滑動操作
  return (
    <div>
      <h2>
        一起選餐廳 🍜 ({userVoted ? "已投票" : "滑動選擇"})
      </h2>
      {/* 投票和最愛計數顯示 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-around', 
        margin: '0.5rem 0 1rem',
        padding: '0.5rem', 
        background: 'rgba(255,255,255,0.7)', 
        borderRadius: '12px' 
      }}>
        <div>
          <span role="img" aria-label="vote">🗳️</span> 總票數: {
            Object.values(votes).reduce((sum, count) => sum + count, 0)
          }
        </div>
        <div>
          <span role="img" aria-label="favorite">⭐</span> 已收藏: {saved.length}
        </div>
      </div>
      
      {/* 使用與單人模式相同的滑動組件 */}
      <RestaurantSwiperMotion
        restaurants={limitedRestaurants}
        onSave={handleSaveRestaurant}
        onFinish={handleFinishSwiping}
      />
      
      {saved.length > 0 && (
        <>
          <h3>已收藏餐廳 ⭐</h3>
          <ul>
            {saved.map((r) => (
              <li key={r.id} style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem',
                margin: '0.5rem 0',
                background: 'white',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <div>
                  <span>{r.name}</span>
                  <span style={{ marginLeft: '0.5rem', color: '#666', fontSize: '0.8rem' }}>
                    {votes[r.id] ? `🗳️ ${votes[r.id]} 票` : ''}
                  </span>
                </div>
                {!userVoted && (
                  <button 
                    style={{ 
                      background: '#2ECC71', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '4px',
                      padding: '0.25rem 0.5rem'
                    }}
                    onClick={() => handleVote(r.id)}
                  >
                    投票
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
        <button 
          className="btn-restart" 
          style={{ marginRight: '0.5rem' }}
          onClick={handleRestart}
        >
          🔄 回到首頁
        </button>
        <button 
          className="btn-restart"
          style={{ background: '#6874E8' }}
          onClick={handleBackToRoom}
        >
          👥 回到房間
        </button>
      </div>
      
      {saved.length > 0 && (
        <button 
          className="btn-restart"
          style={{ 
            background: '#FF6B6B', 
            width: '100%',
            marginTop: '0.5rem'
          }}
          onClick={handleFinalize}
        >
          ✨ 確認選擇 ({saved.length > 0 ? saved[0].name : ''})
        </button>
      )}
    </div>
  );
}