"use client";
import { useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  paused: boolean;
}

export default function QRScanner({ onScan, paused }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isRunningRef = useRef(false);
  const pausedRef = useRef(paused);

  pausedRef.current = paused;

  const handleScan = useCallback(
    (decodedText: string) => {
      if (!pausedRef.current) {
        onScan(decodedText);
      }
    },
    [onScan]
  );

  useEffect(() => {
    const elementId = "qr-scanner-region";

    if (!containerRef.current || isRunningRef.current) return;

    const scanner = new Html5Qrcode(elementId);
    scannerRef.current = scanner;
    isRunningRef.current = true;

    scanner
      .start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        handleScan,
        () => {} // ignore scan errors (no QR found in frame)
      )
      .catch((err) => {
        console.error("QR Scanner failed to start:", err);
        isRunningRef.current = false;
      });

    return () => {
      if (scanner.isScanning) {
        scanner
          .stop()
          .then(() => {
            isRunningRef.current = false;
          })
          .catch(() => {
            isRunningRef.current = false;
          });
      } else {
        isRunningRef.current = false;
      }
    };
  }, [handleScan]);

  return (
    <div ref={containerRef}>
      <div id="qr-scanner-region" className="w-full" />
    </div>
  );
}
