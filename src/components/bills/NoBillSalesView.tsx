import React, { useState, useEffect, useMemo } from 'react';
import { OrderBill } from '../../types';
import { 
  ReceiptText, 
  Printer, 
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
  Receipt,
  IndianRupee,
  Package
} from 'lucide-react';
import { ReceiptModal } from '../pos/ReceiptModal';
import {
  BillingPageHeader,
  BillingSummaryCard,
  BillingFilterToolbar,
  BillingTableContainer,
  BillingEmptyState,
  DeleteInvoiceModal,
  BillingFeedbackToast,
} from './BillingSharedComponents';

interface NoBillSalesViewProps {
  orders: OrderBill[];
  onDeleteOrder?: (orderId: string) => Promise<boolean> | boolean | void;
  onModifyOrder?: (order: OrderBill) => void;
}

export const NoBillSalesView: React.FC<NoBillSalesViewProps> = ({ 
  orders, 
  onDeleteOrder, 
  onModifyOrder 
}) => {
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<OrderBill | null>(null);

  // Deletion modal & feedback state
  const [pendingDeleteSale, setPendingDeleteSale] = useState<OrderBill | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-dismiss feedback message after 4 seconds
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  // Filter only No-Bill transactions
  const noBillSales = useMemo(
    () => orders.filter((o) => o.transactionType === 'NO_BILL'),
    [orders]
  );

  const filteredSales = useMemo(() => {
    const q = search.toLowerCase().trim();
    return noBillSales.filter((s) => {
      const matchesPayment = paymentFilter === 'ALL' || s.paymentMethod === paymentFilter;
      const matchesSearch =
        !q ||
        s.billNumber.toLowerCase().includes(q) ||
        s.createdAt.toLowerCase().includes(q) ||
        (s.cashierName && s.cashierName.toLowerCase().includes(q)) ||
        s.paymentMethod.toLowerCase().includes(q) ||
        s.items.some((it) => it.product.name.toLowerCase().includes(q));

      return matchesPayment && matchesSearch;
    });
  }, [noBillSales, search, paymentFilter]);

  // Metrics
  const totalNoBillRevenue = useMemo(
    () => noBillSales.reduce((sum, s) => sum + s.grandTotal, 0),
    [noBillSales]
  );

  const totalCashNoBill = useMemo(
    () => noBillSales.filter((s) => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.grandTotal, 0),
    [noBillSales]
  );

  const totalUpiNoBill = useMemo(
    () => noBillSales.filter((s) => s.paymentMethod === 'UPI').reduce((sum, s) => sum + s.grandTotal, 0),
    [noBillSales]
  );

  const totalItemsDeducted = useMemo(
    () => noBillSales.reduce((acc, s) => acc + s.items.length, 0),
    [noBillSales]
  );

  // Execute confirmed no-bill deletion
  const handleExecuteDelete = async () => {
    if (!pendingDeleteSale || isDeleting) return;

    const targetSale = pendingDeleteSale;
    setIsDeleting(true);

    try {
      if (onDeleteOrder) {
        const result = await onDeleteOrder(targetSale.id);
        if (result === false) {
          setFeedback({
            type: 'error',
            message: `Could not delete sales entry ${targetSale.billNumber}. Please try again.`,
          });
        } else {
          setFeedback({
            type: 'success',
            message: `Sales entry ${targetSale.billNumber} (₹${targetSale.grandTotal.toFixed(2)}) was deleted successfully.`,
          });
        }
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || `Failed to delete sales entry ${targetSale.billNumber}.`,
      });
    } finally {
      setIsDeleting(false);
      setPendingDeleteSale(null);
    }
  };

  const hasActiveFilters = Boolean(search.trim() || paymentFilter !== 'ALL');

  return (
    <div className="space-y-4 select-none animate-fade-in">
      
      {/* 1. Standardized Page Header */}
      <BillingPageHeader
        icon={ReceiptText}
        title="No-Bill Counter Sales Audit"
        subtitle="Internal recorded sales without customer tax invoice · Inventory deducted accurately · 0% GST"
        badge={{ text: 'Without GST (0%)', variant: 'zinc' }}
      />

      {/* 2. Unified Metric Summary Cards (5-Card Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <BillingSummaryCard
          label="Total Records"
          value={`${noBillSales.length} Sales`}
          accent="zinc"
          icon={Receipt}
        />
        <BillingSummaryCard
          label="No-Bill Total"
          value={`₹${totalNoBillRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          accent="gold"
          icon={IndianRupee}
        />
        <BillingSummaryCard
          label="Cash in Drawer"
          value={`₹${totalCashNoBill.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          accent="emerald"
          icon={IndianRupee}
        />
        <BillingSummaryCard
          label="UPI Collections"
          value={`₹${totalUpiNoBill.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          accent="purple"
          icon={IndianRupee}
        />
        <BillingSummaryCard
          label="Inventory Deductions"
          value={`${totalItemsDeducted} Items`}
          subtext="deducted"
          accent="zinc"
          icon={Package}
        />
      </div>

      {/* 3. Action Feedback Toast */}
      <BillingFeedbackToast
        feedback={feedback}
        onDismiss={() => setFeedback(null)}
      />

      {/* 4. Standardized Search & Filter Toolbar */}
      <BillingFilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by transaction ID, cashier, product, date..."
        paymentFilter={paymentFilter}
        onPaymentFilterChange={setPaymentFilter}
      />

      {/* 5. Audit Log Table */}
      <BillingTableContainer>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/[0.08] bg-[#161619] text-zinc-400 uppercase tracking-wider font-semibold text-[10px]">
              <th className="py-3 px-4">Transaction ID</th>
              <th className="py-3 px-4">Date & Time</th>
              <th className="py-3 px-4">Cashier</th>
              <th className="py-3 px-4 text-center">Items Sold</th>
              <th className="py-3 px-4 text-right">Subtotal</th>
              <th className="py-3 px-4 text-right">Total Amount</th>
              <th className="py-3 px-4 text-center">Mode</th>
              <th className="py-3 px-4 text-center">Receipt</th>
              {(onModifyOrder || onDeleteOrder) && (
                <th className="py-3 px-4 text-center">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredSales.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-0">
                  <BillingEmptyState
                    icon={ReceiptText}
                    title="No Counter Sales Found"
                    description={
                      hasActiveFilters
                        ? 'No sales records match your current search query or payment mode filter.'
                        : 'No internal no-bill counter sales recorded yet. Use POS Billing in "No-Bill Sale" mode to record one.'
                    }
                    hasActiveFilters={hasActiveFilters}
                    onClearFilters={() => {
                      setSearch('');
                      setPaymentFilter('ALL');
                    }}
                  />
                </td>
              </tr>
            ) : (
              filteredSales.map((s) => {
                const isExpanded = expandedSaleId === s.id;
                return (
                  <React.Fragment key={s.id}>
                    <tr className="hover:bg-white/[0.02] transition-colors">
                      {/* 1. Transaction ID */}
                      <td className="py-3 px-4 font-mono font-bold text-[#D4AF37] whitespace-nowrap">
                        {s.billNumber}
                      </td>

                      {/* 2. Date & Time */}
                      <td className="py-3 px-4 text-zinc-300 font-mono text-[11px] whitespace-nowrap">
                        {s.createdAt}
                      </td>

                      {/* 3. Cashier */}
                      <td className="py-3 px-4 text-zinc-300 whitespace-nowrap">
                        {s.cashierName || 'Owner'}
                      </td>

                      {/* 4. Items Sold with Toggle Button */}
                      <td className="py-3 px-4 text-center font-mono text-zinc-300 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setExpandedSaleId(isExpanded ? null : s.id)}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white transition-colors cursor-pointer"
                          title="Click to view line items"
                        >
                          <span>{s.items.length} item{s.items.length !== 1 ? 's' : ''}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3 text-[#D4AF37]" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-zinc-500" />
                          )}
                        </button>
                      </td>

                      {/* 5. Subtotal */}
                      <td className="py-3 px-4 text-right font-mono text-zinc-400">
                        ₹{s.subtotal.toFixed(2)}
                      </td>

                      {/* 6. Total Amount (0% GST) */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-white text-sm">
                        ₹{s.grandTotal.toFixed(2)}
                      </td>

                      {/* 7. Payment Mode Badge */}
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.paymentMethod === 'UPI'
                            ? 'bg-purple-500/15 text-purple-300 border border-purple-500/25'
                            : s.paymentMethod === 'CARD'
                            ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
                            : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                        }`}>
                          {s.paymentMethod}
                        </span>
                      </td>

                      {/* 8. Receipt Button */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedOrderForReceipt(s)}
                          className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-[#D4AF37]/15 text-zinc-400 hover:text-[#D4AF37] border border-white/[0.08] hover:border-[#D4AF37]/30 transition-colors focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 cursor-pointer"
                          title="View & Reprint Sale Memo"
                          aria-label={`View & Reprint Sale Memo for ${s.billNumber}`}
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </td>

                      {/* 9. Actions Column (Modify & Delete) */}
                      {(onModifyOrder || onDeleteOrder) && (
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {onModifyOrder && (
                              <button
                                type="button"
                                onClick={() => onModifyOrder(s)}
                                className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/25 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer"
                                title="Add Items / Modify Sale"
                                aria-label={`Add Items or Modify Sale ${s.billNumber}`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onDeleteOrder && (
                              <button
                                type="button"
                                onClick={() => setPendingDeleteSale(s)}
                                disabled={isDeleting}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/40 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                title={`Delete Sales Entry ${s.billNumber}`}
                                aria-label={`Delete sales entry ${s.billNumber} for ₹${s.grandTotal.toFixed(2)}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* Expanded Line Items Detail */}
                    {isExpanded && (
                      <tr className="bg-white/[0.015]">
                        <td colSpan={9} className="p-4">
                          <div className="p-3.5 rounded-xl bg-black/60 border border-white/[0.06] space-y-2">
                            <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-[#D4AF37]">
                                Deducted Inventory Line Items ({s.items.length})
                              </span>
                              <span className="text-[10px] text-zinc-500 font-mono">
                                Total: ₹{s.grandTotal.toFixed(2)}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs pt-1">
                              {s.items.map((it, idx) => (
                                <div key={idx} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                                  <div className="min-w-0 pr-2">
                                    <div className="font-semibold text-white truncate">{it.product.name}</div>
                                    <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                                      Qty: {it.formattedQuantity || it.quantity} @ {it.formattedRate}
                                    </div>
                                  </div>
                                  <span className="font-mono font-bold text-[#E5C158] shrink-0 text-xs">
                                    ₹{it.lineTotal.toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </BillingTableContainer>

      {/* 6. Receipt Modal */}
      {selectedOrderForReceipt && (
        <ReceiptModal
          order={selectedOrderForReceipt}
          onClose={() => setSelectedOrderForReceipt(null)}
          onModifyOrder={onModifyOrder}
        />
      )}

      {/* 7. Delete Confirmation Modal */}
      <DeleteInvoiceModal
        isOpen={Boolean(pendingDeleteSale)}
        invoiceNumber={pendingDeleteSale?.billNumber || ''}
        amount={pendingDeleteSale?.grandTotal || 0}
        isDeleting={isDeleting}
        onConfirm={handleExecuteDelete}
        onCancel={() => setPendingDeleteSale(null)}
        title="Delete No-Bill Sales Entry"
        isNoBill={true}
      />

    </div>
  );
};
