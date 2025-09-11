import React, { useState, useRef } from 'react';
import { restaurantImageService } from '../services/restaurantService';
import './RestaurantImageUpload.css';

const RestaurantImageUpload = ({ 
  restaurantId, 
  onUploadSuccess, 
  onUploadError,
  maxFiles = 5,
  acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'],
  maxFileSize = 5 * 1024 * 1024 // 5MB
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [previewImages, setPreviewImages] = useState([]);
  const [uploadMode, setUploadMode] = useState('file'); // 'file' 或 'url'
  const [imageUrls, setImageUrls] = useState(['']); // 外部連結輸入
  const fileInputRef = useRef(null);

  // 檢查檔案是否有效
  const validateFile = (file) => {
    if (!acceptedTypes.includes(file.type)) {
      throw new Error(`不支援的檔案格式: ${file.type}`);
    }
    
    if (file.size > maxFileSize) {
      const sizeMB = (maxFileSize / (1024 * 1024)).toFixed(1);
      throw new Error(`檔案大小超過限制 (${sizeMB}MB)`);
    }
    
    return true;
  };

  // 處理檔案選擇
  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    
    if (files.length > maxFiles) {
      alert(`最多只能選擇 ${maxFiles} 個檔案`);
      return;
    }

    // 驗證檔案並建立預覽
    const validFiles = [];
    const previews = [];

    files.forEach((file, index) => {
      try {
        validateFile(file);
        validFiles.push(file);
        
        // 建立預覽圖
        const reader = new FileReader();
        reader.onload = (e) => {
          previews.push({
            id: index,
            file,
            preview: e.target.result,
            name: file.name,
            size: file.size
          });
          
          if (previews.length === validFiles.length) {
            setPreviewImages(previews);
          }
        };
        reader.readAsDataURL(file);
      } catch (error) {
        alert(`${file.name}: ${error.message}`);
      }
    });
  };

  // 移除預覽圖片
  const removePreviewImage = (imageId) => {
    setPreviewImages(prev => prev.filter(img => img.id !== imageId));
  };

  // 上傳單一檔案
  const uploadSingleFile = async (file, options = {}) => {
    const fileId = `${file.name}-${Date.now()}`;
    
    try {
      // 獲取圖片尺寸
      const dimensions = await getImageDimensions(file);
      
      setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));
      
      const result = await restaurantImageService.uploadRestaurantImage(
        file,
        restaurantId,
        {
          ...options,
          width: dimensions.width,
          height: dimensions.height
        }
      );
      
      setUploadProgress(prev => ({ ...prev, [fileId]: 100 }));
      
      return result;
    } catch (error) {
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[fileId];
        return newProgress;
      });
      throw error;
    }
  };

  // 獲取圖片尺寸
  const getImageDimensions = (file) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };
      img.src = URL.createObjectURL(file);
    });
  };

  // 新增 URL 輸入欄位
  const addUrlInput = () => {
    if (imageUrls.length < maxFiles) {
      setImageUrls([...imageUrls, '']);
    }
  };

  // 移除 URL 輸入欄位
  const removeUrlInput = (index) => {
    const newUrls = imageUrls.filter((_, i) => i !== index);
    setImageUrls(newUrls.length > 0 ? newUrls : ['']);
  };

  // 更新 URL 輸入
  const updateUrlInput = (index, value) => {
    const newUrls = [...imageUrls];
    newUrls[index] = value;
    setImageUrls(newUrls);
  };

  // 上傳外部連結圖片
  const uploadExternalImages = async () => {
    const validUrls = imageUrls.filter(url => url.trim() !== '');
    
    if (validUrls.length === 0) {
      alert('請輸入至少一個有效的圖片連結');
      return;
    }

    setUploading(true);

    try {
      const uploadPromises = validUrls.map((url, index) => 
        restaurantImageService.addExternalImage(url.trim(), restaurantId, {
          altText: `${restaurantId} 外部照片 ${index + 1}`,
          imageType: 'general',
          isPrimary: index === 0, // 第一張設為主要照片
          displayOrder: index,
          externalSource: '外部連結'
        })
      );

      const results = await Promise.all(uploadPromises);
      
      // 清空輸入
      setImageUrls(['']);

      // 通知父組件上傳成功
      if (onUploadSuccess) {
        onUploadSuccess(results);
      }

      alert(`成功新增 ${results.length} 張外部圖片！`);
    } catch (error) {
      console.error('新增外部圖片失敗:', error);
      if (onUploadError) {
        onUploadError(error);
      }
      alert(`新增失敗: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // 批量上傳檔案
  const handleFileUpload = async () => {
    if (previewImages.length === 0) {
      alert('請選擇要上傳的圖片');
      return;
    }

    setUploading(true);

    try {
      const uploadPromises = previewImages.map((preview, index) => 
        uploadSingleFile(preview.file, {
          altText: `${restaurantId} 照片 ${index + 1}`,
          imageType: 'general',
          isPrimary: index === 0, // 第一張設為主要照片
          displayOrder: index
        })
      );

      const results = await Promise.all(uploadPromises);
      
      // 清空預覽和進度
      setPreviewImages([]);
      setUploadProgress({});
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // 通知父組件上傳成功
      if (onUploadSuccess) {
        onUploadSuccess(results);
      }

      alert(`成功上傳 ${results.length} 張圖片！`);
    } catch (error) {
      console.error('上傳失敗:', error);
      if (onUploadError) {
        onUploadError(error);
      }
      alert(`上傳失敗: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // 統一處理上傳
  const handleUpload = () => {
    if (uploadMode === 'file') {
      handleFileUpload();
    } else {
      uploadExternalImages();
    }
  };

  // 格式化檔案大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="restaurant-image-upload">
      <h3>新增餐廳照片</h3>
      
      {/* 上傳模式選擇 */}
      <div className="upload-mode-selection">
        <div className="mode-buttons">
          <button 
            type="button"
            className={`mode-btn ${uploadMode === 'file' ? 'active' : ''}`}
            onClick={() => setUploadMode('file')}
            disabled={uploading}
          >
            📁 上傳檔案
          </button>
          <button 
            type="button"
            className={`mode-btn ${uploadMode === 'url' ? 'active' : ''}`}
            onClick={() => setUploadMode('url')}
            disabled={uploading}
          >
            🔗 外部連結
          </button>
        </div>
      </div>

      {/* 檔案上傳模式 */}
      {uploadMode === 'file' && (
        <div className="file-upload-mode">
          <div className="file-input-section">
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept={acceptedTypes.join(',')}
              onChange={handleFileSelect}
              disabled={uploading}
              className="file-input"
            />
            
            <div className="upload-info">
              <p>• 支援格式: JPG, PNG, WebP</p>
              <p>• 檔案大小限制: {(maxFileSize / (1024 * 1024)).toFixed(1)}MB</p>
              <p>• 最多可選擇 {maxFiles} 個檔案</p>
            </div>
          </div>
        </div>
      )}

      {/* 外部連結模式 */}
      {uploadMode === 'url' && (
        <div className="url-upload-mode">
          <div className="url-input-section">
            <div className="url-inputs">
              {imageUrls.map((url, index) => (
                <div key={index} className="url-input-row">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => updateUrlInput(index, e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    disabled={uploading}
                    className="url-input"
                  />
                  {imageUrls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeUrlInput(index)}
                      disabled={uploading}
                      className="remove-url-btn"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            {imageUrls.length < maxFiles && (
              <button
                type="button"
                onClick={addUrlInput}
                disabled={uploading}
                className="add-url-btn"
              >
                + 新增連結
              </button>
            )}
            
            <div className="upload-info">
              <p>• 支援格式: JPG, PNG, WebP, GIF, BMP</p>
              <p>• 請確保圖片連結可以公開訪問</p>
              <p>• 最多可新增 {maxFiles} 個連結</p>
            </div>
          </div>
        </div>
      )}

      {/* 預覽區域 */}
      {previewImages.length > 0 && (
        <div className="preview-section">
          <h4>預覽圖片</h4>
          <div className="preview-grid">
            {previewImages.map((preview) => (
              <div key={preview.id} className="preview-item">
                <div className="preview-image-container">
                  <img 
                    src={preview.preview} 
                    alt={preview.name}
                    className="preview-image"
                  />
                  <button
                    type="button"
                    onClick={() => removePreviewImage(preview.id)}
                    className="remove-preview-btn"
                    disabled={uploading}
                  >
                    ×
                  </button>
                </div>
                <div className="preview-info">
                  <p className="file-name">{preview.name}</p>
                  <p className="file-size">{formatFileSize(preview.size)}</p>
                  {preview.id === 0 && <span className="primary-badge">主要照片</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 上傳進度 */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="upload-progress-section">
          <h4>上傳進度</h4>
          {Object.entries(uploadProgress).map(([fileId, progress]) => (
            <div key={fileId} className="progress-item">
              <div className="progress-label">{fileId.split('-')[0]}</div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="progress-text">{progress}%</span>
            </div>
          ))}
        </div>
      )}

      {/* 上傳按鈕 */}
      <div className="upload-actions">
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading || (uploadMode === 'file' && previewImages.length === 0) || (uploadMode === 'url' && imageUrls.filter(url => url.trim() !== '').length === 0)}
          className={`upload-btn ${uploading ? 'uploading' : ''}`}
        >
          {uploading 
            ? (uploadMode === 'file' ? '上傳中...' : '新增中...') 
            : uploadMode === 'file' 
              ? `上傳 ${previewImages.length} 張圖片`
              : `新增 ${imageUrls.filter(url => url.trim() !== '').length} 張圖片`
          }
        </button>
      </div>
    </div>
  );
};

export default RestaurantImageUpload;