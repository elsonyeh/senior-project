import React, { useState, useEffect } from 'react';
import { userDataService } from '../../services/userDataService';
import {
  IoListOutline,
  IoHeartOutline,
  IoRestaurantOutline,
  IoTrashOutline,
  IoCreateOutline,
  IoAddOutline,
  IoNavigateOutline,
  IoEllipsisVertical,
  IoStarOutline,
  IoTimeOutline,
  IoCheckmarkCircleOutline,
  IoAlertCircleOutline,
  IoWarningOutline,
  IoCloseOutline
} from 'react-icons/io5';
import './MyLists.css';

export default function MyLists({ user }) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedList, setSelectedList] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [swipedListId, setSwipedListId] = useState(null);
  const [editingListId, setEditingListId] = useState(null);
  const [editingListName, setEditingListName] = useState('');
  const [notification, setNotification] = useState({
    show: false,
    message: '',
    type: 'success'
  });

  // 獲取餐廳圖片的函數，使用與 SwiftTaste 相同的邏輯
  const getRestaurantImage = (restaurant) => {
    if (!restaurant) {
      return `https://source.unsplash.com/400x300/restaurant,food/?default`;
    }

    // 優先使用 primaryImage，然後是 allImages 中的第一張，最後是預設圖片
    let imageUrl = restaurant.primaryImage?.image_url ||
                   (restaurant.allImages && restaurant.allImages.length > 0 ? restaurant.allImages[0]?.image_url : null) ||
                   (restaurant.restaurant_images && restaurant.restaurant_images.length > 0 ? restaurant.restaurant_images[0]?.image_url : null) ||
                   restaurant.photoURL || // 支援舊格式
                   restaurant.image_url || // 支援其他格式
                   restaurant.photo || // 收藏清單中的照片欄位
                   restaurant.photo_url; // 收藏清單中的照片 URL 欄位

    // 確保 URL 有效
    if (!imageUrl || imageUrl === 'null' || imageUrl === 'undefined') {
      imageUrl = `https://source.unsplash.com/400x300/restaurant,food/?${encodeURIComponent(restaurant.name || 'restaurant')}`;
    }

    return imageUrl;
  };

  useEffect(() => {
    loadUserLists();
  }, [user]);

  // 點擊外部關閉滑動菜單
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (swipedListId && !event.target.closest('.mylists-card-wrapper')) {
        setSwipedListId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [swipedListId]);

  // 載入用戶的收藏清單
  const loadUserLists = async () => {
    if (!user) {
      console.log('MyLists: 沒有用戶資訊，跳過載入');
      return;
    }

    try {
      setLoading(true);
      console.log('MyLists: 開始載入用戶清單，用戶ID:', user.id);

      const result = await userDataService.getFavoriteLists(user.id, user.email);

      if (result.success) {
        console.log('MyLists: 載入收藏清單成功:', result.lists);
        console.log('MyLists: 清單數量:', result.lists.length);

        const processedLists = result.lists.map((list, index) => {
          console.log(`MyLists: 處理清單 ${index}:`, list.name, '地點數量:', list.favorite_list_places?.length || 0);

          // 轉換餐廳資訊格式
          const places = (list.favorite_list_places || []).map(place => {
            console.log('MyLists: 處理餐廳資料:', place);

            return {
              place_id: place.restaurant_id,
              restaurant_id: place.restaurant_id,
              id: place.id,
              notes: place.notes,
              added_at: place.added_at,
              // 從關聯的餐廳資料取得詳細資訊
              name: place.restaurants?.name || '未知餐廳',
              address: place.restaurants?.address || '',
              rating: place.restaurants?.rating || 0,
              latitude: place.restaurants?.latitude,
              longitude: place.restaurants?.longitude,
              category: place.restaurants?.category,
              // 處理餐廳圖片
              restaurant_images: place.restaurants?.restaurant_images || [],
              primaryImage: place.restaurants?.restaurant_images?.find(img => img.is_primary) ||
                           place.restaurants?.restaurant_images?.[0] || null,
              allImages: place.restaurants?.restaurant_images || [],
              photo: place.restaurants?.restaurant_images?.find(img => img.is_primary)?.image_url ||
                     place.restaurants?.restaurant_images?.[0]?.image_url || null,
              photo_url: place.restaurants?.restaurant_images?.find(img => img.is_primary)?.image_url ||
                        place.restaurants?.restaurant_images?.[0]?.image_url || null
            };
          });

          return {
            ...list,
            places: places
          };
        });

        if (processedLists.length > 0) {
          console.log('MyLists: 設置清單數據:', processedLists);
          setLists(processedLists);
          setSelectedList(processedLists[0]);
        } else {
          console.log('MyLists: 沒有找到清單，創建預設清單...');
          await createDefaultList();
        }
      } else {
        console.error('MyLists: 載入收藏清單失敗:', result.error);
        await createDefaultList();
      }
    } catch (error) {
      console.error('MyLists: 載入清單時發生錯誤:', error);
      await createDefaultList();
    } finally {
      setLoading(false);
    }
  };

  // 創建預設清單
  const createDefaultList = async () => {
    try {
      const result = await userDataService.createFavoriteList(
        user.id,
        {
          name: '我的最愛',
          description: '預設收藏清單',
          color: getRandomColor()
        },
        user.email
      );

      if (result.success) {
        const newList = { ...result.list, favorite_list_places: [] };
        setLists([newList]);
        setSelectedList(newList);
        console.log('已創建預設清單:', newList);
      } else {
        console.error('創建預設清單失敗:', result.error);
      }
    } catch (error) {
      console.error('創建預設清單錯誤:', error);
    }
  };

  // 創建新清單
  const createNewList = async () => {
    if (!newListName.trim() || !user) return;

    // 檢查是否重名
    const trimmedName = newListName.trim();
    const isDuplicate = lists.some(list => list.name === trimmedName);
    if (isDuplicate) {
      showNotification('清單名稱已存在，請使用不同的名稱', 'warning');
      return;
    }

    try {
      const result = await userDataService.createFavoriteList(
        user.id,
        {
          name: trimmedName,
          color: getRandomColor()
        },
        user.email
      );

      if (result.success) {
        const updatedLists = [...lists, { ...result.list, favorite_list_places: [] }];
        setLists(updatedLists);
        setSelectedList({ ...result.list, favorite_list_places: [] });
        setNewListName('');
        setShowCreateForm(false);
        showNotification('清單已創建', 'success');
      } else {
        showNotification(result.error || '創建清單失敗', 'error');
      }
    } catch (error) {
      console.error('創建清單錯誤:', error);
      showNotification('創建清單失敗，請重試', 'error');
    }
  };

  // 刪除清單
  const deleteList = async (listId) => {
    // 檢查是否為預設清單
    const targetList = lists.find(list => list.id === listId);
    if (targetList && targetList.name === '我的最愛') {
      showNotification('預設清單「我的最愛」不能刪除', 'warning');
      return;
    }

    if (lists.length === 1) {
      showNotification('至少需要保留一個清單', 'warning');
      return;
    }

    if (confirm('確定要刪除這個清單嗎？')) {
      try {
        const result = await userDataService.deleteFavoriteList(listId);
        
        if (result.success) {
          const updatedLists = lists.filter(list => list.id !== listId);
          setLists(updatedLists);
          
          if (selectedList?.id === listId && updatedLists.length > 0) {
            setSelectedList(updatedLists[0]);
          }
          showNotification('清單已刪除', 'success');
        } else {
          showNotification(result.error || '刪除清單失敗', 'error');
        }
      } catch (error) {
        console.error('刪除清單錯誤:', error);
        showNotification('刪除清單失敗，請重試', 'error');
      }
    }
  };

  // 開始編輯清單
  const startEditList = (list) => {
    // 檢查是否為預設清單
    if (list.name === '我的最愛') {
      showNotification('預設清單「我的最愛」不能改名', 'warning');
      return;
    }
    setEditingListId(list.id);
    setEditingListName(list.name);
    setOpenMenuId(null);
  };

  // 確認編輯清單
  const confirmEditList = async () => {
    if (!editingListName.trim()) {
      showNotification('清單名稱不能為空', 'warning');
      return;
    }

    // 檢查是否重名（排除自己）
    const trimmedName = editingListName.trim();
    const isDuplicate = lists.some(list => list.id !== editingListId && list.name === trimmedName);
    if (isDuplicate) {
      showNotification('清單名稱已存在，請使用不同的名稱', 'warning');
      return;
    }

    try {
      const result = await userDataService.updateFavoriteList(editingListId, {
        name: trimmedName
      });

      if (result.success) {
        const updatedLists = lists.map(list =>
          list.id === editingListId
            ? { ...list, name: trimmedName }
            : list
        );
        setLists(updatedLists);

        if (selectedList?.id === editingListId) {
          setSelectedList({ ...selectedList, name: trimmedName });
        }

        setEditingListId(null);
        setEditingListName('');
        showNotification('清單已更新', 'success');
      } else {
        showNotification(result.error || '更新清單失敗', 'error');
      }
    } catch (error) {
      console.error('更新清單錯誤:', error);
      showNotification('更新清單失敗，請重試', 'error');
    }
  };

  // 取消編輯清單
  const cancelEditList = () => {
    setEditingListId(null);
    setEditingListName('');
  };

  // 從清單移除地點
  const removePlaceFromList = async (listId, placeId) => {
    if (!confirm('確定要從此清單中移除這個收藏嗎？')) {
      return;
    }

    try {
      const result = await userDataService.removePlaceFromListByPlaceId(listId, placeId);

      if (result.success) {
        // 重新載入清單以確保數據同步
        await loadUserLists();
        showNotification('已移除收藏', 'success');
      } else {
        showNotification(result.error || '移除收藏失敗', 'error');
      }
    } catch (error) {
      console.error('移除收藏錯誤:', error);
      showNotification('移除收藏失敗，請重試', 'error');
    }
  };

  // 導航到地點
  const navigateToPlace = (place) => {
    // 這裡可以整合 Google Maps 導航
    const searchQuery = encodeURIComponent(`${place.name} ${place.address}`);
    window.open(`https://www.google.com/maps/search/${searchQuery}`, '_blank');
  };

  // 獲取隨機顏色
  const getRandomColor = () => {
    const colors = ['#ff6b35', '#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // 格式化時間
  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMs = now - date;
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return '今天';
    if (diffInDays === 1) return '昨天';
    if (diffInDays < 7) return `${diffInDays}天前`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}週前`;
    return `${Math.floor(diffInDays / 30)}個月前`;
  };

  // 顯示通知
  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  // 關閉通知
  const dismissNotification = () => {
    setNotification({ show: false, message: '', type: 'success' });
  };


  if (loading) {
    return (
      <div className="my-lists-loading">
        <div className="loading-spinner"></div>
        <p>載入清單中...</p>
      </div>
    );
  }

  return (
    <div className="my-lists-container">
      {/* 通知消息 */}
      {notification.show && (
        <div className={`lists-notification ${notification.type}`}>
          <span>{notification.message}</span>
          <button
            className="notification-dismiss"
            onClick={dismissNotification}
          >
            <IoCloseOutline />
          </button>
        </div>
      )}

      {/* 標題 */}
      <div className="lists-header">
        <h2 className="lists-title">
          <IoListOutline className="title-icon" />
          我的清單
        </h2>
        <div className="lists-stats">
          <span>{lists.length} 個清單</span>
          <span>•</span>
          <span>{lists.reduce((total, list) => total + (list.places?.length || list.favorite_list_places?.length || 0), 0)} 個地點</span>
        </div>
      </div>

      <div className="lists-content">
        {/* 清單側邊欄 */}
        <div className="lists-sidebar">
          {lists.map(list => (
            <div key={list.id} className="mylists-card-wrapper">
              <div
                className={`mylists-card ${selectedList?.id === list.id ? 'selected' : ''} ${swipedListId === list.id ? 'swiped' : ''}`}
                onClick={(e) => {
                  // 如果點擊的是三個點按鈕或其子元素,不處理清單選擇
                  if (e.target.closest('.mylists-menu-trigger')) {
                    return;
                  }
                  setSelectedList(list);
                }}
              >
                <div className="mylists-card-header">
                  <div className="mylists-card-info">
                    <div
                      className="mylists-color-indicator"
                      style={{ backgroundColor: list.color }}
                    ></div>
                    <div className="mylists-card-details">
                      {editingListId === list.id ? (
                        <input
                          type="text"
                          value={editingListName}
                          onChange={(e) => setEditingListName(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              confirmEditList();
                            } else if (e.key === 'Escape') {
                              cancelEditList();
                            }
                          }}
                          onBlur={confirmEditList}
                          className="mylists-edit-input"
                          autoFocus
                        />
                      ) : (
                        <h3 className="mylists-card-name">{list.name}</h3>
                      )}
                      <p className="mylists-card-count">{list.places?.length || list.favorite_list_places?.length || 0} 個地點</p>
                    </div>
                  </div>

                  {list.name !== '我的最愛' && (
                    <div className="mylists-card-menu">
                      <button
                        className="mylists-menu-trigger"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setSwipedListId(swipedListId === list.id ? null : list.id);
                        }}
                        title="更多選項"
                      >
                        <IoEllipsisVertical />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 滑動動作按鈕 - 優化現代風格 */}
              {list.name !== '我的最愛' && (
                <div className="mylists-swipe-actions">
                  <button
                    className="mylists-swipe-btn mylists-edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSwipedListId(null);
                      startEditList(list);
                    }}
                    title="編輯清單"
                  >
                    <IoCreateOutline />
                    <span>編輯</span>
                  </button>
                  {lists.length > 1 && (
                    <button
                      className="mylists-swipe-btn mylists-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSwipedListId(null);
                        deleteList(list.id);
                      }}
                      title="刪除清單"
                    >
                      <IoTrashOutline />
                      <span>刪除</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* 創建新清單 */}
          {showCreateForm ? (
            <div className="create-list-form">
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="輸入清單名稱"
                className="create-list-input"
                onKeyPress={(e) => e.key === 'Enter' && createNewList()}
                autoFocus
              />
              <div className="create-list-actions">
                <button onClick={createNewList} className="create-confirm-btn">
                  確定
                </button>
                <button 
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewListName('');
                  }} 
                  className="create-cancel-btn"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              className="create-list-btn"
              onClick={() => setShowCreateForm(true)}
            >
              <IoAddOutline />
              新增清單
            </button>
          )}
        </div>

        {/* 清單內容區域 */}
        <div className="list-content-area">
          {selectedList ? (
            <>
              <div className="list-content-header">
                <div className="list-info">
                  <h3 className="list-content-title">{selectedList.name}</h3>
                </div>
                <div className="list-meta">
                  <span className="place-count">{selectedList.places?.length || selectedList.favorite_list_places?.length || 0} 個地點</span>
                  <span className="creation-date">
                    創建於 {new Date(selectedList.created_at).toLocaleDateString('zh-TW')}
                  </span>
                </div>
              </div>

              <div className="places-grid">
                {(selectedList.places?.length || selectedList.favorite_list_places?.length || 0) === 0 ? (
                  <div className="empty-list-message">
                    <IoRestaurantOutline className="empty-icon" />
                    <h4>清單是空的</h4>
                    <p>開始在地圖上收藏餐廳吧！</p>
                  </div>
                ) : (
                  (selectedList.places || selectedList.favorite_list_places || []).map(place => {
                    // 增加除錯日誌
                    console.log('MyLists: 渲染餐廳卡片:', place);

                    return (
                      <div key={place.place_id || place.restaurant_id || place.id} className="place-card">
                        <div className="place-image-container">
                          <img
                            src={getRestaurantImage(place)}
                            alt={place.name || '餐廳'}
                            className="place-image"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextElementSibling.style.display = 'flex';
                            }}
                          />
                          <div className="place-image-fallback">
                            <IoRestaurantOutline />
                          </div>
                        </div>

                        <div className="place-card-content">
                          <h4 className="place-name">{place.name || '未知餐廳'}</h4>
                          <p className="place-address">{place.address || '地址未提供'}</p>

                          {place.rating && place.rating > 0 && (
                            <div className="place-rating">
                              <div className="rating-stars">
                                {Array.from({ length: 5 }, (_, i) => (
                                  <IoStarOutline
                                    key={i}
                                    className={i < Math.floor(place.rating) ? 'star-filled' : 'star-empty'}
                                  />
                                ))}
                              </div>
                              <span className="rating-value">{place.rating}</span>
                            </div>
                          )}

                          <div className="place-meta">
                            <div className="added-time">
                              <IoTimeOutline />
                              {place.added_at ? formatTimeAgo(place.added_at) : '最近添加'}
                            </div>
                          </div>
                        </div>

                        <div className="place-card-actions">
                          <button
                            className="place-action-btn navigate-btn"
                            onClick={() => navigateToPlace(place)}
                            title="導航"
                          >
                            <IoNavigateOutline />
                          </button>
                          <button
                            className="place-action-btn remove-btn"
                            onClick={() => removePlaceFromList(selectedList.id, place.place_id || place.restaurant_id)}
                            title="移除"
                          >
                            <IoTrashOutline />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="no-list-selected">
              <IoListOutline className="no-list-icon" />
              <h3>選擇一個清單</h3>
              <p>從左側選擇一個清單來查看詳細內容</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}