const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA0NDg1NjcsImV4cCI6MjA0NjAyNDU2N30.HlNg6RkFP3ioKdaZOTTlZN8l42ZP5v2m8ZcxO2vt0Fc';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration(filename) {
  try {
    const filePath = path.join(__dirname, '..', 'migrations', filename);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`執行遷移: ${filename}`);

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // 如果 exec_sql 函數不存在，嘗試直接執行
      console.log('exec_sql 函數不存在，嘗試分段執行...');

      // 分割 SQL 並執行每個語句
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'));

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            console.log('執行:', statement.substring(0, 100) + '...');
            const result = await supabase.rpc('exec', { query: statement });
            if (result.error) {
              console.error('錯誤:', result.error);
            }
          } catch (err) {
            console.error('執行失敗:', err.message);
          }
        }
      }
    } else {
      console.log('✅ 遷移成功:', data);
    }
  } catch (error) {
    console.error('❌ 遷移失敗:', error.message);
    throw error;
  }
}

// 執行遷移
const migrationFile = process.argv[2] || '2025-12-18-add-atomic-answer-update-function.sql';
runMigration(migrationFile)
  .then(() => {
    console.log('遷移完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('遷移失敗:', error);
    process.exit(1);
  });
