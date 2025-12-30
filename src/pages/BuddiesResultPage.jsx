import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import RecommendationResult from '../components/RecommendationResult';
import { authService } from '../services/authService';
import { userDataService } from '../services/userDataService';
import Toast from '../components/common/Toast';

export default function BuddiesResultPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const recommendations = location.state?.recommendations || [];

  // 用戶相關狀態
  const [currentUser, setCurrentUser] = useState(null);
  const [defaultFavoriteListId, setDefaultFavoriteListId] = useState(null);
  const [likedRestaurants, setLikedRestaurants] = useState(new Set()); // 追蹤已收藏的餐廳
  const [likedVersion, setLikedVersion] = useState(0); // 用於強制重新渲染

  // Toast 通知狀態
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' });

  // 獲取當前用戶和預設收藏清單
  useEffect(() => {
    const initUser = async () => {
      try {
        const userResult = await authService.getCurrentUser();
        if (userResult.success && userResult.user) {
          setCurrentUser(userResult.user);

          // 獲取用戶的收藏清單（只需要餐廳ID，不需要完整資訊和圖片）
          const listsResult = await userDataService.getFavoriteLists(
            userResult.user.id,
            userResult.user.email,
            { includeRestaurants: true, includeImages: false }  // 減少流量
          );

          if (listsResult.success && listsResult.lists.length > 0) {
            // 優先使用標記為 is_default 的清單，否則使用第一個清單
            const defaultList = listsResult.lists.find(list => list.is_default) || listsResult.lists[0];
            setDefaultFavoriteListId(defaultList.id);
            console.log('✅ Buddies 模式使用預設收藏清單:', defaultList.name, defaultList.id);

            // 初始化已收藏的餐廳集合
            const likedSet = new Set();
            defaultList.favorite_list_places?.forEach(place => {
              if (place.restaurant_id) {
                likedSet.add(place.restaurant_id);
              }
            });
            setLikedRestaurants(likedSet);
            console.log(`✅ 已載入 ${likedSet.size} 個已收藏的餐廳`);
          } else {
            console.warn('⚠️ 用戶沒有收藏清單，請確認資料庫觸發器是否正確設置');
          }
        }
      } catch (error) {
        console.error('Buddies 模式初始化用戶失敗:', error);
      }
    };

    initUser();
  }, []);

  // 顯示 Toast 通知
  const showToast = (message, type = 'success') => {
    setToast({ isOpen: true, message, type });
  };

  // 關閉 Toast
  const closeToast = () => {
    setToast({ ...toast, isOpen: false });
  };

  const handleLike = async (restaurant) => {
    console.log('Buddies 模式點擊收藏按鈕:', restaurant.name);

    // 檢查用戶是否已登入
    if (!currentUser) {
      showToast('請先登入才能使用收藏功能', 'warning');
      return;
    }

    // 檢查是否有默認收藏清單
    if (!defaultFavoriteListId) {
      showToast('收藏清單尚未準備好，請稍後再試', 'warning');
      return;
    }

    // 檢查是否已收藏
    const isLiked = likedRestaurants.has(restaurant.id);

    if (isLiked) {
      // 取消收藏
      try {
        // 從資料庫移除
        const result = await userDataService.removePlaceFromListByRestaurant(
          defaultFavoriteListId,
          restaurant.id
        );

        if (result.success) {
          // 更新前端狀態
          setLikedRestaurants(prev => {
            const newSet = new Set(prev);
            newSet.delete(restaurant.id);
            return newSet;
          });
          setLikedVersion(v => v + 1); // 強制重新渲染

          showToast(`已取消收藏「${restaurant.name}」`, 'info');
          console.log('✅ 已取消收藏:', restaurant.name);
        } else {
          showToast(`取消收藏失敗：${result.error}`, 'error');
        }
      } catch (error) {
        console.error('取消收藏失敗:', error);
        showToast('取消收藏失敗，請稍後再試', 'error');
      }
    } else {
      // 加入收藏
      try {
        // 準備餐廳數據
        const placeData = {
          place_id: restaurant.id,
          name: restaurant.name,
          address: restaurant.address || '',
          rating: restaurant.rating || null,
          latitude: restaurant.latitude || null,
          longitude: restaurant.longitude || null,
          category: restaurant.category || ''
        };

        // 加入收藏清單
        const result = await userDataService.addPlaceToList(defaultFavoriteListId, placeData);

        if (result.success) {
          // 更新已收藏狀態
          setLikedRestaurants(prev => new Set(prev).add(restaurant.id));
          setLikedVersion(v => v + 1); // 強制重新渲染

          showToast(`已將「${restaurant.name}」加入收藏`, 'success');
          console.log('✅ Buddies 模式成功加入收藏:', restaurant.name);
        } else {
          if (result.error === '此餐廳已在收藏清單中') {
            // 即使後端說已存在，也更新前端狀態
            setLikedRestaurants(prev => new Set(prev).add(restaurant.id));
            setLikedVersion(v => v + 1); // 強制重新渲染
            showToast('此餐廳已在收藏清單中', 'info');
          } else {
            showToast(`收藏失敗：${result.error}`, 'error');
          }
        }
      } catch (error) {
        console.error('收藏失敗:', error);
        showToast('收藏失敗，請稍後再試', 'error');
      }
    }
  };

  return (
    <>
      <RecommendationResult
        saved={recommendations}
        onRetry={() => navigate('/buddies')}
        onLike={handleLike}
        currentUser={currentUser}
        likedRestaurants={likedRestaurants}
        likedVersion={likedVersion}
      />

      {/* Toast 通知 */}
      <Toast
        isOpen={toast.isOpen}
        onClose={closeToast}
        message={toast.message}
        type={toast.type}
        duration={3000}
      />
    </>
  );
}
