import React, { useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { motion } from "framer-motion";
import { IoCloseOutline } from "react-icons/io5";
import "./QRScannerModal.css";

export default function QRScannerModal({ onScan, onClose }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        // 優先使用後鏡頭
        videoConstraints: {
          facingMode: { ideal: "environment" }
        }
      },
      false
    );

    scanner.render(
      (decodedText) => {
        scanner.clear().then(onClose);
        onScan(decodedText);
      },
      (error) => {
        // 掃描過程中的錯誤可略過
      }
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [onScan, onClose]);

  return (
    <motion.div
      className="qr-scanner-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="qr-scanner-modal"
        initial={{ scale: 0.9, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 50 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="qr-scanner-header">
          <h3>掃描房號 QR Code</h3>
          <button className="qr-scanner-close" onClick={onClose}>
            <IoCloseOutline />
          </button>
        </div>
        <div className="qr-scanner-content">
          <div id="qr-reader" ref={scannerRef} />
          <p className="qr-scanner-hint">將 QR Code 對準框內進行掃描</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
