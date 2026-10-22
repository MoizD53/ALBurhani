import { Html5QrcodeSupportedFormats } from 'html5-qrcode';

export interface SupportedBarcodeFormatInfo {
  format: Html5QrcodeSupportedFormats;
  name: string;
  category: '1D' | '2D' | 'Composite';
  commonUsage: string;
}

/**
 * Complete list of all 17 barcode formats genuinely supported by html5-qrcode.
 * None of these are invented; they match the library's exported enum constants exactly.
 */
export const ALL_SUPPORTED_BARCODE_FORMATS: Html5QrcodeSupportedFormats[] = [
  Html5QrcodeSupportedFormats.QR_CODE,            // 0 - QR Code (2D)
  Html5QrcodeSupportedFormats.AZTEC,              // 1 - Aztec (2D)
  Html5QrcodeSupportedFormats.CODABAR,            // 2 - Codabar (1D)
  Html5QrcodeSupportedFormats.CODE_39,            // 3 - Code 39 (1D alphanumeric)
  Html5QrcodeSupportedFormats.CODE_93,            // 4 - Code 93 (1D compact alphanumeric)
  Html5QrcodeSupportedFormats.CODE_128,           // 5 - Code 128 (1D high-density)
  Html5QrcodeSupportedFormats.DATA_MATRIX,        // 6 - Data Matrix (2D compact)
  Html5QrcodeSupportedFormats.MAXICODE,           // 7 - MaxiCode (2D postal)
  Html5QrcodeSupportedFormats.ITF,                // 8 - Interleaved 2 of 5 (1D packaging)
  Html5QrcodeSupportedFormats.EAN_13,             // 9 - EAN-13 (1D standard retail)
  Html5QrcodeSupportedFormats.EAN_8,              // 10 - EAN-8 (1D small retail)
  Html5QrcodeSupportedFormats.PDF_417,            // 11 - PDF417 (2D stacked)
  Html5QrcodeSupportedFormats.RSS_14,             // 12 - GS1 DataBar / RSS-14 (1D)
  Html5QrcodeSupportedFormats.RSS_EXPANDED,       // 13 - GS1 DataBar Expanded (1D)
  Html5QrcodeSupportedFormats.UPC_A,              // 14 - UPC-A (1D standard retail)
  Html5QrcodeSupportedFormats.UPC_E,              // 15 - UPC-E (1D zero-suppressed retail)
  Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION,  // 16 - UPC/EAN Extension (1D supplementary)
];

/**
 * Returns descriptive metadata for every supported barcode format.
 */
export const SUPPORTED_FORMAT_DETAILS: SupportedBarcodeFormatInfo[] = [
  { format: Html5QrcodeSupportedFormats.QR_CODE, name: 'QR Code', category: '2D', commonUsage: 'Digital links, UPI QR, mobile payments' },
  { format: Html5QrcodeSupportedFormats.AZTEC, name: 'Aztec', category: '2D', commonUsage: 'Transportation tickets, boarding passes, healthcare' },
  { format: Html5QrcodeSupportedFormats.CODABAR, name: 'Codabar', category: '1D', commonUsage: 'Blood banks, libraries, air express invoices' },
  { format: Html5QrcodeSupportedFormats.CODE_39, name: 'Code 39', category: '1D', commonUsage: 'Automotive, defense, legacy inventory tracking' },
  { format: Html5QrcodeSupportedFormats.CODE_93, name: 'Code 93', category: '1D', commonUsage: 'Postal services, Canadian parcel identification' },
  { format: Html5QrcodeSupportedFormats.CODE_128, name: 'Code 128', category: '1D', commonUsage: 'Universal supply chain, shipping stickers, retail inventory' },
  { format: Html5QrcodeSupportedFormats.DATA_MATRIX, name: 'Data Matrix', category: '2D', commonUsage: 'Pharmaceuticals, small electronics, direct part marking' },
  { format: Html5QrcodeSupportedFormats.MAXICODE, name: 'MaxiCode', category: '2D', commonUsage: 'High-speed conveyor sorting, shipping logistics' },
  { format: Html5QrcodeSupportedFormats.ITF, name: 'ITF (Interleaved 2 of 5)', category: '1D', commonUsage: 'Corrugated cardboard outer cartons, master cartons' },
  { format: Html5QrcodeSupportedFormats.EAN_13, name: 'EAN-13', category: '1D', commonUsage: 'Standard consumer packaged goods in India and worldwide' },
  { format: Html5QrcodeSupportedFormats.EAN_8, name: 'EAN-8', category: '1D', commonUsage: 'Small retail consumer packages with limited label space' },
  { format: Html5QrcodeSupportedFormats.PDF_417, name: 'PDF417', category: '2D', commonUsage: 'ID cards, driver licenses, logistics paperwork' },
  { format: Html5QrcodeSupportedFormats.RSS_14, name: 'GS1 DataBar (RSS-14)', category: '1D', commonUsage: 'Fresh produce, loose grocery items, coupons' },
  { format: Html5QrcodeSupportedFormats.RSS_EXPANDED, name: 'GS1 DataBar Expanded', category: '1D', commonUsage: 'Variable-weight retail, batch numbers, expiry tracking' },
  { format: Html5QrcodeSupportedFormats.UPC_A, name: 'UPC-A', category: '1D', commonUsage: 'North American retail point-of-sale' },
  { format: Html5QrcodeSupportedFormats.UPC_E, name: 'UPC-E', category: '1D', commonUsage: 'Compact North American retail items' },
  { format: Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION, name: 'UPC/EAN Extension', category: '1D', commonUsage: 'Periodicals, magazines, serialized books add-on codes' },
];

/**
 * Checks if a specific numeric format ID is supported by the system.
 */
export function isFormatSupported(format: Html5QrcodeSupportedFormats | number): boolean {
  return ALL_SUPPORTED_BARCODE_FORMATS.includes(format as Html5QrcodeSupportedFormats);
}
