import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./RecommendationResult.css";

export default function RecommendationResult({
  saved = [],
  alternatives = [], // 新增備選餐廳參數
  onRetry,
  extraButton,
  votes = {}, // 新增投票數據
  roomMode = false,
  onInteraction, // 新增互動回調
}) {
  console.log("🎯 RecommendationResult 接收到的 votes:", votes);
  console.log("🎯 RecommendationResult 接收到的 saved:", saved.map(r => ({ id: r.id, name: r.name })));

  const [selected, setSelected] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [displayedAlternatives, setDisplayedAlternatives] = useState([]); // 備選餐廳列表
  const [alternativesPool, setAlternativesPool] = useState([]); // 儲存所有尚未顯示的備選餐廳
  const [noMoreAlternatives, setNoMoreAlternatives] = useState(false); // 是否還有更多備選餐廳
  const [surveyOpened, setSurveyOpened] = useState(false); // 問卷是否已開啟
  const [showSurveyModal, setShowSurveyModal] = useState(false); // 問卷 Modal 是否顯示

  // 初始化時選擇第一個餐廳並設置動畫效果
  useEffect(() => {
    if (saved.length > 0) {
      // 按照分數排序已保存的餐廳（如果有matchScore屬性）
      const sortedSaved = [...saved].sort((a, b) => {
        // 如果有matchScore屬性，按照分數排序
        if (a.matchScore !== undefined && b.matchScore !== undefined) {
          return b.matchScore - a.matchScore;
        }
        // 否則保持原有順序
        return 0;
      });

      // 選擇分數最高的餐廳作為主選餐廳
      const selectedRestaurant = sortedSaved[0];

      // 只有當selected不存在或id不同時才更新，避免無限循環
      if (!selected || selected.id !== selectedRestaurant.id) {
        // 使用第一個作為主選餐廳（分數最高的）
        setSelected(selectedRestaurant);

        // 獲取左滑（不喜歡）的餐廳列表
        const disliked = JSON.parse(localStorage.getItem("dislikedRestaurants") || "[]");
        const dislikedIds = new Set(disliked.map(r => r.id));

        // 合併其他餐廳（除了主選餐廳外），排除左滑的餐廳
        const allAlternativeRestaurants = [
          ...sortedSaved.filter(r => r && r.id && r.id !== selectedRestaurant.id && !dislikedIds.has(r.id)),
          ...alternatives.filter(r => r && r.id && r.id !== selectedRestaurant.id && !dislikedIds.has(r.id))
        ];

        // 根據 matchScore 或投票數排序所有備選餐廳
        const sortedAlternatives = [...allAlternativeRestaurants].sort((a, b) => {
          // 優先按照 matchScore 排序
          if (a.matchScore !== undefined && b.matchScore !== undefined) {
            return b.matchScore - a.matchScore;
          }
          // 次要排序依據：投票數
          const votesA = votes[a.id] || 0;
          const votesB = votes[b.id] || 0;
          return votesB - votesA;
        });

        // 移除重複的餐廳（根據 ID）
        const uniqueAlternatives = [];
        const seenIds = new Set();
        
        sortedAlternatives.forEach(r => {
          if (r && r.id && !seenIds.has(r.id)) {
            seenIds.add(r.id);
            uniqueAlternatives.push(r);
          }
        });
        
        // 設置初始顯示的備選餐廳（最多2家）
        const initialDisplayed = uniqueAlternatives.slice(0, 2);
        
        // 剩餘未顯示的備選餐廳
        const initialPool = uniqueAlternatives.slice(2);
        
        setDisplayedAlternatives(initialDisplayed);
        setAlternativesPool(initialPool);
        setNoMoreAlternatives(initialPool.length === 0);

        // 首次選擇餐廳時才啟動紙屑動畫效果
        setShowConfetti(true);
      }
    }
  }, [saved, alternatives, votes]); // 添加 alternatives 和 votes 作為依賴項

  // 當showConfetti為true時，設置定時器關閉它
  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [showConfetti]); // 只依賴showConfetti

  // 6秒後顯示問卷 Modal
  useEffect(() => {
    if (selected && !surveyOpened) {
      const timer = setTimeout(() => {
        setShowSurveyModal(true);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [selected, surveyOpened]);

  const goToGoogleMaps = (place) => {
    onInteraction?.(); // 觸發互動回調

    // 點擊前往時也顯示問卷 Modal（如果還沒開啟）
    if (!surveyOpened) {
      setShowSurveyModal(true);
    }

    const query = encodeURIComponent(place);
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${query}`,
      "_blank"
    );
  };

  const closeSurveyModal = () => {
    setShowSurveyModal(false);
    setSurveyOpened(true); // 標記為已顯示過，不再彈出
  };

  // 選擇另一家餐廳
  const selectAnother = () => {
    onInteraction?.(); // 觸發互動回調

    if (alternativesPool.length === 0) {
      setNoMoreAlternatives(true);
      return;
    }

    // 從顯示餐廳中移除第一家
    const updatedDisplayed = [...displayedAlternatives.slice(1)];

    // 添加一家尚未顯示的餐廳到顯示列表末尾
    const newRestaurantToDisplay = alternativesPool[0];
    updatedDisplayed.push(newRestaurantToDisplay);

    // 更新剩餘的備選餐廳池
    const updatedPool = alternativesPool.slice(1);

    // 更新狀態
    setDisplayedAlternatives(updatedDisplayed);
    setAlternativesPool(updatedPool);
    setNoMoreAlternatives(updatedPool.length === 0);
  };

  // 渲染小型五彩紙屑
  const renderConfetti = () => {
    return (
      showConfetti && (
        <div className="confetti-container">
          {Array.from({ length: 50 }).map((_, i) => (
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

  if (!selected || typeof selected !== "object") {
    return (
      <div className="recommend-screen">
        <div className="empty-result">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2>😅 沒有選到餐廳</h2>
            <p>可能你今天太挑了，不如放寬一下條件再試試？</p>
            <motion.button
              className="btn-restart"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                onInteraction?.(); // 觸發互動回調
                onRetry();
              }}
            >
              🔄 再試一次
            </motion.button>
            {extraButton && extraButton}
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="recommend-screen">
      {renderConfetti()}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="result-title">
          <span role="img" aria-label="celebration">
            🎉
          </span>{" "}
          命定餐廳就是它！
        </h2>
      </motion.div>

      <motion.div
        className="featured-restaurant"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.7)), url(${
            selected.primaryImage?.image_url ||
            (selected.allImages && selected.allImages[0]?.image_url) ||
            selected.photoURL || // 支援舊格式
            "https://source.unsplash.com/400x300/?restaurant"
          })`,
        }}
      >
        {/* 右上角顯示投票數量 */}
        {(() => {
          console.log("🔍 票數顯示檢查:", {
            hasVotes: !!votes,
            votesKeys: Object.keys(votes || {}),
            selectedId: selected?.id,
            selectedName: selected?.name,
            voteCount: votes?.[selected?.id],
            shouldShow: votes && selected?.id && votes[selected.id]
          });

          // 只有當 votes 對象不為空時才顯示票數
          const hasVotesData = votes && Object.keys(votes).length > 0;
          if (hasVotesData && selected?.id) {
            const voteCount = votes[selected.id] || 0;
            return (
              <div className="votes-badge-top-right">
                <span className="vote-icon">🗳️</span> {voteCount} 票
              </div>
            );
          }
          return null;
        })()}

        <div className="featured-content">
          <h3>{selected.name || "未命名餐廳"}</h3>
          <p className="restaurant-address">{selected.address || "地址未知"}</p>

          <div className="restaurant-details">
            {typeof selected.rating === "number" && (
              <div className="rating-badge">
                <span className="star">⭐</span> {selected.rating.toFixed(1)}
              </div>
            )}

            {(selected.category || selected.type) && (
              <div className="type-badge">{selected.category || selected.type}</div>
            )}
          </div>

          <motion.button
            className="btn-navigate"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => goToGoogleMaps(selected.address || selected.name)}
          >
            <span className="nav-icon">🧭</span> 出發去這裡
          </motion.button>
        </div>
      </motion.div>

      {/* 合併顯示所有備選餐廳 */}
      {displayedAlternatives.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="alternatives-section"
        >
          <div className="alternatives-header">
            <h3>
              <span role="img" aria-label="eyes">
                👀
              </span>{" "}
              其他收藏的餐廳
            </h3>
            <motion.button
              className="btn-shuffle"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={selectAnother}
              disabled={noMoreAlternatives}
            >
              {noMoreAlternatives ? "沒有其他餐廳了" : "🔀 換一家試試"}
            </motion.button>
          </div>

          <AnimatePresence>
            <motion.ul
              className="alternatives-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ staggerChildren: 0.1 }}
            >
              {displayedAlternatives.map((r, index) => (
                <motion.li
                  key={r.id || `alt-${index}`}
                  className="alternative-item"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  {/* 右上角顯示投票數量 - 只有當有投票數據時才顯示 */}
                  {(() => {
                    const hasVotesData = votes && Object.keys(votes).length > 0;
                    if (hasVotesData && r.id) {
                      const voteCount = votes[r.id] || 0;
                      return (
                        <div className="alternative-votes-badge-top-right">
                          <span className="vote-icon">🗳️</span> {voteCount}
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="alternative-content">
                    <div className="alternative-info">
                      <h4>{r.name || "未命名"}</h4>
                      <p>{r.address || "地址未知"}</p>
                      <div className="alternative-badges">
                        {typeof r.rating === "number" && (
                          <span className="mini-badge rating">
                            ⭐ {r.rating.toFixed(1)}
                          </span>
                        )}
                        {(r.category || r.type) && (
                          <span className="mini-badge type">{r.category || r.type}</span>
                        )}
                      </div>
                    </div>
                    <motion.button
                      className="btn-mini-navigate"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => goToGoogleMaps(r.address || r.name)}
                    >
                      🧭 出發
                    </motion.button>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          </AnimatePresence>

          {alternativesPool.length > 0 && (
            <p className="more-alternatives">
              還有 {alternativesPool.length} 家其他選擇 ...
            </p>
          )}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="retry-container"
      >
        <motion.button
          className="btn-restart"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            onInteraction?.(); // 觸發互動回調
            onRetry();
          }}
        >
          🔁 再試一次
        </motion.button>
        {extraButton && (
          <div style={{ marginTop: "0.5rem" }}>{extraButton}</div>
        )}
      </motion.div>

      {/* 問卷 Modal */}
      <AnimatePresence>
        {showSurveyModal && (
          <motion.div
            className="survey-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSurveyModal}
          >
            <motion.div
              className="survey-modal-container"
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="survey-modal-header">
                <h3>📋 使用體驗問卷</h3>
                <button className="survey-modal-close" onClick={closeSurveyModal}>
                  ✕
                </button>
              </div>
              <div className="survey-modal-content">
                <iframe
                  src="https://docs.google.com/forms/d/e/1FAIpQLSdDTU6lep67AM5MlApYgG0mR6HhXhfCK3IFHbubuZ3NEIQCrw/viewform?embedded=true"
                  width="100%"
                  height="600"
                  frameBorder="0"
                  marginHeight="0"
                  marginWidth="0"
                  title="使用體驗問卷"
                >
                  載入中…
                </iframe>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}