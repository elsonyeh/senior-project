import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4ODYzOSwiZXhwIjoyMDcyODY0NjM5fQ.WfCZzjg5QEW3E-R9BKuj4iTXU07yHQk_xXZvBwfdyB4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function compareCategoryDescription() {
  try {
    console.log('🔍 比較 category 和 description 欄位...');
    
    // 查詢所有餐廳的 category 和 description
    const { data: restaurants, error } = await supabase
      .from('restaurants')
      .select('id, name, category, description')
      .order('name');

    if (error) {
      console.error('❌ 查詢失敗:', error.message);
      return;
    }

    console.log(`📋 分析 ${restaurants.length} 間餐廳...\n`);
    
    let identicalCount = 0;
    let differentCount = 0;
    let differentCases = [];

    restaurants.forEach((restaurant, index) => {
      const category = restaurant.category || '';
      const description = restaurant.description || '';
      
      console.log(`${index + 1}. ${restaurant.name}:`);
      console.log(`   category: "${category}"`);
      console.log(`   description: "${description}"`);
      
      if (category === description) {
        console.log(`   ✅ 相同`);
        identicalCount++;
      } else {
        console.log(`   ❌ 不同`);
        differentCount++;
        differentCases.push({
          name: restaurant.name,
          category: category,
          description: description
        });
      }
      console.log('');
    });

    console.log('📊 比較結果統計:');
    console.log(`✅ 完全相同: ${identicalCount} / ${restaurants.length} (${((identicalCount/restaurants.length)*100).toFixed(1)}%)`);
    console.log(`❌ 不相同: ${differentCount} / ${restaurants.length} (${((differentCount/restaurants.length)*100).toFixed(1)}%)`);
    
    if (differentCases.length > 0) {
      console.log('\n❌ 不相同的案例:');
      differentCases.forEach((restaurant, index) => {
        console.log(`${index + 1}. ${restaurant.name}`);
        console.log(`   category: "${restaurant.category}"`);
        console.log(`   description: "${restaurant.description}"`);
        console.log('');
      });
    }

    // 檢查標點符號使用情況
    console.log('\n🔍 檢查標點符號使用情況...');
    let commaCount = 0;
    let chineseCommaCount = 0;
    let mixedCount = 0;
    
    restaurants.forEach(restaurant => {
      const text = restaurant.description || '';
      const hasComma = text.includes(',');
      const hasChineseComma = text.includes('，');
      
      if (hasComma && hasChineseComma) {
        mixedCount++;
      } else if (hasComma) {
        commaCount++;
      } else if (hasChineseComma) {
        chineseCommaCount++;
      }
    });
    
    console.log('📈 標點符號統計:');
    console.log(`使用英文逗號 "," 的餐廳: ${commaCount} 間`);
    console.log(`使用中文逗號 "，" 的餐廳: ${chineseCommaCount} 間`);
    console.log(`混合使用的餐廳: ${mixedCount} 間`);
    
    // 顯示一些包含逗號的範例
    const commaExamples = restaurants
      .filter(r => (r.description || '').includes(','))
      .slice(0, 5);
    
    if (commaExamples.length > 0) {
      console.log('\n📝 包含英文逗號的範例:');
      commaExamples.forEach((restaurant, index) => {
        console.log(`${index + 1}. ${restaurant.name}: "${restaurant.description}"`);
      });
    }

  } catch (error) {
    console.error('💥 比較過程發生錯誤:', error);
  }
}

// 執行比較
compareCategoryDescription();