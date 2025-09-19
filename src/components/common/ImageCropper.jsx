import React, { useState, useRef, useCallback } from 'react';
import { IoCloseOutline, IoCheckmarkOutline, IoCropOutline } from 'react-icons/io5';
import './ImageCropper.css';

export default function ImageCropper({ image, onCrop, onCancel }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const [imageTransform, setImageTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [cropSize, setCropSize] = useState(250); // 固定裁切區域大小


  const handleImageLoad = useCallback(() => {
    const img = imageRef.current;
    const container = containerRef.current;

    if (!img || !container) {
      console.error('Missing image or container reference');
      return;
    }


    // 延遲執行以確保容器完全渲染
    setTimeout(() => {
      try {
        // 計算容器大小
        const containerRect = container.getBoundingClientRect();
        const containerSize = Math.min(containerRect.width, containerRect.height) - 40;

        // 設置裁切區域大小（正方形）
        const newCropSize = Math.min(containerSize * 0.7, 250);
        setCropSize(newCropSize);

        // 計算圖片初始尺寸和位置
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;

        // 計算初始縮放比例，讓圖片能夠覆蓋裁切區域
        const scaleToFitCrop = Math.max(newCropSize / img.naturalWidth, newCropSize / img.naturalHeight);
        const initialScale = Math.max(scaleToFitCrop * 1.1, 0.8);

        setImageTransform({
          x: 0,
          y: 0,
          scale: initialScale
        });

        setImageLoaded(true);
      } catch (error) {
        console.error('Error initializing image cropper:', error);
        setImageLoaded(true); // 即使出錯也要設為已載入
      }
    }, 50);
  }, []);

  // 處理圖片拖拽（滑鼠和觸控）
  const handleImageMouseDown = useCallback((e) => {
    if (!imageLoaded) return; // 確保圖片已載入

    if (!e.touches) {
      e.preventDefault();
    }
    e.stopPropagation();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    setIsDragging(true);
    setDragStart({
      x: clientX - imageTransform.x,
      y: clientY - imageTransform.y
    });
  }, [imageTransform, imageLoaded]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !imageRef.current || !containerRef.current) return;

    if (!e.touches) {
      e.preventDefault();
    }

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const newX = clientX - dragStart.x;
    const newY = clientY - dragStart.y;

    // 可以自由拖拽，不限制邊界，讓用戶完全控制
    setImageTransform(prev => ({
      ...prev,
      x: newX,
      y: newY
    }));
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 滾輪縮放
  const handleWheel = useCallback((e) => {
    if (!imageLoaded) return; // 確保圖片已載入

    // 不在這裡呼叫 preventDefault，改用 CSS 的 touch-action 和事件選項
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setImageTransform(prev => {
      const newScale = Math.max(0.5, Math.min(3, prev.scale + delta));
      return { ...prev, scale: newScale };
    });
  }, [imageLoaded]);

  const handleCrop = useCallback(async () => {
    if (!imageLoaded) return; // 確保圖片已載入

    const canvas = canvasRef.current;
    const img = imageRef.current;
    const container = containerRef.current;
    if (!canvas || !img || !container) {
      console.error('Missing required elements for cropping');
      return;
    }

    try {
      const ctx = canvas.getContext('2d');
      const outputSize = 300; // 輸出正方形尺寸

      canvas.width = outputSize;
      canvas.height = outputSize;

      // 獲取容器的中心位置
      const containerRect = container.getBoundingClientRect();
      const centerX = containerRect.width / 2;
      const centerY = containerRect.height / 2;

      // 計算裁切區域在圖片中的位置
      const cropLeft = centerX - cropSize / 2;
      const cropTop = centerY - cropSize / 2;

      // 計算圖片在容器中的實際位置和尺寸
      const imgDisplayWidth = img.naturalWidth * imageTransform.scale;
      const imgDisplayHeight = img.naturalHeight * imageTransform.scale;

      // 計算裁切區域相對於圖片的位置
      const sourceX = (cropLeft - imageTransform.x) / imageTransform.scale;
      const sourceY = (cropTop - imageTransform.y) / imageTransform.scale;
      const sourceSize = cropSize / imageTransform.scale;

      // 確保裁切參數有效
      const finalSourceX = Math.max(0, sourceX);
      const finalSourceY = Math.max(0, sourceY);
      const finalSourceWidth = Math.min(sourceSize, img.naturalWidth - finalSourceX);
      const finalSourceHeight = Math.min(sourceSize, img.naturalHeight - finalSourceY);

      if (finalSourceWidth <= 0 || finalSourceHeight <= 0) {
        console.error('Invalid crop dimensions');
        return;
      }

      // 繪製裁切後的圖片
      ctx.drawImage(
        img,
        finalSourceX,
        finalSourceY,
        finalSourceWidth,
        finalSourceHeight,
        0, 0, outputSize, outputSize
      );

      // 轉換為 Blob
      canvas.toBlob((blob) => {
        if (blob) {
          const croppedFile = new File([blob], 'avatar.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          onCrop(croppedFile);
        } else {
          console.error('Failed to create blob from canvas');
        }
      }, 'image/jpeg', 0.9);
    } catch (error) {
      console.error('Error during crop operation:', error);
    }
  }, [imageTransform, cropSize, onCrop, imageLoaded]);

  return (
    <div className="image-cropper-overlay">
      <div className="image-cropper-modal">
        <div className="cropper-header">
          <h3>
            <IoCropOutline />
            裁切頭像
          </h3>
          <button onClick={onCancel} className="close-button">
            <IoCloseOutline />
          </button>
        </div>

        <div className="cropper-content">
          <div
            ref={containerRef}
            className="image-container"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
            onWheel={handleWheel}
            style={{ userSelect: 'none', touchAction: 'none' }}
          >
            <img
              ref={imageRef}
              src={image}
              alt="待裁切圖片"
              onLoad={handleImageLoad}
              onMouseDown={handleImageMouseDown}
              onTouchStart={handleImageMouseDown}
              onError={(e) => {
                console.error('Image load error:', e);
                setImageLoaded(false);
              }}
              draggable={false}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) translate(${imageTransform.x}px, ${imageTransform.y}px) scale(${imageTransform.scale})`,
                transformOrigin: 'center center',
                cursor: isDragging ? 'grabbing' : 'grab',
                transition: isDragging ? 'none' : 'transform 0.1s ease',
                maxWidth: 'none',
                maxHeight: 'none',
                width: 'auto',
                height: 'auto',
                opacity: imageLoaded ? 1 : 0.5,
                zIndex: 1
              }}
            />

            {imageLoaded && (
              <div
                className="crop-overlay-fixed"
                style={{
                  width: cropSize,
                  height: cropSize,
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)'
                }}
              />
            )}
          </div>

          <div className="cropper-hint">
            {imageLoaded ? (
              <p>拖拽圖片調整位置，滾輪縮放調整大小</p>
            ) : (
              <p>正在載入圖片...</p>
            )}
          </div>
        </div>

        <div className="cropper-actions">
          <button onClick={onCancel} className="cancel-button">
            取消
          </button>
          <button
            onClick={handleCrop}
            className="crop-button"
            disabled={!imageLoaded}
            style={{
              opacity: imageLoaded ? 1 : 0.6,
              cursor: imageLoaded ? 'pointer' : 'not-allowed'
            }}
          >
            <IoCheckmarkOutline />
            {imageLoaded ? '確認上傳' : '載入中...'}
          </button>
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}