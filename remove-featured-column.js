// 刪除 restaurants 表中的 featured 欄位
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

async function removeFeaturedColumn() {
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

      const hasFeatured = columns.includes('featured');
      console.log(`⭐ featured 欄位存在: ${hasFeatured}`);

      if (!hasFeatured) {
        console.log('✅ featured 欄位不存在，可能已被刪除');
        return { success: true, message: 'featured 欄位不存在' };
      }
    }

    console.log('⚠️  需要手動在 Supabase 控制台執行以下 SQL 命令:');
    console.log('ALTER TABLE restaurants DROP COLUMN IF EXISTS featured;');
    console.log('\n請前往 Supabase 控制台的 SQL Editor 執行上述命令。');

    console.log('🎉 featured 欄位清理指示完成');

    return {
      success: true,
      message: '請手動執行 SQL 命令刪除 featured 欄位'
    };

  } catch (error) {
    console.error('❌ 刪除 featured 欄位失敗:', error);
    throw error;
  }
}

// 主函數
async function main() {
  try {
    console.log('🚀 開始刪除 restaurants 表中的 featured 欄位...\n');

    const result = await removeFeaturedColumn();

    console.log('\n📊 清理結果摘要:');
    console.log(`✅ 處理狀態: ${result.success ? '成功' : '失敗'}`);
    console.log(`📝 訊息: ${result.message}`);

    console.log('\n✨ featured 欄位清理完成！');

  } catch (error) {
    console.error('💥 執行失敗:', error.message);
    process.exit(1);
  }
}

// 如果直接執行這個檔案
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default removeFeaturedColumn;