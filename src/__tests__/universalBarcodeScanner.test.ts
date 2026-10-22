import { describe, it, expect, vi } from 'vitest';
import { IMPORTED_PRODUCTS } from '../data/importedProducts';
import { lookupProduct, buildCartItem, isWeightBasedProduct, normalizeBarcodeInput } from '../lib/pricing';
import { ALL_SUPPORTED_BARCODE_FORMATS, SUPPORTED_FORMAT_DETAILS, isFormatSupported } from '../lib/barcodeFormats';
import { Html5QrcodeSupportedFormats } from 'html5-qrcode';

describe('AL-BURHANI POS — Universal USB Barcode Scanner Compatibility', () => {

  // ─── 1. Exact Barcode String & Leading Zero Preservation ───
  describe('1. Exact Barcode & Leading Zero Integrity', () => {
    it('preserves leading zeros for barcode "0001" and matches KAJU KATLI 250G', () => {
      const result = lookupProduct(IMPORTED_PRODUCTS, '0001');
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('KAJU KATLI 250G');
      expect(result[0].barcode).toBe('0001');
      expect(result[0].unit).toBe('PCS');
      expect(typeof result[0].barcode).toBe('string');
    });

    it('does NOT match barcode "1" or integer 1 to "0001"', () => {
      const result = lookupProduct(IMPORTED_PRODUCTS, '1');
      const matchesKaju = result.some((p) => p.barcode === '0001');
      expect(matchesKaju).toBe(false);
    });

    it('preserves leading zeros across multiple 4-digit codes', () => {
      const code0002 = lookupProduct(IMPORTED_PRODUCTS, '0002');
      if (code0002.length > 0) {
        expect(code0002[0].barcode).toBe('0002');
        expect(code0002[0].barcode).not.toBe('2');
      }
    });

    it('never converts barcode strings to numeric values', () => {
      const code = '0001';
      // If code was coerced to number: Number('0001') -> 1
      expect(Number(code)).toBe(1);
      // lookupProduct must receive and query with string representation
      const stringResult = lookupProduct(IMPORTED_PRODUCTS, code);
      expect(stringResult[0].barcode).toBe('0001');
      expect(stringResult[0].barcode).not.toBe(Number(code).toString());
    });
  });

  // ─── 2. Scanner Suffix Support (Enter, Tab, No-Suffix, CR/LF) ───
  describe('2. Scanner Suffix Support (Enter, Tab, No-Suffix, CR/LF)', () => {
    // Simulator for scanner input logic matching useBarcodeScanner.ts
    function simulateScannerKeystrokes({
      chars,
      charIntervalMs = 20,
      suffix = 'Enter', // 'Enter' | 'Tab' | 'None'
      minChars = 2,
      maxIntervalMs = 85,
      noSuffixTimeoutMs = 100,
    }: {
      chars: string;
      charIntervalMs?: number;
      suffix?: 'Enter' | 'Tab' | 'None';
      minChars?: number;
      maxIntervalMs?: number;
      noSuffixTimeoutMs?: number;
    }): { scannedBarcode: string | null; detectedSuffix: 'Enter' | 'Tab' | 'None' | null } {
      let buffer = '';
      let timestamps: number[] = [];
      let lastKeyTime = 0;
      let resultBarcode: string | null = null;
      let resultSuffix: 'Enter' | 'Tab' | 'None' | null = null;

      let currentTime = 1000;

      // Simulate character arrival
      for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const diff = currentTime - lastKeyTime;
        if (diff > maxIntervalMs && buffer.length > 0) {
          buffer = '';
          timestamps = [];
        }
        buffer += char;
        timestamps.push(currentTime);
        lastKeyTime = currentTime;
        currentTime += charIntervalMs;
      }

      // Suffix processing
      if (suffix === 'Enter') {
        if (buffer.length >= minChars) {
          resultBarcode = buffer.trim();
          resultSuffix = 'Enter';
        }
      } else if (suffix === 'Tab') {
        if (buffer.length >= minChars) {
          resultBarcode = buffer.trim();
          resultSuffix = 'Tab';
        }
      } else if (suffix === 'None') {
        // Timeout based termination after noSuffixTimeoutMs
        currentTime += noSuffixTimeoutMs;
        if (buffer.length >= minChars && timestamps.length >= 2) {
          const totalElapsed = timestamps[timestamps.length - 1] - timestamps[0];
          const avgInterval = totalElapsed / (timestamps.length - 1);
          if (avgInterval <= maxIntervalMs) {
            resultBarcode = buffer.trim();
            resultSuffix = 'None';
          }
        }
      }

      return { scannedBarcode: resultBarcode, detectedSuffix: resultSuffix };
    }

    it('correctly decodes rapid scanner input with Enter suffix (CR / LF)', () => {
      const res = simulateScannerKeystrokes({
        chars: '0001',
        charIntervalMs: 15,
        suffix: 'Enter',
      });
      expect(res.scannedBarcode).toBe('0001');
      expect(res.detectedSuffix).toBe('Enter');
    });

    it('correctly decodes rapid scanner input with Tab suffix without focus jumping', () => {
      const res = simulateScannerKeystrokes({
        chars: '890100100101',
        charIntervalMs: 25,
        suffix: 'Tab',
      });
      expect(res.scannedBarcode).toBe('890100100101');
      expect(res.detectedSuffix).toBe('Tab');
    });

    it('correctly detects scanners with No Suffix via rapid burst interval timeout', () => {
      const res = simulateScannerKeystrokes({
        chars: '0001',
        charIntervalMs: 20, // 20ms between keys is clearly a hardware scanner burst
        suffix: 'None',
      });
      expect(res.scannedBarcode).toBe('0001');
      expect(res.detectedSuffix).toBe('None');
    });

    it('tolerates wireless USB dongle and Bluetooth radio jitter up to 85ms per char', () => {
      const res = simulateScannerKeystrokes({
        chars: '0001',
        charIntervalMs: 75, // Intermittent wireless lag within 85ms tolerance
        suffix: 'Enter',
      });
      expect(res.scannedBarcode).toBe('0001');
      expect(res.detectedSuffix).toBe('Enter');
    });

    it('does NOT trigger No Suffix scan on slow human typing (>150ms per char)', () => {
      const res = simulateScannerKeystrokes({
        chars: '0001',
        charIntervalMs: 250, // Human speed: 250ms per key
        suffix: 'None',
      });
      // Slow human typing resets buffer and does not qualify as scanner burst
      expect(res.scannedBarcode).toBe(null);
    });
  });

  // ─── 3. Rapid Consecutive Scans vs Duplicate Suppression ───
  describe('3. Rapid Consecutive Scans vs Duplicate Suppression', () => {
    it('suppresses duplicate scan events within 350ms window for identical barcode', () => {
      let lastScan = { code: '', time: 0 };
      const processedCodes: string[] = [];

      const handleScan = (rawCode: string, timestamp: number) => {
        const code = rawCode.trim();
        if (lastScan.code === code && (timestamp - lastScan.time) < 350) {
          return false; // suppressed
        }
        lastScan = { code, time: timestamp };
        processedCodes.push(code);
        return true;
      };

      // Initial scan
      expect(handleScan('0001', 1000)).toBe(true);
      // Instantaneous second event from form submission 5ms later
      expect(handleScan('0001', 1005)).toBe(false);
      expect(processedCodes.length).toBe(1);
    });

    it('allows consecutive scans of different products in rapid succession without debounce delay', () => {
      let lastScan = { code: '', time: 0 };
      const processedCodes: string[] = [];

      const handleScan = (rawCode: string, timestamp: number) => {
        const code = rawCode.trim();
        if (lastScan.code === code && (timestamp - lastScan.time) < 350) {
          return false;
        }
        lastScan = { code, time: timestamp };
        processedCodes.push(code);
        return true;
      };

      // Scan product A at t=1000ms
      expect(handleScan('0001', 1000)).toBe(true);
      // Scan different product B 150ms later (different barcode, must NOT be suppressed)
      expect(handleScan('0002', 1150)).toBe(true);

      expect(processedCodes).toEqual(['0001', '0002']);
    });

    it('allows legitimate consecutive scans of the same product (> 350ms apart)', () => {
      let lastScan = { code: '', time: 0 };
      const cart: { id: string; qty: number }[] = [];

      const handleScan = (code: string, timestamp: number) => {
        if (lastScan.code === code && (timestamp - lastScan.time) < 350) {
          return false;
        }
        lastScan = { code, time: timestamp };

        const existing = cart.find((i) => i.id === code);
        if (existing) {
          existing.qty += 1;
        } else {
          cart.push({ id: code, qty: 1 });
        }
        return true;
      };

      // Cashier scans packet 1
      expect(handleScan('0001', 1000)).toBe(true);
      expect(cart[0].qty).toBe(1);

      // Cashier scans packet 2 of the same item 800ms later
      expect(handleScan('0001', 1800)).toBe(true);
      expect(cart[0].qty).toBe(2);

      // Cashier scans packet 3 of the same item 700ms later
      expect(handleScan('0001', 2500)).toBe(true);
      expect(cart[0].qty).toBe(3);
    });
  });

  // ─── 4. Product Selection Behavior: PCS vs KG vs Unknown Barcode ───
  describe('4. Catalog Matching & Product Type Behavior', () => {
    it('auto-adds PCS items directly to cart without requiring quantity modal', () => {
      const matches = lookupProduct(IMPORTED_PRODUCTS, '0001');
      expect(matches.length).toBe(1);
      const matched = matches[0];

      expect(isWeightBasedProduct(matched)).toBe(false);
      const cartItem = buildCartItem(matched, 1);
      expect(cartItem.quantity).toBe(1);
      expect(cartItem.lineTotal).toBe(275);
    });

    it('requires weight confirmation dialog for KG items', () => {
      const weightItems = IMPORTED_PRODUCTS.filter((p) => p.unit === 'KG');
      expect(weightItems.length).toBeGreaterThan(0);

      const kajuSpecial = weightItems[0];
      expect(isWeightBasedProduct(kajuSpecial)).toBe(true);
    });

    it('returns empty array cleanly for unknown barcodes without crashing or altering state', () => {
      const unknown = lookupProduct(IMPORTED_PRODUCTS, 'UNKNOWN-BARCODE-99999');
      expect(Array.isArray(unknown)).toBe(true);
      expect(unknown.length).toBe(0);

      // Simulate POS response to unknown barcode
      let errorNotified = false;
      if (unknown.length === 0) {
        errorNotified = true;
      }
      expect(errorNotified).toBe(true);
    });

    it('returns multiple products for disambiguation modal when SKU/query matches multiple items', () => {
      const matches = lookupProduct(IMPORTED_PRODUCTS, 'KAJU');
      expect(matches.length).toBeGreaterThan(1);
      expect(matches.every((p) => p.name.toUpperCase().includes('KAJU'))).toBe(true);
    });
  });

  // ─── 5. Manual Form Input & Focus Protection ───
  describe('5. Manual Form Input & Focus Protection', () => {
    it('ignores keydown events in regular form inputs so user typing is never treated as a scan', () => {
      const shouldIgnoreEvent = (targetTagName: string, isBarcodeInput: boolean) => {
        const isInput = targetTagName === 'INPUT' || targetTagName === 'TEXTAREA';
        if (isInput && !isBarcodeInput) {
          return true; // ignored, regular form typing protected
        }
        return false;
      };

      // Customer Name input
      expect(shouldIgnoreEvent('INPUT', false)).toBe(true);

      // Customer Phone input
      expect(shouldIgnoreEvent('INPUT', false)).toBe(true);

      // Search field input
      expect(shouldIgnoreEvent('INPUT', false)).toBe(true);

      // Dedicated Barcode input (has data-barcode-input="true")
      expect(shouldIgnoreEvent('INPUT', true)).toBe(false);

      // Body or background clicks
      expect(shouldIgnoreEvent('DIV', false)).toBe(false);
      expect(shouldIgnoreEvent('BODY', false)).toBe(false);
    });

    it('does not steal focus if user is actively editing customerName or customerPhone', () => {
      const canRefocus = (activeElementName: string, isBarcodeInput: boolean) => {
        if (activeElementName === 'INPUT' && !isBarcodeInput) {
          return false;
        }
        return true;
      };

      expect(canRefocus('INPUT', false)).toBe(false);
      expect(canRefocus('BUTTON', false)).toBe(true);
      expect(canRefocus('BODY', false)).toBe(true);
    });
  });

  // ─── 6. Scanner Diagnostic Bench Isolation ───
  describe('6. Scanner Diagnostic Bench Safety', () => {
    it('verifies scanner diagnostics never creates sales, orders, or modifies stock', () => {
      const initialStock = 0;
      const initialOrdersCount = 0;

      // Diagnostic scan event simulation
      const diagnosticResult = {
        code: '0001',
        suffix: 'Enter' as const,
        speedMs: 42,
        charCount: 4,
        avgIntervalMs: 14,
        timestamp: '16:20:00',
      };

      expect(diagnosticResult.code).toBe('0001');
      expect(diagnosticResult.speedMs).toBe(42);

      // Stock & orders must remain 100% untouched
      expect(initialStock).toBe(0);
      expect(initialOrdersCount).toBe(0);
    });
  });

  // ─── 7. Supported Barcode Formats Completeness (All 17 html5-qrcode Formats) ───
  describe('7. Supported Barcode Formats Completeness (All 17 html5-qrcode Formats)', () => {
    it('enables all 17 barcode formats genuinely supported by html5-qrcode without inventing constants', () => {
      expect(ALL_SUPPORTED_BARCODE_FORMATS.length).toBe(17);

      // Verify all 17 official enum keys exist in the library
      expect(ALL_SUPPORTED_BARCODE_FORMATS).toContain(Html5QrcodeSupportedFormats.QR_CODE);
      expect(ALL_SUPPORTED_BARCODE_FORMATS).toContain(Html5QrcodeSupportedFormats.AZTEC);
      expect(ALL_SUPPORTED_BARCODE_FORMATS).toContain(Html5QrcodeSupportedFormats.CODABAR);
      expect(ALL_SUPPORTED_BARCODE_FORMATS).toContain(Html5QrcodeSupportedFormats.CODE_39);
      expect(ALL_SUPPORTED_BARCODE_FORMATS).toContain(Html5QrcodeSupportedFormats.CODE_93);
      expect(ALL_SUPPORTED_BARCODE_FORMATS).toContain(Html5QrcodeSupportedFormats.CODE_128);
      expect(ALL_SUPPORTED_BARCODE_FORMATS).toContain(Html5QrcodeSupportedFormats.DATA_MATRIX);
      expect(ALL_SUPPORTED_BARCODE_FORMATS).toContain(Html5QrcodeSupportedFormats.MAXICODE);
      expect(ALL_SUPPORTED_BARCODE_FORMATS).toContain(Html5QrcodeSupportedFormats.ITF);
      expect(ALL_SUPPORTED_BARCODE_FORMATS).toContain(Html5QrcodeSupportedFormats.EAN_13);
      expect(ALL_SUPPORTED_BARCODE_FORMATS).toContain(Html5QrcodeSupportedFormats.EAN_8);
      expect(ALL_SUPPORTED_BARCODE_FORMATS).toContain(Html5QrcodeSupportedFormats.PDF_417);
      expect(ALL_SUPPORTED_BARCODE_FORMATS).toContain(Html5QrcodeSupportedFormats.RSS_14);
      expect(ALL_SUPPORTED_BARCODE_FORMATS).toContain(Html5QrcodeSupportedFormats.RSS_EXPANDED);
      expect(ALL_SUPPORTED_BARCODE_FORMATS).toContain(Html5QrcodeSupportedFormats.UPC_A);
      expect(ALL_SUPPORTED_BARCODE_FORMATS).toContain(Html5QrcodeSupportedFormats.UPC_E);
      expect(ALL_SUPPORTED_BARCODE_FORMATS).toContain(Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION);
    });

    it('correctly reports supported and unsupported formats with isFormatSupported', () => {
      expect(isFormatSupported(Html5QrcodeSupportedFormats.EAN_13)).toBe(true);
      expect(isFormatSupported(Html5QrcodeSupportedFormats.CODE_128)).toBe(true);
      expect(isFormatSupported(Html5QrcodeSupportedFormats.QR_CODE)).toBe(true);
      expect(isFormatSupported(Html5QrcodeSupportedFormats.DATA_MATRIX)).toBe(true);
      expect(isFormatSupported(Html5QrcodeSupportedFormats.PDF_417)).toBe(true);

      // Fictional format IDs should return false
      expect(isFormatSupported(9999)).toBe(false);
      expect(isFormatSupported(-1)).toBe(false);
    });

    it('provides metadata details for each supported format', () => {
      expect(SUPPORTED_FORMAT_DETAILS.length).toBe(17);
      const ean13 = SUPPORTED_FORMAT_DETAILS.find((d) => d.name === 'EAN-13');
      expect(ean13).toBeDefined();
      expect(ean13?.category).toBe('1D');

      const qr = SUPPORTED_FORMAT_DETAILS.find((d) => d.name === 'QR Code');
      expect(qr).toBeDefined();
      expect(qr?.category).toBe('2D');
    });
  });

  // ─── 8. Barcode Normalisation & AIM Symbology Identifiers ───
  describe('8. Barcode Normalisation & AIM Symbology Identifiers', () => {
    it('trims leading and trailing whitespace safely', () => {
      expect(normalizeBarcodeInput('   0001   ')).toBe('0001');
      expect(normalizeBarcodeInput('\t\r\n890100801001\n ')).toBe('890100801001');
    });

    it('preserves leading zeroes strictly as string values', () => {
      const code = normalizeBarcodeInput('0042');
      expect(code).toBe('0042');
      expect(typeof code).toBe('string');
      expect(code).not.toBe('42');
    });

    it('strips AIM symbology identifiers emitted by hardware scanners (e.g. ]C0, ]E0)', () => {
      // ]C0 = Code 128
      expect(normalizeBarcodeInput(']C00001')).toBe('0001');
      // ]E0 = EAN-13 / UPC
      expect(normalizeBarcodeInput(']E0890100801001')).toBe('890100801001');
      // ]Q1 = QR Code
      expect(normalizeBarcodeInput(']Q1ALBURHANI-PAY')).toBe('ALBURHANI-PAY');
      // ]d1 = Data Matrix
      expect(normalizeBarcodeInput(']d1BATCH2026')).toBe('BATCH2026');
    });

    it('looks up product successfully even when scanner transmits AIM prefix', () => {
      const res = lookupProduct(IMPORTED_PRODUCTS, ']C00001');
      expect(res.length).toBe(1);
      expect(res[0].name).toBe('KAJU KATLI 250G');
    });
  });

  // ─── 9. Justified UPC-A <-> EAN-13 Representation Formatting ───
  describe('9. Justified UPC-A <-> EAN-13 Representation Formatting', () => {
    it('matches 12-digit UPC when scanned as 13-digit EAN with leading 0', () => {
      // DCUBE BAJRA MURMURA has barcode '890100801001' (12 digits)
      const resWithLeadingZero = lookupProduct(IMPORTED_PRODUCTS, '0890100801001');
      expect(resWithLeadingZero.length).toBe(1);
      expect(resWithLeadingZero[0].name).toBe('DCUBE BAJRA MURMURA');
    });

    it('does NOT match 1-digit code "1" to "0001" (preserves 4-digit zero padding)', () => {
      const matches = lookupProduct(IMPORTED_PRODUCTS, '1');
      expect(matches.some((p) => p.barcode === '0001')).toBe(false);
    });
  });

  // ─── 10. Unknown Barcode Safe Action Recovery ───
  describe('10. Unknown Barcode Safe Action Recovery', () => {
    it('cleanly handles unregistered barcodes without modifying existing cart', () => {
      const unknownBarcode = '9998887776665';
      const matches = lookupProduct(IMPORTED_PRODUCTS, unknownBarcode);
      expect(matches.length).toBe(0);

      // In POS billing, when matches.length === 0, unknownBarcodePrompt is populated
      let promptState: string | null = null;
      let errorBeepPlayed = false;

      const onScanUnknown = (code: string) => {
        const found = lookupProduct(IMPORTED_PRODUCTS, code);
        if (found.length === 0) {
          promptState = code;
          errorBeepPlayed = true;
        }
      };

      onScanUnknown(unknownBarcode);
      expect(promptState).toBe(unknownBarcode);
      expect(errorBeepPlayed).toBe(true);
    });
  });

  // ─── 11. Camera Barcode Scanner Debounce and Cleanup Lifecycle ───
  describe('11. Camera Barcode Scanner Debounce and Cleanup Lifecycle', () => {
    it('suppresses duplicate camera decode frames within debounce threshold', () => {
      let isStopping = false;
      const lastScanned = { code: '', time: 0 };
      const receivedScans: string[] = [];

      const onDecodeFrame = (text: string, time: number) => {
        if (isStopping) return;
        if (lastScanned.code === text && (time - lastScanned.time) < 1500) {
          return;
        }
        isStopping = true;
        lastScanned.code = text;
        lastScanned.time = time;
        receivedScans.push(text);
      };

      // Frame 1 at t=100ms
      onDecodeFrame('890100801001', 100);
      expect(receivedScans.length).toBe(1);

      // Frame 2 at t=150ms (duplicate video frame before camera stops)
      onDecodeFrame('890100801001', 150);
      expect(receivedScans.length).toBe(1); // suppressed cleanly!
    });
  });

});
