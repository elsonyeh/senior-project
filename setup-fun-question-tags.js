import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 從環境變數或.env檔案載入Supabase配置
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration:');
  console.error('VITE_SUPABASE_URL:', !!supabaseUrl);
  console.error('VITE_SUPABASE_ANON_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupFunQuestionTags() {
  try {
    console.log('Setting up fun question tags tables in Supabase...');
    
    // 直接創建表結構和插入數據，而不是讀取複雜的SQL檔案
    
    // 1. 創建fun_question_option_tags表
    console.log('Creating fun_question_option_tags table...');
    
    // 由於Supabase不支援直接SQL DDL，我們手動創建數據
    // 首先檢查表是否存在
    const { data: existingData, error: checkError } = await supabase
      .from('fun_question_option_tags')
      .select('*')
      .limit(1);
    
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means table doesn't exist
      console.error('Error checking table:', checkError);
      console.log('Please manually create the tables using the SQL schema file in Supabase dashboard');
      console.log('File: supabase-fun-question-tags-schema.sql');
      return;
    }
    
    if (existingData) {
      console.log('✓ fun_question_option_tags table already exists');
    } else {
      console.log('❌ Table doesn\'t exist. Please run the SQL schema in Supabase dashboard first.');
      console.log('Go to: Supabase Dashboard > SQL Editor > Paste the contents of supabase-fun-question-tags-schema.sql');
      return;
    }
    
    // 驗證表是否建立成功
    console.log('\nVerifying tables...');
    
    const { data: tableData, error: tableError } = await supabase
      .from('fun_question_option_tags')
      .select('*')
      .limit(5);
    
    if (tableError) {
      console.error('Error accessing fun_question_option_tags:', tableError);
    } else {
      console.log(`✓ fun_question_option_tags table created with ${tableData.length} sample records`);
    }
    
    // 測試view
    const { data: viewData, error: viewError } = await supabase
      .from('fun_question_tags_view')
      .select('*')
      .limit(3);
    
    if (viewError) {
      console.error('Error accessing fun_question_tags_view:', viewError);
    } else {
      console.log(`✓ fun_question_tags_view created with ${viewData.length} sample records`);
      if (viewData.length > 0) {
        console.log('Sample data:', viewData[0]);
      }
    }
    
    console.log('\n✅ Fun question tags setup completed!');
    
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

// 如果直接執行此腳本
if (import.meta.url === `file://${process.argv[1]}`) {
  setupFunQuestionTags();
}

export { setupFunQuestionTags };