// Buddies 问题调试工具
// 在浏览器控制台中运行这段代码

console.log('🔍 开始 Buddies 问题诊断...');

// 检查 1: Supabase 连接
function checkSupabaseConnection() {
  console.log('\n=== 检查 1: Supabase 连接 ===');

  if (typeof window !== 'undefined' && window.supabase) {
    console.log('✅ Supabase 客户端存在');
    console.log('📍 Supabase URL:', window.supabase.supabaseUrl);
  } else {
    console.error('❌ Supabase 客户端不存在');
  }
}

// 检查 2: 数据库表结构
async function checkTableStructure() {
  console.log('\n=== 检查 2: 数据库表结构 ===');

  try {
    const { supabase } = await import('./src/services/supabaseService.js');

    // 检查 buddies_answers 表是否存在
    const { data, error } = await supabase
      .from('buddies_answers')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ buddies_answers 表访问失败:', error);

      // 尝试检查表是否存在
      const { data: tables, error: tableError } = await supabase
        .rpc('get_table_info', { table_name: 'buddies_answers' });

      if (tableError) {
        console.error('❌ 无法检查表信息:', tableError);
      }
    } else {
      console.log('✅ buddies_answers 表访问成功');
      console.log('📊 示例数据:', data);
    }
  } catch (error) {
    console.error('❌ 检查表结构时出错:', error);
  }
}

// 检查 3: 手动测试答案提交
async function testAnswerSubmission() {
  console.log('\n=== 检查 3: 测试答案提交 ===');

  try {
    const { questionService } = await import('./src/services/supabaseService.js');

    const testData = {
      roomId: 'TEST_' + Date.now(),
      userId: 'DEBUG_USER_' + Date.now(),
      answers: ['测试答案1'],
      questionTexts: ['测试问题1'],
      questionSources: ['basic']
    };

    console.log('📝 尝试提交测试数据:', testData);

    const result = await questionService.submitAnswers(
      testData.roomId,
      testData.userId,
      testData.answers,
      testData.questionTexts,
      testData.questionSources
    );

    if (result.success) {
      console.log('✅ 答案提交成功:', result.data);

      // 尝试读取刚提交的数据
      const readResult = await questionService.getAllAnswers(testData.roomId);
      if (readResult.success) {
        console.log('✅ 答案读取成功:', readResult.data);
      } else {
        console.error('❌ 答案读取失败:', readResult.error);
      }
    } else {
      console.error('❌ 答案提交失败:', result.error);
    }
  } catch (error) {
    console.error('❌ 测试答案提交时出错:', error);
  }
}

// 检查 4: 当前房间状态
function checkCurrentRoomState() {
  console.log('\n=== 检查 4: 当前房间状态 ===');

  // 检查当前页面是否在 Buddies 模式
  const currentPath = window.location.pathname;
  console.log('📍 当前页面路径:', currentPath);

  if (currentPath.includes('buddies')) {
    console.log('✅ 当前在 Buddies 页面');

    // 尝试获取房间 ID
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('roomId') || urlParams.get('room');

    if (roomId) {
      console.log('🏠 当前房间 ID:', roomId);

      // 检查 localStorage 中的用户 ID
      const userId = localStorage.getItem('userId');
      console.log('👤 当前用户 ID:', userId);

      // 检查是否有全局状态
      if (window.React && window.React.version) {
        console.log('⚛️ React 版本:', window.React.version);
      }
    } else {
      console.log('❓ 没有找到房间 ID');
    }
  } else {
    console.log('❓ 不在 Buddies 页面');
  }
}

// 检查 5: 控制台错误
function checkConsoleErrors() {
  console.log('\n=== 检查 5: 监听控制台错误 ===');

  // 重写 console.error 来捕获错误
  const originalError = console.error;
  console.error = function(...args) {
    if (args.some(arg =>
      typeof arg === 'string' &&
      (arg.includes('buddies') || arg.includes('answer') || arg.includes('supabase'))
    )) {
      console.log('🚨 发现相关错误:', args);
    }
    originalError.apply(console, args);
  };

  console.log('✅ 错误监听器已设置');
}

// 执行所有检查
async function runAllChecks() {
  checkSupabaseConnection();
  await checkTableStructure();
  await testAnswerSubmission();
  checkCurrentRoomState();
  checkConsoleErrors();

  console.log('\n🎯 诊断完成！请查看上面的结果找出问题所在。');
  console.log('💡 提示：如果看到任何 ❌ 错误，那就是需要修复的地方。');
}

// 立即执行
runAllChecks().catch(console.error);

// 也导出函数供手动调用
if (typeof window !== 'undefined') {
  window.debugBuddies = {
    checkSupabaseConnection,
    checkTableStructure,
    testAnswerSubmission,
    checkCurrentRoomState,
    runAllChecks
  };

  console.log('💡 调试函数已添加到 window.debugBuddies');
}