import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { adminService } from "../services/supabaseService";
import RestaurantManager from "./RestaurantManager";
import DataAnalyticsPage from "./admin/DataAnalyticsPage";
import { InputModal, ConfirmModal, NotificationModal, AdminFormModal } from "./CustomModal";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("restaurants");
  const [adminList, setAdminList] = useState([]);
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [roomList, setRoomList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notification, setNotification] = useState({ type: 'success', title: '', message: '' });
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const navigate = useNavigate();

  // 獲取管理員列表和當前管理員資訊
  useEffect(() => {
    const loadAdminData = async () => {
      // 檢查並修復舊的 session
      const adminSession = localStorage.getItem('adminSession');
      if (adminSession) {
        try {
          const session = JSON.parse(adminSession);
          if (!session.role && session.email === 'elson921121@gmail.com') {
            // 更新 elson 的 session 加上 super_admin 角色
            session.role = 'super_admin';
            localStorage.setItem('adminSession', JSON.stringify(session));
            console.log('已更新 elson 帳戶為超級管理員');
          }
        } catch (error) {
          console.error('修復 session 失敗:', error);
        }
      }
      
      try {
        const currentAdminInfo = await adminService.getCurrentAdmin();
        console.log('Current Admin Info:', currentAdminInfo); // 調試用
        setCurrentAdmin(currentAdminInfo);
      } catch (error) {
        console.error('獲取當前管理員資訊失敗:', error);
        setCurrentAdmin(null);
      }
      
      // 獲取管理員列表（從 Supabase 資料庫）
      try {
        const admins = await adminService.getAllAdmins();
        const adminListWithStatus = await Promise.all(
          admins.map(async admin => {
            const adminInfo = await adminService.getAdminInfo(admin.email);
            return {
              ...admin,
              isOnline: admin.email === getCurrentAdminEmail(),
              lastLoginTime: getLastLoginTime(admin),
              status: admin.email === getCurrentAdminEmail() ? '線上' : '離線',
              roleName: adminInfo?.roleName || '一般管理員'
            };
          })
        );
        setAdminList(adminListWithStatus);
      } catch (error) {
        console.error('獲取管理員列表失敗:', error);
        // 如果 Supabase 不可用，設置空列表
        setAdminList([]);
      }
    };

    loadAdminData();
    if (activeTab === "buddies") {
      loadRoomData();
    }
  }, [activeTab]);

  // 載入房間資料
  const loadRoomData = async () => {
    try {
      setLoading(true);
      const roomResult = await adminService.getAllRooms();
      if (roomResult.success) {
        setRoomList(roomResult.rooms);
      } else {
        console.error('載入房間資料失敗:', roomResult.error);
        setRoomList([]);
      }
    } catch (error) {
      console.error('載入房間資料異常:', error);
      setRoomList([]);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentAdminEmail = () => {
    const adminSession = localStorage.getItem('adminSession');
    if (adminSession) {
      const session = JSON.parse(adminSession);
      return session.email;
    }
    return null;
  };

  const getLastLoginTime = (admin) => {
    // 如果是當前登入的管理員，顯示當前登入時間
    const adminSession = localStorage.getItem('adminSession');
    if (adminSession) {
      try {
        const session = JSON.parse(adminSession);
        if (session.email === admin.email) {
          return new Date(session.loginTime).toLocaleString('zh-TW');
        }
      } catch (error) {
        console.error('解析 session 失敗:', error);
      }
    }
    
    // 否則顯示最後登入時間
    if (admin?.last_login_at) {
      return new Date(admin.last_login_at).toLocaleString('zh-TW');
    }
    
    return '從未登入';
  };

  const handleLogout = async () => {
    try {
      await adminService.adminLogout();
      navigate("/admin-login");
    } catch (error) {
      console.error("登出失敗:", error);
      // 即使登出失敗也跳轉到登入頁面
      navigate("/admin-login");
    }
  };


  // 處理修改姓名
  const handleUpdateName = async (email, currentName) => {
    if (!currentAdmin?.isSuperAdmin && email !== getCurrentAdminEmail()) {
      showNotificationMessage('error', '權限不足', '您只能修改自己的姓名');
      return;
    }

    setEditingAdmin({ email, currentName });
    setShowNameModal(true);
  };

  // 確認修改姓名
  const confirmUpdateName = async (newName) => {
    try {
      console.log('開始修改姓名，目標帳號:', editingAdmin.email);
      const result = await adminService.updateAdminName(editingAdmin.email, newName);
      console.log('updateAdminName 結果:', result);

      if (result.success) {
        setShowNameModal(false);
        showNotificationMessage('success', '更新成功', `姓名已成功更新為：${newName}`);
        await reloadAdminList();

        // 如果是當前用戶，更新當前用戶資訊
        if (editingAdmin.email === getCurrentAdminEmail()) {
          const updatedCurrentAdmin = await adminService.getCurrentAdmin();
          setCurrentAdmin(updatedCurrentAdmin);
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('姓名更新錯誤:', error);
      throw new Error('姓名更新失敗：' + error.message);
    }
  };

  // 重新載入管理員列表
  const reloadAdminList = async () => {
    try {
      setLoading(true);
      console.log('🔄 開始同步管理員資料...');

      const admins = await adminService.getAllAdmins();
      console.log('📋 從 Supabase 獲取到的管理員:', admins);

      const adminListWithStatus = await Promise.all(
        admins.map(async admin => {
          const adminInfo = await adminService.getAdminInfo(admin.email);
          return {
            ...admin,
            isOnline: admin.email === getCurrentAdminEmail(),
            lastLoginTime: getLastLoginTime(admin),
            status: admin.email === getCurrentAdminEmail() ? '線上' : '離線',
            roleName: adminInfo?.roleName || '一般管理員'
          };
        })
      );

      setAdminList(adminListWithStatus);
      console.log('✅ 管理員列表同步完成，共', adminListWithStatus.length, '個活躍帳號');

      if (showNotificationMessage) {
        showNotificationMessage('success', '同步成功', `已同步 ${adminListWithStatus.length} 個活躍管理員帳號`);
      }
    } catch (error) {
      console.error('重新載入管理員列表失敗:', error);
      if (showNotificationMessage) {
        showNotificationMessage('error', '同步失敗', '無法從伺服器同步管理員資料');
      }
    } finally {
      setLoading(false);
    }
  };

  // 顯示通知訊息
  const showNotificationMessage = (type, title, message) => {
    setNotification({ type, title, message });
    setShowNotification(true);
  };

  // 處理重設密碼 - 直接在網頁內重設
  const handleResetPassword = async (email) => {
    if (!currentAdmin?.isSuperAdmin) {
      alert('您沒有超級管理員權限');
      return;
    }
    
    console.log('開始重設密碼，目標帳號:', email);
    const newPassword = prompt(`請輸入 ${email} 的新密碼：`);
    if (!newPassword) return;
    
    if (newPassword.length < 6) {
      alert('密碼長度至少 6 位');
      return;
    }
    
    try {
      console.log('呼叫 updatePassword 方法...');
      const result = await adminService.updatePassword(email, newPassword);
      console.log('updatePassword 結果:', result);
      
      if (result.success) {
        alert(`${email} 的密碼已成功重設為：${newPassword}\\n\\n請記下新密碼，用於登入測試。`);
      } else {
        alert('密碼重設失敗：' + result.error);
      }
    } catch (error) {
      console.error('密碼重設錯誤:', error);
      alert('密碼重設過程發生錯誤：' + error.message);
    }
  };

  // 處理刪除管理員
  const handleDeleteAdmin = async (email) => {
    if (!currentAdmin?.isSuperAdmin) {
      alert('您沒有超級管理員權限');
      return;
    }
    
    if (email === currentAdmin.email) {
      alert('不能刪除自己的帳號');
      return;
    }
    
    console.log('開始刪除管理員，目標帳號:', email);
    
    if (confirm(`確定要刪除管理員 ${email} 嗎？\n\n注意：此操作不可逆轉！`)) {
      try {
        console.log('呼叫 deleteAdmin 方法...');
        const result = await adminService.deleteAdmin(email);
        console.log('deleteAdmin 結果:', result);
        
        if (result.success) {
          alert(`管理員 ${email} 已成功刪除`);
          // 重新載入管理員列表
          try {
            const admins = await adminService.getAllAdmins();
            const adminListWithStatus = await Promise.all(
              admins.map(async admin => {
                const adminInfo = await adminService.getAdminInfo(admin.email);
                return {
                  ...admin,
                  isOnline: admin.email === getCurrentAdminEmail(),
                  lastLoginTime: getLastLoginTime(admin),
                  status: admin.email === getCurrentAdminEmail() ? '線上' : '離線',
                  roleName: adminInfo?.roleName || '一般管理員'
                };
              })
            );
            setAdminList(adminListWithStatus);
          } catch (error) {
            console.error('重新載入管理員列表失敗:', error);
          }
        } else {
          alert('刪除失敗：' + result.error);
        }
      } catch (error) {
        console.error('刪除管理員錯誤:', error);
        alert('刪除過程發生錯誤：' + error.message);
      }
    }
  };

  // 處理新增管理員
  const handleAddAdmin = () => {
    if (!currentAdmin?.isSuperAdmin) {
      showNotificationMessage('error', '權限不足', '只有超級管理員可以新增管理員');
      return;
    }
    setShowAddAdminModal(true);
  };

  // 確認新增管理員
  const confirmAddAdmin = async (adminData) => {
    setAddingAdmin(true);

    try {
      console.log('開始新增管理員:', adminData);
      const result = await adminService.createAdmin(adminData);

      if (result.success) {
        setShowAddAdminModal(false);
        showNotificationMessage('success', '新增成功', `管理員 ${adminData.name} 已成功新增`);
        // 重新載入管理員列表
        await reloadAdminList();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('新增管理員失敗:', error);
      showNotificationMessage('error', '新增失敗', error.message);
    } finally {
      setAddingAdmin(false);
    }
  };

  // 處理匯出操作記錄
  const handleExportLogs = () => {
    if (!currentAdmin?.isSuperAdmin) return;
    
    alert('匯出功能尚未實現（需要後端API支持）');
  };


  // 刪除房間
  const handleDeleteRoom = async (roomId) => {
    if (!currentAdmin?.isSuperAdmin) {
      alert('您沒有超級管理員權限');
      return;
    }
    
    if (confirm(`確定要刪除房間 ${roomId} 嗎？\n\n注意：此操作不可逆轉！`)) {
      try {
        setLoading(true);
        const result = await adminService.deleteRoom(roomId);
        
        if (result.success) {
          alert(`房間 ${roomId} 已成功刪除`);
          // 重新載入房間列表
          await loadRoomData();
        } else {
          alert('刪除失敗：' + result.error);
        }
      } catch (error) {
        console.error('刪除房間錯誤:', error);
        alert('刪除過程發生錯誤：' + error.message);
      } finally {
        setLoading(false);
      }
    }
  };


  return (
    <div className="admin-dashboard">
      {/* 頂部標題列 */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>
            <span className="system-icon">📋</span>
            餐廳管理系統
          </h1>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          登出
        </button>
      </div>

      {/* 用戶資訊列 */}
      <div className="user-info">
        <span>當前用戶：{currentAdmin?.name || currentAdmin?.email || 'elson921121@gmail.com'} / </span>
        <span className="admin-status">管理員</span>
      </div>

      {/* 標籤頁 */}
      <div className="dashboard-tabs">
        <button
          className={`tab-button ${activeTab === "restaurants" ? "active" : ""}`}
          onClick={() => setActiveTab("restaurants")}
        >
          餐廳資料
        </button>
        <button
          className={`tab-button ${activeTab === "buddies" ? "active" : ""}`}
          onClick={() => setActiveTab("buddies")}
        >
          房間管理
        </button>
        <button
          className={`tab-button ${activeTab === "admins" ? "active" : ""}`}
          onClick={() => setActiveTab("admins")}
        >
          管理員管理
        </button>
        <button
          className={`tab-button ${activeTab === "analytics" ? "active" : ""}`}
          onClick={() => setActiveTab("analytics")}
        >
          資料分析
        </button>
      </div>

      {/* 內容區域 */}
      <div className="dashboard-content">
        {activeTab === "restaurants" && <RestaurantManager />}

        {activeTab === "analytics" && <DataAnalyticsPage />}
        
        {activeTab === "buddies" && (
          <div className="buddies-section">
            <div className="section-header">
              <div className="section-title">
                <span className="section-icon">🏠</span>
                <h2>房間管理</h2>
              </div>
              <button className="refresh-btn" onClick={loadRoomData} disabled={loading}>
                🔄 {loading ? '載入中...' : '刷新列表'}
              </button>
            </div>
            
            <div className="data-table">
              <table>
                <thead>
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
                  {loading ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>
                        載入房間資料中...
                      </td>
                    </tr>
                  ) : roomList.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>
                        目前沒有房間資料
                      </td>
                    </tr>
                  ) : (
                    roomList.map((room) => (
                      <tr key={room.id}>
                        <td>{room.id}</td>
                        <td>{room.hostName}</td>
                        <td>{room.memberCount}</td>
                        <td>
                          <span className={`status-${room.status}`}>
                            {room.status === 'waiting' ? '等待中' : 
                             room.status === 'vote' ? '投票中' :
                             room.status === 'recommend' ? '推薦中' :
                             room.status === 'completed' ? '已完成' : room.status}
                          </span>
                        </td>
                        <td>{room.createdAt ? new Date(room.createdAt).toLocaleString('zh-TW') : '-'}</td>
                        <td>{room.lastUpdated ? new Date(room.lastUpdated).toLocaleString('zh-TW') : '-'}</td>
                        <td>
                          {currentAdmin?.isSuperAdmin ? (
                            <button 
                              className="delete-btn"
                              onClick={() => handleDeleteRoom(room.id)}
                              disabled={loading}
                            >
                              🗑️ 刪除
                            </button>
                          ) : (
                            <span>僅可查看</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "admins" && (
          <div className="admins-section">
            <div className="section-header">
              <div className="section-title">
                <span className="section-icon">👥</span>
                <h2>管理員管理</h2>
              </div>
              <div className="admin-status-info">
                <span>當前登入：{currentAdmin?.name || currentAdmin?.email || 'elson921121@gmail.com'} ({currentAdmin?.email})</span>
                <span className="separator"> | </span>
                <span>{currentAdmin?.isSuperAdmin ? '超級管理員權限' : '一般管理員權限'}</span>
              </div>
            </div>
            
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>管理員姓名</th>
                    <th>電子郵件</th>
                    <th>權限等級</th>
                    <th>狀態</th>
                    <th>上次登入時間</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {adminList.map((admin, index) => (
                    <tr key={admin.email}>
                      <td>
                        <div className="admin-info">
                          <span className={`status-indicator ${admin.isOnline ? 'online' : 'offline'}`}></span>
                          {admin.name || '未設定姓名'}
                          {admin.email === getCurrentAdminEmail() && <span className="current-user"> (您)</span>}
                        </div>
                      </td>
                      <td>{admin.email}</td>
                      <td>
                        <span className={`role-badge ${admin.role === 'super_admin' ? 'super-admin' : 'admin'}`}>
                          {admin.roleName}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${admin.isOnline ? 'online' : 'offline'}`}>
                          {admin.status}
                        </span>
                      </td>
                      <td>{admin.lastLoginTime}</td>
                      <td>
                        <div className="action-buttons">
                          {(currentAdmin?.isSuperAdmin || admin.email === getCurrentAdminEmail()) ? (
                            <>
                              <button
                                className="update-name-btn admin-action-btn"
                                onClick={() => handleUpdateName(admin.email, admin.name)}
                                title="修改姓名"
                              >
                                修改姓名
                              </button>
                              {currentAdmin?.isSuperAdmin && (
                                <>
                                  <button
                                    className="reset-password-btn admin-action-btn"
                                    onClick={() => handleResetPassword(admin.email)}
                                    title="重設密碼"
                                  >
                                    重設密碼
                                  </button>
                                  {admin.email !== getCurrentAdminEmail() && (
                                    <button
                                      className="delete-btn admin-action-btn"
                                      onClick={() => handleDeleteAdmin(admin.email)}
                                      title="刪除管理員帳號"
                                    >
                                      刪除
                                    </button>
                                  )}
                                </>
                              )}
                            </>
                          ) : (
                            <span className="no-permission">僅可查看</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {currentAdmin?.isSuperAdmin && (
              <div className="admin-actions">
                <button className="add-admin-btn" onClick={handleAddAdmin}>
                  新增管理員
                </button>
                <button className="export-logs-btn" onClick={handleExportLogs}>
                  匯出操作記錄
                </button>
                <button className="sync-data-btn" onClick={reloadAdminList} disabled={loading}>
                  🔄 {loading ? '同步中...' : '同步資料'}
                </button>
              </div>
            )}

            {/* 修改姓名模態框 */}
            <InputModal
              isOpen={showNameModal}
              onClose={() => setShowNameModal(false)}
              title="修改管理員姓名"
              label="請輸入新的姓名："
              placeholder="請輸入姓名"
              defaultValue={editingAdmin?.currentName || ''}
              onConfirm={confirmUpdateName}
              confirmText="更新"
              cancelText="取消"
              maxLength={50}
              validation={(value) => {
                if (value.length < 1) return '姓名不能為空';
                if (value.length > 50) return '姓名不能超過 50 字元';
                if (!/^[\u4e00-\u9fa5a-zA-Z\s]+$/.test(value)) return '姓名只能包含中文、英文和空格';
                return true;
              }}
            />

            {/* 新增管理員模態框 */}
            <AdminFormModal
              isOpen={showAddAdminModal}
              onClose={() => setShowAddAdminModal(false)}
              onConfirm={confirmAddAdmin}
              loading={addingAdmin}
              title="新增管理員"
            />

            {/* 通知模態框 */}
            <NotificationModal
              isOpen={showNotification}
              onClose={() => setShowNotification(false)}
              title={notification.title}
              message={notification.message}
              type={notification.type}
            />
          </div>
        )}
      </div>
    </div>
  );
}