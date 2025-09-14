// 更新管理員姓名腳本
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// 從環境變數獲取配置
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少必要的環境變數');
  console.error('需要: VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// 建立管理客戶端
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function updateAdminNames() {
  try {
    console.log('🔍 查找沒有姓名的管理員...');

    // 查找所有沒有姓名或姓名為空的管理員
    const { data: admins, error: selectError } = await supabase
      .from('admin_users')
      .select('id, email, name')
      .eq('is_active', true)
      .or('name.is.null,name.eq.');

    if (selectError) {
      throw selectError;
    }

    console.log(`找到 ${admins.length} 個需要更新姓名的管理員：`);

    if (admins.length === 0) {
      console.log('✅ 所有管理員都已有姓名');
      return;
    }

    // 為每個管理員更新姓名
    for (const admin of admins) {
      const defaultName = admin.email.split('@')[0]; // 使用郵箱前綴

      console.log(`📝 更新 ${admin.email} 的姓名為: ${defaultName}`);

      const { error: updateError } = await supabase
        .from('admin_users')
        .update({ name: defaultName })
        .eq('id', admin.id);

      if (updateError) {
        console.error(`❌ 更新 ${admin.email} 失敗:`, updateError.message);
      } else {
        console.log(`✅ 成功更新 ${admin.email}`);
      }
    }

    console.log('🎉 管理員姓名更新完成！');

  } catch (error) {
    console.error('❌ 更新管理員姓名失敗:', error);
    process.exit(1);
  }
}

// 執行更新
updateAdminNames();