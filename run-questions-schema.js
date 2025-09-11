import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyODg2MzksImV4cCI6MjA3Mjg2NDYzOX0.70DEISL5yyN1ZW-KNwhhTl-D43hyb4uG3LSNq2dGZp0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runQuestionsSchema() {
  try {
    console.log('Reading questions schema SQL file...');
    const sqlScript = fs.readFileSync('supabase-questions-schema.sql', 'utf8');
    
    // Split the SQL into individual statements
    const statements = sqlScript
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`Found ${statements.length} SQL statements to execute...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      
      try {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        console.log(`Statement preview: ${statement.substring(0, 100)}...`);
        
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
        
        if (error) {
          console.log(`⚠️  Statement ${i + 1} error (might be expected): ${error.message}`);
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (e) {
        console.log(`❌ Statement ${i + 1} failed: ${e.message}`);
      }
    }
    
    console.log('\n🎉 Schema execution completed!');
    
    // Verify tables were created
    console.log('\nVerifying tables...');
    const testTables = ['question_types', 'questions', 'question_options'];
    
    for (const table of testTables) {
      try {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
          console.log(`❌ Table '${table}': ${error.message}`);
        } else {
          console.log(`✅ Table '${table}' exists`);
        }
      } catch (e) {
        console.log(`❌ Table '${table}' error: ${e.message}`);
      }
    }
    
    // Try the view
    try {
      const { data, error } = await supabase.from('questions_with_options').select('*').limit(1);
      if (error) {
        console.log(`❌ View 'questions_with_options': ${error.message}`);
      } else {
        console.log(`✅ View 'questions_with_options' exists`);
      }
    } catch (e) {
      console.log(`❌ View 'questions_with_options' error: ${e.message}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

runQuestionsSchema();