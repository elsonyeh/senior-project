import React, { useState, useRef, useEffect } from "react";
import { restaurantImageService } from "../services/restaurantService";
import { adminService } from "../services/supabaseService";
import "./RestaurantImageUpload.css";

const RestaurantImageUpload = ({
  restaurantId,
  onUploadSuccess,
  onUploadError,
  maxFiles = 5,
  acceptedTypes = ["image/jpeg", "image/png", "image/webp"],
  maxFileSize = 5 * 1024 * 1024, // 5MB
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [previewImages, setPreviewImages] = useState([]);
  const [uploadMode, setUploadMode] = useState("file"); // 'file', 'url', 'google-drive', 'download-url'
  const [imageUrls, setImageUrls] = useState([""]); // 外部連結輸入
  const [isGoogleDriveAuthorized, setIsGoogleDriveAuthorized] = useState(false);
  const [gapiLoaded, setGapiLoaded] = useState(false);
  const [currentAdminName, setCurrentAdminName] = useState("管理員");
  const [currentAdminId, setCurrentAdminId] = useState(null);
  const fileInputRef = useRef(null);

  // 獲取當前管理員資訊
  useEffect(() => {
    const loadCurrentAdmin = async () => {
      try {
        const currentAdmin = await adminService.getCurrentAdmin();
        if (currentAdmin) {
          setCurrentAdminName(currentAdmin.name || "管理員");
          setCurrentAdminId(currentAdmin.id || currentAdmin.adminId); // 獲取管理員 ID
          console.log('當前管理員資訊:', { id: currentAdmin.id, adminId: currentAdmin.adminId, name: currentAdmin.name });
        } else {
          setCurrentAdminName("管理員");
          setCurrentAdminId(null);
        }
      } catch (error) {
        console.error('獲取當前管理員資訊失敗:', error);
        setCurrentAdminName("管理員");
        setCurrentAdminId(null);
      }
    };

    loadCurrentAdmin();
  }, []);

  // 初始化Google Drive API
  // 暫時禁用 Google Drive 功能，提供提示訊息
  const initializeGoogleDrive = () => {
    return new Promise((resolve, reject) => {
      reject(new Error('Google Drive 功能暫時停用，請使用其他上傳方式'));
    });
  };

  // Google Drive 登入
  const signInToGoogleDrive = async () => {
    alert("Google Drive 功能暫時停用中\n\n請使用以下替代方案：\n• 📁 本機上傳：直接選擇電腦中的圖片\n• 🔗 外部連結：貼上圖片網址\n• 📥 下載上傳：輸入網址自動下載");
  };

  // Google Drive 登出
  const signOutFromGoogleDrive = async () => {
    try {
      // 撤銷 access token
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        window.google.accounts.oauth2.revoke(window.gapi.client.getToken().access_token);
      }
      setIsGoogleDriveAuthorized(false);
    } catch (error) {
      console.error("Google Drive 登出失敗:", error);
      setIsGoogleDriveAuthorized(false);
    }
  };

  // 從Google Drive選擇檔案
  const selectFromGoogleDrive = async () => {
    try {
      if (!isGoogleDriveAuthorized) {
        await signInToGoogleDrive();
        return;
      }

      // 使用Google Picker API選擇檔案
      const token = window.gapi.client.getToken();
      if (!token || !token.access_token) {
        await signInToGoogleDrive();
        return;
      }

      const picker = new window.google.picker.PickerBuilder()
        .addView(
          new window.google.picker.DocsView(window.google.picker.ViewId.PHOTOS)
        )
        .setOAuthToken(token.access_token)
        .setCallback(handleGoogleDriveSelection)
        .build();

      picker.setVisible(true);
    } catch (error) {
      console.error("打開Google Drive選擇器失敗:", error);
      alert("無法打開Google Drive選擇器，請確認您已登入");
    }
  };

  // 處理Google Drive檔案選擇
  const handleGoogleDriveSelection = (data) => {
    if (data.action === window.google.picker.Action.PICKED) {
      const files = data.docs;
      const imageFiles = files.filter(
        (file) => file.mimeType && file.mimeType.startsWith("image/")
      );

      if (imageFiles.length === 0) {
        alert("請選擇圖片檔案");
        return;
      }

      // 轉換為預覽格式
      const previews = imageFiles.slice(0, maxFiles).map((file, index) => ({
        id: `gd-${index}`,
        googleDriveFile: file,
        preview: file.thumbnailLink || file.iconLink,
        name: file.name,
        size: file.sizeBytes || 0,
        source: "google-drive",
      }));

      setPreviewImages(previews);
    }
  };

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

  // 處理檔案選擇 - 增強版支援拖放
  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    processFiles(files);
  };


  // 處理檔案處理
  const processFiles = (files) => {
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
            size: file.size,
            source: "local",
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
    setPreviewImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  // 獲取圖片尺寸
  const getImageDimensions = (file) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.src = URL.createObjectURL(file);
    });
  };

  // 新增 URL 輸入欄位
  const addUrlInput = () => {
    if (imageUrls.length < maxFiles) {
      setImageUrls([...imageUrls, ""]);
    }
  };

  // 移除 URL 輸入欄位
  const removeUrlInput = (index) => {
    const newUrls = imageUrls.filter((_, i) => i !== index);
    setImageUrls(newUrls.length > 0 ? newUrls : [""]);
  };

  // 更新 URL 輸入
  const updateUrlInput = (index, value) => {
    const newUrls = [...imageUrls];
    newUrls[index] = value;
    setImageUrls(newUrls);
  };

  // 上傳外部連結圖片
  const uploadExternalImages = async () => {
    const validUrls = imageUrls.filter((url) => url.trim() !== "");

    if (validUrls.length === 0) {
      alert("請輸入至少一個有效的圖片連結");
      return;
    }

    setUploading(true);

    try {
      const uploadPromises = validUrls.map((url, index) =>
        restaurantImageService.addExternalImage(url.trim(), restaurantId, {
          altText: `餐廳照片 ${index + 1}`,
          imageType: "general",
          isPrimary: index === 0, // 第一張設為主要照片
          displayOrder: index,
          uploadedBy: currentAdminId,
          externalSource: "外部連結",
        })
      );

      const results = await Promise.all(uploadPromises);

      // 清空輸入
      setImageUrls([""]);

      // 通知父組件上傳成功
      if (onUploadSuccess) {
        onUploadSuccess(results);
      }

      alert(`成功新增 ${results.length} 張外部圖片！`);
    } catch (error) {
      console.error("新增外部圖片失敗:", error);
      if (onUploadError) {
        onUploadError(error);
      }
      alert(`新增失敗: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // 下載並上傳URL圖片
  const downloadAndUploadImages = async () => {
    const validUrls = imageUrls.filter((url) => url.trim() !== "");

    if (validUrls.length === 0) {
      alert("請輸入至少一個有效的圖片連結");
      return;
    }

    setUploading(true);

    try {
      const results = await restaurantImageService.batchDownloadAndUploadImages(
        validUrls.map(url => url.trim()),
        restaurantId,
        {
          altText: "餐廳照片",
          imageType: "general",
          uploadedBy: currentAdminId,
          setPrimaryToFirst: true, // 第一張設為主要照片
          maxConcurrency: 2, // 限制併發數量以避免過載
          onBatchProgress: (progress, current, total) => {
            setUploadProgress({
              overall: progress,
              current: current,
              total: total,
              status: `正在下載第 ${current}/${total} 張圖片... (${progress}%)`
            });
          }
        }
      );

      // 清空輸入
      setImageUrls([""]);
      setUploadProgress({});

      // 通知父組件上傳成功
      if (onUploadSuccess) {
        onUploadSuccess(results.results);
      }

      // 顯示詳細結果
      if (results.errorCount > 0) {
        const errorMessages = results.errors.map(err => `${err.url}: ${err.error}`).join('\n');
        alert(`部分下載完成:\n成功: ${results.successCount} 張\n失敗: ${results.errorCount} 張\n\n失敗詳情:\n${errorMessages}`);
      } else {
        alert(`成功下載並上傳 ${results.successCount} 張圖片到 Supabase Storage！`);
      }
    } catch (error) {
      console.error("批量下載並上傳失敗:", error);
      setUploadProgress({});
      if (onUploadError) {
        onUploadError(error);
      }
      alert(`批量下載失敗: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // 批量上傳檔案
  const handleFileUpload = async () => {
    if (previewImages.length === 0) {
      alert("請選擇要上傳的圖片");
      return;
    }

    setUploading(true);

    try {
      const uploadPromises = previewImages.map((preview, index) =>
        uploadSingleFile(preview.file, {
          altText: `餐廳照片 ${index + 1}`,
          imageType: "general",
          isPrimary: index === 0, // 第一張設為主要照片
          displayOrder: index,
          uploadedBy: currentAdminId,
        })
      );

      const results = await Promise.all(uploadPromises);

      // 清空預覽和進度
      setPreviewImages([]);
      setUploadProgress({});
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // 通知父組件上傳成功
      if (onUploadSuccess) {
        onUploadSuccess(results);
      }

      alert(`成功上傳 ${results.length} 張圖片！`);
    } catch (error) {
      console.error("上傳失敗:", error);
      if (onUploadError) {
        onUploadError(error);
      }
      alert(`上傳失敗: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // 格式化檔案大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // 上傳Google Drive檔案
  const uploadGoogleDriveFile = async (googleDriveFile, options = {}) => {
    try {
      // 從Google Drive下載檔案
      const response = await window.gapi.client.request({
        path: `https://www.googleapis.com/drive/v3/files/${googleDriveFile.id}`,
        method: "GET",
        params: { alt: "media" },
      });

      // 轉換為Blob
      const blob = new Blob([response.body], {
        type: googleDriveFile.mimeType,
      });
      const file = new File([blob], googleDriveFile.name, {
        type: googleDriveFile.mimeType,
      });

      // 使用現有的上傳邏輯
      return await uploadSingleFile(file, {
        ...options,
        source: "google-drive",
        originalUrl: googleDriveFile.webViewLink,
      });
    } catch (error) {
      console.error("Google Drive檔案上傳失敗:", error);
      throw error;
    }
  };

  // 上傳單一檔案 - 增強版
  const uploadSingleFile = async (file, options = {}) => {
    const fileId = `${file.name}-${Date.now()}`;

    try {
      // 獲取圖片尺寸
      const dimensions = await getImageDimensions(file);

      setUploadProgress((prev) => ({ ...prev, [fileId]: 0 }));

      const result = await restaurantImageService.uploadRestaurantImage(
        file,
        restaurantId,
        {
          ...options,
          width: dimensions.width,
          height: dimensions.height,
          onProgress: (progress) => {
            setUploadProgress((prev) => ({ ...prev, [fileId]: progress }));
          },
        }
      );

      setUploadProgress((prev) => ({ ...prev, [fileId]: 100 }));

      return result;
    } catch (error) {
      setUploadProgress((prev) => {
        const newProgress = { ...prev };
        delete newProgress[fileId];
        return newProgress;
      });
      throw error;
    }
  };


  // 統一處理上傳
  const handleUpload = async () => {
    if (uploadMode === "file") {
      await handleFileUpload();
    } else if (uploadMode === "url") {
      await uploadExternalImages();
    } else if (uploadMode === "download-url") {
      await downloadAndUploadImages();
    } else if (uploadMode === "google-drive") {
      await handleGoogleDriveUpload();
    }
  };

  // 處理Google Drive上傳
  const handleGoogleDriveUpload = async () => {
    const googleDriveFiles = previewImages.filter(
      (img) => img.source === "google-drive"
    );

    if (googleDriveFiles.length === 0) {
      alert("請選擇要上傳的Google Drive圖片");
      return;
    }

    setUploading(true);

    try {
      const uploadPromises = googleDriveFiles.map((preview, index) =>
        uploadGoogleDriveFile(preview.googleDriveFile, {
          altText: `餐廳照片 ${index + 1}`,
          imageType: "general",
          isPrimary: index === 0,
          displayOrder: index,
          uploadedBy: currentAdminId,
        })
      );

      const results = await Promise.all(uploadPromises);

      // 清空預覽和進度
      setPreviewImages([]);
      setUploadProgress({});

      // 通知父組件上傳成功
      if (onUploadSuccess) {
        onUploadSuccess(results);
      }

      alert(`成功上傳 ${results.length} 張Google Drive圖片！`);
    } catch (error) {
      console.error("Google Drive圖片上傳失敗:", error);
      if (onUploadError) {
        onUploadError(error);
      }
      alert(`上傳失敗: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="restaurant-image-upload">
      <h3>新增餐廳照片</h3>

      {/* 上傳模式選擇 */}
      <div className="upload-mode-selection">
        <div className="mode-buttons">
          <button
            type="button"
            className={`mode-btn ${uploadMode === "file" ? "active" : ""}`}
            onClick={() => setUploadMode("file")}
            disabled={uploading}
          >
            📁 本機上傳
          </button>
          <button
            type="button"
            className={`mode-btn ${
              uploadMode === "google-drive" ? "active" : ""
            }`}
            onClick={() => setUploadMode("google-drive")}
            disabled={uploading}
          >
            💾 Google雲端硬碟
          </button>
          <button
            type="button"
            className={`mode-btn ${uploadMode === "url" ? "active" : ""}`}
            onClick={() => setUploadMode("url")}
            disabled={uploading}
          >
            🔗 外部連結
          </button>
          <button
            type="button"
            className={`mode-btn ${uploadMode === "download-url" ? "active" : ""}`}
            onClick={() => setUploadMode("download-url")}
            disabled={uploading}
          >
            📥 下載上傳
          </button>
        </div>
      </div>

      {/* 本機檔案上傳模式 */}
      {uploadMode === "file" && (
        <div className="file-upload-mode">
          <div className="file-input-section">
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept={acceptedTypes.join(",")}
              onChange={handleFileSelect}
              disabled={uploading}
              className="file-input"
            />

            <button
              type="button"
              className="add-file-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              📷 選擇照片
            </button>

            <div className="upload-info">
              <p>• 支援格式: JPG, PNG, WebP</p>
              <p>
                • 檔案大小限制: {(maxFileSize / (1024 * 1024)).toFixed(1)}MB
              </p>
              <p>• 最多可選擇 {maxFiles} 個檔案</p>
            </div>
          </div>
        </div>
      )}

      {/* Google Drive上傳模式 */}
      {uploadMode === "google-drive" && (
        <div className="google-drive-mode">
          <div className="google-drive-section">
            {!isGoogleDriveAuthorized ? (
              <div className="google-drive-login">
                <p>請先登入Google帳號以存取Google雲端硬碟</p>
                <button
                  type="button"
                  onClick={signInToGoogleDrive}
                  className="google-login-btn"
                  disabled={uploading}
                >
                  🔐 登入Google帳號
                </button>
              </div>
            ) : (
              <div className="google-drive-logged-in">
                <div className="google-drive-header">
                  <p>✅ 已登入Google帳號</p>
                  <button
                    type="button"
                    onClick={signOutFromGoogleDrive}
                    className="google-logout-btn"
                    disabled={uploading}
                  >
                    登出
                  </button>
                </div>
                <button
                  type="button"
                  onClick={selectFromGoogleDrive}
                  className="google-drive-select-btn"
                  disabled={uploading}
                >
                  📂 從Google雲端硬碟選擇圖片
                </button>
              </div>
            )}

            <div className="upload-info">
              <p>• 支援從Google雲端硬碟直接選擇圖片</p>
              <p>• 自動同步檔案到本地儲存</p>
              <p>• 最多可選擇 {maxFiles} 個檔案</p>
            </div>
          </div>
        </div>
      )}

      {/* 外部連結模式 */}
      {uploadMode === "url" && (
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

      {/* 下載並上傳模式 */}
      {uploadMode === "download-url" && (
        <div className="download-url-mode">
          <div className="url-input-section">
            <h4>📥 從URL下載圖片並上傳到Supabase</h4>
            <p className="mode-description">
              輸入圖片URL，系統會自動下載圖片並上傳至Supabase Storage，
              提供更好的載入速度和可靠性。
            </p>

            <div className="url-inputs">
              {imageUrls.map((url, index) => (
                <div key={index} className="url-input-group">
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

            <div className="download-info">
              <p>• 支援格式: JPG, PNG, WebP, GIF, BMP</p>
              <p>• 圖片會自動下載並上傳到Supabase Storage</p>
              <p>• 提供更穩定的載入速度和存取控制</p>
              <p>• 批量處理最多 {maxFiles} 張圖片</p>
              <p>• 自動記錄原始來源URL</p>
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
                  <span className={`source-badge ${preview.source || "local"}`}>
                    {preview.source === "google-drive"
                      ? "Google Drive"
                      : preview.source === "url"
                      ? "外部連結"
                      : "本機檔案"}
                  </span>
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
                  {preview.id === 0 && (
                    <span className="primary-badge">主要照片</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 上傳進度 */}
      {(Object.keys(uploadProgress).length > 0 || uploadProgress.status) && (
        <div className="upload-progress-section">
          <h4>{uploadMode === "download-url" ? "下載上傳進度" : "上傳進度"}</h4>

          {/* 批量下載進度 */}
          {uploadProgress.status && (
            <div className="batch-progress">
              <div className="progress-item">
                <div className="progress-label">{uploadProgress.status}</div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${uploadProgress.overall || 0}%` }}
                  />
                </div>
                <span className="progress-text">{uploadProgress.overall || 0}%</span>
              </div>
            </div>
          )}

          {/* 單檔進度 */}
          {Object.entries(uploadProgress).map(([fileId, progress]) => {
            if (typeof progress === 'number') {
              return (
                <div key={fileId} className="progress-item">
                  <div className="progress-label">{fileId.split("-")[0]}</div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="progress-text">{progress}%</span>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}

      {/* 上傳按鈕 */}
      <div className="upload-actions">
        <button
          type="button"
          onClick={handleUpload}
          disabled={
            uploading ||
            (uploadMode === "file" && previewImages.length === 0) ||
            ((uploadMode === "url" || uploadMode === "download-url") &&
              imageUrls.filter((url) => url.trim() !== "").length === 0) ||
            (uploadMode === "google-drive" &&
              previewImages.filter((img) => img.source === "google-drive")
                .length === 0)
          }
          className={`upload-btn ${uploading ? "uploading" : ""}`}
        >
          {uploading
            ? uploadMode === "file"
              ? "上傳中..."
              : uploadMode === "download-url"
              ? "下載上傳中..."
              : "新增中..."
            : uploadMode === "file"
            ? `上傳 ${previewImages.length} 張圖片`
            : uploadMode === "download-url"
            ? `下載上傳 ${
                imageUrls.filter((url) => url.trim() !== "").length
              } 張圖片`
            : uploadMode === "google-drive"
            ? `上傳 ${
                previewImages.filter((img) => img.source === "google-drive")
                  .length
              } 張Google Drive圖片`
            : `新增 ${
                imageUrls.filter((url) => url.trim() !== "").length
              } 張圖片`}
        </button>
      </div>
    </div>
  );
};

export default RestaurantImageUpload;
