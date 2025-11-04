/**
 * 檢查 Supabase 資料庫中實際存在的表
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 環境變數未設置');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 嘗試查詢的表列表
const tablesToCheck = [
  'restaurants',
  'restaurant_images',
  'restaurant_reviews',
  'user_profiles',
  'user_favorite_lists',
  'favorite_list_places',
  'swifttaste_history',
  'selection_history',
  'buddies_rooms',
  'buddies_questions',
  'buddies_events',
  'buddies_members',
  'buddies_votes',
  'fun_questions',
  'fun_question_tags'
];

async function checkTable(tableName) {
  try {
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      return { tableName, exists: false, error: error.message };
    }

    return { tableName, exists: true, rowCount: count || 0 };
  } catch (error) {
    return { tableName, exists: false, error: error.message };
  }
}

async function main() {
  console.log('🔍 檢查 Supabase 資料庫中的表...\n');

  const results = [];

  for (const tableName of tablesToCheck) {
    const result = await checkTable(tableName);
    results.push(result);
  }

  console.log('✅ 存在的表：\n');
  results.filter(r => r.exists).forEach(r => {
    console.log(`  ✓ ${r.tableName.padEnd(30)} (${r.rowCount} rows)`);
  });

  console.log('\n❌ 不存在的表：\n');
  results.filter(r => !r.exists).forEach(r => {
    console.log(`  ✗ ${r.tableName.padEnd(30)} - ${r.error}`);
  });

  console.log(`\n📊 總計：${results.filter(r => r.exists).length}/${results.length} 個表存在\n`);
}

main();
