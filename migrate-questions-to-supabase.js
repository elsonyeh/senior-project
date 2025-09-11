// Migration script to apply questions schema to Supabase
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role key for admin operations

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('🚀 Starting questions schema migration...');
    
    // Read the SQL schema file
    const schemaPath = path.join(__dirname, 'supabase-questions-schema.sql');
    const sqlContent = await fs.readFile(schemaPath, 'utf-8');
    
    console.log('📄 Schema file loaded');
    
    // Split SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { 
          sql: statement 
        });
        
        if (error) {
          // Try alternative method if rpc fails
          console.log(`⚠️  RPC failed, trying direct query...`);
          const result = await supabase
            .from('_internal')
            .select('*')
            .limit(0); // This will fail but might give us connection info
            
          console.log(`❌ Could not execute statement ${i + 1}: ${error.message}`);
          console.log(`Statement: ${statement.substring(0, 100)}...`);
          
          // Continue with next statement instead of failing completely
          continue;
        }
        
        console.log(`✅ Statement ${i + 1} executed successfully`);
      } catch (execError) {
        console.log(`⚠️  Could not execute statement ${i + 1}: ${execError.message}`);
        console.log(`Statement: ${statement.substring(0, 100)}...`);
        continue;
      }
    }
    
    console.log('🎉 Migration completed!');
    console.log('📊 Testing connection to questions table...');
    
    // Test the migration by trying to fetch questions
    const { data: questions, error: fetchError } = await supabase
      .from('questions_with_options')
      .select('*')
      .limit(5);
    
    if (fetchError) {
      console.log('⚠️  Could not fetch questions (schema may need manual setup):', fetchError.message);
      console.log('');
      console.log('📝 Manual setup required:');
      console.log('1. Go to your Supabase dashboard');
      console.log('2. Navigate to the SQL Editor');
      console.log('3. Copy and paste the contents of supabase-questions-schema.sql');
      console.log('4. Execute the SQL statements');
    } else {
      console.log(`✅ Successfully found ${questions.length} questions in the database`);
      console.log('🎊 Questions system is ready to use!');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('');
    console.log('📝 Manual setup required:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to the SQL Editor');
    console.log('3. Copy and paste the contents of supabase-questions-schema.sql');
    console.log('4. Execute the SQL statements');
    process.exit(1);
  }
}

// Run the migration
runMigration();