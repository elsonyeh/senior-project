// 調試餐廳評分更新服務
import { supabase, getSupabaseAdmin } from './supabaseService';
import googleMapsLoader from '../utils/googleMapsLoader';

export const debugRatingService = {
  // 測試單一餐廳更新
  async testSingleRestaurant(restaurantId) {
    console.log(`🔍 開始測試餐廳 ID: ${restaurantId}`);

    try {
      // 1. 獲取餐廳資料
      const { data: restaurant, error: fetchError } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single();

      if (fetchError) {
        console.error('❌ 獲取餐廳資料失敗:', fetchError);
        return { success: false, error: fetchError.message };
      }

      console.log('📋 餐廳資料:', restaurant);

      // 2. 檢查 Google Maps API
      console.log('🗺️ 檢查 Google Maps API...');
      try {
        await googleMapsLoader.load();
        console.log('✅ Google Maps API 載入成功');
      } catch (apiError) {
        console.error('❌ Google Maps API 載入失敗:', apiError);
        return { success: false, error: `Google Maps API 錯誤: ${apiError.message}` };
      }

      if (!window.google?.maps?.places) {
        console.error('❌ Google Places API 不可用');
        return { success: false, error: 'Google Places API 不可用' };
      }

      // 3. 測試 Google Places 搜尋
      console.log('🔍 測試 Google Places 搜尋...');
      const { Place } = await window.google.maps.importLibrary("places");

      const searchQuery = `${restaurant.name} ${restaurant.address || ''} 台灣 餐廳`.trim();
      console.log('🔍 搜尋查詢:', searchQuery);

      const request = {
        textQuery: searchQuery,
        fields: ['displayName', 'formattedAddress', 'rating', 'userRatingCount', 'location', 'id'],
        locationBias: {
          center: {
            lat: parseFloat(restaurant.latitude),
            lng: parseFloat(restaurant.longitude)
          },
          radius: 500
        },
        maxResultCount: 5
      };

      const { places } = await Place.searchByText(request);
      console.log('📍 Google Places 搜尋結果:', places?.length || 0, '個結果');

      if (!places || places.length === 0) {
        console.warn('⚠️ Google Places 搜尋無結果');
        return { success: false, error: '在 Google Places 中找不到此餐廳' };
      }

      const bestPlace = places[0]; // 簡化：取第一個結果
      console.log('🎯 選擇的地點:', {
        name: bestPlace.displayName,
        rating: bestPlace.rating,
        userRatingCount: bestPlace.userRatingCount
      });

      // 4. 測試資料庫更新
      console.log('💾 測試資料庫更新...');
      const updateData = {
        rating_updated_at: new Date().toISOString()
      };

      if (bestPlace.rating !== undefined) {
        updateData.rating = bestPlace.rating;
        console.log(`📊 更新評分: ${restaurant.rating} → ${bestPlace.rating}`);
      }

      if (bestPlace.userRatingCount !== undefined) {
        updateData.user_ratings_total = bestPlace.userRatingCount;
        console.log(`👥 更新評分數: ${restaurant.user_ratings_total || 0} → ${bestPlace.userRatingCount}`);
      }

      console.log('📝 準備更新的資料:', updateData);
      console.log('🔍 餐廳 ID:', restaurantId, '類型:', typeof restaurantId);

      // 先驗證餐廳是否存在
      const { data: existCheck, error: existError } = await supabase
        .from('restaurants')
        .select('id, name')
        .eq('id', restaurantId);

      console.log('🔍 餐廳存在性檢查:', existCheck);

      if (existError) {
        console.error('❌ 餐廳存在性檢查失敗:', existError);
        return { success: false, error: existError.message };
      }

      if (!existCheck || existCheck.length === 0) {
        console.error('❌ 找不到指定的餐廳 ID:', restaurantId);
        return { success: false, error: `找不到餐廳 ID: ${restaurantId}` };
      }

      // 檢查管理員客戶端
      console.log('🔧 嘗試使用管理員客戶端更新...');
      const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
      console.log('🔑 Service Key 存在:', !!serviceKey);

      const adminClient = getSupabaseAdmin();
      console.log('👤 管理員客戶端:', !!adminClient);

      let updateResult, updateError;

      if (adminClient && serviceKey) {
        console.log('✅ 使用管理員客戶端 (service_role)');
        const result = await adminClient
          .from('restaurants')
          .update(updateData)
          .eq('id', restaurantId)
          .select();
        updateResult = result.data;
        updateError = result.error;
        console.log('🔧 管理員客戶端結果:', {
          success: !updateError,
          recordsAffected: updateResult?.length || 0,
          error: updateError?.message
        });
      } else {
        console.log('⚠️ 管理員客戶端不可用，使用一般客戶端');
        console.log('原因:', !adminClient ? '客戶端未創建' : '無 Service Key');
        const result = await supabase
          .from('restaurants')
          .update(updateData)
          .eq('id', restaurantId)
          .select();
        updateResult = result.data;
        updateError = result.error;
        console.log('🔧 一般客戶端結果:', {
          success: !updateError,
          recordsAffected: updateResult?.length || 0,
          error: updateError?.message
        });
      }

      if (updateError) {
        console.error('❌ 資料庫更新失敗:', updateError);
        return { success: false, error: updateError.message };
      }

      console.log('✅ 資料庫更新成功:', updateResult);
      console.log('📊 更新的記錄數量:', updateResult.length);

      return {
        success: true,
        restaurant: restaurant,
        googleData: {
          name: bestPlace.displayName,
          rating: bestPlace.rating,
          userRatingCount: bestPlace.userRatingCount
        },
        updateData: updateData,
        result: updateResult
      };

    } catch (error) {
      console.error('❌ 測試過程發生錯誤:', error);
      return { success: false, error: error.message };
    }
  },

  // 檢查 Supabase 連線
  async testSupabaseConnection() {
    console.log('🔗 測試 Supabase 連線...');

    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name')
        .limit(1);

      if (error) {
        console.error('❌ Supabase 連線失敗:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Supabase 連線成功, 樣本資料:', data);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Supabase 連線異常:', error);
      return { success: false, error: error.message };
    }
  },

  // 檢查環境變數
  checkEnvironment() {
    console.log('🔧 檢查環境設定...');

    const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    console.log('環境變數檢查:');
    console.log('- Google Maps API Key:', googleMapsApiKey ? '✅ 已設定' : '❌ 未設定');
    console.log('- Supabase URL:', supabaseUrl ? '✅ 已設定' : '❌ 未設定');
    console.log('- Supabase Key:', supabaseKey ? '✅ 已設定' : '❌ 未設定');

    return {
      googleMapsApiKey: !!googleMapsApiKey,
      supabaseUrl: !!supabaseUrl,
      supabaseKey: !!supabaseKey
    };
  }
};