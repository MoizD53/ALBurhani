import { OrderBill } from '../types';
import {
  normalizeWhatsAppPhoneNumber,
  formatPhoneNumberForDisplay,
} from './phoneUtils';

/**
 * Escapes characters for PDF literal text strings in Type 1 standard fonts.
 * Parentheses and backslashes must be escaped.
 * Non-ASCII characters (like ₹) are replaced with standard ASCII representation (Rs.).
 */
function sanitizePdfText(input: string | number | undefined | null): string {
  if (input === undefined || input === null) return '';
  const str = String(input)
    .replace(/₹/g, 'Rs. ')
    .replace(/[–—]/g, '-')
    .replace(/’/g, "'")
    .replace(/[“”]/g, '"');

  // Strip characters outside standard printable ASCII to prevent PDF font corruption
  const asciiClean = str.replace(/[^\x20-\x7E]/g, ' ');

  return asciiClean
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Approximate text width for standard Helvetica / Helvetica-Bold (in points).
 */
function estimateTextWidth(text: string, fontSize: number, isBold = false): number {
  const multiplier = isBold ? 0.58 : 0.52;
  return text.length * fontSize * multiplier;
}

/**
 * Generates a valid standard PDF 1.4 binary Uint8Array representation of an OrderBill receipt.
 * Spec-compliant, self-contained, no external runtime dependencies.
 */
export function generateReceiptPdfBytes(order: OrderBill): Uint8Array {
  const widthPt = 226.77; // Standard 80mm receipt roll width
  const marginPt = 12;
  const contentWidth = widthPt - marginPt * 2;

  // Calculate dynamic receipt height based on item count and tax breakdown
  const hasGst = order.gstAmount > 0;
  const isRevised = Boolean(order.isRevised);
  const baseHeight = 290 + (hasGst ? 45 : 0) + (isRevised ? 30 : 0) + (order.discountAmount > 0 ? 15 : 0) + (order.changeGiven > 0 ? 15 : 0);
  const itemsHeight = Math.max(30, order.items.length * 18);
  const heightPt = Math.max(320, baseHeight + itemsHeight);

  let stream = '';

  const writeText = (
    text: string,
    x: number,
    y: number,
    font: 'F1' | 'F2' = 'F1',
    size = 8
  ) => {
    const escaped = sanitizePdfText(text);
    stream += `BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escaped}) Tj ET\n`;
  };

  const writeCentered = (
    text: string,
    y: number,
    font: 'F1' | 'F2' = 'F1',
    size = 8
  ) => {
    const raw = String(text).replace(/₹/g, 'Rs. ');
    const w = estimateTextWidth(raw, size, font === 'F2');
    const x = Math.max(marginPt, (widthPt - w) / 2);
    writeText(text, x, y, font, size);
  };

  const writeBetween = (
    leftText: string,
    rightText: string,
    y: number,
    font: 'F1' | 'F2' = 'F1',
    size = 8
  ) => {
    writeText(leftText, marginPt, y, font, size);
    const rightRaw = String(rightText).replace(/₹/g, 'Rs. ');
    const rightW = estimateTextWidth(rightRaw, size, font === 'F2');
    const rightX = Math.max(marginPt + 50, widthPt - marginPt - rightW);
    writeText(rightText, rightX, y, font, size);
  };

  const drawLine = (y: number, dashed = false, width = 0.5) => {
    const dashCode = dashed ? '[2 2] 0 d\n' : '[] 0 d\n';
    stream += `${dashCode}${width} w 0 0 0 RG ${marginPt.toFixed(2)} ${y.toFixed(2)} m ${(widthPt - marginPt).toFixed(2)} ${y.toFixed(2)} l S\n[] 0 d\n`;
  };

  let curY = heightPt - 22;

  // 1. Store Header Branding
  writeCentered('AL-BURHANI', curY, 'F2', 13);
  curY -= 12;
  writeCentered('SWEETS & DRY ITEMS FRANCHISE', curY, 'F2', 7.5);
  curY -= 10;
  writeCentered('Godi Road, Near Clock Tower', curY, 'F1', 7);
  curY -= 9;
  writeCentered('Ph: +91 98765 43210', curY, 'F1', 7);
  curY -= 10;

  if (hasGst) {
    writeCentered('GSTIN: 24AABCA1234F1Z5', curY, 'F2', 7);
    curY -= 9;
    writeCentered(isRevised ? 'REVISED TAX INVOICE (GST INCL)' : 'TAX INVOICE (GST INCLUSIVE)', curY, 'F2', 7);
  } else {
    writeCentered(isRevised ? 'REVISED RETAIL SALE MEMO (0% GST)' : 'RETAIL SALE MEMO (0% GST)', curY, 'F2', 7);
  }
  curY -= 10;

  drawLine(curY, false, 0.75);
  curY -= 10;

  // 2. Bill Metadata
  writeBetween(`Bill: ${order.billNumber}`, `Date: ${order.createdAt}`, curY, 'F1', 7);
  curY -= 9;
  writeBetween(`Cashier: ${order.cashierName}`, `Mode: ${order.paymentMethod}`, curY, 'F1', 7);
  curY -= 9;
  if (order.customerPhone) {
    writeText(`Customer: ${order.customerName || 'Walk-in'} (${order.customerPhone})`, marginPt, curY, 'F1', 7);
    curY -= 9;
  }

  drawLine(curY, true, 0.5);
  curY -= 10;

  // 3. Items Table Header
  writeText('ITEM', marginPt, curY, 'F2', 7.5);
  writeText('QTY', marginPt + 95, curY, 'F2', 7.5);
  writeText('RATE', marginPt + 135, curY, 'F2', 7.5);
  const amtHeaderW = estimateTextWidth('AMT', 7.5, true);
  writeText('AMT', widthPt - marginPt - amtHeaderW, curY, 'F2', 7.5);
  curY -= 4;
  drawLine(curY, false, 0.5);
  curY -= 9;

  // 4. Line Items
  for (const item of order.items) {
    const rawName = item.product.name;
    const displayName = rawName.length > 18 ? rawName.substring(0, 17) + '.' : rawName;
    writeText(displayName, marginPt, curY, 'F2', 7);

    const qtyStr = item.formattedQuantity || String(item.quantity);
    writeText(qtyStr, marginPt + 92, curY, 'F1', 7);

    const rateStr = `${item.unitPrice}`;
    writeText(rateStr, marginPt + 135, curY, 'F1', 7);

    const amtStr = `Rs. ${item.lineTotal.toFixed(2)}`;
    const amtW = estimateTextWidth(amtStr, 7, false);
    writeText(amtStr, widthPt - marginPt - amtW, curY, 'F1', 7);
    curY -= 8;

    // Optional SKU micro-subtext
    writeText(`[${item.product.sku}]`, marginPt, curY, 'F1', 6);
    curY -= 9;
  }

  drawLine(curY, true, 0.5);
  curY -= 11;

  // 5. Totals & Inclusive GST Breakdown
  writeBetween(
    `Subtotal ${hasGst ? '(Incl. GST)' : ''}:`,
    `Rs. ${order.subtotal.toFixed(2)}`,
    curY,
    'F1',
    8
  );
  curY -= 10;

  if (order.discountAmount > 0) {
    writeBetween(
      'Discount Savings:',
      `-Rs. ${order.discountAmount.toFixed(2)}`,
      curY,
      'F1',
      8
    );
    curY -= 10;
  }

  if (hasGst) {
    drawLine(curY, true, 0.4);
    curY -= 8;
    writeBetween('Included 5% GST:', `Rs. ${order.gstAmount.toFixed(2)}`, curY, 'F2', 7);
    curY -= 8;
    const halfGst = (order.gstAmount / 2).toFixed(2);
    writeBetween('  CGST (2.5%):', `Rs. ${halfGst}`, curY, 'F1', 6.5);
    curY -= 7.5;
    writeBetween('  SGST (2.5%):', `Rs. ${halfGst}`, curY, 'F1', 6.5);
    curY -= 7.5;
    const taxableVal = (order.subtotal - order.discountAmount - order.gstAmount).toFixed(2);
    writeBetween('  Taxable Value:', `Rs. ${taxableVal}`, curY, 'F1', 6.5);
    curY -= 8;
    drawLine(curY, true, 0.4);
    curY -= 9;
  }

  drawLine(curY, false, 0.8);
  curY -= 11;

  // Grand Total Highlight
  writeBetween('GRAND TOTAL:', `Rs. ${order.grandTotal.toFixed(2)}`, curY, 'F2', 9.5);
  curY -= 4;
  drawLine(curY, false, 0.8);
  curY -= 10;

  // Payment Details
  if (isRevised && order.originalGrandTotal !== undefined) {
    writeBetween('Original Total:', `Rs. ${order.originalGrandTotal.toFixed(2)}`, curY, 'F1', 7);
    curY -= 8;
    writeBetween(`Previously Paid (${order.originalPaymentMethod || order.paymentMethod}):`, `Rs. ${order.originalGrandTotal.toFixed(2)}`, curY, 'F1', 7);
    curY -= 8;
    if (order.additionalAmountPaid !== undefined) {
      writeBetween(`Additional Paid (${order.additionalPaymentMethod || order.paymentMethod}):`, `Rs. ${order.additionalAmountPaid.toFixed(2)}`, curY, 'F2', 7);
      curY -= 8;
    }
    writeBetween('Total Settled:', `Rs. ${order.grandTotal.toFixed(2)}`, curY, 'F2', 7.5);
    curY -= 9;
  } else {
    writeBetween(`Paid via ${order.paymentMethod}:`, `Rs. ${order.amountReceived.toFixed(2)}`, curY, 'F1', 7.5);
    curY -= 9;

    if (order.changeGiven > 0) {
      writeBetween('Change Returned:', `Rs. ${order.changeGiven.toFixed(2)}`, curY, 'F2', 7.5);
      curY -= 9;
    }
  }

  drawLine(curY, true, 0.5);
  curY -= 11;

  // 6. Footer Greeting
  writeCentered('*** Thank You For Visiting AL-BURHANI! ***', curY, 'F1', 6.5);

  // Assemble Complete Standard PDF 1.4 Binary Structure
  const encoder = new TextEncoder();
  const streamBytes = encoder.encode(stream);

  const objects: string[] = [
    // 1 0 obj: Catalog
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    // 2 0 obj: Pages
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    // 3 0 obj: Page
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt.toFixed(2)} ${heightPt.toFixed(2)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n`,
    // 4 0 obj: Content Stream
    `4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${stream}endstream\nendobj\n`,
    // 5 0 obj: Font F1 (Helvetica)
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    // 6 0 obj: Font F2 (Helvetica-Bold)
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
  ];

  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  let totalLength = encoder.encode(header).length;
  const offsets: number[] = [];

  for (const obj of objects) {
    offsets.push(totalLength);
    totalLength += encoder.encode(obj).length;
  }

  const xrefOffset = totalLength;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const fullPdfString = header + objects.join('') + xref + trailer;
  return encoder.encode(fullPdfString);
}

/**
 * Validates that generated PDF bytes are non-empty, well-formed, and readable.
 */
export function validateReceiptPdfBytes(bytes: Uint8Array): { valid: boolean; error?: string } {
  if (!bytes || !(bytes instanceof Uint8Array) || bytes.byteLength < 100) {
    return { valid: false, error: 'Generated PDF is empty or invalid.' };
  }
  // Check PDF magic header '%PDF-'
  if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
    return { valid: false, error: 'Missing or corrupt PDF header.' };
  }
  // Check PDF trailer marker '%%EOF'
  const tail = new TextDecoder('latin1').decode(bytes.slice(-50));
  if (!tail.includes('%%EOF')) {
    return { valid: false, error: 'Incomplete or unfinalized PDF trailer.' };
  }
  return { valid: true };
}

/**
 * Creates an application/pdf Blob from an OrderBill.
 */
export function generateReceiptPdfBlob(order: OrderBill): Blob {
  const bytes = generateReceiptPdfBytes(order);
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}

/**
 * Helper to convert Uint8Array bytes to base64 for fallback data URLs.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Triggers a robust browser download of the receipt PDF named Receipt-[billNumber].pdf.
 * Compatible with Windows 7, Chrome 109, Firefox ESR, IE/Legacy Edge, and modern browsers.
 */
export function downloadReceiptPdf(order: OrderBill): boolean {
  try {
    const filename = `Receipt-${order.billNumber}.pdf`;
    const blob = generateReceiptPdfBlob(order);

    // 1. IE11 / Legacy Edge / Windows 7 specific API check
    if (typeof (window.navigator as any).msSaveOrOpenBlob === 'function') {
      (window.navigator as any).msSaveOrOpenBlob(blob, filename);
      return true;
    }

    // 2. Standard Blob Object URL Download
    if (typeof window !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = url;
      link.download = filename;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();

      // Keep link and ObjectURL alive for 60 seconds so Windows 7 / slower disks complete writing
      setTimeout(() => {
        try {
          if (link.parentNode) {
            link.parentNode.removeChild(link);
          }
          URL.revokeObjectURL(url);
        } catch {}
      }, 60000);

      return true;
    }

    // 3. Fallback: Base64 Data URI Download if ObjectURL is not available
    const bytes = generateReceiptPdfBytes(order);
    const base64 = uint8ArrayToBase64(bytes);
    const dataUrl = `data:application/pdf;base64,${base64}`;
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = dataUrl;
    link.download = filename;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        if (link.parentNode) link.parentNode.removeChild(link);
      } catch {}
    }, 10000);
    return true;
  } catch (err) {
    console.error('downloadReceiptPdf failed:', err);
    return false;
  }
}

/**
 * Generates self-contained print-ready HTML for the 80mm thermal receipt.
 * Used for isolated print preview window and fallback Save as PDF.
 */
export function generateReceiptHtml(order: OrderBill): string {
  const hasGst = order.gstAmount > 0;
  const isRevised = Boolean(order.isRevised);
  const taxableValue = Math.max(0, order.subtotal - order.discountAmount - order.gstAmount);
  const cgstAmount = Math.round((order.gstAmount / 2) * 100) / 100;
  const sgstAmount = Math.round((order.gstAmount - cgstAmount) * 100) / 100;

  const titleText = hasGst
    ? (isRevised ? 'REVISED TAX INVOICE (GST INCL)' : 'TAX INVOICE (GST INCLUSIVE)')
    : (isRevised ? 'REVISED RETAIL SALE MEMO (0% GST)' : 'RETAIL SALE MEMO (0% GST)');

  const itemsHtml = order.items.map((it) => `
    <tr>
      <td style="padding: 2px 0; text-align: left; vertical-align: top;">
        <div style="font-weight: 800; line-height: 1.1;">${it.product.name}</div>
        <div style="font-size: 8px; font-family: monospace;">[${it.product.sku}]</div>
      </td>
      <td style="padding: 2px 4px; text-align: center; vertical-align: top; white-space: nowrap; font-weight: 800;">
        ${it.formattedQuantity || it.quantity}
      </td>
      <td style="padding: 2px 4px; text-align: right; vertical-align: top; white-space: nowrap; font-weight: 800;">
        Rs. ${it.unitPrice}
      </td>
      <td style="padding: 2px 0; text-align: right; vertical-align: top; white-space: nowrap; font-weight: 800;">
        Rs. ${it.lineTotal.toFixed(2)}
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt-${order.billNumber}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 9px;
      line-height: 1.25;
      color: #000;
      background: #fff;
      width: 72mm;
      max-width: 72mm;
      margin: 0 auto;
      padding: 2mm 3mm;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bolder { font-weight: 800; }
    .black { font-weight: 900; }
    .border-b { border-bottom: 1px solid #000; }
    .border-b-2 { border-bottom: 2px solid #000; }
    .border-b-dashed { border-bottom: 1px dashed #000; }
    .border-t { border-top: 1px solid #000; }
    .border-t-2 { border-top: 2px solid #000; }
    .border-t-dotted { border-top: 1px dotted #000; }
    .flex-between { display: flex; justify-content: space-between; align-items: center; }
    .py-1 { padding-top: 4px; padding-bottom: 4px; }
    .pt-1 { padding-top: 4px; }
    .pb-1 { padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 9px; }
    th { font-weight: 900; border-bottom: 2px solid #000; padding-bottom: 2px; }
    @media print {
      body { width: 72mm; margin: 0 auto; padding: 1mm 2.5mm; }
    }
  </style>
</head>
<body>
  <div class="text-center pb-1 border-b-2">
    <h1 style="font-size: 16px; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase;">AL-BURHANI</h1>
    <div style="font-size: 8.5px; font-weight: 800; text-transform: uppercase; margin-top: 2px;">Sweets & Dry Items Franchise</div>
    <div style="font-size: 8px; font-weight: 600;">Godi Road, Near Clock Tower</div>
    <div style="font-size: 8px; font-weight: 600;">Ph: +91 98765 43210</div>
    ${hasGst ? `
      <div class="border-t pt-1" style="margin-top: 4px;">
        <div style="font-size: 8.5px; font-weight: 900;">GSTIN: 24AABCA1234F1Z5</div>
        <div style="display: inline-block; border: 1px solid #000; padding: 1px 4px; font-size: 8px; font-weight: 900; margin-top: 2px;">
          ${titleText}
        </div>
      </div>
    ` : `
      <div class="border-t pt-1" style="margin-top: 4px;">
        <div style="display: inline-block; border: 1px solid #000; padding: 1px 4px; font-size: 8px; font-weight: 900;">
          ${titleText}
        </div>
      </div>
    `}
  </div>

  <div class="py-1 border-b-dashed" style="font-size: 8.5px; font-weight: 700;">
    <div class="flex-between">
      <span>Bill: ${order.billNumber}</span>
      <span>Date: ${order.createdAt}</span>
    </div>
    <div class="flex-between" style="margin-top: 2px;">
      <span>Cashier: ${order.cashierName}</span>
      <span>Mode: ${order.paymentMethod}</span>
    </div>
    ${order.customerPhone ? `
      <div style="margin-top: 2px;">
        Customer: ${order.customerName || 'Walk-in'} (${order.customerPhone})
      </div>
    ` : ''}
  </div>

  <div class="py-1 border-b">
    <table>
      <thead>
        <tr>
          <th style="text-align: left;">ITEM</th>
          <th style="text-align: center; width: 40px;">QTY</th>
          <th style="text-align: right; width: 44px;">RATE</th>
          <th style="text-align: right; width: 50px;">AMT</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
  </div>

  <div class="py-1 border-b-dashed" style="font-size: 9.5px; font-weight: 700;">
    <div class="flex-between">
      <span>Subtotal ${hasGst ? '(Incl. GST)' : ''}:</span>
      <span class="bolder">Rs. ${order.subtotal.toFixed(2)}</span>
    </div>
    ${order.discountAmount > 0 ? `
      <div class="flex-between black" style="margin-top: 2px;">
        <span>Discount Savings:</span>
        <span>-Rs. ${order.discountAmount.toFixed(2)}</span>
      </div>
    ` : ''}
    ${hasGst ? `
      <div class="border-t-dotted pt-1" style="margin-top: 3px; font-size: 8.5px;">
        <div class="flex-between bolder">
          <span>Included 5% GST:</span>
          <span>Rs. ${order.gstAmount.toFixed(2)}</span>
        </div>
        <div class="flex-between" style="padding-left: 8px;">
          <span>• CGST (2.5%):</span>
          <span>Rs. ${cgstAmount.toFixed(2)}</span>
        </div>
        <div class="flex-between" style="padding-left: 8px;">
          <span>• SGST (2.5%):</span>
          <span>Rs. ${sgstAmount.toFixed(2)}</span>
        </div>
        <div class="flex-between" style="padding-left: 8px;">
          <span>• Taxable Value:</span>
          <span>Rs. ${taxableValue.toFixed(2)}</span>
        </div>
      </div>
    ` : ''}
    <div class="flex-between border-t-2 pt-1" style="margin-top: 4px; font-size: 11px; font-weight: 900;">
      <span>GRAND TOTAL:</span>
      <span style="font-size: 13px;">Rs. ${order.grandTotal.toFixed(2)}</span>
    </div>
  </div>

  <div class="py-1 border-b-dashed" style="font-size: 8.5px; font-weight: 700;">
    ${isRevised && order.originalGrandTotal !== undefined ? `
      <div class="flex-between">
        <span>Original Total:</span>
        <span class="bolder">Rs. ${order.originalGrandTotal.toFixed(2)}</span>
      </div>
      <div class="flex-between">
        <span>Previously Paid (${order.originalPaymentMethod || order.paymentMethod}):</span>
        <span class="bolder">Rs. ${order.originalGrandTotal.toFixed(2)}</span>
      </div>
      ${order.additionalAmountPaid !== undefined ? `
        <div class="flex-between black">
          <span>Additional Paid (${order.additionalPaymentMethod || order.paymentMethod}):</span>
          <span>Rs. ${order.additionalAmountPaid.toFixed(2)}</span>
        </div>
      ` : ''}
      <div class="flex-between border-t-dotted pt-1 black">
        <span>Total Settled:</span>
        <span>Rs. ${order.grandTotal.toFixed(2)}</span>
      </div>
    ` : `
      <div class="flex-between">
        <span>Paid via ${order.paymentMethod}:</span>
        <span class="bolder">Rs. ${order.amountReceived.toFixed(2)}</span>
      </div>
      ${order.changeGiven > 0 ? `
        <div class="flex-between black">
          <span>Change Returned:</span>
          <span>Rs. ${order.changeGiven.toFixed(2)}</span>
        </div>
      ` : ''}
    `}
  </div>

  <div class="text-center pt-1" style="font-size: 8px; font-weight: 900;">
    <p>*** Thank You For Visiting AL-BURHANI! ***</p>
  </div>
</body>
</html>`;
}

/**
 * Opens a dedicated clean print window and triggers the browser print dialog.
 * Completely isolates the thermal receipt from parent DOM styling, transforms, and overflow rules.
 */
export function printReceiptViaWindow(order: OrderBill): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const html = generateReceiptHtml(order);
    const printWin = window.open('', '_blank', 'width=420,height=650');
    if (!printWin) return false;
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      try {
        printWin.print();
      } catch (err) {
        console.error('printWin.print failed:', err);
      }
    }, 250);
    return true;
  } catch (err) {
    console.error('printReceiptViaWindow failed:', err);
    return false;
  }
}

export interface ShareResult {
  method: 'native-share' | 'whatsapp-fallback' | 'download-only';
  success: boolean;
  message: string;
}

/**
 * Shares or prepares WhatsApp sharing for the receipt PDF:
 * 1. Generates and strictly validates the real receipt PDF before initiating any share.
 * 2. On Android/mobile: uses native Web Share Level 2 to attach the actual PDF file directly to WhatsApp.
 * 3. On desktop / WhatsApp Web: downloads the PDF locally and opens WhatsApp with clean transaction details
 *    (WITHOUT claiming "Your receipt PDF is attached" when only text was sent).
 */
export async function shareReceiptPdfWhatsApp(
  order: OrderBill,
  targetPhoneOrFeedback?: string | ((msg: string, type: 'info' | 'success' | 'warning' | 'error') => void),
  onFeedback?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void
): Promise<ShareResult> {
  let explicitPhone: string | undefined;
  let feedbackCallback: ((msg: string, type: 'info' | 'success' | 'warning' | 'error') => void) | undefined;

  if (typeof targetPhoneOrFeedback === 'function') {
    feedbackCallback = targetPhoneOrFeedback;
  } else if (typeof targetPhoneOrFeedback === 'string') {
    explicitPhone = targetPhoneOrFeedback;
    feedbackCallback = onFeedback;
  } else if (onFeedback) {
    feedbackCallback = onFeedback;
  }

  // 1. Generate and strictly validate the final receipt PDF before initiating any share
  const pdfBytes = generateReceiptPdfBytes(order);
  const validation = validateReceiptPdfBytes(pdfBytes);
  if (!validation.valid) {
    const errorMsg = `Receipt PDF generation failed: ${validation.error || 'Invalid PDF structure'}`;
    feedbackCallback?.(errorMsg, 'error');
    return { method: 'download-only', success: false, message: errorMsg };
  }

  const filename = `Receipt-${order.billNumber}.pdf`;
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });

  // 2. Determine and normalize target phone number (explicit argument takes priority over order)
  const rawPhone = explicitPhone !== undefined ? explicitPhone : order.customerPhone;
  const normalizedPhone = normalizeWhatsAppPhoneNumber(rawPhone);

  // 3. Prepare receipt metadata
  const custName = order.customerName ? order.customerName.trim() : 'Valued Customer';
  const hasGst = order.gstAmount > 0;
  const billType = hasGst ? 'Tax Invoice' : 'Retail Sale Memo';

  // 4. On Android / Mobile: Use Web Share API Level 2 if supported (actually attaches the PDF file via share sheet)
  if (
    typeof navigator !== 'undefined' &&
    typeof File !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  ) {
    try {
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        const nativeShareText = `*AL-BURHANI Sweets & Dry Items*\nDear ${custName}, thank you for your purchase!\n${billType}: *${order.billNumber}*\nDate: ${order.createdAt}\nTotal Amount: *Rs. ${order.grandTotal.toFixed(2)}*\n\nYour receipt PDF is attached below. We look forward to serving you again!`;
        await navigator.share({
          title: `Receipt ${order.billNumber}`,
          text: nativeShareText,
          files: [file],
        });
        const msg = 'Receipt PDF shared successfully with file attached.';
        feedbackCallback?.(msg, 'success');
        return { method: 'native-share', success: true, message: msg };
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { method: 'native-share', success: false, message: 'Share dismissed.' };
      }
      console.warn('Native share failed, falling back to download + WhatsApp link:', err);
    }
  }

  // 5. Desktop / WhatsApp Web: WhatsApp Web URL schemes ONLY support prefilled text, NOT binary file payloads.
  // REMOVE the false/misleading "Your receipt PDF is attached" claim when sending via WhatsApp Web!
  const desktopMessageText = `*AL-BURHANI Sweets & Dry Items*\nDear ${custName}, thank you for your purchase!\n${billType}: *${order.billNumber}*\nDate: ${order.createdAt}\nCashier: ${order.cashierName}\nTotal Amount: *Rs. ${order.grandTotal.toFixed(2)}*\n\nWe look forward to serving you again!`;

  try {
    // Step A: Trigger local download first so user has the PDF ready to attach in WhatsApp Web
    downloadReceiptPdf(order);

    // Step B: Build targeted WhatsApp Web URL
    const waUrl = normalizedPhone
      ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(desktopMessageText)}`
      : `https://wa.me/?text=${encodeURIComponent(desktopMessageText)}`;

    // Step C: Open WhatsApp Web
    if (typeof window !== 'undefined') {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }

    const displayPhone = normalizedPhone ? formatPhoneNumberForDisplay(normalizedPhone) : '';
    const msg = normalizedPhone
      ? `Receipt PDF downloaded (${filename}). In WhatsApp Web, click 📎 to attach the downloaded PDF to ${displayPhone}.`
      : `Receipt PDF downloaded (${filename}). In WhatsApp Web, click 📎 to attach the downloaded PDF file.`;
    
    feedbackCallback?.(msg, 'success');
    return { method: 'whatsapp-fallback', success: true, message: msg };
  } catch (err: any) {
    const errorMsg = `Could not initiate WhatsApp share: ${err?.message || 'Unknown error'}`;
    feedbackCallback?.(errorMsg, 'error');
    return { method: 'download-only', success: false, message: errorMsg };
  }
}
