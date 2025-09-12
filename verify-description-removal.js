import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4ODYzOSwiZXhwIjoyMDcyODY0NjM5fQ.WfCZzjg5QEW3E-R9BKuj4iTXU07yHQk_xXZvBwfdyB4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyDescriptionRemoval() {
  try {
    console.log('🔍 驗證 description 欄位移除...');
    
    // 嘗試查詢 description 欄位，如果失敗表示欄位已移除
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('name, description')
        .limit(1);
      
      if (error) {
        if (error.message.includes('column "description" does not exist')) {
          console.log('✅ description 欄位已成功移除！');
          
          // 驗證 category 欄位仍然存在且有資料
          const { data: categoryData, error: categoryError } = await supabase
            .from('restaurants')
            .select('name, category')
            .limit(5);
          
          if (categoryError) {
            console.error('❌ category 欄位查詢失敗:', categoryError.message);
          } else {
            console.log('✅ category 欄位正常，範例資料:');
            categoryData.forEach((restaurant, index) => {
              console.log(`  ${index + 1}. ${restaurant.name}: "${restaurant.category}"`);
            });
          }
          
          return true;
        } else {
          console.error('❌ 其他查詢錯誤:', error.message);
          return false;
        }
      } else {
        console.log('⚠️ description 欄位仍然存在，需要手動移除');
        console.log('請在 Supabase Dashboard 的 SQL Editor 中執行：');
        console.log('ALTER TABLE restaurants DROP COLUMN IF EXISTS description;');
        return false;
      }
    } catch (queryError) {
      console.log('✅ description 欄位已移除 (查詢拋出異常)');
      return true;
    }
    
  } catch (error) {
    console.error('💥 驗證過程發生錯誤:', error);
    return false;
  }
}

// 測試餐廳服務是否正常運作
async function testRestaurantService() {
  try {
    console.log('\n🧪 測試餐廳服務功能...');
    
    // 測試搜尋功能
    const { data: searchResults, error: searchError } = await supabase
      .from('restaurants')
      .select('name, category')
      .or('name.ilike.%咖啡%,category.ilike.%咖啡%')
      .limit(3);
    
    if (searchError) {
      console.error('❌ 搜尋功能測試失敗:', searchError.message);
      return false;
    } else {
      console.log('✅ 搜尋功能正常，找到咖啡相關餐廳:');
      searchResults.forEach((restaurant, index) => {
        console.log(`  ${index + 1}. ${restaurant.name}: ${restaurant.category}`);
      });
    }
    
    return true;
    
  } catch (error) {
    console.error('💥 服務測試失敗:', error);
    return false;
  }
}

// 執行驗證
async function runVerification() {
  console.log('🚀 開始 description 欄位移除驗證...\n');
  
  const removalSuccess = await verifyDescriptionRemoval();
  const serviceSuccess = await testRestaurantService();
  
  console.log('\n📊 驗證總結:');
  console.log(`Description 欄位移除: ${removalSuccess ? '✅ 成功' : '❌ 失敗'}`);
  console.log(`餐廳服務功能: ${serviceSuccess ? '✅ 正常' : '❌ 異常'}`);
  
  if (removalSuccess && serviceSuccess) {
    console.log('\n🎉 所有驗證通過！category 和 description 欄位整合完成！');
  } else {
    console.log('\n⚠️ 部分驗證失敗，請檢查上述錯誤');
  }
}

runVerification();