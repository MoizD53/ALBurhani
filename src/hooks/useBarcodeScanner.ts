import { useEffect, useRef } from 'react';

export interface ScanMetadata {
  barcode: string;
  suffix: 'Enter' | 'Tab' | 'None';
  elapsedMs: number;
  charCount: number;
  avgIntervalMs: number;
}

export interface UseBarcodeScannerProps {
  onScan: (barcode: string, meta?: ScanMetadata) => void;
  minChars?: number;
  maxIntervalMs?: number;
  enabled?: boolean;
  supportTabSuffix?: boolean;
  supportNoSuffix?: boolean;
  noSuffixTimeoutMs?: number;
}

/**
 * Universal Hardware Barcode Scanner Listener
 * 
 * Supports standard USB HID Keyboard and Keyboard-Wedge scanners across all brands:
 * 1. Handles Enter suffix (Carriage Return \r / \n)
 * 2. Handles Tab suffix (\t) without shifting focus to unintended fields
 * 3. Handles No-suffix scanners via rapid-burst interval detection
 * 4. Preserves barcode strings exactly, including leading zeros (e.g. '0001')
 * 5. Bypasses regular form fields so cashier typing in customer/search fields is never hijacked
 */
export function useBarcodeScanner({
  onScan,
  minChars = 2,
  maxIntervalMs = 70,
  enabled = true,
  supportTabSuffix = true,
  supportNoSuffix = true,
  noSuffixTimeoutMs = 95,
}: UseBarcodeScannerProps) {
  const buffer = useRef<string>('');
  const timestamps = useRef<number[]>([]);
  const lastKeyTime = useRef<number>(0);
  const timeoutId = useRef<any>(null);

  useEffect(() => {
    if (!enabled) return;

    const clearSuffixTimeout = () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
        timeoutId.current = null;
      }
    };

    const emitScan = (code: string, suffix: 'Enter' | 'Tab' | 'None') => {
      clearSuffixTimeout();
      const trimmed = code.trim();
      if (trimmed.length >= minChars) {
        const times = timestamps.current;
        const elapsedMs = times.length > 1 ? times[times.length - 1] - times[0] : 0;
        const avgIntervalMs = times.length > 1 ? Math.round(elapsedMs / (times.length - 1)) : 0;

        onScan(trimmed, {
          barcode: trimmed,
          suffix,
          elapsedMs,
          charCount: trimmed.length,
          avgIntervalMs,
        });
      }
      buffer.current = '';
      timestamps.current = [];
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      const isBarcodeInput = target && target.getAttribute('data-barcode-input') === 'true';

      // Never intercept regular user form fields (customer name, customer phone, search query, etc.)
      if (isInput && !isBarcodeInput) {
        return;
      }

      const now = Date.now();
      const diff = now - lastKeyTime.current;

      // 1. Terminating Suffix: Enter
      if (e.key === 'Enter') {
        clearSuffixTimeout();
        if (buffer.current.length >= minChars) {
          e.preventDefault();
          e.stopPropagation();
          emitScan(buffer.current, 'Enter');
        } else {
          buffer.current = '';
          timestamps.current = [];
        }
        return;
      }

      // 2. Terminating Suffix: Tab
      if (e.key === 'Tab' && supportTabSuffix) {
        clearSuffixTimeout();
        if (buffer.current.length >= minChars) {
          e.preventDefault();
          e.stopPropagation();
          emitScan(buffer.current, 'Tab');
          return;
        } else {
          buffer.current = '';
          timestamps.current = [];
        }
        return;
      }

      // 3. Printable Single Character Input
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        clearSuffixTimeout();

        // If delay between keystrokes exceeds maxIntervalMs, reset buffer (broken/slow human typing)
        if (diff > maxIntervalMs && buffer.current.length > 0) {
          buffer.current = '';
          timestamps.current = [];
        }

        lastKeyTime.current = now;
        buffer.current += e.key;
        timestamps.current.push(now);

        // 4. Suffix-free Termination: Detect scanner burst completion via timeout
        if (supportNoSuffix) {
          timeoutId.current = setTimeout(() => {
            const currentBuf = buffer.current;
            const times = timestamps.current;
            if (currentBuf.length >= minChars && times.length >= 2) {
              const totalElapsed = times[times.length - 1] - times[0];
              const avgInterval = totalElapsed / (times.length - 1);
              // Only trigger if typing speed matches genuine hardware scanner burst
              if (avgInterval <= maxIntervalMs) {
                emitScan(currentBuf, 'None');
                return;
              }
            }
            buffer.current = '';
            timestamps.current = [];
          }, noSuffixTimeoutMs);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearSuffixTimeout();
    };
  }, [onScan, minChars, maxIntervalMs, enabled, supportTabSuffix, supportNoSuffix, noSuffixTimeoutMs]);
}
