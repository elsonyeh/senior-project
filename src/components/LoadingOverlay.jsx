import React from 'react';
import { motion } from 'framer-motion';
import './LoadingOverlay.css';

const LoadingOverlay = ({ 
  message = "載入中...", 
  subMessage = "",
  show = true 
}) => {
  if (!show) return null;

  return (
    <motion.div
      className="loading-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="loading-content">
        {/* 主要載入動畫 */}
        <div className="loading-spinner">
          <motion.div
            className="spinner-circle"
            animate={{ rotate: 360 }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "linear"
            }}
          />
          <div className="spinner-inner">
            <motion.span 
              className="spinner-icon"
              animate={{ 
                scale: [1, 1.1, 1],
                opacity: [0.7, 1, 0.7]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              🍽️
            </motion.span>
          </div>
        </div>
        
        {/* 載入訊息 */}
        <motion.div
          className="loading-text"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="loading-message">{message}</h3>
          {subMessage && (
            <motion.p 
              className="loading-sub-message"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {subMessage}
            </motion.p>
          )}
        </motion.div>

        {/* 脈動點點 */}
        <div className="loading-dots">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="loading-dot"
              animate={{
                y: [-10, 0, -10],
                opacity: [0.4, 1, 0.4]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.2
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default LoadingOverlay;