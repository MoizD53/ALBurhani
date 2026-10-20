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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-white border border-[#E8DEC8] shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8DEC8] bg-[#FAF8F5]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#FBF7EE] text-[#A67D0C] border border-[#C99A18]/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900">Live Camera Barcode Scanner</h3>
              <p className="text-xs text-stone-500">Point product barcode inside the box</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Viewport */}
        <div className="p-6 flex flex-col items-center bg-white">
          
          {error ? (
            <div className="w-full p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Camera Notice</p>
                <p className="text-xs text-rose-700 mt-1">{error}</p>
                <p className="text-xs text-stone-500 mt-2">
                  (Tip: For demo, you can also use a physical USB Barcode Gun or click any product in the Quick-Zap tray!)
                </p>
              </div>
            </div>
          ) : (
            <div className="relative w-full bg-stone-900 rounded-xl overflow-hidden border border-[#E8DEC8] flex flex-col items-center justify-center min-h-[260px]">
              {isStarting && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-stone-900/90 gap-2 text-sm text-[#D4AF37]">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#D4AF37]" />
                  <span>Activating camera optical sensor...</span>
                </div>
              )}
              <div id="camera-barcode-reader" className="w-full"></div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 text-xs text-stone-600 text-center">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Real-time continuous decoding active (EAN-13, CODE128, UPC-A, QR)</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E8DEC8] bg-[#FAF8F5]">
          <span className="text-xs text-stone-500">Audio beep chime enabled</span>
          <button
            onClick={onClose}
            className="btn-dark text-xs py-1.5 px-4 font-semibold"
          >
            Close Scanner
          </button>
        </div>

      </div>
    </div>
  );
};
