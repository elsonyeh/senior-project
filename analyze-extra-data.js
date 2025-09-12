import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4ODYzOSwiZXhwIjoyMDcyODY0NjM5fQ.WfCZzjg5QEW3E-R9BKuj4iTXU07yHQk_xXZvBwfdyB4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function analyzeExtraData() {
  try {
    console.log('🔍 分析 extra_data 欄位結構...');
    
    // 查詢所有餐廳的 extra_data
    const { data: restaurants, error } = await supabase
      .from('restaurants')
      .select('id, name, extra_data')
      .limit(10);

    if (error) {
      console.error('❌ 查詢失敗:', error.message);
      return;
    }

    console.log(`📋 分析前 ${restaurants.length} 間餐廳的 extra_data 結構:\n`);

    let hasExtraData = 0;
    let hasIsSpicy = 0;
    let hasSuggestedPeople = 0;
    let hasOriginalPhotoURL = 0;
    let extraDataKeys = new Set();

    restaurants.forEach((restaurant, index) => {
      console.log(`${index + 1}. ${restaurant.name}`);
      console.log(`   ID: ${restaurant.id}`);
      
      if (restaurant.extra_data) {
        hasExtraData++;
        console.log(`   extra_data: ${JSON.stringify(restaurant.extra_data)}`);
        
        // 收集所有 keys
        Object.keys(restaurant.extra_data).forEach(key => extraDataKeys.add(key));
        
        if (restaurant.extra_data.isSpicy !== undefined) {
          hasIsSpicy++;
          console.log(`   - 包含 isSpicy: ${restaurant.extra_data.isSpicy}`);
        }
        
        if (restaurant.extra_data.suggestedPeople !== undefined) {
          hasSuggestedPeople++;
          console.log(`   - 包含 suggestedPeople: ${restaurant.extra_data.suggestedPeople}`);
        }
        
        if (restaurant.extra_data.originalPhotoURL !== undefined) {
          hasOriginalPhotoURL++;
          console.log(`   - 包含 originalPhotoURL: ${restaurant.extra_data.originalPhotoURL}`);
        }
      } else {
        console.log(`   extra_data: null`);
      }
      console.log('');
    });

    console.log('📊 統計結果:');
    console.log(`有 extra_data 的餐廳: ${hasExtraData} / ${restaurants.length}`);
    console.log(`包含 isSpicy 的餐廳: ${hasIsSpicy} / ${restaurants.length}`);
    console.log(`包含 suggestedPeople 的餐廳: ${hasSuggestedPeople} / ${restaurants.length}`);
    console.log(`包含 originalPhotoURL 的餐廳: ${hasOriginalPhotoURL} / ${restaurants.length}`);
    console.log(`\nExtra_data 中發現的所有 keys:`, Array.from(extraDataKeys));

    // 檢查總數
    const { count, error: countError } = await supabase
      .from('restaurants')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`\n📈 資料庫總餐廳數量: ${count} 間`);
    }

  } catch (error) {
    console.error('💥 分析過程發生錯誤:', error);
  }
}

// 執行分析
analyzeExtraData();