import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4ODYzOSwiZXhwIjoyMDcyODY0NjM5fQ.WfCZzjg5QEW3E-R9BKuj4iTXU07yHQk_xXZvBwfdyB4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDescriptions() {
  try {
    console.log('🔍 檢查 description 欄位中的建議人數...');
    
    // 查詢所有餐廳的 description
    const { data: restaurants, error } = await supabase
      .from('restaurants')
      .select('id, name, description, suggested_people')
      .order('name');

    if (error) {
      console.error('❌ 查詢失敗:', error.message);
      return;
    }

    console.log(`📋 檢查 ${restaurants.length} 間餐廳的 description...\n`);
    
    let hasOldSuggestedPeople = 0;
    let needsUpdate = [];

    restaurants.forEach((restaurant, index) => {
      console.log(`${index + 1}. ${restaurant.name}:`);
      console.log(`   description: "${restaurant.description}"`);
      console.log(`   suggested_people: ${restaurant.suggested_people}`);
      
      // 檢查 description 是否包含建議人數相關文字
      const description = restaurant.description || '';
      const hasSuggestedPeopleText = description.includes('建議人數') || 
                                    description.includes('| 1~') || 
                                    description.includes('| 5~') ||
                                    description.match(/\|\s*\d+~\d+/);
      
      if (hasSuggestedPeopleText) {
        console.log(`   ⚠️ 包含建議人數資訊`);
        hasOldSuggestedPeople++;
        needsUpdate.push({
          id: restaurant.id,
          name: restaurant.name,
          currentDescription: description,
          suggested_people: restaurant.suggested_people
        });
      } else {
        console.log(`   ✅ 不包含建議人數資訊`);
      }
      console.log('');
    });

    console.log('📊 統計結果:');
    console.log(`需要更新的餐廳: ${hasOldSuggestedPeople} / ${restaurants.length}`);
    
    if (needsUpdate.length > 0) {
      console.log('\n🔧 需要更新的餐廳列表:');
      needsUpdate.forEach((restaurant, index) => {
        console.log(`${index + 1}. ${restaurant.name}`);
        console.log(`   目前描述: "${restaurant.currentDescription}"`);
        
        // 建議新的描述（移除建議人數部分）
        let newDescription = restaurant.currentDescription;
        
        // 移除各種格式的建議人數
        newDescription = newDescription
          .replace(/\s*\|\s*建議人數[：:]\s*\d+~\d+/g, '')
          .replace(/\s*\|\s*\d+~\d+\s*人/g, '')
          .replace(/\s*\|\s*\d+~\d+/g, '')
          .replace(/建議人數[：:]\s*\d+~\d+\s*\|?\s*/g, '')
          .replace(/^\s*\|\s*/, '') // 移除開頭的 |
          .replace(/\s*\|\s*$/, '') // 移除結尾的 |
          .trim();
        
        console.log(`   建議新描述: "${newDescription}"`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('💥 檢查過程發生錯誤:', error);
  }
}

// 執行檢查
checkDescriptions();