import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4ODYzOSwiZXhwIjoyMDcyODY0NjM5fQ.WfCZzjg5QEW3E-R9BKuj4iTXU07yHQk_xXZvBwfdyB4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateExtraData() {
  try {
    console.log('🚀 開始遷移 extra_data 到新欄位...');
    
    // 步驟 1: 先檢查並添加新欄位
    console.log('📋 步驟 1: 添加新欄位...');
    
    // 使用 RPC 或直接 SQL 添加欄位 (這裡我們假設已經手動執行了 SQL)
    
    // 步驟 2: 查詢所有餐廳的 extra_data
    console.log('📋 步驟 2: 查詢所有餐廳資料...');
    const { data: restaurants, error } = await supabase
      .from('restaurants')
      .select('id, name, extra_data');

    if (error) {
      console.error('❌ 查詢失敗:', error.message);
      return;
    }

    console.log(`找到 ${restaurants.length} 間餐廳需要遷移`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // 步驟 3: 逐一遷移每間餐廳的資料
    for (const restaurant of restaurants) {
      try {
        if (!restaurant.extra_data) {
          console.log(`⏭️ 跳過 ${restaurant.name} - 沒有 extra_data`);
          skippedCount++;
          continue;
        }

        const extraData = restaurant.extra_data;
        const updateData = {};

        // 提取 suggestedPeople
        if (extraData.suggestedPeople !== undefined) {
          updateData.suggested_people = extraData.suggestedPeople;
        }

        // 提取 originalPhotoURL
        if (extraData.originalPhotoURL !== undefined) {
          updateData.original_photo_url = extraData.originalPhotoURL;
        }

        // 創建新的 extra_data，移除 isSpicy, suggestedPeople, originalPhotoURL
        const newExtraData = { ...extraData };
        delete newExtraData.isSpicy;
        delete newExtraData.suggestedPeople;
        delete newExtraData.originalPhotoURL;

        // 如果新的 extra_data 是空的，設為 null
        if (Object.keys(newExtraData).length === 0) {
          updateData.extra_data = null;
        } else {
          updateData.extra_data = newExtraData;
        }

        // 更新餐廳資料
        const { error: updateError } = await supabase
          .from('restaurants')
          .update(updateData)
          .eq('id', restaurant.id);

        if (updateError) {
          console.error(`❌ 更新餐廳 ${restaurant.name} 失敗:`, updateError.message);
          errorCount++;
        } else {
          console.log(`✅ 已遷移 ${restaurant.name}`);
          if (updateData.suggested_people) {
            console.log(`   - suggested_people: ${updateData.suggested_people}`);
          }
          if (updateData.original_photo_url) {
            console.log(`   - original_photo_url: ${updateData.original_photo_url.substring(0, 50)}...`);
          }
          if (updateData.extra_data === null) {
            console.log(`   - extra_data: 已清空`);
          } else if (updateData.extra_data) {
            console.log(`   - extra_data: ${JSON.stringify(updateData.extra_data)}`);
          }
          successCount++;
        }

        // 避免 API 頻率限制
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (restaurantError) {
        console.error(`❌ 處理餐廳 ${restaurant.name || 'Unknown'} 時發生錯誤:`, restaurantError.message);
        errorCount++;
      }
    }

    console.log('\n📊 遷移完成統計:');
    console.log(`✅ 成功遷移: ${successCount} 間餐廳`);
    console.log(`⏭️ 跳過: ${skippedCount} 間餐廳`);
    console.log(`❌ 遷移失敗: ${errorCount} 間餐廳`);

    // 步驟 4: 驗證遷移結果
    console.log('\n🔍 驗證遷移結果...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('restaurants')
      .select('id, name, suggested_people, original_photo_url, extra_data')
      .limit(5);

    if (verifyError) {
      console.error('❌ 驗證查詢失敗:', verifyError.message);
    } else {
      console.log('✅ 前 5 間餐廳的新結構:');
      verifyData.forEach(restaurant => {
        console.log(`  ${restaurant.name}:`);
        console.log(`    - suggested_people: ${restaurant.suggested_people}`);
        console.log(`    - original_photo_url: ${restaurant.original_photo_url ? restaurant.original_photo_url.substring(0, 50) + '...' : 'null'}`);
        console.log(`    - extra_data: ${restaurant.extra_data ? JSON.stringify(restaurant.extra_data) : 'null'}`);
      });
    }

  } catch (error) {
    console.error('💥 遷移過程發生錯誤:', error);
  }
}

// 執行遷移
console.log('🚀 開始 extra_data 遷移程序...');
migrateExtraData()
  .then(() => {
    console.log('🎉 遷移程序完成！');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 程序執行失敗:', error);
    process.exit(1);
  });