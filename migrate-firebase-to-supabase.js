// 從 JSON 檔案到 Supabase 資料遷移腳本
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

// 載入環境變數
console.log('🔧 載入環境變數...');
dotenv.config({ path: './server/.env' });

console.log('🔍 檢查環境變數...');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log(`SUPABASE_URL: ${supabaseUrl ? '✅ 已設定' : '❌ 未設定'}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY: ${supabaseKey ? '✅ 已設定' : '❌ 未設定'}`);

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少 Supabase 環境變數');
  console.log('請確認 server/.env 中有以下設定：');
  console.log('SUPABASE_URL=your_supabase_url');
  console.log('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 轉換價格區間格式
function convertPriceRange(priceStr) {
  switch (priceStr) {
    case '$': return 1;
    case '$$': return 2;
    case '$$$': return 3;
    case '$$$$': return 4;
    default: return 1;
  }
}

// 轉換 Firebase Timestamp 到標準日期格式
function convertFirebaseTimestamp(timestamp) {
  if (timestamp && timestamp.seconds) {
    return new Date(timestamp.seconds * 1000).toISOString();
  }
  if (timestamp && timestamp.toDate) {
    return timestamp.toDate().toISOString();
  }
  return new Date().toISOString();
}

// 清理和轉換餐廳資料
function transformRestaurantData(firebaseData, docId) {
  return {
    firebase_id: docId, // 保存原始 Firebase ID
    name: firebaseData.name || '未命名餐廳',
    description: [
      firebaseData.type || '',
      firebaseData.suggestedPeople ? `建議人數：${firebaseData.suggestedPeople}` : ''
    ].filter(Boolean).join(' | '),
    address: firebaseData.address || null,
    phone: firebaseData.phone || null,
    category: firebaseData.type || '其他',
    price_range: convertPriceRange(firebaseData.priceRange),
    rating: firebaseData.rating ? Math.min(5, Math.max(0, Number(firebaseData.rating))) : 0,
    opening_hours: firebaseData.openingHours || null,
    latitude: firebaseData.location?.lat || null,
    longitude: firebaseData.location?.lng || null,
    tags: Array.isArray(firebaseData.tags) ? firebaseData.tags : [],
    website_url: firebaseData.website || null,
    social_media: null,
    extra_data: {
      isSpicy: firebaseData.isSpicy,
      suggestedPeople: firebaseData.suggestedPeople,
      originalPhotoURL: firebaseData.photoURL,
      originalCreatedAt: firebaseData.createdAt,
      originalUpdatedAt: firebaseData.updatedAt
    },
    is_active: true,
    featured: firebaseData.rating >= 4.5, // 評分 4.5 以上設為推薦
    created_at: convertFirebaseTimestamp(firebaseData.updatedAt || firebaseData.createdAt),
    updated_at: convertFirebaseTimestamp(firebaseData.updatedAt || firebaseData.createdAt)
  };
}

// 處理餐廳照片
async function processRestaurantImages(firebaseData, supabaseRestaurant) {
  if (!firebaseData.photoURL) {
    console.log(`  ⏭️  ${firebaseData.name}: 無照片`);
    return;
  }

  try {
    const imageData = {
      restaurant_id: supabaseRestaurant.id,
      image_url: firebaseData.photoURL,
      image_path: null,
      source_type: 'external',
      alt_text: `${firebaseData.name} 照片`,
      image_type: 'general',
      display_order: 0,
      is_primary: true,
      file_size: null,
      width: null,
      height: null,
      uploaded_by: null,
      external_source: 'Firebase Storage'
    };

    const { error: imageError } = await supabase
      .from('restaurant_images')
      .insert([imageData]);

    if (imageError) {
      console.error(`  ❌ ${firebaseData.name}: 照片新增失敗`, imageError.message);
    } else {
      console.log(`  📷 ${firebaseData.name}: 照片新增成功`);
    }
  } catch (error) {
    console.error(`  ❌ ${firebaseData.name}: 照片處理失敗`, error.message);
  }
}

// 從 JSON 檔案獲取餐廳資料
async function fetchRestaurantsFromJson() {
  try {
    console.log('📊 從 JSON 檔案讀取餐廳資料...');
    
    const jsonData = readFileSync('./restaurants (2).json', 'utf8');
    const restaurants = JSON.parse(jsonData);
    
    console.log(`✅ 成功讀取 ${restaurants.length} 筆餐廳資料`);
    return restaurants;
    
  } catch (error) {
    console.error('❌ 從 JSON 檔案讀取資料失敗:', error);
    throw error;
  }
}

// 遷移單一餐廳
async function migrateRestaurant(firebaseRestaurant) {
  try {
    console.log(`\n🏪 遷移: ${firebaseRestaurant.name}`);

    // 檢查是否已存在
    const { data: existing, error: checkError } = await supabase
      .from('restaurants')
      .select('id, name')
      .eq('firebase_id', firebaseRestaurant.id)
      .single();

    if (existing) {
      console.log(`  ⏭️  已存在，跳過: ${existing.name}`);
      return existing;
    }

    // 轉換資料格式
    const supabaseData = transformRestaurantData(firebaseRestaurant, firebaseRestaurant.id);

    // 插入餐廳資料
    const { data: restaurant, error: insertError } = await supabase
      .from('restaurants')
      .insert([supabaseData])
      .select()
      .single();

    if (insertError) {
      console.error(`  ❌ 餐廳新增失敗: ${insertError.message}`);
      throw insertError;
    }

    console.log(`  ✅ 餐廳遷移成功: ${restaurant.name}`);

    // 處理餐廳照片
    await processRestaurantImages(firebaseRestaurant, restaurant);

    return restaurant;

  } catch (error) {
    console.error(`  ❌ 遷移失敗 (${firebaseRestaurant.name}):`, error.message);
    throw error;
  }
}

// 主遷移函數
async function migrateData() {
  try {
    console.log('🚀 開始 Firebase 到 Supabase 資料遷移...\n');

    // 1. 測試 Supabase 連接
    console.log('🔌 測試 Supabase 連接...');
    const { data, error } = await supabase
      .from('restaurants')
      .select('count')
      .limit(1);

    if (error) {
      console.error('Supabase 連接錯誤:', error);
      throw new Error(`Supabase 連接失敗: ${error.message}`);
    }
    console.log('✅ Supabase 連接成功');

    // 2. 獲取 JSON 餐廳資料
    const firebaseRestaurants = await fetchRestaurantsFromJson();
    console.log('==================================================');

    // 3. 批量遷移
    let successCount = 0;
    let errorCount = 0;
    const batchSize = 5; // 減少批次大小避免 API 限制

    for (let i = 0; i < firebaseRestaurants.length; i += batchSize) {
      const batch = firebaseRestaurants.slice(i, i + batchSize);
      console.log(`\n📦 處理批次 ${Math.floor(i/batchSize) + 1}/${Math.ceil(firebaseRestaurants.length/batchSize)} (${batch.length} 筆)`);

      for (const restaurant of batch) {
        try {
          await migrateRestaurant(restaurant);
          successCount++;
        } catch (error) {
          errorCount++;
        }
      }

      // 批次間延遲
      if (i + batchSize < firebaseRestaurants.length) {
        console.log('⏰ 等待 1 秒...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 4. 顯示結果
    console.log('\n==================================================');
    console.log('🎉 遷移完成！');
    console.log(`✅ 成功遷移: ${successCount} 家餐廳`);
    console.log(`❌ 遷移失敗: ${errorCount} 家餐廳`);
    console.log(`📊 總計: ${firebaseRestaurants.length} 家餐廳`);

  } catch (error) {
    console.error('💥 遷移過程發生錯誤:', error);
    process.exit(1);
  }
}

// 執行遷移
async function main() {
  console.log('🔄 JSON → Supabase 資料遷移工具');
  console.log('==================================================');

  try {
    console.log('🚀 開始執行遷移...');
    await migrateData();
    console.log('\n🎊 遷移工作順利完成！');
    console.log('現在可以從 Supabase 讀取餐廳資料了。');
  } catch (error) {
    console.error('❌ 遷移失敗:', error.message);
    console.error('錯誤詳情:', error);
    process.exit(1);
  }
}

console.log('📋 檢查是否為直接執行腳本...');
// Windows 兼容的路徑檢查
const currentFileUrl = import.meta.url;
const scriptPath = process.argv[1];
const isDirectExecution = currentFileUrl.includes(scriptPath.split('\\').pop());

if (isDirectExecution) {
  console.log('✅ 開始執行主函數...');
  main();
} else {
  console.log('❌ 腳本未被直接執行');
}