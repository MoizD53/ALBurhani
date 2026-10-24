import React, { useState, useMemo, useEffect } from 'react';
import { 
  Truck, 
  Plus, 
  Search, 
  Calendar, 
  IndianRupee, 
  FileText, 
  Printer, 
  Edit2, 
  XCircle, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  User, 
  Phone, 
  ChevronRight, 
  RefreshCw,
  Package,
  ArrowUpDown
} from 'lucide-react';
import { PurchaseBill, Vendor, Product, VendorPayment } from '../../types';
import { getKolkataDateString } from '../../lib/utils';
import { DailyCalendarPicker } from '../bills/DailyCalendarPicker';
import { NewPurchaseBillModal } from './NewPurchaseBillModal';
import { AddVendorPaymentModal } from './AddVendorPaymentModal';
import { PurchaseReceiptModal } from './PurchaseReceiptModal';
import { VendorLedgerModal } from './VendorLedgerModal';

interface PurchaseBillsViewProps {
  purchaseBills: PurchaseBill[];
  vendors: Vendor[];
  products: Product[];
  onSavePurchaseBill: (bill: PurchaseBill) => Promise<boolean>;
  onCancelPurchaseBill: (billId: string) => Promise<boolean>;
  onAddVendorPayment: (payment: VendorPayment) => Promise<boolean>;
  onSyncNow?: () => Promise<void> | void;
  isSyncing?: boolean;
}

export const PurchaseBillsView: React.FC<PurchaseBillsViewProps> = ({
  purchaseBills,
  vendors,
  products,
  onSavePurchaseBill,
  onCancelPurchaseBill,
  onAddVendorPayment,
  onSyncNow,
  isSyncing = false,
}) => {
  const [activeTab, setActiveTab] = useState<'bills' | 'vendors'>('bills');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Paid' | 'Partially Paid' | 'Unpaid' | 'Cancelled'>('ALL');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<PurchaseBill | null>(null);
  const [receiptBill, setReceiptBill] = useState<PurchaseBill | null>(null);
  const [paymentBill, setPaymentBill] = useState<PurchaseBill | null>(null);
  const [ledgerVendor, setLedgerVendor] = useState<Vendor | null>(null);
  
  // Cancel confirmation state
  const [billToCancel, setBillToCancel] = useState<PurchaseBill | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  // Calendar activity map: YYYY-MM-DD -> count of purchase bills
  const activityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of purchaseBills) {
      const bDate = b.businessDate || b.purchaseDate || (b.createdAt ? b.createdAt.slice(0, 10) : '');
      if (bDate) {
        map.set(bDate, (map.get(bDate) || 0) + 1);
      }
    }
    return map;
  }, [purchaseBills]);

  // Daily Metrics for selected date
  const dailyMetrics = useMemo(() => {
    if (!selectedDate) return null;
    const dayBills = purchaseBills.filter((b) => {
      const bDate = b.businessDate || b.purchaseDate || (b.createdAt ? b.createdAt.slice(0, 10) : '');
      return bDate === selectedDate;
    });

    const activeBills = dayBills.filter((b) => b.status !== 'Cancelled');
    const totalPurchased = activeBills.reduce((acc, b) => acc + (b.grandTotal || 0), 0);
    const totalPaid = activeBills.reduce((acc, b) => acc + (b.amountPaid || 0), 0);
    const totalDue = activeBills.reduce((acc, b) => acc + (b.balanceDue || 0), 0);
    const vendorsCount = new Set(dayBills.map((b) => b.vendorName.trim().toLowerCase())).size;
    const cancelledCount = dayBills.filter((b) => b.status === 'Cancelled').length;

    return {
      totalBills: dayBills.length,
      activeBillsCount: activeBills.length,
      totalPurchased,
      totalPaid,
      totalDue,
      vendorsCount,
      cancelledCount,
    };
  }, [purchaseBills, selectedDate]);

  // Overall Financial Summary
  const overallSummary = useMemo(() => {
    const activeBills = purchaseBills.filter((b) => b.status !== 'Cancelled');
    const totalPurchased = activeBills.reduce((acc, b) => acc + (b.grandTotal || 0), 0);
    const totalPaid = activeBills.reduce((acc, b) => acc + (b.amountPaid || 0), 0);
    const totalDue = activeBills.reduce((acc, b) => acc + (b.balanceDue || 0), 0);
    return {
      totalBillsCount: purchaseBills.length,
      activeBillsCount: activeBills.length,
      totalPurchased,
      totalPaid,
      totalDue,
    };
  }, [purchaseBills]);

  // Filter and Sort Bills
  const filteredBills = useMemo(() => {
    return purchaseBills.filter((b) => {
      // 1. Date filter
      if (selectedDate) {
        const bDate = b.businessDate || b.purchaseDate || (b.createdAt ? b.createdAt.slice(0, 10) : '');
        if (bDate !== selectedDate) return false;
      }

      // 2. Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'Cancelled') {
          if (b.status !== 'Cancelled') return false;
        } else {
          if (b.status === 'Cancelled' || b.paymentStatus !== statusFilter) return false;
        }
      }

      // 3. Search query
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesVendor = b.vendorName.toLowerCase().includes(q);
        const matchesPurNo = b.purchaseNumber.toLowerCase().includes(q);
        const matchesDaily = `bill #${b.dailyBillNumber}`.includes(q) || `#${b.dailyBillNumber}` === q || `${b.dailyBillNumber}` === q;
        const matchesInv = (b.vendorInvoiceNumber || '').toLowerCase().includes(q);
        const matchesItem = b.items.some((i) => i.productName.toLowerCase().includes(q));
        if (!matchesVendor && !matchesPurNo && !matchesDaily && !matchesInv && !matchesItem) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      // Sort newest date first, and within each date N at top, then N-1, then N-2
      const dateA = a.businessDate || a.purchaseDate || '';
      const dateB = b.businessDate || b.purchaseDate || '';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      return (b.dailyBillNumber || 0) - (a.dailyBillNumber || 0);
    });
  }, [purchaseBills, selectedDate, statusFilter, search]);

  // Handle Cancellation
  const handleConfirmCancel = async () => {
    if (!billToCancel) return;
    setIsCancelling(true);
    try {
      const ok = await onCancelPurchaseBill(billToCancel.id);
      if (ok) {
        setFeedback({
          type: 'success',
          message: `Purchase Bill ${billToCancel.purchaseNumber} cancelled and stock safely reversed.`,
        });
        setBillToCancel(null);
      } else {
        setFeedback({
          type: 'error',
          message: 'Failed to cancel purchase bill. Please verify database connection.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Error occurred while cancelling purchase bill.',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border flex items-center gap-3 animate-in slide-in-from-top-2 duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="text-xs font-semibold">{feedback.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FAF8F5] border border-[#C99A18]/30 text-[#C99A18] flex items-center justify-center shrink-0 shadow-xs">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-stone-900 font-serif tracking-tight">
                Purchase Bills & Inward Supplies
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#FAF8F5] text-[#8C6D15] border border-[#E8DEC8]">
                {purchaseBills.length} Bills
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium">
              Vendor procurement, inward inventory stock movements, and payables ledger
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          {onSyncNow && (
            <button
              type="button"
              onClick={() => onSyncNow()}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-600 bg-white border border-[#E8DEC8] rounded-xl hover:bg-[#FAF8F5] disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#B8860B]' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setEditingBill(null);
              setIsNewModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#B8860B] hover:bg-[#996F09] text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Purchase Bill</span>
          </button>
        </div>
      </div>

      {/* Tabs: Bills vs Vendors */}
      <div className="flex items-center border-b border-[#E8DEC8] gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('bills')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'bills'
              ? 'border-[#B8860B] text-[#B8860B]'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Purchase Bills Ledger</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 font-mono">
            {purchaseBills.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vendors')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'vendors'
              ? 'border-[#B8860B] text-[#B8860B]'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Vendors Directory & Statements</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 font-mono">
            {vendors.length}
          </span>
        </button>
      </div>

      {/* TAB 1: PURCHASE BILLS */}
      {activeTab === 'bills' && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white border border-[#E8DEC8] rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block">
                Total Purchases
              </span>
              <div className="mt-1 flex items-baseline gap-1 font-mono text-xl sm:text-2xl font-black text-stone-900">
                <span>₹{overallSummary.totalPurchased.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <span className="text-[10px] text-stone-400 mt-1 block">
                {overallSummary.activeBillsCount} active purchase bills
              </span>
            </div>

            <div className="bg-white border border-[#E8DEC8] rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block">
                Amount Paid
              </span>
              <div className="mt-1 flex items-baseline gap-1 font-mono text-xl sm:text-2xl font-black text-emerald-700">
                <span>₹{overallSummary.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <span className="text-[10px] text-emerald-600 mt-1 block">
                Settled to suppliers
              </span>
            </div>

            <div className="bg-white border border-[#E8DEC8] rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block">
                Outstanding Payables
              </span>
              <div className="mt-1 flex items-baseline gap-1 font-mono text-xl sm:text-2xl font-black text-amber-700">
                <span>₹{overallSummary.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <span className="text-[10px] text-amber-600 mt-1 block">
                Pending supplier dues
              </span>
            </div>

            <div className="bg-white border border-[#E8DEC8] rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block">
                Suppliers / Vendors
              </span>
              <div className="mt-1 flex items-baseline gap-1 font-mono text-xl sm:text-2xl font-black text-[#8C6D15]">
                <span>{vendors.length}</span>
              </div>
              <span className="text-[10px] text-stone-400 mt-1 block">
                Registered vendors
              </span>
            </div>
          </div>

          {/* Daily Calendar Summary Card (when a date is selected) */}
          {selectedDate && dailyMetrics && (
            <div className="bg-[#FAF8F5] border-2 border-[#E8DEC8] rounded-2xl p-4 sm:p-5 shadow-xs animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E8DEC8]">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-5 h-5 text-[#B8860B]" />
                  <div>
                    <h3 className="text-sm font-bold font-serif text-stone-900">
                      Purchases for {new Date(selectedDate + 'T00:00:00+05:30').toLocaleDateString('en-IN', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </h3>
                    <p className="text-[11px] text-stone-500 font-mono">
                      Asia/Kolkata Business Date • Sequential Bill Numbers #1 to #{dailyMetrics.totalBills}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="px-2.5 py-1 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-white border border-[#E8DEC8] rounded-lg shadow-xs"
                >
                  View All Dates
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-1">
                <div>
                  <span className="text-[10px] font-bold uppercase text-stone-500 block">Day's Total Bills</span>
                  <span className="text-base font-bold font-mono text-stone-900">{dailyMetrics.totalBills}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-stone-500 block">Total Purchased</span>
                  <span className="text-base font-bold font-mono text-stone-900">
                    ₹{dailyMetrics.totalPurchased.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-stone-500 block">Paid Today</span>
                  <span className="text-base font-bold font-mono text-emerald-700">
                    ₹{dailyMetrics.totalPaid.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-stone-500 block">Balance Payable</span>
                  <span className="text-base font-bold font-mono text-amber-700">
                    ₹{dailyMetrics.totalDue.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Filter & Calendar Toolbar */}
          <div className="bg-white border border-[#E8DEC8] rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by vendor, bill # (e.g. 1 or PUR-0001), invoice #, or item name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#B8860B] focus:border-[#B8860B]"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Status & Calendar controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  aria-label="Filter purchase bills by payment status"
                  className="py-2 px-3 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-700 font-semibold focus:outline-none focus:ring-1 focus:ring-[#B8860B]"
                >
                  <option value="ALL">All Status</option>
                  <option value="Paid">Paid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Cancelled">Cancelled</option>
                </select>

                {/* Daily Calendar Picker */}
                <DailyCalendarPicker
                  selectedDate={selectedDate}
                  onSelectDate={(d) => setSelectedDate(d)}
                  activityMap={activityMap}
                />

                {(selectedDate || statusFilter !== 'ALL' || search) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate(null);
                      setStatusFilter('ALL');
                      setSearch('');
                    }}
                    className="py-2 px-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100"
                  >
                    Reset Filters
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* Bills List / Table */}
          <div className="bg-white border border-[#E8DEC8] rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAF8F5] text-stone-700 font-bold uppercase text-[10px] tracking-wider border-b border-[#E8DEC8]">
                  <tr>
                    <th className="py-3 px-4">Daily Bill #</th>
                    <th className="py-3 px-4">Date (IST)</th>
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-4">Items Summary</th>
                    <th className="py-3 px-4 text-right">Grand Total</th>
                    <th className="py-3 px-4 text-right">Paid / Balance</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DEC8]/60">
                  {filteredBills.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-stone-400">
                        <Truck className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                        <p className="font-semibold text-stone-600">No purchase bills found</p>
                        <p className="text-[11px] text-stone-400 mt-1">
                          {search || selectedDate || statusFilter !== 'ALL'
                            ? 'Try clearing the filters or selecting a different date.'
                            : 'Click "+ New Purchase Bill" above to record your first inward supply.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredBills.map((bill) => {
                      const isCancelled = bill.status === 'Cancelled';
                      const isUnpaid = bill.balanceDue > 0 && bill.amountPaid === 0;
                      const isPartial = bill.balanceDue > 0 && bill.amountPaid > 0;
                      const isPaid = bill.balanceDue <= 0;

                      return (
                        <tr
                          key={bill.id}
                          className={`hover:bg-[#FAF8F5]/60 transition-colors ${
                            isCancelled ? 'opacity-60 bg-stone-50' : ''
                          }`}
                        >
                          {/* Daily Bill # & Internal Ref */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black font-mono text-sm text-[#8C6D15] bg-[#FAF8F5] px-2 py-0.5 rounded-md border border-[#E8DEC8]">
                                #{bill.dailyBillNumber || '—'}
                              </span>
                              <span className="text-[10px] text-stone-400 font-mono">
                                {bill.purchaseNumber}
                              </span>
                            </div>
                            {bill.vendorInvoiceNumber && (
                              <div className="text-[10px] text-stone-500 font-mono mt-0.5">
                                Inv: {bill.vendorInvoiceNumber}
                              </div>
                            )}
                          </td>

                          {/* Date */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-mono font-medium text-stone-900">
                              {bill.purchaseDate || bill.businessDate || (bill.createdAt ? bill.createdAt.slice(0, 10) : '—')}
                            </div>
                            <div className="text-[10px] text-stone-400 font-mono">
                              IST Business Day
                            </div>
                          </td>

                          {/* Vendor */}
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => {
                                const v = vendors.find(
                                  (ven) =>
                                    ven.id === bill.vendorId ||
                                    ven.name.toLowerCase() === bill.vendorName.toLowerCase()
                                ) || {
                                  id: bill.vendorId || `ven-${bill.vendorName}`,
                                  name: bill.vendorName,
                                  contactNumber: bill.vendorContact,
                                };
                                setLedgerVendor(v);
                              }}
                              className="font-bold text-stone-900 hover:text-[#B8860B] text-left block"
                            >
                              {bill.vendorName}
                            </button>
                            {bill.vendorContact && (
                              <div className="text-[10px] text-stone-500 font-mono flex items-center gap-1 mt-0.5">
                                <Phone className="w-2.5 h-2.5 text-stone-400" />
                                {bill.vendorContact}
                              </div>
                            )}
                          </td>

                          {/* Items Summary */}
                          <td className="py-3 px-4 max-w-xs">
                            <div className="font-medium text-stone-800 truncate" title={bill.items.map((i) => `${i.productName} (${i.quantity} ${i.unit})`).join(', ')}>
                              {bill.items.map((i) => `${i.productName} (${i.quantity} ${i.unit})`).join(', ')}
                            </div>
                            <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                              {bill.items.length} line item{bill.items.length !== 1 ? 's' : ''}
                            </div>
                          </td>

                          {/* Grand Total */}
                          <td className="py-3 px-4 text-right font-mono font-bold text-stone-900">
                            ₹{bill.grandTotal.toFixed(2)}
                          </td>

                          {/* Paid / Balance */}
                          <td className="py-3 px-4 text-right">
                            <div className="font-mono text-emerald-700 font-semibold">
                              ₹{bill.amountPaid.toFixed(2)}
                            </div>
                            {bill.balanceDue > 0 && !isCancelled && (
                              <div className="font-mono text-[11px] text-amber-700 font-bold">
                                Due: ₹{bill.balanceDue.toFixed(2)}
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 text-center">
                            {isCancelled ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <XCircle className="w-3 h-3" /> Voided
                              </span>
                            ) : isPaid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" /> Paid
                              </span>
                            ) : isPartial ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3" /> Partial
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <AlertCircle className="w-3 h-3" /> Unpaid
                              </span>
                            )}
                          </td>

                          {/* Action Buttons */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Print / View Receipt */}
                              <button
                                type="button"
                                onClick={() => setReceiptBill(bill)}
                                title="View Purchase Voucher"
                                className="p-1.5 rounded-lg text-stone-600 hover:text-[#B8860B] hover:bg-[#FAF8F5] border border-transparent hover:border-[#E8DEC8]"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              {/* Record Payment */}
                              {!isCancelled && bill.balanceDue > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setPaymentBill(bill)}
                                  title="Record Payment"
                                  className="px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg"
                                >
                                  + Pay
                                </button>
                              )}

                              {/* Edit Bill */}
                              {!isCancelled && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingBill(bill);
                                    setIsNewModalOpen(true);
                                  }}
                                  title="Edit Purchase Bill"
                                  className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Cancel Bill */}
                              {!isCancelled && (
                                <button
                                  type="button"
                                  onClick={() => setBillToCancel(bill)}
                                  title="Cancel Bill & Reverse Stock"
                                  className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: VENDORS DIRECTORY & STATEMENTS */}
      {activeTab === 'vendors' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vendors.length === 0 ? (
              <div className="col-span-full py-12 text-center text-stone-400 bg-white border border-[#E8DEC8] rounded-2xl">
                <User className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                <p className="font-semibold text-stone-600">No vendors registered yet</p>
                <p className="text-xs text-stone-400 mt-1">
                  Vendors are automatically created and updated whenever purchase bills are saved.
                </p>
              </div>
            ) : (
              vendors.map((v) => {
                const vendorBills = purchaseBills.filter(
                  (b) =>
                    (b.vendorId && b.vendorId === v.id) ||
                    b.vendorName.trim().toLowerCase() === v.name.trim().toLowerCase()
                );
                const activeBills = vendorBills.filter((b) => b.status !== 'Cancelled');
                const totalPurchased = activeBills.reduce((acc, b) => acc + (b.grandTotal || 0), 0);
                const totalPaid = activeBills.reduce((acc, b) => acc + (b.amountPaid || 0), 0);
                const balanceDue = totalPurchased - totalPaid;

                return (
                  <div
                    key={v.id}
                    className="bg-white border border-[#E8DEC8] rounded-2xl p-5 shadow-xs hover:border-[#B8860B]/40 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold font-serif text-base text-stone-900 truncate">
                            {v.name}
                          </h3>
                          {v.contactNumber && (
                            <div className="flex items-center gap-1.5 text-xs text-stone-500 font-mono mt-0.5">
                              <Phone className="w-3 h-3 text-[#B8860B]" />
                              {v.contactNumber}
                            </div>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#FAF8F5] text-[#8C6D15] border border-[#E8DEC8] shrink-0">
                          {vendorBills.length} Bill{vendorBills.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Financial breakdown */}
                      <div className="mt-4 pt-3 border-t border-[#E8DEC8] grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-stone-400 block">Total Purchases</span>
                          <span className="font-mono font-bold text-stone-900">
                            ₹{totalPurchased.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-stone-400 block">Total Paid</span>
                          <span className="font-mono font-bold text-emerald-700">
                            ₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#E8DEC8] flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-stone-400 block">Current Balance</span>
                        <span
                          className={`font-mono font-bold text-sm ${
                            balanceDue > 0 ? 'text-amber-700' : 'text-emerald-700'
                          }`}
                        >
                          ₹{Math.max(0, balanceDue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setLedgerVendor(v)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#8C6D15] bg-[#FAF8F5] hover:bg-white border border-[#E8DEC8] rounded-xl shadow-xs"
                      >
                        <span>Statement</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* MODALS */}

      {/* 1. New / Edit Purchase Bill Modal */}
      <NewPurchaseBillModal
        isOpen={isNewModalOpen}
        onClose={() => {
          setIsNewModalOpen(false);
          setEditingBill(null);
        }}
        onSave={async (bill) => {
          const ok = await onSavePurchaseBill(bill);
          if (ok) {
            setFeedback({
              type: 'success',
              message: `Purchase bill ${bill.purchaseNumber} successfully saved with stock movements recorded.`,
            });
          }
          return ok;
        }}
        existingVendors={vendors}
        products={products}
        editingBill={editingBill}
      />

      {/* 2. Purchase Voucher Printable Receipt Modal */}
      <PurchaseReceiptModal
        isOpen={Boolean(receiptBill)}
        bill={receiptBill}
        onClose={() => setReceiptBill(null)}
      />

      {/* 3. Add Vendor Payment Modal */}
      <AddVendorPaymentModal
        isOpen={Boolean(paymentBill)}
        bill={paymentBill}
        onClose={() => setPaymentBill(null)}
        onSavePayment={async (payment) => {
          const ok = await onAddVendorPayment(payment);
          if (ok) {
            setFeedback({
              type: 'success',
              message: `Payment of ₹${payment.amount.toFixed(2)} recorded for ${paymentBill?.vendorName}.`,
            });
          }
          return ok;
        }}
      />

      {/* 4. Vendor Ledger Modal */}
      <VendorLedgerModal
        isOpen={Boolean(ledgerVendor)}
        vendor={ledgerVendor}
        bills={purchaseBills}
        onClose={() => setLedgerVendor(null)}
        onAddPayment={(bill) => {
          setLedgerVendor(null);
          setPaymentBill(bill);
        }}
        onViewBill={(bill) => {
          setReceiptBill(bill);
        }}
      />

      {/* 5. Cancel Purchase Bill Confirmation Modal */}
      {billToCancel && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-rose-200 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-rose-700" />
              </div>
              <div>
                <h3 className="font-bold text-base font-serif text-stone-900">
                  Cancel Purchase Bill {billToCancel.purchaseNumber}?
                </h3>
                <span className="text-xs text-rose-600 font-mono">
                  Daily #{billToCancel.dailyBillNumber} • {billToCancel.vendorName}
                </span>
              </div>
            </div>

            <div className="text-xs text-stone-600 space-y-2 bg-rose-50/50 p-3.5 rounded-xl border border-rose-100">
              <p className="font-medium text-stone-900">
                Are you sure you want to cancel this purchase voucher?
              </p>
              <ul className="list-disc pl-4 space-y-1 text-stone-600">
                <li>Inventory stock added by this purchase will be <strong>automatically reversed</strong>.</li>
                <li>The purchase bill will be marked as <strong>Voided</strong> and cannot be edited.</li>
                <li>Audit history and stock movements are permanently preserved.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBillToCancel(null)}
                disabled={isCancelling}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-xl"
              >
                No, Keep Bill
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling & Reversing Stock...' : 'Yes, Cancel Bill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
