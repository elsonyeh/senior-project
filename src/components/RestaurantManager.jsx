import React, { useState, useEffect } from 'react';
import { restaurantService, restaurantImageService } from '../services/restaurantService';
import RestaurantImageUpload from './RestaurantImageUpload';
import QuickAddRestaurant from './QuickAddRestaurant';
import Toast from './Toast';
import ConfirmDialog from './ConfirmDialog';
import './RestaurantManager.css';

const RestaurantManager = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagStats, setTagStats] = useState([]);
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [editData, setEditData] = useState({});
  const [newRestaurant, setNewRestaurant] = useState({
    name: '',
    address: '',
    phone: '',
    category: '',
    price_range: 1,
    rating: 0,
    website_url: '',
    tags: [],
    suggested_people: '1~4',
    is_spicy: false,
    images: []
  });
  
  // Toast和確認對話框狀態
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [confirmDialog, setConfirmDialog] = useState({ 
    show: false, 
    title: '', 
    message: '', 
    onConfirm: null 
  });
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [editingImageUpload, setEditingImageUpload] = useState(null);
  const [matchMode, setMatchMode] = useState('any'); // 'any' 或 'all'

  // Toast顯示函數
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  const hideToast = () => {
    setToast({ show: false, message: '', type: 'success' });
  };

  // 載入餐廳列表
  useEffect(() => {
    loadRestaurants();
  }, []);

  const loadRestaurants = async () => {
    try {
      setLoading(true);
      const data = await restaurantService.getRestaurants();
      setRestaurants(data);
      setFilteredRestaurants(data);
      
      // 計算標籤統計
      const tagMap = {};
      data.forEach(restaurant => {
        if (restaurant.tags && Array.isArray(restaurant.tags)) {
          restaurant.tags.forEach(tag => {
            const cleanTag = tag.trim();
            if (cleanTag) {
              tagMap[cleanTag] = (tagMap[cleanTag] || 0) + 1;
            }
          });
        }
      });
      
      // 轉換為陣列並排序
      const sortedTags = Object.entries(tagMap)
        .sort(([,a], [,b]) => b - a)
        .map(([tag, count]) => ({ tag, count }));
      
      setTagStats(sortedTags);
    } catch (error) {
      console.error('載入餐廳失敗:', error);
      setError('載入餐廳失敗');
    } finally {
      setLoading(false);
    }
  };

  // 標籤篩選功能
  const toggleTag = (tag) => {
    // 如果新增表單已打開，將標籤添加到表單中
    if (showAddForm) {
      let newTags;
      if (newRestaurant.tags.includes(tag)) {
        // 如果已選中，則移除
        newTags = newRestaurant.tags.filter(t => t !== tag);
      } else {
        // 如果未選中，則添加
        newTags = [...newRestaurant.tags, tag];
      }
      setNewRestaurant({...newRestaurant, tags: newTags});
    } else {
      // 否則執行原本的篩選功能
      const newSelected = selectedTags.includes(tag)
        ? selectedTags.filter(t => t !== tag)
        : [...selectedTags, tag];
      
      setSelectedTags(newSelected);
      
      if (newSelected.length === 0) {
        setFilteredRestaurants(restaurants);
      } else {
        const filtered = restaurants.filter(restaurant => {
          if (!restaurant.tags) return false;
          
          if (matchMode === 'all') {
            // 全部符合：所有選中的標籤都必須存在
            return newSelected.every(tag => restaurant.tags.includes(tag));
          } else {
            // 任一符合：至少一個選中的標籤存在
            return newSelected.some(tag => restaurant.tags.includes(tag));
          }
        });
        setFilteredRestaurants(filtered);
      }
    }
  };

  // 清除篩選
  const clearFilters = () => {
    setSelectedTags([]);
    setFilteredRestaurants(restaurants);
    
    // 如果新增表單已打開，也清除表單中的標籤
    if (showAddForm) {
      setNewRestaurant({...newRestaurant, tags: []});
    }
  };

  // 開始編輯餐廳
  const startEditing = (restaurant) => {
    setEditingRestaurant(restaurant.id);
    setEditData({
      name: restaurant.name,
      category: restaurant.category || '',
      address: restaurant.address || '',
      tags: restaurant.tags ? restaurant.tags.join(', ') : '',
      price_range: restaurant.price_range || 1,
      rating: restaurant.rating || 0,
      suggested_people: restaurant.suggested_people || '1~4',
      is_spicy: restaurant.is_spicy || false
    });
  };

  // 取消編輯
  const cancelEditing = () => {
    setEditingRestaurant(null);
    setEditData({});
  };

  // 保存編輯
  const saveEditing = async () => {
    try {
      const updatedData = {
        ...editData,
        tags: editData.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '')
      };
      
      await handleUpdateRestaurant(editingRestaurant, updatedData);
      setEditingRestaurant(null);
      setEditData({});
      loadRestaurants(); // 重新載入以更新統計
    } catch (error) {
      console.error('保存失敗:', error);
      alert('保存失敗');
    }
  };

  // 新增餐廳
  const handleAddRestaurant = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const added = await restaurantService.createRestaurant({
        ...newRestaurant,
        tags: newRestaurant.tags.filter(tag => tag.trim() !== '')
      });
      
      // 如果有選擇照片，則上傳照片
      if (newRestaurant.images && newRestaurant.images.length > 0) {
        try {
          const uploadPromises = newRestaurant.images.map((file, index) =>
            restaurantImageService.uploadRestaurantImage(file, added.id, {
              altText: `${added.name} 照片 ${index + 1}`,
              imageType: "general",
              isPrimary: index === 0, // 第一張設為主要照片
              displayOrder: index,
            })
          );
          await Promise.all(uploadPromises);
          showToast(`餐廳新增成功！已上傳 ${newRestaurant.images.length} 張照片`, 'success');
        } catch (imageError) {
          console.error('照片上傳失敗:', imageError);
          showToast(`餐廳新增成功！但照片上傳失敗: ${imageError.message}`, 'error');
        }
      } else {
        showToast('餐廳新增成功！', 'success');
      }
      
      setRestaurants([added, ...restaurants]);
      setNewRestaurant({
        name: '',
        address: '',
        phone: '',
        category: '',
        price_range: 1,
        rating: 0,
        website_url: '',
        tags: [],
        suggested_people: '1~4',
        is_spicy: false,
        images: []
      });
      setShowAddForm(false);
    } catch (error) {
      console.error('新增餐廳失敗:', error);
      showToast('新增餐廳失敗: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 更新餐廳
  const handleUpdateRestaurant = async (restaurantId, updateData) => {
    try {
      const updated = await restaurantService.updateRestaurant(restaurantId, updateData);
      setRestaurants(restaurants.map(r => r.id === restaurantId ? updated : r));
      showToast('餐廳資訊更新成功！', 'success');
    } catch (error) {
      console.error('更新餐廳失敗:', error);
      showToast('更新餐廳失敗: ' + error.message, 'error');
    }
  };

  // 刪除餐廳
  const handleDeleteRestaurant = (restaurantId) => {
    const restaurant = restaurants.find(r => r.id === restaurantId);
    setConfirmDialog({
      show: true,
      title: '確認刪除',
      message: `確定要刪除「${restaurant?.name}」這家餐廳嗎？此操作無法復原。`,
      onConfirm: () => confirmDeleteRestaurant(restaurantId),
    });
  };

  const confirmDeleteRestaurant = async (restaurantId) => {
    try {
      await restaurantService.deleteRestaurant(restaurantId);
      setRestaurants(restaurants.filter(r => r.id !== restaurantId));
      showToast('餐廳已刪除', 'success');
    } catch (error) {
      console.error('刪除餐廳失敗:', error);
      showToast('刪除餐廳失敗: ' + error.message, 'error');
    } finally {
      setConfirmDialog({ show: false, title: '', message: '', onConfirm: null });
    }
  };

  // 上傳照片成功回調
  const handleUploadSuccess = (uploadedImages) => {
    showToast(`成功上傳 ${uploadedImages.length} 張照片！`, 'success');
    setShowImageUpload(false);
    loadRestaurants(); // 重新載入餐廳列表以更新圖片
  };

  // 上傳照片錯誤回調
  const handleUploadError = (error) => {
    showToast(`上傳失敗: ${error.message}`, 'error');
  };

  // 處理標籤輸入
  const handleTagsChange = (value) => {
    const tags = value.split(',').map(tag => tag.trim());
    setNewRestaurant({ ...newRestaurant, tags });
  };

  // 獲取所有可用的標籤（從現有餐廳中提取 + 預設標籤）
  const getAvailableTags = () => {
    // 預設常用標籤
    const defaultTags = [
      '中式', '西式', '日式', '韓式', '泰式', '義式', '美式',
      '火鍋', '燒烤', '小吃', '夜市', '早餐', '下午茶', '甜點',
      '咖啡', '飲料', '素食', '健康', '有機', '輕食',
      '家庭聚餐', '約會', '商務用餐', '慶生', '聚會',
      '外帶', '內用', '停車方便', 'WIFI', '親子友善',
      '寵物友善', '無障礙', '24小時', '深夜食堂'
    ];
    
    const allTags = new Set(defaultTags);
    
    // 從現有餐廳中提取標籤
    restaurants.forEach(restaurant => {
      if (restaurant.tags && Array.isArray(restaurant.tags)) {
        restaurant.tags.forEach(tag => {
          if (tag && tag.trim()) {
            allTags.add(tag.trim());
          }
        });
      }
    });
    
    return Array.from(allTags).sort();
  };

  // 匯出餐廳資料
  const handleExportRestaurants = () => {
    try {
      const exportData = filteredRestaurants.map(restaurant => ({
        name: restaurant.name,
        category: restaurant.category,
        address: restaurant.address,
        phone: restaurant.phone,
        price_range: restaurant.price_range,
        rating: restaurant.rating,
        suggested_people: restaurant.suggested_people,
        is_spicy: restaurant.is_spicy,
        tags: Array.isArray(restaurant.tags) ? restaurant.tags.join(', ') : restaurant.tags,
        website_url: restaurant.website_url,
        latitude: restaurant.latitude,
        longitude: restaurant.longitude,
        created_at: restaurant.created_at,
        updated_at: restaurant.updated_at
      }));

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `restaurants_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`成功匯出 ${exportData.length} 家餐廳資料`, 'success');
    } catch (error) {
      console.error('匯出失敗:', error);
      showToast('匯出失敗: ' + error.message, 'error');
    }
  };

  // 匯出CSV格式
  const handleExportRestaurantsCSV = () => {
    try {
      const csvHeaders = [
        '名稱', '類型', '地址', '電話', '價格範圍', '評分', '建議人數', '辣味', '標籤', '網址', '經度', '緯度', '建立時間', '更新時間'
      ];
      
      const csvData = filteredRestaurants.map(restaurant => [
        restaurant.name,
        restaurant.category,
        restaurant.address,
        restaurant.phone || '',
        restaurant.price_range,
        restaurant.rating,
        restaurant.suggested_people,
        restaurant.is_spicy ? '是' : '否',
        Array.isArray(restaurant.tags) ? restaurant.tags.join('; ') : restaurant.tags || '',
        restaurant.website_url || '',
        restaurant.longitude || '',
        restaurant.latitude || '',
        restaurant.created_at,
        restaurant.updated_at
      ]);

      const csvContent = [csvHeaders, ...csvData]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');
      
      // 添加BOM以支持中文
      const csvBlob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(csvBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `restaurants_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`成功匯出 ${csvData.length} 家餐廳資料 (CSV格式)`, 'success');
    } catch (error) {
      console.error('匯出CSV失敗:', error);
      showToast('匯出CSV失敗: ' + error.message, 'error');
    }
  };

  if (loading && restaurants.length === 0) {
    return <div className="loading">載入中...</div>;
  }

  if (error) {
    return <div className="error">錯誤: {error}</div>;
  }

  return (
    <div className="restaurant-manager">
      {/* 功能按鈕區 */}
      <div className="manager-actions">
        <div className="primary-actions">
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className={`btn btn-primary btn-add-restaurant ${showAddForm ? 'btn-cancel' : ''}`}
          >
            <span className="btn-icon">{showAddForm ? '✕' : '➕'}</span>
            {showAddForm ? '取消新增' : '新增餐廳'}
          </button>
        </div>
        <div className="export-buttons">
          <button onClick={handleExportRestaurants} className="btn btn-info btn-export">
            <span className="btn-icon">📄</span>
            匯出 JSON
          </button>
          <button onClick={handleExportRestaurantsCSV} className="btn btn-success btn-export">
            <span className="btn-icon">📊</span>
            匯出 CSV
          </button>
        </div>
      </div>

      {/* 快速新增餐廳表單 */}
      {showAddForm && (
        <QuickAddRestaurant 
          newRestaurant={newRestaurant}
          setNewRestaurant={setNewRestaurant}
          handleAddRestaurant={handleAddRestaurant}
          handleTagsChange={handleTagsChange}
          loading={loading}
        />
      )}

      {/* 原始新增餐廳表單 (備用，已隱藏) */}
      {false && (
        <div className="add-restaurant-section">
          <div className="section-header">
            <span className="section-icon">🍴</span>
            <h2>新增餐廳</h2>
          </div>
          
          <form onSubmit={handleAddRestaurant} className="restaurant-form">
            <div className="form-row">
              <div className="form-group">
                <label>名稱</label>
                <input
                  type="text"
                  value={newRestaurant.name}
                  onChange={(e) => setNewRestaurant({...newRestaurant, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>類型</label>
                <input
                  type="text"
                  value={newRestaurant.category}
                  onChange={(e) => setNewRestaurant({...newRestaurant, category: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>地址</label>
                <input
                  type="text"
                  value={newRestaurant.address}
                  onChange={(e) => setNewRestaurant({...newRestaurant, address: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>標籤 (逗號分隔)</label>
                <input
                  type="text"
                  value={newRestaurant.tags.join(', ')}
                  onChange={(e) => handleTagsChange(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>價格</label>
                <select
                  value={newRestaurant.price_range}
                  onChange={(e) => setNewRestaurant({...newRestaurant, price_range: parseInt(e.target.value)})}
                >
                  <option value={1}>$</option>
                  <option value={2}>$$</option>
                  <option value={3}>$$$</option>
                </select>
              </div>
              <div className="form-group">
                <label>人數</label>
                <select
                  value={newRestaurant.suggested_people}
                  onChange={(e) => setNewRestaurant({...newRestaurant, suggested_people: e.target.value})}
                >
                  <option value="1~4">1~4 人</option>
                  <option value="4~8">4~8 人</option>
                  <option value="1~8">1~8 人</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>辣味</label>
                <select
                  value={newRestaurant.is_spicy}
                  onChange={(e) => setNewRestaurant({...newRestaurant, is_spicy: e.target.value === 'true'})}
                >
                  <option value={false}>不辣</option>
                  <option value={true}>辣</option>
                </select>
              </div>
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? '新增中...' : '新增餐廳'}
            </button>
          </form>
        </div>
      )}

      {/* 標籤篩選區 */}
      <div className="category-filters">
        <div className="section-header">
          <h2>
            <span className="section-icon">🍴</span>
            餐廳管理
          </h2>
        </div>
        
        <div className="filter-info">
          <span>點入標籤查看對應餐廳</span>
          <button onClick={clearFilters} className="btn btn-outline btn-sm clear-filters">
            <span className="btn-icon">🗑️</span>
            清除選擇
          </button>
        </div>
        
        <div className="tag-search-card">
          <div className="search-header">
            <h3>
              <span className="search-icon">🔍</span>
              標籤搜尋與篩選
            </h3>
            {selectedTags.length > 0 && !showAddForm && (
              <span className="selected-count">已選擇 {selectedTags.length} 個標籤</span>
            )}
          </div>
          <div className="search-controls">
            <div className="search-input-wrapper">
              <input
                type="text"
                placeholder="搜尋標籤..."
                value={tagSearchQuery}
                onChange={(e) => setTagSearchQuery(e.target.value)}
                className="tag-search-input"
              />
              {tagSearchQuery && (
                <button
                  onClick={() => setTagSearchQuery('')}
                  className="clear-search-btn"
                  title="清除搜尋"
                >
                  ✕
                </button>
              )}
            </div>
            
            <div className="filter-controls">
              <div className="match-mode-toggle">
                <button
                  onClick={() => setMatchMode('any')}
                  className={`mode-btn ${matchMode === 'any' ? 'active' : ''}`}
                >
                  任一符合
                </button>
                <button
                  onClick={() => setMatchMode('all')}
                  className={`mode-btn ${matchMode === 'all' ? 'active' : ''}`}
                >
                  全部符合
                </button>
              </div>
              
              {(selectedTags.length > 0 || (showAddForm && newRestaurant.tags.length > 0)) && (
                <button onClick={clearFilters} className="btn btn-outline btn-sm clear-all-tags">
                  <span className="btn-icon">🗑️</span>
                  清除全部
                </button>
              )}
            </div>
          </div>
          
          <div className="tags-section">
            <div className="tags-header">
              <span className="tags-title">
                {showAddForm ? '點擊標籤加入餐廳' : '點擊標籤進行篩選'}
              </span>
              <span className="tags-count">
                {tagStats.filter(({ tag }) => 
                  tagSearchQuery === '' || 
                  tag.toLowerCase().includes(tagSearchQuery.toLowerCase())
                ).length} 個標籤
              </span>
            </div>
            
            <div className="category-grid">
              {tagStats
                .filter(({ tag }) => 
                  tagSearchQuery === '' || 
                  tag.toLowerCase().includes(tagSearchQuery.toLowerCase())
                )
                .map(({ tag, count }) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`category-tag ${
                      showAddForm 
                        ? (newRestaurant.tags.includes(tag) ? 'selected' : '')
                        : (selectedTags.includes(tag) ? 'selected' : '')
                    }`}
                    title={showAddForm ? '點擊添加/移除此標籤到新增表單' : '點擊篩選餐廳'}
                  >
                    <span className="tag-name">{tag}</span>
                    <span className="tag-count">({count})</span>
                    {showAddForm && newRestaurant.tags.includes(tag) && <span className="tag-added-icon">✓</span>}
                  </button>
                ))}
              {tagStats.filter(({ tag }) => 
                tagSearchQuery === '' || 
                tag.toLowerCase().includes(tagSearchQuery.toLowerCase())
              ).length === 0 && tagSearchQuery && (
                <div className="no-tags-found">
                  <span className="no-tags-icon">🔍</span>
                  找不到符合「{tagSearchQuery}」的標籤
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 餐廳列表 */}
      <div className="restaurant-list-section">
        <div className="section-header">
          <h2>
            <span className="section-icon">📁</span>
            {selectedTags.length > 0 
              ? `符合標籤「${selectedTags.join('、')}」的餐廳 (${filteredRestaurants.length})`
              : `所有餐廳 (${restaurants.length})`
            }
          </h2>
        </div>
        
        <div className="restaurant-table">
          {filteredRestaurants.length === 0 ? (
            <div className="no-restaurants-message">
              <div className="no-restaurants-icon">🔍</div>
              <h3>沒有符合條件的餐廳</h3>
              <p>
                {selectedTags.length > 0 
                  ? `沒有餐廳符合標籤「${selectedTags.join('、')}」的${matchMode === 'all' ? '全部' : '任一'}條件`
                  : '目前沒有餐廳資料'
                }
              </p>
              {selectedTags.length > 0 && (
                <button onClick={clearFilters} className="btn btn-outline btn-sm clear-filters-suggestion">
                  <span className="btn-icon">🗑️</span>
                  清除篩選條件
                </button>
              )}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>圖片</th>
                  <th>名稱</th>
                  <th>類型</th>
                  <th>地址</th>
                  <th>標籤</th>
                  <th>價格</th>
                  <th>星等</th>
                  <th>人數</th>
                  <th>辣味</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRestaurants.map((restaurant) => (
                  <tr key={restaurant.id}>
                    <td>
                      <div className="image-cell">
                        {restaurant.primaryImage ? (
                          <img 
                            src={restaurant.primaryImage.image_url} 
                            alt={restaurant.name}
                            className="table-image"
                          />
                        ) : (
                          <div className="no-image-table">
                            <span>無圖</span>
                          </div>
                        )}
                        {editingRestaurant === restaurant.id && (
                          <button 
                            onClick={() => setEditingImageUpload(restaurant)}
                            className="btn-photo-small"
                          >
                            📷 修改照片
                          </button>
                        )}
                      </div>
                    </td>
                  <td>
                    {editingRestaurant === restaurant.id ? (
                      <input
                        type="text"
                        value={editData.name}
                        onChange={(e) => setEditData({...editData, name: e.target.value})}
                        className="edit-input"
                      />
                    ) : (
                      restaurant.name
                    )}
                  </td>
                  <td>
                    {editingRestaurant === restaurant.id ? (
                      <input
                        type="text"
                        value={editData.category}
                        onChange={(e) => setEditData({...editData, category: e.target.value})}
                        className="edit-input"
                      />
                    ) : (
                      restaurant.category
                    )}
                  </td>
                  <td>
                    {editingRestaurant === restaurant.id ? (
                      <input
                        type="text"
                        value={editData.address}
                        onChange={(e) => setEditData({...editData, address: e.target.value})}
                        className="edit-input"
                      />
                    ) : (
                      restaurant.address
                    )}
                  </td>
                  <td>
                    {editingRestaurant === restaurant.id ? (
                      <input
                        type="text"
                        value={editData.tags}
                        onChange={(e) => setEditData({...editData, tags: e.target.value})}
                        className="edit-input"
                        placeholder="標籤1, 標籤2, ..."
                      />
                    ) : (
                      restaurant.tags && restaurant.tags.length > 0 
                        ? restaurant.tags.join('、')
                        : '-'
                    )}
                  </td>
                  <td>
                    {editingRestaurant === restaurant.id ? (
                      <select
                        value={editData.price_range}
                        onChange={(e) => setEditData({...editData, price_range: parseInt(e.target.value)})}
                        className="edit-select"
                      >
                        <option value={1}>$</option>
                        <option value={2}>$$</option>
                        <option value={3}>$$$</option>
                      </select>
                    ) : (
                      '$'.repeat(restaurant.price_range || 1)
                    )}
                  </td>
                  <td>
                    {editingRestaurant === restaurant.id ? (
                      <input
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        value={editData.rating}
                        onChange={(e) => setEditData({...editData, rating: parseFloat(e.target.value)})}
                        className="edit-input"
                      />
                    ) : (
                      restaurant.rating || '-'
                    )}
                  </td>
                  <td>
                    {editingRestaurant === restaurant.id ? (
                      <select
                        value={editData.suggested_people}
                        onChange={(e) => setEditData({...editData, suggested_people: e.target.value})}
                        className="edit-select"
                      >
                        <option value="1~4">1~4 人</option>
                        <option value="4~8">4~8 人</option>
                        <option value="1~8">1~8 人</option>
                      </select>
                    ) : (
                      restaurant.suggested_people || '1~4 人'
                    )}
                  </td>
                  <td>
                    {editingRestaurant === restaurant.id ? (
                      <select
                        value={editData.is_spicy}
                        onChange={(e) => setEditData({...editData, is_spicy: e.target.value === 'true'})}
                        className="edit-select"
                      >
                        <option value={false}>不辣</option>
                        <option value={true}>辣</option>
                      </select>
                    ) : (
                      restaurant.is_spicy ? '辣' : '不辣'
                    )}
                  </td>
                  <td>
                    {editingRestaurant === restaurant.id ? (
                      <div className="edit-actions">
                        <button onClick={saveEditing} className="btn btn-sm btn-success table-action-btn">
                          <span className="btn-icon">💾</span>
                          保存
                        </button>
                        <button onClick={cancelEditing} className="btn btn-sm btn-secondary table-action-btn">
                          <span className="btn-icon">✕</span>
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="normal-actions">
                        <button 
                          onClick={() => startEditing(restaurant)}
                          className="btn btn-sm btn-info table-action-btn"
                        >
                          <span className="btn-icon">✏️</span>
                          編輯
                        </button>
                        <button 
                          onClick={() => handleDeleteRestaurant(restaurant.id)}
                          className="btn btn-sm btn-danger table-action-btn"
                        >
                          <span className="btn-icon">🗑️</span>
                          刪除
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>

      {/* 照片上傳彈出視窗 */}
      {editingImageUpload && (
        <div className="modal-overlay" onClick={() => setEditingImageUpload(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>管理照片 - {editingImageUpload.name}</h3>
              <button
                onClick={() => setEditingImageUpload(null)}
                className="modal-close-btn"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <RestaurantImageUpload
                restaurantId={editingImageUpload.id}
                onUploadSuccess={(uploadedImages) => {
                  showToast(`成功上傳 ${uploadedImages.length} 張照片！`, 'success');
                  setEditingImageUpload(null);
                  loadRestaurants(); // 重新載入餐廳列表以更新圖片
                }}
                onUploadError={(error) => {
                  showToast(`上傳失敗: ${error.message}`, 'error');
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Toast 通知 */}
      {toast.show && (
        <Toast 
          message={toast.message} 
          type={toast.type}
          onClose={hideToast}
        />
      )}

      {/* 確認對話框 */}
      <ConfirmDialog
        isOpen={confirmDialog.show}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type="error"
        confirmText="刪除"
        cancelText="取消"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ show: false, title: '', message: '', onConfirm: null })}
      />
    </div>
  );
};

export default RestaurantManager;