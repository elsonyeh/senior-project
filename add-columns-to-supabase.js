import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzI4ODYzOSwiZXhwIjoyMDcyODY0NjM5fQ.WfCZzjg5QEW3E-R9BKuj4iTXU07yHQk_xXZvBwfdyB4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addColumnsToSupabase() {
  try {
    console.log('🔧 正在為 restaurants 表添加新欄位...');
    
    // 注意：Supabase 客戶端 SDK 通常不支援直接執行 DDL 語句
    // 我們需要手動在 Supabase Dashboard 的 SQL Editor 中執行這些語句
    // 或者使用 Database Functions
    
    console.log('⚠️ 重要提醒:');
    console.log('由於安全限制，需要手動在 Supabase Dashboard 中執行以下 SQL:');
    console.log('');
    console.log('-- 為 restaurants 表新增欄位');
    console.log('ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS suggested_people TEXT;');
    console.log('ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS original_photo_url TEXT;');
    console.log('');
    console.log('-- 建立索引');
    console.log('CREATE INDEX IF NOT EXISTS idx_restaurants_suggested_people ON restaurants(suggested_people);');
    console.log('CREATE INDEX IF NOT EXISTS idx_restaurants_original_photo_url ON restaurants(original_photo_url);');
    console.log('');
    
    // 嘗試檢查是否有 admin 權限來執行 DDL
    console.log('🔍 檢查是否可以直接執行 DDL...');
    
    // 這裡我們通過嘗試 INSERT 一個測試值來間接檢查欄位是否存在
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('suggested_people, original_photo_url')
        .limit(1);
      
      if (error) {
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          console.log('❌ 新欄位尚未存在，需要先在 Supabase Dashboard 中執行 DDL');
          console.log('');
          console.log('請按照以下步驟操作:');
          console.log('1. 登入 Supabase Dashboard');
          console.log('2. 進入 SQL Editor');
          console.log('3. 執行上述 SQL 語句');
          console.log('4. 執行完成後重新運行此腳本');
          return false;
        } else {
          throw error;
        }
      } else {
        console.log('✅ 新欄位已存在，可以繼續進行遷移');
        return true;
      }
    } catch (checkError) {
      console.error('檢查欄位時發生錯誤:', checkError.message);
      return false;
    }

  } catch (error) {
    console.error('💥 添加欄位過程發生錯誤:', error);
    return false;
  }
}

// 執行添加欄位
addColumnsToSupabase()
  .then((success) => {
    if (success) {
      console.log('🎉 欄位檢查完成，可以進行遷移！');
    } else {
      console.log('⚠️ 請先手動添加欄位');
    }
  })
  .catch(error => {
    console.error('💥 程序執行失敗:', error);
  });