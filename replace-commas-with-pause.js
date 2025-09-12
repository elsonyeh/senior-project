import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4ODYzOSwiZXhwIjoyMDcyODY0NjM5fQ.WfCZzjg5QEW3E-R9BKuj4iTXU07yHQk_xXZvBwfdyB4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function replaceCommasWithPause() {
  try {
    console.log('🔄 開始將 category 欄位中的逗號替換為頓號...');
    
    // 查詢所有餐廳的 category
    const { data: restaurants, error } = await supabase
      .from('restaurants')
      .select('id, name, category')
      .order('name');

    if (error) {
      console.error('❌ 查詢失敗:', error.message);
      return;
    }

    console.log(`📋 分析 ${restaurants.length} 間餐廳的 category...\n`);
    
    let needsUpdateCount = 0;
    let noChangeCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    // 先統計需要更新的餐廳數
    const restaurantsToUpdate = restaurants.filter(restaurant => {
      const category = restaurant.category || '';
      return category.includes('，') || category.includes(',');
    });

    console.log(`📊 統計結果:`);
    console.log(`需要更新: ${restaurantsToUpdate.length} 間餐廳`);
    console.log(`無需更新: ${restaurants.length - restaurantsToUpdate.length} 間餐廳\n`);

    if (restaurantsToUpdate.length === 0) {
      console.log('🎉 所有餐廳的 category 都不包含逗號，無需更新！');
      return;
    }

    console.log('🔧 開始更新餐廳 category...\n');

    // 逐一更新每間餐廳
    for (const restaurant of restaurantsToUpdate) {
      try {
        const originalCategory = restaurant.category || '';
        
        // 將中文逗號 "，" 和英文逗號 "," 都替換為頓號 "、"
        const updatedCategory = originalCategory
          .replace(/，/g, '、')
          .replace(/,/g, '、');
        
        // 更新餐廳 category
        const { error: updateError } = await supabase
          .from('restaurants')
          .update({ category: updatedCategory })
          .eq('id', restaurant.id);

        if (updateError) {
          console.error(`❌ 更新 ${restaurant.name} 失敗:`, updateError.message);
          errorCount++;
        } else {
          console.log(`✅ 已更新 ${restaurant.name}:`);
          console.log(`   舊: "${originalCategory}"`);
          console.log(`   新: "${updatedCategory}"`);
          updatedCount++;
        }

        // 避免 API 頻率限制
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (restaurantError) {
        console.error(`❌ 處理餐廳 ${restaurant.name} 時發生錯誤:`, restaurantError.message);
        errorCount++;
      }
    }

    console.log('\n📊 更新完成統計:');
    console.log(`✅ 成功更新: ${updatedCount} 間餐廳`);
    console.log(`❌ 更新失敗: ${errorCount} 間餐廳`);

    // 驗證更新結果
    console.log('\n🔍 驗證更新結果...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('restaurants')
      .select('name, category')
      .limit(10);

    if (verifyError) {
      console.error('❌ 驗證查詢失敗:', verifyError.message);
    } else {
      console.log('✅ 前 10 間餐廳的更新結果:');
      verifyData.forEach(restaurant => {
        const hasComma = (restaurant.category || '').includes('，') || (restaurant.category || '').includes(',');
        const hasPause = (restaurant.category || '').includes('、');
        
        console.log(`  ${hasComma ? '❌' : hasPause ? '✅' : '⚪'} ${restaurant.name}: "${restaurant.category}"`);
      });
    }

    // 最終檢查是否還有逗號
    const { data: finalCheck, error: finalError } = await supabase
      .from('restaurants')
      .select('name, category')
      .or('category.like.%，%,category.like.%,%');

    if (!finalError) {
      if (finalCheck.length === 0) {
        console.log('\n🎉 所有餐廳的 category 已成功將逗號替換為頓號！');
      } else {
        console.log(`\n⚠️ 仍有 ${finalCheck.length} 間餐廳的 category 包含逗號:`);
        finalCheck.forEach(restaurant => {
          console.log(`  - ${restaurant.name}: "${restaurant.category}"`);
        });
      }
    }

  } catch (error) {
    console.error('💥 替換過程發生錯誤:', error);
  }
}

// 執行替換
console.log('🚀 開始逗號替換頓號程序...');
replaceCommasWithPause()
  .then(() => {
    console.log('🎉 替換程序完成！');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 程序執行失敗:', error);
    process.exit(1);
  });