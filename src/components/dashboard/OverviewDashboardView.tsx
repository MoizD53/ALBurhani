import React, { useState } from 'react';
import { Product, OrderBill, ExpenseItem } from '../../types';
import { 
  TrendingUp, 
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
  ChevronRight
} from 'lucide-react';
import { ReceiptModal } from '../pos/ReceiptModal';
import { isOrderInDateRange } from '../../lib/utils';

interface OverviewDashboardViewProps {
  products: Product[];
  orders: OrderBill[];
  expenses: ExpenseItem[];
  onNavigateToTab: (tab: any) => void;
}

export const OverviewDashboardView: React.FC<OverviewDashboardViewProps> = ({
  products,
  orders,
  expenses,
  onNavigateToTab,
}) => {
  // Privacy mode toggle (matches eye icon in TEN11 screenshot)
  const [isMasked, setIsMasked] = useState(false);
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'month' | 'all'>('today');
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<OrderBill | null>(null);

  // Dynamic today's date formatted (e.g., "OCTOBER 19")
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric'
  }).toUpperCase();

  // Filter orders by date range
  const filteredOrders = orders.filter((o) => isOrderInDateRange(o, dateFilter));

  // Today-specific orders for top KPI cards
  const todayOrders = orders.filter((o) => isOrderInDateRange(o, 'today'));

  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.grandTotal, 0);
  const lifetimeRevenue = orders.reduce((sum, o) => sum + o.grandTotal, 0);

  // Profit estimation based on recorded product cost
  const todayCost = todayOrders.reduce((sum, o) => {
    return sum + o.items.reduce((itemSum, it) => itemSum + ((it.product.costPrice || 0) * it.quantity), 0);
  }, 0);
  const todayProfit = todayRevenue > 0 && todayCost > 0 ? Math.max(0, todayRevenue - todayCost) : (todayRevenue > 0 ? todayRevenue * 0.25 : 0);

  const lifetimeCost = orders.reduce((sum, o) => {
    return sum + o.items.reduce((itemSum, it) => itemSum + ((it.product.costPrice || 0) * it.quantity), 0);
  }, 0);
  const lifetimeProfit = lifetimeRevenue > 0 && lifetimeCost > 0 ? Math.max(0, lifetimeRevenue - lifetimeCost) : (lifetimeRevenue > 0 ? lifetimeRevenue * 0.25 : 0);

  // Customer transactions count
  const todayCustomersCount = todayOrders.length;
  const lifetimeCustomersCount = orders.length;

  // Expenses
  const todayExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const lifetimeExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Payment Breakdown
  const cashTotal = filteredOrders.filter((o) => o.paymentMethod === 'CASH').reduce((sum, o) => sum + o.grandTotal, 0);
  const upiTotal = filteredOrders.filter((o) => o.paymentMethod === 'UPI').reduce((sum, o) => sum + o.grandTotal, 0);
  const cardTotal = filteredOrders.filter((o) => o.paymentMethod === 'CARD').reduce((sum, o) => sum + o.grandTotal, 0);

  // Customer Bills vs No-Bill split
  const customerBills = filteredOrders.filter((o) => o.transactionType === 'CUSTOMER_BILL' || !o.transactionType);
  const noBillSales = filteredOrders.filter((o) => o.transactionType === 'NO_BILL');
  const customerBillsPercent = filteredOrders.length > 0 
    ? Math.round((customerBills.length / filteredOrders.length) * 100) 
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

  // Helper for masking numbers
  const formatAmount = (val: number) => {
    if (isMasked) return '₹ * * , * * *';
    return `₹${val.toLocaleString('en-IN')}`;
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
          <h1 className="text-3xl sm:text-4xl font-normal text-white tracking-tight font-sans">
            Dashboard
          </h1>
          <p className="text-[11px] font-bold tracking-[0.22em] text-[#C5A85A] uppercase mt-1">
            EXECUTIVE OVERVIEW • {todayFormatted}
          </p>
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-1 bg-[#121214] p-1 rounded-xl border border-white/[0.08] shadow-sm">
          {[
            ['today', 'Today'],
            ['7days', '7 Days'],
            ['month', 'Month'],
            ['all', 'All Time'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setDateFilter(key as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                dateFilter === key
                  ? 'bg-[#D4AF37] text-black shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Top 4 Primary KPI Cards (Direct TEN11 Layout) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: TODAY'S REVENUE */}
        <div className="ten-card p-5 rounded-2xl flex flex-col justify-between hover:border-[#D4AF37]/35 transition-all group">
          <div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-[#1C1A14] border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] group-hover:border-[#D4AF37]/60 transition-colors">
                <IndianRupee className="w-4 h-4" />
              </div>
              <button 
                onClick={() => setIsMasked((prev) => !prev)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                title={isMasked ? "Show figures" : "Hide figures"}
              >
                {isMasked ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="mt-4">
              <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase block">
                Today's Revenue
              </span>
              <div className="text-2xl sm:text-3xl font-normal text-white mt-1 font-mono tracking-tight">
                {formatAmount(todayRevenue)}
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <span className="uppercase tracking-wider font-sans text-zinc-500 text-[10px]">Lifetime</span>
            <span className="text-zinc-400 font-semibold">{formatAmount(lifetimeRevenue)}</span>
          </div>
        </div>

        {/* Card 2: TODAY'S PROFIT */}
        <div className="ten-card p-5 rounded-2xl flex flex-col justify-between hover:border-[#D4AF37]/35 transition-all group">
          <div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-[#1C1A14] border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] group-hover:border-[#D4AF37]/60 transition-colors">
                <TrendingUp className="w-4 h-4" />
              </div>
              <button 
                onClick={() => setIsMasked((prev) => !prev)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                title={isMasked ? "Show figures" : "Hide figures"}
              >
                {isMasked ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="mt-4">
              <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase block">
                Today's Profit
              </span>
              <div className="text-2xl sm:text-3xl font-normal text-white mt-1 font-mono tracking-tight">
                {formatAmount(todayProfit)}
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <span className="uppercase tracking-wider font-sans text-zinc-500 text-[10px]">Lifetime</span>
            <span className="text-zinc-400 font-semibold">{formatAmount(lifetimeProfit)}</span>
          </div>
        </div>

        {/* Card 3: CUSTOMERS (TODAY) */}
        <div className="ten-card p-5 rounded-2xl flex flex-col justify-between hover:border-[#D4AF37]/35 transition-all group">
          <div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-[#1C1A14] border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] group-hover:border-[#D4AF37]/60 transition-colors">
                <Users className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-4">
              <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase block">
                Customers (Today)
              </span>
              <div className="text-2xl sm:text-3xl font-normal text-white mt-1 font-mono tracking-tight">
                {formatNumber(todayCustomersCount)}
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <span className="uppercase tracking-wider font-sans text-zinc-500 text-[10px]">Total Customers</span>
            <span className="text-zinc-400 font-semibold">{formatNumber(lifetimeCustomersCount)}</span>
          </div>
        </div>

        {/* Card 4: TODAY'S EXPENSES */}
        <div className="ten-card p-5 rounded-2xl flex flex-col justify-between hover:border-[#D4AF37]/35 transition-all group">
          <div>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-[#1C1A14] border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] group-hover:border-[#D4AF37]/60 transition-colors">
                <Receipt className="w-4 h-4" />
              </div>
              <button 
                onClick={() => setIsMasked((prev) => !prev)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                title={isMasked ? "Show figures" : "Hide figures"}
              >
                {isMasked ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="mt-4">
              <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase block">
                Today's Expenses
              </span>
              <div className="text-2xl sm:text-3xl font-normal text-white mt-1 font-mono tracking-tight">
                {formatAmount(todayExpenses)}
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <span className="uppercase tracking-wider font-sans text-zinc-500 text-[10px]">Total Expenses</span>
            <span className="text-zinc-400 font-semibold">{formatAmount(lifetimeExpenses)}</span>
          </div>
        </div>

      </div>


      {/* 5. Two Column Breakdown: Tender Reconciliation & Recent Sales Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
        
        {/* Left: Payment Method Reconciliation */}
        <div className="ten-card p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Banknote className="w-4 h-4 text-[#D4AF37]" />
              <span>Payment Tender Breakdown</span>
            </h3>
            <span className="text-[10px] text-[#C5A85A] font-semibold uppercase">Live Audit</span>
          </div>

          <div className="space-y-3">
            {/* Cash */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex items-center justify-center">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-white block">Cash Tender</span>
                  <span className="text-[10px] text-zinc-500">In Register Drawer</span>
                </div>
              </div>
              <span className="text-sm font-bold font-mono text-white">
                ₹{cashTotal.toLocaleString('en-IN')}
              </span>
            </div>

            {/* UPI */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/25 text-purple-400 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-white block">UPI / QR Scan</span>
                  <span className="text-[10px] text-zinc-500">Direct Bank Credit</span>
                </div>
              </div>
              <span className="text-sm font-bold font-mono text-white">
                ₹{upiTotal.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Card */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-400 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-white block">Card Swipes</span>
                  <span className="text-[10px] text-zinc-500">POS Machine Settlement</span>
                </div>
              </div>
              <span className="text-sm font-bold font-mono text-white">
                ₹{cardTotal.toLocaleString('en-IN')}
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
        <div className="ten-card p-5 rounded-2xl lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#D4AF37]" />
              <span>Recent Billing Activity</span>
            </h3>
            <button
              onClick={() => onNavigateToTab('customer-bills')}
              className="text-xs font-semibold text-[#D4AF37] hover:text-[#E7C75A] flex items-center gap-1 transition-colors"
            >
              <span>View All Bills</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-6 bg-white/[0.01] rounded-xl border border-white/[0.04]">
              <Receipt className="w-8 h-8 text-zinc-600 mb-2 stroke-1" />
              <p className="text-xs font-semibold text-zinc-300">No transactions recorded yet</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Start billing to view live transaction history</p>
            </div>
          ) : (
            <div className="space-y-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-white/[0.06] pb-2">
                    <th className="pb-2 font-normal">Bill No.</th>
                    <th className="pb-2 font-normal">Type</th>
                    <th className="pb-2 font-normal">Items</th>
                    <th className="pb-2 font-normal">Tender</th>
                    <th className="pb-2 text-right font-normal">Amount</th>
                    <th className="pb-2 text-right font-normal">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {orders.slice(0, 5).map((order) => (
                    <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 font-mono font-bold text-white">
                        {order.billNumber}
                      </td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          order.transactionType === 'NO_BILL'
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                        }`}>
                          {order.transactionType === 'NO_BILL' ? 'No-Bill' : 'Tax Invoice'}
                        </span>
                      </td>
                      <td className="py-2.5 text-zinc-400">
                        {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                      </td>
                      <td className="py-2.5 font-mono text-zinc-300">
                        {order.paymentMethod}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-[#E7C75A]">
                        ₹{order.grandTotal.toFixed(2)}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => setSelectedReceiptOrder(order)}
                          className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                          title="Reprint / View Receipt"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>


      {/* Thermal Receipt Preview Modal */}
      {selectedReceiptOrder && (
        <ReceiptModal
          order={selectedReceiptOrder}
          onClose={() => setSelectedReceiptOrder(null)}
        />
      )}

    </div>
  );
};
