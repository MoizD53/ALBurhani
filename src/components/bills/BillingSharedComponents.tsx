import React from 'react';
import { 
  LucideIcon, 
  Search, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

/* ─── 1. Page Header ─── */
interface BillingPageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  badge?: {
    text: string;
    variant?: 'gold' | 'zinc' | 'emerald';
  };
  actions?: React.ReactNode;
}

export const BillingPageHeader: React.FC<BillingPageHeaderProps> = ({
  icon: Icon,
  title,
  subtitle,
  badge,
  actions,
}) => {
  const badgeClasses = {
    gold: 'bg-amber-500/15 text-amber-800 border-amber-500/30 font-bold',
    zinc: 'bg-stone-100 text-stone-700 border-stone-200 font-bold',
    emerald: 'bg-emerald-500/15 text-emerald-800 border-emerald-500/30 font-bold',
  }[badge?.variant || 'gold'];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-2xl bg-[#FAF8F5] border border-[#C99A18]/30 text-[#C99A18] flex items-center justify-center shrink-0 shadow-sm mt-0.5 sm:mt-0">
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h2 className="text-lg sm:text-xl font-bold text-[#1C1917] font-serif tracking-tight leading-snug">
              {title}
            </h2>
            {badge && (
              <span className={`inline-flex items-center text-[10px] font-mono px-2.5 py-0.5 rounded-full border uppercase font-bold tracking-wider whitespace-nowrap shrink-0 shadow-xs ${badgeClasses}`}>
                {badge.text}
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500 mt-1 font-medium leading-normal">
            {subtitle}
          </p>
        </div>
      </div>
      {actions && (
        <div className="shrink-0 flex items-center gap-2 self-stretch sm:self-auto justify-end">
          {actions}
        </div>
      )}
    </div>
  );
};

/* ─── 2. Metric / Summary Card ─── */
interface BillingSummaryCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  accent?: 'gold' | 'emerald' | 'purple' | 'blue' | 'zinc';
  icon?: LucideIcon;
}

export const BillingSummaryCard: React.FC<BillingSummaryCardProps> = ({
  label,
  value,
  subtext,
  accent = 'gold',
  icon: Icon,
}) => {
  const accentClasses = {
    gold: 'text-[#B8860B]',
    emerald: 'text-emerald-700',
    purple: 'text-purple-700',
    blue: 'text-blue-700',
    zinc: 'text-[#1C1917]',
  }[accent];

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-[#E8DEC8] shadow-sm flex flex-col justify-between transition-all hover:border-[#D4AF37]/50">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] sm:text-[11px] uppercase font-bold tracking-wider text-stone-500 truncate">
          {label}
        </span>
        {Icon && <Icon className="w-3.5 h-3.5 text-stone-400 shrink-0" />}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap">
        <span className={`text-base sm:text-lg lg:text-xl font-bold font-mono ${accentClasses}`}>
          {value}
        </span>
        {subtext && (
          <span className="text-[10px] text-stone-500 font-mono">
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
};

/* ─── 3. Search & Payment Filter Toolbar ─── */
interface BillingFilterToolbarProps {
  search: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder: string;
  paymentFilter: string;
  onPaymentFilterChange: (mode: string) => void;
  supportedModes?: string[];
  children?: React.ReactNode;
}

export const BillingFilterToolbar: React.FC<BillingFilterToolbarProps> = ({
  search,
  onSearchChange,
  searchPlaceholder,
  paymentFilter,
  onPaymentFilterChange,
  supportedModes = ['ALL', 'CASH', 'UPI', 'CARD', 'CREDIT'],
  children,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      {/* Search Input */}
      <div className="relative w-full sm:w-80 shrink-0">
        <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          style={{ paddingLeft: '40px', paddingRight: search ? '36px' : '14px' }}
          className="w-full py-2 text-xs bg-white border border-[#E8DEC8] rounded-xl text-[#1C1917] placeholder:text-stone-400 focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18]/25 focus:outline-none transition-all shadow-sm"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-1 rounded transition-colors"
            title="Clear search"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Right Controls: Filters & Additional Actions */}
      <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
        {/* Payment Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white border border-[#E8DEC8] overflow-x-auto no-scrollbar shadow-sm">
          {supportedModes.map((mode) => {
            const isSelected = paymentFilter === mode;
            const label = mode === 'ALL' ? 'All Modes' : mode === 'CREDIT' ? 'Udhar / Due' : mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onPaymentFilterChange(mode)}
                className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-sm'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {children}
      </div>
    </div>
  );
};

/* ─── 4. Table Wrapper Container ─── */
interface BillingTableContainerProps {
  children: React.ReactNode;
}

export const BillingTableContainer: React.FC<BillingTableContainerProps> = ({ children }) => {
  return (
    <div className="rounded-2xl bg-white border border-[#E8DEC8] overflow-hidden shadow-sm">
      <div className="overflow-x-auto custom-scrollbar">
        {children}
      </div>
    </div>
  );
};

/* ─── 5. Unified Empty State ─── */
interface BillingEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
}

export const BillingEmptyState: React.FC<BillingEmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  onClearFilters,
  hasActiveFilters = false,
}) => {
  return (
    <div className="py-14 px-4 text-center space-y-3">
      <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] border border-[#E8DEC8] flex items-center justify-center text-[#C99A18] mx-auto shadow-sm">
        <Icon className="w-6 h-6 stroke-1" />
      </div>
      <div className="max-w-md mx-auto space-y-1">
        <h3 className="text-sm font-bold text-[#1C1917]">
          {title}
        </h3>
        <p className="text-xs text-stone-500 leading-relaxed">
          {description}
        </p>
      </div>
      {hasActiveFilters && onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-2 px-3 py-1.5 rounded-xl bg-white hover:bg-[#FAF8F5] text-xs font-bold text-[#C99A18] border border-[#C99A18]/40 transition-all cursor-pointer shadow-sm"
        >
          Reset Search & Filters
        </button>
      )}
    </div>
  );
};

/* ─── 6. Unified Delete Confirmation Modal ─── */
interface DeleteInvoiceModalProps {
  isOpen: boolean;
  invoiceNumber: string;
  amount: number;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  isNoBill?: boolean;
}

export const DeleteInvoiceModal: React.FC<DeleteInvoiceModalProps> = ({
  isOpen,
  invoiceNumber,
  amount,
  isDeleting,
  onConfirm,
  onCancel,
  title = 'Delete Invoice Entry',
  isNoBill = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-[#E8DEC8] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-600 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1C1917]">
                {title}
              </h3>
              <p className="text-xs text-stone-500">
                Action requires confirmation
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] text-xs text-stone-700 space-y-2">
          <p>
            Are you sure you want to permanently delete {isNoBill ? 'sales entry' : 'invoice'}{' '}
            <strong className="text-[#1C1917] font-mono">{invoiceNumber}</strong> for{' '}
            <strong className="text-[#B8860B] font-mono">Rs. {amount.toFixed(2)}</strong>?
          </p>
          <p className="text-[11px] text-stone-500">
            {isNoBill
              ? 'This removes the recorded entry from sales audit history.'
              : 'This removes the tax invoice from records. Customer directory and catalog are preserved.'}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Confirm & Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── 7. Unified Action Feedback Toast ─── */
interface BillingFeedbackToastProps {
  feedback: { type: 'success' | 'error'; message: string } | null;
  onDismiss: () => void;
}

export const BillingFeedbackToast: React.FC<BillingFeedbackToastProps> = ({
  feedback,
  onDismiss,
}) => {
  if (!feedback) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all animate-fade-in ${
        feedback.type === 'success'
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800'
          : 'bg-rose-500/10 border-rose-500/30 text-rose-800'
      }`}
    >
      <div className="flex items-center gap-2">
        {feedback.type === 'success' ? (
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
        ) : (
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
        )}
        <span className="font-semibold">{feedback.message}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 hover:bg-black/5 rounded transition-colors text-stone-500 hover:text-stone-800"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
