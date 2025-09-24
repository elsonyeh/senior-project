import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { memberService } from "../services/supabaseService";
import RestaurantSwiperMotion from "./RestaurantSwiperMotion";
import RecommendationResult from "./RecommendationResult";
import { voteService, finalResultService } from "../services/supabaseService";
import "./RecommendationResult.css";
import "./SwiftTasteCard.css";
import "./BuddiesVoteStyles.css";

export default function BuddiesRecommendation({
  roomId,
  restaurants = [],
  onBack,
}) {
  const [phase, setPhase] = useState("recommend");
  const [saved, setSaved] = useState([]);
  const [votes, setVotes] = useState({});
  const [userVoted, setUserVoted] = useState(false);
  const [finalResult, setFinalResult] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [limitedRestaurants, setLimitedRestaurants] = useState([]);
  const [alternativeRestaurants, setAlternativeRestaurants] = useState([]);
  const [voteAnimation, setVoteAnimation] = useState(null);
  const [totalMembers, setTotalMembers] = useState(0);
  const [showNoResultsModal, setShowNoResultsModal] = useState(false);
  const navigate = useNavigate();

  // 使用房間ID創建一個確定性的種子
  const generateSeedFromRoomId = (roomId) => {
    if (!roomId) return 12345; // 默認種子
    return roomId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  };

  // 使用基於種子的隨機排序函數
  const seededShuffle = (array, seed) => {
    // 創建確定性的隨機數生成器
    const seededRandom = (() => {
      let s = seed;
      return () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
      };
    })();

    // 使用確定性隨機數進行排序
    return [...array].sort(() => seededRandom() - 0.5);
  };

  // 處理滑動結束並計算投票結果的函數
  const handleFinishSwiping = useCallback(() => {
    setPhase("vote-result");

    // 計算投票結果
    if (Object.keys(votes).length > 0) {
      // 找出票數最高的餐廳
      const sortedRestaurants = Object.entries(votes).sort(
        ([, voteA], [, voteB]) => voteB - voteA
      );

      // 檢查是否有多個最高票餐廳（平局情況）
      if (sortedRestaurants.length > 1) {
        const topVotes = sortedRestaurants[0][1];
        const tiedRestaurants = sortedRestaurants.filter(
          ([, voteCount]) => voteCount === topVotes
        );

        if (tiedRestaurants.length > 1) {
          // 如果有平局，使用確定性隨機選擇（基於房間ID作為種子）
          const seed = generateSeedFromRoomId(roomId);
          const shuffledTied = seededShuffle(tiedRestaurants, seed);
          const topVotedId = shuffledTied[0][0];
          const topVotedRestaurant = [
            ...limitedRestaurants,
            ...alternativeRestaurants,
          ].find((r) => r.id === topVotedId);

          if (topVotedRestaurant) {
            setFinalResult(topVotedRestaurant);
          }
        } else {
          // 沒有平局，選擇最高票餐廳
          const topVotedId = sortedRestaurants[0][0];
          const topVotedRestaurant = [
            ...limitedRestaurants,
            ...alternativeRestaurants,
          ].find((r) => r.id === topVotedId);

          if (topVotedRestaurant) {
            setFinalResult(topVotedRestaurant);
          }
        }
      } else if (sortedRestaurants.length === 1) {
        // 只有一個餐廳有投票
        const topVotedId = sortedRestaurants[0][0];
        const topVotedRestaurant = [
          ...limitedRestaurants,
          ...alternativeRestaurants,
        ].find((r) => r.id === topVotedId);

        if (topVotedRestaurant) {
          setFinalResult(topVotedRestaurant);
        }
      }
    } else if (saved.length > 0) {
      // 如果沒有投票，使用首個收藏的餐廳
      setFinalResult(saved[0]);
    }
  }, [votes, limitedRestaurants, alternativeRestaurants, saved, roomId]);

  // 限制推薦餐廳數量為10家 - 修改以使用確定性排序
  useEffect(() => {
    // 打印接收到的餐廳數據的前3家，檢查是否有 matchScore
    console.log(
      "接收到的餐廳數據（前3家）:",
      restaurants.slice(0, 3).map((r) => ({
        name: r.name,
        hasMatchScore: typeof r.matchScore === "number",
        matchScore: r.matchScore,
        id: r.id,
      }))
    );

    // 檢查餐廳是否已排序（檢查是否有 matchScore 屬性）
    const hasMatchScores = restaurants.some(
      (r) => typeof r.matchScore === "number"
    );

    // 生成一個基於房間ID的固定種子
    const roomSeed = generateSeedFromRoomId(roomId);
    console.log("房間種子值:", roomSeed);

    if (hasMatchScores) {
      console.log("餐廳帶有匹配分數，根據分數選取前十間");

      // 1. 根據 matchScore 排序（保留這步，不使用隨機排序）
      const sortedByScore = [...restaurants].sort(
        (a, b) => (b.matchScore || 0) - (a.matchScore || 0)
      );

      // 2. 取分數最高的前10間，不再隨機打亂順序
      const topTen = sortedByScore.slice(0, 10);

      // 設置限制後的餐廳列表 - 不再隨機排序
      setLimitedRestaurants(topTen);

      // 保留其餘餐廳作為備選（仍按照評分排序）
      if (sortedByScore.length > 10) {
        const alternatives = sortedByScore.slice(10, 15);
        setAlternativeRestaurants(alternatives);
      }
    } else {
      // 處理沒有匹配分數的情況，使用確定性排序
      console.warn("警告：餐廳未包含匹配分數，使用確定性選擇");

      // 確保餐廳有一個穩定的排序（例如按名稱）
      const stabilizedList = [...restaurants].sort((a, b) =>
        a.name && b.name ? a.name.localeCompare(b.name) : 0
      );

      // 使用確定性洗牌（基於房間ID）
      const shuffled = seededShuffle(stabilizedList, roomSeed);

      // 選取前10個
      const limitedList = shuffled.slice(0, 10);
      setLimitedRestaurants(limitedList);

      // 保留其餘餐廳作為備選
      if (shuffled.length > 10) {
        const alternatives = shuffled.slice(10, 15);
        setAlternativeRestaurants(alternatives);
      }
    }
  }, [restaurants, roomId]);

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

    // 監聽房間成員人數
    const unsubscribeMembers = memberService.listenRoomMembers(roomId, (membersObj) => {
      const membersList = Object.values(membersObj);
      setTotalMembers(membersList.length);
    });

    // 監聽投票更新
    const unsubscribeVotes = voteService.listenVotes(roomId, (votesData) => {
      if (votesData) {
        setVotes(votesData);

        // 檢查是否所有成員都已完成投票
        if (totalMembers > 0) {
          const uniqueVoters = new Set();
          Object.entries(votesData).forEach(([restaurantId, count]) => {
            // 假設每位用戶只會為一家餐廳投票
            for (let i = 0; i < count; i++) {
              uniqueVoters.add(`voter_${uniqueVoters.size}`);
            }
          });

          // 如果所有成員都已投票，切換到結果階段
          if (uniqueVoters.size >= totalMembers && phase === "recommend") {
            handleFinishSwiping();
          }
        }
      }
    });

    // 監聽最終結果
    const unsubscribeFinal = finalResultService.listenFinalRestaurant(roomId, (finalData) => {
      if (finalData && finalData.id) {
        // 找到最終選擇的餐廳
        const finalRestaurant = restaurants.find((r) => r.id === finalData.id);
        if (finalRestaurant) {
          setFinalResult(finalRestaurant);
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000);
          setPhase("result");
        }
      }
    });

    return () => {
      // 移除監聽
      unsubscribeMembers();
      unsubscribeVotes();
      unsubscribeFinal();
    };
  }, [roomId, restaurants, totalMembers, phase, handleFinishSwiping]);

  // 處理無結果情況
  const handleNoResults = () => {
    console.log("Buddies 模式沒有餐廳被選擇，顯示可惜畫面");
    setShowNoResultsModal(true);
  };

  const handleRetrySelection = () => {
    setShowNoResultsModal(false);
    setSaved([]);
    setVotes({});
    setUserVoted(false);
    // 重新設置餐廳列表
    if (restaurants && restaurants.length > 0) {
      const randomizedRestaurants = shuffleArrayWithSeed(restaurants, generateSeedFromRoomId(roomId));
      setLimitedRestaurants(randomizedRestaurants.slice(0, 10));
      setAlternativeRestaurants(randomizedRestaurants.slice(10));
    }
    setPhase("recommend");
  };

  // 保存用戶收藏的餐廳
  const handleSaveRestaurant = async (restaurant) => {
    if (!restaurant || !restaurant.id) return;

    // 檢查是否已存在
    if (!saved.find((r) => r.id === restaurant.id)) {
      // 添加到收藏列表
      setSaved((prev) => [...prev, restaurant]);

      // 同時為該餐廳投票
      await handleVote(restaurant.id);
    }
  };

  // 處理用戶投票
  const handleVote = async (restaurantId) => {
    if (!roomId || userVoted) return;

    try {
      const result = await voteService.voteForRestaurant(roomId, restaurantId);
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

  // 顯示投票動畫
  const showVoteAnimation = (restaurantId) => {
    const restaurant = [...limitedRestaurants, ...alternativeRestaurants].find(
      (r) => r.id === restaurantId
    );

    if (restaurant) {
      setVoteAnimation({
        id: restaurantId,
        name: restaurant.name,
        timestamp: Date.now(),
      });

      // 3秒後移除動畫
      setTimeout(() => {
        setVoteAnimation(null);
      }, 3000);
    }
  };

  // 確認最終選擇的餐廳
  const handleFinalize = async () => {
    if (!roomId || saved.length === 0) return;

    try {
      // 如果有多個收藏，選擇第一個
      const selectedRestaurant = saved[0];

      const result = await finalResultService.finalizeRestaurant(roomId, selectedRestaurant);
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

  // 渲染五彩紙屑
  const renderConfetti = () => {
    return (
      showConfetti && (
        <div className="confetti-container">
          {Array.from({ length: 80 }).map((_, i) => (
            <div
              key={i}
              className="confetti"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: `hsl(${Math.random() * 360}, 80%, 60%)`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random() * 3}s`,
              }}
            />
          ))}
        </div>
      )
    );
  };

  // 如果處於結果階段
  if (phase === "result" || phase === "vote-result") {
    // 確保最終選擇的餐廳在saved列表頂部
    let finalSaved = [...saved];
    if (finalResult && !saved.some((r) => r.id === finalResult.id)) {
      finalSaved = [finalResult, ...saved];
    } else if (finalResult) {
      finalSaved = [
        finalResult,
        ...saved.filter((r) => r.id !== finalResult.id),
      ];
    }

    return (
      <>
        {renderConfetti()}

        <RecommendationResult
          saved={finalSaved}
          alternatives={alternativeRestaurants}
          onRetry={handleRestart}
          votes={votes} // 傳遞投票數據給結果組件
          // 添加Buddies模式特有的信息和按鈕
          extraButton={
            <div className="buddies-extra-info">
              {/* 返回房間按鈕 */}
              <motion.button
                className="btn-restart"
                style={{ background: "#6874E8", width: "100%" }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleBackToRoom}
              >
                👥 回到房間
              </motion.button>
            </div>
          }
          // 將roomMode設為false，使其與SwiftTaste模式保持一致的顯示效果
          roomMode={false}
        />
      </>
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
              style={{ background: "#6874E8", marginLeft: "1rem" }}
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
    <div className="buddies-container">
      <div className="buddies-card">
        <h3 className="card-title">
          一起選餐廳 🍜 ({userVoted ? "已投票" : "滑動選擇"})
        </h3>

        {/* 投票和最愛計數顯示 */}
        <div className="vote-stats">
          <div>
            <span role="img" aria-label="vote">
              🗳️
            </span>{" "}
            總票數:{" "}
            {Object.values(votes).reduce((sum, count) => sum + count, 0)}
          </div>
          <div>
            <span role="img" aria-label="favorite">
              ⭐
            </span>{" "}
            已收藏: {saved.length}
          </div>
        </div>

        {/* 投票排行顯示 */}
        {Object.keys(votes).length > 0 && (
          <div className="vote-ranking">
            <h3>實時投票排行</h3>
            <div className="vote-bars">
              {Object.entries(votes)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([restaurantId, voteCount], index) => {
                  const restaurant = [
                    ...limitedRestaurants,
                    ...alternativeRestaurants,
                  ].find((r) => r.id === restaurantId);

                  if (!restaurant) return null;

                  const total = Object.values(votes).reduce(
                    (sum, count) => sum + count,
                    0
                  );
                  const percentage = Math.round((voteCount / total) * 100);

                  return (
                    <div key={restaurantId} className="vote-rank-item">
                      <div className="vote-rank-header">
                        <div className="vote-rank-name">
                          <span className="vote-rank-position">
                            {index + 1}
                          </span>
                          {restaurant.name}
                        </div>
                        <div className="vote-rank-count">{voteCount} 票</div>
                      </div>
                      <div className="vote-rank-bar-container">
                        <div
                          className="vote-rank-bar"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor:
                              index === 0
                                ? "#FF6B6B"
                                : index === 1
                                ? "#FF9F68"
                                : "#FFC175",
                          }}
                        ></div>
                        <span className="vote-rank-percentage">
                          {percentage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* 使用與單人模式相同的滑動組件 */}
        <div className="swiper-container">
          <RestaurantSwiperMotion
            restaurants={limitedRestaurants}
            onSave={handleSaveRestaurant}
            onFinish={handleFinishSwiping}
          />
        </div>

        {saved.length > 0 && (
          <div className="saved-section">
            <h3>已收藏餐廳 ⭐</h3>
            <ul className="saved-restaurant-list">
              {saved.map((r) => (
                <li key={r.id} className="saved-restaurant-item">
                  <div className="saved-restaurant-info">
                    <span className="saved-restaurant-name">{r.name}</span>
                    <span className="saved-restaurant-votes">
                      {votes[r.id] ? `🗳️ ${votes[r.id]} 票` : ""}
                    </span>
                  </div>
                  {!userVoted && (
                    <button
                      className="vote-button"
                      onClick={() => handleVote(r.id)}
                    >
                      投票
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 備選餐廳顯示 */}
        {alternativeRestaurants.length > 0 && (
          <div className="buddies-alternatives-section">
            <h3>可能也適合的餐廳 🔍</h3>
            <ul className="buddies-alternative-restaurant-list">
              {alternativeRestaurants.map((r) => (
                <li key={r.id} className="buddies-alternative-restaurant-item">
                  <div className="buddies-alternative-restaurant-info">
                    <div className="buddies-alternative-restaurant-name">{r.name}</div>
                    <div className="buddies-alternative-restaurant-details">
                      {r.type && (
                        <span className="restaurant-type">{r.type}</span>
                      )}
                      {r.rating && (
                        <span className="restaurant-rating">
                          ⭐ {r.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  {!userVoted ? (
                    <button
                      className="vote-button alternative"
                      onClick={() => handleVote(r.id)}
                    >
                      投票
                    </button>
                  ) : (
                    <div className="vote-count">
                      {votes[r.id] ? `${votes[r.id]} 票` : "0 票"}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="action-buttons">
          <button
            className="btn-restart"
            style={{ marginRight: "0.5rem" }}
            onClick={handleRestart}
          >
            🔄 回到首頁
          </button>
          <button
            className="btn-restart"
            style={{ background: "#6874E8" }}
            onClick={handleBackToRoom}
          >
            👥 回到房間
          </button>
        </div>

        {saved.length > 0 && (
          <button className="btn-finalize" onClick={handleFinalize}>
            ✨ 確認選擇 ({saved.length > 0 ? saved[0].name : ""})
          </button>
        )}
      </div>

      {/* 無結果模態 */}
      {showNoResultsModal && (
        <div className="modal-overlay" onClick={() => setShowNoResultsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">😔</div>
            <h3>有點可惜呢</h3>
            <p>看起來沒有餐廳符合大家的喜好，要不要再試一次？</p>
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
                  onBack();
                }}
              >
                返回房間
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
