// QuestionLoader.jsx - Loads questions from Supabase and transforms them for existing components
import React, { useState, useEffect } from 'react';
import { getQuestionsByMode, filterQuestionsByDependencies } from '../services/questionService';
import logger from "../utils/logger";

export default function QuestionLoader({ 
  mode = 'swifttaste', 
  onQuestionsLoaded, 
  children 
}) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadQuestions();
  }, [mode]);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const fetchedQuestions = await getQuestionsByMode(mode);
      
      // Transform questions to match the expected format for existing components
      const transformedQuestions = fetchedQuestions.map((q, index) => {
        let dependsOnInfo = null;

        // If this question depends on another, find the dependent question text
        if (q.dependsOn && q.dependsOn.questionId) {
          const dependentQuestion = fetchedQuestions.find(
            dq => dq.id === q.dependsOn.questionId
          );

          if (dependentQuestion) {
            dependsOnInfo = {
              question: dependentQuestion.question,
              answer: q.dependsOn.answer
            };
          }
        }

        return {
          id: q.id,
          text: q.question,
          leftOption: q.options[0]?.option_text || '',
          rightOption: q.options[1]?.option_text || '',
          hasVS: q.question.includes('v.s.'),
          source: 'supabase',
          dependsOn: dependsOnInfo
        };
      });

      logger.info(`Loaded ${transformedQuestions.length} questions for ${mode} mode`);
      setQuestions(transformedQuestions);
      
      if (onQuestionsLoaded) {
        onQuestionsLoaded(transformedQuestions);
      }
    } catch (err) {
      console.error('Failed to load questions:', err);
      setError(err.message);
      
      // Load fallback questions if Supabase fails
      const fallbackQuestions = getFallbackQuestions(mode);
      setQuestions(fallbackQuestions);
      
      if (onQuestionsLoaded) {
        onQuestionsLoaded(fallbackQuestions);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fallback questions in case Supabase is down
  const getFallbackQuestions = (mode) => {
    if (mode === 'buddies') {
      return [
        { id: 'fun-1', text: '側背包 v.s. 後背包', leftOption: '側背包', rightOption: '後背包', hasVS: true },
        { id: 'fun-2', text: '夏天沒有冷氣 v.s. 冬天只能穿短袖', leftOption: '夏天沒有冷氣', rightOption: '冬天只能穿短袖', hasVS: true },
        { id: 'fun-3', text: '你是Ｉ人還是Ｅ人', leftOption: 'Ｉ人', rightOption: 'Ｅ人', hasVS: false },
        { id: 'fun-4', text: '貓派v.s.狗派', leftOption: '貓派', rightOption: '狗派', hasVS: true }
      ];
    } else {
      return [
        { id: 'basic-1', text: '今天是一個人還是有朋友？', leftOption: '單人', rightOption: '多人' },
        { id: 'basic-2', text: '想吃奢華點還是平價？', leftOption: '奢華美食', rightOption: '平價美食' },
        { id: 'basic-3', text: '想吃正餐還是想喝飲料？', leftOption: '吃', rightOption: '喝' },
        { 
          id: 'basic-4', 
          text: '吃一點還是吃飽？', 
          leftOption: '吃一點', 
          rightOption: '吃飽',
          dependsOn: { question: '想吃正餐還是想喝飲料？', answer: '吃' }
        },
        { 
          id: 'basic-5', 
          text: '想吃辣的還是不辣？', 
          leftOption: '辣', 
          rightOption: '不辣',
          dependsOn: { question: '想吃正餐還是想喝飲料？', answer: '吃' }
        }
      ];
    }
  };

  if (loading) {
    return (
      <div className="question-loader">
        <div className="loading-spinner"></div>
        <p>載入問題中...</p>
      </div>
    );
  }

  if (error && questions.length === 0) {
    return (
      <div className="question-loader error">
        <p>問題載入失敗，請重試</p>
        <button onClick={loadQuestions}>重新載入</button>
      </div>
    );
  }

  // If children is provided, render it with questions as props
  if (children && typeof children === 'function') {
    return children({ questions, loading, error, reload: loadQuestions });
  }

  // Otherwise, just render children normally (they should access questions via props or context)
  return children;
}

// Export a hook version for easier use
export const useQuestions = (mode = 'swifttaste') => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const fetchedQuestions = await getQuestionsByMode(mode);
        
        const transformedQuestions = fetchedQuestions.map((q) => {
          let dependsOnInfo = null;

          // If this question depends on another, find the dependent question text
          if (q.dependsOn && q.dependsOn.questionId) {
            const dependentQuestion = fetchedQuestions.find(
              dq => dq.id === q.dependsOn.questionId
            );

            if (dependentQuestion) {
              dependsOnInfo = {
                question: dependentQuestion.question,
                answer: q.dependsOn.answer
              };
            }
          }

          return {
            id: q.id,
            text: q.question,
            leftOption: q.options[0]?.option_text || '',
            rightOption: q.options[1]?.option_text || '',
            hasVS: q.question.includes('v.s.'),
            source: 'supabase',
            dependsOn: dependsOnInfo
          };
        });

        setQuestions(transformedQuestions);
      } catch (err) {
        console.error('Failed to load questions:', err);
        setError(err.message);
        
        // Load fallback questions
        const fallbackQuestions = mode === 'buddies' ? [
          { id: 'fun-1', text: '側背包 v.s. 後背包', leftOption: '側背包', rightOption: '後背包', hasVS: true },
          { id: 'fun-2', text: '你是Ｉ人還是Ｅ人', leftOption: 'Ｉ人', rightOption: 'Ｅ人', hasVS: false }
        ] : [
          { id: 'basic-1', text: '今天是一個人還是有朋友？', leftOption: '單人', rightOption: '多人' },
          { id: 'basic-2', text: '想吃奢華點還是平價？', leftOption: '奢華美食', rightOption: '平價美食' }
        ];
        
        setQuestions(fallbackQuestions);
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, [mode]);

  return { questions, loading, error };
};