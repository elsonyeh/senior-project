import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4ODYzOSwiZXhwIjoyMDcyODY0NjM5fQ.WfCZzjg5QEW3E-R9BKuj4iTXU07yHQk_xXZvBwfdyB4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function finalCheckConsistency() {
  try {
    console.log('🔍 最終檢查 category 和 description 一致性...');
    
    const { data: restaurants, error } = await supabase
      .from('restaurants')
      .select('name, category, description')
      .order('name');

    if (error) {
      console.error('❌ 查詢失敗:', error.message);
      return;
    }

    let identicalCount = 0;
    let differentCount = 0;
    let realDifferences = [];

    restaurants.forEach(restaurant => {
      const category = restaurant.category || '';
      const description = restaurant.description || '';
      
      // 清理字串並比較
      const cleanCategory = category.trim();
      const cleanDescription = description.trim();
      
      if (cleanCategory === cleanDescription) {
        identicalCount++;
      } else {
        differentCount++;
        realDifferences.push({
          name: restaurant.name,
          category: cleanCategory,
          description: cleanDescription,
          categoryLen: cleanCategory.length,
          descriptionLen: cleanDescription.length
        });
      }
    });

    console.log(`📊 最終統計結果:`);
    console.log(`✅ 完全相同: ${identicalCount} / ${restaurants.length} (${((identicalCount/restaurants.length)*100).toFixed(1)}%)`);
    console.log(`❌ 真正不同: ${differentCount} / ${restaurants.length} (${((differentCount/restaurants.length)*100).toFixed(1)}%)`);
    
    if (realDifferences.length > 0) {
      console.log('\n❌ 真正不同的餐廳:');
      realDifferences.forEach((restaurant, index) => {
        console.log(`${index + 1}. ${restaurant.name}:`);
        console.log(`   category (${restaurant.categoryLen}): "${restaurant.category}"`);
        console.log(`   description (${restaurant.descriptionLen}): "${restaurant.description}"`);
        
        // 詳細比較
        if (restaurant.category.length === restaurant.description.length) {
          console.log('   字符差異:');
          for (let i = 0; i < restaurant.category.length; i++) {
            if (restaurant.category[i] !== restaurant.description[i]) {
              console.log(`     位置 ${i}: "${restaurant.category[i]}" vs "${restaurant.description[i]}"`);
            }
          }
        } else {
          console.log('   長度不同');
        }
        console.log('');
      });
    } else {
      console.log('\n🎉 所有餐廳的 category 和 description 都完全相同！');
      console.log('✅ 可以安全地移除 description 欄位');
      
      console.log('\n📋 下一步行動計劃:');
      console.log('1. 更新應用程式碼，將所有使用 description 的地方改為 category');
      console.log('2. 測試所有功能正常運作');
      console.log('3. 在 Supabase Dashboard 執行: ALTER TABLE restaurants DROP COLUMN description;');
    }

  } catch (error) {
    console.error('💥 檢查過程發生錯誤:', error);
  }
}

// 執行檢查
finalCheckConsistency();