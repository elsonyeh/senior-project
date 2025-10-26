// Question Service for Supabase
// Handles fetching and managing questions for both SwiftTaste and Buddies modes

import { supabase } from './supabaseService.js';
import logger from "../utils/logger";

/**
 * Get basic questions for SwiftTaste mode (all basic questions)
 * @returns {Promise<Array>} Array of basic questions
 */
export const getBasicQuestionsForSwiftTaste = async () => {
  try {
    logger.info('Loading basic questions for SwiftTaste mode');
    const { data, error } = await supabase
      .from('questions_with_options')
      .select('*')
      .in('mode', ['swifttaste', 'both'])
      .order('display_order');
    
    if (error) throw error;
    
    // 過濾出基本問題並轉換格式
    const filteredQuestions = data.filter(q => {
      const questionText = q.question_text || q.question;
      // 基本問題包含：一個人/朋友、奢華/平價、吃/喝、吃一點/吃飽、辣/不辣
      return questionText && (questionText.includes('一個人') || 
             questionText.includes('朋友') ||
             questionText.includes('奢華') ||
             questionText.includes('平價') ||
             questionText.includes('正餐') ||
             questionText.includes('飲料') ||
             questionText.includes('吃一點') ||
             questionText.includes('吃飽') ||
             questionText.includes('辣的') ||
             questionText.includes('不辣'));
    });

    // 轉換為組件需要的格式
    const basicQuestions = filteredQuestions.map((q, index) => ({
      id: q.question_id || q.id,
      text: q.question_text,
      question: q.question_text,
      leftOption: q.options && q.options.length > 0 ? (q.options[0].option_text || '') : '',
      rightOption: q.options && q.options.length > 1 ? (q.options[1].option_text || '') : '',
      source: 'supabase',
      display_order: q.display_order || index,
      dependsOn: q.depends_on_question_id ? {
        questionId: q.depends_on_question_id,
        answer: q.depends_on_answer
      } : null
    }));

    logger.info(`Loaded ${basicQuestions.length} basic questions for SwiftTaste`);
    logger.info('Basic questions:', basicQuestions.map(q => q.text));
    return basicQuestions;
  } catch (error) {
    console.error('Error loading basic questions for SwiftTaste:', error);
    return [];
  }
};

/**
 * Get basic questions for Buddies mode (excludes "一個人還是多人" question)
 * @returns {Promise<Array>} Array of basic questions
 */
export const getBasicQuestionsForBuddies = async () => {
  try {
    logger.info('Loading basic questions for Buddies mode');
    const { data, error } = await supabase
      .from('questions_with_options')
      .select('*')
      .in('mode', ['buddies', 'both'])
      .order('display_order');
    
    if (error) throw error;
    
    // 過濾出基本問題，但排除"一個人還是多人"
    const filteredQuestions = data.filter(q => {
      const questionText = q.question_text || q.question;
      if (!questionText) return false;
      
      const isBasicQuestion = questionText.includes('奢華') ||
                             questionText.includes('平價') ||
                             questionText.includes('正餐') ||
                             questionText.includes('飲料') ||
                             questionText.includes('吃一點') ||
                             questionText.includes('吃飽') ||
                             questionText.includes('辣的') ||
                             questionText.includes('不辣');
      
      const isSinglePersonQuestion = questionText.includes('一個人') || questionText.includes('朋友');
      
      return isBasicQuestion && !isSinglePersonQuestion;
    });

    // 轉換為組件需要的格式
    const basicQuestions = filteredQuestions.map((q, index) => ({
      id: q.question_id || q.id,
      text: q.question_text,
      question: q.question_text,
      leftOption: q.options && q.options.length > 0 ? (q.options[0].option_text || '') : '',
      rightOption: q.options && q.options.length > 1 ? (q.options[1].option_text || '') : '',
      source: 'supabase',
      display_order: q.display_order || index,
      dependsOn: q.depends_on_question_id ? {
        questionId: q.depends_on_question_id,
        answer: q.depends_on_answer
      } : null
    }));

    logger.info(`Loaded ${basicQuestions.length} basic questions for Buddies (excluding single/multiple person question)`);
    return basicQuestions;
  } catch (error) {
    console.error('Error loading basic questions for Buddies:', error);
    return [];
  }
};

/**
 * Get fun questions
 * @returns {Promise<Array>} Array of fun questions
 */
export const getFunQuestions = async () => {
  try {
    logger.info('Loading fun questions');
    const { data, error } = await supabase
      .from('questions_with_options')
      .select('*')
      .in('mode', ['buddies', 'both'])
      .order('display_order');
    
    if (error) throw error;
    
    // 過濾出趣味問題（非基本問題）
    const filteredQuestions = data.filter(q => {
      const questionText = q.question_text || q.question;
      if (!questionText) return false;
      
      // 趣味問題：不是基本選擇項目的問題
      const isBasicQuestion = questionText.includes('一個人') ||
                             questionText.includes('朋友') ||
                             questionText.includes('奢華') ||
                             questionText.includes('平價') ||
                             questionText.includes('正餐') ||
                             questionText.includes('飲料') ||
                             questionText.includes('吃一點') ||
                             questionText.includes('吃飽') ||
                             questionText.includes('辣的') ||
                             questionText.includes('不辣');
      
      return !isBasicQuestion;
    });

    // 轉換為組件需要的格式
    const funQuestions = filteredQuestions.map((q, index) => ({
      id: q.question_id || q.id,
      text: q.question_text,
      question: q.question_text,
      leftOption: q.options && q.options.length > 0 ? (q.options[0].option_text || '') : '',
      rightOption: q.options && q.options.length > 1 ? (q.options[1].option_text || '') : '',
      source: 'supabase',
      display_order: q.display_order || index
    }));
    
    logger.info(`Loaded ${funQuestions.length} fun questions`);
    logger.info('Fun questions:', funQuestions.map(q => q.text));
    return funQuestions;
  } catch (error) {
    console.error('Error loading fun questions:', error);
    return [];
  }
};

/**
 * Get questions for a specific mode (legacy function for backward compatibility)
 * @param {string} mode - 'swifttaste', 'buddies', or 'both'
 * @returns {Promise<Array>} Array of questions with options
 */
export const getQuestionsByMode = async (mode = 'both') => {
  try {
    logger.info(`Loading questions for mode: ${mode}`);
    // First try the view, fallback to manual join if view doesn't exist
    let data, error;
    
    try {
      const viewResult = await supabase
        .from('questions_with_options')
        .select('*')
        .in('mode', mode === 'both' ? ['swifttaste', 'buddies', 'both'] : [mode, 'both'])
        .order('display_order');
      
      data = viewResult.data;
      error = viewResult.error;
    } catch (viewError) {
      logger.warn('View not available, using manual query:', viewError);
      
      // Manual query with joins
      const manualResult = await supabase
        .from('questions')
        .select(`
          id,
          question_text,
          mode,
          display_order,
          depends_on_question_id,
          depends_on_answer,
          question_types!inner(name),
          question_options(id, option_text, display_order)
        `)
        .in('mode', mode === 'both' ? ['swifttaste', 'buddies', 'both'] : [mode, 'both'])
        .eq('is_active', true)
        .order('display_order');
      
      data = manualResult.data;
      error = manualResult.error;
    }

    if (error) {
      console.error('Error fetching questions:', error);
      throw error;
    }

    // Transform the data to match the expected format
    const transformed = data.map(question => ({
      id: question.question_id || question.id,
      question: question.question_text,
      text: question.question_text, // For backward compatibility
      options: question.options ?
        (Array.isArray(question.options) ?
          question.options.map(option => typeof option === 'object' ? (option.text || option.option_text) : option)
          : question.options.map(option => option.text || option)
        ) :
        (question.question_options ?
          question.question_options
            .sort((a, b) => a.display_order - b.display_order)
            .map(opt => opt.option_text)
          : []
        ),
      mode: question.mode,
      displayOrder: question.display_order,
      dependsOn: question.depends_on_question_id ? {
        questionId: question.depends_on_question_id,
        answer: question.depends_on_answer
      } : null,
      questionType: question.question_type || (question.question_types?.name)
    }));

    return transformed;
  } catch (error) {
    console.error('Failed to fetch questions:', error);
    
    // Return fallback questions if Supabase fails
    return getFallbackQuestions(mode);
  }
};

/**
 * Get basic questions for SwiftTaste mode
 * @returns {Promise<Array>} Array of basic questions
 */
export const getBasicQuestions = async () => {
  return await getQuestionsByMode('swifttaste');
};

/**
 * Filter questions based on dependencies
 * @param {Array} questions - All questions
 * @param {Object} answers - User answers so far
 * @returns {Array} Filtered questions that should be shown
 */
export const filterQuestionsByDependencies = (questions, answers = {}) => {
  return questions.filter(question => {
    if (!question.dependsOn) return true;

    // Find the question this depends on
    const dependentQuestion = questions.find(q => q.id === question.dependsOn.questionId);
    if (!dependentQuestion) return true;

    // Check if the required answer was given
    const userAnswer = answers[dependentQuestion.id] || answers[dependentQuestion.question];
    return userAnswer === question.dependsOn.answer;
  });
};

// Fallback questions in case Supabase is unavailable
const getFallbackQuestions = (mode) => {
  if (mode === 'buddies') {
    return getFallbackFunQuestions();
  }
  
  return [
    {
      id: 'basic-1',
      question: '今天是一個人還是有朋友？',
      text: '今天是一個人還是有朋友？',
      options: ['單人', '多人']
    },
    {
      id: 'basic-2',
      question: '想吃奢華點還是平價？',
      text: '想吃奢華點還是平價？',
      options: ['奢華美食', '平價美食']
    },
    {
      id: 'basic-3',
      question: '想吃正餐還是想喝飲料？',
      text: '想吃正餐還是想喝飲料？',
      options: ['吃', '喝']
    },
    {
      id: 'basic-4',
      question: '吃一點還是吃飽？',
      text: '吃一點還是吃飽？',
      options: ['吃一點', '吃飽'],
      dependsOn: {
        questionId: 'basic-3',
        answer: '吃'
      }
    },
    {
      id: 'basic-5',
      question: '想吃辣的還是不辣？',
      text: '想吃辣的還是不辣？',
      options: ['辣', '不辣'],
      dependsOn: {
        questionId: 'basic-3',
        answer: '吃'
      }
    }
  ];
};

const getFallbackFunQuestions = () => {
  return [
    { id: 'fun-1', question: '側背包 v.s. 後背包', text: '側背包 v.s. 後背包', options: ['側背包', '後背包'] },
    { id: 'fun-2', question: '夏天沒有冷氣 v.s. 冬天只能穿短袖', text: '夏天沒有冷氣 v.s. 冬天只能穿短袖', options: ['夏天沒有冷氣', '冬天只能穿短袖'] },
    { id: 'fun-3', question: '愛吃的東西都只能嘗一口 v.s. 只能吃不想吃的東西', text: '愛吃的東西都只能嘗一口 v.s. 只能吃不想吃的東西', options: ['愛吃的東西都只能嘗一口', '只能吃不想吃的東西'] },
    { id: 'fun-4', question: '一個人在無人島生活 v.s. 24小時跟一群人待在一起', text: '一個人在無人島生活 v.s. 24小時跟一群人待在一起', options: ['一個人在無人島生活', '24小時跟一群人待在一起'] },
    { id: 'fun-5', question: '黑巧克力 v.s. 白巧克力', text: '黑巧克力 v.s. 白巧克力', options: ['黑巧克力', '白巧克力'] },
    { id: 'fun-6', question: '你是Ｉ人還是Ｅ人', text: '你是Ｉ人還是Ｅ人', options: ['Ｉ人', 'Ｅ人'] },
    { id: 'fun-7', question: '貓派v.s.狗派', text: '貓派v.s.狗派', options: ['貓派', '狗派'] }
  ];
};

// Export all functions
export default {
  getQuestionsByMode,
  getBasicQuestionsForSwiftTaste,
  getBasicQuestionsForBuddies,
  getFunQuestions,
  getBasicQuestions,
  filterQuestionsByDependencies
};