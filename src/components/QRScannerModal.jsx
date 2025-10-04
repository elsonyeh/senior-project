import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { motion } from "framer-motion";
import { IoCloseOutline } from "react-icons/io5";
import "./QRScannerModal.css";

export default function QRScannerModal({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let html5QrCode = null;
    let mounted = true;

    const initScanner = async () => {
      console.log("🎥 開始初始化 QR 掃描器...");

      // 等待 DOM 完全準備好（包括動畫完成）
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!mounted) {
        console.log("⚠️ 組件已卸載，取消初始化");
        return;
      }

      // 確認 DOM 元素存在
      const element = document.getElementById("qr-reader");
      if (!element) {
        console.error("❌ 找不到 #qr-reader 元素");
        setError("初始化失敗：找不到掃描器容器");
        return;
      }

      console.log("✅ 找到 #qr-reader 元素");

      try {
        // 使用 Html5Qrcode（只有相機模式）
        html5QrCode = new Html5Qrcode("qr-reader");
        console.log("✅ 掃描器物件創建成功");

        // 獲取相機設備
        const devices = await Html5Qrcode.getCameras();
        console.log("📷 找到相機設備:", devices.length);

        if (devices && devices.length === 0) {
          setError("找不到相機設備");
          return;
        }

        // 優先使用後置相機
        let cameraId = devices[0].id;
        for (const device of devices) {
          if (device.label.toLowerCase().includes('back') ||
              device.label.toLowerCase().includes('rear') ||
              device.label.toLowerCase().includes('後')) {
            cameraId = device.id;
            break;
          }
        }

        console.log("🎬 開始啟動相機...", cameraId);

        // 啟動相機掃描
        await html5QrCode.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          // 成功掃描回調
          (decodedText, decodedResult) => {
            console.log("✅ QR Code 掃描成功:", decodedText);
            if (mounted && html5QrCode) {
              html5QrCode.stop().then(() => {
                onScan(decodedText);
                onClose();
              }).catch(console.error);
            }
          },
          // 錯誤回調（可忽略）
          (errorMessage) => {
            // 掃描過程中的錯誤可略過
          }
        );

        console.log("✅ 相機已啟動");
        setScanning(true);
        setError("");

      } catch (err) {
        console.error("❌ 初始化掃描器失敗:", err);
        if (!mounted) return;

        if (err.name === 'NotAllowedError') {
          setError("請允許使用相機權限以掃描 QR Code");
        } else if (err.name === 'NotFoundError') {
          setError("找不到相機設備");
        } else if (err.name === 'NotReadableError') {
          setError("相機正被其他應用程式使用");
        } else if (err.name === 'NotSupportedError') {
          setError("您的瀏覽器不支援相機功能，請使用 HTTPS 或 localhost");
        } else {
          setError(`相機錯誤: ${err.message || '未知錯誤'}`);
        }
      }
    };

    initScanner();

    return () => {
      console.log("🧹 清理掃描器...");
      mounted = false;
      if (html5QrCode && scanning) {
        html5QrCode.stop().catch((err) => {
          console.warn("停止掃描器時發生錯誤:", err);
        });
      }
    };
  }, [onScan, onClose, scanning]);

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
              {scanning ? (
                <p className="qr-scanner-hint">將 QR Code 對準框內進行掃描</p>
              ) : (
                <p className="qr-scanner-hint">正在啟動相機...</p>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
