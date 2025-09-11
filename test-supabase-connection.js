// test-supabase-connection.js
// 測試 Supabase 連接

import { supabase } from './src/services/supabaseService.js';

console.log(' 測試 Supabase 連接...');

// 測試連接
async function testConnection() {
  try {
    // 測試查詢 buddies_rooms 表格
    const { data, error } = await supabase
      .from('buddies_rooms')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error(' Supabase 連接失敗:', error.message);
      return false;
    }
    
    console.log(' Supabase 連接成功！');
    console.log(' 查詢結果:', data);
    return true;
  } catch (err) {
    console.error(' 測試失敗:', err.message);
    return false;
  }
}

// 執行測試
testConnection();
