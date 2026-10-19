import React, { useState } from 'react';
import { OrderBill } from '../../types';
import { 
  FileText, 
  Search, 
  Printer, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Calendar,
  Eye,
  CheckCircle2,
  X
} from 'lucide-react';
import { ReceiptModal } from '../pos/ReceiptModal';

interface CustomerBillsViewProps {
  orders: OrderBill[];
}

export const CustomerBillsView: React.FC<CustomerBillsViewProps> = ({ orders }) => {
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<OrderBill | null>(null);

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
  const totalGstCollected = customerBills.reduce((sum, b) => sum + b.gstAmount, 0);

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

      {/* Controls: Search & Payment Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        
        {/* Search */}
        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Bill #, Customer, Phone..."
            style={{ paddingLeft: '34px' }}
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
                <th className="py-3 px-4 text-center">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-500">
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
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedOrderForReceipt(b)}
                        className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-[#D4AF37]/15 text-zinc-400 hover:text-[#D4AF37] border border-white/[0.08] transition-colors"
                        title="View & Reprint Thermal Receipt"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Thermal Receipt Modal */}
      <ReceiptModal
        order={selectedOrderForReceipt}
        onClose={() => setSelectedOrderForReceipt(null)}
      />

    </div>
  );
};
