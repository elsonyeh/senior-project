import React, { useState, useEffect } from 'react';
import socket from '../services/socket';
import QuestionSwiperMotionSingle from './QuestionSwiperMotionSingle';

export default function BuddiesQuestionSwiper({ roomId, questions, onComplete }) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    socket.on('nextQuestion', (nextIndex) => {
      setWaiting(false);
      setQuestionIndex(nextIndex);
    });

    socket.on('groupRecommendations', (recs) => {
      onComplete(answers, recs);
    });

    return () => {
      socket.off('nextQuestion');
      socket.off('groupRecommendations');
    };
  }, [answers, onComplete]);

  const handleAnswer = (answer) => {
    setWaiting(true);
    setAnswers((prev) => ({ ...prev, [questionIndex]: answer }));
    socket.emit('submitAnswer', {
      roomId,
      index: questionIndex,
      answer
    });
  };

  if (questionIndex >= questions.length) {
    return <div>✅ 所有題目都完成，請稍候...</div>;
  }

  return (
    <div>
      {waiting ? (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <p>🕐 等待其他人完成第 {questionIndex + 1} 題...</p>
        </div>
      ) : (
        <QuestionSwiperMotionSingle
          question={questions[questionIndex]}
          onAnswer={handleAnswer}
        />
      )}
    </div>
  );
}
