import React, { useState, useRef } from 'react';
import './QuickAddRestaurant.css';

const QuickAddRestaurant = ({ 
  newRestaurant, 
  setNewRestaurant, 
  handleAddRestaurant, 
  handleTagsChange, 
  loading
}) => {
  const [selectedImages, setSelectedImages] = useState([]);
  const fileInputRef = useRef(null);

  const handleImageSelect = (event) => {
    const files = Array.from(event.target.files);
    const maxFiles = 3; // 限制最多3張照片

    if (files.length > maxFiles) {
      alert(`最多只能選擇 ${maxFiles} 張照片`);
      return;
    }

    // 建立預覽
    const previews = [];
    files.forEach((file, index) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          previews.push({
            id: index,
            file,
            preview: e.target.result,
            name: file.name,
            size: file.size
          });

          if (previews.length === files.length) {
            setSelectedImages(previews);
            // 將檔案資訊傳遞給父組件
            setNewRestaurant({...newRestaurant, images: files});
          }
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeImage = (imageId) => {
    const updatedImages = selectedImages.filter(img => img.id !== imageId);
    setSelectedImages(updatedImages);
    const updatedFiles = updatedImages.map(img => img.file);
    setNewRestaurant({...newRestaurant, images: updatedFiles});
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  return (
    <div className="quick-add-restaurant">
      <form onSubmit={handleAddRestaurant} className="quick-add-form">
        <input
          type="text"
          placeholder="名稱"
          value={newRestaurant.name}
          onChange={(e) => setNewRestaurant({...newRestaurant, name: e.target.value})}
          required
          className="quick-input"
        />
        <input
          type="text"
          placeholder="類型"
          value={newRestaurant.category}
          onChange={(e) => setNewRestaurant({...newRestaurant, category: e.target.value})}
          className="quick-input"
        />
        <input
          type="text"
          placeholder="地址"
          value={newRestaurant.address}
          onChange={(e) => setNewRestaurant({...newRestaurant, address: e.target.value})}
          className="quick-input quick-input-wide"
        />
        <select
          value={newRestaurant.price_range}
          onChange={(e) => setNewRestaurant({...newRestaurant, price_range: parseInt(e.target.value)})}
          className="quick-select"
        >
          <option value={1}>$</option>
          <option value={2}>$$</option>
          <option value={3}>$$$</option>
        </select>
        <select
          value={newRestaurant.suggested_people}
          onChange={(e) => setNewRestaurant({...newRestaurant, suggested_people: e.target.value})}
          className="quick-select"
        >
          <option value="1~4">1~4 人</option>
          <option value="4~8">4~8 人</option>
          <option value="1~8">1~8 人</option>
        </select>

        {/* 辣度選擇 */}
        <select
          value={newRestaurant.is_spicy}
          onChange={(e) => setNewRestaurant({...newRestaurant, is_spicy: e.target.value})}
          className="quick-select"
          disabled={loading}
        >
          <option value="false">不辣</option>
          <option value="true">辣</option>
          <option value="both">兩種都有</option>
        </select>

        {/* 照片選擇按鈕 */}
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept="image/*"
          onChange={handleImageSelect}
          disabled={loading}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="quick-image-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
        >
          📷 照片
        </button>
        
        <input
          type="text"
          placeholder="標籤 (以逗號分隔)"
          value={newRestaurant.tags.join(', ')}
          onChange={(e) => handleTagsChange(e.target.value)}
          className="quick-input quick-input-tags"
        />

        <button type="submit" disabled={loading} className="quick-submit-btn">
          {loading ? '新增中...' : '新增餐廳'}
        </button>
        
        {/* 預覽圖片 */}
        {selectedImages.length > 0 && (
          <div className="quick-image-previews">
            {selectedImages.map((image) => (
              <div key={image.id} className="quick-preview-item">
                <img src={image.preview} alt={image.name} className="quick-preview-image" />
                <button
                  type="button"
                  onClick={() => removeImage(image.id)}
                  className="quick-remove-image"
                  disabled={loading}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </form>
    </div>
  );
};

export default QuickAddRestaurant;