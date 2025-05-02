import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db, storage } from "../services/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  isAdminUser,
  adminLogout,
  getAllRooms,
  deleteRoom,
} from "../services/firebaseService";
import { auth } from "../services/firebase";
import "./AdminPage.css";

const geocodeAddress = async (address) => {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=AIzaSyAPYhzKbFIebkI2fsOxBSIBiUmki8R1C-Y`
  );
  const data = await response.json();
  if (data.status === "OK") {
    const { lat, lng } = data.results[0].geometry.location;
    return { lat, lng };
  } else {
    throw new Error("Geocoding failed: " + data.status);
  }
};

// 管理員郵箱列表
const ADMIN_EMAILS = ["elson921121@gmail.com", "bli86327@gmail.com"];

export default function AdminDashboard() {
  const [restaurants, setRestaurants] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activeTab, setActiveTab] = useState("restaurants");
  const [editingData, setEditingData] = useState({});
  const [newRestaurant, setNewRestaurant] = useState({
    name: "",
    type: "",
    address: "",
    tags: "",
    priceRange: "$",
    rating: 4.0,
    suggestedPeople: "1~4",
    isSpicy: false,
    imageFile: null,
  });

  const navigate = useNavigate();

  // 檢查用戶身份驗證狀態
  useEffect(() => {
    const checkAuthState = () => {
      const user = auth.currentUser;
      if (user) {
        console.log("當前登入用戶 email:", user.email);
        console.log("是否為管理員:", ADMIN_EMAILS.includes(user.email));
        
        // 獲取 token 並檢查 claims
        user.getIdToken().then(token => {
          console.log("用戶 token 已獲取");
          return user.getIdTokenResult();
        }).then(tokenResult => {
          console.log("Token 詳細信息:", tokenResult);
          console.log("Token claims:", tokenResult.claims);
        }).catch(err => {
          console.error("獲取 token 失敗:", err);
        });
      } else {
        console.log("沒有登入用戶");
      }
    };
    
    checkAuthState();
  }, []);

  // 從 Firestore 讀取餐廳資料
  const fetchRestaurants = async () => {
    try {
      const snapshot = await getDocs(collection(db, "restaurants"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRestaurants(data);
    } catch (error) {
      console.error("獲取餐廳數據失敗:", error);
      alert("獲取餐廳數據失敗: " + error.message);
    }
  };

  // 從 Realtime Database 獲取房間數據
  const fetchRooms = async () => {
    try {
      const result = await getAllRooms();
      if (result.success) {
        setRooms(result.rooms);
      } else {
        console.error("獲取房間數據失敗:", result.error);
        alert("獲取房間數據失敗: " + result.error);
      }
    } catch (error) {
      console.error("獲取房間數據失敗:", error);
      alert("獲取房間數據失敗: " + error.message);
    }
  };

  // 初始載入數據
  useEffect(() => {
    fetchRestaurants();
    fetchRooms();
  }, []);

  // 登出管理員
  const handleLogout = async () => {
    try {
      await adminLogout();
      navigate("/admin-login");
    } catch (error) {
      console.error("登出失敗:", error);
      alert("登出失敗: " + error.message);
    }
  };

  // 刪除房間
  const handleDeleteRoom = async (roomId) => {
    if (window.confirm(`確定要刪除房間 ${roomId} 嗎？`)) {
      try {
        const result = await deleteRoom(roomId);
        if (result.success) {
          fetchRooms();
        } else {
          alert("刪除房間失敗: " + result.error);
        }
      } catch (error) {
        console.error("刪除房間失敗:", error);
        alert("刪除房間失敗: " + error.message);
      }
    }
  };

  // 新增餐廳到 Firestore
  const handleAdd = async () => {
    if (!newRestaurant.name) {
      alert("請輸入餐廳名稱");
      return;
    }

    try {
      let latlng;
      try {
        latlng = await geocodeAddress(newRestaurant.address);
      } catch (err) {
        alert("地址轉換失敗：" + err.message);
        return;
      }

      const docRef = await addDoc(collection(db, "restaurants"), {
        name: newRestaurant.name,
        type: newRestaurant.type,
        address: newRestaurant.address,
        tags: newRestaurant.tags.split(",").map((t) => t.trim()),
        priceRange: newRestaurant.priceRange,
        rating: newRestaurant.rating,
        suggestedPeople: newRestaurant.suggestedPeople,
        isSpicy: newRestaurant.isSpicy,
        location: latlng,
        createdAt: new Date(),
      });

      if (newRestaurant.imageFile) {
        const storageRef = ref(storage, `restaurant_images/${docRef.id}`);
        await uploadBytes(storageRef, newRestaurant.imageFile);
        const url = await getDownloadURL(storageRef);
        await updateDoc(docRef, { photoURL: url });
      }

      setNewRestaurant({
        name: "",
        type: "",
        address: "",
        tags: "",
        priceRange: "$",
        rating: 4.0,
        suggestedPeople: "1~4",
        isSpicy: false,
        imageFile: null,
      });

      fetchRestaurants();
    } catch (error) {
      console.error("新增餐廳失敗：", error);
      alert("新增餐廳失敗：" + error.message);
    }
  };

  // 從 Firestore 刪除餐廳
  const handleDelete = async (id) => {
    if (window.confirm("確定要刪除這個餐廳嗎？")) {
      try {
        await deleteDoc(doc(db, "restaurants", id));
        fetchRestaurants();
      } catch (error) {
        console.error("刪除餐廳失敗：", error);
        alert("刪除餐廳失敗：" + error.message);
      }
    }
  };

  // 開始編輯餐廳
  const startEdit = (restaurant) => {
    setEditingData({
      ...editingData,
      [restaurant.id]: {
        name: restaurant.name,
        type: restaurant.type,
        address: restaurant.address || "",
        tags: restaurant.tags?.join(", ") || "",
        priceRange: restaurant.priceRange,
        rating: restaurant.rating || 0,
        suggestedPeople: restaurant.suggestedPeople,
        isSpicy: restaurant.isSpicy || false,
      }
    });
  };

  // 更新本地編輯數據
  const updateEditData = (id, field, value) => {
    setEditingData({
      ...editingData,
      [id]: {
        ...editingData[id],
        [field]: value
      }
    });
  };

  // 儲存編輯的餐廳資料
  const handleSave = async (id) => {
    try {
      const editData = editingData[id];
      if (!editData) return;

      const restaurantRef = doc(db, "restaurants", id);
      
      // 處理不同欄位的數據類型
      const updateData = {
        name: editData.name,
        type: editData.type,
        address: editData.address,
        tags: editData.tags.split(",").map((t) => t.trim()),
        priceRange: editData.priceRange,
        rating: parseFloat(editData.rating),
        suggestedPeople: editData.suggestedPeople,
        isSpicy: Boolean(editData.isSpicy),
        updatedAt: new Date(),
      };

      await updateDoc(restaurantRef, updateData);
      fetchRestaurants();
      
      // 清除編輯狀態
      const newEditingData = {...editingData};
      delete newEditingData[id];
      setEditingData(newEditingData);
      
      alert('儲存成功！');
    } catch (error) {
      console.error("更新餐廳資料失敗：", error);
      alert("更新餐廳資料失敗：" + error.message);
    }
  };

  // 取消編輯
  const cancelEdit = (id) => {
    const newEditingData = {...editingData};
    delete newEditingData[id];
    setEditingData(newEditingData);
  };

  // 上傳餐廳圖片
  const handleUploadImage = async (id, file) => {
    if (!file) return;

    try {
      const storageRef = ref(storage, `restaurant_images/${id}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "restaurants", id), {
        photoURL: url,
        updatedAt: new Date(),
      });

      fetchRestaurants();
    } catch (error) {
      console.error("上傳圖片失敗：", error);
      alert("上傳圖片失敗：" + error.message);
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>📋 餐廳管理系統</h1>
        <button className="logout-button" onClick={handleLogout}>
          登出
        </button>
      </div>

      {/* 顯示當前用戶狀態 */}
      <div style={{ marginBottom: '1rem', padding: '0.5rem', background: '#f0f0f0', borderRadius: '4px' }}>
        <small>
          當前用戶：{auth.currentUser?.email || '未登入'}
          {ADMIN_EMAILS.includes(auth.currentUser?.email) && <span> ✓ 管理員</span>}
        </small>
      </div>

      {/* 切換頁籤 */}
      <div className="tab-container">
        <button
          className={`tab-button ${activeTab === "restaurants" ? "active-restaurants" : "inactive-restaurants"}`}
          onClick={() => setActiveTab("restaurants")}
        >
          餐廳資料 (Firestore)
        </button>
        <button
          className={`tab-button ${activeTab === "rooms" ? "active-rooms" : "inactive-rooms"}`}
          onClick={() => setActiveTab("rooms")}
        >
          房間管理 (Realtime DB)
        </button>
      </div>

      {/* 餐廳管理內容 */}
      {activeTab === "restaurants" && (
        <>
          <div className="add-restaurant-container">
            <h3>➕ 新增餐廳</h3>
            <div className="add-restaurant-grid">
              <input
                className="add-restaurant-input"
                placeholder="名稱"
                value={newRestaurant.name}
                onChange={(e) =>
                  setNewRestaurant({ ...newRestaurant, name: e.target.value })
                }
              />
              <input
                className="add-restaurant-input"
                placeholder="類型"
                value={newRestaurant.type}
                onChange={(e) =>
                  setNewRestaurant({ ...newRestaurant, type: e.target.value })
                }
              />
              <input
                className="add-restaurant-input"
                placeholder="地址"
                value={newRestaurant.address}
                onChange={(e) =>
                  setNewRestaurant({
                    ...newRestaurant,
                    address: e.target.value,
                  })
                }
              />
              <input
                className="add-restaurant-input"
                placeholder="標籤（逗號分隔）"
                value={newRestaurant.tags}
                onChange={(e) =>
                  setNewRestaurant({ ...newRestaurant, tags: e.target.value })
                }
              />
              <select
                className="add-restaurant-input"
                value={newRestaurant.priceRange}
                onChange={(e) =>
                  setNewRestaurant({
                    ...newRestaurant,
                    priceRange: e.target.value,
                  })
                }
              >
                <option value="$">$</option>
                <option value="$$">$$</option>
                <option value="$$$">$$$</option>
              </select>
              <input
                className="add-restaurant-input"
                placeholder="星等（1~5）"
                type="number"
                step="0.1"
                min="1"
                max="5"
                value={newRestaurant.rating}
                onChange={(e) =>
                  setNewRestaurant({
                    ...newRestaurant,
                    rating: parseFloat(e.target.value),
                  })
                }
              />
              <select
                className="add-restaurant-input"
                value={newRestaurant.suggestedPeople}
                onChange={(e) =>
                  setNewRestaurant({
                    ...newRestaurant,
                    suggestedPeople: e.target.value,
                  })
                }
              >
                <option value="1~4">1~4 人</option>
                <option value="5~8">5~8 人</option>
                <option value="8以上">8 人以上</option>
                <option value="1~8">1~8 人</option>
              </select>
            </div>

            <div className="add-restaurant-controls">
              <label className="add-restaurant-label">
                <span>辣嗎？</span>
                <input
                  type="checkbox"
                  checked={newRestaurant.isSpicy}
                  onChange={(e) =>
                    setNewRestaurant({
                      ...newRestaurant,
                      isSpicy: e.target.checked,
                    })
                  }
                />
              </label>

              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setNewRestaurant({
                      ...newRestaurant,
                      imageFile: e.target.files[0],
                    })
                  }
                />
              </div>
            </div>

            <button className="add-restaurant-button" onClick={handleAdd}>
              新增餐廳
            </button>
          </div>

          <div className="restaurant-list-container">
            <h3 className="restaurant-list-header">📂 所有餐廳 ({restaurants.length})</h3>
            <div className="restaurant-table-container">
              <table className="restaurant-table">
                <colgroup>
                  <col className="col-image" />
                  <col className="col-name" />
                  <col className="col-type" />
                  <col className="col-address" />
                  <col className="col-tags" />
                  <col className="col-price" />
                  <col className="col-rating" />
                  <col className="col-people" />
                  <col className="col-spicy" />
                  <col style={{ width: "160px" }} /> {/* 增加操作欄寬度 */}
                </colgroup>
                <thead>
                  <tr>
                    <th className="center">圖片</th>
                    <th className="left">名稱</th>
                    <th className="left">類型</th>
                    <th className="left">地址</th>
                    <th className="left">標籤</th>
                    <th className="center">價格</th>
                    <th className="center">星等</th>
                    <th className="center">人數</th>
                    <th className="center">辣</th>
                    <th className="center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {restaurants.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="empty-message">
                        尚無餐廳資料
                      </td>
                    </tr>
                  ) : (
                    restaurants.map((r) => {
                      const isEditing = editingData[r.id];
                      return (
                        <tr key={r.id}>
                          <td className="center">
                            {r.photoURL ? (
                              <img
                                className="restaurant-image"
                                src={r.photoURL}
                                alt="餐廳圖"
                              />
                            ) : (
                              <div className="restaurant-no-image">無圖片</div>
                            )}
                            <input
                              className="restaurant-image-upload"
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                handleUploadImage(r.id, e.target.files[0])
                              }
                            />
                          </td>
                          <td>
                            <input
                              className="restaurant-input"
                              value={isEditing ? editingData[r.id].name : r.name}
                              onChange={(e) => 
                                isEditing ? updateEditData(r.id, "name", e.target.value) : startEdit(r)
                              }
                              readOnly={!isEditing}
                            />
                          </td>
                          <td>
                            <input
                              className="restaurant-input"
                              value={isEditing ? editingData[r.id].type : r.type}
                              onChange={(e) => 
                                isEditing ? updateEditData(r.id, "type", e.target.value) : startEdit(r)
                              }
                              readOnly={!isEditing}
                            />
                          </td>
                          <td>
                            <input
                              className="restaurant-input"
                              value={isEditing ? editingData[r.id].address : r.address || ""}
                              onChange={(e) => 
                                isEditing ? updateEditData(r.id, "address", e.target.value) : startEdit(r)
                              }
                              readOnly={!isEditing}
                            />
                          </td>
                          <td>
                            <input
                              className="restaurant-input"
                              value={isEditing ? editingData[r.id].tags : r.tags?.join(", ") || ""}
                              onChange={(e) => 
                                isEditing ? updateEditData(r.id, "tags", e.target.value) : startEdit(r)
                              }
                              readOnly={!isEditing}
                            />
                          </td>
                          <td>
                            <select
                              className="restaurant-input"
                              value={isEditing ? editingData[r.id].priceRange : r.priceRange}
                              onChange={(e) => 
                                isEditing ? updateEditData(r.id, "priceRange", e.target.value) : startEdit(r)
                              }
                              disabled={!isEditing}
                            >
                              <option value="$">$</option>
                              <option value="$$">$$</option>
                              <option value="$$$">$$$</option>
                            </select>
                          </td>
                          <td>
                            <input
                              className="restaurant-input"
                              type="number"
                              step="0.1"
                              min="1"
                              max="5"
                              value={isEditing ? editingData[r.id].rating : r.rating || 0}
                              onChange={(e) => 
                                isEditing ? updateEditData(r.id, "rating", e.target.value) : startEdit(r)
                              }
                              readOnly={!isEditing}
                            />
                          </td>
                          <td>
                            <select
                              className="restaurant-input"
                              value={isEditing ? editingData[r.id].suggestedPeople : r.suggestedPeople}
                              onChange={(e) => 
                                isEditing ? updateEditData(r.id, "suggestedPeople", e.target.value) : startEdit(r)
                              }
                              disabled={!isEditing}
                            >
                              <option value="1~4">1~4 人</option>
                              <option value="5~8">5~8 人</option>
                              <option value="8以上">8 人以上</option>
                              <option value="1~8">1~8 人</option>
                            </select>
                          </td>
                          <td className="center">
                            <input
                              type="checkbox"
                              checked={isEditing ? editingData[r.id].isSpicy : r.isSpicy || false}
                              onChange={(e) => 
                                isEditing ? updateEditData(r.id, "isSpicy", e.target.checked) : startEdit(r)
                              }
                              disabled={!isEditing}
                            />
                          </td>
                          <td className="center">
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: '5px' }}>
                                <button
                                  className="save-button"
                                  onClick={() => handleSave(r.id)}
                                  style={{
                                    backgroundColor: "#4CAF50",
                                    color: "white",
                                    padding: "5px 10px",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "12px",
                                  }}
                                >
                                  ✓ 儲存
                                </button>
                                <button
                                  className="cancel-button"
                                  onClick={() => cancelEdit(r.id)}
                                  style={{
                                    backgroundColor: "#f44336",
                                    color: "white",
                                    padding: "5px 10px",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "12px",
                                  }}
                                >
                                  ✕ 取消
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '5px' }}>
                                <button
                                  className="edit-button"
                                  onClick={() => startEdit(r)}
                                  style={{
                                    backgroundColor: "#2196F3",
                                    color: "white",
                                    padding: "5px 10px",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "12px",
                                  }}
                                >
                                  ✎ 編輯
                                </button>
                                <button
                                  className="delete-button"
                                  onClick={() => handleDelete(r.id)}
                                  style={{
                                    backgroundColor: "#f44336",
                                    color: "white",
                                    padding: "5px 10px",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontSize: "12px",
                                  }}
                                >
                                  🗑️ 刪除
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 房間管理內容 */}
      {activeTab === "rooms" && (
        <div className="room-management-container">
          <div className="room-management-header">
            <div className="room-management-controls">
              <h3>🏠 房間管理 (Realtime Database)</h3>
              <button className="refresh-button" onClick={fetchRooms}>
                🔄 刷新列表
              </button>
            </div>
          </div>

          <div className="room-table-container">
            <table className="room-table">
              <thead>
                <tr>
                  <th className="center">房間ID</th>
                  <th className="left">房主</th>
                  <th className="center">成員數</th>
                  <th className="center">狀態</th>
                  <th className="center">創建時間</th>
                  <th className="center">最後更新</th>
                  <th className="center">操作</th>
                </tr>
              </thead>
              <tbody>
                {rooms.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-message">
                      尚無活動房間
                    </td>
                  </tr>
                ) : (
                  rooms.map((room) => (
                    <tr key={room.id}>
                      <td className="center room-id">{room.id}</td>
                      <td>{room.hostName || "未知"}</td>
                      <td className="center">{room.members ? Object.keys(room.members).length : 0}</td>
                      <td className="center">
                        <span
                          className={`room-status ${
                            room.status === "waiting"
                              ? "waiting"
                              : room.status === "recommend"
                              ? "recommend"
                              : room.status === "completed"
                              ? "completed"
                              : "default"
                          }`}
                        >
                          {room.status === "waiting"
                            ? "等待中"
                            : room.status === "recommend"
                            ? "推薦中"
                            : room.status === "completed"
                            ? "已完成"
                            : room.status}
                        </span>
                      </td>
                      <td className="center">
                        {room.createdAt
                          ? new Date(room.createdAt).toLocaleString('zh-TW', { 
                              year: 'numeric', 
                              month: '2-digit', 
                              day: '2-digit', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })
                          : "未知"}
                      </td>
                      <td className="center">
                        {room.lastUpdated
                          ? new Date(room.lastUpdated).toLocaleString('zh-TW', { 
                              year: 'numeric', 
                              month: '2-digit', 
                              day: '2-digit', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })
                          : "未知"}
                      </td>
                      <td className="center">
                        <button
                          className="room-delete-button"
                          onClick={() => handleDeleteRoom(room.id)}
                        >
                          🗑️ 刪除
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}