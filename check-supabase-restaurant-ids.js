import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4ODYzOSwiZXhwIjoyMDcyODY0NjM5fQ.WfCZzjg5QEW3E-R9BKuj4iTXU07yHQk_xXZvBwfdyB4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSupabaseRestaurantIds() {
  try {
    console.log('🔍 檢查 Supabase 餐廳 ID 格式...');
    
    const { data: restaurants, error } = await supabase
      .from('restaurants')
      .select('id, name')
      .limit(10);

    if (error) {
      console.error('❌ 查詢失敗:', error.message);
      return;
    }

    console.log(`📋 找到 ${restaurants.length} 間餐廳範例:`);
    restaurants.forEach((restaurant, index) => {
      console.log(`  ${index + 1}. ID: ${restaurant.id} (${typeof restaurant.id}) - ${restaurant.name}`);
    });

    // 檢查 ID 是否為 UUID 格式
    const firstId = restaurants[0]?.id;
    if (firstId) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(firstId);
      console.log(`\n🔍 第一個 ID 格式檢查:`);
      console.log(`  ID: ${firstId}`);
      console.log(`  類型: ${typeof firstId}`);
      console.log(`  是 UUID 格式: ${isUUID}`);
    }

    // 檢查總共有多少間餐廳
    const { count, error: countError } = await supabase
      .from('restaurants')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`\n📊 Supabase 總餐廳數量: ${count} 間`);
    }

  } catch (error) {
    console.error('💥 檢查過程發生錯誤:', error);
  }
}

// 執行檢查
checkSupabaseRestaurantIds();