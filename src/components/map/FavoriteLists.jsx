import React, { useState, useEffect } from "react";
import {
  IoHeartOutline,
  IoHeart,
  IoAddOutline,
  IoCreateOutline,
  IoTrashOutline,
  IoChevronDownOutline,
  IoListOutline,
  IoRestaurantOutline,
  IoCloseOutline,
  IoCheckmarkCircleOutline,
  IoWarningOutline,
  IoAlertCircleOutline,
  IoEllipsisVertical,
  IoNavigateOutline,
} from "react-icons/io5";
import { userDataService } from "../../services/userDataService";
import "./FavoriteLists.css";

export default function FavoriteLists({
  user,
  onListSelect,
  onListUpdate,
  onListsChange,
  isOpen,
  onToggle,
  refreshTrigger = 0,
}) {
  const [favoriteLists, setFavoriteLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [editingListId, setEditingListId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [swipedListId, setSwipedListId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "success",
  });
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // 載入喜愛清單
  useEffect(() => {
    if (user) {
      loadFavoriteLists();
    }
  }, [user]);

  // 監聽 refreshTrigger 變化，重新載入清單
  useEffect(() => {
    if (refreshTrigger > 0 && user) {
      loadFavoriteLists(false); // 不顯示 loading，靜默更新
    }
  }, [refreshTrigger, user]);

  // 點擊外部關閉滑動選單
  useEffect(() => {
    const handleClickOutside = (event) => {
      // 確保不會誤判三個點按鈕或滑動按鈕的點擊
      if (
        swipedListId &&
        !event.target.closest(".fav-list-item-wrapper") &&
        !event.target.closest(".fav-list-menu-trigger") &&
        !event.target.closest(".fav-swipe-actions")
      ) {
        setSwipedListId(null);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [swipedListId]);

  const loadFavoriteLists = async (showLoadingIndicator = true) => {
    if (!user) return;

    try {
      if (showLoadingIndicator) {
        setLoading(true);
      }

      const result = await userDataService.getFavoriteLists(
        user.id,
        user.email
      );

      if (result.success) {
        // 轉換數據格式以兼容現有的地圖頁邏輯
        const listsWithPlaces = result.lists.map((list) => {
          return {
            ...list,
            places: (list.favorite_list_places || []).map(place => {
              return {
                // 使用 restaurant_id 作為 place_id 以保持相容性
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
            }),
          };
        });

        // 確保「我的最愛」清單有正確的紅色
        const listsWithCorrectColors = await Promise.all(listsWithPlaces.map(async list => {
          if (list.name === '我的最愛' && list.color !== '#ef4444') {
            // 更新資料庫中的顏色
            try {
              const updateResult = await userDataService.updateFavoriteList(list.id, { color: '#ef4444' });
              if (updateResult.success) {
                return { ...list, color: '#ef4444' };
              }
            } catch (error) {
              console.error('❌ 更新「我的最愛」顏色失敗:', error);
            }
          }
          return list;
        }));

        // 將「我的最愛」置頂，其他清單按建立時間排序
        const sortedLists = listsWithCorrectColors.sort((a, b) => {
          if (a.name === '我的最愛') return -1;
          if (b.name === '我的最愛') return 1;
          return new Date(a.created_at) - new Date(b.created_at);
        });

        setFavoriteLists(sortedLists);

        // 只在初次載入時自動選擇「我的最愛」清單（如果存在）
        if (isInitialLoad && sortedLists.length > 0) {
          const myFavoriteList = sortedLists.find(list => list.name === '我的最愛') || sortedLists[0];
          setSelectedListId(myFavoriteList.id);
          onListSelect?.(myFavoriteList);

          // 通知父組件清單已更新
          if (onListUpdate) {
            onListUpdate(myFavoriteList);
          }
          setIsInitialLoad(false);
        } else if (!isInitialLoad) {
          // 非初次載入時，保持當前選中的清單
          const currentList = sortedLists.find(
            (list) => list.id === selectedListId
          );
          if (currentList && onListUpdate) {
            onListUpdate(currentList);
          }
        }
      } else {
        console.error("載入收藏清單失敗:", result.error);
        if (isInitialLoad) {
          // 創建預設清單
          const defaultList = {
            id: "default",
            name: "我的最愛",
            places: [],
            created_at: new Date().toISOString(),
            color: "#ef4444", // 紅色
          };
          setFavoriteLists([defaultList]);
          setSelectedListId(defaultList.id);
          onListSelect?.(defaultList);
          setIsInitialLoad(false);
        }
      }
    } catch (error) {
      console.error("Error loading favorite lists:", error);
      if (isInitialLoad) {
        showNotification("載入清單失敗，請重新整理頁面", "error");
        setIsInitialLoad(false);
      }
    } finally {
      if (showLoadingIndicator) {
        setLoading(false);
      }
    }
  };

  const createNewList = async () => {
    if (!newListName.trim() || !user) return;

    // 檢查是否重名
    const trimmedName = newListName.trim();
    const isDuplicate = favoriteLists.some(list => list.name === trimmedName);
    if (isDuplicate) {
      showNotification("清單名稱已存在，請使用不同的名稱", "warning");
      return;
    }

    // 檢查清單數量限制（最多5個，包含「我的最愛」）
    if (favoriteLists.length >= 5) {
      showNotification("最多只能建立 5 個清單（含我的最愛）", "error");
      return;
    }

    try {
      setLoading(true);
      const result = await userDataService.createFavoriteList(
        user.id,
        {
          name: trimmedName,
          color: getRandomColor(),
        },
        user.email
      );

      if (result.success) {
        const newList = {
          ...result.list,
          places: [],
        };
        const updatedLists = [...favoriteLists, newList];
        setFavoriteLists(updatedLists);
        setSelectedListId(newList.id);
        onListSelect?.(newList);
        setNewListName("");
        setShowCreateForm(false);
        // 通知 MapPage 重新載入清單
        onListsChange?.();
      } else {
        showNotification(result.error || "創建清單失敗", "error");
      }
    } catch (error) {
      console.error("創建清單錯誤:", error);
      showNotification("創建清單失敗，請重試", "error");
    } finally {
      setLoading(false);
    }
  };

  const deleteList = async (listId) => {
    // 檢查是否為預設清單
    const targetList = favoriteLists.find(list => list.id === listId);
    if (targetList && targetList.name === '我的最愛') {
      showNotification("預設清單「我的最愛」不能刪除", "warning");
      return;
    }

    if (favoriteLists.length === 1) {
      showNotification("至少需要保留一個清單", "warning");
      return;
    }

    if (confirm("確定要刪除這個清單嗎？此操作不可復原。")) {
      try {
        setLoading(true);
        const result = await userDataService.deleteFavoriteList(listId);

        if (result.success) {
          const updatedLists = favoriteLists.filter(
            (list) => list.id !== listId
          );
          setFavoriteLists(updatedLists);

          if (selectedListId === listId && updatedLists.length > 0) {
            setSelectedListId(updatedLists[0].id);
            onListSelect?.(updatedLists[0]);
          }
          // 通知 MapPage 重新載入清單
          onListsChange?.();
        } else {
          showNotification(result.error || "刪除清單失敗", "error");
        }
      } catch (error) {
        console.error("刪除清單錯誤:", error);
        showNotification("刪除清單失敗，請重試", "error");
      } finally {
        setLoading(false);
      }
    }
  };

  // 開始編輯清單
  const startEditList = (list) => {
    // 檢查是否為預設清單
    if (list.name === '我的最愛') {
      showNotification("預設清單「我的最愛」不能改名", "warning");
      return;
    }
    setEditingListId(list.id);
    setEditingName(list.name);
    setOpenMenuId(null);
  };

  const editListName = async (listId, newName) => {
    if (!newName.trim()) return;

    // 檢查是否重名（排除自己）
    const trimmedName = newName.trim();
    const isDuplicate = favoriteLists.some(list => list.id !== listId && list.name === trimmedName);
    if (isDuplicate) {
      showNotification("清單名稱已存在，請使用不同的名稱", "warning");
      setEditingListId(null);
      setEditingName("");
      return;
    }

    try {
      setLoading(true);
      const result = await userDataService.updateFavoriteList(listId, {
        name: trimmedName,
      });

      if (result.success) {
        const updatedLists = favoriteLists.map((list) =>
          list.id === listId ? { ...list, name: trimmedName } : list
        );
        setFavoriteLists(updatedLists);
        setEditingListId(null);
        setEditingName("");
      } else {
        showNotification(result.error || "更新清單失敗", "error");
      }
    } catch (error) {
      console.error("更新清單錯誤:", error);
      showNotification("更新清單失敗，請重試", "error");
    } finally {
      setLoading(false);
    }
  };


  const removePlaceFromList = async (listId, placeId) => {
    try {
      setLoading(true);
      const result = await userDataService.removePlaceFromListByPlaceId(
        listId,
        placeId
      );

      if (result.success) {
        // 重新載入清單以確保數據同步（不顯示載入指示器）
        await loadFavoriteLists(false);
        showNotification("已移除收藏！", "success");
      } else {
        showNotification(result.error || "移除收藏失敗", "error");
      }
    } catch (error) {
      console.error("移除收藏錯誤:", error);
      showNotification("移除收藏失敗，請重試", "error");
    } finally {
      setLoading(false);
    }
  };

  // 取得未使用的顏色（避免重複）
  const getRandomColor = () => {
    const colors = [
      "#ef4444", // 紅色（我的最愛專用）
      "#22c55e", // 綠色
      "#3b82f6", // 藍色
      "#8b5cf6", // 紫色
      "#f59e0b", // 琥珀色
      "#ec4899", // 粉紅色
      "#06b6d4", // 青色
      "#84cc16", // 萊姆綠
      "#f97316", // 橙色
    ];

    // 收集已使用的顏色
    const usedColors = favoriteLists.map(list => list.color);

    // 找出未使用的顏色
    const availableColors = colors.filter(color => !usedColors.includes(color));

    // 如果還有未使用的顏色，隨機選一個；否則隨機選任意顏色
    const colorPool = availableColors.length > 0 ? availableColors : colors;
    return colorPool[Math.floor(Math.random() * colorPool.length)];
  };

  const showNotification = (message, type = "success") => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: "", type: "success" });
    }, 3000);
  };

  const dismissNotification = () => {
    setNotification({ show: false, message: "", type: "success" });
  };


  const selectedList = favoriteLists.find((list) => list.id === selectedListId);

  // 如果用戶未登入，不顯示清單功能
  if (!user) {
    return (
      <div className={`map-favorite-lists-container ${isOpen ? "open" : ""}`}>
        <div className="map-lists-header" onClick={onToggle}>
          <div className="map-header-content">
            <IoListOutline className="map-header-icon" />
            <h3 className="map-header-title">需要登入</h3>
          </div>
          <IoChevronDownOutline
            className={`map-chevron-icon ${isOpen ? "rotated" : ""}`}
          />
        </div>
        {isOpen && (
          <div className="map-lists-content">
            <div className="map-login-prompt">
              <p>請先登入以使用收藏清單功能</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`map-favorite-lists-container ${isOpen ? "open" : ""}`}>
      {/* 通知消息 */}
      {notification.show && (
        <div className={`map-list-notification ${notification.type}`}>
          <div className="map-notification-content">
            {notification.type === "success" && (
              <IoCheckmarkCircleOutline className="map-notification-icon" />
            )}
            {notification.type === "error" && (
              <IoAlertCircleOutline className="map-notification-icon" />
            )}
            {notification.type === "warning" && (
              <IoWarningOutline className="map-notification-icon" />
            )}
            <span className="map-notification-message">
              {notification.message}
            </span>
          </div>
          <button
            className="map-notification-dismiss"
            onClick={dismissNotification}
            title="關閉"
          >
            <IoCloseOutline />
          </button>
        </div>
      )}

      {/* 標題欄 */}
      <div className="map-lists-header" onClick={onToggle}>
        <div className="map-header-content">
          <IoListOutline className="map-header-icon" />
          <h3 className="map-header-title">我的清單</h3>
          <span className="map-lists-count">({favoriteLists.length})</span>
        </div>
        <IoChevronDownOutline
          className={`map-chevron-icon ${isOpen ? "rotated" : ""}`}
        />
      </div>

      {/* 清單內容 */}
      {isOpen && (
        <div className="map-lists-content">
          {loading && (
            <div className="map-lists-loading">
              <div className="map-loading-spinner"></div>
              <span>載入中...</span>
            </div>
          )}
          {/* 清單選擇器 */}
          <div className="map-lists-selector">
            {favoriteLists.map((list) => {
              const isSwiped = swipedListId === list.id;
              return (
              <div key={list.id} className="fav-list-item-wrapper">
                <div
                  className={`fav-list-item ${
                    selectedListId === list.id ? "selected" : ""
                  } ${isSwiped ? "swiped" : ""}`}
                  onClick={(e) => {
                    // 如果點擊的是三個點按鈕或其子元素,不處理清單選擇
                    if (e.target.closest('.fav-list-menu-trigger')) {
                      return;
                    }
                    setSelectedListId(list.id);
                    onListSelect?.(list);
                    onListUpdate?.(list);
                  }}
                >
                  <div className="fav-list-card-header">
                    <div className="fav-list-card-info">
                      <div
                        className="fav-list-color-dot"
                        style={{ backgroundColor: list.color }}
                      ></div>
                      <div className="fav-list-card-details">
                        {editingListId === list.id ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={() => editListName(list.id, editingName)}
                            onKeyPress={(e) =>
                              e.key === "Enter" &&
                              editListName(list.id, editingName)
                            }
                            className="fav-edit-input"
                            autoFocus
                          />
                        ) : (
                          <h5 className="fav-list-name">{list.name}</h5>
                        )}
                        <p className="fav-list-count">
                          {list.places.length} 個地點
                        </p>
                      </div>
                    </div>

                    {list.name !== '我的最愛' && (
                      <div className="fav-list-card-menu">
                        <button
                          className="fav-list-menu-trigger"
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
                  <div className="fav-swipe-actions">
                    <button
                      className="fav-swipe-btn fav-edit-btn"
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
                    {favoriteLists.length > 1 && (
                      <button
                        className="fav-swipe-btn fav-delete-btn"
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
            );
            })}

            {/* 新增清單 */}
            {showCreateForm ? (
              <div className="map-create-list-form">
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="輸入清單名稱"
                  className="map-new-list-input"
                  onKeyPress={(e) => e.key === "Enter" && createNewList()}
                  autoFocus
                />
                <div className="map-form-actions">
                  <button onClick={createNewList} className="map-confirm-btn">
                    確定
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewListName("");
                    }}
                    className="map-cancel-btn"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="map-add-list-btn"
                onClick={() => setShowCreateForm(true)}
              >
                <IoAddOutline />
                新增清單
              </button>
            )}
          </div>

          {/* 當前清單內容 */}
          {selectedList && (
            <div className="map-current-list-content">
              <div className="map-list-header">
                <h4 className="map-list-title">{selectedList.name}</h4>
              </div>

              <div className="map-places-list">
                {selectedList.places.length === 0 ? (
                  <div className="map-empty-list">
                    <IoRestaurantOutline className="map-empty-icon" />
                    <p>尚無收藏的地點</p>
                    <p className="map-empty-hint">點選地圖上的餐廳加入收藏</p>
                  </div>
                ) : (
                  selectedList.places.map((place) => {
                    // 增加除錯日誌以協助調試

                    return (
                      <div key={place.place_id || place.restaurant_id || place.id} className="map-place-item">
                        {place.photo ? (
                          <img
                            src={place.photo}
                            alt={place.name || '餐廳'}
                            className="map-place-image"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextElementSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div
                          className="map-place-image-fallback"
                          style={{ display: place.photo ? 'none' : 'flex' }}
                        >
                          <IoRestaurantOutline />
                        </div>
                        <div className="map-place-info">
                          <h5 className="map-place-name">{place.name || '未知餐廳'}</h5>
                          <p className="map-place-address">{place.address || '地址未提供'}</p>
                          {place.rating && place.rating > 0 && (
                            <div className="map-place-rating">
                              <span className="map-rating-stars">
                                {"★".repeat(Math.floor(place.rating))}
                                {"☆".repeat(5 - Math.floor(place.rating))}
                              </span>
                              <span className="map-rating-value">
                                {place.rating}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="map-place-actions">
                          <button
                            className="map-navigate-place-btn"
                            onClick={() => {
                              const lat = place.latitude || place.geometry?.location?.lat();
                              const lng = place.longitude || place.geometry?.location?.lng();
                              if (lat && lng) {
                                const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                                window.open(url, '_blank');
                              }
                            }}
                            title="前往此地點"
                          >
                            <IoNavigateOutline />
                          </button>
                          <button
                            className="map-remove-place-btn"
                            onClick={() =>
                              removePlaceFromList(selectedList.id, place.place_id || place.restaurant_id)
                            }
                            title="移除此地點"
                          >
                            <IoTrashOutline />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
