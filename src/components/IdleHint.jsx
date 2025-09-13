import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './IdleHint.css';

const IdleHint = ({ show, phase, onDismiss }) => {
  const getHintContent = (phase) => {
    switch (phase) {
      case 'selectMode':
        return {
          title: "選擇模式開始！",
          subtitle: "左滑選擇多人模式，右滑選擇單人模式",
          icon: "🎯",
          action: "試試滑動卡片"
        };
      case 'questions':
        return {
          title: "回答問題找餐廳",
          subtitle: "左右滑動選擇你的偏好",
          icon: "❓",
          action: "滑動卡片選擇"
        };
      case 'funQuestions':
        return {
          title: "繼續回答趣味問題",
          subtitle: "這些問題幫助我們更了解你的喜好",
          icon: "🎪",
          action: "滑動選擇答案"
        };
      case 'restaurants':
        return {
          title: "選擇你喜歡的餐廳",
          subtitle: "右滑收藏，左滑跳過",
          icon: "🍽️",
          action: "滑動做選擇"
        };
      default:
        return {
          title: "繼續操作",
          subtitle: "滑動卡片進行選擇",
          icon: "👆",
          action: "滑動繼續"
        };
    }
  };

  const hintContent = getHintContent(phase);

  return (
    <AnimatePresence>
      {show && (
        <div className="idle-hint-container">
          {/* 背景遮罩 */}
          <motion.div
            className="idle-hint-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDismiss}
          />
          
          {/* 提示內容 */}
          <motion.div
            className="idle-hint-modal"
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0
            }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 25
            }}
          >
            <motion.div
              className="hint-icon"
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatType: "loop"
              }}
            >
              {hintContent.icon}
            </motion.div>
            
            <h3 className="hint-title">{hintContent.title}</h3>
            <p className="hint-subtitle">{hintContent.subtitle}</p>
            
            {/* 滑動指示動畫 */}
            <div className="swipe-animation">
              <motion.div
                className="swipe-demo"
                animate={{
                  x: [-30, 30, -30],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "loop",
                  ease: "easeInOut"
                }}
              >
                👆
              </motion.div>
              <div className="swipe-arrows">
                <motion.span
                  className="arrow-left"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                >
                  ←
                </motion.span>
                <motion.span
                  className="arrow-right"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                >
                  →
                </motion.span>
              </div>
            </div>
            
            <motion.button
              className="hint-action-button"
              onClick={onDismiss}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {hintContent.action}
            </motion.button>
            
            {/* 關閉按鈕 */}
            <button className="hint-close" onClick={onDismiss}>
              ✕
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default IdleHint;