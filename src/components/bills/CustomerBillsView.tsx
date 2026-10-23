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
  Percent,
  RefreshCw
} from 'lucide-react';
import { ReceiptModal } from '../pos/ReceiptModal';
import { getOrderDue, getKolkataDateString, extractOrderTimestamp } from '../../lib/utils';
import { DailyCalendarPicker } from './DailyCalendarPicker';
import { DailyActivitySummary, DailyActivityMetrics } from './DailyActivitySummary';
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
  onSettleOrder?: (order: OrderBill) => Promise<void> | void;
  onSyncNow?: () => Promise<void> | void;
  isSyncing?: boolean;
}

export const CustomerBillsView: React.FC<CustomerBillsViewProps> = ({ 
  orders, 
  onDeleteOrder, 
  onModifyOrder,
  onSettleOrder,
  onSyncNow,
  isSyncing = false
}) => {
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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

  // Activity map: maps YYYY-MM-DD -> count of customer invoices
  const activityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of customerBills) {
      const bDate = b.businessDate || getKolkataDateString(extractOrderTimestamp(b) || Date.now());
      map.set(bDate, (map.get(bDate) || 0) + 1);
    }
    return map;
  }, [customerBills]);

  // Daily summary metrics for selected date
  const dailyMetrics: DailyActivityMetrics = useMemo(() => {
    if (!selectedDate) {
      return {
        totalBills: 0,
        totalCustomers: 0,
        totalSales: 0,
        cashCollection: 0,
        upiCollection: 0,
        cardCollection: 0,
        dueAmount: 0,
        itemsSold: 0,
        voidedCount: 0,
      };
    }

    const dayBills = customerBills.filter((b) => {
      const bDate = b.businessDate || getKolkataDateString(extractOrderTimestamp(b) || Date.now());
      return bDate === selectedDate;
    });

    const uniqueCusts = new Set<string>();
    for (const b of dayBills) {
      if (b.customerPhone) uniqueCusts.add(b.customerPhone);
      else if (b.customerName) uniqueCusts.add(b.customerName.toLowerCase().trim());
      else uniqueCusts.add(`cust-${b.id}`);
    }

    return {
      totalBills: dayBills.length,
      totalCustomers: uniqueCusts.size,
      totalSales: dayBills.reduce((sum, b) => sum + b.grandTotal, 0),
      cashCollection: dayBills.filter(b => b.paymentMethod === 'CASH').reduce((sum, b) => sum + b.grandTotal, 0),
      upiCollection: dayBills.filter(b => b.paymentMethod === 'UPI').reduce((sum, b) => sum + b.grandTotal, 0),
      cardCollection: dayBills.filter(b => b.paymentMethod === 'CARD').reduce((sum, b) => sum + b.grandTotal, 0),
      dueAmount: dayBills.reduce((sum, b) => sum + getOrderDue(b), 0),
      itemsSold: dayBills.reduce((sum, b) => sum + b.items.reduce((iSum, it) => iSum + (it.quantity || 1), 0), 0),
      voidedCount: 0,
    };
  }, [selectedDate, customerBills]);

  const filteredBills = useMemo(() => {
    const q = search.toLowerCase().trim();
    return customerBills
      .filter((bill) => {
        const bDate = bill.businessDate || getKolkataDateString(extractOrderTimestamp(bill) || Date.now());
        const matchesDate = !selectedDate || bDate === selectedDate;

        const matchesPayment = paymentFilter === 'ALL'
          ? true
          : paymentFilter === 'CREDIT'
            ? (bill.paymentMethod === 'CREDIT' || getOrderDue(bill) > 0)
            : bill.paymentMethod === paymentFilter;

        const matchesSearch =
          !q ||
          (bill.dailyBillNumber && `bill ${bill.dailyBillNumber}`.includes(q)) ||
          (bill.dailyBillNumber && `bill #${bill.dailyBillNumber}`.includes(q)) ||
          (bill.dailyBillNumber && String(bill.dailyBillNumber) === q) ||
          bill.billNumber.toLowerCase().includes(q) ||
          (bill.customerName && bill.customerName.toLowerCase().includes(q)) ||
          (bill.customerPhone && bill.customerPhone.includes(q)) ||
          bill.createdAt.toLowerCase().includes(q);

        return matchesDate && matchesPayment && matchesSearch;
      })
      .sort((a, b) => {
        if (selectedDate) {
          // Ascending by daily bill number: Bill 1 at top, Bill 2 underneath
          const aSeq = a.dailyBillNumber || 0;
          const bSeq = b.dailyBillNumber || 0;
          if (aSeq !== bSeq) return aSeq - bSeq;
          return (extractOrderTimestamp(a) || 0) - (extractOrderTimestamp(b) || 0);
        }

        const aDate = a.businessDate || getKolkataDateString(extractOrderTimestamp(a) || Date.now());
        const bDate = b.businessDate || getKolkataDateString(extractOrderTimestamp(b) || Date.now());
        if (aDate !== bDate) return bDate.localeCompare(aDate);

        const aSeq = a.dailyBillNumber || 0;
        const bSeq = b.dailyBillNumber || 0;
        if (aSeq !== bSeq) return aSeq - bSeq;
        return (extractOrderTimestamp(a) || 0) - (extractOrderTimestamp(b) || 0);
      });
  }, [customerBills, search, paymentFilter, selectedDate]);

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

  const handleSyncClick = async () => {
    if (isSyncing || !onSyncNow) return;
    try {
      await onSyncNow();
      setFeedback({
        type: 'success',
        message: `Cloud sync verified: ${customerBills.length} tax invoices synchronized across all devices.`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Sync failed. Please check internet connection.',
      });
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
        badge={{ text: 'With GST (5%)', variant: 'gold' }}
        actions={
          onSyncNow ? (
            <button
              onClick={handleSyncClick}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-[#C99A18]/40 hover:border-[#C99A18] text-[#8C6D15] hover:text-[#5E4708] hover:bg-[#FAF8F5] transition-all shadow-xs active:scale-95 disabled:opacity-60 cursor-pointer"
              title="Force live cloud synchronization across all devices"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#C99A18]' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Live'}</span>
            </button>
          ) : undefined
        }
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

      {/* 4. Standardized Search & Filter Toolbar with Daily Calendar Picker */}
      <BillingFilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by invoice #, customer name, phone, date..."
        paymentFilter={paymentFilter}
        onPaymentFilterChange={setPaymentFilter}
      >
        <DailyCalendarPicker
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          activityMap={activityMap}
          label="Invoices Calendar"
        />
      </BillingFilterToolbar>

      {/* Selected Day Activity Summary (When filtered by date) */}
      {selectedDate && (
        <DailyActivitySummary
          selectedDate={selectedDate}
          formattedDate={selectedDate}
          metrics={dailyMetrics}
          onClearDate={() => setSelectedDate(null)}
          accentTitle="Tax Invoices"
        />
      )}

      {/* 5. Mobile Bills Cards (< 640px) */}
      <div className="sm:hidden space-y-2.5">
        {filteredBills.length === 0 ? (
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
        ) : (
          filteredBills.map((b) => (
            <div 
              key={b.id}
              className="p-3.5 rounded-2xl bg-white border border-[#E8DEC8] shadow-sm space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-[#A67D0C] text-sm block">
                    Bill #{b.dailyBillNumber || b.billNumber}
                  </span>
                  <span className="text-stone-400 font-mono text-[10px] block">
                    {b.billNumber} · {b.createdAt}
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  b.paymentMethod === 'UPI'
                    ? 'bg-purple-500/15 text-purple-700 border border-purple-500/25'
                    : b.paymentMethod === 'CARD'
                    ? 'bg-blue-500/15 text-blue-700 border border-blue-500/25'
                    : 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/25'
                }`}>
                  {b.paymentMethod}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs py-1.5 border-t border-b border-[#F5F2EB]">
                <div>
                  <span className="font-bold text-stone-900 block">{b.customerName || 'Walk-in Customer'}</span>
                  {b.customerPhone && <span className="text-[10px] text-stone-500 font-mono">{b.customerPhone}</span>}
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-stone-900 text-base block">Rs. {b.grandTotal.toFixed(2)}</span>
                  {getOrderDue(b) > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-300">
                      Due: Rs. {getOrderDue(b).toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-600 font-medium block">Paid</span>
                  )}
                  <span className="text-[10px] text-stone-400 font-mono block">{b.items.length} items (GST Rs. {b.gstAmount.toFixed(2)})</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                {onModifyOrder && (
                  <button
                    type="button"
                    onClick={() => onModifyOrder(b)}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Modify</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedOrderForReceipt(b)}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#FAF8F5] hover:bg-[#F5F2EB] text-stone-700 border border-[#E8DEC8] text-xs font-bold flex items-center justify-center gap-1.5 min-h-[44px]"
                >
                  <Printer className="w-3.5 h-3.5 text-[#B8860B]" />
                  <span>Receipt</span>
                </button>
                {onDeleteOrder && (
                  <button
                    type="button"
                    onClick={() => setPendingDeleteInvoice(b)}
                    className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label={`Delete invoice ${b.billNumber}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 6. Invoices Table (Tablets & Desktop) */}
      <div className="hidden sm:block">
      <BillingTableContainer>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#E8DEC8] bg-[#FAF8F5] text-stone-600 uppercase tracking-wider font-bold text-[10px]">
              <th className="py-3 px-4">Daily Bill # / Invoice</th>
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
                  {/* 1. Daily Bill # & Invoice # */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-mono font-bold text-[#A67D0C] text-sm">
                      Bill #{b.dailyBillNumber || b.billNumber}
                    </div>
                    <div className="text-[10px] text-stone-400 font-mono">
                      {b.billNumber}
                    </div>
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

                  {/* 7. Grand Total & Due Status */}
                  <td className="py-3 px-4 text-right font-mono">
                    <span className="font-bold text-[#1C1917] text-sm block">Rs. {b.grandTotal.toFixed(2)}</span>
                    {getOrderDue(b) > 0 ? (
                      <span className="inline-block mt-0.5 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-300">
                        Due: Rs. {getOrderDue(b).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-600 font-medium block">Paid</span>
                    )}
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
      </div>

      {/* 6. Receipt Modal */}
      {selectedOrderForReceipt && (
        <ReceiptModal
          order={selectedOrderForReceipt}
          onClose={() => setSelectedOrderForReceipt(null)}
          onModifyOrder={onModifyOrder}
          onUpdateOrder={(updated) => setSelectedOrderForReceipt(updated)}
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
