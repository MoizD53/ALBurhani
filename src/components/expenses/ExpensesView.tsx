import React, { useState, useMemo } from 'react';
import { ExpenseItem, PurchaseBill } from '../../types';
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
  Truck,
  CheckCircle2,
  Clock,
  ArrowUpDown
} from 'lucide-react';

interface ExpensesViewProps {
  expenses: ExpenseItem[];
  onAddExpense: (expense: ExpenseItem) => void;
  purchaseBills?: PurchaseBill[];
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

interface UnifiedOutflowItem {
  id: string;
  source: 'OPERATING_EXPENSE' | 'PURCHASE_BILL';
  title: string;
  category: string;
  amount: number; // actual cash paid outflow
  totalValue?: number; // total invoice value (for purchases)
  dueAmount?: number; // balance due to supplier (if any)
  date: string;
  paymentMode: string;
  paidTo?: string;
  notes?: string;
  purchaseBillRef?: PurchaseBill;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  onAddExpense,
  purchaseBills = [],
}) => {
  const [search, setSearch] = useState('');
  const [outflowType, setOutflowType] = useState<'ALL' | 'OPERATING' | 'PURCHASE'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState<number | string>(1500);
  const [paymentMode, setPaymentMode] = useState<ExpenseItem['paymentMode']>('UPI');
  const [paidTo, setPaidTo] = useState('');
  const [notes, setNotes] = useState('');

  // 1. Transform Operating Expenses
  const operatingItems: UnifiedOutflowItem[] = useMemo(() => {
    return expenses.map((e) => ({
      id: e.id,
      source: 'OPERATING_EXPENSE',
      title: e.title,
      category: e.category,
      amount: e.amount,
      totalValue: e.amount,
      dueAmount: 0,
      date: e.date,
      paymentMode: e.paymentMode,
      paidTo: e.paidTo,
      notes: e.notes,
    }));
  }, [expenses]);

  // 2. Derive Purchase Items (without duplicating in database)
  const purchaseItems: UnifiedOutflowItem[] = useMemo(() => {
    return purchaseBills
      .filter((b) => b.status !== 'Cancelled')
      .map((b) => {
        const itemNames = b.items.map((i) => i.productName).join(', ');
        return {
          id: `pur-exp-${b.id}`,
          source: 'PURCHASE_BILL',
          title: `Vendor Purchase: ${b.vendorName}`,
          category: 'Supplier Purchases (Inward Goods)',
          amount: b.amountPaid, // Cash Outflow
          totalValue: b.grandTotal,
          dueAmount: b.balanceDue,
          date: b.purchaseDate || b.businessDate || (b.createdAt ? b.createdAt.slice(0, 10) : ''),
          paymentMode: b.paymentMode || 'Cash',
          paidTo: b.vendorName,
          notes: `${b.purchaseNumber} (Daily #${b.dailyBillNumber}) • ${b.items.length} items: ${itemNames}${
            b.balanceDue > 0 ? ` • Outstanding Due: ₹${b.balanceDue.toFixed(2)}` : ''
          }`,
          purchaseBillRef: b,
        };
      });
  }, [purchaseBills]);

  // Combine unified list
  const allOutflows: UnifiedOutflowItem[] = useMemo(() => {
    return [...operatingItems, ...purchaseItems].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [operatingItems, purchaseItems]);

  // Financial Summaries
  const operatingTotal = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);
  const purchasePaidTotal = useMemo(
    () => purchaseBills.filter((b) => b.status !== 'Cancelled').reduce((sum, b) => sum + (b.amountPaid || 0), 0),
    [purchaseBills]
  );
  const totalCashOutflow = operatingTotal + purchasePaidTotal;
  const totalOutstandingDue = useMemo(
    () => purchaseBills.filter((b) => b.status !== 'Cancelled').reduce((sum, b) => sum + (b.balanceDue || 0), 0),
    [purchaseBills]
  );

  // Group Operating by category
  const categoryTotals = useMemo(() => {
    return expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);
  }, [expenses]);

  // Filtered outflows
  const filtered = useMemo(() => {
    return allOutflows.filter((item) => {
      // Type filter
      if (outflowType === 'OPERATING' && item.source !== 'OPERATING_EXPENSE') return false;
      if (outflowType === 'PURCHASE' && item.source !== 'PURCHASE_BILL') return false;

      // Category filter
      if (categoryFilter !== 'All') {
        if (item.source === 'OPERATING_EXPENSE' && item.category !== categoryFilter) return false;
        if (item.source === 'PURCHASE_BILL' && categoryFilter !== 'Supplier Purchases (Inward Goods)') return false;
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesPaidTo = (item.paidTo || '').toLowerCase().includes(q);
        const matchesCat = item.category.toLowerCase().includes(q);
        const matchesDate = item.date.toLowerCase().includes(q);
        const matchesNotes = (item.notes || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesPaidTo && !matchesCat && !matchesDate && !matchesNotes) {
          return false;
        }
      }

      return true;
    });
  }, [allOutflows, outflowType, categoryFilter, search]);

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
    const headers = ['Type', 'Title', 'Category', 'Paid Outflow (INR)', 'Total Value (INR)', 'Date', 'Payment Mode', 'Paid To / Vendor', 'Notes'];
    const rows = filtered.map((e) => [
      `"${e.source === 'OPERATING_EXPENSE' ? 'Operating Expense' : 'Supplier Purchase'}"`,
      `"${e.title.replace(/"/g, '""')}"`,
      `"${e.category}"`,
      e.amount,
      e.totalValue ?? e.amount,
      `"${e.date}"`,
      e.paymentMode,
      `"${(e.paidTo || '').replace(/"/g, '""')}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AL_BURHANI_Expenses_${new Date().toISOString().split('T')[0]}.csv`);
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
            <span>Store Outflows & Expense Management</span>
          </h2>
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
          <span className="text-[10px] uppercase font-bold text-stone-500 block">Operating Overheads</span>
          <span className="text-xl font-bold font-mono text-stone-900 mt-1 block">
            ₹{operatingTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-stone-400 mt-0.5 block">{expenses.length} operating records</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-[#E8DEC8] shadow-sm">
          <span className="text-[10px] uppercase font-bold text-stone-500 block">Supplier Purchases Paid</span>
          <span className="text-xl font-bold font-mono text-emerald-700 mt-1 block">
            ₹{purchasePaidTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-emerald-600 mt-0.5 block">Procurement cash outflow</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-[#E8DEC8] shadow-sm">
          <span className="text-[10px] uppercase font-bold text-stone-500 block">Total Cash Outflow</span>
          <span className="text-xl font-bold font-mono text-rose-600 mt-1 block">
            ₹{totalCashOutflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-rose-500 mt-0.5 block">Operating + Vendor Paid</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-[#E8DEC8] shadow-sm">
          <span className="text-[10px] uppercase font-bold text-stone-500 block">Outstanding Vendor Due</span>
          <span className="text-xl font-bold font-mono text-amber-700 mt-1 block">
            ₹{totalOutstandingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-amber-600 mt-0.5 block">Pending supplier payables</span>
        </div>
      </div>

      {/* Outflow Type Toggle Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E8DEC8] pb-1">
        <button
          type="button"
          onClick={() => setOutflowType('ALL')}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
            outflowType === 'ALL'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          All Outflows ({allOutflows.length})
        </button>
        <button
          type="button"
          onClick={() => setOutflowType('OPERATING')}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
            outflowType === 'OPERATING'
              ? 'bg-[#B8860B] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          Operating Expenses Only ({operatingItems.length})
        </button>
        <button
          type="button"
          onClick={() => setOutflowType('PURCHASE')}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
            outflowType === 'PURCHASE'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          Supplier Purchases Only ({purchaseItems.length})
        </button>
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

      {/* Mobile Outflow Cards (< 640px) */}
      <div className="sm:hidden space-y-2.5">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-stone-400 bg-white rounded-2xl border border-[#E8DEC8]">
            No outflows recorded matching your filter.
          </div>
        ) : (
          filtered.map((item) => (
            <div 
              key={item.id}
              className="p-3.5 rounded-2xl bg-white border border-[#E8DEC8] shadow-sm space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    {item.source === 'PURCHASE_BILL' ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-[#8C6D15] border border-amber-200">
                        <Truck className="w-2.5 h-2.5" /> Purchase
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
                        Operating
                      </span>
                    )}
                    <h4 className="font-bold text-stone-900 text-sm leading-tight">{item.title}</h4>
                  </div>
                  <span className="text-[10px] text-stone-400 font-mono mt-0.5 block">{item.date}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-rose-600 text-base block">
                    ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  {item.dueAmount && item.dueAmount > 0 ? (
                    <span className="text-[10px] font-mono text-amber-700 font-bold block">
                      Due: ₹{item.dueAmount.toFixed(2)}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-[#F5F2EB]">
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#FAF8F5] text-stone-700 border border-[#E8DEC8] font-semibold">
                  {item.category}
                </span>
                <span className="text-stone-500 text-[11px]">
                  Paid via: <strong className="text-stone-700">{item.paymentMode}</strong>
                </span>
              </div>

              {item.paidTo && (
                <div className="text-[11px] text-stone-500 pt-0.5">
                  Paid to: <span className="text-stone-800 font-medium">{item.paidTo}</span>
                </div>
              )}

              {item.notes && (
                <div className="text-[10px] text-stone-400 font-mono pt-0.5">
                  {item.notes}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Outflows Table (Tablets & Desktop) */}
      <div className="hidden sm:block rounded-2xl bg-white border border-[#E8DEC8] overflow-hidden shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E8DEC8] bg-[#FAF8F5] text-stone-600 uppercase tracking-wider font-bold text-[10px]">
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Title / Outflow Item</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Paid To / Supplier</th>
                <th className="py-3 px-4 text-center">Payment Mode</th>
                <th className="py-3 px-4 text-right">Cash Outflow</th>
                <th className="py-3 px-4 text-right">Status / Dues</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DEC8]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">
                    No operating expenses or supplier purchases recorded matching your search.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      {item.source === 'PURCHASE_BILL' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-[#8C6D15] border border-amber-200">
                          <Truck className="w-2.5 h-2.5" /> Purchase
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
                          Operating
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-bold text-stone-900">
                      <div>{item.title}</div>
                      {item.notes && <div className="text-[10px] text-stone-400 font-mono font-normal mt-0.5">{item.notes}</div>}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#FAF8F5] text-stone-700 border border-[#E8DEC8] font-semibold">
                        {item.category}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-stone-600 font-mono text-[11px] whitespace-nowrap">
                      {item.date}
                    </td>

                    <td className="py-3 px-4 text-stone-700 font-medium whitespace-nowrap">
                      {item.paidTo || 'Direct Store Outflow'}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FAF8F5] text-stone-700 border border-[#E8DEC8]">
                        {item.paymentMode}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 text-sm whitespace-nowrap">
                      ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {item.source === 'PURCHASE_BILL' ? (
                        item.dueAmount && item.dueAmount > 0 ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-amber-700">
                            <Clock className="w-3 h-3" /> Due: ₹{item.dueAmount.toFixed(2)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" /> Settled
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] text-stone-400 font-medium">Cleared</span>
                      )}
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
          <div className="relative w-full max-w-md rounded-2xl bg-white border border-[#E8DEC8] shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] overflow-y-auto">
            
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
                  placeholder="e.g. Packaging Box Batch, Commercial Electricity Bill"
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
                    <option value="Cash">Cash Drawer</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    <option value="Card">Debit / Credit Card</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-stone-700 font-bold block mb-1">
                    Paid To / Payee
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Electric Company, Landlord"
                    value={paidTo}
                    onChange={(e) => setPaidTo(e.target.value)}
                    className="w-full text-xs py-2 px-3 bg-white border border-[#E8DEC8] rounded-xl text-stone-900 focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-stone-700 font-bold block mb-1">
                  Notes / Bill Reference No.
                </label>
                <input
                  type="text"
                  placeholder="Optional reference, invoice or transaction ID"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs py-2 px-3 bg-white border border-[#E8DEC8] rounded-xl text-stone-900 focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E8DEC8]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gold text-xs py-2 px-5 font-bold shadow-md"
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
