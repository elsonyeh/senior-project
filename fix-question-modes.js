import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://efxbqazlofsjuyprqolp.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmeGJxYXpsb2ZzanV5cHJxb2xwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDc1MDY3OCwiZXhwIjoyMDUwMzI2Njc4fQ.5-rI7c7NVEEY1YEWUYqgIAAQQQ4DdWJYSDjEHzKVpX4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixQuestionModes() {
  console.log('🔧 開始修復問題 mode 設定...');

  try {
    // 1. 查看目前包含 "一個人" 或 "朋友" 的問題
    console.log('\n📊 檢查 "一個人/朋友" 相關問題...');
    const { data: singlePersonQuestions, error: error1 } = await supabase
      .from('questions')
      .select('id, question_text, mode, is_active')
      .or('question_text.ilike.%一個人%,question_text.ilike.%朋友%,question_text.ilike.%單人%,question_text.ilike.%多人%')
      .order('question_text');

    if (error1) throw error1;

    console.log('找到的問題:');
    singlePersonQuestions.forEach(q => {
      console.log(`  - ID: ${q.id}, Mode: ${q.mode}, 問題: ${q.question_text}`);
    });

    // 2. 查看所有 mode = 'buddies' 的問題
    console.log('\n📊 檢查 mode = "buddies" 的問題...');
    const { data: buddiesQuestions, error: error2 } = await supabase
      .from('questions')
      .select('id, question_text, mode, is_active')
      .eq('mode', 'buddies')
      .order('question_text');

    if (error2) throw error2;

    console.log('找到的 Buddies 問題:');
    buddiesQuestions.forEach(q => {
      console.log(`  - ID: ${q.id}, 問題: ${q.question_text}`);
    });

    // 3. 修復 "一個人/朋友" 問題 -> SwiftTaste only
    if (singlePersonQuestions.length > 0) {
      console.log('\n🔧 修復 "一個人/朋友" 問題為 SwiftTaste only...');
      const singlePersonIds = singlePersonQuestions.map(q => q.id);

      const { data: updateResult1, error: error3 } = await supabase
        .from('questions')
        .update({ mode: 'swifttaste' })
        .in('id', singlePersonIds)
        .select();

      if (error3) throw error3;
      console.log(`✅ 成功更新 ${updateResult1.length} 個問題為 SwiftTaste only`);
    }

    // 4. 修復 Buddies 問題 -> Both
    if (buddiesQuestions.length > 0) {
      console.log('\n🔧 修復 Buddies 問題為 Both 模式...');
      const buddiesIds = buddiesQuestions.map(q => q.id);

      const { data: updateResult2, error: error4 } = await supabase
        .from('questions')
        .update({ mode: 'both' })
        .in('id', buddiesIds)
        .select();

      if (error4) throw error4;
      console.log(`✅ 成功更新 ${updateResult2.length} 個問題為 Both 模式`);
    }

    // 5. 驗證修復結果
    console.log('\n📊 驗證修復結果...');
    const { data: summary, error: error5 } = await supabase
      .from('questions')
      .select('mode')
      .eq('is_active', true);

    if (error5) throw error5;

    const modeCounts = summary.reduce((acc, q) => {
      acc[q.mode] = (acc[q.mode] || 0) + 1;
      return acc;
    }, {});

    console.log('問題模式分布:');
    Object.entries(modeCounts).forEach(([mode, count]) => {
      console.log(`  - ${mode}: ${count} 個問題`);
    });

    console.log('\n✅ 問題 mode 修復完成！');

  } catch (error) {
    console.error('❌ 修復失敗:', error);
  }
}

// 執行修復
fixQuestionModes();