import React, { useEffect, useState } from 'react';
import { OrderBill } from '../../types';
import { 
  X, 
  Printer, 
  CheckCircle, 
  Share2, 
  Download, 
  ArrowRight, 
  Info, 
  Check, 
  Edit2,
  Phone
} from 'lucide-react';
import { 
  shareReceiptPdfWhatsApp, 
  downloadReceiptPdf,
  printReceiptViaWindow,
  printReceiptViaIframe,
  getSavedThermalRollWidth,
  saveThermalRollWidth,
  ThermalRollWidth
} from '../../lib/pdfReceipt';
import { 
  isValidWhatsAppPhoneNumber, 
  updateOrderCustomerPhone 
} from '../../lib/phoneUtils';

interface ReceiptModalProps {
  order: OrderBill | null;
  onClose: () => void;
  onModifyOrder?: (order: OrderBill) => void;
  onUpdateOrder?: (order: OrderBill) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ 
  order: initialOrder, 
  onClose, 
  onModifyOrder,
  onUpdateOrder,
}) => {
  const [currentOrder, setCurrentOrder] = useState<OrderBill | null>(initialOrder);
  const [feedback, setFeedback] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [showPrintHelp, setShowPrintHelp] = useState(false);
  const [rollWidth, setRollWidth] = useState<ThermalRollWidth>(getSavedThermalRollWidth);

  // Sync state whenever prop order changes (e.g. reopening different bill or revised order)
  useEffect(() => {
    setCurrentOrder(initialOrder);
    setFeedback(null);
    setIsSharing(false);
    setShowPhonePrompt(false);
    setPhoneInput(initialOrder?.customerPhone || '');
    setPhoneError(null);
  }, [initialOrder?.id, initialOrder?.billNumber]);

  const order = currentOrder || initialOrder;

  // Global Escape keydown listener (closes modal or closes phone prompt)
  useEffect(() => {
    if (!order) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (showPhonePrompt) {
          setShowPhonePrompt(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [order, onClose, showPhonePrompt]);

  // Suppress browser headers & footers by temporarily clearing document.title during print
  useEffect(() => {
    if (!order) return;
    const originalTitle = document.title;
    const handleBeforePrint = () => {
      document.title = '';
    };
    const handleAfterPrint = () => {
      document.title = originalTitle;
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      if (document.title === '') {
        document.title = originalTitle;
      }
    };
  }, [order]);

  if (!order) return null;

  const handlePrint = () => {
    if (!order) return;
    setShowPrintHelp(true);
    // Isolate thermal receipt via dedicated iframe: guarantees 100% visible preview,
    // suppresses Chrome headers/footers, and cuts at exact continuous roll content length.
    try {
      const ok = printReceiptViaIframe(order, rollWidth);
      if (!ok) {
        window.print();
      }
    } catch (err) {
      console.error('printReceiptViaIframe error, falling back to window.print():', err);
      window.print();
    }
  };

  const handlePrintViaCleanWindow = () => {
    if (!order) return;
    const ok = printReceiptViaWindow(order, rollWidth);
    if (!ok) {
      setFeedback({
        message: 'Could not open clean print window. Please press Ctrl+P to print.',
        type: 'info',
      });
    }
  };

  const handleShareWhatsApp = async () => {
    if (!order) return;
    setFeedback(null);

    // If order already has a valid phone number, reuse it directly without prompt
    if (isValidWhatsAppPhoneNumber(order.customerPhone)) {
      setIsSharing(true);
      try {
        await shareReceiptPdfWhatsApp(order, (msg, type) => {
          setFeedback({ message: msg, type: type === 'warning' ? 'info' : type });
        });
      } catch (err: any) {
        setFeedback({
          message: `Share error: ${err?.message || 'Could not complete WhatsApp share'}`,
          type: 'error',
        });
      } finally {
        setIsSharing(false);
      }
      return;
    }

    // Otherwise, ask the cashier to enter or correct the phone number as fallback
    setPhoneInput(order.customerPhone || '');
    setPhoneError(null);
    setShowPhonePrompt(true);
  };

  const handleConfirmPhoneAndShare = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!order) return;

    if (!isValidWhatsAppPhoneNumber(phoneInput)) {
      setPhoneError('Please enter a valid 10-digit mobile number');
      return;
    }

    setPhoneError(null);
    setShowPhonePrompt(false);
    setIsSharing(true);

    const cleanInput = phoneInput.trim();
    // Persist phone number with the bill and customer record in existing data model
    const updated = updateOrderCustomerPhone(order.id, cleanInput, order.billNumber) || {
      ...order,
      customerPhone: cleanInput,
    };

    setCurrentOrder(updated);
    onUpdateOrder?.(updated);

    try {
      await shareReceiptPdfWhatsApp(updated, (msg, type) => {
        setFeedback({ message: msg, type: type === 'warning' ? 'info' : type });
      });
    } catch (err: any) {
      setFeedback({
        message: `Share error: ${err?.message || 'Could not complete WhatsApp share'}`,
        type: 'error',
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownload = () => {
    downloadReceiptPdf(order, rollWidth);
    setFeedback({
      message: `Receipt PDF downloaded (${order.billNumber}.pdf)`,
      type: 'success',
    });
  };

  const hasGst = order.gstAmount > 0;
  const taxableValue = Math.max(0, order.subtotal - order.discountAmount - order.gstAmount);
  const cgstAmount = Math.round((order.gstAmount / 2) * 100) / 100;
  const sgstAmount = Math.round((order.gstAmount - cgstAmount) * 100) / 100;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in select-none print:p-0 print:bg-white print:static print:block"
      onClick={onClose}
    >
      {/* Thermal Print Driver Settings: Strictly portrait, configurable roll width, zero trailing paper feed */}
      <style>{`
        @media print {
          @page {
            size: ${rollWidth === 'A4' ? 'A4 portrait' : 'portrait'};
            margin: ${rollWidth === 'A4' ? '10mm' : '0mm'};
          }
          html, body {
            width: ${rollWidth === 'A4' ? '210mm' : (rollWidth === '58mm' ? '58mm' : '80mm')} !important;
            max-width: ${rollWidth === 'A4' ? '210mm' : (rollWidth === '58mm' ? '58mm' : '80mm')} !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #FFFFFF !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          body * {
            visibility: hidden;
          }
          #thermal-receipt, #thermal-receipt * {
            visibility: visible !important;
          }
          #thermal-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${rollWidth === 'A4' ? '190mm' : (rollWidth === '58mm' ? '48mm' : '72mm')} !important;
            max-width: ${rollWidth === 'A4' ? '190mm' : (rollWidth === '58mm' ? '48mm' : '72mm')} !important;
            margin: 0 auto !important;
            padding: ${rollWidth === 'A4' ? '0' : `1.5mm ${rollWidth === '58mm' ? '1.5mm' : '2.5mm'}`} !important;
            border: none !important;
            box-shadow: none !important;
            z-index: 99999999 !important;
            background: #ffffff !important;
            color: #000000 !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
            page-break-inside: avoid !important;
            break-after: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl bg-white border border-[#E8DEC8] shadow-2xl overflow-hidden max-h-[92vh] max-h-[92dvh] flex flex-col print:border-none print:shadow-none print:max-h-none print:w-auto print:max-w-none print:static print:overflow-visible print:bg-white"
      >
        
        {/* Fallback Customer Phone Input Modal for WhatsApp Sharing */}
        {showPhonePrompt && (
          <div 
            className="absolute inset-0 z-30 bg-stone-900/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-xs bg-white rounded-2xl p-4 shadow-2xl border border-[#E8DEC8] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#E8DEC8]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Send WhatsApp PDF</h4>
                    <p className="text-[10px] text-stone-500 font-mono">{order.billNumber}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPhonePrompt(false)}
                  className="p-1 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100"
                  aria-label="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmPhoneAndShare} className="space-y-3">
                <p className="text-[11px] text-stone-600 leading-snug">
                  Enter customer's mobile number to send this PDF receipt directly on WhatsApp:
                </p>

                <div>
                  <div className="flex items-center rounded-xl border border-stone-300 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/20 overflow-hidden bg-white shadow-inner">
                    <span className="px-2.5 py-2 bg-stone-100 text-[11px] font-bold text-stone-600 border-r border-stone-200 select-none">
                      +91
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoFocus
                      placeholder="98765 43210"
                      value={phoneInput}
                      onChange={(e) => {
                        setPhoneInput(e.target.value);
                        if (phoneError) setPhoneError(null);
                      }}
                      className="w-full px-2.5 py-2 text-xs font-mono text-stone-900 focus:outline-none bg-transparent"
                    />
                  </div>
                  {phoneError && (
                    <p className="text-[10px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                      <Info className="w-3 h-3 shrink-0" />
                      <span>{phoneError}</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPhonePrompt(false)}
                    className="py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Send PDF</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* Header (Hidden when printing) */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8DEC8] bg-[#FAF8F5] shrink-0 print:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle className={`w-4 h-4 shrink-0 ${order.isRevised ? 'text-amber-600' : 'text-emerald-600'}`} />
            <div className="min-w-0">
              <h3 className="font-bold text-stone-900 text-xs truncate">
                {order.isRevised ? 'Bill Revised Successfully' : 'Sale Saved Successfully'}
              </h3>
              <p className="text-[10px] text-stone-500 font-mono truncate">
                {order.billNumber}{order.isRevised ? ` · Revised ${order.revisedAt || ''}` : ''}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition-colors"
            title="Close / Next Customer (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* WhatsApp / Download Feedback Notice (Hidden when printing) */}
        {feedback && (
          <div className={`px-4 py-2 border-b text-xs flex items-start gap-2 shrink-0 print:hidden animate-fade-in ${
            feedback.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : feedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            {feedback.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            )}
            <p className="text-[11px] leading-tight flex-1 font-medium">{feedback.message}</p>
          </div>
        )}

        {/* Quick Thermal Roll Size Selector (80mm vs 58mm vs A4) */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#FAF8F5] border-b border-[#E8DEC8] text-xs shrink-0 print:hidden">
          <span className="text-[11px] font-bold text-stone-600">Print Profile:</span>
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-[#E8DEC8] shadow-xs">
            <button
              type="button"
              onClick={() => {
                setRollWidth('80mm');
                saveThermalRollWidth('80mm');
              }}
              className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                rollWidth === '80mm'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Standard 80mm (3-inch) retail thermal roll (Epson TM-T82)"
            >
              80mm Roll (3")
            </button>
            <button
              type="button"
              onClick={() => {
                setRollWidth('58mm');
                saveThermalRollWidth('58mm');
              }}
              className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                rollWidth === '58mm'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Compact 58mm (2-inch) mobile / Bluetooth thermal roll"
            >
              58mm Roll (2")
            </button>
            <button
              type="button"
              onClick={() => {
                setRollWidth('A4');
                saveThermalRollWidth('A4');
              }}
              className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                rollWidth === 'A4'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Full A4 Sheet Portrait (Canon / Laser / Inkjet)"
            >
              A4 Sheet
            </button>
          </div>
        </div>

        {/* Receipt Content Body */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 flex flex-col items-center custom-scrollbar bg-stone-50 print:p-0 print:bg-white print:overflow-visible">
          
          <div 
            id="thermal-receipt"
            style={{
              color: '#000000',
              backgroundColor: '#FFFFFF',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact',
            }}
            className={`${
              rollWidth === 'A4'
                ? 'w-[190mm] max-w-[190mm] text-[11px] p-4 print:w-[190mm] print:max-w-[190mm]'
                : rollWidth === '58mm' 
                ? 'w-[48mm] max-w-[48mm] text-[8px] p-2 print:w-[48mm] print:max-w-[48mm]' 
                : 'w-[72mm] max-w-[72mm] text-[9px] p-2.5 print:w-[72mm] print:max-w-[72mm]'
            } bg-white text-black rounded shadow-md border border-stone-300 font-sans leading-tight select-none print:border-none print:shadow-none print:p-1 print:m-0`}
          >

            {/* Store Header Branding (Clean bold text, NO LOGO image, Correct spelling AL-BURHANI) */}
            <div className="text-center pb-1.5 border-b-2 border-black">
              <h2 className="font-black text-base tracking-wider uppercase text-black leading-tight">AL-BURHANI</h2>
              <p className="text-[8.5px] uppercase font-bold text-black mt-0.5">Sweets & Dry Items Franchise</p>
              <p className="text-[8px] font-semibold text-black">Godi Road, Near Clock Tower</p>
              <p className="text-[8px] font-semibold text-black">Ph: +91 98765 43210</p>
              {hasGst ? (
                <div className="mt-1 pt-0.5 border-t border-black">
                  <p className="text-[8.5px] font-black text-black">GSTIN: 24AABCA1234F1Z5</p>
                  <span className={`inline-block px-1 py-0.2 text-[8px] font-black rounded mt-0.5 border border-black ${
                    order.isRevised
                      ? 'bg-amber-100 text-black'
                      : 'bg-white text-black'
                  }`}>
                    {order.isRevised ? 'REVISED TAX INVOICE (GST INCL)' : 'TAX INVOICE (GST INCLUSIVE)'}
                  </span>
                </div>
              ) : (
                <div className="mt-1 pt-0.5 border-t border-black">
                  <span className={`inline-block px-1 py-0.2 text-[8px] font-black rounded mt-0.5 border border-black ${
                    order.isRevised
                      ? 'bg-amber-100 text-black'
                      : 'bg-white text-black'
                  }`}>
                    {order.isRevised ? 'REVISED RETAIL SALE MEMO (0% GST)' : 'RETAIL SALE MEMO (0% GST)'}
                  </span>
                </div>
              )}
            </div>

            {/* Bill Meta (Solid Black, Crisp) */}
            <div className="py-1 border-b border-dashed border-black text-[8.5px] font-bold text-black space-y-0.5">
              <div className="flex justify-between">
                <span>Bill: {order.billNumber}</span>
                <span>Date: {order.createdAt}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier: {order.cashierName}</span>
                <span>Mode: {order.paymentMethod}</span>
              </div>
              {order.customerPhone && (
                <div className="truncate">
                  Customer: {order.customerName || 'Walk-in'} ({order.customerPhone})
                </div>
              )}
            </div>

            {/* Line Items Table with Aligned Columns (Bold Dark Text) */}
            <div className="py-1 border-b border-black">
              <table className="w-full text-[9px] border-collapse">
                <thead>
                  <tr className="border-b-2 border-black font-black text-black">
                    <th className="text-left pb-0.5 font-black text-black">ITEM</th>
                    <th className="text-center pb-0.5 w-11 font-black text-black">QTY</th>
                    <th className="text-right pb-0.5 w-11 font-black text-black">RATE</th>
                    <th className="text-right pb-0.5 w-13 font-black text-black">AMT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/30">
                  {order.items.map((it, idx) => (
                    <tr key={idx} className="align-top">
                      <td className="py-0.5 pr-1 text-left">
                        <div className="font-extrabold text-black break-words leading-tight">{it.product.name}</div>
                        <div className="text-[7.5px] font-bold text-black font-mono">[{it.product.sku}]</div>
                      </td>
                      <td className="py-0.5 px-0.5 text-center font-black text-black whitespace-nowrap">
                        {it.formattedQuantity || it.quantity}
                      </td>
                      <td className="py-0.5 px-0.5 text-right font-black text-black whitespace-nowrap tabular-nums">
                        Rs. {it.unitPrice}
                      </td>
                      <td className="py-0.5 pl-0.5 text-right font-black text-black whitespace-nowrap tabular-nums">
                        Rs. {it.lineTotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals & Inclusive GST Breakdown (Pure Black, Bold) */}
            <div className="py-1 space-y-0.5 text-[9.5px] font-bold text-black border-b border-dashed border-black">
              <div className="flex justify-between items-center">
                <span>Subtotal {hasGst ? '(Incl. GST)' : ''}:</span>
                <span className="tabular-nums font-black text-black">Rs. {order.subtotal.toFixed(2)}</span>
              </div>

              {order.discountAmount > 0 && (
                <div className="flex justify-between items-center text-black font-black">
                  <span>Discount Savings:</span>
                  <span className="tabular-nums">-Rs. {order.discountAmount.toFixed(2)}</span>
                </div>
              )}

              {/* Explicit Inclusive GST Breakdown without adding on top (Dark Black) */}
              {hasGst && (
                <div className="pt-0.5 border-t border-dotted border-black space-y-0.5 text-[8.5px] font-bold text-black">
                  <div className="flex justify-between font-black">
                    <span>Included 5% GST:</span>
                    <span className="tabular-nums">Rs. {order.gstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pl-2">
                    <span>• CGST (2.5%):</span>
                    <span className="tabular-nums font-extrabold">Rs. {cgstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pl-2">
                    <span>• SGST (2.5%):</span>
                    <span className="tabular-nums font-extrabold">Rs. {sgstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pl-2">
                    <span>• Taxable Value:</span>
                    <span className="tabular-nums font-extrabold">Rs. {taxableValue.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Grand Total (Prominent Double Line Jet Black) */}
              <div className="flex justify-between items-center text-xs font-black text-black border-t-2 border-black pt-0.5 mt-0.5">
                <span>GRAND TOTAL:</span>
                <span className="tabular-nums font-black text-sm">Rs. {order.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Details (Solid Black, Bold) */}
            {order.isRevised && order.originalGrandTotal !== undefined ? (
              <div className="py-1 text-[8.5px] font-bold text-black space-y-0.5 border-b border-dashed border-black">
                <div className="flex justify-between">
                  <span>Original Total:</span>
                  <span className="tabular-nums font-black">Rs. {order.originalGrandTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Previously Paid ({order.originalPaymentMethod || order.paymentMethod}):</span>
                  <span className="tabular-nums font-black">Rs. {order.originalGrandTotal.toFixed(2)}</span>
                </div>
                {order.additionalAmountPaid !== undefined && (
                  <div className="flex justify-between font-black text-black">
                    <span>Additional Paid ({order.additionalPaymentMethod || order.paymentMethod}):</span>
                    <span className="tabular-nums">Rs. {order.additionalAmountPaid.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black border-t border-dotted border-black pt-0.5">
                  <span>Total Settled:</span>
                  <span className="tabular-nums font-black">Rs. {order.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div className="py-1 text-[8.5px] font-bold text-black space-y-0.5 border-b border-dashed border-black">
                <div className="flex justify-between">
                  <span>Paid via {order.paymentMethod}:</span>
                  <span className="font-black tabular-nums">Rs. {order.amountReceived.toFixed(2)}</span>
                </div>
                {order.changeGiven > 0 && (
                  <div className="flex justify-between font-black">
                    <span>Change Returned:</span>
                    <span className="tabular-nums">Rs. {order.changeGiven.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Action Controls: 3 Clear Choices & Modify Bill (Hidden when printing) */}
        <div className="p-3 border-t border-[#E8DEC8] bg-[#FAF8F5] shrink-0 space-y-2 print:hidden">
          
          {/* Modify Bill Action (Reopen in POS for customer adding more items) */}
          {onModifyOrder && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onModifyOrder(order);
              }}
              className="w-full py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
              title="Customer wants to buy more items or change quantities on this bill"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Add Items / Modify This Bill</span>
            </button>
          )}

          {/* Primary Action Buttons: Print & WhatsApp Share */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="py-2.5 px-3 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all min-h-[44px]"
              title="Print thermal receipt (80mm)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              disabled={isSharing}
              className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50 min-h-[44px]"
              title="Share PDF receipt on WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{isSharing ? 'Sharing...' : 'Share PDF on WhatsApp'}</span>
            </button>
          </div>

          {/* Secondary Options: No Receipt — Next Customer & Direct Download */}
          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-stone-50 border border-[#E8DEC8] hover:border-[#C99A18] text-stone-700 hover:text-stone-900 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm min-h-[44px]"
              title="Sale is already saved safely. Start next order immediately."
            >
              <span>No Receipt — Next Customer</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#B8860B]" />
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="p-2 rounded-xl bg-white hover:bg-stone-100 border border-[#E8DEC8] text-stone-600 hover:text-stone-900 transition-colors shadow-sm min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Download Receipt PDF"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
