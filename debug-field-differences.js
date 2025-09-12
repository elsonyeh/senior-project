import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4ODYzOSwiZXhwIjoyMDcyODY0NjM5fQ.WfCZzjg5QEW3E-R9BKuj4iTXU07yHQk_xXZvBwfdyB4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugFieldDifferences() {
  try {
    console.log('🔍 調試欄位差異...');
    
    const { data: restaurants, error } = await supabase
      .from('restaurants')
      .select('name, category, description')
      .limit(5);

    if (error) {
      console.error('❌ 查詢失敗:', error.message);
      return;
    }

    restaurants.forEach(restaurant => {
      const category = restaurant.category || '';
      const description = restaurant.description || '';
      
      console.log(`\n餐廳: ${restaurant.name}`);
      console.log(`category: "${category}"`);
      console.log(`description: "${description}"`);
      console.log(`category 長度: ${category.length}`);
      console.log(`description 長度: ${description.length}`);
      console.log(`嚴格比較 ===: ${category === description}`);
      console.log(`比較結果: ${category === description ? '相同' : '不同'}`);
      
      if (category !== description) {
        console.log('📋 逐字符比較:');
        const maxLen = Math.max(category.length, description.length);
        for (let i = 0; i < maxLen; i++) {
          const catChar = category[i] || '';
          const descChar = description[i] || '';
          const catCode = catChar ? catChar.charCodeAt(0) : null;
          const descCode = descChar ? descChar.charCodeAt(0) : null;
          
          if (catChar !== descChar) {
            console.log(`位置 ${i}: category="${catChar}"(${catCode}) vs description="${descChar}"(${descCode})`);
          }
        }
      }
    });

  } catch (error) {
    console.error('💥 調試過程發生錯誤:', error);
  }
}

// 執行調試
debugFieldDifferences();