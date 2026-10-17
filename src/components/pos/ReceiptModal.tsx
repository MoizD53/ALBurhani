import React from 'react';
import { OrderBill } from '../../types';
import { X, Printer, CheckCircle, Share2 } from 'lucide-react';

interface ReceiptModalProps {
  order: OrderBill | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ order, onClose }) => {
  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-md rounded-2xl bg-[#121212] border border-[#D4AF37]/30 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D4AF37]/15 bg-[#171717]">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle className="w-5 h-5" />
            <h3 className="font-semibold text-white">Bill Completed Successfully</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Content */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center">
          
          <div 
            id="thermal-receipt"
            className="w-[300px] bg-white text-black p-4 rounded shadow border border-gray-300 font-mono text-xs leading-relaxed select-none"
          >
            {/* Store Header */}
            <div className="text-center pb-2 border-b border-black">
              <h2 className="font-bold text-sm tracking-widest uppercase">AL-BHURANI</h2>
              <p className="text-[10px] uppercase font-semibold">Sweets & Dry Items Franchise</p>
              <p className="text-[9px] text-gray-700">Station Road, Near Clock Tower</p>
              <p className="text-[9px] text-gray-700">GSTIN: 24AABCA1234F1Z5 | Ph: +91 98765 43210</p>
            </div>

            {/* Bill Meta */}
            <div className="py-2 border-b border-dashed border-black text-[10px] space-y-0.5">
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
              <div className="grid grid-cols-12 font-bold text-[10px] pb-1 border-b border-gray-400">
                <span className="col-span-6">ITEM</span>
                <span className="col-span-2 text-center">QTY</span>
                <span className="col-span-2 text-right">RATE</span>
                <span className="col-span-2 text-right">AMT</span>
              </div>

              <div className="space-y-1.5 pt-1 text-[10px]">
                {order.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 leading-tight">
                    <div className="col-span-6">
                      <div className="font-semibold">{it.product.name}</div>
                      <div className="text-[8px] text-gray-600">[{it.product.netWeight}]</div>
                    </div>
                    <div className="col-span-2 text-center">{it.quantity}</div>
                    <div className="col-span-2 text-right">{it.product.sellingPrice}</div>
                    <div className="col-span-2 text-right font-medium">
                      {(it.quantity * it.product.sellingPrice).toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="py-2 space-y-1 text-[11px] border-b border-dashed border-black">
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
              <div className="flex justify-between text-[10px] text-gray-600">
                <span>CGST (2.5%) + SGST (2.5%):</span>
                <span>₹{order.gstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-black pt-1">
                <span>GRAND TOTAL:</span>
                <span>₹{order.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="py-2 text-[10px] space-y-0.5 border-b border-dashed border-black">
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
            <div className="text-center pt-2 text-[9px] text-gray-700">
              <p className="font-semibold">Pure Desi Ghee & Fresh Guarantee</p>
              <p>*** Thank You For Visiting AL-BHURANI! ***</p>
            </div>
          </div>

        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#D4AF37]/15 bg-[#161616]">
          <button
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-white"
          >
            New Order (Esc)
          </button>

          <button
            onClick={handlePrint}
            className="btn-gold flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print Thermal Receipt
          </button>
        </div>

      </div>
    </div>
  );
};
