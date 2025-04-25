import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./RecommendationResult.css"; // 假設你有一個 CSS 檔案來處理樣式

export default function RecommendationResult({ saved = [], onRetry }) {
  const [selected, setSelected] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [otherSaved, setOtherSaved] = useState([]);
  const [displayedRestaurants, setDisplayedRestaurants] = useState([]);
  
  // 初始化時隨機選擇一個餐廳並設置動畫效果
  useEffect(() => {
    if (saved.length > 0) {
      const randomIndex = Math.floor(Math.random() * saved.length);
      const selectedRestaurant = saved[randomIndex];
      const remainingRestaurants = saved.filter((r) => r && r.id !== selectedRestaurant.id);
      
      setSelected(selectedRestaurant);
      setOtherSaved(remainingRestaurants);
      
      // 設置初始顯示的餐廳（最多顯示3家）
      // 確保只顯示剩餘餐廳中的前三家，不包含已選中的餐廳
      const initialDisplayed = remainingRestaurants.slice(0, 3);
      setDisplayedRestaurants(initialDisplayed);
      
      // 首次選擇餐廳時才啟動紙屑動畫效果
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const goToGoogleMaps = (place) => {
    const query = encodeURIComponent(place);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

  // 選擇另一家餐廳
  const selectAnother = () => {
    if (otherSaved.length === 0) return;
    
    // 從當前顯示的餐廳中移除第一家作為新的精選餐廳
    const newSelected = displayedRestaurants[0];
    
    // 將當前精選餐廳加入剩餘餐廳列表末尾
    const newOtherSaved = [...otherSaved.filter(r => r.id !== newSelected.id)];
    
    // 更新已顯示的餐廳列表 - 移除第一家並添加一家新的（如果有的話）
    const newDisplayed = [...displayedRestaurants.slice(1)];
    
    // 如果剩餘餐廳中有下一家可顯示，則添加到顯示列表中
    const remainingForDisplay = newOtherSaved.filter(
      r => !newDisplayed.some(d => d.id === r.id) && r.id !== selected.id
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
    return showConfetti && (
      <div className="confetti-container">
        {Array.from({ length: 50 }).map((_, i) => (
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
          <span role="img" aria-label="celebration">🎉</span> 命定餐廳就是它！
        </h2>
      </motion.div>
      
      <motion.div 
        className="featured-restaurant"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.7)), url(${selected.photoURL || "https://source.unsplash.com/400x300/?restaurant"})`,
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
            
            {selected.type && (
              <div className="type-badge">{selected.type}</div>
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

      {otherSaved.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="alternatives-section"
        >
          <div className="alternatives-header">
            <h3>
              <span role="img" aria-label="eyes">👀</span> 其他備選餐廳
            </h3>
            <motion.button 
              className="btn-shuffle" 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={selectAnother}
              disabled={otherSaved.length === 0}
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
                          <span className="mini-badge rating">⭐ {r.rating.toFixed(1)}</span>
                        )}
                        {r.type && (
                          <span className="mini-badge type">{r.type}</span>
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
          
          {otherSaved.length > 0 && (
            <p className="more-alternatives">
              {displayedRestaurants.length > 0 
                ? `還有 ${otherSaved.length - displayedRestaurants.length} 家其他選擇...`
                : "已經沒有更多餐廳了"}
            </p>
          )}
          {displayedRestaurants.length === 0 && otherSaved.length === 0 && (
            <p className="no-more-alternatives">
              已經沒有更多餐廳了
            </p>
          )}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
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
      </motion.div>
    </div>
  );
}