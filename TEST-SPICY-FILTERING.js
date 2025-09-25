// 測試腳本：驗證辣度篩選邏輯
// 在瀏覽器控制台中執行此腳本

console.log('🌶️ 開始測試辣度篩選邏輯...');

// 模擬測試餐廳資料
const testRestaurants = [
  { id: 1, name: '麻辣火鍋店', is_spicy: 'true', tags: ['火鍋', '吃飽'], price_range: 2 },
  { id: 2, name: '清淡咖啡廳', is_spicy: 'false', tags: ['喝', '咖啡'], price_range: 2 },
  { id: 3, name: '四川菜館', is_spicy: 'true', tags: ['川菜', '吃飽'], price_range: 3 },
  { id: 4, name: '日式料理', is_spicy: 'false', tags: ['日式', '吃一點'], price_range: 2 },
  { id: 5, name: '未知辣度餐廳', is_spicy: null, tags: ['中式', '吃飽'], price_range: 1 },
  { id: 6, name: '韓式烤肉', is_spicy: 'true', tags: ['韓式', '吃飽'], price_range: 2 },
  { id: 7, name: '川湘小館', is_spicy: 'both', tags: ['川菜', '湘菜', '吃飽'], price_range: 2 },
  { id: 8, name: '台式火鍋', is_spicy: 'both', tags: ['火鍋', '台式', '吃飽'], price_range: 2 },
  { id: 9, name: '泰式餐廳', is_spicy: 'both', tags: ['泰式', '吃一點'], price_range: 2 }
];

// 測試辣度篩選函數
function testSpicyFiltering(restaurants, preference) {
  console.log(`\n測試 "${preference}" 篩選：`);

  let filtered;
  if (preference === '辣') {
    filtered = restaurants.filter(r => r.is_spicy === 'true' || r.is_spicy === 'both');
    console.log('篩選條件：is_spicy === "true" || is_spicy === "both"');
  } else if (preference === '不辣') {
    filtered = restaurants.filter(r => r.is_spicy === 'false' || r.is_spicy === 'both');
    console.log('篩選條件：is_spicy === "false" || is_spicy === "both"');
  } else {
    filtered = restaurants;
    console.log('無辣度偏好篩選');
  }

  console.log(`原始餐廳數量：${restaurants.length}`);
  console.log(`篩選後餐廳數量：${filtered.length}`);

  if (filtered.length > 0) {
    console.log('符合條件的餐廳：');
    filtered.forEach(r => {
      console.log(`  - ${r.name} (is_spicy: ${r.is_spicy})`);
    });
  } else {
    console.log('⚠️ 沒有餐廳符合條件！');
  }

  return filtered;
}

// 測試不同的辣度偏好
const spicyResults = testSpicyFiltering(testRestaurants, '辣');
const nonSpicyResults = testSpicyFiltering(testRestaurants, '不辣');
const noPreferenceResults = testSpicyFiltering(testRestaurants, '無偏好');

// 驗證結果
console.log('\n🔍 結果驗證：');

// 檢查辣的篩選結果
const expectedSpicy = testRestaurants.filter(r => r.is_spicy === true);
const spicyMatch = spicyResults.length === expectedSpicy.length &&
  spicyResults.every(r => r.is_spicy === true);

console.log(`辣的篩選 ${spicyMatch ? '✅ 正確' : '❌ 錯誤'}`);
console.log(`預期: ${expectedSpicy.length} 間, 實際: ${spicyResults.length} 間`);

// 檢查不辣的篩選結果
const expectedNonSpicy = testRestaurants.filter(r => r.is_spicy === false);
const nonSpicyMatch = nonSpicyResults.length === expectedNonSpicy.length &&
  nonSpicyResults.every(r => r.is_spicy === false);

console.log(`不辣的篩選 ${nonSpicyMatch ? '✅ 正確' : '❌ 錯誤'}`);
console.log(`預期: ${expectedNonSpicy.length} 間, 實際: ${nonSpicyResults.length} 間`);

// 檢查 NULL 值處理
const nullSpicyCount = testRestaurants.filter(r => r.is_spicy === null).length;
console.log(`NULL 辣度餐廳數量: ${nullSpicyCount} 間（這些餐廳不會被篩選到任一類別）`);

// 檢查資料完整性
console.log('\n📊 資料統計：');
console.log(`總餐廳數：${testRestaurants.length}`);
console.log(`辣的餐廳：${expectedSpicy.length} 間`);
console.log(`不辣的餐廳：${expectedNonSpicy.length} 間`);
console.log(`未知辣度：${nullSpicyCount} 間`);
console.log(`總和驗證：${expectedSpicy.length + expectedNonSpicy.length + nullSpicyCount === testRestaurants.length ? '✅' : '❌'}`);

console.log('\n🌶️ 辣度篩選測試完成！');

// 測試實際的 SwiftTaste 篩選邏輯（如果在瀏覽器中執行）
if (typeof window !== 'undefined') {
  console.log('\n🔧 實際系統測試建議：');
  console.log('1. 在 SwiftTaste 模式中選擇"辣"偏好');
  console.log('2. 檢查瀏覽器控制台中的篩選日誌');
  console.log('3. 確認推薦的餐廳都有 is_spicy: true');
  console.log('4. 重複測試"不辣"偏好');
}

// 返回測試結果供進一步分析
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testSpicyFiltering,
    testRestaurants,
    results: {
      spicy: spicyResults,
      nonSpicy: nonSpicyResults,
      noPreference: noPreferenceResults
    }
  };
}