import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4ODYzOSwiZXhwIjoyMDcyODY0NjM5fQ.WfCZzjg5QEW3E-R9BKuj4iTXU07yHQk_xXZvBwfdyB4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function cleanDescription(description) {
  if (!description) return description;
  
  let cleanedDescription = description;
  
  // 移除各種格式的建議人數
  cleanedDescription = cleanedDescription
    // 移除 "| 建議人數：1~4" 格式
    .replace(/\s*\|\s*建議人數[：:]\s*\d+~\d+/g, '')
    // 移除 "| 1~4人" 格式
    .replace(/\s*\|\s*\d+~\d+\s*人/g, '')
    // 移除 "| 1~4" 格式
    .replace(/\s*\|\s*\d+~\d+/g, '')
    // 移除 "建議人數：1~4 |" 格式
    .replace(/建議人數[：:]\s*\d+~\d+\s*\|\s*/g, '')
    // 移除開頭的 "|"
    .replace(/^\s*\|\s*/, '')
    // 移除結尾的 "|"
    .replace(/\s*\|\s*$/, '')
    // 清理多餘的空白
    .trim();
  
  return cleanedDescription;
}

async function cleanAllDescriptions() {
  try {
    console.log('🧹 開始清理所有餐廳的 description 欄位...');
    
    // 查詢所有餐廳
    const { data: restaurants, error } = await supabase
      .from('restaurants')
      .select('id, name, description')
      .order('name');

    if (error) {
      console.error('❌ 查詢失敗:', error.message);
      return;
    }

    console.log(`📋 處理 ${restaurants.length} 間餐廳...\n`);
    
    let successCount = 0;
    let errorCount = 0;
    let noChangeCount = 0;

    for (const restaurant of restaurants) {
      try {
        const originalDescription = restaurant.description || '';
        const cleanedDescription = cleanDescription(originalDescription);
        
        // 檢查是否有變更
        if (originalDescription === cleanedDescription) {
          console.log(`⏭️ ${restaurant.name}: 無需變更`);
          noChangeCount++;
          continue;
        }
        
        // 更新餐廳描述
        const { error: updateError } = await supabase
          .from('restaurants')
          .update({ description: cleanedDescription })
          .eq('id', restaurant.id);

        if (updateError) {
          console.error(`❌ 更新 ${restaurant.name} 失敗:`, updateError.message);
          errorCount++;
        } else {
          console.log(`✅ 已清理 ${restaurant.name}:`);
          console.log(`   舊: "${originalDescription}"`);
          console.log(`   新: "${cleanedDescription}"`);
          successCount++;
        }

        // 避免 API 頻率限制
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (restaurantError) {
        console.error(`❌ 處理餐廳 ${restaurant.name} 時發生錯誤:`, restaurantError.message);
        errorCount++;
      }
    }

    console.log('\n📊 清理完成統計:');
    console.log(`✅ 成功清理: ${successCount} 間餐廳`);
    console.log(`⏭️ 無需變更: ${noChangeCount} 間餐廳`);
    console.log(`❌ 清理失敗: ${errorCount} 間餐廳`);

    // 驗證清理結果
    console.log('\n🔍 驗證清理結果...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('restaurants')
      .select('name, description')
      .limit(10);

    if (verifyError) {
      console.error('❌ 驗證查詢失敗:', verifyError.message);
    } else {
      console.log('✅ 前 10 間餐廳的清理結果:');
      verifyData.forEach(restaurant => {
        const hasOldFormat = restaurant.description && 
          (restaurant.description.includes('建議人數') || 
           restaurant.description.match(/\|\s*\d+~\d+/));
        
        console.log(`  ${hasOldFormat ? '❌' : '✅'} ${restaurant.name}: "${restaurant.description}"`);
      });
    }

    // 最終檢查
    const { data: finalCheck, error: finalError } = await supabase
      .from('restaurants')
      .select('name, description')
      .or('description.like.%建議人數%,description.like.%| 1~%,description.like.%| 5~%');

    if (!finalError) {
      if (finalCheck.length === 0) {
        console.log('\n🎉 所有餐廳的 description 已成功清理！');
      } else {
        console.log(`\n⚠️ 仍有 ${finalCheck.length} 間餐廳的描述可能需要手動檢查:`);
        finalCheck.forEach(restaurant => {
          console.log(`  - ${restaurant.name}: "${restaurant.description}"`);
        });
      }
    }

  } catch (error) {
    console.error('💥 清理過程發生錯誤:', error);
  }
}

// 執行清理
console.log('🚀 開始餐廳描述清理程序...');
cleanAllDescriptions()
  .then(() => {
    console.log('🎉 清理程序完成！');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 程序執行失敗:', error);
    process.exit(1);
  });