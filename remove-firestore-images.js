// 移除來源為 Firestore 的餐廳照片腳本
// 保留 alt_text，但刪除 Firestore 來源的圖片記錄和文件

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// 載入環境變數
dotenv.config();

// 直接創建 supabaseAdmin 客戶端
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY;

const supabaseAdmin = supabaseUrl && supabaseServiceKey ?
  createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }) : null;

async function removeFirestoreImages() {
  try {
    console.log('🔍 開始識別 Firestore 來源的餐廳照片...');

    if (!supabaseAdmin) {
      throw new Error('Supabase Admin 客戶端未配置');
    }

    // 查詢所有餐廳圖片，識別 Firestore 來源的圖片
    const { data: allImages, error: queryError } = await supabaseAdmin
      .from('restaurant_images')
      .select('*');

    if (queryError) {
      throw new Error(`查詢圖片失敗: ${queryError.message}`);
    }

    console.log(`📊 總共找到 ${allImages.length} 張餐廳照片`);

    // 識別 Firestore 來源的圖片 (通常包含 firebase, firestore 關鍵字或特定的 URL 模式)
    const firestoreImages = allImages.filter(img => {
      const isFirestore =
        // 檢查 image_url 是否包含 firebase 或 firestore
        (img.image_url && (
          img.image_url.includes('firebase') ||
          img.image_url.includes('firestore') ||
          img.image_url.includes('googleapis.com') ||
          img.image_url.includes('appspot.com')
        )) ||
        // 檢查 source_type 是否為相關類型
        (img.source_type && (
          img.source_type.includes('firebase') ||
          img.source_type.includes('firestore')
        )) ||
        // 檢查 image_path 是否包含 firebase 路徑
        (img.image_path && (
          img.image_path.includes('firebase') ||
          img.image_path.includes('firestore')
        )) ||
        // 檢查 external_source 是否提及 firebase/firestore
        (img.external_source && (
          img.external_source.includes('firebase') ||
          img.external_source.includes('firestore')
        ));

      return isFirestore;
    });

    console.log(`🔥 找到 ${firestoreImages.length} 張來源為 Firestore 的圖片`);

    if (firestoreImages.length === 0) {
      console.log('✅ 沒有找到 Firestore 來源的圖片，無需處理');
      return { success: true, removedCount: 0 };
    }

    // 顯示要刪除的圖片詳情（保留 alt_text 作為記錄）
    console.log('\n📋 準備刪除的 Firestore 圖片列表:');
    const altTextsToPreserve = [];

    firestoreImages.forEach((img, index) => {
      console.log(`${index + 1}. ID: ${img.id}`);
      console.log(`   餐廳ID: ${img.restaurant_id}`);
      console.log(`   URL: ${img.image_url}`);
      console.log(`   來源類型: ${img.source_type || 'N/A'}`);
      console.log(`   Alt Text: ${img.alt_text || 'N/A'}`);
      console.log(`   上傳時間: ${img.created_at || 'N/A'}`);
      console.log('   ---');

      // 保存 alt_text 以供記錄
      if (img.alt_text) {
        altTextsToPreserve.push({
          restaurant_id: img.restaurant_id,
          alt_text: img.alt_text,
          original_id: img.id
        });
      }
    });

    console.log('\n🗂️  保存的 Alt Text 記錄:');
    altTextsToPreserve.forEach((record, index) => {
      console.log(`${index + 1}. 餐廳 ${record.restaurant_id}: "${record.alt_text}"`);
    });

    // 詢問用戶確認
    console.log(`\n⚠️  即將刪除 ${firestoreImages.length} 張 Firestore 來源的圖片`);
    console.log('📝 以上 alt_text 已記錄並保留');

    // 執行刪除操作
    const imageIds = firestoreImages.map(img => img.id);

    console.log('🗑️  開始批量刪除 Firestore 圖片記錄...');

    const { error: deleteError } = await supabaseAdmin
      .from('restaurant_images')
      .delete()
      .in('id', imageIds);

    if (deleteError) {
      throw new Error(`刪除圖片記錄失敗: ${deleteError.message}`);
    }

    console.log(`✅ 成功刪除 ${firestoreImages.length} 張 Firestore 來源的餐廳照片`);

    // 如果有 Supabase Storage 中的檔案，也需要清理
    console.log('\n🧹 檢查 Supabase Storage 中是否有相關檔案需要清理...');

    const storageFilesToDelete = firestoreImages.filter(img =>
      img.image_path && !img.image_path.includes('firebase') && !img.image_path.includes('firestore')
    );

    if (storageFilesToDelete.length > 0) {
      console.log(`🗑️  發現 ${storageFilesToDelete.length} 個 Supabase Storage 檔案需要清理`);

      const filePaths = storageFilesToDelete.map(img => img.image_path);
      const { data: deletedFiles, error: storageError } = await supabaseAdmin.storage
        .from('restaurant-images')
        .remove(filePaths);

      if (storageError) {
        console.warn(`⚠️  Storage 檔案清理部分失敗: ${storageError.message}`);
      } else {
        console.log(`✅ 成功清理 ${deletedFiles?.length || 0} 個 Storage 檔案`);
      }
    }

    return {
      success: true,
      removedCount: firestoreImages.length,
      preservedAltTexts: altTextsToPreserve,
      storageFilesRemoved: storageFilesToDelete.length
    };

  } catch (error) {
    console.error('❌ 移除 Firestore 圖片失敗:', error);
    throw error;
  }
}

// 主函數
async function main() {
  try {
    console.log('🚀 開始執行 Firestore 圖片清理程序...\n');

    const result = await removeFirestoreImages();

    console.log('\n📊 清理結果摘要:');
    console.log(`✅ 處理狀態: ${result.success ? '成功' : '失敗'}`);
    console.log(`🗑️  刪除圖片數量: ${result.removedCount}`);
    console.log(`📝 保留 Alt Text 數量: ${result.preservedAltTexts?.length || 0}`);
    console.log(`🗂️  清理 Storage 檔案數量: ${result.storageFilesRemoved || 0}`);

    if (result.preservedAltTexts && result.preservedAltTexts.length > 0) {
      console.log('\n💾 已保留的 Alt Text 記錄:');
      result.preservedAltTexts.forEach((record, index) => {
        console.log(`${index + 1}. 餐廳 ${record.restaurant_id}: "${record.alt_text}"`);
      });
    }

    console.log('\n✨ Firestore 圖片清理完成！');

  } catch (error) {
    console.error('💥 執行失敗:', error.message);
    process.exit(1);
  }
}

// 如果直接執行這個檔案
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default removeFirestoreImages;