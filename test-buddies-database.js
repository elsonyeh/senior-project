// 测试 Buddies 数据库操作
import { questionService } from './src/services/supabaseService.js';

async function testBuddiesDatabase() {
  console.log('🧪 开始测试 Buddies 数据库操作...');

  const testRoomId = 'TEST_ROOM_' + Date.now();
  const testUserId = 'TEST_USER_' + Date.now();
  const testAnswers = ['平價美食', '吃'];
  const testQuestionTexts = ['想吃奢華點還是平價？', '想吃正餐還是想喝飲料？'];
  const testQuestionSources = ['basic', 'basic'];

  try {
    // 1. 测试提交答案
    console.log('📝 测试提交答案...');
    const submitResult = await questionService.submitAnswers(
      testRoomId,
      testUserId,
      testAnswers,
      testQuestionTexts,
      testQuestionSources
    );

    if (submitResult.success) {
      console.log('✅ 答案提交成功:', submitResult.data);
    } else {
      console.error('❌ 答案提交失败:', submitResult.error);
      return;
    }

    // 2. 测试获取答案
    console.log('📊 测试获取答案...');
    const getResult = await questionService.getAllAnswers(testRoomId);

    if (getResult.success) {
      console.log('✅ 获取答案成功:', getResult.data);
    } else {
      console.error('❌ 获取答案失败:', getResult.error);
    }

    // 3. 测试更新答案（upsert）
    console.log('🔄 测试更新答案...');
    const updatedAnswers = ['平價美食', '吃', '不辣'];
    const updatedQuestionTexts = [...testQuestionTexts, '想吃辣的還是不辣？'];
    const updatedQuestionSources = [...testQuestionSources, 'basic'];

    const updateResult = await questionService.submitAnswers(
      testRoomId,
      testUserId,
      updatedAnswers,
      updatedQuestionTexts,
      updatedQuestionSources
    );

    if (updateResult.success) {
      console.log('✅ 答案更新成功:', updateResult.data);
    } else {
      console.error('❌ 答案更新失败:', updateResult.error);
    }

    // 4. 再次验证数据
    console.log('🔍 验证最终数据...');
    const finalResult = await questionService.getAllAnswers(testRoomId);

    if (finalResult.success) {
      console.log('✅ 最终数据验证成功:', finalResult.data);

      const userAnswer = finalResult.data.find(answer => answer.user_id === testUserId);
      if (userAnswer && userAnswer.answers.length === 3) {
        console.log('🎉 测试全部通过！答案数量正确:', userAnswer.answers);
      } else {
        console.error('❌ 答案数量不正确:', userAnswer);
      }
    }

  } catch (error) {
    console.error('💥 测试过程中发生错误:', error);
  }
}

// 如果直接运行此文件，执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testBuddiesDatabase();
}

export { testBuddiesDatabase };