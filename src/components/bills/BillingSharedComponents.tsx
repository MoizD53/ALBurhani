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
}

export const BillingPageHeader: React.FC<BillingPageHeaderProps> = ({
  icon: Icon,
  title,
  subtitle,
  badge,
}) => {
  const badgeClasses = {
    gold: 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30',
    zinc: 'bg-white/[0.05] text-zinc-300 border-white/[0.1]',
    emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  }[badge?.variant || 'gold'];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[#D4AF37] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(212,175,55,0.15)]">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg sm:text-xl font-bold text-white font-serif tracking-wide">
              {title}
            </h2>
            {badge && (
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase font-bold tracking-wider ${badgeClasses}`}>
                {badge.text}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            {subtitle}
          </p>
        </div>
      </div>
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
    gold: 'text-[#E5C158]',
    emerald: 'text-emerald-400',
    purple: 'text-purple-400',
    blue: 'text-blue-400',
    zinc: 'text-white',
  }[accent];

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-[#121214] border border-white/[0.08] shadow-sm flex flex-col justify-between transition-all hover:border-white/[0.14]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] sm:text-[11px] uppercase font-bold tracking-wider text-zinc-400 truncate">
          {label}
        </span>
        {Icon && <Icon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap">
        <span className={`text-base sm:text-lg lg:text-xl font-bold font-mono ${accentClasses}`}>
          {value}
        </span>
        {subtext && (
          <span className="text-[10px] text-zinc-500 font-mono">
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
  supportedModes = ['ALL', 'CASH', 'UPI', 'CARD'],
  children,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      {/* Search Input */}
      <div className="relative w-full sm:w-80 shrink-0">
        <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          style={{ paddingLeft: '40px', paddingRight: search ? '36px' : '14px' }}
          className="w-full py-2 text-xs bg-black/40 border border-white/[0.08] rounded-xl text-white placeholder:text-zinc-500 focus:border-[#D4AF37]/60 focus:ring-1 focus:ring-[#D4AF37]/25 focus:outline-none transition-all shadow-inner"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-1 rounded transition-colors"
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
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/[0.06] overflow-x-auto no-scrollbar">
          {supportedModes.map((mode) => {
            const isSelected = paymentFilter === mode;
            const label = mode === 'ALL' ? 'All Modes' : mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onPaymentFilterChange(mode)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#D4AF37] text-black font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
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
    <div className="rounded-2xl bg-[#121214] border border-white/[0.08] overflow-hidden shadow-xl">
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
      <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-zinc-500 mx-auto shadow-inner">
        <Icon className="w-6 h-6 stroke-1 text-zinc-400" />
      </div>
      <div className="max-w-md mx-auto space-y-1">
        <h3 className="text-sm font-bold text-white">
          {title}
        </h3>
        <p className="text-xs text-zinc-400 leading-relaxed">
          {description}
        </p>
      </div>
      {hasActiveFilters && onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-2 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-[#D4AF37] border border-[#D4AF37]/30 transition-all cursor-pointer"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#121214] border border-white/[0.12] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {title}
              </h3>
              <p className="text-xs text-zinc-400">
                Action requires confirmation
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="p-1 rounded-lg text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-black/50 border border-white/[0.06] text-xs text-zinc-300 space-y-2">
          <p>
            Are you sure you want to permanently delete {isNoBill ? 'sales entry' : 'invoice'}{' '}
            <strong className="text-white font-mono">{invoiceNumber}</strong> for{' '}
            <strong className="text-[#E5C158] font-mono">₹{amount.toFixed(2)}</strong>?
          </p>
          <p className="text-[11px] text-zinc-400">
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
            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-white/[0.04] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
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
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
      }`}
    >
      <div className="flex items-center gap-2">
        {feedback.type === 'success' ? (
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
        ) : (
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
        )}
        <span className="font-medium">{feedback.message}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 hover:bg-white/10 rounded transition-colors text-zinc-400 hover:text-white"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
