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
  Package,
  RefreshCw,
  Download
} from 'lucide-react';
import { ReceiptModal } from '../pos/ReceiptModal';
import { getOrderDue, getKolkataDateString, extractOrderTimestamp, resolveDailyBillNumber, exportToCsv } from '../../lib/utils';
import { DailyCalendarPicker } from './DailyCalendarPicker';
import { DailyActivitySummary, DailyActivityMetrics } from './DailyActivitySummary';
import {
  BillingPageHeader,
  BillingSummaryCard,
  BillingFilterToolbar,
  BillingTableContainer,
  BillingEmptyState,
  DeleteBillPopover,
  PopoverAnchorRect,
  BillingFeedbackToast,
} from './BillingSharedComponents';

interface NoBillSalesViewProps {
  orders: OrderBill[];
  onDeleteOrder?: (orderId: string) => Promise<boolean> | boolean | void;
  onModifyOrder?: (order: OrderBill) => void;
  onSettleOrder?: (order: OrderBill) => Promise<void> | void;
  onSyncNow?: () => Promise<void> | void;
  isSyncing?: boolean;
}

export const NoBillSalesView: React.FC<NoBillSalesViewProps> = ({ 
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
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<OrderBill | null>(null);

  // Deletion popover & feedback state
  const [pendingDeleteSale, setPendingDeleteSale] = useState<{
    sale: OrderBill;
    rect?: PopoverAnchorRect;
  } | null>(null);
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

  // Activity map: maps YYYY-MM-DD -> count of sales for calendar indicators
  const activityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of noBillSales) {
      const bDate = s.businessDate || getKolkataDateString(extractOrderTimestamp(s) || Date.now());
      map.set(bDate, (map.get(bDate) || 0) + 1);
    }
    return map;
  }, [noBillSales]);

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

    const daySales = noBillSales.filter((s) => {
      const bDate = s.businessDate || getKolkataDateString(extractOrderTimestamp(s) || Date.now());
      return bDate === selectedDate;
    });

    const uniqueCusts = new Set<string>();
    for (const s of daySales) {
      if (s.customerPhone) uniqueCusts.add(s.customerPhone);
      else if (s.customerName) uniqueCusts.add(s.customerName.toLowerCase().trim());
      else uniqueCusts.add(`walkin-${s.id}`);
    }

    return {
      totalBills: daySales.length,
      totalCustomers: uniqueCusts.size,
      totalSales: daySales.reduce((sum, s) => sum + s.grandTotal, 0),
      cashCollection: daySales.filter((s) => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.grandTotal, 0),
      upiCollection: daySales.filter((s) => s.paymentMethod === 'UPI').reduce((sum, s) => sum + s.grandTotal, 0),
      cardCollection: daySales.filter((s) => s.paymentMethod === 'CARD').reduce((sum, s) => sum + s.grandTotal, 0),
      dueAmount: daySales.reduce((sum, s) => sum + getOrderDue(s), 0),
      itemsSold: daySales.reduce((sum, s) => sum + s.items.reduce((iSum, it) => iSum + (it.quantity || 1), 0), 0),
      voidedCount: 0,
    };
  }, [selectedDate, noBillSales]);

  const filteredSales = useMemo(() => {
    const q = search.toLowerCase().trim();
    return noBillSales
      .filter((s) => {
        const bDate = s.businessDate || getKolkataDateString(extractOrderTimestamp(s) || Date.now());
        const matchesDate = !selectedDate || bDate === selectedDate;

        const matchesPayment = paymentFilter === 'ALL'
          ? true
          : paymentFilter === 'CREDIT'
            ? (s.paymentMethod === 'CREDIT' || getOrderDue(s) > 0)
            : s.paymentMethod === paymentFilter;

        const matchesSearch =
          !q ||
          (s.dailyBillNumber && `bill ${s.dailyBillNumber}`.includes(q)) ||
          (s.dailyBillNumber && `bill #${s.dailyBillNumber}`.includes(q)) ||
          (s.dailyBillNumber && String(s.dailyBillNumber) === q) ||
          s.billNumber.toLowerCase().includes(q) ||
          s.createdAt.toLowerCase().includes(q) ||
          (s.cashierName && s.cashierName.toLowerCase().includes(q)) ||
          (s.customerName && s.customerName.toLowerCase().includes(q)) ||
          (s.customerPhone && s.customerPhone.includes(q)) ||
          s.paymentMethod.toLowerCase().includes(q) ||
          s.items.some((it) => it.product.name.toLowerCase().includes(q));

        return matchesDate && matchesPayment && matchesSearch;
      })
      .sort((a, b) => {
        // Newest business date first
        const aDate = a.businessDate || getKolkataDateString(extractOrderTimestamp(a) || Date.now());
        const bDate = b.businessDate || getKolkataDateString(extractOrderTimestamp(b) || Date.now());
        if (aDate !== bDate) return bDate.localeCompare(aDate);

        // Within each date: N at top, then N-1, then N-2 (latest bill at top)
        const aSeq = resolveDailyBillNumber(a, noBillSales);
        const bSeq = resolveDailyBillNumber(b, noBillSales);
        if (aSeq !== bSeq) return bSeq - aSeq;
        return (extractOrderTimestamp(b) || 0) - (extractOrderTimestamp(a) || 0);
      });
  }, [noBillSales, search, paymentFilter, selectedDate]);

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

  // Export filtered no-bill sales to CSV
  const handleExportCsv = () => {
    const today = getKolkataDateString();
    const headers = [
      'Bill #',
      'Date & Time',
      'Cashier',
      'Customer Name',
      'Customer Phone',
      'Items Count',
      'Items Detail',
      'Subtotal (Rs)',
      'Discount (Rs)',
      'Grand Total (Rs)',
      'Amount Received (Rs)',
      'Due (Rs)',
      'Payment Method',
    ];
    const rows = filteredSales.map((s) => {
      const dailyNum = resolveDailyBillNumber(s, noBillSales);
      const itemsDetail = s.items.map((i) => `${i.product.name} (${i.formattedQuantity})`).join('; ');
      return [
        `Bill #${dailyNum}`,
        s.createdAt,
        s.cashierName || 'Owner',
        s.customerName || '',
        s.customerPhone || '',
        s.items.length,
        itemsDetail,
        s.subtotal.toFixed(2),
        s.discountAmount.toFixed(2),
        s.grandTotal.toFixed(2),
        (s.amountReceived ?? s.grandTotal).toFixed(2),
        getOrderDue(s).toFixed(2),
        s.paymentMethod,
      ];
    });
    exportToCsv(`AL_BHURANI_Daily_Sales_Bills_${today}`, headers, rows);
  };

  // Execute confirmed no-bill deletion with optimistic instant response (< 5ms)
  const handleExecuteDelete = (saleToDel?: OrderBill) => {
    const targetSale = saleToDel || pendingDeleteSale?.sale;
    if (!targetSale) return;

    const displayBill = `Bill #${resolveDailyBillNumber(targetSale, noBillSales)}`;
    setPendingDeleteSale(null);

    try {
      if (onDeleteOrder) {
        onDeleteOrder(targetSale.id);
        setFeedback({
          type: 'success',
          message: `${displayBill} (Rs. ${targetSale.grandTotal.toFixed(2)}) was deleted successfully.`,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || `Failed to delete ${displayBill}.`,
      });
    }
  };

  const handleSyncClick = async () => {
    if (isSyncing || !onSyncNow) return;
    try {
      await onSyncNow();
      setFeedback({
        type: 'success',
        message: `Cloud sync verified: ${noBillSales.length} sales synchronized across all devices.`,
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
        icon={ReceiptText}
        title="Sales Bills"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-[#E8DEC8] hover:border-[#C99A18] text-stone-700 hover:text-stone-900 hover:bg-[#FAF8F5] transition-all shadow-xs active:scale-95 cursor-pointer"
              title="Export filtered daily sales bills to CSV file"
            >
              <Download className="w-3.5 h-3.5 text-[#B8860B]" />
              <span>Export CSV</span>
            </button>
            {onSyncNow && (
              <button
                onClick={handleSyncClick}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-[#C99A18]/40 hover:border-[#C99A18] text-[#8C6D15] hover:text-[#5E4708] hover:bg-[#FAF8F5] transition-all shadow-xs active:scale-95 disabled:opacity-60 cursor-pointer"
                title="Force live cloud synchronization across all devices"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#C99A18]' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Live'}</span>
              </button>
            )}
          </div>
        }
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
          label="Total Items Sold"
          value={`${totalItemsDeducted} Items`}
          subtext="sold"
          accent="zinc"
          icon={Package}
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
        searchPlaceholder="Search by bill number, cashier, product, date..."
        paymentFilter={paymentFilter}
        onPaymentFilterChange={setPaymentFilter}
      >
        <DailyCalendarPicker
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          activityMap={activityMap}
          label="Sales Calendar"
        />
      </BillingFilterToolbar>

      {/* Selected Day Activity Summary (When filtered by date) */}
      {selectedDate && (
        <DailyActivitySummary
          selectedDate={selectedDate}
          formattedDate={selectedDate}
          metrics={dailyMetrics}
          onClearDate={() => setSelectedDate(null)}
          accentTitle="Counter Sales"
        />
      )}

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
                  <span className="font-mono font-bold text-[#A67D0C] text-sm block">
                    Bill #{resolveDailyBillNumber(s, noBillSales)}
                  </span>
                  <span className="text-stone-400 font-mono text-[10px] block">
                    {s.createdAt}
                  </span>
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
                  {s.customerName && (
                    <span className="block text-xs font-bold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-0.5 w-fit">
                      Customer: {s.customerName}{s.customerPhone ? ` (${s.customerPhone})` : ''}
                    </span>
                  )}
                  <span className="text-[10px] text-stone-400 block font-mono">{s.items.length} items sold</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-stone-900 text-base block">Rs. {s.grandTotal.toFixed(2)}</span>
                  {getOrderDue(s) > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-300">
                      Due: Rs. {getOrderDue(s).toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-600 font-medium block">Paid</span>
                  )}
                  <span className="text-[10px] text-stone-400 font-mono block">0% GST Memo</span>
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
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const r = e.currentTarget.getBoundingClientRect();
                        setPendingDeleteSale({
                          sale: s,
                          rect: {
                            top: r.top,
                            left: r.left,
                            bottom: r.bottom,
                            right: r.right,
                            width: r.width,
                            height: r.height,
                          },
                        });
                      }}
                      className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                      aria-label={`Delete Bill #${resolveDailyBillNumber(s, noBillSales)}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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
              <th className="py-3 px-4">Daily Bill # / ID</th>
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
                      {/* 1. Daily Bill # */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-[#A67D0C] text-sm">
                          Bill #{resolveDailyBillNumber(s, noBillSales)}
                        </div>
                      </td>

                      {/* 2. Date & Time */}
                      <td className="py-3 px-4 text-stone-500 font-mono text-[11px] whitespace-nowrap">
                        {s.createdAt}
                      </td>

                      {/* 3. Cashier & Customer */}
                      <td className="py-3 px-4 text-stone-700 font-semibold whitespace-nowrap">
                        <div>{s.cashierName || 'Owner'}</div>
                        {s.customerName && (
                          <div className="text-[11px] text-amber-800 font-bold flex items-center gap-1 mt-0.5">
                            <span className="px-1.5 py-0.5 bg-amber-50 rounded border border-amber-200">
                              👤 {s.customerName}{s.customerPhone ? ` · ${s.customerPhone}` : ''}
                            </span>
                          </div>
                        )}
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

                      {/* 6. Total Amount & Due Status (0% GST) */}
                      <td className="py-3 px-4 text-right font-mono">
                        <span className="font-bold text-[#1C1917] text-sm block">Rs. {s.grandTotal.toFixed(2)}</span>
                        {getOrderDue(s) > 0 ? (
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-300">
                            Due: Rs. {getOrderDue(s).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-medium block">Paid</span>
                        )}
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const r = e.currentTarget.getBoundingClientRect();
                                  setPendingDeleteSale({
                                    sale: s,
                                    rect: {
                                      top: r.top,
                                      left: r.left,
                                      bottom: r.bottom,
                                      right: r.right,
                                      width: r.width,
                                      height: r.height,
                                    },
                                  });
                                }}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/25 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/50 cursor-pointer"
                                title={`Delete Bill #${resolveDailyBillNumber(s, noBillSales)}`}
                                aria-label={`Delete Bill #${resolveDailyBillNumber(s, noBillSales)}`}
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
                                Bill Line Items ({s.items.length})
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
          onUpdateOrder={(updated) => setSelectedOrderForReceipt(updated)}
        />
      )}

      {/* 7. Delete Confirmation Popover (Anchored Next to Bill) */}
      {pendingDeleteSale && (
        <DeleteBillPopover
          isOpen={Boolean(pendingDeleteSale)}
          invoiceNumber={`Bill #${resolveDailyBillNumber(pendingDeleteSale.sale, noBillSales)}`}
          amount={pendingDeleteSale.sale.grandTotal}
          anchorRect={pendingDeleteSale.rect}
          isDeleting={isDeleting}
          onConfirm={() => handleExecuteDelete(pendingDeleteSale.sale)}
          onCancel={() => setPendingDeleteSale(null)}
          title="Delete Sales Bill"
          isNoBill={true}
        />
      )}

    </div>
  );
};
