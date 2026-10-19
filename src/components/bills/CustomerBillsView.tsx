import React, { useState, useEffect } from 'react';
import { OrderBill } from '../../types';
import { 
  FileText, 
  Search, 
  Printer, 
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Edit2
} from 'lucide-react';
import { ReceiptModal } from '../pos/ReceiptModal';

interface CustomerBillsViewProps {
  orders: OrderBill[];
  onDeleteOrder?: (orderId: string) => Promise<boolean> | boolean | void;
  onModifyOrder?: (order: OrderBill) => void;
}

export const CustomerBillsView: React.FC<CustomerBillsViewProps> = ({ orders, onDeleteOrder, onModifyOrder }) => {
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<OrderBill | null>(null);

  // Deletion modal & feedback state
  const [pendingDeleteInvoice, setPendingDeleteInvoice] = useState<OrderBill | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-dismiss feedback message after 4 seconds
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  // Filter only formal customer bills
  const customerBills = orders.filter((o) => o.transactionType === 'CUSTOMER_BILL' || !o.transactionType);

  const filteredBills = customerBills.filter((bill) => {
    const matchesPayment = paymentFilter === 'ALL' || bill.paymentMethod === paymentFilter;
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      bill.billNumber.toLowerCase().includes(q) ||
      (bill.customerName && bill.customerName.toLowerCase().includes(q)) ||
      (bill.customerPhone && bill.customerPhone.includes(q)) ||
      bill.createdAt.toLowerCase().includes(q);

    return matchesPayment && matchesSearch;
  });

  const totalBilledRevenue = customerBills.reduce((sum, b) => sum + b.grandTotal, 0);

  // Execute confirmed invoice deletion
  const handleExecuteDelete = async () => {
    if (!pendingDeleteInvoice || isDeleting) return;

    const targetInvoice = pendingDeleteInvoice;
    setIsDeleting(true);
    setDeletingId(targetInvoice.id);

    try {
      if (onDeleteOrder) {
        const result = await onDeleteOrder(targetInvoice.id);
        if (result === false) {
          setFeedback({
            type: 'error',
            message: `Could not delete invoice ${targetInvoice.billNumber}. Please try again.`,
          });
        } else {
          setFeedback({
            type: 'success',
            message: `Invoice ${targetInvoice.billNumber} (₹${targetInvoice.grandTotal.toFixed(2)}) was deleted successfully.`,
          });
        }
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || `Failed to delete invoice ${targetInvoice.billNumber}.`,
      });
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
      setPendingDeleteInvoice(null);
    }
  };

  return (
    <div className="space-y-4 select-none">
      
      {/* Top Header & Metrics */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 font-serif">
            <FileText className="w-5 h-5 text-[#D4AF37]" />
            <span>Customer Tax Invoices</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Formal customer billing records with GST compliance and thermal reprint
          </p>
        </div>

        {/* Quick KPI stats */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Total Bills</span>
            <span className="text-sm font-bold font-mono text-white">{customerBills.length} Invoices</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/25">
            <span className="text-[10px] uppercase font-semibold text-[#D4AF37] block">Billed Revenue</span>
            <span className="text-sm font-bold font-mono text-[#E5C158]">
              ₹{totalBilledRevenue.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Action Notification Banner */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Controls: Search & Payment Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        
        {/* Search */}
        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer, phone, date..."
            style={{ paddingLeft: '40px' }}
            className="w-full pr-8 py-1.5 text-xs bg-black/40 border border-white/[0.08] rounded-xl text-white placeholder:text-zinc-500 focus:border-[#D4AF37]/50 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Payment Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {(['ALL', 'CASH', 'UPI', 'CARD'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setPaymentFilter(mode)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                paymentFilter === mode
                  ? 'bg-[#D4AF37] text-black shadow-sm'
                  : 'bg-white/[0.03] text-zinc-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.06]'
              }`}
            >
              {mode === 'ALL' ? 'All Modes' : mode}
            </button>
          ))}
        </div>

      </div>

      {/* Invoices Table */}
      <div className="rounded-2xl bg-[#121214] border border-white/[0.08] overflow-hidden shadow-xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] bg-[#161619] text-zinc-400 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Customer Details</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-right">Subtotal</th>
                <th className="py-3 px-4 text-right">GST (5%)</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-center">Mode</th>
                {onModifyOrder && <th className="py-3 px-3 text-center">Modify</th>}
                <th className="py-3 px-4 text-center">Receipt</th>
                <th className="py-3 px-4 text-center">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-zinc-500">
                    No customer invoices found matching your search.
                  </td>
                </tr>
              ) : (
                filteredBills.map((b) => (
                  <tr key={b.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#D4AF37] whitespace-nowrap">
                      {b.billNumber}
                    </td>
                    <td className="py-3 px-4 text-zinc-300 whitespace-nowrap font-mono text-[11px]">
                      {b.createdAt}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-white">
                        {b.customerName || 'Walk-in Customer'}
                      </div>
                      {b.customerPhone && (
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {b.customerPhone}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-zinc-300">
                      {b.items.length} item{b.items.length > 1 ? 's' : ''}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-400">
                      ₹{b.subtotal.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-400">
                      ₹{b.gstAmount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white text-sm">
                      ₹{b.grandTotal.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        b.paymentMethod === 'UPI'
                          ? 'bg-purple-500/15 text-purple-300 border border-purple-500/25'
                          : b.paymentMethod === 'CARD'
                          ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                      }`}>
                        {b.paymentMethod}
                      </span>
                    </td>
                    {/* Modify / Add Items Column */}
                    {onModifyOrder && (
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onModifyOrder(b)}
                          className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/25 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                          title="Add Items / Modify Bill"
                          aria-label={`Add Items or Modify Invoice ${b.billNumber}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                    {/* Receipt Column */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedOrderForReceipt(b)}
                        className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-[#D4AF37]/15 text-zinc-400 hover:text-[#D4AF37] border border-white/[0.08] transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
                        title="View & Reprint Thermal Receipt"
                        aria-label={`View & Reprint Receipt for Invoice ${b.billNumber}`}
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </td>
                    {/* Delete Column (at far right, after Receipt) */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {onDeleteOrder && (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteInvoice(b)}
                          disabled={isDeleting && deletingId === b.id}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/40 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/50 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={`Delete Invoice ${b.billNumber}`}
                          aria-label={`Delete invoice ${b.billNumber} for amount ₹${b.grandTotal.toFixed(2)}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Dialog for Deleting Invoice */}
      {pendingDeleteInvoice && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div className="relative w-full max-w-md bg-[#161619] border border-rose-500/30 rounded-2xl p-5 shadow-2xl text-left space-y-4">
            
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/25 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 id="delete-dialog-title" className="text-base font-bold text-white">
                  Confirm Invoice Deletion
                </h3>
                <p className="text-xs text-zinc-400">
                  Are you sure you want to delete this invoice? The billed revenue, invoice count, and payment tender totals will update immediately.
                </p>
              </div>
            </div>

            {/* Target Invoice Details Summary */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Invoice Number:</span>
                <span className="font-mono font-bold text-[#D4AF37] text-sm">
                  {pendingDeleteInvoice.billNumber}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Grand Total:</span>
                <span className="font-mono font-bold text-white text-sm">
                  ₹{pendingDeleteInvoice.grandTotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Customer:</span>
                <span className="text-zinc-300 font-medium">
                  {pendingDeleteInvoice.customerName || 'Walk-in Customer'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Payment Mode:</span>
                <span className="font-mono font-semibold text-zinc-300">
                  {pendingDeleteInvoice.paymentMethod}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-zinc-500 pt-1 border-t border-white/[0.04]">
                <span>Date & Time:</span>
                <span className="font-mono">{pendingDeleteInvoice.createdAt}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingDeleteInvoice(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-colors focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 border border-rose-500 transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-rose-500/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-rose-900/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Invoice'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Thermal Receipt Modal */}
      <ReceiptModal
        order={selectedOrderForReceipt}
        onClose={() => setSelectedOrderForReceipt(null)}
        onModifyOrder={onModifyOrder}
      />

    </div>
  );
};
