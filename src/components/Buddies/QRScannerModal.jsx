import React, { useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function QRScannerModal({ onScan, onClose }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: 200 },
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
    <div style={{ marginTop: "1rem" }}>
      <div id="qr-reader" ref={scannerRef} />
    </div>
  );
}
