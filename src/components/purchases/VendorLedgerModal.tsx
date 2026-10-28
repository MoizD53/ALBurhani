import React, { useMemo } from 'react';
import { X, Printer, IndianRupee, FileText, ArrowDownRight, ArrowUpRight, Phone, MapPin, Calendar } from 'lucide-react';
import { Vendor, PurchaseBill, VendorPayment } from '../../types';

interface VendorLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: Vendor | null;
  bills: PurchaseBill[];
  onAddPayment?: (bill: PurchaseBill) => void;
  onViewBill?: (bill: PurchaseBill) => void;
}

interface LedgerEntry {
  id: string;
  date: string;
  type: 'PURCHASE' | 'PAYMENT';
  reference: string;
  description: string;
  debit: number; // Purchase increases what we owe
  credit: number; // Payment reduces what we owe
  balance: number;
  billRef?: PurchaseBill;
}

export const VendorLedgerModal: React.FC<VendorLedgerModalProps> = ({
  isOpen,
  onClose,
  vendor,
  bills,
  onAddPayment,
  onViewBill,
}) => {
  // Filter bills for this vendor
  const vendorBills = useMemo(() => {
    if (!isOpen || !vendor) return [];
    return bills.filter(
      (b) =>
        (b.vendorId && b.vendorId === vendor.id) ||
        b.vendorName.trim().toLowerCase() === vendor.name.trim().toLowerCase()
    );
  }, [bills, vendor]);

  // Build chronological ledger entries
  const ledgerEntries = useMemo(() => {
    if (!isOpen || !vendor) return [];
    const rawEvents: Array<{
      id: string;
      date: string;
      type: 'PURCHASE' | 'PAYMENT';
      reference: string;
      description: string;
      debit: number;
      credit: number;
      billRef?: PurchaseBill;
    }> = [];

    vendorBills.forEach((bill) => {
      // 1. Initial Purchase Bill
      rawEvents.push({
        id: `bill-${bill.id}`,
        date: bill.purchaseDate || (bill.createdAt ? bill.createdAt.slice(0, 10) : ''),
        type: 'PURCHASE',
        reference: `${bill.purchaseNumber} (Daily #${bill.dailyBillNumber})`,
        description: `Purchase: ${bill.items.length} item${bill.items.length !== 1 ? 's' : ''}${
          bill.vendorInvoiceNumber ? ` • Inv #${bill.vendorInvoiceNumber}` : ''
        }${bill.status === 'Cancelled' ? ' [CANCELLED]' : ''}`,
        debit: bill.status === 'Cancelled' ? 0 : bill.grandTotal,
        credit: 0,
        billRef: bill,
      });

      // 2. Initial payment made at purchase creation (if any)
      if (bill.amountPaid > 0 && (!bill.payments || bill.payments.length === 0)) {
        rawEvents.push({
          id: `pay-init-${bill.id}`,
          date: bill.purchaseDate || (bill.createdAt ? bill.createdAt.slice(0, 10) : ''),
          type: 'PAYMENT',
          reference: `Payment for ${bill.purchaseNumber}`,
          description: `Initial payment via ${bill.paymentMode || 'Cash'}`,
          debit: 0,
          credit: bill.status === 'Cancelled' ? 0 : bill.amountPaid,
          billRef: bill,
        });
      }

      // 3. Subsequent payments attached to the bill
      if (bill.payments && bill.payments.length > 0) {
        bill.payments.forEach((p, idx) => {
          rawEvents.push({
            id: p.id || `pay-${bill.id}-${idx}`,
            date: p.paymentDate || (p.createdAt ? p.createdAt.slice(0, 10) : ''),
            type: 'PAYMENT',
            reference: `Pay: ${bill.purchaseNumber}`,
            description: `Payment via ${p.paymentMode}${p.notes ? ` • ${p.notes}` : ''}`,
            debit: 0,
            credit: p.amount,
            billRef: bill,
          });
        });
      }
    });

    // Sort chronologically ascending
    rawEvents.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    // Compute running balance
    let runningBalance = 0;
    return rawEvents.map((ev) => {
      runningBalance += ev.debit - ev.credit;
      return {
        ...ev,
        balance: runningBalance,
      };
    });
  }, [vendorBills, isOpen, vendor]);

  if (!isOpen || !vendor) return null;

  const totalPurchases = ledgerEntries.reduce((sum, e) => sum + e.debit, 0);
  const totalPaid = ledgerEntries.reduce((sum, e) => sum + e.credit, 0);
  const currentBalanceDue = totalPurchases - totalPaid;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-[#E8DEC8] rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
        
        {/* Header Action Bar */}
        <div className="px-5 py-3 border-b border-[#E8DEC8] bg-[#FAF8F5] flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#B8860B]" />
            <h3 className="font-bold text-sm text-stone-900 font-serif">Vendor Statement Ledger</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#FAF8F5] text-[#8C6D15] border border-[#E8DEC8]">
              {vendor.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FAF8F5] text-stone-700 hover:text-stone-900 border border-[#E8DEC8] hover:bg-white shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 text-[#B8860B]" />
              <span>Print Statement</span>
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

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Vendor Card & Summary */}
          <div className="bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold font-serif text-stone-900">{vendor.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-stone-600">
                  {vendor.contactNumber && (
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Phone className="w-3 h-3 text-[#B8860B]" />
                      {vendor.contactNumber}
                    </span>
                  )}
                  {vendor.address && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#B8860B]" />
                      {vendor.address}
                    </span>
                  )}
                  <span className="text-stone-400">•</span>
                  <span>{vendorBills.length} Bill{vendorBills.length !== 1 ? 's' : ''} on record</span>
                </div>
              </div>

              {/* Outstanding Balance Pill */}
              <div className="bg-white border border-[#E8DEC8] rounded-xl p-3 sm:text-right shadow-xs">
                <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">
                  Net Outstanding Balance
                </span>
                <span
                  className={`text-xl font-black font-mono tracking-tight ${
                    currentBalanceDue > 0 ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  ₹{currentBalanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-stone-500 block">
                  {currentBalanceDue > 0 ? 'Payable to Vendor' : 'All Dues Cleared'}
                </span>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#E8DEC8]">
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-500 block">Total Purchases</span>
                <span className="text-sm font-bold font-mono text-stone-900">
                  ₹{totalPurchases.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-500 block">Total Paid</span>
                <span className="text-sm font-bold font-mono text-emerald-700">
                  ₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-500 block">Remaining Due</span>
                <span className="text-sm font-bold font-mono text-amber-700">
                  ₹{Math.max(0, currentBalanceDue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Statement Table */}
          <div className="overflow-x-auto border border-[#E8DEC8] rounded-xl bg-white shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#FAF8F5] text-stone-700 font-semibold uppercase text-[10px] tracking-wider border-b border-[#E8DEC8]">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Reference / Details</th>
                  <th className="py-2.5 px-3 text-right">Debit (Purchased)</th>
                  <th className="py-2.5 px-3 text-right">Credit (Paid)</th>
                  <th className="py-2.5 px-3 text-right">Running Balance</th>
                  <th className="py-2.5 px-3 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DEC8]/60">
                {ledgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-stone-500 italic">
                      No purchase transactions or payments recorded for this vendor yet.
                    </td>
                  </tr>
                ) : (
                  ledgerEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-stone-600 whitespace-nowrap">
                        {entry.date}
                      </td>
                      <td className="py-2.5 px-3">
                        {entry.type === 'PURCHASE' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <ArrowDownRight className="w-2.5 h-2.5" /> Purchase
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <ArrowUpRight className="w-2.5 h-2.5" /> Payment
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-stone-900">{entry.reference}</div>
                        <div className="text-[11px] text-stone-500">{entry.description}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-stone-900">
                        {entry.debit > 0 ? `₹${entry.debit.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-emerald-700">
                        {entry.credit > 0 ? `₹${entry.credit.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-stone-900">
                        ₹{entry.balance.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center print:hidden">
                        {entry.billRef && (
                          <div className="flex items-center justify-center gap-1.5">
                            {onViewBill && (
                              <button
                                type="button"
                                onClick={() => onViewBill(entry.billRef!)}
                                className="px-2 py-1 text-[11px] font-bold text-[#8C6D15] hover:text-[#5E470B] hover:bg-amber-50 rounded"
                              >
                                View
                              </button>
                            )}
                            {onAddPayment && entry.billRef.balanceDue > 0 && entry.billRef.status !== 'Cancelled' && (
                              <button
                                type="button"
                                onClick={() => onAddPayment(entry.billRef!)}
                                className="px-2 py-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded"
                              >
                                Pay
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>

      </div>
    </div>
  );
};
