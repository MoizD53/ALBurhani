import React, { useState } from 'react';
import { Product, OrderBill, ExpenseItem } from '../../types';
import { 
  BarChart3, 
  Download 
} from 'lucide-react';
import { isOrderInDateRange } from '../../lib/utils';
import { formatQuantity } from '../../lib/pricing';

interface ReportsViewProps {
  products: Product[];
  orders: OrderBill[];
  expenses: ExpenseItem[];
}

export type ReportType = 
  | 'combined-sales' 
  | 'customer-bills' 
  | 'no-bill-sales' 
  | 'product-sales' 
  | 'category-sales' 
  | 'payment-reconciliation' 
  | 'expenses';

export const ReportsView: React.FC<ReportsViewProps> = ({
  products,
  orders,
  expenses,
}) => {
  const [reportType, setReportType] = useState<ReportType>('combined-sales');
  const [dateRange, setDateRange] = useState<'today' | '7days' | 'month' | 'all'>('all');

  // Filter orders by date range using reliable date/timestamp parsing
  const filteredOrders = orders.filter((o) => isOrderInDateRange(o, dateRange));

  // Calculate Product-Wise Aggregates
  const productAggregates = new Map<string, { product: Product; totalQty: number; totalRevenue: number; ordersCount: number }>();
  for (const o of filteredOrders) {
    for (const it of o.items) {
      const existing = productAggregates.get(it.product.id) || {
        product: it.product,
        totalQty: 0,
        totalRevenue: 0,
        ordersCount: 0,
      };
      existing.totalQty += it.quantity;
      existing.totalRevenue += it.lineTotal;
      existing.ordersCount += 1;
      productAggregates.set(it.product.id, existing);
    }
  }
  const productSalesList = Array.from(productAggregates.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Calculate Category-Wise Aggregates
  const categoryAggregates = new Map<string, { category: string; totalRevenue: number; itemsSold: number }>();
  for (const o of filteredOrders) {
    for (const it of o.items) {
      const cat = it.product.category || 'Other';
      const existing = categoryAggregates.get(cat) || { category: cat, totalRevenue: 0, itemsSold: 0 };
      existing.totalRevenue += it.lineTotal;
      existing.itemsSold += it.quantity;
      categoryAggregates.set(cat, existing);
    }
  }
  const categorySalesList = Array.from(categoryAggregates.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Payment method totals
  const cashTotal = filteredOrders.filter((o) => o.paymentMethod === 'CASH').reduce((sum, o) => sum + o.grandTotal, 0);
  const upiTotal = filteredOrders.filter((o) => o.paymentMethod === 'UPI').reduce((sum, o) => sum + o.grandTotal, 0);
  const cardTotal = filteredOrders.filter((o) => o.paymentMethod === 'CARD').reduce((sum, o) => sum + o.grandTotal, 0);

  // CSV Export Handler
  const handleExportCurrentReport = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = `AL_BURHANI_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;

    if (reportType === 'combined-sales' || reportType === 'customer-bills' || reportType === 'no-bill-sales') {
      const targetOrders = reportType === 'customer-bills'
        ? filteredOrders.filter((o) => o.transactionType === 'CUSTOMER_BILL' || !o.transactionType)
        : reportType === 'no-bill-sales'
        ? filteredOrders.filter((o) => o.transactionType === 'NO_BILL')
        : filteredOrders;

      headers = ['Bill / Ref #', 'Type', 'Date & Time', 'Customer Name', 'Phone', 'Items Count', 'Subtotal (INR)', 'GST (INR)', 'Total Amount (INR)', 'Payment Mode', 'Cashier'];
      rows = targetOrders.map((o) => [
        `="$Bill #{o.dailyBillNumber || o.billNumber.replace(/^[A-Z-]+/, '')}"`,
        o.transactionType || 'CUSTOMER_BILL',
        `"${o.createdAt}"`,
        `"${o.customerName || 'Walk-in'}"`,
        `="${o.customerPhone || ''}"`,
        o.items.length,
        o.subtotal,
        o.gstAmount,
        o.grandTotal,
        o.paymentMethod,
        `"${o.cashierName}"`,
      ]);
    } else if (reportType === 'product-sales') {
      headers = ['SKU', 'Barcode', 'Product Name', 'Category', 'Unit Basis', 'Quantity / Weight Sold', 'Total Revenue (INR)'];
      rows = productSalesList.map((item) => [
        `="${item.product.sku}"`,
        `="${item.product.barcode}"`,
        `"${item.product.name.replace(/"/g, '""')}"`,
        `"${item.product.category}"`,
        item.product.unit,
        item.totalQty,
        item.totalRevenue,
      ]);
    } else if (reportType === 'category-sales') {
      headers = ['Category', 'Items Sold Count', 'Total Revenue (INR)'];
      rows = categorySalesList.map((c) => [
        `"${c.category}"`,
        c.itemsSold,
        c.totalRevenue,
      ]);
    } else if (reportType === 'payment-reconciliation') {
      headers = ['Payment Mode', 'Total Amount (INR)', 'Bills Count'];
      rows = [
        ['CASH', cashTotal, filteredOrders.filter((o) => o.paymentMethod === 'CASH').length],
        ['UPI / QR', upiTotal, filteredOrders.filter((o) => o.paymentMethod === 'UPI').length],
        ['CARD', cardTotal, filteredOrders.filter((o) => o.paymentMethod === 'CARD').length],
      ];
    } else if (reportType === 'expenses') {
      headers = ['Title', 'Category', 'Amount (INR)', 'Date & Time', 'Payment Mode', 'Paid To / Vendor'];
      rows = expenses.map((e) => [
        `"${e.title.replace(/"/g, '""')}"`,
        `"${e.category}"`,
        e.amount,
        `"${e.date}"`,
        e.paymentMode,
        `"${e.paidTo || ''}"`,
      ]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 select-none">
      
      {/* Header & Export */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-stone-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#B8860B]" />
            <span>Store Reports & Export Engine</span>
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Date Range Selector */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#E8DEC8] shadow-sm">
            {[
              ['all', 'All Time'],
              ['today', 'Today'],
              ['7days', '7 Days'],
              ['month', 'This Month'],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setDateRange(key as any)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  dateRange === key
                    ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCurrentReport}
            className="btn-gold text-xs py-2 px-3.5 flex items-center gap-1.5 font-bold shadow-md"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Report Type Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-[#E8DEC8]">
        {[
          { id: 'combined-sales', label: 'Sales Bills' },
          { id: 'product-sales', label: 'Product-Wise Sales' },
          { id: 'category-sales', label: 'Category-Wise Sales' },
          { id: 'payment-reconciliation', label: 'Payment Reconciliation' },
          { id: 'expenses', label: 'Expenses Audit' },
        ].map((tab) => {
          const isSelected = reportType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id as ReportType)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-[#FBF7EE] text-[#A67D0C] border-b-2 border-[#C99A18]'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Report Data Display Panels */}

      {/* 1. Combined Sales, Customer Bills, or No-Bill Sales Table */}
      {(reportType === 'combined-sales' || reportType === 'customer-bills' || reportType === 'no-bill-sales') && (
        <div className="rounded-2xl bg-white border border-[#E8DEC8] overflow-hidden shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E8DEC8] bg-[#FAF8F5] text-stone-600 uppercase tracking-wider font-bold text-[10px]">
                  <th className="py-3 px-4">Bill #</th>
                  <th className="py-3 px-4">Transaction Type</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                  <th className="py-3 px-4 text-right">GST</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-center">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DEC8]">
                {filteredOrders
                  .filter((o) => {
                    if (reportType === 'customer-bills') return o.transactionType === 'CUSTOMER_BILL' || !o.transactionType;
                    if (reportType === 'no-bill-sales') return o.transactionType === 'NO_BILL';
                    return true;
                  })
                  .map((o) => (
                    <tr key={o.id} className="hover:bg-[#FAF8F5] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#A67D0C] whitespace-nowrap">
                        {o.billNumber}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          o.transactionType === 'NO_BILL'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}>
                          {o.transactionType === 'NO_BILL' ? 'NO-BILL SALE' : 'CUSTOMER BILL'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-600 text-[11px] whitespace-nowrap">
                        {o.createdAt}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-stone-800 font-medium">
                        {o.customerName || 'Walk-in'}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-stone-700">
                        {o.items.length}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-stone-600">
                        Rs. {o.subtotal.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-stone-600">
                        Rs. {o.gstAmount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-stone-900 text-sm">
                        Rs. {o.grandTotal.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-[10px] px-2 py-0.5 rounded bg-[#FAF8F5] text-stone-700 border border-[#E8DEC8]">
                          {o.paymentMethod}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Product-Wise Sales Report */}
      {reportType === 'product-sales' && (
        <div className="rounded-2xl bg-white border border-[#E8DEC8] overflow-hidden shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E8DEC8] bg-[#FAF8F5] text-stone-600 uppercase tracking-wider font-bold text-[10px]">
                  <th className="py-3 px-4">SKU / Code</th>
                  <th className="py-3 px-4">Barcode</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Unit</th>
                  <th className="py-3 px-4 text-right">Units / Weight Sold</th>
                  <th className="py-3 px-4 text-right">Total Revenue (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DEC8]">
                {productSalesList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-stone-400">
                      No sales recorded for any product in this period.
                    </td>
                  </tr>
                ) : (
                  productSalesList.map((item) => (
                    <tr key={item.product.id} className="hover:bg-[#FAF8F5] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#A67D0C]">
                        {item.product.sku}
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-600">
                        {item.product.barcode}
                      </td>
                      <td className="py-3 px-4 font-bold text-stone-900">
                        {item.product.name}
                      </td>
                      <td className="py-3 px-4 text-stone-600">
                        {item.product.category}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-stone-700">
                        {item.product.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-stone-900">
                        {formatQuantity(item.totalQty, item.product.unit)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#A67D0C] text-sm">
                        Rs. {item.totalRevenue.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Payment Reconciliation */}
      {reportType === 'payment-reconciliation' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="p-5 rounded-2xl bg-white border border-[#E8DEC8] space-y-2 shadow-sm">
            <span className="text-xs uppercase font-bold text-stone-500 block">Cash Settlements</span>
            <span className="text-2xl font-black font-mono text-emerald-600 block">
              Rs. {cashTotal.toLocaleString('en-IN')}
            </span>
            <p className="text-[11px] text-stone-500">
              {filteredOrders.filter((o) => o.paymentMethod === 'CASH').length} Cash bills completed
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#E8DEC8] space-y-2 shadow-sm">
            <span className="text-xs uppercase font-bold text-stone-500 block">UPI Bank Settlements</span>
            <span className="text-2xl font-black font-mono text-purple-600 block">
              Rs. {upiTotal.toLocaleString('en-IN')}
            </span>
            <p className="text-[11px] text-stone-500">
              {filteredOrders.filter((o) => o.paymentMethod === 'UPI').length} UPI / QR bills completed
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#E8DEC8] space-y-2 shadow-sm">
            <span className="text-xs uppercase font-bold text-stone-500 block">Card Swipes</span>
            <span className="text-2xl font-black font-mono text-blue-600 block">
              Rs. {cardTotal.toLocaleString('en-IN')}
            </span>
            <p className="text-[11px] text-stone-500">
              {filteredOrders.filter((o) => o.paymentMethod === 'CARD').length} Card swipe bills completed
            </p>
          </div>
        </div>
      )}

      {/* 4. Category-Wise Sales */}
      {reportType === 'category-sales' && (
        <div className="rounded-2xl bg-white border border-[#E8DEC8] overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E8DEC8] bg-[#FAF8F5] text-stone-600 uppercase tracking-wider font-bold text-[10px]">
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Items Count</th>
                <th className="py-3 px-4 text-right">Total Revenue (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DEC8]">
              {categorySalesList.map((c) => (
                <tr key={c.category} className="hover:bg-[#FAF8F5] transition-colors">
                  <td className="py-3 px-4 font-bold text-stone-900">
                    {c.category}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-stone-700">
                    {c.itemsSold}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-[#A67D0C] text-sm">
                    Rs. {c.totalRevenue.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Expenses Audit Report */}
      {reportType === 'expenses' && (
        <div className="rounded-2xl bg-white border border-[#E8DEC8] overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E8DEC8] bg-[#FAF8F5] text-stone-600 uppercase tracking-wider font-bold text-[10px]">
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Paid To</th>
                <th className="py-3 px-4 text-center">Mode</th>
                <th className="py-3 px-4 text-right">Amount (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DEC8]">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-[#FAF8F5] transition-colors">
                  <td className="py-3 px-4 font-bold text-stone-900">{e.title}</td>
                  <td className="py-3 px-4 text-stone-600">{e.category}</td>
                  <td className="py-3 px-4 text-stone-600 font-mono text-[11px]">{e.date}</td>
                  <td className="py-3 px-4 text-stone-600">{e.paidTo || 'Direct'}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-[#FAF8F5] text-stone-700 border border-[#E8DEC8]">{e.paymentMode}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">Rs. {e.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};
