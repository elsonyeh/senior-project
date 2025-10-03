import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { memberService, roomService } from "../services/supabaseService";
import RestaurantSwiperMotion from "./RestaurantSwiperMotion";
import RecommendationResult from "./RecommendationResult";
import { voteService, finalResultService } from "../services/supabaseService";
import logger from "../utils/logger";
import "./RecommendationResult.css";
import "./SwiftTasteCard.css";
import "./BuddiesVoteStyles.css";

export default function BuddiesRecommendation({
  roomId,
  restaurants = [],
  onBack,
  onFinalResult, // 新增：當最終結果確定時的回調
}) {
  const [phase, setPhase] = useState("recommend");
  const [saved, setSaved] = useState([]);
  const [votes, setVotes] = useState({});
  const [votedRestaurants, setVotedRestaurants] = useState(new Set()); // 追蹤已投票的餐廳ID
  const [finalResult, setFinalResult] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [limitedRestaurants, setLimitedRestaurants] = useState([]);
  const [alternativeRestaurants, setAlternativeRestaurants] = useState([]);
  const [voteAnimation, setVoteAnimation] = useState(null);
  const [totalMembers, setTotalMembers] = useState(0);
  const [votedUsersCount, setVotedUsersCount] = useState(0);
  const [showNoResultsModal, setShowNoResultsModal] = useState(false);
  const [members, setMembers] = useState([]); // 新增：儲存房間成員列表
  const navigate = useNavigate();

  // 獲取當前用戶ID
  const userId = localStorage.getItem("userId") || roomService.getOrCreateUserId();

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
  const handleFinishSwiping = useCallback(async () => {
    logger.debug("🏁 handleFinishSwiping 被調用", {
      votesCount: Object.keys(votes).length,
      savedCount: saved.length,
      votes: votes
    });

    setPhase("vote-result");

    let selectedRestaurant = null;

    // 計算投票結果 - 只計算票數 > 0 的餐廳
    const votedRestaurants = Object.entries(votes).filter(([, count]) => count > 0);

    logger.debug("📊 投票統計:", {
      totalVoteEntries: Object.keys(votes).length,
      votedRestaurants: votedRestaurants.length,
      votedDetails: votedRestaurants
    });

    if (votedRestaurants.length > 0) {
      // 找出票數最高的餐廳
      const sortedRestaurants = votedRestaurants.sort(
        ([, voteA], [, voteB]) => voteB - voteA
      );

      const topVotes = sortedRestaurants[0][1];
      const tiedRestaurants = sortedRestaurants.filter(
        ([, voteCount]) => voteCount === topVotes
      );

      logger.debug("🏆 最高票數:", {
        topVotes,
        tiedCount: tiedRestaurants.length,
        tiedRestaurants: tiedRestaurants.map(([id, count]) => ({ id, count }))
      });

      if (tiedRestaurants.length > 1) {
        // 如果有平局，優先使用房主的投票
        logger.debug("⚖️ 偵測到平局，查找房主的投票");

        const hostMember = members.find(m => m.isHost);

        if (hostMember) {
          // 從資料庫查詢房主投票的餐廳
          const hostVotesResult = await voteService.getUserVotedRestaurants(roomId, hostMember.id);

          if (hostVotesResult.success && hostVotesResult.restaurantIds.length > 0) {
            const tiedRestaurantIds = new Set(tiedRestaurants.map(([id]) => id));

            // 查找房主投票的餐廳中，是否有平局中的餐廳
            const hostChoice = hostVotesResult.restaurantIds.find(rid => tiedRestaurantIds.has(rid));

            if (hostChoice) {
              logger.debug("👑 平票由房主決定:", {
                hostName: hostMember.name,
                hostId: hostMember.id,
                hostChoice: hostChoice,
                hostVotedRestaurants: hostVotesResult.restaurantIds
              });
              selectedRestaurant = [
                ...limitedRestaurants,
                ...alternativeRestaurants,
              ].find((r) => r.id === hostChoice);
            }
          }
        }

        // 如果找不到房主投票或房主沒有投票給平局中的餐廳，使用確定性隨機
        if (!selectedRestaurant) {
          logger.debug("⚖️ 房主未投票或未投平局餐廳，使用房間種子決定");
          const seed = generateSeedFromRoomId(roomId);
          const shuffledTied = seededShuffle(tiedRestaurants, seed);
          const topVotedId = shuffledTied[0][0];
          selectedRestaurant = [
            ...limitedRestaurants,
            ...alternativeRestaurants,
          ].find((r) => r.id === topVotedId);
        }
      } else {
        // 沒有平局，選擇最高票餐廳
        const topVotedId = sortedRestaurants[0][0];
        selectedRestaurant = [
          ...limitedRestaurants,
          ...alternativeRestaurants,
        ].find((r) => r.id === topVotedId);
      }
    } else if (saved.length > 0) {
      // 如果沒有任何投票，使用首個收藏的餐廳
      logger.debug("📌 沒有投票，使用收藏列表第一個");
      selectedRestaurant = saved[0];
    } else {
      logger.warn("⚠️ 沒有投票也沒有收藏，無法選擇最終餐廳");
    }

    // 如果找到了最終餐廳，寫入資料庫並廣播
    if (selectedRestaurant) {
      try {
        const result = await finalResultService.finalizeRestaurant(
          roomId,
          selectedRestaurant,
          userId
        );

        if (result.success) {
          console.log("✅ 最終餐廳已自動確認:", selectedRestaurant.name);
          // 本地也設置，避免延遲
          setFinalResult(selectedRestaurant);
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000);
          setPhase("result");
        } else {
          console.error("❌ 寫入最終餐廳失敗:", result.error);
        }
      } catch (error) {
        console.error("❌ 確認最終餐廳時發生錯誤:", error);
      }
    } else {
      // 沒有任何餐廳被選擇，顯示可惜畫面
      logger.warn("😔 沒有任何餐廳被選擇");
      setPhase("no-result");
    }
  }, [votes, limitedRestaurants, alternativeRestaurants, saved, roomId, userId, members]);

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

      // 1. 根據 matchScore 排序
      const sortedByScore = [...restaurants].sort(
        (a, b) => (b.matchScore || 0) - (a.matchScore || 0)
      );

      // 2. 取分數最高的前10間
      const topTen = sortedByScore.slice(0, 10);

      // 3. 使用房間ID作為種子打亂前10名的順序（確保同房間所有人看到相同順序）
      const shuffledTopTen = seededShuffle(topTen, roomSeed);
      console.log("✅ 已使用房間種子打亂前10名順序");

      // 設置限制後的餐廳列表
      setLimitedRestaurants(shuffledTopTen);

      // 保留其餘餐廳作為備選（仍按照評分排序）
      if (sortedByScore.length > 10) {
        const alternatives = sortedByScore.slice(10, 15);
        setAlternativeRestaurants(alternatives);
      }

      // 不要覆蓋現有票數，只為新餐廳初始化
      // 讓 listenVotes 從資料庫載入真實票數
      logger.debug("✅ 餐廳列表已設置，等待從資料庫載入票數");
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

      // 不要覆蓋現有票數，只為新餐廳初始化
      // 讓 listenVotes 從資料庫載入真實票數
      logger.debug("✅ 餐廳列表已設置，等待從資料庫載入票數");
    }
  }, [restaurants, roomId]);

  // 監聽投票和最終結果
  useEffect(() => {
    if (!roomId) return;

    // 獲取用戶已投票的餐廳列表
    const initializeVotedRestaurants = async () => {
      const result = await voteService.getUserVotedRestaurants(roomId, userId);
      if (result.success && result.restaurantIds.length > 0) {
        setVotedRestaurants(new Set(result.restaurantIds));
        logger.debug("📋 已投票的餐廳:", result.restaurantIds);
      }
    };
    initializeVotedRestaurants();

    // 監聽房間成員人數和成員資訊
    const unsubscribeMembers = memberService.listenRoomMembers(roomId, (membersObj) => {
      const membersList = Object.values(membersObj).map(m => ({
        id: m.id,
        name: m.name,
        isHost: m.isHost
      }));
      setMembers(membersList);
      setTotalMembers(membersList.length);
      logger.debug("📋 房間成員更新:", membersList);
    });

    // 監聽投票更新
    const unsubscribeVotes = voteService.listenVotes(roomId, async (votesData) => {
      if (votesData) {
        // 直接使用資料庫的票數，確保所有成員看到相同的數據
        logger.debug("📊 收到投票更新:", votesData);
        setVotes(votesData);

        // 檢查實際已投票的用戶數
        const votedResult = await voteService.getVotedUsersCount(roomId);
        if (votedResult.success) {
          const actualVotedCount = votedResult.count;
          setVotedUsersCount(actualVotedCount);

          console.log("📊 投票進度檢查:", {
            totalMembers,
            votedCount: actualVotedCount,
            votedUsers: votedResult.userIds,
            phase,
            shouldFinish: actualVotedCount >= totalMembers && totalMembers > 0
          });

          // 如果所有成員都已投票，切換到結果階段
          if (actualVotedCount >= totalMembers && totalMembers > 0 && phase === "recommend") {
            console.log("✅ 所有成員已完成投票，進入結果階段");
            handleFinishSwiping();
          }
        }
      }
    });

    // 監聽最終結果
    const unsubscribeFinal = finalResultService.listenFinalRestaurant(roomId, (finalData) => {
      logger.debug("🎯 收到最終結果更新:", finalData);

      if (finalData && finalData.restaurant_id) {
        // 嘗試從所有可用列表中尋找餐廳
        const allRestaurantLists = [
          ...limitedRestaurants,
          ...alternativeRestaurants,
          ...restaurants
        ];

        const finalRestaurant = allRestaurantLists.find((r) => r && r.id === finalData.restaurant_id);

        logger.debug("🔍 尋找最終餐廳:", {
          searchingFor: finalData.restaurant_id,
          foundInList: !!finalRestaurant,
          finalRestaurantName: finalRestaurant?.name,
          limitedCount: limitedRestaurants.length,
          alternativeCount: alternativeRestaurants.length,
          allRestaurantsCount: restaurants.length,
          totalSearchable: allRestaurantLists.length
        });

        // 優先使用找到的餐廳物件，否則從資料庫資料重建
        const restaurantToSet = finalRestaurant || {
          id: finalData.restaurant_id,
          name: finalData.restaurant_name,
          address: finalData.restaurant_address,
          photoURL: finalData.restaurant_photo_url,
          rating: finalData.restaurant_rating,
          type: finalData.restaurant_type,
        };

        if (!finalRestaurant) {
          logger.warn("⚠️ 無法從推薦列表找到餐廳，使用資料庫資料重建");
        } else {
          logger.debug("✅ 從推薦列表找到餐廳:", finalRestaurant.name);
        }

        // 設置最終結果並切換到結果階段
        setFinalResult(restaurantToSet);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
        setPhase("result");

        logger.debug("🎉 最終結果已設置，phase 已切換至 result");

        // 通知父組件最終結果已確定（用於記錄選擇歷史）
        if (onFinalResult && typeof onFinalResult === 'function') {
          onFinalResult(restaurantToSet);
        }
      }
    });

    return () => {
      // 移除監聽
      unsubscribeMembers();
      unsubscribeVotes();
      unsubscribeFinal();
    };
  }, [roomId, restaurants, limitedRestaurants, alternativeRestaurants, totalMembers, phase, handleFinishSwiping, onFinalResult]);

  // 處理無結果情況
  const handleNoResults = () => {
    console.log("Buddies 模式沒有餐廳被選擇，顯示可惜畫面");
    setShowNoResultsModal(true);
  };

  const handleRetrySelection = () => {
    setShowNoResultsModal(false);
    setSaved([]);
    setVotes({});
    setVotedRestaurants(new Set()); // 重置已投票的餐廳集合
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

    logger.debug("💾 handleSaveRestaurant 被調用:", {
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      alreadySaved: !!saved.find((r) => r.id === restaurant.id)
    });

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
    if (!roomId) return;

    // 檢查是否已經為這個餐廳投過票
    if (votedRestaurants.has(restaurantId)) {
      logger.debug("⚠️ 已經為此餐廳投過票:", restaurantId);
      return;
    }

    try {
      logger.debug("📝 投票資訊:", { roomId, restaurantId, userId });
      const result = await voteService.voteForRestaurant(roomId, restaurantId, userId);
      if (result.success) {
        logger.debug("✅ 投票成功");

        // 標記此餐廳已投票
        setVotedRestaurants(prev => new Set([...prev, restaurantId]));

        // 立即更新本地票數
        setVotes(prevVotes => ({
          ...prevVotes,
          [restaurantId]: (prevVotes[restaurantId] || 0) + 1
        }));
      } else {
        console.error("❌ 投票失敗:", result.error);
      }
    } catch (error) {
      console.error("❌ 投票異常:", error);
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

  // 如果沒有結果（所有人都左滑或沒有投票）
  if (phase === "no-result") {
    return (
      <div className="recommend-screen">
        <div className="empty-result">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2>😔 有點可惜呢</h2>
            <p>看起來大家都沒有特別喜歡的餐廳</p>
            <p>要不要重新選擇，或是放寬一下條件？</p>
            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <motion.button
                className="btn-restart"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  // 重置狀態，重新滑動
                  setSaved([]);
                  setVotes({});
                  setVotedRestaurants(new Set());
                  setFinalResult(null);
                  setPhase("recommend");
                }}
              >
                🔄 再試一次
              </motion.button>
              <motion.button
                className="btn-restart"
                style={{ background: "#6874E8" }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleBackToRoom}
              >
                👥 回到房間
              </motion.button>
              <motion.button
                className="btn-restart"
                style={{ background: "#666" }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRestart}
              >
                🏠 回到首頁
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // 如果處於結果階段
  if (phase === "result" || phase === "vote-result") {
    logger.debug("📊 結果階段 - 票數數據:", {
      votes,
      votesKeys: Object.keys(votes),
      votesValues: Object.values(votes),
      votesEntries: Object.entries(votes),
      saved: saved.map(r => ({ id: r.id, name: r.name })),
      finalResult: finalResult ? { id: finalResult.id, name: finalResult.name } : null
    });

    // 如果有收藏餐廳（用戶滑動選擇），使用收藏列表
    // 如果沒有收藏餐廳，則使用有票數的餐廳（票數 > 0）
    let finalSaved = [];
    if (saved.length > 0) {
      // 有收藏，按票數排序收藏列表
      finalSaved = [...saved].sort((a, b) => {
        const votesA = votes[a.id] || 0;
        const votesB = votes[b.id] || 0;
        return votesB - votesA;
      });
    } else {
      // 沒有收藏，過濾出有票數的餐廳並按票數排序
      const votedRestaurants = limitedRestaurants
        .filter(r => votes[r.id] && votes[r.id] > 0)
        .sort((a, b) => {
          const votesA = votes[a.id] || 0;
          const votesB = votes[b.id] || 0;
          return votesB - votesA;
        });

      finalSaved = votedRestaurants.length > 0 ? votedRestaurants : [...limitedRestaurants];

      logger.debug("📋 最終餐廳列表（按票數排序）:", {
        count: finalSaved.length,
        restaurants: finalSaved.map(r => ({
          name: r.name,
          id: r.id,
          votes: votes[r.id] || 0
        }))
      });
    }

    // 確保最終選擇的餐廳在列表頂部
    if (finalResult) {
      if (!finalSaved.some((r) => r.id === finalResult.id)) {
        // 最終結果不在列表中，添加到頂部
        finalSaved = [finalResult, ...finalSaved];
        logger.debug("✅ 最終結果已添加到列表頂部:", finalResult.name);
      } else {
        // 最終結果在列表中，移到頂部
        finalSaved = [
          finalResult,
          ...finalSaved.filter((r) => r.id !== finalResult.id),
        ];
        logger.debug("✅ 最終結果已移至列表頂部:", finalResult.name);
      }
    } else {
      logger.warn("⚠️ 沒有最終結果，使用票數最高的餐廳");
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
          一起選餐廳 🍜 ({votedRestaurants.size > 0 ? `已投 ${votedRestaurants.size} 票` : "滑動選擇"})
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
            <span role="img" aria-label="progress">
              👥
            </span>{" "}
            投票進度: {votedUsersCount}/{totalMembers}
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
                  {!votedRestaurants.has(r.id) && (
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
                  {!votedRestaurants.has(r.id) ? (
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
