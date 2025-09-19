// SwiftTaste 選擇紀錄功能測試腳本
// 在瀏覽器控制台中執行此腳本來測試選擇紀錄功能

console.log('🚀 開始測試 SwiftTaste 選擇紀錄功能...');

// 測試 1: 檢查服務是否正確載入
async function testServiceLoading() {
  console.log('\n📦 測試 1: 檢查選擇紀錄服務載入...');

  try {
    // 檢查 selectionHistoryService 是否可用
    if (typeof window.selectionHistoryService !== 'undefined') {
      console.log('✅ selectionHistoryService 已在全域可用');
    } else {
      console.log('⚠️ selectionHistoryService 未在全域，嘗試動態匯入...');

      // 嘗試從服務文件匯入
      const module = await import('./src/services/selectionHistoryService.js');
      window.testService = module.default || module.selectionHistoryService;

      if (window.testService) {
        console.log('✅ 選擇紀錄服務成功載入');
        return window.testService;
      }
    }
  } catch (error) {
    console.error('❌ 服務載入失敗:', error);
    return null;
  }
}

// 測試 2: 測試會話管理
async function testSessionManagement(service) {
  console.log('\n🔄 測試 2: 會話管理功能...');

  try {
    // 開始新會話
    console.log('開始新的 SwiftTaste 會話...');
    const sessionResult = await service.startSession('swifttaste', {
      test: true,
      timestamp: new Date().toISOString()
    });

    if (sessionResult.success) {
      console.log('✅ 會話創建成功:', sessionResult.sessionId);

      // 測試會話更新
      const updateResult = await service.updateSession(sessionResult.sessionId, {
        test_update: true,
        updated_at: new Date().toISOString()
      });

      if (updateResult.success) {
        console.log('✅ 會話更新成功');
      } else {
        console.error('❌ 會話更新失敗:', updateResult.error);
      }

      return sessionResult.sessionId;
    } else {
      console.error('❌ 會話創建失敗:', sessionResult.error);
      return null;
    }
  } catch (error) {
    console.error('❌ 會話管理測試失敗:', error);
    return null;
  }
}

// 測試 3: 測試答案記錄
async function testAnswerRecording(service, sessionId) {
  console.log('\n📝 測試 3: 答案記錄功能...');

  if (!sessionId) {
    console.log('⚠️ 無效的會話ID，跳過答案記錄測試');
    return false;
  }

  try {
    // 測試基本答案記錄
    const basicAnswers = ['單人', '平價美食', '吃', '吃一點', '不辣'];
    const basicResult = await service.saveBasicAnswers(sessionId, basicAnswers);

    if (basicResult.success) {
      console.log('✅ 基本答案記錄成功');
    } else {
      console.error('❌ 基本答案記錄失敗:', basicResult.error);
    }

    // 測試趣味問題答案記錄
    const funAnswers = ['貓派', 'I人', '後背包'];
    const funResult = await service.saveFunAnswers(sessionId, funAnswers);

    if (funResult.success) {
      console.log('✅ 趣味問題答案記錄成功');
    } else {
      console.error('❌ 趣味問題答案記錄失敗:', funResult.error);
    }

    return basicResult.success && funResult.success;
  } catch (error) {
    console.error('❌ 答案記錄測試失敗:', error);
    return false;
  }
}

// 測試 4: 測試推薦記錄
async function testRecommendationRecording(service, sessionId) {
  console.log('\n🍽️ 測試 4: 推薦記錄功能...');

  if (!sessionId) {
    console.log('⚠️ 無效的會話ID，跳過推薦記錄測試');
    return false;
  }

  try {
    // 模擬餐廳推薦數據
    const mockRestaurants = [
      {
        id: 'test_restaurant_1',
        name: '測試餐廳 1',
        address: '台北市測試區測試路123號',
        rating: 4.5,
        price_range: '$',
        tags: ['測試標籤']
      },
      {
        id: 'test_restaurant_2',
        name: '測試餐廳 2',
        address: '台北市測試區測試路456號',
        rating: 4.2,
        price_range: '$$',
        tags: ['另一個測試標籤']
      }
    ];

    const recommendResult = await service.saveRecommendations(sessionId, mockRestaurants);

    if (recommendResult.success) {
      console.log('✅ 推薦餐廳記錄成功');

      // 測試最終選擇記錄
      const finalResult = await service.saveFinalRestaurant(sessionId, mockRestaurants[0]);

      if (finalResult.success) {
        console.log('✅ 最終選擇記錄成功');
        return true;
      } else {
        console.error('❌ 最終選擇記錄失敗:', finalResult.error);
        return false;
      }
    } else {
      console.error('❌ 推薦餐廳記錄失敗:', recommendResult.error);
      return false;
    }
  } catch (error) {
    console.error('❌ 推薦記錄測試失敗:', error);
    return false;
  }
}

// 測試 5: 測試用戶互動記錄
async function testUserInteractions(service, sessionId) {
  console.log('\n👆 測試 5: 用戶互動記錄功能...');

  if (!sessionId) {
    console.log('⚠️ 無效的會話ID，跳過互動記錄測試');
    return false;
  }

  try {
    // 測試滑動次數記錄
    for (let i = 0; i < 5; i++) {
      await service.incrementSwipeCount(sessionId);
    }
    console.log('✅ 滑動次數記錄成功 (模擬5次滑動)');

    // 測試喜歡的餐廳記錄
    const likedRestaurant = {
      id: 'liked_test_restaurant',
      name: '被喜歡的測試餐廳',
      rating: 4.8
    };

    const likedResult = await service.addLikedRestaurant(sessionId, likedRestaurant);

    if (likedResult.success) {
      console.log('✅ 喜歡餐廳記錄成功');
      return true;
    } else {
      console.error('❌ 喜歡餐廳記錄失敗:', likedResult.error);
      return false;
    }
  } catch (error) {
    console.error('❌ 用戶互動記錄測試失敗:', error);
    return false;
  }
}

// 測試 6: 測試歷史查詢
async function testHistoryQuery(service) {
  console.log('\n📊 測試 6: 歷史查詢功能...');

  try {
    // 查詢用戶歷史
    const historyResult = await service.getUserHistory(10);

    if (historyResult.success) {
      console.log('✅ 歷史查詢成功');
      console.log(`📝 找到 ${historyResult.data.length} 筆記錄`);

      if (historyResult.data.length > 0) {
        console.log('📋 最新記錄摘要:', {
          id: historyResult.data[0].id,
          mode: historyResult.data[0].mode,
          started_at: historyResult.data[0].started_at,
          basic_answers: historyResult.data[0].basic_answers?.length || 0,
          fun_answers: historyResult.data[0].fun_answers?.length || 0
        });
      }

      // 測試統計查詢
      const statsResult = await service.getUserStats();

      if (statsResult.success) {
        console.log('✅ 統計查詢成功');
        console.log('📈 用戶統計:', statsResult.stats);
        return true;
      } else {
        console.error('❌ 統計查詢失敗:', statsResult.error);
        return false;
      }
    } else {
      console.error('❌ 歷史查詢失敗:', historyResult.error);
      return false;
    }
  } catch (error) {
    console.error('❌ 歷史查詢測試失敗:', error);
    return false;
  }
}

// 測試 7: 測試會話完成
async function testSessionCompletion(service, sessionId) {
  console.log('\n🏁 測試 7: 會話完成功能...');

  if (!sessionId) {
    console.log('⚠️ 無效的會話ID，跳過會話完成測試');
    return false;
  }

  try {
    const completionResult = await service.completeSession(sessionId, {
      started_at: new Date(Date.now() - 60000).toISOString(), // 1分鐘前開始
      final_restaurant: {
        id: 'final_test_restaurant',
        name: '最終選擇的測試餐廳'
      }
    });

    if (completionResult.success) {
      console.log('✅ 會話完成記錄成功');
      return true;
    } else {
      console.error('❌ 會話完成記錄失敗:', completionResult.error);
      return false;
    }
  } catch (error) {
    console.error('❌ 會話完成測試失敗:', error);
    return false;
  }
}

// 主測試函數
async function runAllTests() {
  console.log('🎯 SwiftTaste 選擇紀錄功能完整測試開始');
  console.log('⏰ 測試時間:', new Date().toLocaleString());

  const results = {
    serviceLoading: false,
    sessionManagement: false,
    answerRecording: false,
    recommendationRecording: false,
    userInteractions: false,
    historyQuery: false,
    sessionCompletion: false
  };

  let sessionId = null;

  try {
    // 測試 1: 服務載入
    const service = await testServiceLoading();
    results.serviceLoading = !!service;

    if (!service) {
      console.log('❌ 無法載入服務，終止測試');
      return results;
    }

    // 測試 2: 會話管理
    sessionId = await testSessionManagement(service);
    results.sessionManagement = !!sessionId;

    // 測試 3: 答案記錄
    results.answerRecording = await testAnswerRecording(service, sessionId);

    // 測試 4: 推薦記錄
    results.recommendationRecording = await testRecommendationRecording(service, sessionId);

    // 測試 5: 用戶互動記錄
    results.userInteractions = await testUserInteractions(service, sessionId);

    // 測試 6: 歷史查詢
    results.historyQuery = await testHistoryQuery(service);

    // 測試 7: 會話完成
    results.sessionCompletion = await testSessionCompletion(service, sessionId);

  } catch (error) {
    console.error('❌ 測試執行中發生錯誤:', error);
  }

  // 測試結果摘要
  console.log('\n📊 測試結果摘要:');
  console.log('================');

  const testNames = {
    serviceLoading: '服務載入',
    sessionManagement: '會話管理',
    answerRecording: '答案記錄',
    recommendationRecording: '推薦記錄',
    userInteractions: '用戶互動記錄',
    historyQuery: '歷史查詢',
    sessionCompletion: '會話完成'
  };

  let passCount = 0;
  const totalTests = Object.keys(results).length;

  for (const [key, passed] of Object.entries(results)) {
    const status = passed ? '✅ 通過' : '❌ 失敗';
    console.log(`${testNames[key]}: ${status}`);
    if (passed) passCount++;
  }

  console.log('================');
  console.log(`📈 測試通過率: ${passCount}/${totalTests} (${Math.round(passCount/totalTests*100)}%)`);

  if (passCount === totalTests) {
    console.log('🎉 所有測試通過！選擇紀錄功能運作正常。');
  } else {
    console.log('⚠️ 部分測試失敗，請檢查相關功能。');
  }

  return results;
}

// 快速測試函數（僅測試基本功能）
async function quickTest() {
  console.log('⚡ 快速測試選擇紀錄功能...');

  try {
    const service = await testServiceLoading();

    if (service) {
      const sessionId = await testSessionManagement(service);
      if (sessionId) {
        console.log('✅ 基本功能正常運作');
        return true;
      }
    }

    console.log('❌ 基本功能有問題');
    return false;
  } catch (error) {
    console.error('❌ 快速測試失敗:', error);
    return false;
  }
}

// 導出測試函數供控制台使用
window.testSelectionHistory = {
  runAllTests,
  quickTest,
  testServiceLoading,
  testSessionManagement,
  testAnswerRecording,
  testRecommendationRecording,
  testUserInteractions,
  testHistoryQuery,
  testSessionCompletion
};

console.log('📚 測試腳本已載入！');
console.log('💡 使用方法:');
console.log('  - 完整測試: testSelectionHistory.runAllTests()');
console.log('  - 快速測試: testSelectionHistory.quickTest()');
console.log('  - 個別測試: testSelectionHistory.testServiceLoading() 等');

// 自動執行快速測試（可選）
// quickTest();