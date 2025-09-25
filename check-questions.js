// 簡單檢查目前問題設定的腳本
import { supabase } from './src/services/supabaseService.js';

async function checkQuestions() {
  console.log('📊 檢查目前問題設定...');

  try {
    // 檢查所有問題的 mode 分布
    const { data: allQuestions, error } = await supabase
      .from('questions')
      .select('id, question_text, mode, is_active')
      .eq('is_active', true)
      .order('mode, question_text');

    if (error) throw error;

    console.log(`\n總共找到 ${allQuestions.length} 個活躍問題:\n`);

    // 按 mode 分組
    const groupedByMode = allQuestions.reduce((acc, q) => {
      if (!acc[q.mode]) acc[q.mode] = [];
      acc[q.mode].push(q);
      return acc;
    }, {});

    Object.entries(groupedByMode).forEach(([mode, questions]) => {
      console.log(`\n🏷️ Mode: ${mode} (${questions.length} 個問題)`);
      questions.forEach(q => {
        const preview = q.question_text.length > 50
          ? q.question_text.substring(0, 50) + '...'
          : q.question_text;
        console.log(`   • ID ${q.id}: ${preview}`);
      });
    });

    // 特別檢查包含 "一個人" 或 "朋友" 的問題
    const singlePersonQuestions = allQuestions.filter(q =>
      q.question_text.includes('一個人') ||
      q.question_text.includes('朋友') ||
      q.question_text.includes('單人') ||
      q.question_text.includes('多人')
    );

    if (singlePersonQuestions.length > 0) {
      console.log('\n🚨 需要檢查的 "一個人/朋友" 問題:');
      singlePersonQuestions.forEach(q => {
        console.log(`   • ID ${q.id}, Mode: ${q.mode}, 問題: ${q.question_text}`);
      });
    }

  } catch (error) {
    console.error('❌ 檢查失敗:', error);
  }
}

checkQuestions();