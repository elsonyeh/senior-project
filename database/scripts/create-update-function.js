const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA0NDg1NjcsImV4cCI6MjA0NjAyNDU2N30.HlNg6RkFP3ioKdaZOTTlZN8l42ZP5v2m8ZcxO2vt0Fc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createFunction() {
  try {
    console.log('正在創建 update_member_answer 函數...');

    // 測試函數是否已存在
    const testResult = await supabase
      .rpc('update_member_answer', {
        p_room_id: 'test',
        p_user_id: 'test',
        p_answer_data: { test: true }
      });

    if (!testResult.error || testResult.error.code !== 'PGRST202') {
      console.log('✅ update_member_answer 函數已存在且可用');
      return;
    }

    console.log('❌ 函數不存在，需要在 Supabase SQL Editor 中手動創建');
    console.log('');
    console.log('請在 Supabase Dashboard > SQL Editor 中執行以下 SQL：');
    console.log('');
    console.log('CREATE OR REPLACE FUNCTION update_member_answer(');
    console.log('  p_room_id text,');
    console.log('  p_user_id text,');
    console.log('  p_answer_data jsonb');
    console.log(')');
    console.log('RETURNS void');
    console.log('LANGUAGE plpgsql');
    console.log('AS $$');
    console.log('BEGIN');
    console.log('  UPDATE buddies_rooms');
    console.log('  SET');
    console.log('    member_answers = COALESCE(member_answers, \'{}\\'::jsonb) || jsonb_build_object(p_user_id, p_answer_data),');
    console.log('    last_updated = now()');
    console.log('  WHERE id = p_room_id;');
    console.log('');
    console.log('  IF NOT FOUND THEN');
    console.log('    RAISE EXCEPTION \'房間不存在: %\', p_room_id;');
    console.log('  END IF;');
    console.log('END;');
    console.log('$$;');
    console.log('');
    console.log('或執行遷移文件:');
    console.log('database/migrations/2025-12-18-add-atomic-answer-update-function.sql');
  } catch (error) {
    console.error('錯誤:', error.message);
  }
}

createFunction()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('失敗:', error);
    process.exit(1);
  });
