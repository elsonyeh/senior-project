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
}) {
  const [selected, setSelected] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [otherSaved, setOtherSaved] = useState([]);
  const [displayedRestaurants, setDisplayedRestaurants] = useState([]);
  const [displayedAlternatives, setDisplayedAlternatives] = useState([]); // 備選餐廳列表

  // 初始化時選擇第一個餐廳並設置動畫效果
  useEffect(() => {
    if (saved.length > 0) {
      // 防止透過Object.is比較相同的餐廳而造成無限循環
      const selectedRestaurant = saved[0];

      // 只有當selected不存在或id不同時才更新，避免無限循環
      if (!selected || selected.id !== selectedRestaurant.id) {
        // 使用第一個作為主選餐廳（可能是投票最高的）
        setSelected(selectedRestaurant);

        // 移除與所選餐廳相同的項目
        const remainingRestaurants = saved.filter(
          (r) => r && r.id && r.id !== selectedRestaurant.id
        );
        setOtherSaved(remainingRestaurants);

        // 設置初始顯示的餐廳（最多顯示3家）
        setDisplayedRestaurants(remainingRestaurants.slice(0, 3));

        // 設置顯示的備選餐廳（最多顯示5家），按投票數排序
        if (Array.isArray(alternatives)) {
          // 根據投票數排序備選餐廳
          const sortedAlternatives = [...alternatives].sort((a, b) => {
            const votesA = votes[a.id] || 0;
            const votesB = votes[b.id] || 0;
            return votesB - votesA; // 降序排列
          });

          setDisplayedAlternatives(sortedAlternatives.slice(0, 5));
        }

        // 首次選擇餐廳時才啟動紙屑動畫效果
        setShowConfetti(true);
      }
    }
  }, [saved, votes]); // 添加votes作為依賴項，以便在投票更新時重新排序

  // 當showConfetti為true時，設置定時器關閉它
  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [showConfetti]); // 只依賴showConfetti

  const goToGoogleMaps = (place) => {
    const query = encodeURIComponent(place);
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${query}`,
      "_blank"
    );
  };

  // 選擇另一家餐廳
  const selectAnother = () => {
    if (otherSaved.length === 0 || displayedRestaurants.length === 0) return;

    // 從當前顯示的餐廳中選第一家作為新的精選餐廳
    const newSelected = displayedRestaurants[0];

    // 將當前精選餐廳加入剩餘餐廳列表末尾（如果存在）
    const newOtherSaved = [
      ...otherSaved.filter((r) => r.id !== newSelected.id),
    ];
    if (selected) {
      newOtherSaved.push(selected);
    }

    // 更新已顯示的餐廳列表 - 移除第一家並添加一家新的（如果有的話）
    const newDisplayed = [...displayedRestaurants.slice(1)];

    // 如果剩餘餐廳中有下一家可顯示，則添加到顯示列表中
    const remainingForDisplay = newOtherSaved.filter(
      (r) => !newDisplayed.some((d) => d.id === r.id) && r.id !== newSelected.id
    );

    if (remainingForDisplay.length > 0 && newDisplayed.length < 3) {
      newDisplayed.push(remainingForDisplay[0]);
    }

    // 更新狀態
    setSelected(newSelected);
    setOtherSaved(newOtherSaved);
    setDisplayedRestaurants(newDisplayed);
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
              onClick={onRetry}
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
            selected.photoURL ||
            "https://source.unsplash.com/400x300/?restaurant"
          })`,
        }}
      >
        <div className="featured-content">
          <h3>{selected.name || "未命名餐廳"}</h3>
          <p className="restaurant-address">{selected.address || "地址未知"}</p>

          <div className="restaurant-details">
            {typeof selected.rating === "number" && (
              <div className="rating-badge">
                <span className="star">⭐</span> {selected.rating.toFixed(1)}
              </div>
            )}

            {selected.type && <div className="type-badge">{selected.type}</div>}

            {/* 顯示投票數量 */}
            {votes && votes[selected.id] && (
              <div className="votes-badge">
                <span className="vote-icon">🗳️</span> {votes[selected.id]} 票
              </div>
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

      {/* 收藏餐廳列表 */}
      {displayedRestaurants.length > 0 && (
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
              disabled={displayedRestaurants.length === 0}
            >
              🔀 換一家試試
            </motion.button>
          </div>

          <AnimatePresence>
            <motion.ul
              className="alternatives-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ staggerChildren: 0.1 }}
            >
              {displayedRestaurants.map((r, index) => (
                <motion.li
                  key={r.id}
                  className="alternative-item"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
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
                        {r.type && (
                          <span className="mini-badge type">{r.type}</span>
                        )}
                        {votes && votes[r.id] && (
                          <span className="mini-badge votes">
                            🗳️ {votes[r.id]} 票
                          </span>
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

          {otherSaved.length > displayedRestaurants.length && (
            <p className="more-alternatives">
              還有 {otherSaved.length - displayedRestaurants.length}{" "}
              家其他選擇...
            </p>
          )}
        </motion.div>
      )}

      {/* 備選餐廳列表 - 新增 */}
      {displayedAlternatives.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="alternatives-section other-alternatives"
        >
          <div className="alternatives-header">
            <h3>
              <span role="img" aria-label="magnifier">
                🔍
              </span>{" "}
              其他備選餐廳
            </h3>
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
                        {r.type && (
                          <span className="mini-badge type">{r.type}</span>
                        )}
                        {votes && votes[r.id] && (
                          <span className="mini-badge votes">
                            🗳️ {votes[r.id]} 票
                          </span>
                        )}
                      </div>
                    </div>
                    <motion.button
                      className="btn-mini-navigate secondary"
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
          onClick={onRetry}
        >
          🔁 再試一次
        </motion.button>
        {extraButton && (
          <div style={{ marginTop: "0.5rem" }}>{extraButton}</div>
        )}
      </motion.div>
    </div>
  );
}
