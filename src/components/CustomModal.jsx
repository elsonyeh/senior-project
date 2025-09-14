import React, { useState, useEffect } from 'react';
import './CustomModal.css';

const CustomModal = ({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton = true,
  size = 'medium' // small, medium, large
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // 清理函數
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="custom-modal-overlay" onClick={handleBackdropClick}>
      <div className={`custom-modal ${size}`}>
        <div className="custom-modal-header">
          <h3 className="custom-modal-title">{title}</h3>
          {showCloseButton && (
            <button className="custom-modal-close" onClick={onClose}>
              ×
            </button>
          )}
        </div>
        <div className="custom-modal-content">
          {children}
        </div>
      </div>
    </div>
  );
};

// 輸入框組件
export const InputModal = ({
  isOpen,
  onClose,
  title,
  label,
  placeholder,
  defaultValue = '',
  onConfirm,
  confirmText = '確認',
  cancelText = '取消',
  validation,
  maxLength = 100
}) => {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen, defaultValue]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    // 輸入驗證
    if (!value.trim()) {
      setError('此欄位不能為空');
      return;
    }

    if (validation) {
      const validationResult = validation(value.trim());
      if (validationResult !== true) {
        setError(validationResult);
        return;
      }
    }

    setError('');
    setIsSubmitting(true);

    try {
      await onConfirm(value.trim());
    } catch (error) {
      setError(error.message || '操作失敗，請稍後重試');
      setIsSubmitting(false);
    }
  };

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} title={title} size="small">
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label">{label}</label>
          <input
            type="text"
            className={`custom-input ${error ? 'error' : ''}`}
            placeholder={placeholder}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(''); // 清除錯誤
            }}
            maxLength={maxLength}
            disabled={isSubmitting}
            autoFocus
          />
          {error && <div className="input-error">{error}</div>}
          <div className="input-counter">
            {value.length}/{maxLength}
          </div>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {cancelText}
          </button>
          <button
            type="submit"
            className={`btn btn-primary ${isSubmitting ? 'loading' : ''}`}
            disabled={isSubmitting || !value.trim()}
          >
            {isSubmitting ? '處理中...' : confirmText}
          </button>
        </div>
      </form>
    </CustomModal>
  );
};

// 確認對話框組件
export const ConfirmModal = ({
  isOpen,
  onClose,
  title,
  message,
  onConfirm,
  confirmText = '確認',
  cancelText = '取消',
  type = 'default' // default, warning, danger
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error('Confirm action failed:', error);
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
    }
  }, [isOpen]);

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} title={title} size="small">
      <div className="confirm-content">
        <div className={`confirm-icon ${type}`}>
          {type === 'warning' && '⚠️'}
          {type === 'danger' && '🚨'}
          {type === 'default' && '❓'}
        </div>
        <p className="confirm-message">{message}</p>
      </div>

      <div className="modal-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onClose}
          disabled={isSubmitting}
        >
          {cancelText}
        </button>
        <button
          type="button"
          className={`btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'} ${isSubmitting ? 'loading' : ''}`}
          onClick={handleConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting ? '處理中...' : confirmText}
        </button>
      </div>
    </CustomModal>
  );
};

// 通知組件
export const NotificationModal = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'success', // success, error, info, warning
  autoClose = true,
  autoCloseDelay = 3000
}) => {
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, autoCloseDelay, onClose]);

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} title={title} size="small">
      <div className="notification-content">
        <div className={`notification-icon ${type}`}>
          {type === 'success' && '✅'}
          {type === 'error' && '❌'}
          {type === 'info' && 'ℹ️'}
          {type === 'warning' && '⚠️'}
        </div>
        <p className="notification-message">{message}</p>
      </div>

      <div className="modal-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onClose}
        >
          確認
        </button>
      </div>
    </CustomModal>
  );
};

export default CustomModal;