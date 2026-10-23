import React, { useState } from 'react';
import { X, Check, IndianRupee, AlertCircle } from 'lucide-react';
import { PurchaseBill, VendorPayment } from '../../types';
import { getKolkataDateString } from '../../lib/utils';

interface AddVendorPaymentModalProps {
  bill: PurchaseBill | null;
  isOpen: boolean;
  onClose: () => void;
  onSavePayment: (payment: VendorPayment) => Promise<boolean>;
}

export const AddVendorPaymentModal: React.FC<AddVendorPaymentModalProps> = ({
  bill,
  isOpen,
  onClose,
  onSavePayment,
}) => {
  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState(() => getKolkataDateString(Date.now()));
  const [paymentMode, setPaymentMode] = useState<string>('Cash');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !bill) return null;

  const currentDue = bill.balanceDue;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0) {
      setError('Please enter a valid payment amount greater than Rs. 0');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payment: VendorPayment = {
      id: `pay-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      purchaseBillId: bill.id,
      vendorId: bill.vendorId,
      paymentDate,
      amount: numAmount,
      paymentMode,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    try {
      const ok = await onSavePayment(payment);
      if (ok) {
        onClose();
      } else {
        setError('Failed to record payment. Please check your connection.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error recording vendor payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-[#E8DEC8] rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E8DEC8] bg-[#FAF8F5] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-stone-900 font-serif">
              Record Vendor Payment
            </h3>
            <span className="text-xs text-stone-500 font-mono">
              Bill: {bill.purchaseNumber} ({bill.vendorName})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Balance Display */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between font-mono text-xs">
            <span className="text-amber-800 font-semibold">Current Balance Due:</span>
            <span className="text-amber-900 font-black text-sm">Rs. {currentDue.toFixed(2)}</span>
          </div>

          <div>
            <label className="text-xs font-bold text-stone-700 block mb-1">
              Payment Amount (Rs.) <span className="text-rose-600">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                min="0.01"
                required
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Max Rs. ${currentDue.toFixed(2)}`}
                className="w-full px-3 py-2 text-sm bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 font-mono font-bold focus:bg-white focus:border-[#C99A18] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setAmount(currentDue.toString())}
                className="px-3 py-1 rounded-xl text-xs font-bold bg-[#FAF8F5] text-[#8C6D15] border border-[#C99A18]/40 hover:bg-[#F3EAD3] whitespace-nowrap"
              >
                Clear Full
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">
                Payment Date
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 font-mono font-bold focus:bg-white focus:border-[#C99A18] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">
                Payment Mode
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 font-semibold focus:bg-white focus:border-[#C99A18] focus:outline-none"
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI / QR</option>
                <option value="Bank Transfer">Bank Transfer / NEFT</option>
                <option value="Cheque">Cheque</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-stone-700 block mb-1">
              Payment Notes / Reference #
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. UPI Ref #439281, partial settlement"
              className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 focus:bg-white focus:border-[#C99A18] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E8DEC8]">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5] border border-[#E8DEC8]"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="py-2 px-5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-105 shadow-md flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Record Payment'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
