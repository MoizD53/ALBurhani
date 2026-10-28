import React, { useState } from 'react';
import { Product, OrderBill, ExpenseItem, CustomerOrder } from '../../types';
import { 
  IndianRupee, 
  Users, 
  Receipt, 
  Eye, 
  EyeOff, 
  Sparkles, 
  ArrowUpRight, 
  Tag, 
  Calendar, 
  Repeat, 
  Package, 
  Banknote, 
  QrCode, 
  CreditCard, 
  ShoppingBag,
  Clock,
  Printer,
  ChevronRight,
  Trash2,
  Edit2,
  CalendarClock,
  AlertTriangle,
  ClipboardList
} from 'lucide-react';
import { ReceiptModal } from '../pos/ReceiptModal';
import { DueBillsModal } from './DueBillsModal';
import { isOrderInDateRange, isExpenseInDateRange, calculateDueSummary, getKolkataDateString } from '../../lib/utils';
import { generateMasterSalesReport, isEligibleOrder } from '../../lib/salesReporting';
import {
  isOrderActive,
  getNearestUpcomingDeliveryDate,
  getOrderTimingStatus,
  formatOrderItemsSummary,
  ORDER_STATUS_CONFIG
} from '../../lib/customerOrders';

interface OverviewDashboardViewProps {
  products: Product[];
  orders: OrderBill[];
  expenses: ExpenseItem[];
  customerOrders?: CustomerOrder[];
  onNavigateToTab: (tab: any, params?: any) => void;
  onDeleteOrder?: (orderId: string) => void;
  onModifyOrder?: (order: OrderBill) => void;
  onSettleOrder?: (order: OrderBill) => Promise<void> | void;
}

export const OverviewDashboardView: React.FC<OverviewDashboardViewProps> = ({
  products,
  orders,
  expenses,
  customerOrders = [],
  onNavigateToTab,
  onDeleteOrder,
  onModifyOrder,
  onSettleOrder,
}) => {
  // Privacy mode toggle (matches eye icon in TEN11 screenshot)
  const [isMasked, setIsMasked] = useState(false);
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'month' | 'all'>('today');
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<OrderBill | null>(null);
  const [isDueModalOpen, setIsDueModalOpen] = useState(false);

  // Aggregated Due metrics
  const { totalDue, dueOrdersCount, dueOrders } = React.useMemo(
    () => calculateDueSummary(orders),
    [orders]
  );

  // Dynamic today's date formatted (e.g., "OCTOBER 19")
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric'
  }).toUpperCase();

  // Master Sales Report (Unified Single Source of Truth for reporting)
  const salesReport = React.useMemo(
    () => generateMasterSalesReport(orders, dateFilter),
    [orders, dateFilter]
  );

  // Filter orders by date range for lists
  const filteredOrders = orders.filter((o) => isOrderInDateRange(o, dateFilter));

  const todayRevenue = salesReport.todayCombined.grandTotal;
  const lifetimeRevenue = salesReport.combinedLifetime.grandTotal;

  // Customer transactions count
  const todayCustomersCount = salesReport.todayCombined.count;
  const lifetimeCustomersCount = salesReport.combinedLifetime.count;

  // Expenses
  const todayExpenses = expenses.filter((e) => isExpenseInDateRange(e, 'today')).reduce((sum, e) => sum + e.amount, 0);
  const lifetimeExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Payment Breakdown
  const cashTotal = salesReport.filteredCombined.cashTotal;
  const upiTotal = salesReport.filteredCombined.upiTotal;
  const cardTotal = salesReport.filteredCombined.cardTotal;

  // Customer Bills vs No-Bill split
  const customerBills = filteredOrders.filter((o) => o.transactionType === 'CUSTOMER_BILL' || !o.transactionType);
  const noBillSales = filteredOrders.filter((o) => o.transactionType === 'NO_BILL');
  const customerBillsPercent = salesReport.filteredCombined.count > 0 
    ? Math.round((salesReport.filteredCustomerBills.count / salesReport.filteredCombined.count) * 100) 
    : 100;

  // Top products sold
  const productSalesMap = new Map<string, { name: string; qty: number; amount: number }>();
  for (const o of orders) {
    for (const it of o.items) {
      const existing = productSalesMap.get(it.product.id) || { name: it.product.name, qty: 0, amount: 0 };
      existing.qty += it.quantity;
      existing.amount += it.lineTotal;
      productSalesMap.set(it.product.id, existing);
    }
  }
  const topProducts = Array.from(productSalesMap.values()).sort((a, b) => b.amount - a.amount);
  const topProduct = topProducts[0] || { name: 'Kaju Katli Special', qty: 0, amount: 0 };

  // Customer Orders Metrics
  const todayStr = getKolkataDateString();

  const activeCustomerOrders = React.useMemo(() => {
    return customerOrders.filter((o) => isOrderActive(o.status));
  }, [customerOrders]);

  const futureCustomerOrders = React.useMemo(() => {
    return activeCustomerOrders.filter((o) => o.deliveryDate > todayStr);
  }, [activeCustomerOrders, todayStr]);

  const dueTodayCustomerOrders = React.useMemo(() => {
    return activeCustomerOrders.filter((o) => o.deliveryDate === todayStr);
  }, [activeCustomerOrders, todayStr]);

  const overdueCustomerOrders = React.useMemo(() => {
    return activeCustomerOrders.filter((o) => o.deliveryDate < todayStr);
  }, [activeCustomerOrders, todayStr]);

  const nearestUpcomingDate = React.useMemo(() => {
    return getNearestUpcomingDeliveryDate(customerOrders, todayStr);
  }, [customerOrders, todayStr]);

  const nearestDeliveryFormatted = React.useMemo(() => {
    return nearestUpcomingDate || 'None scheduled';
  }, [nearestUpcomingDate]);

  // Nearest deliveries list: Overdue first, then Today, then future ordered chronologically
  const nearestScheduledDeliveries = React.useMemo(() => {
    const list = [...activeCustomerOrders];
    list.sort((a, b) => {
      // Overdue first (< todayStr)
      const aOverdue = a.deliveryDate < todayStr;
      const bOverdue = b.deliveryDate < todayStr;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      // Due today next (=== todayStr)
      const aToday = a.deliveryDate === todayStr;
      const bToday = b.deliveryDate === todayStr;
      if (aToday && !bToday) return -1;
      if (!aToday && bToday) return 1;

      // Chronological by deliveryDate then deliveryTime
      if (a.deliveryDate !== b.deliveryDate) {
        return a.deliveryDate.localeCompare(b.deliveryDate);
      }
      return (a.deliveryTime || '').localeCompare(b.deliveryTime || '');
    });
    return list.slice(0, 5);
  }, [activeCustomerOrders, todayStr]);

  // Helper for masking numbers
  const formatAmount = (val: number) => {
    if (isMasked) return 'Rs. * * , * * *';
    return `Rs. ${val.toLocaleString('en-IN')}`;
  };

  const formatNumber = (val: number) => {
    if (isMasked) return '* *';
    return val.toString();
  };

  return (
    <div className="space-y-6 select-none max-w-7xl mx-auto pb-16">
      
      {/* 1. Header: Dashboard Title & Uppercase Gold Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#1C1917] tracking-tight font-serif">
            Dashboard
          </h1>
          <p className="text-[11px] font-bold tracking-[0.22em] text-[#A67D0C] uppercase mt-1">
            {todayFormatted}
          </p>
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#E8DEC8] shadow-sm">
          {[
            ['today', 'Today'],
            ['7days', '7 Days'],
            ['month', 'Month'],
            ['all', 'All Time'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setDateFilter(key as any)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                dateFilter === key
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-sm'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>


      {/* 2. Top Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        
        {/* Card 1: TODAY'S REVENUE */}
        <div className="ten-card p-5 rounded-2xl flex flex-col justify-between hover:border-[#D4AF37]/60 transition-all group bg-white border border-[#E8DEC8] shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-[#FAF8F5] border border-[#C99A18]/30 flex items-center justify-center text-[#C99A18] group-hover:border-[#C99A18] transition-colors shadow-sm">
                <IndianRupee className="w-4 h-4" />
              </div>
              <button 
                onClick={() => setIsMasked((prev) => !prev)}
                className="text-stone-400 hover:text-stone-700 transition-colors p-1"
                title={isMasked ? "Show figures" : "Hide figures"}
              >
                {isMasked ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="mt-4">
              <span className="text-[11px] font-bold tracking-wider text-stone-500 uppercase block">
                Today's Revenue
              </span>
              <div className="text-2xl sm:text-3xl font-bold text-[#1C1917] mt-1 font-mono tracking-tight">
                {formatAmount(todayRevenue)}
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-[#F0EBE0] space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-stone-500">
              <span className="uppercase tracking-wider font-sans text-stone-500 text-[10px] font-semibold">Combined Lifetime</span>
              <span className="text-[#A67D0C] font-bold">{formatAmount(lifetimeRevenue)}</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-stone-400 font-sans">
              <span>No-Bill: {formatAmount(salesReport.noBillLifetime.grandTotal)}</span>
              <span>Tax Bills: {formatAmount(salesReport.customerBillsLifetime.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Card 2: TODAY'S BILLS */}
        <div className="ten-card p-5 rounded-2xl flex flex-col justify-between hover:border-[#D4AF37]/60 transition-all group bg-white border border-[#E8DEC8] shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-[#FAF8F5] border border-[#C99A18]/30 flex items-center justify-center text-[#C99A18] group-hover:border-[#C99A18] transition-colors shadow-sm">
                <Receipt className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-4">
              <span className="text-[11px] font-bold tracking-wider text-stone-500 uppercase block">
                Today's Bills
              </span>
              <div className="text-2xl sm:text-3xl font-bold text-[#1C1917] mt-1 font-mono tracking-tight">
                {formatNumber(todayCustomersCount)}
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-[#F0EBE0] space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-stone-500">
              <span className="uppercase tracking-wider font-sans text-stone-500 text-[10px] font-semibold">Combined Lifetime Bills</span>
              <span className="text-stone-700 font-bold">{formatNumber(lifetimeCustomersCount)}</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-stone-400 font-sans">
              <span>No-Bill: {formatNumber(salesReport.noBillLifetime.count)}</span>
              <span>Tax Bills: {formatNumber(salesReport.customerBillsLifetime.count)}</span>
            </div>
          </div>
        </div>

        {/* Card 3: TODAY'S EXPENSES */}
        <div className="ten-card p-5 rounded-2xl flex flex-col justify-between hover:border-[#D4AF37]/60 transition-all group bg-white border border-[#E8DEC8] shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-[#FAF8F5] border border-[#C99A18]/30 flex items-center justify-center text-[#C99A18] group-hover:border-[#C99A18] transition-colors shadow-sm">
                <Receipt className="w-4 h-4" />
              </div>
              <button 
                onClick={() => setIsMasked((prev) => !prev)}
                className="text-stone-400 hover:text-stone-700 transition-colors p-1"
                title={isMasked ? "Show figures" : "Hide figures"}
              >
                {isMasked ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="mt-4">
              <span className="text-[11px] font-bold tracking-wider text-stone-500 uppercase block">
                Today's Expenses
              </span>
              <div className="text-2xl sm:text-3xl font-bold text-[#1C1917] mt-1 font-mono tracking-tight">
                {formatAmount(todayExpenses)}
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-[#F0EBE0] flex items-center justify-between text-[11px] font-mono text-stone-500">
            <span className="uppercase tracking-wider font-sans text-stone-500 text-[10px] font-semibold">Total Expenses</span>
            <span className="text-stone-700 font-bold">{formatAmount(lifetimeExpenses)}</span>
          </div>
        </div>

        {/* Card 4: OUTSTANDING DUE (UDHAR) */}
        <div 
          onClick={() => setIsDueModalOpen(true)}
          className="ten-card p-5 rounded-2xl flex flex-col justify-between hover:border-[#D4AF37] transition-all group bg-white border border-[#E8DEC8] shadow-sm cursor-pointer hover:shadow-md relative overflow-hidden"
          title="Click to view all unsettled due bills"
        >
          {dueOrdersCount > 0 && (
            <div className="absolute top-3.5 right-3.5 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-800 text-[10px] font-bold">
              {dueOrdersCount} Unsettled
            </div>
          )}
          <div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-300 flex items-center justify-center text-amber-700 group-hover:border-[#C99A18] transition-colors shadow-sm">
                <Clock className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-4">
              <span className="text-[11px] font-bold tracking-wider text-stone-500 uppercase block">
                Outstanding Due (उधार)
              </span>
              <div className="text-2xl sm:text-3xl font-bold text-amber-800 mt-1 font-mono tracking-tight">
                {formatAmount(totalDue)}
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-[#F0EBE0] flex items-center justify-between text-[11px] font-mono text-stone-500">
            <span className="text-[#A67D0C] font-semibold text-[11px] flex items-center gap-1 group-hover:underline">
              View {dueOrdersCount} Due Bills <ArrowUpRight className="w-3 h-3 inline" />
            </span>
            <span className="text-stone-400 text-[10px]">Click to open</span>
          </div>
        </div>

        {/* Card 5: UPCOMING ORDERS */}
        <div
          onClick={() => onNavigateToTab('orders')}
          className="ten-card p-5 rounded-2xl flex flex-col justify-between hover:border-[#D4AF37] transition-all group bg-white border border-[#E8DEC8] shadow-sm cursor-pointer hover:shadow-md relative overflow-hidden"
          title="Click to view all scheduled orders"
        >
          {dueTodayCustomerOrders.length > 0 && (
            <div className="absolute top-3.5 right-3.5 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-800 text-[10px] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              {dueTodayCustomerOrders.length} Due Today
            </div>
          )}
          {overdueCustomerOrders.length > 0 && dueTodayCustomerOrders.length === 0 && (
            <div className="absolute top-3.5 right-3.5 px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-800 text-[10px] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              {overdueCustomerOrders.length} Overdue
            </div>
          )}
          <div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-[#FAF8F5] border border-[#C99A18]/30 flex items-center justify-center text-[#C99A18] group-hover:border-[#C99A18] transition-colors shadow-sm">
                <CalendarClock className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-4">
              <span className="text-[11px] font-bold tracking-wider text-stone-500 uppercase block">
                Upcoming Orders
              </span>
              <div className="text-2xl sm:text-3xl font-bold text-[#1C1917] mt-1 font-mono tracking-tight">
                {formatNumber(futureCustomerOrders.length)}
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-[#F0EBE0] flex items-center justify-between text-[11px] font-mono text-stone-500">
            <span className="text-[#A67D0C] font-semibold text-[11px] flex items-center gap-1 group-hover:underline">
              {nearestUpcomingDate ? `Next: ${nearestDeliveryFormatted}` : 'None scheduled'}
            </span>
            <span className="text-stone-400 text-[10px] flex items-center gap-0.5">
              <span>View All</span>
              <ChevronRight className="w-3 h-3 inline" />
            </span>
          </div>
        </div>

      </div>

      {/* 5. Two Column Breakdown: Tender Reconciliation & Recent Sales Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
        
        {/* Left: Payment Method Reconciliation */}
        <div className="ten-card p-5 rounded-2xl space-y-4 bg-white border border-[#E8DEC8] shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1C1917] flex items-center gap-2">
              <Banknote className="w-4 h-4 text-[#C99A18]" />
              <span>Payment Tender Breakdown</span>
            </h3>
            <span className="text-[10px] text-[#A67D0C] font-bold uppercase">Live Audit</span>
          </div>

          <div className="space-y-3">
            {/* Cash */}
            <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 flex items-center justify-center">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#1C1917] block">Cash Tender</span>
                  <span className="text-[10px] text-stone-500">In Register Drawer</span>
                </div>
              </div>
              <span className="text-sm font-bold font-mono text-[#1C1917]">
                Rs. {cashTotal.toLocaleString('en-IN')}
              </span>
            </div>

            {/* UPI */}
            <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/25 text-purple-600 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#1C1917] block">UPI / QR Scan</span>
                  <span className="text-[10px] text-stone-500">Direct Bank Credit</span>
                </div>
              </div>
              <span className="text-sm font-bold font-mono text-[#1C1917]">
                Rs. {upiTotal.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Card */}
            <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-600 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#1C1917] block">Card Swipes</span>
                  <span className="text-[10px] text-stone-500">POS Machine Settlement</span>
                </div>
              </div>
              <span className="text-sm font-bold font-mono text-[#1C1917]">
                Rs. {cardTotal.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => onNavigateToTab('pos')}
              className="w-full btn-gold py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Start POS Counter Billing</span>
            </button>
          </div>
        </div>

        {/* Right: Recent Sales Transactions Feed (Span 2 cols) */}
        <div className="ten-card p-5 rounded-2xl lg:col-span-2 space-y-4 bg-white border border-[#E8DEC8] shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1C1917] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#C99A18]" />
              <span>Recent Billing Activity</span>
            </h3>
            <button
              onClick={() => onNavigateToTab('no-bill-sales')}
              className="text-xs font-bold text-[#C99A18] hover:text-[#A67D0C] flex items-center gap-1 transition-colors"
            >
              <span>View All Bills</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-6 bg-[#FAF8F5] rounded-xl border border-[#E8DEC8]">
              <Receipt className="w-8 h-8 text-stone-400 mb-2 stroke-1" />
              <p className="text-xs font-bold text-stone-700">No transactions recorded yet</p>
              <p className="text-[11px] text-stone-500 mt-0.5">Start billing to view live transaction history</p>
            </div>
          ) : (
            <div className="space-y-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] font-bold text-stone-500 uppercase tracking-wider border-b border-[#F0EBE0] pb-2">
                    <th className="pb-2 font-semibold">Sale Description</th>
                    <th className="pb-2 font-semibold">Date & Time</th>
                    <th className="pb-2 font-semibold">Tender</th>
                    <th className="pb-2 text-right font-semibold">Amount</th>
                    <th className="pb-2 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EBE0]">
                  {orders.filter(isEligibleOrder).slice(0, 5).map((order) => {
                    const primaryItem = order.items[0]?.product.name || 'Counter Sale';
                    const moreCount = order.items.length - 1;
                    const itemsSummary = moreCount > 0 ? `${primaryItem} +${moreCount} more` : primaryItem;

                    return (
                      <tr key={order.id} className="hover:bg-[#FAF8F5] transition-colors">
                        <td className="py-2.5">
                          <div className="font-bold text-[#1C1917] truncate max-w-[220px]" title={itemsSummary}>
                            {itemsSummary}
                          </div>
                          <div className="text-[10px] text-stone-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              order.transactionType === 'NO_BILL'
                                ? 'bg-amber-500/15 text-amber-800 border border-amber-500/30'
                                : 'bg-emerald-500/15 text-emerald-800 border border-emerald-500/30'
                            }`}>
                              {order.transactionType === 'NO_BILL' ? 'No-Bill' : 'Tax Invoice'}
                            </span>
                            {order.customerName && (
                              <span className="text-stone-500 truncate max-w-[130px]">
                                • {order.customerName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 text-stone-500 font-mono text-[11px] whitespace-nowrap">
                          {order.createdAt}
                        </td>
                        <td className="py-2.5 font-mono text-stone-700 font-semibold">
                          {order.paymentMethod}
                        </td>
                        <td className="py-2.5 text-right font-mono font-bold text-[#B8860B]">
                          Rs. {order.grandTotal.toFixed(2)}
                        </td>
                        <td className="py-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {onModifyOrder && (
                              <button
                                type="button"
                                onClick={() => onModifyOrder(order)}
                                className="p-1 rounded-lg text-stone-400 hover:text-amber-700 hover:bg-amber-500/10 transition-colors"
                                title="Add Items / Modify Bill"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedReceiptOrder(order)}
                              className="p-1 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition-colors"
                              title="Reprint / View Receipt"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            {onDeleteOrder && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Delete this sales entry ${order.billNumber} (Rs. ${order.grandTotal.toFixed(2)})?`)) {
                                    onDeleteOrder(order.id);
                                  }
                                }}
                                className="p-1 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                                title="Delete Entry"
                                aria-label={`Delete sales entry ${order.billNumber} for Rs. ${order.grandTotal.toFixed(2)}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* 6. Upcoming Deliveries View */}
      <div className="ten-card p-5 rounded-2xl space-y-4 bg-white border border-[#E8DEC8] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#C99A18]/30 flex items-center justify-center text-[#C99A18]">
              <CalendarClock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1C1917] flex items-center gap-2">
                <span>Upcoming Scheduled Deliveries</span>
                {activeCustomerOrders.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#FAF8F5] border border-[#C99A18]/30 text-[#A67D0C] text-[10px] font-bold">
                    {activeCustomerOrders.length} Active
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-stone-500">
                Advance customer bookings, delivery slots, and balance collection
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateToTab('orders')}
              className="text-xs font-bold text-[#C99A18] hover:text-[#A67D0C] flex items-center gap-1 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-[#FAF8F5]"
            >
              <span>View All Orders</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {nearestScheduledDeliveries.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-center p-6 bg-[#FAF8F5] rounded-xl border border-[#E8DEC8]">
            <ClipboardList className="w-8 h-8 text-stone-400 mb-2 stroke-1" />
            <p className="text-xs font-bold text-stone-700">No pending deliveries scheduled</p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Customer orders taken for advance deliveries will appear here automatically.
            </p>
            <button
              onClick={() => onNavigateToTab('orders')}
              className="mt-3 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white text-xs font-bold shadow-sm hover:opacity-95 transition-opacity"
            >
              + Create Customer Order
            </button>
          </div>
        ) : (
          <div className="space-y-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] font-bold text-stone-500 uppercase tracking-wider border-b border-[#F0EBE0] pb-2">
                  <th className="pb-2 font-semibold">Order / Customer</th>
                  <th className="pb-2 font-semibold">Scheduled Delivery</th>
                  <th className="pb-2 font-semibold">Items</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 text-right font-semibold">Amount / Due</th>
                  <th className="pb-2 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EBE0]">
                {nearestScheduledDeliveries.map((co) => {
                  const timing = getOrderTimingStatus(co, todayStr);
                  const statusConf = ORDER_STATUS_CONFIG[co.status] || {
                    label: co.status,
                    badgeClass: 'bg-stone-100 text-stone-700 border-stone-200',
                  };
                  const itemsSummary = formatOrderItemsSummary(co.items);

                  return (
                    <tr key={co.id} className="hover:bg-[#FAF8F5] transition-colors">
                      <td className="py-2.5">
                        <div className="font-bold text-[#1C1917] flex items-center gap-1.5">
                          <span>{co.customerName}</span>
                          <span className="font-mono text-[10px] font-normal text-stone-500">
                            ({co.orderNumber})
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-500 mt-0.5 flex items-center gap-1 font-mono">
                          <span>{co.customerPhone}</span>
                          {co.deliveryAddress && (
                            <span className="text-stone-400 truncate max-w-[150px]">
                              • {co.deliveryAddress}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-semibold text-stone-800">
                            {co.deliveryDate}
                          </span>
                          {timing === 'overdue' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/15 text-rose-800 border border-rose-500/30 flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Overdue
                            </span>
                          )}
                          {timing === 'due_today' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-800 border border-amber-500/30 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              Due Today
                            </span>
                          )}
                          {timing === 'upcoming' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-800 border border-emerald-500/30">
                              Upcoming
                            </span>
                          )}
                        </div>
                        {co.deliveryTime && (
                          <div className="text-[10px] text-stone-500 mt-0.5 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-stone-400" />
                            <span>{co.deliveryTime}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5">
                        <div className="text-stone-700 font-medium truncate max-w-[220px]" title={itemsSummary}>
                          {itemsSummary}
                        </div>
                        <div className="text-[10px] text-stone-400 mt-0.5">
                          {co.items.length} {co.items.length === 1 ? 'item' : 'items'}
                        </div>
                      </td>
                      <td className="py-2.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusConf.badgeClass}`}>
                          {statusConf.label}
                        </span>
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        <div className="font-mono font-bold text-[#1C1917]">
                          Rs. {co.totalAmount.toFixed(2)}
                        </div>
                        {co.balanceDue > 0 ? (
                          <div className="text-[10px] font-mono font-bold text-amber-700">
                            Due: Rs. {co.balanceDue.toFixed(2)}
                          </div>
                        ) : (
                          <div className="text-[10px] font-mono font-bold text-emerald-700">
                            Paid in Full
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => onNavigateToTab('orders')}
                          className="px-2.5 py-1 rounded-lg border border-[#E8DEC8] hover:border-[#D4AF37] hover:bg-[#FAF8F5] text-[11px] font-bold text-stone-700 transition-colors flex items-center gap-1 ml-auto"
                        >
                          <span>Manage</span>
                          <ChevronRight className="w-3 h-3 text-[#C99A18]" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Thermal Receipt Preview Modal */}
      {selectedReceiptOrder && (
        <ReceiptModal
          order={selectedReceiptOrder}
          onClose={() => setSelectedReceiptOrder(null)}
          onModifyOrder={onModifyOrder}
        />
      )}

      {/* Outstanding Due & Udhar Khata Modal */}
      <DueBillsModal
        isOpen={isDueModalOpen}
        onClose={() => setIsDueModalOpen(false)}
        orders={orders}
        onViewReceipt={(order) => setSelectedReceiptOrder(order)}
        onSettleOrder={onSettleOrder}
      />

    </div>
  );
};
