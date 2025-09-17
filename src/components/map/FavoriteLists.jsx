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
} from "react-icons/io5";
import { userDataService } from "../../services/userDataService";
import { authService } from "../../services/authService";
import "./FavoriteLists.css";

export default function FavoriteLists({
  user,
  onListSelect,
  onPlaceAdd,
  onListUpdate,
  selectedPlace,
  isOpen,
  onToggle,
}) {
  const [favoriteLists, setFavoriteLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [editingListId, setEditingListId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
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

  // 點擊外部關閉菜單
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openMenuId && !event.target.closest(".map-list-card-menu")) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openMenuId]);

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
        const listsWithPlaces = result.lists.map((list) => ({
          ...list,
          places: (list.favorite_list_places || []).map(place => ({
            ...place,
            photo: place.photo_url // 將 photo_url 轉換為 photo 欄位
          })),
        }));

        setFavoriteLists(listsWithPlaces);

        // 只在初次載入時自動選擇第一個清單
        if (isInitialLoad && listsWithPlaces.length > 0) {
          setSelectedListId(listsWithPlaces[0].id);
          onListSelect?.(listsWithPlaces[0]);

          // 通知父組件清單已更新
          if (onListUpdate) {
            onListUpdate(listsWithPlaces[0]);
          }
          setIsInitialLoad(false);
        } else if (!isInitialLoad) {
          // 非初次載入時，保持當前選中的清單
          const currentList = listsWithPlaces.find(
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
            color: "#ff6b35",
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

    try {
      setLoading(true);
      const result = await userDataService.createFavoriteList(
        user.id,
        {
          name: newListName.trim(),
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
    setEditingListId(list.id);
    setEditingName(list.name);
    setOpenMenuId(null);
  };

  const editListName = async (listId, newName) => {
    if (!newName.trim()) return;

    try {
      setLoading(true);
      const result = await userDataService.updateFavoriteList(listId, {
        name: newName.trim(),
      });

      if (result.success) {
        const updatedLists = favoriteLists.map((list) =>
          list.id === listId ? { ...list, name: newName.trim() } : list
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

  const addPlaceToList = async (listId, place) => {
    try {
      setLoading(true);
      const result = await userDataService.addPlaceToList(listId, {
        place_id: place.place_id,
        name: place.name,
        address: place.formatted_address || "",
        rating: place.rating || null,
        photo_url: place.photos?.[0]?.getUrl({ maxWidth: 200 }) || null,
        notes: "",
      });

      if (result.success) {
        // 重新載入清單以確保數據同步（不顯示載入指示器）
        await loadFavoriteLists(false);
        onPlaceAdd?.();
        showNotification("已加入收藏清單！", "success");
      } else {
        showNotification(result.error || "加入收藏失敗", "error");
      }
    } catch (error) {
      console.error("加入收藏錯誤:", error);
      showNotification("加入收藏失敗，請重試", "error");
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

  const getRandomColor = () => {
    const colors = [
      "#ff6b35",
      "#22c55e",
      "#3b82f6",
      "#8b5cf6",
      "#f59e0b",
      "#ef4444",
      "#ec4899",
      "#06b6d4",
      "#84cc16",
      "#f97316",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
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
            {favoriteLists.map((list) => (
              <div
                key={list.id}
                className={`map-list-item ${
                  selectedListId === list.id ? "selected" : ""
                }`}
                onClick={() => {
                  setSelectedListId(list.id);
                  onListSelect?.(list);
                  onListUpdate?.(list);
                }}
              >
                <div className="map-list-card-header">
                  <div className="map-list-card-info">
                    <div
                      className="map-list-color-dot"
                      style={{ backgroundColor: list.color }}
                    ></div>
                    <div className="map-list-card-details">
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
                          className="map-edit-input"
                          autoFocus
                        />
                      ) : (
                        <h5 className="map-list-name">{list.name}</h5>
                      )}
                      <p className="map-list-count">
                        {list.places.length} 個地點
                      </p>
                    </div>
                  </div>

                  <div className="map-list-card-menu">
                    <button
                      className="map-list-menu-trigger"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === list.id ? null : list.id);
                      }}
                      title="更多選項"
                    >
                      <IoEllipsisVertical />
                    </button>

                    <div
                      className={`map-list-card-actions ${
                        openMenuId === list.id ? "show" : ""
                      }`}
                    >
                      <button
                        className="map-list-action-btn map-edit-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditList(list);
                        }}
                      >
                        <span className="map-action-icon">
                          <IoCreateOutline />
                        </span>
                        編輯清單
                      </button>
                      {favoriteLists.length > 1 && (
                        <button
                          className="map-list-action-btn map-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            deleteList(list.id);
                          }}
                        >
                          <span className="map-action-icon">
                            <IoTrashOutline />
                          </span>
                          刪除清單
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

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
                {selectedPlace && (
                  <button
                    className="map-add-place-btn"
                    onClick={() =>
                      addPlaceToList(selectedList.id, selectedPlace)
                    }
                    title="將選中的地點加入此清單"
                  >
                    <IoAddOutline />
                    加入地點
                  </button>
                )}
              </div>

              <div className="map-places-list">
                {selectedList.places.length === 0 ? (
                  <div className="map-empty-list">
                    <IoRestaurantOutline className="map-empty-icon" />
                    <p>尚無收藏的地點</p>
                    <p className="map-empty-hint">點選地圖上的餐廳加入收藏</p>
                  </div>
                ) : (
                  selectedList.places.map((place) => (
                    <div key={place.place_id} className="map-place-item">
                      {place.photo ? (
                        <img
                          src={place.photo}
                          alt={place.name}
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
                        <h5 className="map-place-name">{place.name}</h5>
                        <p className="map-place-address">{place.address}</p>
                        {place.rating && (
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
                      <button
                        className="map-remove-place-btn"
                        onClick={() =>
                          removePlaceFromList(selectedList.id, place.place_id)
                        }
                        title="移除此地點"
                      >
                        <IoTrashOutline />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
