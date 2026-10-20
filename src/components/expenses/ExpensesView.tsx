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
          <h2 className="text-lg sm:text-xl font-bold text-stone-900 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-rose-600" />
            <span>Store Operating Expenses</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Track daily raw materials, packaging, staff wages, and utilities
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white text-stone-700 hover:text-stone-900 hover:bg-[#FAF8F5] border border-[#E8DEC8] flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-gold text-xs py-2 px-3.5 flex items-center gap-1.5 font-bold shadow-md"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-white border border-[#E8DEC8] shadow-sm">
          <span className="text-[10px] uppercase font-bold text-stone-500 block">Total Expenses</span>
          <span className="text-xl font-bold font-mono text-stone-900 mt-1 block">
            Rs. {totalExpenseAmount.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-[#E8DEC8] shadow-sm">
          <span className="text-[10px] uppercase font-bold text-stone-500 block">Total Entries</span>
          <span className="text-xl font-bold font-mono text-stone-900 mt-1 block">
            {expenses.length} Records
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-[#E8DEC8] shadow-sm">
          <span className="text-[10px] uppercase font-bold text-stone-500 block">Largest Category</span>
          <span className="text-xs font-bold text-[#A67D0C] mt-1 block truncate">
            {Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-[#E8DEC8] shadow-sm">
          <span className="text-[10px] uppercase font-bold text-stone-500 block">Payment Mode</span>
          <span className="text-xs font-bold text-emerald-600 mt-1 block">
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                categoryFilter === c
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-sm'
                  : 'bg-white text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5] border border-[#E8DEC8]'
              }`}
            >
              {c.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, vendor..."
            style={{ paddingLeft: '34px' }}
            className="w-full pr-8 py-2 text-xs bg-white border border-[#E8DEC8] rounded-xl text-stone-900 placeholder:text-stone-400 focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </div>

      {/* Expenses Table */}
      <div className="rounded-2xl bg-white border border-[#E8DEC8] overflow-hidden shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E8DEC8] bg-[#FAF8F5] text-stone-600 uppercase tracking-wider font-bold text-[10px]">
                <th className="py-3 px-4">Title / Expense Item</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Paid To / Vendor</th>
                <th className="py-3 px-4 text-center">Payment Mode</th>
                <th className="py-3 px-4 text-right">Amount (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DEC8]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400">
                    No operating expenses recorded matching your search.
                  </td>
                </tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="py-3 px-4 font-bold text-stone-900">
                      <div>{e.title}</div>
                      {e.notes && <div className="text-[10px] text-stone-400">{e.notes}</div>}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#FAF8F5] text-stone-700 border border-[#E8DEC8] font-semibold">
                        {e.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-stone-600 font-mono text-[11px] whitespace-nowrap">
                      {e.date}
                    </td>
                    <td className="py-3 px-4 text-stone-600 whitespace-nowrap">
                      {e.paidTo || 'Direct Store Outflow'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FAF8F5] text-stone-700 border border-[#E8DEC8]">
                        {e.paymentMode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 text-sm whitespace-nowrap">
                      Rs. {e.amount.toLocaleString('en-IN')}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in select-none">
          <div className="relative w-full max-w-md rounded-2xl bg-white border border-[#E8DEC8] shadow-2xl overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-[#E8DEC8] bg-[#FAF8F5] flex items-center justify-between shrink-0">
              <h3 className="font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-600" />
                <span>Record Store Expense</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateExpense} className="p-5 space-y-3.5 bg-white">
              <div>
                <label className="text-xs text-stone-700 font-bold block mb-1">
                  Expense Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amul Pure Ghee 15kg Tin, Box Packaging Batch"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs py-2 px-3 bg-white border border-[#E8DEC8] rounded-xl text-stone-900 focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-stone-700 font-bold block mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs py-2 px-2.5 bg-white border border-[#E8DEC8] rounded-xl text-stone-900 focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-stone-700 font-bold block mb-1">
                    Amount (Rs. INR) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full text-xs py-2 px-3 bg-white border border-[#E8DEC8] rounded-xl text-stone-900 font-mono font-bold focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-stone-700 font-bold block mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full text-xs py-2 px-2.5 bg-white border border-[#E8DEC8] rounded-xl text-stone-900 focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
                  >
                    <option value="UPI">UPI / QR Code</option>
                    <option value="Cash">Cash in Drawer</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    <option value="Card">Credit / Debit Card</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-stone-700 font-bold block mb-1">
                    Paid To / Vendor
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Amul Dairy, Xprinter Supplier"
                    value={paidTo}
                    onChange={(e) => setPaidTo(e.target.value)}
                    className="w-full text-xs py-2 px-3 bg-white border border-[#E8DEC8] rounded-xl text-stone-900 focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-stone-700 font-bold block mb-1">
                  Optional Notes / Invoice #
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bill # 4821, Paid by Counter 01"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs py-2 px-3 bg-white border border-[#E8DEC8] rounded-xl text-stone-900 focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-[#E8DEC8] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gold text-xs py-2 px-4 font-bold shadow-md"
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
