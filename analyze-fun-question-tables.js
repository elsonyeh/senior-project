import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4ODYzOSwiZXhwIjoyMDcyODY0NjM5fQ.WfCZzjg5QEW3E-R9BKuj4iTXU07yHQk_xXZvBwfdyB4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function analyzeFunQuestionTables() {
  try {
    console.log('🔍 分析 fun_question_option_tags 和 fun_question_tags_view...\n');
    
    // 檢查 fun_question_option_tags 表結構和數據
    console.log('📋 1. 分析 fun_question_option_tags 表...');
    
    try {
      const { data: optionTagsData, error: optionTagsError } = await supabase
        .from('fun_question_option_tags')
        .select('*')
        .limit(10);
      
      if (optionTagsError) {
        console.error('❌ fun_question_option_tags 查詢失敗:', optionTagsError.message);
      } else {
        console.log(`✅ fun_question_option_tags 找到 ${optionTagsData.length} 筆範例資料:`);
        
        if (optionTagsData.length > 0) {
          // 顯示表結構
          console.log('📝 欄位結構:');
          const columns = Object.keys(optionTagsData[0]);
          columns.forEach(col => {
            const sampleValue = optionTagsData[0][col];
            console.log(`   - ${col}: ${typeof sampleValue} (範例: ${JSON.stringify(sampleValue)})`);
          });
          
          console.log('\n📄 前 5 筆資料範例:');
          optionTagsData.slice(0, 5).forEach((row, index) => {
            console.log(`   ${index + 1}. ${JSON.stringify(row)}`);
          });
        }
        
        // 統計總數
        const { count, error: countError } = await supabase
          .from('fun_question_option_tags')
          .select('*', { count: 'exact', head: true });
        
        if (!countError) {
          console.log(`📊 總筆數: ${count} 筆`);
        }
      }
    } catch (error) {
      console.log('❌ fun_question_option_tags 表不存在或無法訪問');
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
    
    // 檢查 fun_question_tags_view 視圖結構和數據
    console.log('📋 2. 分析 fun_question_tags_view 視圖...');
    
    try {
      const { data: tagsViewData, error: tagsViewError } = await supabase
        .from('fun_question_tags_view')
        .select('*')
        .limit(10);
      
      if (tagsViewError) {
        console.error('❌ fun_question_tags_view 查詢失敗:', tagsViewError.message);
      } else {
        console.log(`✅ fun_question_tags_view 找到 ${tagsViewData.length} 筆範例資料:`);
        
        if (tagsViewData.length > 0) {
          // 顯示表結構
          console.log('📝 欄位結構:');
          const columns = Object.keys(tagsViewData[0]);
          columns.forEach(col => {
            const sampleValue = tagsViewData[0][col];
            console.log(`   - ${col}: ${typeof sampleValue} (範例: ${JSON.stringify(sampleValue)})`);
          });
          
          console.log('\n📄 前 5 筆資料範例:');
          tagsViewData.slice(0, 5).forEach((row, index) => {
            console.log(`   ${index + 1}. ${JSON.stringify(row)}`);
          });
        }
        
        // 統計總數
        const { count, error: countError } = await supabase
          .from('fun_question_tags_view')
          .select('*', { count: 'exact', head: true });
        
        if (!countError) {
          console.log(`📊 總筆數: ${count} 筆`);
        }
      }
    } catch (error) {
      console.log('❌ fun_question_tags_view 視圖不存在或無法訪問');
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
    
    // 比較兩個表的數據重疊情況
    console.log('📋 3. 比較兩表數據關聯性...');
    
    try {
      // 嘗試找共同欄位進行比較
      const { data: table1, error: error1 } = await supabase
        .from('fun_question_option_tags')
        .select('*')
        .limit(5);
      
      const { data: table2, error: error2 } = await supabase
        .from('fun_question_tags_view')
        .select('*')
        .limit(5);
      
      if (!error1 && !error2 && table1 && table2) {
        const columns1 = table1.length > 0 ? Object.keys(table1[0]) : [];
        const columns2 = table2.length > 0 ? Object.keys(table2[0]) : [];
        
        const commonColumns = columns1.filter(col => columns2.includes(col));
        const uniqueToTable1 = columns1.filter(col => !columns2.includes(col));
        const uniqueToTable2 = columns2.filter(col => !columns1.includes(col));
        
        console.log('📊 欄位比較:');
        console.log(`共同欄位: ${commonColumns.length > 0 ? commonColumns.join(', ') : '無'}`);
        console.log(`fun_question_option_tags 獨有: ${uniqueToTable1.length > 0 ? uniqueToTable1.join(', ') : '無'}`);
        console.log(`fun_question_tags_view 獨有: ${uniqueToTable2.length > 0 ? uniqueToTable2.join(', ') : '無'}`);
        
        // 如果有共同欄位，檢查數據重疊
        if (commonColumns.length > 0) {
          console.log('\n🔍 檢查數據重疊情況...');
          // 可以進一步比較具體數據
        }
      }
    } catch (compareError) {
      console.log('⚠️ 無法比較兩表數據:', compareError.message);
    }
    
  } catch (error) {
    console.error('💥 分析過程發生錯誤:', error);
  }
}

// 同時檢查程式碼中的使用情況
async function checkCodeUsage() {
  console.log('\n📋 4. 檢查程式碼使用情況...');
  console.log('⚠️ 需要手動檢查以下檔案中的使用情況:');
  console.log('- src/services/funQuestionTagService.js');
  console.log('- src/data/funQuestionTags.js');
  console.log('- server/ 目錄下的相關檔案');
  console.log('- 搜尋專案中所有使用這兩個表/視圖名稱的地方');
}

// 執行分析
console.log('🚀 開始分析 fun question 相關表和視圖...\n');
analyzeFunQuestionTables()
  .then(() => {
    checkCodeUsage();
    console.log('\n🎉 分析完成！');
  })
  .catch(error => {
    console.error('💥 程序執行失敗:', error);
  });