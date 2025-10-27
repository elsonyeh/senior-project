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
    let IconComponent;
    switch (type) {
      case 'success':
        IconComponent = IoCheckmarkCircleOutline;
        break;
      case 'warning':
        IconComponent = IoWarningOutline;
        break;
      case 'error':
        IconComponent = IoCloseCircleOutline;
        break;
      default:
        IconComponent = IoInformationCircleOutline;
    }
    return (
      <div className="toast-icon-wrapper">
        <IconComponent className="toast-icon-svg" />
      </div>
    );
  };

  return (
    <div className={`toast-container ${type}`}>
      {getIcon()}
      <div className="toast-message">{message}</div>
    </div>
  );
}
