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
  IoStarOutline,
  IoTimeOutline
} from 'react-icons/io5';
import './MyLists.css';

export default function MyLists({ user }) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedList, setSelectedList] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState('');

  useEffect(() => {
    loadUserLists();
  }, [user]);

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
          return {
            ...list,
            places: list.favorite_list_places || list.places || []
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

    try {
      const result = await userDataService.createFavoriteList(
        user.id, 
        {
          name: newListName.trim(),
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
      } else {
        alert(result.error || '創建清單失敗');
      }
    } catch (error) {
      console.error('創建清單錯誤:', error);
      alert('創建清單失敗，請重試');
    }
  };

  // 刪除清單
  const deleteList = async (listId) => {
    if (lists.length === 1) {
      alert('至少需要保留一個清單');
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
        } else {
          alert(result.error || '刪除清單失敗');
        }
      } catch (error) {
        console.error('刪除清單錯誤:', error);
        alert('刪除清單失敗，請重試');
      }
    }
  };

  // 從清單移除地點
  const removePlaceFromList = async (listId, placeId) => {
    try {
      const result = await userDataService.removePlaceFromListByPlaceId(listId, placeId);
      
      if (result.success) {
        // 重新載入清單以確保數據同步
        await loadUserLists();
        alert('已移除收藏！');
      } else {
        alert(result.error || '移除收藏失敗');
      }
    } catch (error) {
      console.error('移除收藏錯誤:', error);
      alert('移除收藏失敗，請重試');
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
            <div
              key={list.id}
              className={`list-card ${selectedList?.id === list.id ? 'selected' : ''}`}
              onClick={() => setSelectedList(list)}
            >
              <div className="list-card-header">
                <div
                  className="list-color-indicator"
                  style={{ backgroundColor: list.color }}
                ></div>
                <div className="list-card-info">
                  <h3 className="list-card-name">{list.name}</h3>
                  <p className="list-card-count">{list.places?.length || list.favorite_list_places?.length || 0} 個地點</p>
                </div>
              </div>
              
              <div className="list-card-actions">
                <button
                  className="list-action-btn edit-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    // 編輯功能可以後續添加
                  }}
                  title="編輯清單"
                >
                  <IoCreateOutline />
                </button>
                {lists.length > 1 && (
                  <button
                    className="list-action-btn delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteList(list.id);
                    }}
                    title="刪除清單"
                  >
                    <IoTrashOutline />
                  </button>
                )}
              </div>
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
                  <p className="list-content-description">
                    {selectedList.description || '沒有描述'}
                  </p>
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
                  (selectedList.places || selectedList.favorite_list_places || []).map(place => (
                    <div key={place.place_id} className="place-card">
                      <div className="place-image-container">
                        <img
                          src={place.photo || '/default-restaurant.jpg'}
                          alt={place.name}
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
                        <h4 className="place-name">{place.name}</h4>
                        <p className="place-address">{place.address}</p>
                        
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
                        
                        <div className="place-meta">
                          <div className="added-time">
                            <IoTimeOutline />
                            {formatTimeAgo(place.added_at)}
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
                          onClick={() => removePlaceFromList(selectedList.id, place.place_id)}
                          title="移除"
                        >
                          <IoTrashOutline />
                        </button>
                      </div>
                    </div>
                  ))
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