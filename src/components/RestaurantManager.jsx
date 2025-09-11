import React, { useState, useEffect } from 'react';
import { restaurantService, restaurantImageService } from '../services/restaurantService';
import RestaurantImageUpload from './RestaurantImageUpload';
import './RestaurantManager.css';

const RestaurantManager = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [newRestaurant, setNewRestaurant] = useState({
    name: '',
    description: '',
    address: '',
    phone: '',
    category: '',
    price_range: 1,
    rating: 0,
    website_url: '',
    tags: []
  });

  // 載入餐廳列表
  useEffect(() => {
    loadRestaurants();
  }, []);

  const loadRestaurants = async () => {
    try {
      setLoading(true);
      const data = await restaurantService.getRestaurants();
      setRestaurants(data);
    } catch (error) {
      console.error('載入餐廳失敗:', error);
      setError('載入餐廳失敗');
    } finally {
      setLoading(false);
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
      
      setRestaurants([added, ...restaurants]);
      setNewRestaurant({
        name: '',
        description: '',
        address: '',
        phone: '',
        category: '',
        price_range: 1,
        rating: 0,
        website_url: '',
        tags: []
      });
      setShowAddForm(false);
      alert('餐廳新增成功！');
    } catch (error) {
      console.error('新增餐廳失敗:', error);
      alert('新增餐廳失敗');
    } finally {
      setLoading(false);
    }
  };

  // 更新餐廳
  const handleUpdateRestaurant = async (restaurantId, updateData) => {
    try {
      const updated = await restaurantService.updateRestaurant(restaurantId, updateData);
      setRestaurants(restaurants.map(r => r.id === restaurantId ? updated : r));
      alert('餐廳資訊更新成功！');
    } catch (error) {
      console.error('更新餐廳失敗:', error);
      alert('更新餐廳失敗');
    }
  };

  // 刪除餐廳
  const handleDeleteRestaurant = async (restaurantId) => {
    if (!confirm('確定要刪除這家餐廳嗎？')) return;
    
    try {
      await restaurantService.deleteRestaurant(restaurantId);
      setRestaurants(restaurants.filter(r => r.id !== restaurantId));
      alert('餐廳已刪除');
    } catch (error) {
      console.error('刪除餐廳失敗:', error);
      alert('刪除餐廳失敗');
    }
  };

  // 上傳照片成功回調
  const handleUploadSuccess = (uploadedImages) => {
    alert(`成功上傳 ${uploadedImages.length} 張照片！`);
    setShowImageUpload(false);
    loadRestaurants(); // 重新載入餐廳列表以更新圖片
  };

  // 上傳照片錯誤回調
  const handleUploadError = (error) => {
    alert(`上傳失敗: ${error.message}`);
  };

  // 處理標籤輸入
  const handleTagsChange = (value) => {
    const tags = value.split(',').map(tag => tag.trim());
    setNewRestaurant({ ...newRestaurant, tags });
  };

  if (loading && restaurants.length === 0) {
    return <div className="loading">載入中...</div>;
  }

  if (error) {
    return <div className="error">錯誤: {error}</div>;
  }

  return (
    <div className="restaurant-manager">
      <div className="manager-header">
        <h1>餐廳管理</h1>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn btn-primary"
        >
          {showAddForm ? '取消新增' : '新增餐廳'}
        </button>
      </div>

      {/* 新增餐廳表單 */}
      {showAddForm && (
        <div className="add-restaurant-form">
          <h2>新增餐廳</h2>
          <form onSubmit={handleAddRestaurant}>
            <div className="form-row">
              <div className="form-group">
                <label>餐廳名稱 *</label>
                <input
                  type="text"
                  value={newRestaurant.name}
                  onChange={(e) => setNewRestaurant({...newRestaurant, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>類別</label>
                <select
                  value={newRestaurant.category}
                  onChange={(e) => setNewRestaurant({...newRestaurant, category: e.target.value})}
                >
                  <option value="">選擇類別</option>
                  <option value="中式">中式</option>
                  <option value="西式">西式</option>
                  <option value="日式">日式</option>
                  <option value="韓式">韓式</option>
                  <option value="泰式">泰式</option>
                  <option value="義式">義式</option>
                  <option value="美式">美式</option>
                  <option value="其他">其他</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>描述</label>
              <textarea
                value={newRestaurant.description}
                onChange={(e) => setNewRestaurant({...newRestaurant, description: e.target.value})}
                rows={3}
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

            <div className="form-row">
              <div className="form-group">
                <label>電話</label>
                <input
                  type="text"
                  value={newRestaurant.phone}
                  onChange={(e) => setNewRestaurant({...newRestaurant, phone: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>價格等級</label>
                <select
                  value={newRestaurant.price_range}
                  onChange={(e) => setNewRestaurant({...newRestaurant, price_range: parseInt(e.target.value)})}
                >
                  <option value={1}>$ (經濟)</option>
                  <option value={2}>$$ (中等)</option>
                  <option value={3}>$$$ (高價)</option>
                  <option value={4}>$$$$ (奢華)</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>評分 (0-5)</label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={newRestaurant.rating}
                  onChange={(e) => setNewRestaurant({...newRestaurant, rating: parseFloat(e.target.value)})}
                />
              </div>
              <div className="form-group">
                <label>網站</label>
                <input
                  type="url"
                  value={newRestaurant.website_url}
                  onChange={(e) => setNewRestaurant({...newRestaurant, website_url: e.target.value})}
                />
              </div>
            </div>

            <div className="form-group">
              <label>標籤 (用逗號分隔)</label>
              <input
                type="text"
                value={newRestaurant.tags.join(', ')}
                onChange={(e) => handleTagsChange(e.target.value)}
                placeholder="例: 素食, 外送, 停車場"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-success" disabled={loading}>
                {loading ? '新增中...' : '新增餐廳'}
              </button>
              <button 
                type="button" 
                onClick={() => setShowAddForm(false)}
                className="btn btn-secondary"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 照片上傳區域 */}
      {showImageUpload && selectedRestaurant && (
        <div className="image-upload-section">
          <div className="upload-header">
            <h2>上傳照片 - {selectedRestaurant.name}</h2>
            <button 
              onClick={() => setShowImageUpload(false)}
              className="btn btn-secondary"
            >
              關閉
            </button>
          </div>
          <RestaurantImageUpload
            restaurantId={selectedRestaurant.id}
            onUploadSuccess={handleUploadSuccess}
            onUploadError={handleUploadError}
          />
        </div>
      )}

      {/* 餐廳列表 */}
      <div className="restaurant-list">
        <h2>餐廳列表 ({restaurants.length})</h2>
        {restaurants.length === 0 ? (
          <div className="empty-state">
            <p>尚無餐廳資料</p>
          </div>
        ) : (
          <div className="restaurant-grid">
            {restaurants.map((restaurant) => (
              <div key={restaurant.id} className="restaurant-card">
                <div className="restaurant-image">
                  {restaurant.primaryImage ? (
                    <div className="image-container">
                      <img 
                        src={restaurant.primaryImage.image_url} 
                        alt={restaurant.primaryImage.alt_text || restaurant.name}
                      />
                      <div className="image-source-badge">
                        {restaurant.primaryImage.source_type === 'external' 
                          ? '🔗 外部' 
                          : '📁 上傳'
                        }
                      </div>
                    </div>
                  ) : (
                    <div className="no-image">無照片</div>
                  )}
                </div>
                
                <div className="restaurant-info">
                  <h3>{restaurant.name}</h3>
                  {restaurant.category && <span className="category">{restaurant.category}</span>}
                  {restaurant.rating > 0 && (
                    <div className="rating">
                      {'★'.repeat(Math.floor(restaurant.rating))} {restaurant.rating.toFixed(1)}
                    </div>
                  )}
                  {restaurant.address && <p className="address">{restaurant.address}</p>}
                  {restaurant.description && <p className="description">{restaurant.description}</p>}
                  
                  {restaurant.tags && restaurant.tags.length > 0 && (
                    <div className="tags">
                      {restaurant.tags.map((tag, index) => (
                        <span key={index} className="tag">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="restaurant-actions">
                  <button 
                    onClick={() => {
                      setSelectedRestaurant(restaurant);
                      setShowImageUpload(true);
                    }}
                    className="btn btn-info"
                  >
                    上傳照片
                  </button>
                  <button 
                    onClick={() => handleUpdateRestaurant(restaurant.id, { featured: !restaurant.featured })}
                    className={`btn ${restaurant.featured ? 'btn-warning' : 'btn-outline'}`}
                  >
                    {restaurant.featured ? '取消推薦' : '設為推薦'}
                  </button>
                  <button 
                    onClick={() => handleDeleteRestaurant(restaurant.id)}
                    className="btn btn-danger"
                  >
                    刪除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RestaurantManager;