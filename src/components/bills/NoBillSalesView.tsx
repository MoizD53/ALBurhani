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
            message: `Sales entry ${targetSale.billNumber} (Rs. ${targetSale.grandTotal.toFixed(2)}) was deleted successfully.`,
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
        badge={{ text: 'Without GST (0%) · Cloud Synced', variant: 'zinc' }}
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
          value={`Rs. ${totalNoBillRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          accent="gold"
          icon={IndianRupee}
        />
        <BillingSummaryCard
          label="Cash in Drawer"
          value={`Rs. ${totalCashNoBill.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          accent="emerald"
          icon={IndianRupee}
        />
        <BillingSummaryCard
          label="UPI Collections"
          value={`Rs. ${totalUpiNoBill.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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

      {/* 5. Mobile No-Bill Sales Cards (< 640px) */}
      <div className="sm:hidden space-y-2.5">
        {filteredSales.length === 0 ? (
          <BillingEmptyState
            icon={ReceiptText}
            title="No Internal Counter Sales Found"
            description={
              hasActiveFilters
                ? 'No transactions match your current search query or payment mode filter.'
                : 'No counter sales (0% GST) have been recorded yet.'
            }
            hasActiveFilters={hasActiveFilters}
            onClearFilters={() => {
              setSearch('');
              setPaymentFilter('ALL');
            }}
          />
        ) : (
          filteredSales.map((s) => (
            <div 
              key={s.id}
              className="p-3.5 rounded-2xl bg-white border border-[#E8DEC8] shadow-sm space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-[#B8860B] text-sm block">{s.billNumber}</span>
                  <span className="text-stone-400 font-mono text-[11px]">{s.createdAt}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  s.paymentMethod === 'UPI'
                    ? 'bg-purple-500/15 text-purple-700 border border-purple-500/25'
                    : s.paymentMethod === 'CARD'
                    ? 'bg-blue-500/15 text-blue-700 border border-blue-500/25'
                    : 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/25'
                }`}>
                  {s.paymentMethod}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs py-1.5 border-t border-b border-[#F5F2EB]">
                <div>
                  <span className="text-stone-500 font-medium">Cashier: {s.cashierName}</span>
                  <span className="text-[10px] text-stone-400 block font-mono">{s.items.length} items sold</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-stone-900 text-base block">Rs. {s.grandTotal.toFixed(2)}</span>
                  <span className="text-[10px] text-stone-400 font-mono">0% GST Memo</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                {onModifyOrder && (
                  <button
                    type="button"
                    onClick={() => onModifyOrder(s)}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Modify</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedOrderForReceipt(s)}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#FAF8F5] hover:bg-[#F5F2EB] text-stone-700 border border-[#E8DEC8] text-xs font-bold flex items-center justify-center gap-1.5 min-h-[44px]"
                >
                  <Printer className="w-3.5 h-3.5 text-[#B8860B]" />
                  <span>Receipt</span>
                </button>
                {onDeleteOrder && (
                  <button
                    type="button"
                    onClick={() => setPendingDeleteSale(s)}
                    className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label={`Delete entry ${s.billNumber}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 6. Audit Log Table (Tablets & Desktop) */}
      <div className="hidden sm:block">
      <BillingTableContainer>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#E8DEC8] bg-[#FAF8F5] text-stone-600 uppercase tracking-wider font-bold text-[10px]">
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
          <tbody className="divide-y divide-[#F0EBE0]">
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
                    <tr className="hover:bg-[#FAF8F5] transition-colors">
                      {/* 1. Transaction ID */}
                      <td className="py-3 px-4 font-mono font-bold text-[#B8860B] whitespace-nowrap">
                        {s.billNumber}
                      </td>

                      {/* 2. Date & Time */}
                      <td className="py-3 px-4 text-stone-500 font-mono text-[11px] whitespace-nowrap">
                        {s.createdAt}
                      </td>

                      {/* 3. Cashier */}
                      <td className="py-3 px-4 text-stone-700 font-semibold whitespace-nowrap">
                        {s.cashierName || 'Owner'}
                      </td>

                      {/* 4. Items Sold with Toggle Button */}
                      <td className="py-3 px-4 text-center font-mono text-stone-700 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setExpandedSaleId(isExpanded ? null : s.id)}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#FAF8F5] hover:bg-[#F5F2EB] text-stone-700 border border-[#E8DEC8] transition-colors cursor-pointer text-xs font-semibold"
                          title="Click to view line items"
                        >
                          <span>{s.items.length} item{s.items.length !== 1 ? 's' : ''}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3 text-[#B8860B]" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-stone-400" />
                          )}
                        </button>
                      </td>

                      {/* 5. Subtotal */}
                      <td className="py-3 px-4 text-right font-mono text-stone-600">
                        Rs. {s.subtotal.toFixed(2)}
                      </td>

                      {/* 6. Total Amount (0% GST) */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#1C1917] text-sm">
                        Rs. {s.grandTotal.toFixed(2)}
                      </td>

                      {/* 7. Payment Mode Badge */}
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.paymentMethod === 'UPI'
                            ? 'bg-purple-500/15 text-purple-700 border border-purple-500/25'
                            : s.paymentMethod === 'CARD'
                            ? 'bg-blue-500/15 text-blue-700 border border-blue-500/25'
                            : 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/25'
                        }`}>
                          {s.paymentMethod}
                        </span>
                      </td>

                      {/* 8. Receipt Button */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedOrderForReceipt(s)}
                          className="p-1.5 rounded-lg bg-[#FAF8F5] hover:bg-[#F5F2EB] text-stone-600 hover:text-[#C99A18] border border-[#E8DEC8] hover:border-[#C99A18] transition-colors focus:outline-none focus:ring-2 focus:ring-[#C99A18]/50 cursor-pointer shadow-sm"
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
                                className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 border border-amber-500/25 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer"
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
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/25 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                title={`Delete Sales Entry ${s.billNumber}`}
                                aria-label={`Delete sales entry ${s.billNumber} for Rs. ${s.grandTotal.toFixed(2)}`}
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
                      <tr className="bg-[#FAF8F5]">
                        <td colSpan={9} className="p-4">
                          <div className="p-3.5 rounded-xl bg-white border border-[#E8DEC8] space-y-2 shadow-sm">
                            <div className="flex items-center justify-between pb-1 border-b border-[#F0EBE0]">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-[#A67D0C]">
                                Deducted Inventory Line Items ({s.items.length})
                              </span>
                              <span className="text-[10px] text-stone-500 font-mono font-semibold">
                                Total: Rs. {s.grandTotal.toFixed(2)}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs pt-1">
                              {s.items.map((it, idx) => (
                                <div key={idx} className="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#E8DEC8] flex items-center justify-between">
                                  <div className="min-w-0 pr-2">
                                    <div className="font-bold text-[#1C1917] truncate">{it.product.name}</div>
                                    <div className="text-[10px] text-stone-500 font-mono mt-0.5">
                                      Qty: {it.formattedQuantity || it.quantity} @ {it.formattedRate}
                                    </div>
                                  </div>
                                  <span className="font-mono font-bold text-[#B8860B] shrink-0 text-xs">
                                    Rs. {it.lineTotal.toFixed(2)}
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
      </div>

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
