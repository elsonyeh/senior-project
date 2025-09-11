// test-supabase.js
// 測試 Supabase 連接

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Anon Key:', supabaseAnonKey ? '已設定' : '未設定');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(' Supabase 配置缺失');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 測試連接
async function testConnection() {
  try {
    console.log(' 測試 Supabase 連接...');
    
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
