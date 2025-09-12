import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4ODYzOSwiZXhwIjoyMDcyODY0NjM5fQ.WfCZzjg5QEW3E-R9BKuj4iTXU07yHQk_xXZvBwfdyB4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixSpicyConsistency() {
  try {
    console.log('🔧 修正 tags 中有"辣"但 is_spicy=false 的餐廳...');
    
    // 需要修正的餐廳名單
    const restaurantsToFix = [
      'PayaThai帕雅泰',
      '福林咖哩飯', 
      '薩加旺印度餐廳'
    ];

    let successCount = 0;
    let errorCount = 0;

    for (const restaurantName of restaurantsToFix) {
      try {
        const { error } = await supabase
          .from('restaurants')
          .update({ is_spicy: true })
          .eq('name', restaurantName);

        if (error) {
          console.error(`❌ 更新 ${restaurantName} 失敗:`, error.message);
          errorCount++;
        } else {
          console.log(`🌶️ 已修正 ${restaurantName}: is_spicy = true`);
          successCount++;
        }

        // 避免 API 頻率限制
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (restaurantError) {
        console.error(`❌ 處理餐廳 ${restaurantName} 時發生錯誤:`, restaurantError.message);
        errorCount++;
      }
    }

    console.log('\n📊 修正結果:');
    console.log(`✅ 成功修正: ${successCount} 間餐廳`);
    console.log(`❌ 修正失敗: ${errorCount} 間餐廳`);

    // 驗證修正結果
    console.log('\n🔍 驗證修正結果...');
    for (const restaurantName of restaurantsToFix) {
      const { data, error } = await supabase
        .from('restaurants')
        .select('name, is_spicy, tags')
        .eq('name', restaurantName)
        .single();

      if (error) {
        console.error(`❌ 查詢 ${restaurantName} 失敗:`, error.message);
      } else {
        const hasSpicyTag = data.tags && data.tags.includes('辣');
        const isConsistent = hasSpicyTag === data.is_spicy;
        console.log(`${isConsistent ? '✅' : '❌'} ${data.name}: is_spicy=${data.is_spicy}, 有辣tag=${hasSpicyTag}`);
      }
    }

    console.log('\n🎉 修正完成！');

  } catch (error) {
    console.error('💥 修正過程發生錯誤:', error);
  }
}

// 執行修正
fixSpicyConsistency();