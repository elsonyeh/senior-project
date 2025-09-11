import React from 'react';
import { IoArrowBackOutline } from 'react-icons/io5';
import './PageWrapper.css';

export default function PageWrapper({ title, onBack, children }) {
  return (
    <div className="page-wrapper">
      {/* 頂部標題區域 */}
      <div className="page-header">
        <button className="back-button" onClick={onBack}>
          <IoArrowBackOutline />
        </button>
        <h1 className="page-title">{title}</h1>
        <div className="header-spacer"></div>
      </div>

      {/* 內容區域 */}
      <div className="page-content">
        {children}
      </div>
    </div>
  );
}