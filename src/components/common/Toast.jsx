import React, { useEffect } from 'react';
import { IoWarningOutline, IoCheckmarkCircleOutline, IoInformationCircleOutline, IoCloseCircleOutline } from 'react-icons/io5';
import './Toast.css';

export default function Toast({
  isOpen,
  onClose,
  message,
  type = 'info', // info, success, warning, error
  duration = 3000
}) {
  useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <IoCheckmarkCircleOutline />;
      case 'warning':
        return <IoWarningOutline />;
      case 'error':
        return <IoCloseCircleOutline />;
      default:
        return <IoInformationCircleOutline />;
    }
  };

  return (
    <div className={`toast-container ${type}`}>
      <div className="toast-icon">
        {getIcon()}
      </div>
      <div className="toast-message">{message}</div>
    </div>
  );
}
