import React, { useState, useEffect, useMemo } from 'react';
import { OrderBill } from '../../types';
import { 
  FileText, 
  Printer, 
  Trash2,
  Edit2,
  Receipt,
  IndianRupee,
  Layers,
  Percent
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

interface CustomerBillsViewProps {
  orders: OrderBill[];
  onDeleteOrder?: (orderId: string) => Promise<boolean> | boolean | void;
  onModifyOrder?: (order: OrderBill) => void;
}

export const CustomerBillsView: React.FC<CustomerBillsViewProps> = ({ 
  orders, 
  onDeleteOrder, 
  onModifyOrder 
}) => {
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<OrderBill | null>(null);

  // Deletion modal & feedback state
  const [pendingDeleteInvoice, setPendingDeleteInvoice] = useState<OrderBill | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-dismiss feedback message after 4 seconds
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  // Filter only formal customer bills
  const customerBills = useMemo(
    () => orders.filter((o) => o.transactionType === 'CUSTOMER_BILL' || !o.transactionType),
    [orders]
  );

  const filteredBills = useMemo(() => {
    const q = search.toLowerCase().trim();
    return customerBills.filter((bill) => {
      const matchesPayment = paymentFilter === 'ALL' || bill.paymentMethod === paymentFilter;
      const matchesSearch =
        !q ||
        bill.billNumber.toLowerCase().includes(q) ||
        (bill.customerName && bill.customerName.toLowerCase().includes(q)) ||
        (bill.customerPhone && bill.customerPhone.includes(q)) ||
        bill.createdAt.toLowerCase().includes(q);

      return matchesPayment && matchesSearch;
    });
  }, [customerBills, search, paymentFilter]);

  // Metrics
  const totalBilledRevenue = useMemo(
    () => customerBills.reduce((sum, b) => sum + b.grandTotal, 0),
    [customerBills]
  );

  const totalGstCollected = useMemo(
    () => customerBills.reduce((sum, b) => sum + (b.gstAmount || 0), 0),
    [customerBills]
  );

  const averageBillValue = useMemo(
    () => (customerBills.length > 0 ? totalBilledRevenue / customerBills.length : 0),
    [customerBills, totalBilledRevenue]
  );

  // Execute confirmed invoice deletion
  const handleExecuteDelete = async () => {
    if (!pendingDeleteInvoice || isDeleting) return;

    const targetInvoice = pendingDeleteInvoice;
    setIsDeleting(true);

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
            message: `Invoice ${targetInvoice.billNumber} (Rs. ${targetInvoice.grandTotal.toFixed(2)}) was deleted successfully.`,
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
      setPendingDeleteInvoice(null);
    }
  };

  const hasActiveFilters = Boolean(search.trim() || paymentFilter !== 'ALL');

  return (
    <div className="space-y-4 select-none animate-fade-in">
      
      {/* 1. Standardized Page Header */}
      <BillingPageHeader
        icon={FileText}
        title="Customer Tax Invoices"
        subtitle="Formal customer billing records with 5% GST compliance, bill modification, and thermal reprint"
        badge={{ text: 'With GST · Cloud Synced', variant: 'gold' }}
      />

      {/* 2. Unified Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <BillingSummaryCard
          label="Total Bills"
          value={`${customerBills.length} Invoices`}
          accent="zinc"
          icon={Receipt}
        />
        <BillingSummaryCard
          label="Billed Revenue"
          value={`Rs. ${totalBilledRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          accent="gold"
          icon={IndianRupee}
        />
        <BillingSummaryCard
          label="GST (5%) Collected"
          value={`Rs. ${totalGstCollected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          accent="emerald"
          icon={Percent}
        />
        <BillingSummaryCard
          label="Average Bill Value"
          value={`Rs. ${averageBillValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          accent="purple"
          icon={Layers}
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
        searchPlaceholder="Search by invoice #, customer name, phone, date..."
        paymentFilter={paymentFilter}
        onPaymentFilterChange={setPaymentFilter}
      />

      {/* 5. Invoices Table */}
      <BillingTableContainer>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#E8DEC8] bg-[#FAF8F5] text-stone-600 uppercase tracking-wider font-bold text-[10px]">
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
              {onDeleteOrder && <th className="py-3 px-4 text-center">Delete</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0EBE0]">
            {filteredBills.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-0">
                  <BillingEmptyState
                    icon={FileText}
                    title="No Customer Tax Invoices Found"
                    description={
                      hasActiveFilters
                        ? 'No invoices match your current search query or payment mode filter.'
                        : 'No formal GST customer invoices have been recorded yet.'
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
              filteredBills.map((b) => (
                <tr key={b.id} className="hover:bg-[#FAF8F5] transition-colors">
                  {/* 1. Invoice # */}
                  <td className="py-3 px-4 font-mono font-bold text-[#B8860B] whitespace-nowrap">
                    {b.billNumber}
                  </td>

                  {/* 2. Date & Time */}
                  <td className="py-3 px-4 text-stone-500 whitespace-nowrap font-mono text-[11px]">
                    {b.createdAt}
                  </td>

                  {/* 3. Customer Details */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-bold text-[#1C1917]">
                      {b.customerName || 'Walk-in Customer'}
                    </div>
                    {b.customerPhone && (
                      <div className="text-[10px] text-stone-500 font-mono">
                        {b.customerPhone}
                      </div>
                    )}
                  </td>

                  {/* 4. Items Count */}
                  <td className="py-3 px-4 text-center font-mono text-stone-700">
                    {b.items.length} item{b.items.length !== 1 ? 's' : ''}
                  </td>

                  {/* 5. Subtotal */}
                  <td className="py-3 px-4 text-right font-mono text-stone-600">
                    Rs. {b.subtotal.toFixed(2)}
                  </td>

                  {/* 6. GST (5%) */}
                  <td className="py-3 px-4 text-right font-mono text-stone-600">
                    Rs. {b.gstAmount.toFixed(2)}
                  </td>

                  {/* 7. Grand Total */}
                  <td className="py-3 px-4 text-right font-mono font-bold text-[#1C1917] text-sm">
                    Rs. {b.grandTotal.toFixed(2)}
                  </td>

                  {/* 8. Payment Mode Badge */}
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      b.paymentMethod === 'UPI'
                        ? 'bg-purple-500/15 text-purple-700 border border-purple-500/25'
                        : b.paymentMethod === 'CARD'
                        ? 'bg-blue-500/15 text-blue-700 border border-blue-500/25'
                        : 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/25'
                    }`}>
                      {b.paymentMethod}
                    </span>
                  </td>

                  {/* 9. Modify Order Button */}
                  {onModifyOrder && (
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onModifyOrder(b)}
                        className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 border border-amber-500/25 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer"
                        title="Add Items / Modify Bill"
                        aria-label={`Add Items or Modify Invoice ${b.billNumber}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}

                  {/* 10. Thermal Receipt Button */}
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setSelectedOrderForReceipt(b)}
                      className="p-1.5 rounded-lg bg-[#FAF8F5] hover:bg-[#F5F2EB] text-stone-600 hover:text-[#C99A18] border border-[#E8DEC8] hover:border-[#C99A18] transition-colors focus:outline-none focus:ring-2 focus:ring-[#C99A18]/50 cursor-pointer shadow-sm"
                      title="View & Reprint Thermal Receipt"
                      aria-label={`View & Reprint Receipt for Invoice ${b.billNumber}`}
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </td>

                  {/* 11. Delete Button */}
                  {onDeleteOrder && (
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setPendingDeleteInvoice(b)}
                        disabled={isDeleting}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/25 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        title={`Delete Invoice ${b.billNumber}`}
                        aria-label={`Delete invoice ${b.billNumber} for amount Rs. ${b.grandTotal.toFixed(2)}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
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
        isOpen={Boolean(pendingDeleteInvoice)}
        invoiceNumber={pendingDeleteInvoice?.billNumber || ''}
        amount={pendingDeleteInvoice?.grandTotal || 0}
        isDeleting={isDeleting}
        onConfirm={handleExecuteDelete}
        onCancel={() => setPendingDeleteInvoice(null)}
        title="Delete Customer Tax Invoice"
        isNoBill={false}
      />

    </div>
  );
};
