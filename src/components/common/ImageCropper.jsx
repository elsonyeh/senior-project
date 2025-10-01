import React, { useState, useRef, useCallback, useEffect } from 'react';
import { IoCloseOutline, IoCheckmarkOutline, IoCropOutline } from 'react-icons/io5';
import './ImageCropper.css';

export default function ImageCropper({ image, onCrop, onCancel }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  // 圖片狀態
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // 圖片偏移(容器像素)
  const [zoom, setZoom] = useState(1); // 縮放倍數(相對於適配尺寸)
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  // 裁切配置
  const [cropSize, setCropSize] = useState(250);
  const [fitSize, setFitSize] = useState({ width: 0, height: 0 }); // 適配後的尺寸
  const [minZoom, setMinZoom] = useState(1); // 最小縮放(確保覆蓋裁切框)

  // 圖片載入
  const handleImageLoad = useCallback(() => {
    const img = imageRef.current;
    const container = containerRef.current;
    if (!img || !container) return;

    // 計算容器和裁切框尺寸
    const containerRect = container.getBoundingClientRect();
    const containerSize = Math.min(containerRect.width, containerRect.height) - 40;
    const actualCropSize = Math.min(containerSize * 0.7, 300);
    setCropSize(actualCropSize);

    // 計算圖片適配尺寸 - 確保完全覆蓋裁切框(正方形)
    const imgAspect = img.naturalWidth / img.naturalHeight;
    let fitWidth, fitHeight;

    if (imgAspect > 1) {
      // 橫圖：寬度貼齊裁切框，高度等比例
      fitWidth = actualCropSize;
      fitHeight = fitWidth / imgAspect;
    } else {
      // 直圖：高度貼齊裁切框，寬度等比例
      fitHeight = actualCropSize;
      fitWidth = fitHeight * imgAspect;
    }

    // 確保兩邊都不小於裁切框
    const requiredScale = Math.max(actualCropSize / fitWidth, actualCropSize / fitHeight);
    if (requiredScale > 1) {
      fitWidth *= requiredScale;
      fitHeight *= requiredScale;
    }

    // 設置最小縮放 = 1.0 (fitSize已經確保覆蓋裁切框)
    setMinZoom(1.0);
    setFitSize({ width: fitWidth, height: fitHeight });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setImageLoaded(true);
  }, []);

  // 拖拽
  const handleDragStart = useCallback((e) => {
    if (!imageLoaded) return;
    e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    setIsDragging(true);
    setDragStart({ x: clientX - offset.x, y: clientY - offset.y });
  }, [imageLoaded, offset]);

  const handleDragMove = useCallback((e) => {
    if (!isDragging) return;
    e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const newX = clientX - dragStart.x;
    const newY = clientY - dragStart.y;

    // 嚴格限制：圖片邊緣不能超過裁切框邊緣
    const displayWidth = fitSize.width * zoom;
    const displayHeight = fitSize.height * zoom;

    // 圖片必須完全覆蓋裁切框
    const maxOffsetX = Math.max(0, (displayWidth - cropSize) / 2);
    const maxOffsetY = Math.max(0, (displayHeight - cropSize) / 2);

    setOffset({
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, newX)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, newY))
    });
  }, [isDragging, dragStart, fitSize, zoom, cropSize]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 觸控縮放
  const [touchDistance, setTouchDistance] = useState(0);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setTouchDistance(dist);
    } else if (e.touches.length === 1) {
      handleDragStart(e);
    }
  }, [handleDragStart]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && touchDistance > 0) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = (dist - touchDistance) / 100;
      setTouchDistance(dist);

      setZoom(prev => Math.max(minZoom, Math.min(5, prev + delta)));
    } else {
      handleDragMove(e);
    }
  }, [touchDistance, handleDragMove]);

  // 裁切
  const handleCrop = useCallback(async () => {
    if (!imageLoaded) return;

    const canvas = canvasRef.current;
    const img = imageRef.current;
    const container = containerRef.current;
    if (!canvas || !img || !container) return;

    try {
      const ctx = canvas.getContext('2d');
      // 輸出尺寸 = 裁切框尺寸，保持1:1比例
      const outputSize = Math.round(cropSize);

      canvas.width = outputSize;
      canvas.height = outputSize;

      // 容器中心
      const containerRect = container.getBoundingClientRect();
      const centerX = containerRect.width / 2;
      const centerY = containerRect.height / 2;

      // 圖片顯示尺寸和位置
      const displayWidth = fitSize.width * zoom;
      const displayHeight = fitSize.height * zoom;
      const displayLeft = centerX - displayWidth / 2 + offset.x;
      const displayTop = centerY - displayHeight / 2 + offset.y;

      // 裁切框位置
      const cropLeft = centerX - cropSize / 2;
      const cropTop = centerY - cropSize / 2;

      // 轉換到圖片原始座標
      const scaleToNatural = img.naturalWidth / displayWidth;
      const sourceX = (cropLeft - displayLeft) * scaleToNatural;
      const sourceY = (cropTop - displayTop) * scaleToNatural;
      const sourceSize = cropSize * scaleToNatural;

      // 確保在圖片範圍內
      const clampedSourceX = Math.max(0, Math.min(img.naturalWidth - sourceSize, sourceX));
      const clampedSourceY = Math.max(0, Math.min(img.naturalHeight - sourceSize, sourceY));
      const clampedSourceSize = Math.min(sourceSize, img.naturalWidth, img.naturalHeight);

      // 白色背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outputSize, outputSize);

      // 直接繪製正方形區域(保證輸出與裁切框一致)
      ctx.drawImage(
        img,
        clampedSourceX,
        clampedSourceY,
        clampedSourceSize,
        clampedSourceSize,
        0, 0,
        outputSize,
        outputSize
      );

      // 轉換為文件
      canvas.toBlob((blob) => {
        if (blob) {
          const croppedFile = new File([blob], 'avatar.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          onCrop(croppedFile);
        }
      }, 'image/jpeg', 0.92);
    } catch (error) {
      console.error('裁切失敗:', error);
    }
  }, [imageLoaded, fitSize, zoom, offset, cropSize, onCrop]);

  // 滾輪縮放(原生事件)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !imageLoaded) return;

    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => Math.max(minZoom, Math.min(5, prev + delta)));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [imageLoaded]);

  // 全域拖拽監聽
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMove = (e) => handleDragMove(e);
    const handleGlobalUp = () => handleDragEnd();

    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mouseup', handleGlobalUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // 計算圖片樣式
  const imageStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: fitSize.width * zoom,
    height: fitSize.height * zoom,
    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
    cursor: isDragging ? 'grabbing' : 'grab',
    transition: isDragging ? 'none' : 'all 0.1s ease',
    opacity: imageLoaded ? 1 : 0.3,
    userSelect: 'none'
  };

  return (
    <div className="image-cropper-overlay">
      <div className="image-cropper-modal">
        <div className="cropper-header">
          <h3>
            <IoCropOutline />
            調整照片
          </h3>
          <button onClick={onCancel} className="close-button">
            <IoCloseOutline />
          </button>
        </div>

        <div className="cropper-content">
          <div
            ref={containerRef}
            className="image-container"
            style={{ touchAction: 'none' }}
          >
            <img
              ref={imageRef}
              src={image}
              alt="待裁切"
              onLoad={handleImageLoad}
              onMouseDown={handleDragStart}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleDragEnd}
              draggable={false}
              style={imageStyle}
            />

            {imageLoaded && (
              <div
                className="crop-overlay-fixed"
                style={{
                  width: cropSize,
                  height: cropSize,
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none'
                }}
              />
            )}
          </div>

          <div className="cropper-hint">
            <p>{imageLoaded ? '拖拽調整位置，滾輪或雙指縮放' : '載入中...'}</p>
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
          >
            <IoCheckmarkOutline />
            確認
          </button>
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}