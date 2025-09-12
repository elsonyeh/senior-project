import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4ODYzOSwiZXhwIjoyMDcyODY0NjM5fQ.WfCZzjg5QEW3E-R9BKuj4iTXU07yHQk_xXZvBwfdyB4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRestaurantSchema() {
  try {
    console.log('🔍 檢查餐廳表結構...');
    
    // 查詢一筆餐廳資料來檢查欄位
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ 查詢失敗:', error.message);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('✅ 現有欄位結構:');
      Object.keys(data[0]).forEach(key => {
        const value = data[0][key];
        console.log(`   - ${key}: ${typeof value} (範例: ${JSON.stringify(value)})`);
      });
      
      // 檢查是否有新欄位
      const requiredFields = ['people_count', 'is_spicy'];
      const missingFields = requiredFields.filter(field => !(field in data[0]));
      
      if (missingFields.length > 0) {
        console.log('\n⚠️ 缺少欄位:', missingFields.join(', '));
        console.log('需要添加以下欄位到數據庫：');
        missingFields.forEach(field => {
          if (field === 'people_count') {
            console.log(`ALTER TABLE restaurants ADD COLUMN people_count VARCHAR(10) DEFAULT '1~4';`);
          } else if (field === 'is_spicy') {
            console.log(`ALTER TABLE restaurants ADD COLUMN is_spicy BOOLEAN DEFAULT false;`);
          }
        });
      } else {
        console.log('\n✅ 所有必要欄位都存在！');
      }
    } else {
      console.log('⚠️ 沒有找到餐廳資料');
    }
    
    // 測試新增餐廳功能
    console.log('\n🧪 測試新增餐廳功能...');
    const testRestaurant = {
      name: '測試餐廳' + Date.now(),
      category: '測試類別',
      address: '測試地址',
      tags: ['測試標籤1', '測試標籤2'],
      price_range: 2,
      rating: 4.5,
      people_count: '1~4',
      is_spicy: true,
      is_active: true
    };
    
    const { data: newRestaurant, error: insertError } = await supabase
      .from('restaurants')
      .insert([testRestaurant])
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ 新增測試餐廳失敗:', insertError.message);
    } else {
      console.log('✅ 新增測試餐廳成功:', newRestaurant.name);
      
      // 清除測試資料
      await supabase
        .from('restaurants')
        .delete()
        .eq('id', newRestaurant.id);
      console.log('✅ 已清除測試資料');
    }
    
  } catch (error) {
    console.error('💥 檢查過程發生錯誤:', error);
  }
}

// 執行檢查
console.log('🚀 開始檢查餐廳表結構...\n');
checkRestaurantSchema()
  .then(() => {
    console.log('\n🎉 檢查完成！');
  })
  .catch(error => {
    console.error('💥 程序執行失敗:', error);
  });