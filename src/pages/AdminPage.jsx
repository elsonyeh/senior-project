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

export default function AdminPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activeTab, setActiveTab] = useState("restaurants"); // 'restaurants' 或 'rooms'
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
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

  // 檢查管理員權限
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        console.log("AdminPage: 開始檢查管理員權限...");

        // 判斷是否為開發環境
        const isDevelopment =
          process.env.NODE_ENV === "development" ||
          window.location.hostname === "localhost" ||
          window.location.hostname.includes("127.0.0.1");

        // 開發環境下提供更寬鬆的權限檢查
        if (isDevelopment && localStorage.getItem("isAdmin") === "true") {
          console.log("AdminPage: 開發環境，本地存儲顯示是管理員");
          setIsAdmin(true);
          setLoading(false);

          // 獲取初始數據
          fetchRestaurants();
          fetchRooms();
          return;
        }

        // 標準環境下的管理員檢查
        const adminStatus = await isAdminUser();
        console.log("AdminPage: 管理員檢查結果:", adminStatus);
        setIsAdmin(adminStatus);

        if (!adminStatus) {
          console.log("AdminPage: 不是管理員，重定向到登入頁面");
          navigate("/admin-login");
          return;
        }

        console.log("AdminPage: 確認是管理員，獲取數據");
        // 獲取初始數據
        fetchRestaurants();
        fetchRooms();
      } catch (error) {
        console.error("AdminPage: 檢查管理員狀態失敗:", error);

        // 開發環境下出錯時允許訪問
        if (process.env.NODE_ENV === "development") {
          console.log("AdminPage: 開發環境，權限檢查錯誤時默認通過");
          setIsAdmin(true);
          setLoading(false);
          fetchRestaurants();
          fetchRooms();
          return;
        }

        navigate("/admin-login");
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [navigate]);

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
          fetchRooms(); // 重新獲取房間列表
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

    let latlng;
    try {
      latlng = await geocodeAddress(newRestaurant.address);
    } catch (err) {
      alert("地址轉換失敗：" + err.message);
      return;
    }

    // 將餐廳資料存入 Firestore
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

    // 上傳圖片到 Storage 並更新餐廳文檔
    if (newRestaurant.imageFile) {
      const storageRef = ref(storage, `restaurant_images/${docRef.id}`);
      await uploadBytes(storageRef, newRestaurant.imageFile);
      const url = await getDownloadURL(storageRef);
      await updateDoc(docRef, { photoURL: url });
    }

    // 重置表單
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

    // 重新獲取餐廳列表
    fetchRestaurants();
  };

  // 從 Firestore 刪除餐廳
  const handleDelete = async (id) => {
    if (window.confirm("確定要刪除這個餐廳嗎？")) {
      await deleteDoc(doc(db, "restaurants", id));
      fetchRestaurants();
    }
  };

  // 更新 Firestore 中的餐廳資料
  const handleUpdate = async (id, field, value) => {
    const restaurantRef = doc(db, "restaurants", id);

    // 根據不同欄位類型處理值
    const updateValue =
      field === "tags"
        ? value.split(",").map((t) => t.trim()) // 標籤轉換為陣列
        : field === "isSpicy"
        ? Boolean(value) // 轉為布林值
        : field === "rating"
        ? parseFloat(value) // 轉為浮點數
        : value; // 其他保持原值

    await updateDoc(restaurantRef, {
      [field]: updateValue,
      updatedAt: new Date(),
    });

    fetchRestaurants();
  };

  // 上傳餐廳圖片
  const handleUploadImage = async (id, file) => {
    if (!file) return;

    const storageRef = ref(storage, `restaurant_images/${id}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    await updateDoc(doc(db, "restaurants", id), {
      photoURL: url,
      updatedAt: new Date(),
    });

    fetchRestaurants();
  };

  // 如果正在載入，顯示載入中畫面
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <div>載入中...</div>
      </div>
    );
  }

  // 如果不是管理員且已完成檢查，不顯示內容
  if (!isAdmin && !loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <div>
          <h2>無訪問權限</h2>
          <p>您沒有管理員權限。</p>
          <button onClick={() => navigate("/admin-login")}>返回登入頁面</button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "2rem",
        fontFamily: "Arial, sans-serif",
        backgroundColor: "#f9f9f9",
        minHeight: "100vh",
        overflow: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h1 style={{ color: "#333" }}>📋 餐廳管理系統</h1>
        <button
          onClick={handleLogout}
          style={{
            backgroundColor: "#f44336",
            color: "white",
            padding: "8px 16px",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          登出
        </button>
      </div>

      {/* 切換頁籤 */}
      <div style={{ display: "flex", marginBottom: "1rem" }}>
        <button
          onClick={() => setActiveTab("restaurants")}
          style={{
            padding: "10px 20px",
            backgroundColor:
              activeTab === "restaurants" ? "#4CAF50" : "#e0e0e0",
            color: activeTab === "restaurants" ? "white" : "black",
            border: "none",
            borderRadius: "4px 0 0 4px",
            cursor: "pointer",
          }}
        >
          餐廳資料 (Firestore)
        </button>
        <button
          onClick={() => setActiveTab("rooms")}
          style={{
            padding: "10px 20px",
            backgroundColor: activeTab === "rooms" ? "#2196F3" : "#e0e0e0",
            color: activeTab === "rooms" ? "white" : "black",
            border: "none",
            borderRadius: "0 4px 4px 0",
            cursor: "pointer",
          }}
        >
          房間管理 (Realtime DB)
        </button>
      </div>

      {/* 餐廳管理內容 */}
      {activeTab === "restaurants" && (
        <>
          <div
            style={{
              backgroundColor: "#fff",
              padding: "1rem",
              borderRadius: "8px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              marginBottom: "1rem",
            }}
          >
            <h3>➕ 新增餐廳</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "10px",
                marginBottom: "10px",
              }}
            >
              <input
                placeholder="名稱"
                value={newRestaurant.name}
                onChange={(e) =>
                  setNewRestaurant({ ...newRestaurant, name: e.target.value })
                }
                style={{
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              />
              <input
                placeholder="類型"
                value={newRestaurant.type}
                onChange={(e) =>
                  setNewRestaurant({ ...newRestaurant, type: e.target.value })
                }
                style={{
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              />
              <input
                placeholder="地址"
                value={newRestaurant.address}
                onChange={(e) =>
                  setNewRestaurant({
                    ...newRestaurant,
                    address: e.target.value,
                  })
                }
                style={{
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              />
              <input
                placeholder="標籤（逗號分隔）"
                value={newRestaurant.tags}
                onChange={(e) =>
                  setNewRestaurant({ ...newRestaurant, tags: e.target.value })
                }
                style={{
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              />
              <select
                value={newRestaurant.priceRange}
                onChange={(e) =>
                  setNewRestaurant({
                    ...newRestaurant,
                    priceRange: e.target.value,
                  })
                }
                style={{
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              >
                <option value="$">$</option>
                <option value="$$">$$</option>
                <option value="$$$">$$$</option>
              </select>
              <input
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
                style={{
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              />
              <select
                value={newRestaurant.suggestedPeople}
                onChange={(e) =>
                  setNewRestaurant({
                    ...newRestaurant,
                    suggestedPeople: e.target.value,
                  })
                }
                style={{
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              >
                <option value="1~4">1~4 人</option>
                <option value="5~8">5~8 人</option>
                <option value="8以上">8 人以上</option>
                <option value="1~8">1~8 人</option>
              </select>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "10px",
              }}
            >
              <label
                style={{ display: "flex", alignItems: "center", gap: "5px" }}
              >
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

            <button
              onClick={handleAdd}
              style={{
                backgroundColor: "#4CAF50",
                color: "white",
                padding: "10px 15px",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              新增餐廳
            </button>
          </div>

          <div style={{ height: "calc(100vh - 400px)", overflowY: "auto" }}>
            <h3>📂 所有餐廳 ({restaurants.length})</h3>
            <table
              border="1"
              cellPadding="6"
              style={{
                width: "100%",
                marginTop: "1rem",
                backgroundColor: "#fff",
                borderCollapse: "collapse",
              }}
            >
              <thead
                style={{
                  backgroundColor: "#efefef",
                  position: "sticky",
                  top: 0,
                }}
              >
                <tr>
                  <th>圖片</th>
                  <th>名稱</th>
                  <th>類型</th>
                  <th>地址</th>
                  <th>標籤</th>
                  <th>價格</th>
                  <th>星等</th>
                  <th>人數</th>
                  <th>辣</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {restaurants.length === 0 ? (
                  <tr>
                    <td
                      colSpan="10"
                      style={{ textAlign: "center", padding: "20px" }}
                    >
                      尚無餐廳資料
                    </td>
                  </tr>
                ) : (
                  restaurants.map((r) => (
                    <tr key={r.id}>
                      <td style={{ textAlign: "center" }}>
                        {r.photoURL ? (
                          <img
                            src={r.photoURL}
                            alt="餐廳圖"
                            width="60"
                            style={{ marginBottom: "5px" }}
                          />
                        ) : (
                          <div style={{ color: "#888", marginBottom: "5px" }}>
                            無圖片
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            handleUploadImage(r.id, e.target.files[0])
                          }
                          style={{ maxWidth: "120px" }}
                        />
                      </td>
                      <td>
                        <input
                          value={r.name}
                          onChange={(e) =>
                            handleUpdate(r.id, "name", e.target.value)
                          }
                          style={{ width: "100%", padding: "4px" }}
                        />
                      </td>
                      <td>
                        <input
                          value={r.type}
                          onChange={(e) =>
                            handleUpdate(r.id, "type", e.target.value)
                          }
                          style={{ width: "100%", padding: "4px" }}
                        />
                      </td>
                      <td>
                        <input
                          value={r.address || ""}
                          onChange={(e) =>
                            handleUpdate(r.id, "address", e.target.value)
                          }
                          style={{ width: "100%", padding: "4px" }}
                        />
                      </td>
                      <td>
                        <input
                          value={r.tags?.join(", ") || ""}
                          onChange={(e) =>
                            handleUpdate(r.id, "tags", e.target.value)
                          }
                          style={{ width: "100%", padding: "4px" }}
                        />
                      </td>
                      <td>
                        <select
                          value={r.priceRange}
                          onChange={(e) =>
                            handleUpdate(r.id, "priceRange", e.target.value)
                          }
                          style={{ padding: "4px" }}
                        >
                          <option value="$">$</option>
                          <option value="$$">$$</option>
                          <option value="$$$">$$$</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          max="5"
                          value={r.rating || 0}
                          onChange={(e) =>
                            handleUpdate(r.id, "rating", e.target.value)
                          }
                          style={{ width: "60px", padding: "4px" }}
                        />
                      </td>
                      <td>
                        <select
                          value={r.suggestedPeople}
                          onChange={(e) =>
                            handleUpdate(
                              r.id,
                              "suggestedPeople",
                              e.target.value
                            )
                          }
                          style={{ padding: "4px" }}
                        >
                          <option value="1~4">1~4 人</option>
                          <option value="5~8">5~8 人</option>
                          <option value="8以上">8 人以上</option>
                          <option value="1~8">1~8 人</option>
                        </select>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={r.isSpicy || false}
                          onChange={(e) =>
                            handleUpdate(r.id, "isSpicy", e.target.checked)
                          }
                        />
                      </td>
                      <td>
                        <button
                          onClick={() => handleDelete(r.id)}
                          style={{
                            backgroundColor: "#f44336",
                            color: "white",
                            padding: "5px 10px",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
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
        </>
      )}

      {/* 房間管理內容 */}
      {activeTab === "rooms" && (
        <div style={{ height: "calc(100vh - 250px)", overflowY: "auto" }}>
          <div
            style={{
              backgroundColor: "#fff",
              padding: "1rem",
              borderRadius: "8px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3>🏠 房間管理 (Realtime Database)</h3>
              <button
                onClick={fetchRooms}
                style={{
                  backgroundColor: "#2196F3",
                  color: "white",
                  padding: "5px 10px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                🔄 刷新列表
              </button>
            </div>

            <table
              border="1"
              cellPadding="6"
              style={{
                width: "100%",
                marginTop: "1rem",
                backgroundColor: "#fff",
                borderCollapse: "collapse",
              }}
            >
              <thead
                style={{
                  backgroundColor: "#e3f2fd",
                  position: "sticky",
                  top: 0,
                }}
              >
                <tr>
                  <th>房間ID</th>
                  <th>房主</th>
                  <th>成員數</th>
                  <th>狀態</th>
                  <th>創建時間</th>
                  <th>最後更新</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rooms.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      style={{ textAlign: "center", padding: "20px" }}
                    >
                      尚無活動房間
                    </td>
                  </tr>
                ) : (
                  rooms.map((room) => (
                    <tr key={room.id}>
                      <td>{room.id}</td>
                      <td>{room.hostName || "未知"}</td>
                      <td>
                        {room.members ? Object.keys(room.members).length : 0}
                      </td>
                      <td>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "10px",
                            fontSize: "0.8em",
                            backgroundColor:
                              room.status === "waiting"
                                ? "#ffeb3b"
                                : room.status === "recommend"
                                ? "#4caf50"
                                : room.status === "completed"
                                ? "#9e9e9e"
                                : "#e0e0e0",
                            color:
                              room.status === "waiting"
                                ? "#212121"
                                : room.status === "recommend"
                                ? "white"
                                : room.status === "completed"
                                ? "white"
                                : "#212121",
                          }}
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
                      <td>
                        {room.createdAt
                          ? new Date(room.createdAt).toLocaleString()
                          : "未知"}
                      </td>
                      <td>
                        {room.lastUpdated
                          ? new Date(room.lastUpdated).toLocaleString()
                          : "未知"}
                      </td>
                      <td>
                        <button
                          onClick={() => handleDeleteRoom(room.id)}
                          style={{
                            backgroundColor: "#f44336",
                            color: "white",
                            padding: "5px 10px",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
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
