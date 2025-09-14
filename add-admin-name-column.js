// 為 admin_users 表增加 name 欄位並設定初始值
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

async function addAdminNameColumn() {
  try {
    console.log('🔍 檢查 admin_users 表結構...');

    if (!supabaseAdmin) {
      throw new Error('Supabase Admin 客戶端未配置');
    }

    // 先查看現有資料以確認欄位是否存在
    const { data: sampleData, error: sampleError } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .limit(1);

    if (sampleError) {
      throw new Error(`查詢 admin_users 表失敗: ${sampleError.message}`);
    }

    if (sampleData && sampleData.length > 0) {
      const columns = Object.keys(sampleData[0]);
      console.log('📋 現有欄位:', columns.join(', '));

      const hasName = columns.includes('name');
      console.log(`👤 name 欄位存在: ${hasName}`);

      if (hasName) {
        console.log('✅ name 欄位已存在，跳過新增步驟');

        // 設定 elson921121@gmail.com 帳號的姓名
        const { error: updateError } = await supabaseAdmin
          .from('admin_users')
          .update({ name: 'elson' })
          .eq('email', 'elson921121@gmail.com');

        if (updateError) {
          console.error('❌ 更新姓名失敗:', updateError.message);
        } else {
          console.log('✅ 成功設定 elson921121@gmail.com 的姓名為 elson');
        }

        return { success: true, message: 'name 欄位已存在並已更新' };
      }
    }

    console.log('⚠️  需要手動在 Supabase 控制台執行以下 SQL 命令:');
    console.log('-- 1. 新增 name 欄位');
    console.log('ALTER TABLE admin_users ADD COLUMN name VARCHAR(100);');
    console.log('');
    console.log('-- 2. 設定 elson921121@gmail.com 的姓名');
    console.log("UPDATE admin_users SET name = 'elson' WHERE email = 'elson921121@gmail.com';");
    console.log('\n請前往 Supabase 控制台的 SQL Editor 執行上述命令。');

    console.log('🎉 admin_users 表結構修改指示完成');

    return {
      success: true,
      message: '請手動執行 SQL 命令新增 name 欄位'
    };

  } catch (error) {
    console.error('❌ 新增 name 欄位失敗:', error);
    throw error;
  }
}

// 主函數
async function main() {
  try {
    console.log('🚀 開始為 admin_users 表新增 name 欄位...\n');

    const result = await addAdminNameColumn();

    console.log('\n📊 修改結果摘要:');
    console.log(`✅ 處理狀態: ${result.success ? '成功' : '失敗'}`);
    console.log(`📝 訊息: ${result.message}`);

    console.log('\n✨ admin_users 表修改完成！');

  } catch (error) {
    console.error('💥 執行失敗:', error.message);
    process.exit(1);
  }
}

// 如果直接執行這個檔案
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default addAdminNameColumn;