import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, AlertCircle, RefreshCw, CheckCircle2, ShieldCheck } from 'lucide-react';
import { playBeep } from '../../lib/utils';
import { ALL_SUPPORTED_BARCODE_FORMATS } from '../../lib/barcodeFormats';

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
  const isStoppingRef = useRef(false);
  const lastScannedRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    isStoppingRef.current = false;
    const scannerId = 'camera-barcode-reader';

    const startCamera = async () => {
      try {
        setIsStarting(true);
        setError(null);

        // Allow DOM node to render
        await new Promise((res) => setTimeout(res, 200));

        if (!document.getElementById(scannerId)) return;

        // Comprehensive barcode symbologies for Phones & Tablets:
        // Enables all 17 genuinely supported formats from html5-qrcode
        const html5QrCode = new Html5Qrcode(scannerId, {
          formatsToSupport: ALL_SUPPORTED_BARCODE_FORMATS,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
          verbose: false,
        });
        qrScannerRef.current = html5QrCode;

        const config = {
          fps: 20,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            // Wide scanning box suited for 1D product barcodes (88% width)
            const width = Math.floor(viewfinderWidth * 0.88);
            const height = Math.floor(Math.min(viewfinderHeight * 0.65, 220));
            return { width: Math.max(width, 240), height: Math.max(height, 140) };
          },
          aspectRatio: 1.3333,
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (!isMounted || isStoppingRef.current) return;

            const now = Date.now();
            // Suppress rapid duplicate frames for the same decoded barcode
            if (lastScannedRef.current.code === decodedText && now - lastScannedRef.current.time < 1500) {
              return;
            }

            isStoppingRef.current = true;
            lastScannedRef.current = { code: decodedText, time: now };

            playBeep('scan');
            onScanSuccess(decodedText);

            html5QrCode
              .stop()
              .catch(() => {})
              .finally(() => {
                if (isMounted) {
                  onClose();
                }
              });
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
          const errMsg = err?.message || String(err);
          let userFacingError = 'Could not access camera. Ensure your webcam is connected or try another device.';
          if (errMsg.includes('Permission') || errMsg.includes('NotAllowedError') || errMsg.includes('denied')) {
            userFacingError = 'Camera permission denied. Please allow camera access in browser settings.';
          } else if (errMsg.includes('NotFound') || errMsg.includes('DevicesNotFoundError')) {
            userFacingError = 'No camera found on this device. Please connect a webcam or use a phone/tablet.';
          } else if (errMsg.includes('NotReadable') || errMsg.includes('TrackStartError')) {
            userFacingError = 'Camera is currently in use by another tab or app. Please close other camera apps and retry.';
          }
          setError(userFacingError);
          setIsStarting(false);
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      isStoppingRef.current = true;
      if (qrScannerRef.current) {
        const scanner = qrScannerRef.current;
        qrScannerRef.current = null;
        try {
          if (scanner.isScanning) {
            scanner
              .stop()
              .catch(() => {})
              .finally(() => {
                try {
                  scanner.clear();
                } catch {}
              });
          } else {
            scanner.clear();
          }
        } catch (e) {
          // ignore cleanup err
        }
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
              <p className="text-xs text-stone-500">Universal recognition: 1D Retail & 2D Matrix</p>
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
                  (Tip: You can also use a physical USB/Bluetooth Barcode Scanner or type barcodes manually in POS!)
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

          {/* Formats status badge */}
          <div className="mt-4 flex flex-col items-center gap-1 text-center">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>17 Universal Formats Enabled (EAN-13, EAN-8, UPC, Code 128, Code 39, ITF, QR, Data Matrix)</span>
            </div>
            <span className="text-[11px] text-stone-400">Point phone/tablet camera 10–20 cm away in steady lighting</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E8DEC8] bg-[#FAF8F5]">
          <span className="text-xs text-stone-500 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#A67D0C]" />
            Audio beep on detection
          </span>
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
