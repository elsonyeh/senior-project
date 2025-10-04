import React, { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { motion } from "framer-motion";
import { IoCloseOutline } from "react-icons/io5";
import "./QRScannerModal.css";

export default function QRScannerModal({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const [error, setError] = useState("");
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    let scanner = null;

    const initScanner = async () => {
      try {
        // 先請求相機權限
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } }
        });

        // 權限獲取成功，立即關閉測試流
        stream.getTracks().forEach(track => track.stop());
        setPermissionGranted(true);
        setError("");

        // 初始化掃描器
        scanner = new Html5QrcodeScanner(
          "qr-reader",
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            videoConstraints: {
              facingMode: { ideal: "environment" }
            },
            rememberLastUsedCamera: true,
            showTorchButtonIfSupported: true
          },
          false
        );

        scanner.render(
          (decodedText) => {
            scanner.clear().then(() => {
              onScan(decodedText);
              onClose();
            }).catch(console.error);
          },
          (scanError) => {
            // 掃描過程中的錯誤可略過（如找不到 QR Code）
            console.debug("Scan error:", scanError);
          }
        );
      } catch (err) {
        console.error("相機初始化失敗:", err);
        if (err.name === 'NotAllowedError') {
          setError("請允許使用相機權限以掃描 QR Code");
        } else if (err.name === 'NotFoundError') {
          setError("找不到相機設備");
        } else if (err.name === 'NotReadableError') {
          setError("相機正被其他應用程式使用");
        } else {
          setError(`相機錯誤: ${err.message || '未知錯誤'}`);
        }
      }
    };

    initScanner();

    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
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
          {error ? (
            <div className="qr-scanner-error">
              <div className="error-icon">⚠️</div>
              <p className="error-message">{error}</p>
              <button className="retry-button" onClick={() => window.location.reload()}>
                重新載入頁面
              </button>
              <p className="error-hint">
                提示：請確保已在瀏覽器設定中允許此網站使用相機
              </p>
            </div>
          ) : (
            <>
              <div id="qr-reader" ref={scannerRef} />
              {permissionGranted ? (
                <p className="qr-scanner-hint">將 QR Code 對準框內進行掃描</p>
              ) : (
                <p className="qr-scanner-hint">正在請求相機權限...</p>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
