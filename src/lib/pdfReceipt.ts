import { OrderBill } from '../types';

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
  writeCentered('AL-BHURANI', curY, 'F2', 13);
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
  writeCentered('*** Thank You For Visiting AL-BHURANI! ***', curY, 'F1', 6.5);

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
 * Creates an application/pdf Blob from an OrderBill.
 */
export function generateReceiptPdfBlob(order: OrderBill): Blob {
  const bytes = generateReceiptPdfBytes(order);
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}

/**
 * Triggers a browser download of the receipt PDF.
 */
export function downloadReceiptPdf(order: OrderBill): void {
  const blob = generateReceiptPdfBlob(order);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Receipt-${order.billNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export interface ShareResult {
  method: 'native-share' | 'whatsapp-fallback' | 'download-only';
  success: boolean;
  message: string;
}

/**
 * Shares or prepares WhatsApp sharing for the receipt PDF:
 * 1. Generates the real receipt PDF.
 * 2. If navigator.share supports file sharing, launches native share sheet (which allows choosing WhatsApp directly).
 * 3. Fallback: downloads the PDF locally and opens WhatsApp with a pre-filled summary message,
 *    notifying the cashier to attach the downloaded PDF.
 */
export async function shareReceiptPdfWhatsApp(
  order: OrderBill,
  onFeedback?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void
): Promise<ShareResult> {
  const blob = generateReceiptPdfBlob(order);
  const filename = `Receipt-${order.billNumber}.pdf`;

  // Prepared friendly customer message
  const custName = order.customerName ? order.customerName.trim() : 'Valued Customer';
  const messageText = `*AL-BHURANI Sweets & Dry Items*\nDear ${custName}, thank you for your purchase!\nBill No: *${order.billNumber}*\nDate: ${order.createdAt}\nTotal Amount: *Rs. ${order.grandTotal.toFixed(2)}*\n\nYour receipt PDF is attached. We look forward to serving you again!`;

  // Try Native File Sharing if supported by device/browser
  if (
    typeof navigator !== 'undefined' &&
    typeof File !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  ) {
    try {
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Receipt ${order.billNumber}`,
          text: messageText,
          files: [file],
        });
        const msg = 'Receipt PDF shared successfully.';
        onFeedback?.(msg, 'success');
        return { method: 'native-share', success: true, message: msg };
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { method: 'native-share', success: false, message: 'Share dismissed.' };
      }
      console.warn('Native share failed, falling back to download + WhatsApp link:', err);
    }
  }

  // Fallback: Download PDF and open WhatsApp web/app link
  try {
    downloadReceiptPdf(order);

    // Format phone number for WhatsApp link
    let phoneParam = '';
    if (order.customerPhone) {
      const cleaned = order.customerPhone.replace(/\D/g, '');
      if (cleaned.length === 10) {
        phoneParam = `91${cleaned}`;
      } else if (cleaned.length > 10) {
        phoneParam = cleaned;
      }
    }

    const waBase = phoneParam ? `https://wa.me/${phoneParam}` : 'https://wa.me/';
    const waUrl = `${waBase}?text=${encodeURIComponent(messageText)}`;

    if (typeof window !== 'undefined') {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }

    const msg = 'Receipt PDF downloaded. In WhatsApp, attach the downloaded receipt file to send to the customer.';
    onFeedback?.(msg, 'info');
    return { method: 'whatsapp-fallback', success: true, message: msg };
  } catch (err: any) {
    const errorMsg = `Could not initiate WhatsApp share: ${err?.message || 'Unknown error'}`;
    onFeedback?.(errorMsg, 'error');
    return { method: 'download-only', success: false, message: errorMsg };
  }
}
