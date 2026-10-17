import { useEffect, useRef } from 'react';

interface UseBarcodeScannerProps {
  onScan: (barcode: string) => void;
  minChars?: number;
  maxIntervalMs?: number;
  enabled?: boolean;
}

/**
 * Universal Hardware Barcode Scanner Listener
 * Listens for rapid sequential keystrokes emitted by USB/Bluetooth HID Barcode Scanners.
 */
export function useBarcodeScanner({
  onScan,
  minChars = 4,
  maxIntervalMs = 60,
  enabled = true
}: UseBarcodeScannerProps) {
  const buffer = useRef<string>('');
  const lastKeyTime = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in regular text inputs (unless it's the dedicated barcode input)
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      const isBarcodeInput = target.getAttribute('data-barcode-input') === 'true';

      if (isInput && !isBarcodeInput) {
        return;
      }

      const now = Date.now();
      const diff = now - lastKeyTime.current;

      // Scanners type with < 50ms interval between characters
      if (diff > maxIntervalMs && buffer.current.length > 0) {
        buffer.current = ''; // Reset buffer if typing too slow
      }

      lastKeyTime.current = now;

      if (e.key === 'Enter') {
        const barcode = buffer.current.trim();
        if (barcode.length >= minChars) {
          e.preventDefault();
          onScan(barcode);
        }
        buffer.current = '';
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        buffer.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan, minChars, maxIntervalMs, enabled]);
}
