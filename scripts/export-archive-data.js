/**
 * 匯出歸檔數據到本地檔案
 *
 * 用途：
 * - 防止 Supabase 存儲空間不足
 * - 定期備份歷史數據
 * - 支援 JSON 和 CSV 格式
 *
 * 執行：node scripts/export-archive-data.js
 *
 * 參數：
 * - --format=json|csv|both (預設: both)
 * - --since=YYYY-MM-DD (只匯出指定日期後的數據)
 * - --compress (壓縮輸出檔案)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
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
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  acc[key.replace('--', '')] = value || true;
  return acc;
}, {});

const format = args.format || 'both';
const sinceDate = args.since || null;
const compress = args.compress || false;

/**
 * 主匯出函數
 */
async function exportArchiveData() {
  try {
    console.log('🚀 開始匯出歸檔數據...');
    console.log(`   格式: ${format}`);
    if (sinceDate) {
      console.log(`   起始日期: ${sinceDate}`);
    }
    console.log('');

    const timestamp = new Date().toISOString().split('T')[0];
    const exportDir = 'exports';

    // 確保 exports 目錄存在
    await fs.mkdir(exportDir, { recursive: true });

    // 1. 匯出 buddies_rooms_archive
    console.log('📦 匯出 buddies_rooms_archive...');
    const archives = await fetchArchiveData(sinceDate);
    console.log(`   ✓ 獲取 ${archives.length} 筆記錄`);

    if (format === 'json' || format === 'both') {
      const jsonFile = path.join(exportDir, `buddies_rooms_archive_${timestamp}.json`);
      await fs.writeFile(jsonFile, JSON.stringify(archives, null, 2));
      const size = await getFileSize(jsonFile);
      console.log(`   ✓ JSON: ${jsonFile} (${size})`);
    }

    if (format === 'csv' || format === 'both') {
      const csvFile = path.join(exportDir, `buddies_rooms_archive_${timestamp}.csv`);
      const csv = convertToCSV(archives);
      await fs.writeFile(csvFile, csv);
      const size = await getFileSize(csvFile);
      console.log(`   ✓ CSV: ${csvFile} (${size})`);
    }

    // 2. 匯出 buddies_events
    console.log('');
    console.log('📦 匯出 buddies_events...');
    const events = await fetchEventsData(sinceDate);
    console.log(`   ✓ 獲取 ${events.length} 筆事件`);

    if (format === 'json' || format === 'both') {
      const jsonFile = path.join(exportDir, `buddies_events_${timestamp}.json`);
      await fs.writeFile(jsonFile, JSON.stringify(events, null, 2));
      const size = await getFileSize(jsonFile);
      console.log(`   ✓ JSON: ${jsonFile} (${size})`);
    }

    if (format === 'csv' || format === 'both') {
      const csvFile = path.join(exportDir, `buddies_events_${timestamp}.csv`);
      const csv = convertToCSV(events);
      await fs.writeFile(csvFile, csv);
      const size = await getFileSize(csvFile);
      console.log(`   ✓ CSV: ${csvFile} (${size})`);
    }

    // 3. 匯出統計摘要
    console.log('');
    console.log('📊 生成統計摘要...');
    const summary = generateSummary(archives, events);
    const summaryFile = path.join(exportDir, `export_summary_${timestamp}.json`);
    await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`   ✓ 摘要: ${summaryFile}`);

    console.log('');
    console.log('✅ 匯出完成！');
    console.log('');
    console.log('📈 統計摘要：');
    console.log(`   總房間數：${summary.total_rooms}`);
    console.log(`   總事件數：${summary.total_events}`);
    console.log(`   平均成員數：${summary.avg_members}`);
    console.log(`   平均決策時間：${summary.avg_decision_minutes} 分鐘`);
    console.log(`   匯出檔案大小：${summary.total_size}`);

  } catch (error) {
    console.error('❌ 匯出失敗:', error);
    process.exit(1);
  }
}

/**
 * 獲取歸檔數據
 */
async function fetchArchiveData(sinceDate) {
  let query = supabase
    .from('buddies_rooms_archive')
    .select('*')
    .order('archived_at', { ascending: true });

  if (sinceDate) {
    query = query.gte('archived_at', sinceDate);
  }

  const { data, error } = await query;

  if (error) throw new Error(`獲取歸檔數據失敗: ${error.message}`);

  return data || [];
}

/**
 * 獲取事件數據
 */
async function fetchEventsData(sinceDate) {
  let query = supabase
    .from('buddies_events')
    .select('*')
    .order('created_at', { ascending: true });

  if (sinceDate) {
    query = query.gte('created_at', sinceDate);
  }

  const { data, error } = await query;

  if (error) throw new Error(`獲取事件數據失敗: ${error.message}`);

  return data || [];
}

/**
 * 轉換為 CSV 格式
 */
function convertToCSV(data) {
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = data.map(row =>
    headers.map(header => escapeCSV(row[header])).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * 生成統計摘要
 */
function generateSummary(archives, events) {
  const totalRooms = archives.length;
  const totalEvents = events.length;

  const avgMembers = archives.length > 0
    ? (archives.reduce((sum, r) => sum + (r.member_count || 0), 0) / archives.length).toFixed(2)
    : 0;

  const avgDecisionMinutes = archives.length > 0
    ? (archives.reduce((sum, r) => sum + (r.decision_time_seconds || 0), 0) / archives.length / 60).toFixed(2)
    : 0;

  const eventTypes = events.reduce((acc, e) => {
    acc[e.event_type] = (acc[e.event_type] || 0) + 1;
    return acc;
  }, {});

  return {
    export_date: new Date().toISOString(),
    total_rooms: totalRooms,
    total_events: totalEvents,
    avg_members: avgMembers,
    avg_decision_minutes: avgDecisionMinutes,
    event_types: eventTypes,
    total_size: 'N/A' // 將在後續計算
  };
}

/**
 * 獲取檔案大小
 */
async function getFileSize(filePath) {
  const stats = await fs.stat(filePath);
  const bytes = stats.size;

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// 執行匯出
exportArchiveData();
