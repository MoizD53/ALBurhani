import React, { useState } from 'react';
import { OrderBill } from '../../types';
import { 
  ReceiptText, 
  Search, 
  Layers, 
  Calendar,
  CheckCircle2,
  Package,
  Eye,
  ChevronDown,
  ChevronUp,
  X,
  Trash2,
  Edit2
} from 'lucide-react';

interface NoBillSalesViewProps {
  orders: OrderBill[];
  onDeleteOrder?: (orderId: string) => void;
  onModifyOrder?: (order: OrderBill) => void;
}

export const NoBillSalesView: React.FC<NoBillSalesViewProps> = ({ orders, onDeleteOrder, onModifyOrder }) => {
  const [search, setSearch] = useState('');
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  // Filter only No-Bill transactions
  const noBillSales = orders.filter((o) => o.transactionType === 'NO_BILL');

  const filtered = noBillSales.filter((s) => {
    const q = search.toLowerCase().trim();
    return (
      !q ||
      s.billNumber.toLowerCase().includes(q) ||
      s.createdAt.toLowerCase().includes(q) ||
      s.paymentMethod.toLowerCase().includes(q) ||
      s.items.some((it) => it.product.name.toLowerCase().includes(q))
    );
  });

  const totalNoBillRevenue = noBillSales.reduce((sum, s) => sum + s.grandTotal, 0);
  const totalCashNoBill = noBillSales.filter((s) => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.grandTotal, 0);
  const totalUpiNoBill = noBillSales.filter((s) => s.paymentMethod === 'UPI').reduce((sum, s) => sum + s.grandTotal, 0);

  return (
    <div className="space-y-4 select-none">
      
      {/* Top Header & Metrics */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 font-serif">
            <ReceiptText className="w-5 h-5 text-[#D4AF37]" />
            <span>No-Bill Counter Sales Audit</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Internal recorded sales without customer tax invoice · Inventory deducted accurately
          </p>
        </div>

        {/* Quick KPI stats */}
        <div className="flex items-center gap-2.5">
          <div className="px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Total Records</span>
            <span className="text-sm font-bold font-mono text-white">{noBillSales.length} Sales</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/25">
            <span className="text-[10px] uppercase font-semibold text-[#D4AF37] block">No-Bill Total</span>
            <span className="text-sm font-bold font-mono text-[#E5C158]">
              ₹{totalNoBillRevenue.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Collection Breakdown Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="p-3 rounded-xl bg-[#0C0C0F] border border-white/[0.06]">
          <span className="text-[10px] uppercase text-zinc-400 font-semibold block">Cash in Drawer</span>
          <span className="text-base font-bold font-mono text-emerald-400 mt-0.5 block">
            ₹{totalCashNoBill.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-[#0C0C0F] border border-white/[0.06]">
          <span className="text-[10px] uppercase text-zinc-400 font-semibold block">UPI Collections</span>
          <span className="text-base font-bold font-mono text-purple-400 mt-0.5 block">
            ₹{totalUpiNoBill.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-[#0C0C0F] border border-white/[0.06]">
          <span className="text-[10px] uppercase text-zinc-400 font-semibold block">Inventory Deductions</span>
          <span className="text-base font-bold font-mono text-white mt-0.5 block">
            {noBillSales.reduce((acc, s) => acc + s.items.length, 0)} Items Deducted
          </span>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative w-full sm:w-72">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by ID, Time, Product..."
          style={{ paddingLeft: '40px' }}
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

      {/* Audit Log Table */}
      <div className="rounded-2xl bg-[#121214] border border-white/[0.08] overflow-hidden shadow-xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] bg-[#161619] text-zinc-400 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Cashier</th>
                <th className="py-3 px-4 text-center">Items Sold</th>
                <th className="py-3 px-4 text-right">Subtotal</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-center">Payment</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    No internal no-bill sales recorded yet. Use the POS Billing screen with "No-Bill Sale" mode to record one.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const isExpanded = expandedSaleId === s.id;
                  return (
                    <React.Fragment key={s.id}>
                      <tr className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-[#D4AF37] whitespace-nowrap">
                          {s.billNumber}
                        </td>
                        <td className="py-3 px-4 text-zinc-300 font-mono text-[11px] whitespace-nowrap">
                          {s.createdAt}
                        </td>
                        <td className="py-3 px-4 text-zinc-300 whitespace-nowrap">
                          {s.cashierName}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-zinc-300">
                          {s.items.length} item{s.items.length > 1 ? 's' : ''}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-zinc-400">
                          ₹{s.subtotal.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white text-sm">
                          ₹{s.grandTotal.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.paymentMethod === 'UPI'
                              ? 'bg-purple-500/15 text-purple-300 border border-purple-500/25'
                              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                          }`}>
                            {s.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setExpandedSaleId(isExpanded ? null : s.id)}
                              className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
                              title="Toggle Item Details"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                            {onModifyOrder && (
                              <button
                                type="button"
                                onClick={() => onModifyOrder(s)}
                                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-amber-500/15 text-zinc-400 hover:text-amber-400 border border-white/[0.08] transition-colors"
                                title="Add Items / Modify Sale"
                                aria-label={`Modify sale ${s.billNumber}`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onDeleteOrder && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Delete this sales entry ${s.billNumber} (₹${s.grandTotal.toFixed(2)})?`)) {
                                    onDeleteOrder(s.id);
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-rose-500/15 text-zinc-500 hover:text-rose-400 border border-white/[0.08] transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                                title="Delete Entry"
                                aria-label={`Delete sales entry ${s.billNumber} for ₹${s.grandTotal.toFixed(2)}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Line Items Detail */}
                      {isExpanded && (
                        <tr className="bg-white/[0.015]">
                          <td colSpan={8} className="p-4">
                            <div className="p-3 rounded-xl bg-black/60 border border-white/[0.06] space-y-2">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-[#D4AF37] block">
                                Deducted Inventory Line Items:
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                {s.items.map((it, idx) => (
                                  <div key={idx} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                                    <div className="min-w-0">
                                      <div className="font-semibold text-white truncate">{it.product.name}</div>
                                      <div className="text-[10px] text-zinc-500 font-mono">
                                        Qty: {it.formattedQuantity || it.quantity} @ {it.formattedRate}
                                      </div>
                                    </div>
                                    <span className="font-mono font-bold text-zinc-300 shrink-0 ml-2">
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
        </div>
      </div>

    </div>
  );
};
