import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase 配置
const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4ODYzOSwiZXhwIjoyMDcyODY0NjM5fQ.WfCZzjg5QEW3E-R9BKuj4iTXU07yHQk_xXZvBwfdyB4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function syncIsSpicyToSupabase() {
  try {
    // 讀取本地餐廳資料
    console.log('📋 讀取本地餐廳資料...');
    const restaurantsPath = path.join(__dirname, 'restaurants (2).json');
    const restaurants = JSON.parse(fs.readFileSync(restaurantsPath, 'utf8'));
    
    console.log(`找到 ${restaurants.length} 間餐廳`);

    let updatedCount = 0;
    let spicyCount = 0;
    let nonSpicyCount = 0;
    let errorCount = 0;

    // 逐一更新每間餐廳的 is_spicy 狀態
    for (const restaurant of restaurants) {
      try {
        const isSpicy = restaurant.isSpicy === true;
        
        if (isSpicy) {
          spicyCount++;
        } else {
          nonSpicyCount++;
        }

        // 使用餐廳名稱匹配更新 Supabase 中的餐廳（因為 ID 格式不同）
        const { error: updateError } = await supabase
          .from('restaurants')
          .update({ is_spicy: isSpicy })
          .eq('name', restaurant.name);

        if (updateError) {
          console.error(`❌ 更新餐廳 ${restaurant.name} (${restaurant.id}) 失敗:`, updateError.message);
          errorCount++;
        } else {
          updatedCount++;
          console.log(`${isSpicy ? '🌶️' : '🥛'} 更新 ${restaurant.name}: is_spicy = ${isSpicy}`);
        }

        // 避免 API 頻率限制，稍微延遲
        await new Promise(resolve => setTimeout(resolve, 10));

      } catch (restaurantError) {
        console.error(`❌ 處理餐廳 ${restaurant.name || 'Unknown'} 時發生錯誤:`, restaurantError.message);
        errorCount++;
      }
    }

    console.log('\n📊 同步完成統計:');
    console.log(`✅ 成功更新: ${updatedCount} 間餐廳`);
    console.log(`🌶️ 辣的餐廳: ${spicyCount} 間`);
    console.log(`🥛 不辣的餐廳: ${nonSpicyCount} 間`);
    console.log(`❌ 更新失敗: ${errorCount} 間餐廳`);

    // 驗證結果
    console.log('\n🔍 驗證 Supabase 資料...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('restaurants')
      .select('id, name, is_spicy')
      .order('name')
      .limit(10);

    if (verifyError) {
      console.error('❌ 驗證查詢失敗:', verifyError.message);
    } else {
      console.log('✅ 前 10 間餐廳的 is_spicy 狀態:');
      verifyData.forEach(restaurant => {
        console.log(`  ${restaurant.is_spicy ? '🌶️' : '🥛'} ${restaurant.name}: is_spicy = ${restaurant.is_spicy}`);
      });
    }

    // 統計資料庫中的辣度分布
    const { data: spicyStats, error: statsError } = await supabase
      .from('restaurants')
      .select('is_spicy')
      .not('is_spicy', 'is', null);

    if (!statsError && spicyStats) {
      const dbSpicyCount = spicyStats.filter(r => r.is_spicy === true).length;
      const dbNonSpicyCount = spicyStats.filter(r => r.is_spicy === false).length;
      
      console.log('\n📈 Supabase 資料庫統計:');
      console.log(`🌶️ 資料庫中辣的餐廳: ${dbSpicyCount} 間`);
      console.log(`🥛 資料庫中不辣的餐廳: ${dbNonSpicyCount} 間`);
      
      if (dbSpicyCount === spicyCount && dbNonSpicyCount === nonSpicyCount) {
        console.log('🎉 本地資料與資料庫完全同步！');
      } else {
        console.log('⚠️ 本地資料與資料庫存在差異，請檢查');
      }
    }

  } catch (error) {
    console.error('💥 同步過程發生錯誤:', error);
  }
}

// 執行同步
console.log('🚀 開始同步 isSpicy 到 Supabase...');
syncIsSpicyToSupabase()
  .then(() => {
    console.log('🎉 同步程序完成！');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 程序執行失敗:', error);
    process.exit(1);
  });