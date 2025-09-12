import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4ODYzOSwiZXhwIjoyMDcyODY0NjM5fQ.WfCZzjg5QEW3E-R9BKuj4iTXU07yHQk_xXZvBwfdyB4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAdminFunctionality() {
  try {
    console.log('🧪 測試 Admin 管理功能...\n');
    
    // 1. 測試標籤統計功能
    console.log('📊 1. 測試標籤統計...');
    const { data: restaurants, error: fetchError } = await supabase
      .from('restaurants')
      .select('tags')
      .eq('is_active', true);
    
    if (fetchError) {
      console.error('❌ 獲取餐廳失敗:', fetchError.message);
      return;
    }
    
    const tagMap = {};
    restaurants.forEach(restaurant => {
      if (restaurant.tags && Array.isArray(restaurant.tags)) {
        restaurant.tags.forEach(tag => {
          const cleanTag = tag.trim();
          if (cleanTag) {
            tagMap[cleanTag] = (tagMap[cleanTag] || 0) + 1;
          }
        });
      }
    });
    
    const sortedTags = Object.entries(tagMap)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    
    console.log('✅ 前10個標籤統計:');
    sortedTags.forEach(([tag, count]) => {
      console.log(`   ${tag}: ${count} 間餐廳`);
    });
    
    // 2. 測試新增餐廳功能
    console.log('\n🏪 2. 測試新增餐廳...');
    const testRestaurant = {
      name: '測試餐廳' + Date.now(),
      category: '中式、熱炒',
      address: '台北市信義區測試路123號',
      tags: ['熱炒', '聚會', '台式', '熱鬧'],
      price_range: 2,
      rating: 4.2,
      suggested_people: '4~8',
      is_spicy: true,
      is_active: true
    };
    
    const { data: newRestaurant, error: insertError } = await supabase
      .from('restaurants')
      .insert([testRestaurant])
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ 新增餐廳失敗:', insertError.message);
      return;
    }
    
    console.log('✅ 新增餐廳成功:', newRestaurant.name);
    console.log(`   辣味: ${newRestaurant.is_spicy ? '辣' : '不辣'}`);
    console.log(`   人數: ${newRestaurant.suggested_people}`);
    console.log(`   標籤: ${newRestaurant.tags.join('、')}`);
    
    // 3. 測試更新餐廳功能
    console.log('\n📝 3. 測試更新餐廳...');
    const updateData = {
      name: newRestaurant.name + ' (已更新)',
      suggested_people: '1~8',
      is_spicy: false,
      tags: [...newRestaurant.tags, '更新標籤']
    };
    
    const { data: updatedRestaurant, error: updateError } = await supabase
      .from('restaurants')
      .update(updateData)
      .eq('id', newRestaurant.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ 更新餐廳失敗:', updateError.message);
    } else {
      console.log('✅ 更新餐廳成功:', updatedRestaurant.name);
      console.log(`   辣味: ${updatedRestaurant.is_spicy ? '辣' : '不辣'}`);
      console.log(`   人數: ${updatedRestaurant.suggested_people}`);
      console.log(`   標籤: ${updatedRestaurant.tags.join('、')}`);
    }
    
    // 4. 測試標籤篩選功能
    console.log('\n🔍 4. 測試標籤篩選...');
    const { data: filteredRestaurants, error: filterError } = await supabase
      .from('restaurants')
      .select('name, tags')
      .eq('is_active', true)
      .contains('tags', ['熱炒']);
    
    if (filterError) {
      console.error('❌ 標籤篩選失敗:', filterError.message);
    } else {
      console.log(`✅ 找到 ${filteredRestaurants.length} 間包含「熱炒」標籤的餐廳`);
      filteredRestaurants.slice(0, 3).forEach(restaurant => {
        console.log(`   - ${restaurant.name}`);
      });
    }
    
    // 5. 測試價格篩選
    console.log('\n💰 5. 測試價格篩選...');
    const { data: priceFiltered, error: priceError } = await supabase
      .from('restaurants')
      .select('name, price_range')
      .eq('is_active', true)
      .eq('price_range', 2);
    
    if (priceError) {
      console.error('❌ 價格篩選失敗:', priceError.message);
    } else {
      console.log(`✅ 找到 ${priceFiltered.length} 間「$$」價位的餐廳`);
    }
    
    // 6. 測試辣味篩選
    console.log('\n🌶️ 6. 測試辣味篩選...');
    const { data: spicyFiltered, error: spicyError } = await supabase
      .from('restaurants')
      .select('name, is_spicy')
      .eq('is_active', true)
      .eq('is_spicy', true);
    
    if (spicyError) {
      console.error('❌ 辣味篩選失敗:', spicyError.message);
    } else {
      console.log(`✅ 找到 ${spicyFiltered.length} 間辣味餐廳`);
    }
    
    // 清除測試資料
    console.log('\n🧹 清除測試資料...');
    const { error: deleteError } = await supabase
      .from('restaurants')
      .delete()
      .eq('id', newRestaurant.id);
    
    if (deleteError) {
      console.error('❌ 清除測試資料失敗:', deleteError.message);
    } else {
      console.log('✅ 測試資料已清除');
    }
    
  } catch (error) {
    console.error('💥 測試過程發生錯誤:', error);
  }
}

// 執行測試
console.log('🚀 開始測試 Admin 功能...\n');
testAdminFunctionality()
  .then(() => {
    console.log('\n🎉 所有測試完成！');
  })
  .catch(error => {
    console.error('💥 測試執行失敗:', error);
  });