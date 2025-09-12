import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4ODYzOSwiZXhwIjoyMDcyODY0NjM5fQ.WfCZzjg5QEW3E-R9BKuj4iTXU07yHQk_xXZvBwfdyB4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSupabaseRestaurants() {
  try {
    console.log('🔍 檢查 Supabase 餐廳完整資料...');
    
    // 查詢所有餐廳
    const { data: restaurants, error } = await supabase
      .from('restaurants')
      .select('id, name, is_spicy, tags')
      .order('name');

    if (error) {
      console.error('❌ 查詢失敗:', error.message);
      return;
    }

    console.log(`📋 總共 ${restaurants.length} 間餐廳:`);
    
    let spicyCount = 0;
    let nonSpicyCount = 0;
    
    restaurants.forEach((restaurant, index) => {
      const spicyIcon = restaurant.is_spicy ? '🌶️' : '🥛';
      console.log(`  ${index + 1}. ${spicyIcon} ${restaurant.name}`);
      console.log(`     - ID: ${restaurant.id}`);
      console.log(`     - is_spicy: ${restaurant.is_spicy}`);
      console.log(`     - tags: ${restaurant.tags ? JSON.stringify(restaurant.tags) : 'null'}`);
      console.log('');
      
      if (restaurant.is_spicy) {
        spicyCount++;
      } else {
        nonSpicyCount++;
      }
    });

    console.log('📊 統計結果:');
    console.log(`🌶️ 辣的餐廳: ${spicyCount} 間`);
    console.log(`🥛 不辣的餐廳: ${nonSpicyCount} 間`);

  } catch (error) {
    console.error('💥 檢查過程發生錯誤:', error);
  }
}

// 執行檢查
checkSupabaseRestaurants();