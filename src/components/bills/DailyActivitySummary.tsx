import React from 'react';
import { 
  Receipt, 
  Users, 
  IndianRupee, 
  Banknote, 
  QrCode, 
  CreditCard, 
  Clock, 
  Package, 
  XCircle,
  Calendar,
  X
} from 'lucide-react';

export interface DailyActivityMetrics {
  totalBills: number;
  totalCustomers: number;
  totalSales: number;
  cashCollection: number;
  upiCollection: number;
  cardCollection: number;
  dueAmount: number;
  itemsSold: number;
  voidedCount: number;
}

interface DailyActivitySummaryProps {
  selectedDate: string; // YYYY-MM-DD
  formattedDate: string;
  metrics: DailyActivityMetrics;
  onClearDate: () => void;
  accentTitle?: string;
}

export const DailyActivitySummary: React.FC<DailyActivitySummaryProps> = ({
  selectedDate,
  formattedDate,
  metrics,
  onClearDate,
  accentTitle = 'Bills'
}) => {
  return (
    <div className="p-3.5 bg-white border border-[#E8DEC8] rounded-2xl shadow-sm space-y-3 animate-in fade-in duration-200">
      
      {/* Date Header Banner */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-[#F0EBE0]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#FAF8F5] border border-[#E8DEC8] text-[#B8860B]">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900 font-serif flex items-center gap-2">
              <span>{accentTitle} for {formattedDate}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#FAF8F5] text-[#8C6D15] border border-[#E8DEC8]">
                {metrics.totalBills} {metrics.totalBills === 1 ? 'Bill' : 'Bills'}
              </span>
            </h3>
            <span className="text-[10px] text-stone-500 font-mono">Business date in IST (Asia/Kolkata)</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClearDate}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5] border border-[#E8DEC8] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          <span>Show All Dates</span>
        </button>
      </div>

      {/* 8 Compact Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        
        {/* 1. Total Bills */}
        <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8]">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Bills</span>
            <Receipt className="w-3.5 h-3.5 text-stone-600" />
          </div>
          <div className="text-sm font-black font-mono text-stone-900">{metrics.totalBills}</div>
          <span className="text-[9px] text-stone-400">recorded</span>
        </div>

        {/* 2. Total Customers */}
        <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8]">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Customers</span>
            <Users className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-sm font-black font-mono text-stone-900">{metrics.totalCustomers}</div>
          <span className="text-[9px] text-stone-400">unique buyers</span>
        </div>

        {/* 3. Total Sales */}
        <div className="p-2.5 rounded-xl bg-[#FBF7EE] border border-[#C99A18]/40">
          <div className="flex items-center justify-between text-[#8C6D15] mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Sales</span>
            <IndianRupee className="w-3.5 h-3.5 text-[#B8860B]" />
          </div>
          <div className="text-sm font-black font-mono text-[#8C6D15]">
            Rs. {metrics.totalSales.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <span className="text-[9px] text-stone-500">gross volume</span>
        </div>

        {/* 4. Cash Collection */}
        <div className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200">
          <div className="flex items-center justify-between text-emerald-800 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Cash</span>
            <Banknote className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-sm font-black font-mono text-emerald-900">
            Rs. {metrics.cashCollection.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <span className="text-[9px] text-emerald-600 font-medium">in drawer</span>
        </div>

        {/* 5. UPI Collection */}
        <div className="p-2.5 rounded-xl bg-purple-50/50 border border-purple-200">
          <div className="flex items-center justify-between text-purple-800 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">UPI QR</span>
            <QrCode className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div className="text-sm font-black font-mono text-purple-900">
            Rs. {metrics.upiCollection.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <span className="text-[9px] text-purple-600 font-medium">digital</span>
        </div>

        {/* 6. Udhar / Balance Due */}
        <div className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-200">
          <div className="flex items-center justify-between text-amber-800 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Udhar Due</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-sm font-black font-mono text-amber-900">
            Rs. {metrics.dueAmount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <span className="text-[9px] text-amber-600 font-medium">{metrics.dueAmount > 0 ? 'outstanding' : 'settled'}</span>
        </div>

        {/* 7. Items Sold */}
        <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8]">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Items Sold</span>
            <Package className="w-3.5 h-3.5 text-stone-600" />
          </div>
          <div className="text-sm font-black font-mono text-stone-900">{metrics.itemsSold}</div>
          <span className="text-[9px] text-stone-400">deducted</span>
        </div>

        {/* 8. Voided / Deleted */}
        <div className="p-2.5 rounded-xl bg-rose-50/50 border border-rose-200">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Voided</span>
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-sm font-black font-mono text-rose-900">{metrics.voidedCount}</div>
          <span className="text-[9px] text-rose-500 font-medium">audit</span>
        </div>

      </div>

    </div>
  );
};
