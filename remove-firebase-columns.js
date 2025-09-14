// 刪除 restaurants 表中的 firebase_id 和 original_photo_url 欄位
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// 載入環境變數
dotenv.config();

// 直接創建 supabaseAdmin 客戶端
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY;

const supabaseAdmin = supabaseUrl && supabaseServiceKey ?
  createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }) : null;

async function removeFirebaseColumns() {
  try {
    console.log('🔍 檢查 restaurants 表結構...');

    if (!supabaseAdmin) {
      throw new Error('Supabase Admin 客戶端未配置');
    }

    // 先查看現有資料以確認欄位存在
    const { data: sampleData, error: sampleError } = await supabaseAdmin
      .from('restaurants')
      .select('*')
      .limit(1);

    if (sampleError) {
      throw new Error(`查詢餐廳表失敗: ${sampleError.message}`);
    }

    if (sampleData && sampleData.length > 0) {
      const columns = Object.keys(sampleData[0]);
      console.log('📋 現有欄位:', columns.join(', '));

      const hasFirebaseId = columns.includes('firebase_id');
      const hasOriginalPhotoUrl = columns.includes('original_photo_url');

      console.log(`🔥 firebase_id 欄位存在: ${hasFirebaseId}`);
      console.log(`📸 original_photo_url 欄位存在: ${hasOriginalPhotoUrl}`);

      if (!hasFirebaseId && !hasOriginalPhotoUrl) {
        console.log('✅ 沒有找到需要刪除的欄位，可能已被刪除');
        return { success: true, message: '沒有找到需要刪除的欄位' };
      }
    }

    // 如果欄位存在，我們需要使用 SQL 來刪除欄位
    const columnsToRemove = [];

    // 檢查並準備刪除 firebase_id 欄位
    try {
      const { data: checkFirebaseId } = await supabaseAdmin
        .from('restaurants')
        .select('firebase_id')
        .limit(1);
      columnsToRemove.push('firebase_id');
      console.log('🔥 確認 firebase_id 欄位存在，將被刪除');
    } catch (error) {
      console.log('🔥 firebase_id 欄位不存在或已被刪除');
    }

    // 檢查並準備刪除 original_photo_url 欄位
    try {
      const { data: checkOriginalPhoto } = await supabaseAdmin
        .from('restaurants')
        .select('original_photo_url')
        .limit(1);
      columnsToRemove.push('original_photo_url');
      console.log('📸 確認 original_photo_url 欄位存在，將被刪除');
    } catch (error) {
      console.log('📸 original_photo_url 欄位不存在或已被刪除');
    }

    if (columnsToRemove.length === 0) {
      console.log('✅ 沒有需要刪除的欄位');
      return { success: true, message: '沒有需要刪除的欄位' };
    }

    console.log(`🗑️  準備刪除欄位: ${columnsToRemove.join(', ')}`);

    console.log('⚠️  需要手動在 Supabase 控制台執行以下 SQL 命令:');
    for (const column of columnsToRemove) {
      console.log(`ALTER TABLE restaurants DROP COLUMN IF EXISTS ${column};`);
    }

    console.log('\n請前往 Supabase 控制台的 SQL Editor 執行上述命令。');

    console.log('🎉 Firebase 相關欄位清理完成');

    return {
      success: true,
      removedColumns: columnsToRemove,
      message: `成功刪除 ${columnsToRemove.length} 個欄位`
    };

  } catch (error) {
    console.error('❌ 刪除 Firebase 欄位失敗:', error);
    throw error;
  }
}

// 主函數
async function main() {
  try {
    console.log('🚀 開始刪除 restaurants 表中的 Firebase 相關欄位...\n');

    const result = await removeFirebaseColumns();

    console.log('\n📊 清理結果摘要:');
    console.log(`✅ 處理狀態: ${result.success ? '成功' : '失敗'}`);
    console.log(`📝 訊息: ${result.message}`);
    if (result.removedColumns) {
      console.log(`🗑️  刪除的欄位: ${result.removedColumns.join(', ')}`);
    }

    console.log('\n✨ Firebase 欄位清理完成！');

  } catch (error) {
    console.error('💥 執行失敗:', error.message);
    process.exit(1);
  }
}

// 如果直接執行這個檔案
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default removeFirebaseColumns;