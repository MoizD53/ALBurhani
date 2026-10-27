import React, { useState, useEffect } from 'react';
import { 
  LucideIcon, 
  Search, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle,
  Trash2
} from 'lucide-react';
import { cleanBillNumber } from '../../lib/utils';

/* ─── 1. Page Header ─── */
interface BillingPageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
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
          {subtitle && (
            <p className="text-xs text-stone-500 mt-1 font-medium leading-normal">
              {subtitle}
            </p>
          )}
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

/* ─── 6. Unified Delete Confirmation Popover (Anchored Next to Bill) ─── */
export interface PopoverAnchorRect {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
}

export interface DeleteBillPopoverProps {
  isOpen: boolean;
  invoiceNumber: string;
  amount: number;
  isDeleting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  isNoBill?: boolean;
  extraWarning?: string;
  anchorRect?: PopoverAnchorRect | null;
}

export const DeleteBillPopover: React.FC<DeleteBillPopoverProps> = ({
  isOpen,
  invoiceNumber,
  amount,
  isDeleting = false,
  onConfirm,
  onCancel,
  title = 'Delete Bill',
  isNoBill = false,
  extraWarning,
  anchorRect,
}) => {
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    placement: 'left' | 'right' | 'top' | 'bottom' | 'center';
  }>({
    top: 0,
    left: 0,
    placement: 'center',
  });

  useEffect(() => {
    if (!anchorRect) {
      setCoords({ top: 0, left: 0, placement: 'center' });
      return;
    }

    const popoverWidth = Math.min(320, window.innerWidth - 24);
    const estimatedHeight = 180;
    const isMobile = window.innerWidth < 640;

    if (isMobile) {
      // Place above or below anchor button on mobile screens
      const showAbove = anchorRect.top > 230;
      const top = showAbove
        ? Math.max(12, anchorRect.top - estimatedHeight - 8)
        : Math.min(window.innerHeight - estimatedHeight - 12, anchorRect.bottom + 8);
      const left = Math.max(12, Math.min(window.innerWidth - popoverWidth - 12, anchorRect.right - popoverWidth));
      setCoords({
        top,
        left,
        placement: showAbove ? 'top' : 'bottom',
      });
    } else {
      // Desktop: place directly to the left of the delete button (or to the right if near left edge)
      const spaceOnLeft = anchorRect.left;
      const showOnLeft = spaceOnLeft > popoverWidth + 16;
      const left = showOnLeft
        ? Math.max(12, anchorRect.left - popoverWidth - 10)
        : Math.min(window.innerWidth - popoverWidth - 12, anchorRect.right + 10);

      const centerY = anchorRect.top + anchorRect.height / 2;
      const top = Math.max(12, Math.min(window.innerHeight - estimatedHeight - 12, centerY - (estimatedHeight / 2)));
      setCoords({
        top,
        left,
        placement: showOnLeft ? 'left' : 'right',
      });
    }
  }, [anchorRect]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isDeleting, onCancel]);

  if (!isOpen) return null;
  const cleanDisplay = cleanBillNumber(invoiceNumber);

  const style: React.CSSProperties = coords.placement === 'center'
    ? {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(340px, calc(100vw - 32px))',
        zIndex: 60,
      }
    : {
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: `${Math.min(320, window.innerWidth - 24)}px`,
        zIndex: 60,
      };

  return (
    <>
      {/* Transparent Click-Outside Backdrop: zero dimming, zero blur */}
      <div
        className="fixed inset-0 z-50 bg-transparent select-none"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Popover Card Anchored Next to Bill */}
      <div
        style={style}
        className="bg-white border border-[#E8DEC8] rounded-2xl p-4 shadow-2xl space-y-3 animate-fade-in text-stone-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-popover-title"
      >
        {/* Desktop Arrow Pointer */}
        {anchorRect && coords.placement === 'left' && (
          <div
            className="hidden sm:block absolute -right-1.5 w-3 h-3 bg-white border-t border-r border-[#E8DEC8] rotate-45 pointer-events-none"
            style={{
              top: `${Math.max(16, Math.min(145, anchorRect.top + (anchorRect.height / 2) - coords.top - 6))}px`,
            }}
          />
        )}
        {anchorRect && coords.placement === 'right' && (
          <div
            className="hidden sm:block absolute -left-1.5 w-3 h-3 bg-white border-b border-l border-[#E8DEC8] rotate-45 pointer-events-none"
            style={{
              top: `${Math.max(16, Math.min(145, anchorRect.top + (anchorRect.height / 2) - coords.top - 6))}px`,
            }}
          />
        )}

        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 id="delete-popover-title" className="text-xs font-bold text-stone-900 font-serif uppercase tracking-wider">
                {title}
              </h3>
              <p className="text-[10px] text-stone-500">
                Action requires confirmation
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] text-xs space-y-1.5">
          <div className="text-stone-700">
            Permanently delete <strong className="text-stone-900 font-mono font-bold">{cleanDisplay}</strong>?
          </div>
          <div className="flex items-center justify-between text-[11px] text-stone-600">
            <span>Total Amount:</span>
            <strong className="text-[#B8860B] font-mono font-bold">Rs. {amount.toFixed(2)}</strong>
          </div>
          {extraWarning ? (
            <p className="text-[10px] text-rose-600 font-medium pt-0.5">
              {extraWarning}
            </p>
          ) : (
            <p className="text-[10px] text-stone-500 pt-0.5">
              {isNoBill
                ? 'Removes entry from sales audit history.'
                : 'Removes invoice from records. Catalog & customer directory are preserved.'}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-0.5">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (
              <span>Deleting...</span>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm & Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export const DeleteInvoiceModal = DeleteBillPopover;

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
