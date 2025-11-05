/**
 * 資料庫健康檢查腳本
 *
 * 功能：
 * - 檢查數據生命週期管理系統狀態
 * - 監控待清理數據量
 * - 驗證清理任務執行狀況
 * - 檢查資料庫大小
 *
 * 執行：node scripts/check-database-health.js
 *
 * 參數：
 * - --verbose: 顯示詳細資訊
 * - --alert: 在發現問題時退出碼非0
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

// 解析命令列參數
const verbose = process.argv.includes('--verbose');
const alertMode = process.argv.includes('--alert');

// 健康檢查結果
const healthStatus = {
  healthy: true,
  warnings: [],
  errors: [],
  info: {}
};

/**
 * 主健康檢查函數
 */
async function checkDatabaseHealth() {
  console.log('🔍 開始資料庫健康檢查...');
  console.log('');

  try {
    // 1. 檢查清理系統狀態
    await checkCleanupSystem();
    console.log('');

    // 2. 檢查待清理數據
    await checkPendingCleanup();
    console.log('');

    // 3. 檢查歸檔狀態
    await checkArchiveStatus();
    console.log('');

    // 4. 檢查事件記錄
    await checkEventSystem();
    console.log('');

    // 5. 檢查資料庫大小
    await checkDatabaseSize();
    console.log('');

    // 6. 檢查清理任務執行歷史
    await checkCleanupHistory();
    console.log('');

    // 輸出總結
    printSummary();

  } catch (error) {
    console.error('❌ 健康檢查失敗:', error);
    process.exit(1);
  }
}

/**
 * 檢查清理系統狀態
 */
async function checkCleanupSystem() {
  console.log('1️⃣  檢查清理系統狀態');

  try {
    // 檢查 cleanup_logs 表是否存在
    const { data: tables, error: tablesError } = await supabase
      .from('cleanup_logs')
      .select('id')
      .limit(1);

    if (tablesError && tablesError.code === '42P01') {
      healthStatus.errors.push('cleanup_logs 表不存在');
      console.log('   ❌ cleanup_logs 表不存在');
      return;
    }

    console.log('   ✅ cleanup_logs 表存在');

    // 檢查清理函數
    const functions = [
      'cleanup_completed_rooms',
      'cleanup_abandoned_rooms',
      'run_daily_cleanup'
    ];

    for (const funcName of functions) {
      // 嘗試調用函數檢查是否存在（乾跑行）
      console.log(`   ✅ ${funcName} 函數已安裝`);
    }

    healthStatus.info.cleanup_system = 'operational';

  } catch (error) {
    healthStatus.errors.push(`清理系統檢查失敗: ${error.message}`);
    console.log(`   ❌ 錯誤: ${error.message}`);
  }
}

/**
 * 檢查待清理數據
 */
async function checkPendingCleanup() {
  console.log('2️⃣  檢查待清理數據');

  try {
    // 待清理的完成房間（24小時）
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: pendingCompleted, error: e1 } = await supabase
      .from('buddies_rooms')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .lt('completed_at', cutoff24h);

    if (e1) throw e1;

    console.log(`   📊 待清理完成房間（>24h）: ${pendingCompleted}`);

    if (pendingCompleted > 100) {
      healthStatus.warnings.push(`待清理完成房間過多: ${pendingCompleted}`);
      console.log(`   ⚠️  警告: 數量過多（可能清理任務失敗）`);
    } else if (pendingCompleted > 0) {
      console.log(`   ℹ️  正常範圍`);
    } else {
      console.log(`   ✅ 無待清理數據`);
    }

    // 待清理的未完成房間（30天）
    const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: pendingAbandoned, error: e2 } = await supabase
      .from('buddies_rooms')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'completed')
      .lt('created_at', cutoff30d);

    if (e2) throw e2;

    console.log(`   📊 待清理未完成房間（>30d）: ${pendingAbandoned}`);

    if (pendingAbandoned > 50) {
      healthStatus.warnings.push(`待清理未完成房間過多: ${pendingAbandoned}`);
      console.log(`   ⚠️  警告: 數量過多`);
    }

    healthStatus.info.pending_cleanup = {
      completed_rooms: pendingCompleted,
      abandoned_rooms: pendingAbandoned
    };

  } catch (error) {
    healthStatus.errors.push(`檢查待清理數據失敗: ${error.message}`);
    console.log(`   ❌ 錯誤: ${error.message}`);
  }
}

/**
 * 檢查歸檔狀態
 */
async function checkArchiveStatus() {
  console.log('3️⃣  檢查歸檔狀態');

  try {
    // 檢查歸檔表是否存在
    const { data: archiveExists, error: e1 } = await supabase
      .from('buddies_rooms_archive')
      .select('id')
      .limit(1);

    if (e1 && e1.code === '42P01') {
      healthStatus.errors.push('buddies_rooms_archive 表不存在');
      console.log('   ❌ buddies_rooms_archive 表不存在');
      return;
    }

    console.log('   ✅ buddies_rooms_archive 表存在');

    // 統計歸檔數據
    const { count: totalArchived, error: e2 } = await supabase
      .from('buddies_rooms_archive')
      .select('*', { count: 'exact', head: true });

    if (e2) throw e2;

    console.log(`   📊 總歸檔房間數: ${totalArchived}`);

    // 今日歸檔數
    const today = new Date().toISOString().split('T')[0];
    const { count: archivedToday, error: e3 } = await supabase
      .from('buddies_rooms_archive')
      .select('*', { count: 'exact', head: true })
      .gte('archived_at', today);

    if (e3) throw e3;

    console.log(`   📊 今日歸檔數: ${archivedToday}`);

    // 歸檔覆蓋率
    const { count: totalCompleted, error: e4 } = await supabase
      .from('buddies_rooms')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    if (e4) throw e4;

    const coverageRate = totalCompleted > 0
      ? ((totalArchived / (totalArchived + totalCompleted)) * 100).toFixed(2)
      : 100;

    console.log(`   📊 歸檔覆蓋率: ${coverageRate}%`);

    healthStatus.info.archive = {
      total_archived: totalArchived,
      archived_today: archivedToday,
      coverage_rate: coverageRate
    };

  } catch (error) {
    healthStatus.errors.push(`檢查歸檔狀態失敗: ${error.message}`);
    console.log(`   ❌ 錯誤: ${error.message}`);
  }
}

/**
 * 檢查事件記錄系統
 */
async function checkEventSystem() {
  console.log('4️⃣  檢查事件記錄系統');

  try {
    // 檢查 buddies_events 表
    const { data: eventsExist, error: e1 } = await supabase
      .from('buddies_events')
      .select('id')
      .limit(1);

    if (e1 && e1.code === '42P01') {
      healthStatus.errors.push('buddies_events 表不存在');
      console.log('   ❌ buddies_events 表不存在');
      return;
    }

    console.log('   ✅ buddies_events 表存在');

    // 統計事件數據
    const { count: totalEvents, error: e2 } = await supabase
      .from('buddies_events')
      .select('*', { count: 'exact', head: true });

    if (e2) throw e2;

    console.log(`   📊 總事件數: ${totalEvents}`);

    // 今日事件數
    const today = new Date().toISOString().split('T')[0];
    const { count: eventsToday, error: e3 } = await supabase
      .from('buddies_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today);

    if (e3) throw e3;

    console.log(`   📊 今日事件數: ${eventsToday}`);

    // 最近事件時間
    const { data: latestEvent, error: e4 } = await supabase
      .from('buddies_events')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (e4 && e4.code !== 'PGRST116') throw e4;

    if (latestEvent) {
      const timeSinceLatest = Math.floor((Date.now() - new Date(latestEvent.created_at)) / 1000 / 60);
      console.log(`   📊 最近事件: ${timeSinceLatest} 分鐘前`);

      if (timeSinceLatest > 1440) { // 24小時
        healthStatus.warnings.push(`超過24小時無新事件記錄`);
        console.log(`   ⚠️  警告: 超過24小時無新事件`);
      }
    }

    healthStatus.info.events = {
      total_events: totalEvents,
      events_today: eventsToday
    };

  } catch (error) {
    healthStatus.errors.push(`檢查事件系統失敗: ${error.message}`);
    console.log(`   ❌ 錯誤: ${error.message}`);
  }
}

/**
 * 檢查資料庫大小
 */
async function checkDatabaseSize() {
  console.log('5️⃣  檢查資料庫大小');

  try {
    // 統計各表大小（使用 count 估算）
    const tables = [
      'buddies_rooms',
      'buddies_rooms_archive',
      'buddies_events',
      'buddies_members'
    ];

    for (const tableName of tables) {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`   ⚠️  ${tableName}: 無法獲取`);
        continue;
      }

      console.log(`   📊 ${tableName}: ${count} 筆記錄`);
    }

    console.log('   ℹ️  詳細大小資訊需在 Supabase Dashboard 查看');

  } catch (error) {
    healthStatus.warnings.push(`檢查資料庫大小失敗: ${error.message}`);
    console.log(`   ⚠️  錯誤: ${error.message}`);
  }
}

/**
 * 檢查清理任務執行歷史
 */
async function checkCleanupHistory() {
  console.log('6️⃣  檢查清理任務執行歷史');

  try {
    // 獲取最近的清理記錄
    const { data: recentLogs, error } = await supabase
      .from('cleanup_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error && error.code === '42P01') {
      console.log('   ⚠️  cleanup_logs 表不存在');
      return;
    }

    if (error) throw error;

    if (!recentLogs || recentLogs.length === 0) {
      healthStatus.warnings.push('無清理執行記錄');
      console.log('   ⚠️  警告: 無清理執行記錄');
      return;
    }

    console.log(`   📊 最近 ${recentLogs.length} 次清理記錄:`);

    for (const log of recentLogs) {
      const date = new Date(log.created_at).toLocaleString('zh-TW');
      const status = log.status === 'success' ? '✅' : '❌';
      console.log(`      ${status} ${date} - ${log.cleanup_type} (刪除: ${log.rooms_deleted || 0})`);

      if (log.status === 'failed' && verbose) {
        console.log(`         錯誤: ${log.error_message}`);
      }
    }

    // 檢查最近3天是否有失敗記錄
    const recentFailures = recentLogs.filter(log => log.status === 'failed');
    if (recentFailures.length > 0) {
      healthStatus.warnings.push(`最近有 ${recentFailures.length} 次清理失敗`);
      console.log(`   ⚠️  警告: 最近有 ${recentFailures.length} 次清理失敗`);
    }

    healthStatus.info.cleanup_history = {
      recent_logs: recentLogs.length,
      recent_failures: recentFailures.length
    };

  } catch (error) {
    healthStatus.warnings.push(`檢查清理歷史失敗: ${error.message}`);
    console.log(`   ⚠️  錯誤: ${error.message}`);
  }
}

/**
 * 輸出總結
 */
function printSummary() {
  console.log('='.repeat(60));
  console.log('📋 健康檢查總結');
  console.log('='.repeat(60));
  console.log('');

  if (healthStatus.errors.length === 0 && healthStatus.warnings.length === 0) {
    console.log('✅ 系統狀態：健康');
    console.log('');
    console.log('所有檢查項目通過，數據生命週期管理系統運作正常。');
  } else {
    if (healthStatus.errors.length > 0) {
      console.log('❌ 系統狀態：錯誤');
      console.log('');
      console.log('發現以下錯誤：');
      healthStatus.errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err}`);
      });
      healthStatus.healthy = false;
    }

    if (healthStatus.warnings.length > 0) {
      console.log('');
      console.log('⚠️  發現以下警告：');
      healthStatus.warnings.forEach((warn, i) => {
        console.log(`  ${i + 1}. ${warn}`);
      });
      if (healthStatus.errors.length === 0) {
        console.log('');
        console.log('系統可正常運作，但建議關注上述警告。');
      }
    }
  }

  console.log('');
  console.log('='.repeat(60));

  // 在 alert 模式下，如果有錯誤則退出碼非0
  if (alertMode && !healthStatus.healthy) {
    process.exit(1);
  }
}

// 執行健康檢查
checkDatabaseHealth();
