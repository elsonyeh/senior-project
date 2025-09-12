import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4ODYzOSwiZXhwIjoyMDcyODY0NjM5fQ.WfCZzjg5QEW3E-R9BKuj4iTXU07yHQk_xXZvBwfdyB4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTableColumns() {
  try {
    console.log('🔍 檢查 restaurants 表的欄位結構...');
    
    // 使用 RPC 來執行 SQL 查詢表結構
    const { data, error } = await supabase.rpc('get_table_columns', {
      table_name: 'restaurants'
    });

    if (error) {
      // 如果 RPC 不存在，嘗試直接查詢
      console.log('RPC 方法不存在，嘗試直接查詢第一筆資料的欄位...');
      
      const { data: sampleData, error: sampleError } = await supabase
        .from('restaurants')
        .select('*')
        .limit(1);
      
      if (sampleError) {
        console.error('❌ 查詢失敗:', sampleError.message);
        return;
      }
      
      if (sampleData && sampleData.length > 0) {
        const columns = Object.keys(sampleData[0]);
        console.log('📋 current columns:');
        columns.forEach((col, index) => {
          console.log(`  ${index + 1}. ${col}`);
        });
        
        const hasNewColumns = {
          suggested_people: columns.includes('suggested_people'),
          original_photo_url: columns.includes('original_photo_url')
        };
        
        console.log('\n📊 新欄位檢查:');
        console.log(`suggested_people: ${hasNewColumns.suggested_people ? '✅ 存在' : '❌ 不存在'}`);
        console.log(`original_photo_url: ${hasNewColumns.original_photo_url ? '✅ 存在' : '❌ 不存在'}`);
        
        return hasNewColumns;
      }
    } else {
      console.log('表結構:', data);
    }

  } catch (error) {
    console.error('💥 檢查過程發生錯誤:', error);
  }
}

// 執行檢查
checkTableColumns();