import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4ODYzOSwiZXhwIjoyMDcyODY0NjM5fQ.WfCZzjg5QEW3E-R9BKuj4iTXU07yHQk_xXZvBwfdyB4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function consolidateCategoryDescription() {
  try {
    console.log('🔧 開始整合 category 和 description 欄位...');
    
    // 步驟 1: 先修正唯一不同的餐廳（去除多餘空格）
    console.log('📋 步驟 1: 修正不一致的餐廳...');
    
    const { error: fixError } = await supabase
      .from('restaurants')
      .update({ category: '炒河粉，會安雞飯' })
      .eq('name', '越龍門_越南河粉/雞飯');
    
    if (fixError) {
      console.error('❌ 修正失敗:', fixError.message);
      return;
    }
    
    console.log('✅ 已修正 越龍門_越南河粉/雞飯 的 category 欄位');
    
    // 步驟 2: 驗證所有餐廳的 category 和 description 現在都相同
    console.log('\n📋 步驟 2: 驗證所有欄位現在都相同...');
    
    // 查詢所有餐廳並在客戶端檢查差異
    const { data: checkData, error: checkError } = await supabase
      .from('restaurants')
      .select('name, category, description');
    
    if (!checkError && checkData) {
      const differentRestaurants = checkData.filter(r => r.category !== r.description);
      
      if (differentRestaurants.length > 0) {
        console.log('⚠️ 仍有不一致的餐廳:');
        differentRestaurants.forEach(restaurant => {
          console.log(`- ${restaurant.name}:`);
          console.log(`  category: "${restaurant.category}"`);
          console.log(`  description: "${restaurant.description}"`);
        });
        console.log('請手動檢查這些餐廳...');
        return;
      }
    }
    
    if (checkError) {
      console.error('❌ 驗證查詢失敗:', checkError.message);
      return;
    }
    
    if (checkData.length > 0) {
      console.log('⚠️ 仍有不一致的餐廳:');
      checkData.forEach(restaurant => {
        console.log(`- ${restaurant.name}:`);
        console.log(`  category: "${restaurant.category}"`);
        console.log(`  description: "${restaurant.description}"`);
      });
      console.log('請手動檢查這些餐廳...');
      return;
    }
    
    console.log('✅ 所有餐廳的 category 和 description 現在都相同！');
    
    // 步驟 3: 顯示即將進行的操作摘要
    console.log('\n📋 步驟 3: 準備移除 description 欄位...');
    console.log('⚠️ 重要提醒：');
    console.log('1. 所有使用 description 的程式碼都需要改為使用 category');
    console.log('2. 以下檔案需要更新：');
    console.log('   - src/services/restaurantService.js (搜尋功能)');
    console.log('   - src/components/RestaurantManager.jsx (管理介面)');  
    console.log('   - src/components/RecommendationResult.jsx (結果顯示)');
    console.log('3. 確認程式碼更新完成後，再執行 SQL 移除欄位');
    
    console.log('\n🔍 影響分析：');
    
    // 檢查搜尋功能是否會受影響
    console.log('📝 程式碼更新需求：');
    console.log('1. restaurantService.js 中的搜尋功能使用 description');
    console.log('2. RestaurantManager.jsx 中的表單使用 description'); 
    console.log('3. RecommendationResult.jsx 可能顯示 description');
    console.log('4. 需要確保所有 API 查詢都移除 description 欄位');
    
    console.log('\n✅ 準備工作完成！');
    console.log('📋 下一步：');
    console.log('1. 更新所有程式碼檔案');
    console.log('2. 測試功能是否正常');  
    console.log('3. 在 Supabase Dashboard 執行：ALTER TABLE restaurants DROP COLUMN description;');

  } catch (error) {
    console.error('💥 整合過程發生錯誤:', error);
  }
}

// 執行整合
consolidateCategoryDescription();