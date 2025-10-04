import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoCloseOutline, IoInformationCircleOutline } from 'react-icons/io5';
import './SponsoredAdModal.css';

export default function SponsoredAdModal({ ad, onClose }) {
  const [imageLoaded, setImageLoaded] = useState(false);

  if (!ad) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="sponsored-ad-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="sponsored-ad-modal"
          initial={{ scale: 0.8, y: 50, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.8, y: 50, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 關閉按鈕 */}
          <button className="sponsored-ad-close" onClick={onClose} aria-label="關閉">
            <IoCloseOutline />
          </button>

          {/* 贊助標籤 */}
          <div className="sponsored-badge">
            <IoInformationCircleOutline />
            <span>贊助商廣告</span>
          </div>

          {/* 廣告圖片 */}
          <div className="sponsored-ad-image-container">
            {!imageLoaded && (
              <div className="sponsored-ad-loading">
                <div className="loading-spinner"></div>
              </div>
            )}
            <img
              src={ad.image}
              alt={ad.name}
              className="sponsored-ad-image"
              onLoad={() => setImageLoaded(true)}
              style={{ display: imageLoaded ? 'block' : 'none' }}
            />
          </div>

          {/* 廣告內容 */}
          <div className="sponsored-ad-content">
            <div className="sponsored-ad-category">{ad.category}</div>
            <h3 className="sponsored-ad-title">{ad.name}</h3>
            <p className="sponsored-ad-tagline">{ad.tagline}</p>
          </div>

          {/* 關閉按鈕（底部） */}
          <motion.button
            className="sponsored-ad-close-btn"
            onClick={onClose}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            關閉
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
