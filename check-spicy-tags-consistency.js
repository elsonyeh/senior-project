import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4ODYzOSwiZXhwIjoyMDcyODY0NjM5fQ.WfCZzjg5QEW3E-R9BKuj4iTXU07yHQk_xXZvBwfdyB4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSpicyTagsConsistency() {
  try {
    console.log('🔍 檢查 tags 中有"辣"的餐廳與 is_spicy 欄位的一致性...');
    
    // 查詢所有餐廳
    const { data: restaurants, error } = await supabase
      .from('restaurants')
      .select('id, name, is_spicy, tags')
      .order('name');

    if (error) {
      console.error('❌ 查詢失敗:', error.message);
      return;
    }

    console.log(`📋 分析 ${restaurants.length} 間餐廳...\n`);
    
    let hasSpicyTagButFalseIsSpicy = [];
    let isSpicyTrueButNoSpicyTag = [];
    let consistentSpicy = [];
    let consistentNonSpicy = [];

    restaurants.forEach(restaurant => {
      const hasSpicyTag = restaurant.tags && restaurant.tags.includes('辣');
      const isSpicy = restaurant.is_spicy;

      if (hasSpicyTag && !isSpicy) {
        hasSpicyTagButFalseIsSpicy.push(restaurant);
      } else if (!hasSpicyTag && isSpicy) {
        isSpicyTrueButNoSpicyTag.push(restaurant);
      } else if (hasSpicyTag && isSpicy) {
        consistentSpicy.push(restaurant);
      } else {
        consistentNonSpicy.push(restaurant);
      }
    });

    console.log('📊 分析結果:');
    console.log(`✅ 一致的辣餐廳 (tags有"辣" && is_spicy=true): ${consistentSpicy.length} 間`);
    console.log(`✅ 一致的不辣餐廳 (tags無"辣" && is_spicy=false): ${consistentNonSpicy.length} 間`);
    console.log(`⚠️ tags有"辣"但is_spicy=false: ${hasSpicyTagButFalseIsSpicy.length} 間`);
    console.log(`⚠️ tags無"辣"但is_spicy=true: ${isSpicyTrueButNoSpicyTag.length} 間\n`);

    // 顯示一致的辣餐廳
    if (consistentSpicy.length > 0) {
      console.log('🌶️ 一致的辣餐廳:');
      consistentSpicy.forEach((restaurant, index) => {
        console.log(`  ${index + 1}. ${restaurant.name} ✓`);
      });
      console.log('');
    }

    // 顯示不一致的情況
    if (hasSpicyTagButFalseIsSpicy.length > 0) {
      console.log('❌ tags有"辣"但is_spicy=false的餐廳:');
      hasSpicyTagButFalseIsSpicy.forEach((restaurant, index) => {
        console.log(`  ${index + 1}. ${restaurant.name}`);
        console.log(`     - tags: ${JSON.stringify(restaurant.tags)}`);
        console.log(`     - is_spicy: ${restaurant.is_spicy}`);
      });
      console.log('');
    }

    if (isSpicyTrueButNoSpicyTag.length > 0) {
      console.log('❌ tags無"辣"但is_spicy=true的餐廳:');
      isSpicyTrueButNoSpicyTag.forEach((restaurant, index) => {
        console.log(`  ${index + 1}. ${restaurant.name}`);
        console.log(`     - tags: ${JSON.stringify(restaurant.tags)}`);
        console.log(`     - is_spicy: ${restaurant.is_spicy}`);
      });
      console.log('');
    }

    // 總結
    const totalInconsistent = hasSpicyTagButFalseIsSpicy.length + isSpicyTrueButNoSpicyTag.length;
    if (totalInconsistent === 0) {
      console.log('🎉 所有餐廳的 tags"辣"與 is_spicy 欄位完全一致！');
    } else {
      console.log(`⚠️ 發現 ${totalInconsistent} 間餐廳存在不一致的情況`);
    }

  } catch (error) {
    console.error('💥 檢查過程發生錯誤:', error);
  }
}

// 執行檢查
checkSpicyTagsConsistency();