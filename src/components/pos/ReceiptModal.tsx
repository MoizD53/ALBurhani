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
  Edit2
} from 'lucide-react';
import { shareReceiptPdfWhatsApp, downloadReceiptPdf } from '../../lib/pdfReceipt';

interface ReceiptModalProps {
  order: OrderBill | null;
  onClose: () => void;
  onModifyOrder?: (order: OrderBill) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ order, onClose, onModifyOrder }) => {
  const [feedback, setFeedback] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // Global Escape keydown listener (closes modal without altering saved sale)
  useEffect(() => {
    if (!order) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [order, onClose]);

  // Reset feedback whenever order changes
  useEffect(() => {
    setFeedback(null);
    setIsSharing(false);
  }, [order?.id]);

  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = async () => {
    setIsSharing(true);
    setFeedback(null);
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
  };

  const handleDownload = () => {
    downloadReceiptPdf(order);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-fade-in select-none print:p-0 print:bg-white print:static print:block"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl bg-[#121214] border border-[#D4AF37]/35 shadow-[0_24px_70px_rgba(0,0,0,0.95)] overflow-hidden max-h-[92vh] flex flex-col print:border-none print:shadow-none print:max-h-none print:w-auto print:max-w-none print:static print:overflow-visible print:bg-white"
      >
        
        {/* Header (Hidden when printing) */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-[#161619] shrink-0 print:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle className={`w-4 h-4 shrink-0 ${order.isRevised ? 'text-amber-400' : 'text-emerald-400'}`} />
            <div className="min-w-0">
              <h3 className="font-semibold text-white text-xs truncate">
                {order.isRevised ? 'Bill Revised Successfully' : 'Sale Saved Successfully'}
              </h3>
              <p className="text-[10px] text-zinc-400 font-mono truncate">
                {order.billNumber}{order.isRevised ? ` · Revised ${order.revisedAt || ''}` : ''}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors"
            title="Close / Next Customer (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* WhatsApp / Download Feedback Notice (Hidden when printing) */}
        {feedback && (
          <div className={`px-4 py-2 border-b text-xs flex items-start gap-2 shrink-0 print:hidden animate-fade-in ${
            feedback.type === 'success' 
              ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-200'
              : feedback.type === 'error'
              ? 'bg-red-950/60 border-red-500/30 text-red-200'
              : 'bg-amber-950/60 border-amber-500/30 text-amber-200'
          }`}>
            {feedback.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            )}
            <p className="text-[11px] leading-tight flex-1">{feedback.message}</p>
          </div>
        )}

        {/* Receipt Content Body */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 flex flex-col items-center custom-scrollbar print:p-0 print:overflow-visible">
          
          <div 
            id="thermal-receipt"
            style={{
              color: '#000000',
              backgroundColor: '#FFFFFF',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact',
            }}
            className="w-[72mm] max-w-[72mm] bg-white text-black p-3 rounded shadow border border-black font-sans text-[9.5px] leading-snug select-none print:w-[72mm] print:max-w-[72mm] print:border-none print:shadow-none print:p-1.5 print:m-0"
          >

            {/* Store Header Branding (Solid Black, Bold) */}
            <div className="text-center pb-2 border-b-2 border-black">
              <img
                src="/logo.png"
                alt="AL-BHURANI Logo"
                className="w-10 h-10 mx-auto mb-1 rounded-full object-contain"
              />
              <h2 className="font-black text-base tracking-wider uppercase text-black">AL-BHURANI</h2>
              <p className="text-[9px] uppercase font-bold text-black">Sweets & Dry Items Franchise</p>
              <p className="text-[8.5px] font-semibold text-black">Godi Road, Near Clock Tower</p>
              <p className="text-[8.5px] font-semibold text-black">Ph: +91 98765 43210</p>
              {hasGst ? (
                <div className="mt-1 pt-1 border-t border-black">
                  <p className="text-[9px] font-black text-black">GSTIN: 24AABCA1234F1Z5</p>
                  <span className={`inline-block px-1.5 py-0.5 text-[8px] font-black rounded mt-0.5 border border-black ${
                    order.isRevised
                      ? 'bg-amber-100 text-black'
                      : 'bg-white text-black'
                  }`}>
                    {order.isRevised ? 'REVISED TAX INVOICE (GST INCL)' : 'TAX INVOICE (GST INCLUSIVE)'}
                  </span>
                </div>
              ) : (
                <div className="mt-1 pt-1 border-t border-black">
                  <span className={`inline-block px-1.5 py-0.5 text-[8px] font-black rounded mt-0.5 border border-black ${
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
            <div className="py-1.5 border-b border-dashed border-black text-[9px] font-bold text-black space-y-0.5">
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
            <div className="py-1.5 border-b border-black">
              <table className="w-full text-[9.5px] border-collapse">
                <thead>
                  <tr className="border-b-2 border-black font-black text-black">
                    <th className="text-left pb-1 font-black text-black">ITEM</th>
                    <th className="text-center pb-1 w-12 font-black text-black">QTY</th>
                    <th className="text-right pb-1 w-12 font-black text-black">RATE</th>
                    <th className="text-right pb-1 w-14 font-black text-black">AMT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/30">
                  {order.items.map((it, idx) => (
                    <tr key={idx} className="align-top">
                      <td className="py-1 pr-1 text-left">
                        <div className="font-extrabold text-black break-words leading-tight">{it.product.name}</div>
                        <div className="text-[8px] font-bold text-black font-mono">[{it.product.sku}]</div>
                      </td>
                      <td className="py-1 px-1 text-center font-black text-black whitespace-nowrap">
                        {it.formattedQuantity || it.quantity}
                      </td>
                      <td className="py-1 px-1 text-right font-black text-black whitespace-nowrap tabular-nums">
                        ₹{it.unitPrice}
                      </td>
                      <td className="py-1 pl-1 text-right font-black text-black whitespace-nowrap tabular-nums">
                        ₹{it.lineTotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals & Inclusive GST Breakdown (Pure Black, Bold) */}
            <div className="py-1.5 space-y-1 text-[10px] font-bold text-black border-b border-dashed border-black">
              <div className="flex justify-between items-center">
                <span>Subtotal {hasGst ? '(Incl. GST)' : ''}:</span>
                <span className="tabular-nums font-black text-black">₹{order.subtotal.toFixed(2)}</span>
              </div>

              {order.discountAmount > 0 && (
                <div className="flex justify-between items-center text-black font-black">
                  <span>Discount Savings:</span>
                  <span className="tabular-nums">−₹{order.discountAmount.toFixed(2)}</span>
                </div>
              )}

              {/* Explicit Inclusive GST Breakdown without adding on top (Dark Black) */}
              {hasGst && (
                <div className="pt-1 border-t border-dotted border-black space-y-0.5 text-[9px] font-bold text-black">
                  <div className="flex justify-between font-black">
                    <span>Included 5% GST:</span>
                    <span className="tabular-nums">₹{order.gstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pl-2">
                    <span>• CGST (2.5%):</span>
                    <span className="tabular-nums font-extrabold">₹{cgstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pl-2">
                    <span>• SGST (2.5%):</span>
                    <span className="tabular-nums font-extrabold">₹{sgstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pl-2">
                    <span>• Taxable Value:</span>
                    <span className="tabular-nums font-extrabold">₹{taxableValue.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Grand Total (Prominent Double Line Jet Black) */}
              <div className="flex justify-between items-center text-sm font-black text-black border-t-2 border-black pt-1 mt-1">
                <span>GRAND TOTAL:</span>
                <span className="tabular-nums font-black">₹{order.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Details (Solid Black, Bold) */}
            {order.isRevised && order.originalGrandTotal !== undefined ? (
              <div className="py-1 text-[9px] font-bold text-black space-y-0.5 border-b border-dashed border-black">
                <div className="flex justify-between">
                  <span>Original Total:</span>
                  <span className="tabular-nums font-black">₹{order.originalGrandTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Previously Paid ({order.originalPaymentMethod || order.paymentMethod}):</span>
                  <span className="tabular-nums font-black">₹{order.originalGrandTotal.toFixed(2)}</span>
                </div>
                {order.additionalAmountPaid !== undefined && (
                  <div className="flex justify-between font-black text-black">
                    <span>Additional Paid ({order.additionalPaymentMethod || order.paymentMethod}):</span>
                    <span className="tabular-nums">₹{order.additionalAmountPaid.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black border-t border-dotted border-black pt-0.5">
                  <span>Total Settled:</span>
                  <span className="tabular-nums font-black">₹{order.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div className="py-1 text-[9px] font-bold text-black space-y-0.5 border-b border-dashed border-black">
                <div className="flex justify-between">
                  <span>Paid via {order.paymentMethod}:</span>
                  <span className="font-black tabular-nums">₹{order.amountReceived.toFixed(2)}</span>
                </div>
                {order.changeGiven > 0 && (
                  <div className="flex justify-between font-black">
                    <span>Change Returned:</span>
                    <span className="tabular-nums">₹{order.changeGiven.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Footer Greeting (Dark Black Bold) */}
            <div className="text-center pt-2 text-[8.5px] font-black text-black">
              <p>*** Thank You For Visiting AL-BHURANI! ***</p>
            </div>
          </div>

        </div>

        {/* Action Controls: 3 Clear Choices & Modify Bill (Hidden when printing) */}
        <div className="p-3 border-t border-white/[0.08] bg-[#161619] shrink-0 space-y-2 print:hidden">
          
          {/* Modify Bill Action (Reopen in POS for customer adding more items) */}
          {onModifyOrder && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onModifyOrder(order);
              }}
              className="w-full py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
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
              className="py-2.5 px-3 rounded-xl btn-gold text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
              title="Print thermal receipt (80mm)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              disabled={isSharing}
              className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50"
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
              className="flex-1 py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] hover:border-[#D4AF37]/50 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
              title="Sale is already saved safely. Start next order immediately."
            >
              <span>No Receipt — Next Customer</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#D4AF37]" />
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-400 hover:text-white transition-colors"
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
