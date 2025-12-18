import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ijgelbxfrahtrrcjijqf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZ2VsYnhmcmFodHJyY2ppanFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA0NDg1NjcsImV4cCI6MjA0NjAyNDU2N30.HlNg6RkFP3ioKdaZOTTlZN8l42ZP5v2m8ZcxO2vt0Fc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAnswers() {
  try {
    // 獲取參數：房間ID
    const roomId = process.argv[2];

    if (!roomId) {
      console.log('用法: node check-answer-records.js <room_id>');
      console.log('');
      console.log('或者查詢最近的房間:');
      const { data: recentRooms } = await supabase
        .from('buddies_rooms')
        .select('id, room_code, host_name, created_at, status')
        .order('created_at', { ascending: false })
        .limit(5);

      console.log('最近的房間:');
      recentRooms?.forEach(room => {
        console.log(`  - ${room.room_code} (${room.id}) - ${room.host_name} - ${room.status} - ${room.created_at}`);
      });
      return;
    }

    console.log(`查詢房間 ${roomId} 的答題記錄...\n`);

    // 獲取房間資料
    const { data: room, error } = await supabase
      .from('buddies_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (error || !room) {
      console.error('❌ 找不到房間:', error?.message);
      return;
    }

    console.log('='.repeat(60));
    console.log('房間資訊');
    console.log('='.repeat(60));
    console.log(`房間代碼: ${room.room_code}`);
    console.log(`房主: ${room.host_name}`);
    console.log(`狀態: ${room.status}`);
    console.log(`問題數: ${room.questions?.length || 0}`);
    console.log('');

    // 顯示集體答案
    console.log('='.repeat(60));
    console.log('集體答案 (collective_answers)');
    console.log('='.repeat(60));
    if (room.collective_answers && Object.keys(room.collective_answers).length > 0) {
      Object.entries(room.collective_answers).forEach(([index, answer]) => {
        const questionText = room.questions?.[index]?.text || `問題 ${index}`;
        console.log(`  [${index}] ${questionText}: ${answer}`);
      });
    } else {
      console.log('  (無集體答案)');
    }
    console.log('');

    // 顯示成員答案
    console.log('='.repeat(60));
    console.log('成員答案 (member_answers)');
    console.log('='.repeat(60));

    const memberAnswers = room.member_answers || {};
    const memberCount = Object.keys(memberAnswers).length;

    console.log(`總成員數: ${memberCount}\n`);

    // 獲取成員資訊
    const { data: members } = await supabase
      .from('buddies_members')
      .select('user_id, name, status')
      .eq('room_id', roomId);

    Object.entries(memberAnswers).forEach(([userId, userData], index) => {
      const member = members?.find(m => m.user_id === userId);
      const memberName = member?.name || userId;
      const memberStatus = member?.status || '未知';

      console.log(`成員 ${index + 1}: ${memberName} (${userId})`);
      console.log(`  狀態: ${memberStatus}`);
      console.log(`  完成: ${userData.completed ? '是' : '否'}`);
      console.log(`  提交時間: ${userData.submitted_at || '未知'}`);
      console.log(`  答案數量: ${userData.answers?.length || 0}`);

      if (userData.answers && userData.answers.length > 0) {
        console.log(`  答案內容:`);
        userData.answers.forEach((answer, idx) => {
          if (answer !== null && answer !== undefined) {
            const questionText = room.questions?.[idx]?.text || `問題 ${idx}`;
            console.log(`    [${idx}] ${questionText}: ${answer}`);
          }
        });
      }

      console.log('');
    });

    // 檢查問題索引 0（趣味問題）的答案
    console.log('='.repeat(60));
    console.log('趣味問題 (索引 0) 詳細分析');
    console.log('='.repeat(60));

    const funQuestionAnswers = [];
    Object.entries(memberAnswers).forEach(([userId, userData]) => {
      const member = members?.find(m => m.user_id === userId);
      if (userData.answers && userData.answers.length > 0 && userData.answers[0]) {
        funQuestionAnswers.push({
          userId,
          name: member?.name || userId,
          answer: userData.answers[0],
          submittedAt: userData.submitted_at
        });
      }
    });

    if (funQuestionAnswers.length > 0) {
      console.log(`回答趣味問題的成員數: ${funQuestionAnswers.length} / ${memberCount}`);
      console.log('');
      funQuestionAnswers.forEach((record, idx) => {
        console.log(`  ${idx + 1}. ${record.name}: "${record.answer}" (${record.submittedAt})`);
      });

      if (funQuestionAnswers.length < memberCount) {
        console.log('');
        console.log(`⚠️  警告: 有 ${memberCount - funQuestionAnswers.length} 位成員的趣味問題答案遺失！`);
        console.log('這可能是競態條件導致的答案覆蓋問題。');
      } else {
        console.log('');
        console.log('✅ 所有成員的趣味問題答案都已記錄');
      }
    } else {
      console.log('❌ 沒有任何成員回答趣味問題');
    }

    console.log('');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 查詢失敗:', error.message);
    console.error(error);
  }
}

checkAnswers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('失敗:', error);
    process.exit(1);
  });
