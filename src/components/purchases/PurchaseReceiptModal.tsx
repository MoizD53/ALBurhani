import React from 'react';
import { X, Printer, Download, Package, CheckCircle2, Clock } from 'lucide-react';
import { PurchaseBill } from '../../types';

interface PurchaseReceiptModalProps {
  bill: PurchaseBill | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PurchaseReceiptModal: React.FC<PurchaseReceiptModalProps> = ({
  bill,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !bill) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-[#E8DEC8] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
        
        {/* Header Action Bar */}
        <div className="px-5 py-3 border-b border-[#E8DEC8] bg-[#FAF8F5] flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-stone-900 font-serif">Purchase Voucher</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#FAF8F5] text-[#8C6D15] border border-[#E8DEC8]">
              {bill.purchaseNumber}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FAF8F5] text-stone-700 hover:text-stone-900 border border-[#E8DEC8] hover:bg-white shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 text-[#B8860B]" />
              <span>Print A4</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Paper */}
        <div className="p-6 sm:p-8 space-y-6 text-stone-900 print:p-0">
          
          {/* Shop Header */}
          <div className="text-center pb-4 border-b-2 border-stone-800 space-y-1">
            <h1 className="text-xl sm:text-2xl font-black font-serif tracking-tight text-stone-950 uppercase">
              AL-BURHANI SWEETS & DRY FRUITS
            </h1>
            <p className="text-xs text-stone-600 font-medium">
              {bill.branch === 'mg_road' ? 'MG Road Outlet' : 'Godi Road, Near Clock Tower'} · Phone: +91 98765 43210
            </p>
            <div className="inline-block mt-1 px-3 py-0.5 bg-stone-100 border border-stone-300 rounded text-[11px] font-bold uppercase tracking-wider">
              Goods Received / Purchase Inward Voucher
            </div>
          </div>

          {/* Voucher Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs font-mono border-b border-stone-200 pb-4">
            <div className="space-y-1">
              <div>
                <span className="text-stone-500">Daily Bill #: </span>
                <span className="font-bold text-stone-900 text-sm">Purchase Bill #{bill.dailyBillNumber}</span>
              </div>
              <div>
                <span className="text-stone-500">Internal Ref: </span>
                <span className="font-bold">{bill.purchaseNumber}</span>
              </div>
              <div>
                <span className="text-stone-500">Supplier: </span>
                <span className="font-bold text-stone-900">{bill.vendorName}</span>
              </div>
              {bill.vendorContact && (
                <div>
                  <span className="text-stone-500">Contact: </span>
                  <span>{bill.vendorContact}</span>
                </div>
              )}
            </div>

            <div className="space-y-1 text-right">
              <div>
                <span className="text-stone-500">Purchase Date: </span>
                <span className="font-bold text-stone-900">{bill.purchaseDate}</span>
              </div>
              {bill.vendorInvoiceNumber && (
                <div>
                  <span className="text-stone-500">Supplier Inv #: </span>
                  <span className="font-bold">{bill.vendorInvoiceNumber}</span>
                </div>
              )}
              <div>
                <span className="text-stone-500">Payment Mode: </span>
                <span className="font-bold">{bill.paymentMode}</span>
              </div>
              <div>
                <span className="text-stone-500">Payment Status: </span>
                <span className={`font-bold ${bill.paymentStatus === 'Paid' ? 'text-emerald-700' : 'text-amber-800'}`}>
                  {bill.paymentStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-stone-300 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 font-bold text-stone-700 uppercase border-b border-stone-300">
                <tr>
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Item Description</th>
                  <th className="py-2 px-3 text-center">Quantity</th>
                  <th className="py-2 px-3 text-right">Rate / Unit</th>
                  <th className="py-2 px-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 font-mono">
                {bill.items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-stone-50">
                    <td className="py-2 px-3 text-stone-400">{idx + 1}</td>
                    <td className="py-2 px-3 font-semibold text-stone-900">{it.productName}</td>
                    <td className="py-2 px-3 text-center font-bold">{it.quantity} {it.unit}</td>
                    <td className="py-2 px-3 text-right">Rs. {it.unitPrice.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-bold text-stone-900">Rs. {it.lineTotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="flex justify-end pt-2">
            <div className="w-64 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-stone-600">
                <span>Subtotal:</span>
                <span>Rs. {bill.subtotal.toFixed(2)}</span>
              </div>
              {bill.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span>−Rs. {bill.discount.toFixed(2)}</span>
                </div>
              )}
              {bill.additionalCharges > 0 && (
                <div className="flex justify-between text-stone-600">
                  <span>Freight/Charges:</span>
                  <span>+Rs. {bill.additionalCharges.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold border-t-2 border-stone-800 pt-1 text-stone-950">
                <span>Grand Total:</span>
                <span className="text-base">Rs. {bill.grandTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-stone-700 pt-0.5">
                <span>Amount Paid:</span>
                <span className="text-emerald-700 font-bold">Rs. {bill.amountPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-stone-200 pt-1">
                <span className={bill.balanceDue > 0 ? 'text-amber-800' : 'text-emerald-700'}>Balance Due:</span>
                <span className={bill.balanceDue > 0 ? 'text-amber-900 text-sm font-black' : 'text-emerald-700'}>
                  Rs. {bill.balanceDue.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment History Table (if payments recorded) */}
          {bill.payments && bill.payments.length > 0 && (
            <div className="pt-3 border-t border-stone-200 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 font-mono">
                Payment Audit Trail ({bill.payments.length})
              </span>
              <table className="w-full text-left text-[11px] font-mono border border-stone-200 rounded">
                <thead className="bg-stone-50 text-stone-600 border-b border-stone-200">
                  <tr>
                    <th className="py-1 px-2">Date</th>
                    <th className="py-1 px-2">Mode</th>
                    <th className="py-1 px-2">Notes</th>
                    <th className="py-1 px-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {bill.payments.map((p, pIdx) => (
                    <tr key={pIdx}>
                      <td className="py-1 px-2">{p.paymentDate}</td>
                      <td className="py-1 px-2">{p.paymentMode}</td>
                      <td className="py-1 px-2 text-stone-500">{p.notes || '—'}</td>
                      <td className="py-1 px-2 text-right font-bold text-emerald-800">Rs. {p.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Signatures Footer */}
          <div className="grid grid-cols-2 gap-8 pt-10 text-xs text-center border-t border-dashed border-stone-300">
            <div>
              <div className="border-t border-stone-400 w-36 mx-auto pt-1 font-semibold text-stone-600">
                Supplier Signature
              </div>
            </div>
            <div>
              <div className="border-t border-stone-400 w-36 mx-auto pt-1 font-semibold text-stone-600">
                Authorised Store Receiver
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
