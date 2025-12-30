// check-specific-restaurants.js - 檢查特定餐廳的資料
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRestaurants() {
  try {
    // 查詢警告中提到的兩家餐廳
    const restaurantIds = [
      'f495b7d7-b1d6-4701-81ff-aeaefee0e369', // 阿木的店 貝果
      'a0731d1c-23a0-4665-8dcd-14f2a531b612'  // 香茗茶行
    ];

    console.log('🔍 查詢警告中提到的餐廳...\n');

    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .in('id', restaurantIds);

    if (error) {
      throw error;
    }

    console.log(`找到 ${data.length} 家餐廳:\n`);

    data.forEach(restaurant => {
      console.log(`餐廳: ${restaurant.name}`);
      console.log(`ID: ${restaurant.id}`);
      console.log(`is_active: ${restaurant.is_active}`);
      console.log(`is_active 類型: ${typeof restaurant.is_active}`);
      console.log(`完整資料:`, JSON.stringify(restaurant, null, 2));
      console.log('\n---\n');
    });

  } catch (error) {
    console.error('❌ 錯誤:', error.message);
    process.exit(1);
  }
}

checkRestaurants()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 執行失敗:', error);
    process.exit(1);
  });
