import React from 'react';
import { IoWarningOutline, IoCheckmarkOutline, IoCloseOutline } from 'react-icons/io5';
import './ConfirmDialog.css';

export default function ConfirmDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = '確認操作', 
  message = '您確定要執行此操作嗎？',
  confirmText = '確認',
  cancelText = '取消',
  type = 'warning' // warning, danger, info
}) {
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <IoWarningOutline className="dialog-icon danger" />;
      case 'info':
        return <IoCheckmarkOutline className="dialog-icon info" />;
      default:
        return <IoWarningOutline className="dialog-icon warning" />;
    }
  };

  return (
    <div className="confirm-dialog-overlay" onClick={handleOverlayClick}>
      <div className="confirm-dialog">
        <div className="dialog-header">
          {getIcon()}
          <h3 className="dialog-title">{title}</h3>
        </div>
        
        <div className="dialog-content">
          <p className="dialog-message">{message}</p>
        </div>
        
        <div className="dialog-actions">
          <button
            className="dialog-button cancel-button"
            onClick={onClose}
          >
            <IoCloseOutline />
            {cancelText}
          </button>
          <button
            className={`dialog-button confirm-button ${type}`}
            onClick={onConfirm}
          >
            <IoCheckmarkOutline />
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}