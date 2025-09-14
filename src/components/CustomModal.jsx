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

// 新增管理員表單模態框
export const AdminFormModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "新增管理員",
  loading = false
}) => {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    confirmPassword: '',
    role: 'admin'
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // 重置表單
  useEffect(() => {
    if (isOpen) {
      setFormData({
        email: '',
        name: '',
        password: '',
        confirmPassword: '',
        role: 'admin'
      });
      setErrors({});
    }
  }, [isOpen]);

  // 表單驗證
  const validateForm = () => {
    const newErrors = {};

    // 驗證郵箱
    if (!formData.email.trim()) {
      newErrors.email = '郵箱為必填項目';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = '郵箱格式不正確';
      }
    }

    // 驗證姓名（非必填，但如果填了要檢查長度）
    if (formData.name.trim() && formData.name.length > 50) {
      newErrors.name = '姓名不能超過50個字符';
    }

    // 驗證密碼
    if (!formData.password) {
      newErrors.password = '密碼為必填項目';
    } else if (formData.password.length < 6) {
      newErrors.password = '密碼至少需要6個字符';
    }

    // 驗證確認密碼
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = '請確認密碼';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '兩次輸入的密碼不一致';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 處理輸入變更
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // 清除該欄位的錯誤
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  // 處理表單提交
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      await onConfirm({
        email: formData.email.trim(),
        name: formData.name.trim(),
        password: formData.password,
        role: formData.role
      });
    } catch (error) {
      console.error('提交表單時發生錯誤:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} title={title} size="medium">
      <form onSubmit={handleSubmit} className="admin-form">
        <div className="form-group">
          <label htmlFor="email">電子郵件 *</label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="請輸入郵箱地址"
            className={errors.email ? 'error' : ''}
            disabled={submitting || loading}
            autoFocus
          />
          {errors.email && <span className="error-message">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="name">姓名</label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="請輸入姓名（選填，未填將使用郵箱前綴）"
            className={errors.name ? 'error' : ''}
            disabled={submitting || loading}
            maxLength={50}
          />
          {errors.name && <span className="error-message">{errors.name}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="password">密碼 *</label>
          <input
            type="password"
            id="password"
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            placeholder="請輸入密碼（至少6個字符）"
            className={errors.password ? 'error' : ''}
            disabled={submitting || loading}
            minLength={6}
          />
          {errors.password && <span className="error-message">{errors.password}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">確認密碼 *</label>
          <input
            type="password"
            id="confirmPassword"
            value={formData.confirmPassword}
            onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
            placeholder="請再次輸入密碼"
            className={errors.confirmPassword ? 'error' : ''}
            disabled={submitting || loading}
          />
          {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="role">權限等級</label>
          <select
            id="role"
            value={formData.role}
            onChange={(e) => handleInputChange('role', e.target.value)}
            disabled={submitting || loading}
          >
            <option value="admin">一般管理員</option>
            <option value="super_admin">超級管理員</option>
          </select>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={submitting || loading}
          >
            取消
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || loading}
          >
            {submitting || loading ? '新增中...' : '新增管理員'}
          </button>
        </div>
      </form>
    </CustomModal>
  );
};

export default CustomModal;