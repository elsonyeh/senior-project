// 診斷環境變數配置
console.log('🔍 診斷環境變數配置');
console.log('========================');

// 檢查前端環境變數
console.log('前端環境變數 (Vite):');
console.log('VITE_SUPABASE_URL:', import.meta.env?.VITE_SUPABASE_URL || 'undefined');
console.log('VITE_SUPABASE_ANON_KEY存在:', !!(import.meta.env?.VITE_SUPABASE_ANON_KEY));

// 檢查 .env 文件是否存在
console.log('\n📁 檢查環境文件:');
console.log('Current directory:', process.cwd ? process.cwd() : 'browser environment');

// 如果是 Node.js 環境
if (typeof process !== 'undefined' && process.env) {
  console.log('\n後端環境變數 (Node.js):');
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL || 'undefined');
  console.log('SUPABASE_SERVICE_ROLE_KEY存在:', !!(process.env.SUPABASE_SERVICE_ROLE_KEY));
}

console.log('\n✅ 診斷完成');