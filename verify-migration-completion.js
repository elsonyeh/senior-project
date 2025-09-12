import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4ODYzOSwiZXhwIjoyMDcyODY0NjM5fQ.WfCZzjg5QEW3E-R9BKuj4iTXU07yHQk_xXZvBwfdyB4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyMigrationCompletion() {
  try {
    console.log('🔍 驗證 extra_data 遷移完成狀況...');
    
    // 檢查新欄位數據
    console.log('\n📋 檢查新欄位資料...');
    const { data: newColumnsData, error: newError } = await supabase
      .from('restaurants')
      .select('name, suggested_people, original_photo_url, extra_data')
      .limit(5);

    if (newError) {
      console.error('❌ 查詢新欄位失敗:', newError.message);
      return;
    }

    console.log('✅ 新欄位資料範例:');
    newColumnsData.forEach((restaurant, index) => {
      console.log(`  ${index + 1}. ${restaurant.name}:`);
      console.log(`     - suggested_people: ${restaurant.suggested_people}`);
      console.log(`     - original_photo_url: ${restaurant.original_photo_url ? restaurant.original_photo_url.substring(0, 50) + '...' : 'null'}`);
      console.log(`     - extra_data: ${restaurant.extra_data ? JSON.stringify(restaurant.extra_data) : 'null'}`);
      console.log('');
    });

    // 統計有資料的記錄數
    const { data: statsData, error: statsError } = await supabase
      .from('restaurants')
      .select('suggested_people, original_photo_url')
      .not('suggested_people', 'is', null);

    if (!statsError) {
      const suggestedPeopleCount = statsData.filter(r => r.suggested_people).length;
      const originalPhotoUrlCount = statsData.filter(r => r.original_photo_url).length;
      
      console.log('📊 遷移統計:');
      console.log(`✅ 有 suggested_people 的餐廳: ${suggestedPeopleCount} 間`);
      console.log(`✅ 有 original_photo_url 的餐廳: ${originalPhotoUrlCount} 間`);
    }

    // 檢查 extra_data 是否只剩下不重要的資料
    const { data: extraDataCheck, error: extraError } = await supabase
      .from('restaurants')
      .select('name, extra_data')
      .not('extra_data', 'is', null)
      .limit(5);

    if (!extraError && extraDataCheck) {
      console.log('\n🔍 剩餘 extra_data 內容檢查:');
      let hasImportantData = false;
      
      extraDataCheck.forEach((restaurant, index) => {
        console.log(`  ${index + 1}. ${restaurant.name}:`);
        console.log(`     extra_data: ${JSON.stringify(restaurant.extra_data)}`);
        
        // 檢查是否還有重要資料
        if (restaurant.extra_data) {
          const keys = Object.keys(restaurant.extra_data);
          const importantKeys = keys.filter(key => 
            !['originalUpdatedAt', 'originalCreatedAt'].includes(key)
          );
          if (importantKeys.length > 0) {
            console.log(`     ⚠️ 發現重要資料: ${importantKeys.join(', ')}`);
            hasImportantData = true;
          }
        }
        console.log('');
      });
      
      if (hasImportantData) {
        console.log('⚠️ extra_data 中仍有重要資料，請檢查！');
      } else {
        console.log('✅ extra_data 中只剩下時間戳記等不重要資料，可以安全刪除！');
      }
    }

    console.log('\n🎯 遷移驗證完成！');
    console.log('如果確認無誤，可以執行以下步驟刪除 extra_data 欄位：');
    console.log('1. 在 Supabase Dashboard 的 SQL Editor 中執行：');
    console.log('   ALTER TABLE restaurants DROP COLUMN IF EXISTS extra_data;');
    console.log('2. 或執行準備好的 SQL 檔案：remove-extra-data-column.sql');

  } catch (error) {
    console.error('💥 驗證過程發生錯誤:', error);
  }
}

// 執行驗證
verifyMigrationCompletion();