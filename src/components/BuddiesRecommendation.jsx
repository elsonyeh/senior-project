import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import socket from "../services/socket";
import RestaurantSwiperMotion from "./RestaurantSwiperMotion";
import RecommendationResult from "./RecommendationResult";
import { funQuestionTagsMap } from "../data/funQuestionTags";
import {
  voteForRestaurant,
  listenVotes,
  finalizeRestaurant,
  listenFinalRestaurant,
} from "../services/firebaseService";
import "./RecommendationResult.css";
import "./SwiftTasteCard.css";
import "./BuddiesVoteStyles.css";

// 常量定義
const DISTANCE_THRESHOLDS = {
  NEAR: 2,
  MEDIUM: 5,
  FAR: 10,
};

// 輔助函數
const calculateDistance = (coord1, coord2) => {
  if (
    !coord1 ||
    !coord2 ||
    !coord1.lat ||
    !coord1.lng ||
    !coord2.lat ||
    !coord2.lng
  )
    return 999999;
  const R = 6371;
  const dLat = degreesToRadians(coord2.lat - coord1.lat);
  const dLng = degreesToRadians(coord2.lng - coord1.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(degreesToRadians(coord1.lat)) *
      Math.cos(degreesToRadians(coord2.lat)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const degreesToRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

const createSeededRandom = (seed) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

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

  // 在 BuddiesRecommendation 組件內添加本地推薦邏輯
  const generateLocalRecommendations = useCallback(
    (restaurantList, answers = [], options = {}) => {
      if (!Array.isArray(restaurantList) || restaurantList.length === 0) {
        console.log("無效的餐廳列表");
        return [];
      }

      console.log("開始生成本地推薦，原始餐廳數量:", restaurantList.length);
      console.log("答案:", answers);

      // 基本問題答案處理（前6個為基本問題）
      const basicAnswers = answers.slice(0, 6);
      const funAnswers = answers.slice(6);

      console.log("基本問題答案:", basicAnswers);
      console.log("趣味問題答案:", funAnswers);

      // 第一階段：硬性條件過濾
      let filteredRestaurants = [...restaurantList];

      // 處理基本問題篩選
      basicAnswers.forEach((answer) => {
        if (!answer) return;

        const beforeCount = filteredRestaurants.length;

        switch (answer) {
          case "喝":
            filteredRestaurants = filteredRestaurants.filter((r) => {
              const tags = Array.isArray(r.tags) ? r.tags : [r.tags];
              return tags.some(
                (tag) =>
                  typeof tag === "string" && tag.toLowerCase().trim() === "喝"
              );
            });
            break;

          case "吃":
            filteredRestaurants = filteredRestaurants.filter((r) => {
              const tags = Array.isArray(r.tags) ? r.tags : [r.tags];
              return tags.some((tag) => {
                const normalizedTag =
                  typeof tag === "string" ? tag.toLowerCase().trim() : "";
                return normalizedTag === "吃一點" || normalizedTag === "飽足";
              });
            });
            break;

          case "吃一點":
            filteredRestaurants = filteredRestaurants.filter((r) => {
              const tags = Array.isArray(r.tags) ? r.tags : [r.tags];
              return tags.some(
                (tag) =>
                  typeof tag === "string" &&
                  tag.toLowerCase().trim() === "吃一點"
              );
            });
            break;

          case "吃飽":
            filteredRestaurants = filteredRestaurants.filter((r) => {
              const tags = Array.isArray(r.tags) ? r.tags : [r.tags];
              return tags.some(
                (tag) =>
                  typeof tag === "string" && tag.toLowerCase().trim() === "飽足"
              );
            });
            break;

          case "平價美食":
            filteredRestaurants = filteredRestaurants.filter(
              (r) => r.priceRange === "$" || r.priceRange === "$$"
            );
            break;

          case "奢華美食":
            filteredRestaurants = filteredRestaurants.filter(
              (r) => r.priceRange === "$$$" || r.priceRange === "$$$$"
            );
            break;

          case "辣":
            filteredRestaurants = filteredRestaurants.filter(
              (r) => r.isSpicy === true
            );
            break;

          case "不辣":
            filteredRestaurants = filteredRestaurants.filter(
              (r) => r.isSpicy === false
            );
            break;

          case "附近吃":
            if (options.userLocation) {
              filteredRestaurants = filteredRestaurants.filter((r) => {
                if (!r.location) return false;
                const distance = calculateDistance(
                  options.userLocation,
                  r.location
                );
                return distance <= DISTANCE_THRESHOLDS.NEAR;
              });
            }
            break;

          case "遠一點":
            if (options.userLocation) {
              filteredRestaurants = filteredRestaurants.filter((r) => {
                if (!r.location) return false;
                const distance = calculateDistance(
                  options.userLocation,
                  r.location
                );
                return distance >= DISTANCE_THRESHOLDS.MEDIUM;
              });
            }
            break;

          case "單人":
            filteredRestaurants = filteredRestaurants.filter(
              (r) => r.suggestedPeople && r.suggestedPeople.includes("1")
            );
            break;

          case "多人":
            filteredRestaurants = filteredRestaurants.filter(
              (r) => r.suggestedPeople && r.suggestedPeople.includes("~")
            );
            break;
        }

        console.log(
          `篩選條件 "${answer}" 後剩餘餐廳數量: ${
            filteredRestaurants.length
          } (篩選掉 ${beforeCount - filteredRestaurants.length} 家)`
        );
      });

      // 如果沒有符合基本條件的餐廳，直接返回空陣列
      if (filteredRestaurants.length === 0) {
        console.log("沒有符合基本條件的餐廳");
        return [];
      }

      console.log("通過基本條件篩選的餐廳數量:", filteredRestaurants.length);

      // 第二階段：計算趣味問題匹配分數
      const scoredRestaurants = filteredRestaurants.map((restaurant) => {
        let score = 0; // 基礎分數從0開始
        const tags = Array.isArray(restaurant.tags)
          ? restaurant.tags
          : [restaurant.tags];
        const normalizedTags = tags
          .map((tag) =>
            typeof tag === "string" ? tag.toLowerCase().trim() : ""
          )
          .filter(Boolean);

        // 趣味問題匹配分數計算
        funAnswers.forEach((answer) => {
          if (!answer) return;

          // 使用 funQuestionTagsMap 進行標籤匹配
          const mappedTags = funQuestionTagsMap[answer] || [];
          let matchCount = 0;

          mappedTags.forEach((mappedTag) => {
            const normalizedMappedTag = String(mappedTag || "")
              .toLowerCase()
              .trim();
            if (
              normalizedTags.some((tag) => tag.includes(normalizedMappedTag))
            ) {
              matchCount++;
            }
          });

          // 計算此答案的匹配程度（0-1之間）
          if (mappedTags.length > 0) {
            score += (matchCount / mappedTags.length) * 2; // 每個趣味問題最高2分
          }
        });

        // 加入餐廳基本評分（權重較小）
        if (restaurant.rating) {
          score += restaurant.rating / 10; // 評分最高貢獻0.5分
        }
        if (restaurant.reviews) {
          score += Math.min(restaurant.reviews / 1000, 0.5); // 評論數最高貢獻0.5分
        }

        return {
          ...restaurant,
          matchScore: score,
        };
      });

      // 根據分數排序並選擇前10名
      const sortedRestaurants = scoredRestaurants
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 10);

      console.log("最終推薦餐廳數量:", sortedRestaurants.length);
      console.log(
        "推薦餐廳分數範圍:",
        Math.min(...sortedRestaurants.map((r) => r.matchScore)),
        "至",
        Math.max(...sortedRestaurants.map((r) => r.matchScore))
      );

      return sortedRestaurants;
    },
    []
  );

  // 處理平票情況的函數
  const handleTieBreaker = useCallback((tiedRestaurants, roomId) => {
    // 使用多個因素來打破平局
    const tieBreakers = tiedRestaurants.map((restaurant) => {
      let tieScore = 0;

      // 1. 匹配分數權重 (最高權重)
      if (restaurant.matchScore) {
        tieScore += restaurant.matchScore * 3;
      }

      // 2. 評分權重
      if (restaurant.rating) {
        tieScore += restaurant.rating * 2;
      }

      // 3. 評論數量權重
      if (restaurant.reviews) {
        tieScore += Math.min(restaurant.reviews / 100, 3);
      }

      // 4. 標籤數量權重
      const tags = Array.isArray(restaurant.tags)
        ? restaurant.tags
        : [restaurant.tags];
      tieScore += tags.length * 0.5;

      // 5. 使用房間ID作為種子生成確定性隨機因子
      const seed = generateSeedFromRoomId(roomId);
      const random = createSeededRandom(seed);
      tieScore += random() * 0.1; // 添加小的隨機因子，但權重很小

      return {
        ...restaurant,
        tieScore,
      };
    });

    // 根據平局分數排序
    return tieBreakers.sort((a, b) => b.tieScore - a.tieScore)[0];
  }, []);

  // 修改 handleFinishSwiping 函數
  const handleFinishSwiping = useCallback(() => {
    setPhase("vote-result");

    if (Object.keys(votes).length > 0) {
      // 計算每個餐廳的總票數
      const voteCounts = {};
      Object.entries(votes).forEach(([restaurantId, count]) => {
        voteCounts[restaurantId] = count;
      });

      // 找出最高票數
      const maxVotes = Math.max(...Object.values(voteCounts));

      // 找出所有獲得最高票的餐廳
      const topVotedRestaurants = Object.entries(voteCounts)
        .filter(([, count]) => count === maxVotes)
        .map(([restaurantId]) => {
          return [...limitedRestaurants, ...alternativeRestaurants].find(
            (r) => r.id === restaurantId
          );
        })
        .filter(Boolean);

      console.log("最高票餐廳:", topVotedRestaurants);

      if (topVotedRestaurants.length > 1) {
        // 如果有平票，使用平票處理邏輯
        console.log("檢測到平票情況，使用平票處理邏輯");
        const finalRestaurant = handleTieBreaker(topVotedRestaurants, roomId);
        setFinalResult(finalRestaurant);
      } else if (topVotedRestaurants.length === 1) {
        setFinalResult(topVotedRestaurants[0]);
      }
    } else if (saved.length > 0) {
      setFinalResult(saved[0]);
    }
  }, [
    votes,
    limitedRestaurants,
    alternativeRestaurants,
    saved,
    roomId,
    handleTieBreaker,
  ]);

  // 修改 useEffect 中的餐廳處理邏輯
  useEffect(() => {
    console.log("初始化推薦組件，餐廳數量:", restaurants.length);

    if (!Array.isArray(restaurants) || restaurants.length === 0) {
      console.error("無效的餐廳數據");
      return;
    }

    // 使用本地推薦邏輯生成推薦結果
    const recommendedRestaurants = generateLocalRecommendations(
      restaurants,
      [],
      { roomId }
    );

    // 取前10間作為主要推薦
    const mainRecommendations = recommendedRestaurants
      .slice(0, 10)
      .map((r) => ({
        ...r,
        id: r.id || `rest_${Math.random().toString(36).substr(2, 9)}`,
        name: r.name || "未命名餐廳",
        address: r.address || "地址未知",
        photoURL:
          r.photoURL || "https://source.unsplash.com/400x300/?restaurant",
        matchScore: r.matchScore || 0,
      }));

    setLimitedRestaurants(mainRecommendations);

    // 取接下來的5間作為備選
    if (recommendedRestaurants.length > 10) {
      const alternatives = recommendedRestaurants.slice(10, 15).map((r) => ({
        ...r,
        id: r.id || `rest_${Math.random().toString(36).substr(2, 9)}`,
        name: r.name || "未命名餐廳",
        address: r.address || "地址未知",
        photoURL:
          r.photoURL || "https://source.unsplash.com/400x300/?restaurant",
        matchScore: r.matchScore || 0,
      }));
      setAlternativeRestaurants(alternatives);
    }
  }, [restaurants, roomId, generateLocalRecommendations]);

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
    const handleMembersUpdate = (membersList) => {
      if (membersList && Array.isArray(membersList)) {
        setTotalMembers(membersList.length);
      }
    };

    // 註冊監聽事件
    socket.on("updateUsers", handleMembersUpdate);

    // 監聽投票更新
    const unsubscribeVotes = listenVotes(roomId, (votesData) => {
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
    const unsubscribeFinal = listenFinalRestaurant(roomId, (finalData) => {
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
      socket.off("updateUsers", handleMembersUpdate);
      unsubscribeVotes();
      unsubscribeFinal();
    };
  }, [roomId, restaurants, totalMembers, phase, handleFinishSwiping]);

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
      <div className="recommend-screen">
        {renderConfetti()}

        <RecommendationResult
          saved={finalSaved}
          alternatives={alternativeRestaurants}
          onRetry={handleRestart}
          votes={votes} // 傳遞投票數據給結果組件
          // 添加額外的返回房間按鈕
          extraButton={
            <motion.button
              className="btn-restart"
              style={{ background: "#6874E8", marginTop: "1rem" }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleBackToRoom}
            >
              👥 回到房間
            </motion.button>
          }
          // 將roomMode設為false，使其與SwiftTaste模式保持一致的顯示效果
          roomMode={false}
        />
      </div>
    );
  }

  // 如果沒有推薦餐廳，顯示提示
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
              🔄 重新開始
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
    <div className="swift-taste-container">
      <div className="swift-taste-card">
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
          <div className="alternatives-section">
            <h3>可能也適合的餐廳 🔍</h3>
            <ul className="alternative-restaurant-list">
              {alternativeRestaurants.map((r) => (
                <li key={r.id} className="alternative-restaurant-item">
                  <div className="alternative-restaurant-info">
                    <div className="alternative-restaurant-name">{r.name}</div>
                    <div className="alternative-restaurant-details">
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
            🔄 重新開始
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
    </div>
  );
}
