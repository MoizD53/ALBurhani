import React, { useState } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Receipt, 
  ArrowUpRight, 
  Plus, 
  Eye, 
  X
} from 'lucide-react';
import { OrderBill } from '../../types';
import { ReceiptModal } from '../pos/ReceiptModal';

interface FinanceViewProps {
  orders: OrderBill[];
}

interface ExpenseItem {
  id: string;
  title: string;
  category: 'Raw Materials (Ghee/Mawa/Nuts)' | 'Packaging & Boxes' | 'Store Utilities' | 'Staff Wages' | 'Other';
  amount: number;
  date: string;
  paymentMode: 'Cash' | 'UPI' | 'Bank Transfer';
}

export const FinanceView: React.FC<FinanceViewProps> = ({ orders }) => {
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<OrderBill | null>(null);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState<ExpenseItem['category']>('Raw Materials (Ghee/Mawa/Nuts)');
  const [expAmount, setExpAmount] = useState<number>(1000);
  const [expPaymentMode, setExpPaymentMode] = useState<ExpenseItem['paymentMode']>('UPI');

  // Calculations
  const totalRevenue = orders.reduce((sum, o) => sum + o.grandTotal, 0);
  const cashTotal = orders.filter((o) => o.paymentMethod === 'CASH').reduce((sum, o) => sum + o.grandTotal, 0);
  const upiTotal = orders.filter((o) => o.paymentMethod === 'UPI').reduce((sum, o) => sum + o.grandTotal, 0);
  const cardTotal = orders.filter((o) => o.paymentMethod === 'CARD').reduce((sum, o) => sum + o.grandTotal, 0);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle || !expAmount) return;

    setExpenses([
      {
        id: `exp-${Date.now()}`,
        title: expTitle,
        category: expCategory,
        amount: Number(expAmount),
        date: 'Today, Just now',
        paymentMode: expPaymentMode,
      },
      ...expenses,
    ]);

    setIsExpenseModalOpen(false);
    setExpTitle('');
    setExpAmount(1000);
  };

  return (
    <div className="space-y-5">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 font-serif">
            <DollarSign className="w-5 h-5 text-[#D4AF37]" />
            Finance & Daily Accounts
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Cash register, UPI reconciliation, daily revenue, and expense logs
          </p>
        </div>

        <button
          onClick={() => setIsExpenseModalOpen(true)}
          className="btn-gold text-xs py-2.5 px-4 flex items-center gap-2 shrink-0 font-bold"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Record Store Expense</span>
        </button>
      </div>

      {/* Top Financial Stat Cards (Responsive: 1 col on mobile, 2 on tablet, 4 on desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Revenue */}
        <div className="p-4 rounded-2xl liquid-glass border border-[#D4AF37]/35 bg-[#D4AF37]/5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-gray-300">Total Sales Today</span>
            <div className="p-2 rounded-xl bg-[#D4AF37]/20 text-[#D4AF37]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white mt-2 font-mono">
            Rs. {totalRevenue.toLocaleString('en-IN')}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{orders.length} Completed Bills</span>
          </div>
        </div>

        {/* UPI Collection */}
        <div className="p-4 rounded-2xl liquid-glass border border-purple-500/25 bg-purple-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-gray-300">UPI / QR Payment</span>
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
              <QrCode className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white mt-2 font-mono">
            Rs. {upiTotal.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Instant Bank Settlement
          </div>
        </div>

        {/* Cash in Drawer */}
        <div className="p-4 rounded-2xl liquid-glass border border-emerald-500/25 bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-gray-300">Cash in Till / Drawer</span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white mt-2 font-mono">
            Rs. {cashTotal.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Physical Cash to Deposit
          </div>
        </div>

        {/* Card Swipes */}
        <div className="p-4 rounded-2xl liquid-glass border border-blue-500/25 bg-blue-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold text-gray-300">Card Swipes / EDC</span>
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white mt-2 font-mono">
            Rs. {cardTotal.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            POS Terminal Batch
          </div>
        </div>

      </div>

      {/* Two Columns: Recent Bills vs Store Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Recent Bills (7 cols on laptop) */}
        <div className="lg:col-span-7 rounded-2xl liquid-glass border border-[#D4AF37]/20 p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#D4AF37]" />
              <h3 className="font-semibold text-white text-sm">Recent POS Bills & Receipts</h3>
            </div>
            <span className="text-xs text-gray-400 font-mono">{orders.length} orders</span>
          </div>

          <div className="space-y-2.5 max-h-[460px] overflow-y-auto custom-scrollbar pr-1">
            {orders.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-8">
                No orders billed yet. Go to POS screen and scan products!
              </p>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  className="p-3 rounded-xl bg-black/50 border border-white/5 hover:border-[#D4AF37]/30 transition-all flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#D4AF37]">
                        Bill #{order.dailyBillNumber || order.billNumber.replace(/^[A-Z-]+/, '')}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/5 text-gray-300 border border-white/10">
                        {order.paymentMethod}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1 truncate">
                      {order.items.map((i) => `${i.product.name} (x${i.quantity})`).join(', ')}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {order.createdAt}
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-2 sm:gap-3">
                    <div>
                      <div className="font-mono font-bold text-white text-sm">
                        Rs. {order.grandTotal}
                      </div>
                      <div className="text-[10px] text-emerald-400 font-medium">Paid ✓</div>
                    </div>
                    <button
                      onClick={() => setSelectedOrderForReceipt(order)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-[#D4AF37]/20 text-gray-400 hover:text-[#D4AF37] transition-colors"
                      title="View / Re-print Receipt"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Expenses & Outflows (5 cols on laptop) */}
        <div className="lg:col-span-5 rounded-2xl liquid-glass border border-white/10 p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
            <h3 className="font-semibold text-white text-sm">Today's Store Outflows</h3>
            <span className="text-xs font-mono font-bold text-red-400">
              -Rs. {totalExpenses.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="space-y-2.5 max-h-[460px] overflow-y-auto custom-scrollbar pr-1">
            {expenses.map((exp) => (
              <div
                key={exp.id}
                className="p-3 rounded-xl bg-black/50 border border-white/5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <h5 className="text-xs font-semibold text-white leading-tight truncate">
                    {exp.title}
                  </h5>
                  <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                    {exp.category} • {exp.date}
                  </div>
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] bg-white/5 text-gray-300 font-mono">
                    Paid via {exp.paymentMode}
                  </span>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm font-bold font-mono text-red-400">
                    -Rs. {exp.amount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Modal: Record Expense (Safe Viewport) */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl bg-[#0E0E0E] border border-[#D4AF37]/35 shadow-[0_20px_60px_rgba(0,0,0,0.9)] max-h-[90vh] flex flex-col overflow-hidden">
            
            <div className="px-5 sm:px-6 py-4 border-b border-[#D4AF37]/20 bg-gradient-to-r from-black via-[#161616] to-black flex items-center justify-between shrink-0">
              <h3 className="font-bold text-white text-sm sm:text-base font-serif flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#D4AF37] stroke-[2.5]" />
                Record Store Expense
              </h3>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="p-5 sm:p-6 overflow-y-auto space-y-4 custom-scrollbar flex-1">
              <div>
                <label className="text-xs text-gray-300 font-semibold block mb-1">
                  Expense Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Milk & Khoya purchase, Sweets Box packaging"
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  className="text-xs sm:text-sm bg-black/50 border-[#D4AF37]/30 text-white"
                />
              </div>

              <div>
                <label className="text-xs text-gray-300 font-semibold block mb-1">
                  Category
                </label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as any)}
                  className="text-xs sm:text-sm bg-black/50 border-[#D4AF37]/30 text-white"
                >
                  <option value="Raw Materials (Ghee/Mawa/Nuts)">Raw Materials (Ghee/Mawa/Nuts)</option>
                  <option value="Packaging & Boxes">Packaging & Boxes</option>
                  <option value="Store Utilities">Store Utilities</option>
                  <option value="Staff Wages">Staff Wages</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-300 font-semibold block mb-1">
                    Amount (Rs. )
                  </label>
                  <input
                    type="number"
                    required
                    value={expAmount}
                    onChange={(e) => setExpAmount(Number(e.target.value))}
                    className="text-xs sm:text-sm bg-black/50 border-[#D4AF37]/30 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-300 font-semibold block mb-1">
                    Paid Via
                  </label>
                  <select
                    value={expPaymentMode}
                    onChange={(e) => setExpPaymentMode(e.target.value as any)}
                    className="text-xs sm:text-sm bg-black/50 border-[#D4AF37]/30 text-white"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-gold text-xs py-2 px-4 font-bold">
                  Save Expense
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Completed Thermal Receipt Modal */}
      <ReceiptModal
        order={selectedOrderForReceipt}
        onClose={() => setSelectedOrderForReceipt(null)}
      />

    </div>
  );
};
