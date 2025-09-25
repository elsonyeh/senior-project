import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseService';

export default function QuestionModesFixer() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 載入所有問題
  const loadQuestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('id, question_text, mode, is_active')
        .eq('is_active', true)
        .order('mode, question_text');

      if (error) throw error;
      setQuestions(data || []);
    } catch (error) {
      console.error('載入問題失敗:', error);
      setMessage(`載入問題失敗: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 修復問題模式
  const fixQuestionModes = async () => {
    setLoading(true);
    try {
      // 1. 找出包含 "一個人/朋友" 的問題
      const singlePersonQuestions = questions.filter(q =>
        q.question_text.includes('一個人') ||
        q.question_text.includes('朋友') ||
        q.question_text.includes('單人') ||
        q.question_text.includes('多人')
      );

      // 2. 找出 mode = 'buddies' 的問題
      const buddiesQuestions = questions.filter(q => q.mode === 'buddies');

      let updateCount = 0;

      // 修復 "一個人/朋友" 問題為 SwiftTaste only
      if (singlePersonQuestions.length > 0) {
        const { error: error1 } = await supabase
          .from('questions')
          .update({ mode: 'swifttaste' })
          .in('id', singlePersonQuestions.map(q => q.id));

        if (error1) throw error1;
        updateCount += singlePersonQuestions.length;
      }

      // 修復 Buddies 問題為 Both 模式
      if (buddiesQuestions.length > 0) {
        const { error: error2 } = await supabase
          .from('questions')
          .update({ mode: 'both' })
          .in('id', buddiesQuestions.map(q => q.id));

        if (error2) throw error2;
        updateCount += buddiesQuestions.length;
      }

      setMessage(`✅ 成功修復 ${updateCount} 個問題的模式設定！`);

      // 重新載入問題
      await loadQuestions();

    } catch (error) {
      console.error('修復失敗:', error);
      setMessage(`❌ 修復失敗: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  // 按模式分組問題
  const groupedQuestions = questions.reduce((acc, q) => {
    if (!acc[q.mode]) acc[q.mode] = [];
    acc[q.mode].push(q);
    return acc;
  }, {});

  // 找出需要修復的問題
  const singlePersonQuestions = questions.filter(q =>
    q.question_text.includes('一個人') ||
    q.question_text.includes('朋友') ||
    q.question_text.includes('單人') ||
    q.question_text.includes('多人')
  );

  const buddiesOnlyQuestions = questions.filter(q => q.mode === 'buddies');

  const needsFix = singlePersonQuestions.length > 0 || buddiesOnlyQuestions.length > 0;

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px' }}>
      <h2>問題模式修復工具</h2>

      {message && (
        <div style={{
          padding: '1rem',
          margin: '1rem 0',
          borderRadius: '4px',
          backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
          color: message.includes('✅') ? '#155724' : '#721c24',
          border: `1px solid ${message.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          {message}
        </div>
      )}

      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={loadQuestions}
          disabled={loading}
          style={{
            padding: '0.5rem 1rem',
            marginRight: '1rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '載入中...' : '重新載入問題'}
        </button>

        {needsFix && (
          <button
            onClick={fixQuestionModes}
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '修復中...' : '修復問題模式'}
          </button>
        )}
      </div>

      {needsFix && (
        <div style={{
          padding: '1rem',
          marginBottom: '2rem',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '4px'
        }}>
          <h3>🚨 發現需要修復的問題:</h3>

          {singlePersonQuestions.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <h4>需要改為 SwiftTaste only 的問題 ({singlePersonQuestions.length} 個):</h4>
              <ul>
                {singlePersonQuestions.map(q => (
                  <li key={q.id}>
                    ID {q.id} (目前模式: {q.mode}): {q.question_text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {buddiesOnlyQuestions.length > 0 && (
            <div>
              <h4>需要改為 Both 模式的問題 ({buddiesOnlyQuestions.length} 個):</h4>
              <ul>
                {buddiesOnlyQuestions.map(q => (
                  <li key={q.id}>
                    ID {q.id}: {q.question_text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div>
        <h3>目前問題模式分布:</h3>
        {Object.entries(groupedQuestions).map(([mode, questions]) => (
          <div key={mode} style={{
            marginBottom: '2rem',
            padding: '1rem',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}>
            <h4>Mode: {mode} ({questions.length} 個問題)</h4>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {questions.map(q => (
                <div key={q.id} style={{
                  padding: '0.5rem',
                  margin: '0.25rem 0',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '2px',
                  fontSize: '0.9rem'
                }}>
                  <strong>ID {q.id}:</strong> {q.question_text}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}