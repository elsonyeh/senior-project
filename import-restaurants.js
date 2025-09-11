// 餐廳資料匯入腳本 - 將 restaurants.json 匯入到 Supabase
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 載入環境變數
dotenv.config({ path: './server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  return new Date().toISOString();
}

// 清理和驗證資料
function cleanRestaurantData(restaurant) {
  return {
    // 使用原本的 Firebase ID 作為參考，但讓 Supabase 生成新的 UUID
    firebase_id: restaurant.id,
    name: restaurant.name || '未命名餐廳',
    description: `${restaurant.type || ''}${restaurant.suggestedPeople ? ` | 建議人數：${restaurant.suggestedPeople}` : ''}`,
    address: restaurant.address || null,
    phone: null, // 原資料中沒有電話
    category: restaurant.type || '其他',
    price_range: convertPriceRange(restaurant.priceRange),
    rating: restaurant.rating ? Math.min(5, Math.max(0, restaurant.rating)) : 0,
    opening_hours: null, // 原資料中沒有營業時間
    latitude: restaurant.location?.lat || null,
    longitude: restaurant.location?.lng || null,
    tags: restaurant.tags || [],
    website_url: null,
    social_media: null,
    is_active: true,
    featured: restaurant.rating >= 4.5, // 評分 4.5 以上設為推薦
    created_at: convertFirebaseTimestamp(restaurant.updatedAt),
    updated_at: convertFirebaseTimestamp(restaurant.updatedAt),
    // 額外欄位記錄原始資料
    extra_data: {
      isSpicy: restaurant.isSpicy,
      suggestedPeople: restaurant.suggestedPeople,
      originalPhotoURL: restaurant.photoURL
    }
  };
}

// 處理餐廳照片
async function processRestaurantImages(restaurant, restaurantRecord) {
  if (!restaurant.photoURL) {
    console.log(`  ⏭️  ${restaurant.name}: 無照片`);
    return;
  }

  try {
    // 將 Firebase Storage 的圖片作為外部連結添加
    const imageData = {
      restaurant_id: restaurantRecord.id,
      image_url: restaurant.photoURL,
      image_path: null,
      source_type: 'external',
      alt_text: `${restaurant.name} 照片`,
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
      console.error(`  ❌ ${restaurant.name}: 照片新增失敗`, imageError.message);
    } else {
      console.log(`  📷 ${restaurant.name}: 照片新增成功`);
    }
  } catch (error) {
    console.error(`  ❌ ${restaurant.name}: 照片處理失敗`, error.message);
  }
}

// 批量匯入餐廳資料
async function importRestaurants() {
  try {
    console.log('🚀 開始匯入餐廳資料...\n');

    // 讀取 JSON 檔案
    const jsonData = fs.readFileSync('./restaurants (2).json', 'utf8');
    const restaurants = JSON.parse(jsonData);
    
    console.log(`📊 找到 ${restaurants.length} 家餐廳資料`);
    console.log('=' * 50);

    let successCount = 0;
    let errorCount = 0;

    // 分批處理以避免 API 限制
    const batchSize = 10;
    for (let i = 0; i < restaurants.length; i += batchSize) {
      const batch = restaurants.slice(i, i + batchSize);
      console.log(`\n📦 處理批次 ${Math.floor(i/batchSize) + 1}/${Math.ceil(restaurants.length/batchSize)} (${batch.length} 筆)`);

      for (const restaurant of batch) {
        try {
          console.log(`\n🏪 處理: ${restaurant.name}`);

          // 檢查是否已存在（根據 Firebase ID）
          const { data: existing, error: checkError } = await supabase
            .from('restaurants')
            .select('id, name')
            .eq('firebase_id', restaurant.id)
            .single();

          if (existing) {
            console.log(`  ⏭️  已存在，跳過: ${existing.name}`);
            continue;
          }

          // 清理並轉換資料
          const cleanData = cleanRestaurantData(restaurant);

          // 插入餐廳資料
          const { data: restaurantRecord, error: insertError } = await supabase
            .from('restaurants')
            .insert([cleanData])
            .select()
            .single();

          if (insertError) {
            console.error(`  ❌ 餐廳新增失敗: ${insertError.message}`);
            errorCount++;
            continue;
          }

          console.log(`  ✅ 餐廳新增成功: ${restaurantRecord.name}`);

          // 處理餐廳照片
          await processRestaurantImages(restaurant, restaurantRecord);

          successCount++;

        } catch (error) {
          console.error(`  ❌ 處理失敗 (${restaurant.name}):`, error.message);
          errorCount++;
        }
      }

      // 批次間稍微延遲
      if (i + batchSize < restaurants.length) {
        console.log('⏰ 等待 1 秒...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n' + '=' * 50);
    console.log('🎉 匯入完成！');
    console.log(`✅ 成功: ${successCount} 家餐廳`);
    console.log(`❌ 失敗: ${errorCount} 家餐廳`);
    console.log(`📊 總計: ${restaurants.length} 家餐廳`);

  } catch (error) {
    console.error('💥 匯入過程發生錯誤:', error);
    process.exit(1);
  }
}

// 主程式
async function main() {
  console.log('🍽️  SwiftTaste 餐廳資料匯入工具');
  console.log('=' * 50);

  try {
    // 測試 Supabase 連接
    const { data, error } = await supabase
      .from('restaurants')
      .select('count')
      .limit(1);

    if (error) {
      throw new Error(`Supabase 連接失敗: ${error.message}`);
    }

    console.log('✅ Supabase 連接成功');

    await importRestaurants();

  } catch (error) {
    console.error('❌ 程式執行失敗:', error.message);
    process.exit(1);
  }
}

// 執行匯入
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}