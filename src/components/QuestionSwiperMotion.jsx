import React, { useState } from "react";
import "./SwiftTasteCard.css";
import {
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
} from "framer-motion";

export default function QuestionSwiperMotion({ questions, onComplete }) {
  const [cards, setCards] = useState(questions);
  const [answers, setAnswers] = useState({});

  const handleSwipe = (direction, question) => {
    const selectedAnswer =
      direction === "right" ? question.rightOption : question.leftOption;

    const newAnswers = { ...answers, [question.id]: selectedAnswer };
    setAnswers(newAnswers);

    const remainingCards = cards.filter((q) => q.id !== question.id);
    setCards(remainingCards);

    if (remainingCards.length === 0) {
      onComplete(newAnswers);
    }
  };

  return (
    <div className="motion-swiper-container">
      <AnimatePresence mode="wait">
        {cards.slice(0, 1).map((question) => (
          <SwipeQuestionCard
            key={question.id}
            question={question}
            onSwipe={handleSwipe}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function SwipeQuestionCard({ question, onSwipe }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-20, 20]);
  const likeOpacity = useTransform(x, [50, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-150, -50], [1, 0]);

  const handleDragEnd = (event, info) => {
    if (info.offset.x > 150) {
      onSwipe("right", question);
    } else if (info.offset.x < -150) {
      onSwipe("left", question);
    }
  };

  return (
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
      <h3 className="question-text">{question.text}</h3>

      <motion.div className="badge like" style={{ opacity: likeOpacity }}>
        {question.rightOption}
      </motion.div>

      <motion.div className="badge nope" style={{ opacity: nopeOpacity }}>
        {question.leftOption}
      </motion.div>

      <div className="options-display">
        <div className="left">{question.leftOption}</div>
        <div className="right">{question.rightOption}</div>
      </div>
    </motion.div>
  );
}
