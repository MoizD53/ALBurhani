import React, { useState } from 'react';
import { ExpenseItem } from '../../types';
import { 
  TrendingDown, 
  Plus, 
  Search, 
  Download, 
  CreditCard, 
  Banknote, 
  Calendar, 
  Tag, 
  X,
  ArrowUpDown
} from 'lucide-react';

interface ExpensesViewProps {
  expenses: ExpenseItem[];
  onAddExpense: (expense: ExpenseItem) => void;
}

export const EXPENSE_CATEGORIES = [
  'Raw Materials (Ghee/Mawa/Nuts)',
  'Packaging & Boxes',
  'Staff Salaries & Wages',
  'Store Commercial Electricity',
  'Wi-Fi & Internet Bill',
  'Shop Rent',
  'Cleaning & Housekeeping',
  'Transport & Delivery',
  'Repairs & Maintenance',
  'Equipment Purchases',
  'Miscellaneous',
];

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  onAddExpense,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState<number | string>(1500);
  const [paymentMode, setPaymentMode] = useState<ExpenseItem['paymentMode']>('UPI');
  const [paidTo, setPaidTo] = useState('');
  const [notes, setNotes] = useState('');

  const filtered = expenses.filter((e) => {
    const matchesCat = categoryFilter === 'All' || e.category === categoryFilter;
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      e.title.toLowerCase().includes(q) ||
      (e.paidTo && e.paidTo.toLowerCase().includes(q)) ||
      e.category.toLowerCase().includes(q) ||
      e.date.toLowerCase().includes(q);

    return matchesCat && matchesSearch;
  });

  const totalExpenseAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Group by category
  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || Number(amount) <= 0) return;

    const newExpense: ExpenseItem = {
      id: `expense-${Date.now()}`,
      title: title.trim(),
      category,
      amount: Number(amount),
      date: `Today, ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
      paymentMode,
      paidTo: paidTo.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    onAddExpense(newExpense);
    setIsAddModalOpen(false);

    // Reset
    setTitle('');
    setAmount(1500);
    setPaidTo('');
    setNotes('');
  };

  const handleExportCSV = () => {
    const headers = ['Title', 'Category', 'Amount (INR)', 'Date & Time', 'Payment Mode', 'Paid To / Vendor', 'Notes'];
    const rows = expenses.map((e) => [
      `"${e.title.replace(/"/g, '""')}"`,
      `"${e.category}"`,
      e.amount,
      `"${e.date}"`,
      e.paymentMode,
      `"${(e.paidTo || '').replace(/"/g, '""')}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AL_BHURANI_Expenses_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 select-none">
      
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 font-serif">
            <TrendingDown className="w-5 h-5 text-red-400" />
            <span>Store Operating Expenses</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Track daily raw materials, packaging, staff wages, and utilities
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-white/[0.04] text-zinc-300 hover:text-white hover:bg-white/[0.08] border border-white/[0.08] flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-gold text-xs py-2 px-3.5 flex items-center gap-1.5 font-bold"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-[#121214] border border-white/[0.08]">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Total Expenses</span>
          <span className="text-xl font-bold font-mono text-white mt-1 block">
            ₹{totalExpenseAmount.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#121214] border border-white/[0.08]">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Total Entries</span>
          <span className="text-xl font-bold font-mono text-white mt-1 block">
            {expenses.length} Records
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#121214] border border-white/[0.08]">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Largest Category</span>
          <span className="text-xs font-bold text-[#D4AF37] mt-1 block truncate">
            {Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#121214] border border-white/[0.08]">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Payment Mode</span>
          <span className="text-xs font-bold text-emerald-400 mt-1 block">
            UPI & Cash Reconciled
          </span>
        </div>
      </div>

      {/* Controls: Search and Category Pills */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        
        {/* Category Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar flex-nowrap">
          {['All', ...EXPENSE_CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                categoryFilter === c
                  ? 'bg-[#D4AF37] text-black shadow-sm'
                  : 'bg-white/[0.03] text-zinc-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.06]'
              }`}
            >
              {c.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, vendor..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-black/40 border border-white/[0.08] rounded-xl text-white placeholder:text-zinc-500 focus:border-[#D4AF37]/50 focus:outline-none"
          />
        </div>

      </div>

      {/* Expenses Table */}
      <div className="rounded-2xl bg-[#121214] border border-white/[0.08] overflow-hidden shadow-xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] bg-[#161619] text-zinc-400 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3 px-4">Title / Expense Item</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Paid To / Vendor</th>
                <th className="py-3 px-4 text-center">Payment Mode</th>
                <th className="py-3 px-4 text-right">Amount (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    No operating expenses recorded matching your search.
                  </td>
                </tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-semibold text-white">
                      <div>{e.title}</div>
                      {e.notes && <div className="text-[10px] text-zinc-500">{e.notes}</div>}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-zinc-300 border border-white/10">
                        {e.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-300 font-mono text-[11px] whitespace-nowrap">
                      {e.date}
                    </td>
                    <td className="py-3 px-4 text-zinc-400 whitespace-nowrap">
                      {e.paidTo || 'Direct Store Outflow'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/[0.04] text-zinc-300 border border-white/[0.08]">
                        {e.paymentMode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-red-400 text-sm whitespace-nowrap">
                      ₹{e.amount.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
          <div className="relative w-full max-w-md rounded-2xl bg-[#121214] border border-[#D4AF37]/35 shadow-[0_24px_70px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-white/[0.08] bg-[#161619] flex items-center justify-between shrink-0">
              <h3 className="font-bold text-white text-sm sm:text-base font-serif flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span>Record Store Expense</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateExpense} className="p-5 space-y-3.5">
              <div>
                <label className="text-xs text-zinc-300 font-semibold block mb-1">
                  Expense Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amul Pure Ghee 15kg Tin, Box Packaging Batch"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs py-2 px-3 bg-black/50 border border-white/[0.1] rounded-xl text-white focus:border-[#D4AF37]/60 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-300 font-semibold block mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs py-2 px-2.5 bg-black/50 border border-white/[0.1] rounded-xl text-white focus:border-[#D4AF37]/60 focus:outline-none"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-zinc-300 font-semibold block mb-1">
                    Amount (₹ INR) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full text-xs py-2 px-3 bg-black/50 border border-[#D4AF37]/40 rounded-xl text-white font-mono font-bold focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-300 font-semibold block mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full text-xs py-2 px-2.5 bg-black/50 border border-white/[0.1] rounded-xl text-white focus:border-[#D4AF37]/60 focus:outline-none"
                  >
                    <option value="UPI">UPI / QR Code</option>
                    <option value="Cash">Cash in Drawer</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    <option value="Card">Credit / Debit Card</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-zinc-300 font-semibold block mb-1">
                    Paid To / Vendor
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Amul Dairy, Xprinter Supplier"
                    value={paidTo}
                    onChange={(e) => setPaidTo(e.target.value)}
                    className="w-full text-xs py-2 px-3 bg-black/50 border border-white/[0.1] rounded-xl text-white focus:border-[#D4AF37]/60 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-300 font-semibold block mb-1">
                  Optional Notes / Invoice #
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bill # 4821, Paid by Counter 01"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs py-2 px-3 bg-black/50 border border-white/[0.1] rounded-xl text-white focus:border-[#D4AF37]/60 focus:outline-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-white/[0.08] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gold text-xs py-2 px-4 font-bold"
                >
                  Save Expense Entry
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
