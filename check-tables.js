import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyODg2MzksImV4cCI6MjA3Mjg2NDYzOX0.70DEISL5yyN1ZW-KNwhhTl-D43hyb4uG3LSNq2dGZp0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  try {
    console.log('Checking available tables...');
    
    // Try to query some expected tables directly
    const testTables = ['questions', 'question_options', 'question_types', 'buddies_questions'];
    
    for (const table of testTables) {
      try {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
          console.log(`❌ Table '${table}' does not exist or is not accessible: ${error.message}`);
        } else {
          console.log(`✅ Table '${table}' exists and has ${data.length} records (showing first 1)`);
          if (data.length > 0) {
            console.log('   Sample record:', JSON.stringify(data[0], null, 2));
          }
        }
      } catch (e) {
        console.log(`❌ Table '${table}' error: ${e.message}`);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkTables();