import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, AlertCircle, RefreshCw } from 'lucide-react';
import { playBeep } from '../../lib/utils';

interface CameraBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (barcode: string) => void;
}

export const CameraBarcodeScannerModal: React.FC<CameraBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const scannerId = 'camera-barcode-reader';

    const startCamera = async () => {
      try {
        setIsStarting(true);
        setError(null);

        // Allow DOM node to render
        await new Promise((res) => setTimeout(res, 200));

        if (!document.getElementById(scannerId)) return;

        const html5QrCode = new Html5Qrcode(scannerId);
        qrScannerRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.3333,
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (isMounted) {
              playBeep('scan');
              onScanSuccess(decodedText);
              html5QrCode.stop().then(() => {
                onClose();
              }).catch(() => {
                onClose();
              });
            }
          },
          () => {
            // Frame scan failure (quietly keep searching)
          }
        );

        if (isMounted) {
          setIsStarting(false);
        }
      } catch (err: any) {
        console.error('Camera Scanner Error:', err);
        if (isMounted) {
          setError(
            err?.message?.includes('Permission') 
              ? 'Camera permission denied. Please allow camera access in browser.'
              : 'Could not access camera. Ensure your webcam is connected or try another device.'
          );
          setIsStarting(false);
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      if (qrScannerRef.current) {
        try {
          if (qrScannerRef.current.isScanning) {
            qrScannerRef.current.stop().catch(() => {});
          }
          qrScannerRef.current.clear();
        } catch (e) {
          // ignore cleanup err
        }
        qrScannerRef.current = null;
      }
    };
  }, [isOpen, onScanSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#121212] border border-[#D4AF37]/30 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D4AF37]/15 bg-[#171717]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#D4AF37]/15 text-[#D4AF37]">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Live Camera Barcode Scanner</h3>
              <p className="text-xs text-[#B8B8B8]">Point product barcode inside the box</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Viewport */}
        <div className="p-6 flex flex-col items-center">
          
          {error ? (
            <div className="w-full p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Camera Notice</p>
                <p className="text-xs text-red-300/80 mt-1">{error}</p>
                <p className="text-xs text-gray-400 mt-2">
                  (Tip: For demo, you can also use a physical USB Barcode Gun or click any product in the Quick-Zap tray!)
                </p>
              </div>
            </div>
          ) : (
            <div className="relative w-full bg-black rounded-xl overflow-hidden border border-[#D4AF37]/20 flex flex-col items-center justify-center min-h-[260px]">
              {isStarting && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0a0a0a] gap-2 text-sm text-[#D4AF37]">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#D4AF37]" />
                  <span>Activating camera optical sensor...</span>
                </div>
              )}
              <div id="camera-barcode-reader" className="w-full"></div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 text-xs text-[#B8B8B8] text-center">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Real-time continuous decoding active (EAN-13, CODE128, UPC-A, QR)</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#D4AF37]/15 bg-[#161616]">
          <span className="text-xs text-gray-400">Audio beep chime enabled</span>
          <button
            onClick={onClose}
            className="btn-dark text-xs py-1.5 px-4"
          >
            Close Scanner
          </button>
        </div>

      </div>
    </div>
  );
};
