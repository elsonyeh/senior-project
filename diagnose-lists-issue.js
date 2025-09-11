// 診斷收藏清單問題的腳本
import { supabase } from './src/services/supabaseService.js';

async function diagnoseLists() {
  console.log('=== 診斷收藏清單問題 ===\n');

  // 1. 檢查表格是否存在
  console.log('1. 檢查表格結構...');
  try {
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['user_profiles', 'user_favorite_lists', 'favorite_list_places']);
    
    if (tablesError) {
      console.error('無法查詢表格:', tablesError);
    } else {
      console.log('存在的表格:', tables.map(t => t.table_name));
    }
  } catch (error) {
    console.error('查詢表格失敗:', error);
  }

  // 2. 檢查用戶檔案
  console.log('\n2. 檢查用戶檔案...');
  try {
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, email, name')
      .limit(5);
    
    if (usersError) {
      console.error('查詢用戶檔案失敗:', usersError);
    } else {
      console.log(`找到 ${users.length} 個用戶檔案`);
      if (users.length > 0) {
        console.log('第一個用戶:', users[0]);
      }
    }
  } catch (error) {
    console.error('查詢用戶檔案失敗:', error);
  }

  // 3. 檢查收藏清單
  console.log('\n3. 檢查收藏清單...');
  try {
    const { data: lists, error: listsError } = await supabase
      .from('user_favorite_lists')
      .select('*')
      .limit(5);
    
    if (listsError) {
      console.error('查詢收藏清單失敗:', listsError);
    } else {
      console.log(`找到 ${lists.length} 個收藏清單`);
      console.log('清單數據:', lists);
    }
  } catch (error) {
    console.error('查詢收藏清單失敗:', error);
  }

  // 4. 檢查關聯查詢
  console.log('\n4. 檢查關聯查詢...');
  try {
    const { data: listsWithPlaces, error: joinError } = await supabase
      .from('user_favorite_lists')
      .select(`
        id,
        name,
        description,
        color,
        is_public,
        places_count,
        created_at,
        updated_at,
        favorite_list_places (
          id,
          place_id,
          name,
          address,
          rating,
          photo_url,
          notes,
          added_at
        )
      `)
      .limit(3);
    
    if (joinError) {
      console.error('關聯查詢失敗:', joinError);
    } else {
      console.log(`關聯查詢成功，找到 ${listsWithPlaces.length} 個清單`);
      if (listsWithPlaces.length > 0) {
        console.log('第一個清單的結構:', JSON.stringify(listsWithPlaces[0], null, 2));
      }
    }
  } catch (error) {
    console.error('關聯查詢失敗:', error);
  }

  console.log('\n=== 診斷完成 ===');
}

// 運行診斷
diagnoseLists().catch(console.error);