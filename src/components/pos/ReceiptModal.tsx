import React, { useEffect } from 'react';
import { OrderBill } from '../../types';
import { X, Printer, CheckCircle, FlaskConical } from 'lucide-react';

interface ReceiptModalProps {
  order: OrderBill | null;
  onClose: () => void;
  isTestMode?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ order, onClose, isTestMode }) => {
  // Global Escape keydown listener (runs unconditionally before early return)
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

  if (!order) return null;

  const isTest = Boolean(isTestMode || order.billNumber.startsWith('ALB-SIM'));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-fade-in select-none"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-sm rounded-2xl bg-[#121214] border shadow-[0_24px_70px_rgba(0,0,0,0.95)] overflow-hidden max-h-[92vh] flex flex-col ${
          isTest ? 'border-amber-500/50 ring-1 ring-amber-500/20' : 'border-[#D4AF37]/35'
        }`}
      >
        
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3.5 border-b shrink-0 ${
          isTest ? 'border-amber-500/20 bg-amber-950/20' : 'border-white/[0.08] bg-[#161619]'
        }`}>
          <div className="flex items-center gap-2">
            {isTest ? (
              <>
                <FlaskConical className="w-4 h-4 text-amber-400" />
                <div>
                  <h3 className="font-semibold text-amber-300 text-sm">Simulated Receipt (Dry Run)</h3>
                  <p className="text-[10px] text-amber-400/80">No real stock or sales recorded</p>
                </div>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-white text-sm">Bill Generated Successfully</h3>
              </>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Receipt Content Body */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col items-center custom-scrollbar">
          
          <div 
            id="thermal-receipt"
            className="w-[280px] bg-white text-black p-3.5 rounded shadow border border-gray-300 font-mono text-[11px] leading-snug select-none"
          >
            {isTest && (
              <div className="bg-amber-100 border border-amber-400 text-amber-950 p-1.5 rounded mb-2 text-center text-[8px] font-bold leading-tight">
                ⚠️ TEST MODE — DRY RUN SIMULATION<br />
                NOT A VALID TAX INVOICE<br />
                REAL STOCK & LEDGER UNTOUCHED
              </div>
            )}

            {/* Store Header */}
            <div className="text-center pb-2 border-b border-black">
              <h2 className="font-bold text-sm tracking-widest uppercase">AL-BHURANI</h2>
              <p className="text-[9px] uppercase font-semibold">Sweets & Dry Items Franchise</p>
              <p className="text-[9px] text-gray-700">Godi Road, Near Clock Tower</p>
              <p className="text-[8px] text-gray-600">GSTIN: 24AABCA1234F1Z5 | Ph: +91 98765 43210</p>
            </div>

            {/* Bill Meta */}
            <div className="py-2 border-b border-dashed border-black text-[9px] space-y-0.5">
              <div className="flex justify-between">
                <span>Bill No: {order.billNumber}</span>
                <span>Date: {order.createdAt}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier: {order.cashierName}</span>
                <span>Mode: {order.paymentMethod}</span>
              </div>
              {order.customerPhone && (
                <div>Customer: {order.customerName || 'Walk-in'} ({order.customerPhone})</div>
              )}
            </div>

            {/* Items Table */}
            <div className="py-2 border-b border-black">
              <div className="grid grid-cols-12 font-bold text-[9px] pb-1 border-b border-gray-400">
                <span className="col-span-5">ITEM</span>
                <span className="col-span-2 text-center">QTY</span>
                <span className="col-span-2 text-right">RATE</span>
                <span className="col-span-3 text-right">AMT</span>
              </div>

              <div className="space-y-1.5 pt-1 text-[9px]">
                {order.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 leading-tight">
                    <div className="col-span-5 truncate">
                      <div className="font-semibold truncate">{it.product.name}</div>
                      <div className="text-[8px] text-gray-600">[{it.product.sku}]</div>
                    </div>
                    <div className="col-span-2 text-center font-medium">
                      {it.formattedQuantity || it.quantity}
                    </div>
                    <div className="col-span-2 text-right">
                      {it.product.sellingPrice}
                    </div>
                    <div className="col-span-3 text-right font-medium">
                      ₹{it.lineTotal.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="py-2 space-y-0.5 text-[10px] border-b border-dashed border-black">
              <div className="flex justify-between">
                <span>Sub Total:</span>
                <span>₹{order.subtotal.toFixed(2)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Discount:</span>
                  <span>-₹{order.discountAmount.toFixed(2)}</span>
                </div>
              )}
              {order.gstAmount > 0 && (
                <div className="flex justify-between text-[9px] text-gray-600">
                  <span>CGST (2.5%) + SGST (2.5%):</span>
                  <span>₹{order.gstAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs font-bold border-t border-black pt-1 mt-1">
                <span>GRAND TOTAL:</span>
                <span>₹{order.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="py-1.5 text-[9px] space-y-0.5 border-b border-dashed border-black">
              <div className="flex justify-between">
                <span>Paid via {order.paymentMethod}:</span>
                <span>₹{order.amountReceived.toFixed(2)}</span>
              </div>
              {order.changeGiven > 0 && (
                <div className="flex justify-between font-semibold">
                  <span>Change Returned:</span>
                  <span>₹{order.changeGiven.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Footer Greeting */}
            <div className="text-center pt-2 text-[8px] text-gray-700">
              <p className="font-semibold">Pure Desi Ghee & Fresh Guarantee</p>
              <p>*** Thank You For Visiting AL-BHURANI! ***</p>
            </div>
          </div>

        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.08] bg-[#161619] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] transition-all cursor-pointer shadow-sm active:scale-95"
            title="Start new order (or press Escape)"
          >
            New Order (Esc)
          </button>

          <button
            onClick={handlePrint}
            className="btn-gold text-xs py-1.5 px-4 flex items-center gap-1.5 font-bold"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Receipt</span>
          </button>
        </div>

      </div>
    </div>
  );
};
