import React from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import "./SwiftTasteCard.css";

export default function ModeSwiperMotion({ onSelect }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-20, 20]);
  const soloOpacity = useTransform(x, [50, 150], [0, 1]);
  const buddiesOpacity = useTransform(x, [-150, -50], [1, 0]);

  const handleDragEnd = (event, info) => {
    if (info.offset.x > 150) {
      onSelect("right"); // 自己吃
    } else if (info.offset.x < -150) {
      onSelect("left"); // 一起吃
    }
  };

  return (
    <div className="motion-swiper-container">
      <motion.div
        className="motion-card"
        style={{ x, rotate }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={handleDragEnd}
        initial={{ x: 0, opacity: 0, scale: 0.95 }} // ✅ 不偏移、輕微縮小
        animate={{ x: 0, opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.5 }}
        transition={{ duration: 0.25, ease: "easeOut" }} // ✅ 顯示更快
      >
        <h2>今天想怎麼吃？</h2>
        <div className="mode-choice-row">
          <div className="mode-choice left">
            <p>👥 一起選</p>
            <small>拉朋友一起選餐廳！</small>
          </div>
          <div className="mode-choice right">
            <p>🙋 自己吃</p>
            <small>快速單人推薦</small>
          </div>
        </div>

        <motion.div className="badge like" style={{ opacity: soloOpacity }}>
          自己吃 🙋
        </motion.div>

        <motion.div className="badge nope" style={{ opacity: buddiesOpacity }}>
          一起吃 👥
        </motion.div>
      </motion.div>
    </div>
  );
}
