/**
 * 執行資料庫遷移腳本
 * 使用方法: node database/run-migration.js migrations/2025-12-18-add-swiping-completed-event.sql
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// 載入環境變數
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

dotenv.config({ path: join(projectRoot, '.env') });

// 獲取 Supabase 配置
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 錯誤: 缺少 VITE_SUPABASE_URL 或 VITE_SUPABASE_SERVICE_KEY 環境變數');
  process.exit(1);
}

// 創建 Supabase 客戶端（使用 service_role key 以獲得完整權限）
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration(migrationFile) {
  try {
    console.log('📁 讀取遷移文件:', migrationFile);

    // 讀取 SQL 文件
    const sqlPath = join(__dirname, migrationFile);
    const sql = readFileSync(sqlPath, 'utf-8');

    console.log('🚀 執行遷移...\n');
    console.log('SQL 內容:');
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));
    console.log('');

    // 執行 SQL（注意：Supabase JS 客戶端不直接支援執行任意 SQL）
    // 我們需要使用 RPC 或直接使用 PostgreSQL 客戶端

    console.log('⚠️  注意: Supabase JS 客戶端無法直接執行 DDL 語句');
    console.log('');
    console.log('請執行以下步驟：');
    console.log('1. 打開 Supabase Dashboard: https://supabase.com/dashboard/project/ijgelbxfrahtrrcjijqf');
    console.log('2. 點擊左側選單的 "SQL Editor"');
    console.log('3. 點擊 "New query"');
    console.log('4. 複製貼上以下 SQL:');
    console.log('');
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));
    console.log('');
    console.log('5. 點擊 "Run" 執行');
    console.log('');
    console.log('或者，將以上 SQL 複製到剪貼簿，我已經為您準備好了！');

  } catch (error) {
    console.error('❌ 執行遷移失敗:', error);
    process.exit(1);
  }
}

// 獲取命令列參數
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('❌ 錯誤: 請提供遷移文件路徑');
  console.log('使用方法: node database/run-migration.js migrations/2025-12-18-add-swiping-completed-event.sql');
  process.exit(1);
}

runMigration(migrationFile);
