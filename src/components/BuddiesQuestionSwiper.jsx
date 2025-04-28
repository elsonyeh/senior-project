import React, { useState, useEffect } from 'react';
import socket from '../services/socket';
import QuestionSwiperMotionSingle from './QuestionSwiperMotionSingle';

export default function BuddiesQuestionSwiper({ roomId, questions, onComplete }) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [waiting, setWaiting] = useState(false);
  const [questionTexts, setQuestionTexts] = useState([]);

  useEffect(() => {
    // 獲取所有問題的文本，用於後續處理
    if (Array.isArray(questions)) {
      const texts = questions.map(q => q.question);
      setQuestionTexts(texts);
    }
  }, [questions]);

  useEffect(() => {
    socket.on('nextQuestion', (nextIndex) => {
      setWaiting(false);
      setQuestionIndex(nextIndex);
    });

    socket.on('groupRecommendations', (recs) => {
      // 將問題文本和答案一起傳遞給完成處理函數
      const answersArray = Object.values(answers);
      onComplete({ answers: answersArray, questionTexts }, recs);
    });

    return () => {
      socket.off('nextQuestion');
      socket.off('groupRecommendations');
    };
  }, [answers, questionTexts, onComplete]);

  const handleAnswer = (answer) => {
    setWaiting(true);
    setAnswers((prev) => ({ ...prev, [questionIndex]: answer }));
    
    // 獲取當前問題的文本
    const questionText = questions[questionIndex]?.question || "";
    
    socket.emit('submitAnswer', {
      roomId,
      index: questionIndex,
      answer,
      questionText // 添加問題文本信息
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