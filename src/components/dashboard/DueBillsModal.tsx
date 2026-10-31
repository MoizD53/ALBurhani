import React, { useState, useMemo } from 'react';
import { OrderBill } from '../../types';
import { 
  X, 
  Search, 
  Clock, 
  CheckCircle, 
  Printer, 
  MessageCircle, 
  Phone, 
  IndianRupee, 
  Check, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { getOrderDue } from '../../lib/utils';
import { normalizeWhatsAppPhoneNumber } from '../../lib/phoneUtils';

interface DueBillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: OrderBill[];
  onViewReceipt: (order: OrderBill) => void;
  onSettleOrder?: (order: OrderBill) => Promise<void> | void;
}

export const DueBillsModal: React.FC<DueBillsModalProps> = ({
  isOpen,
  onClose,
  orders,
  onViewReceipt,
  onSettleOrder,
}) => {
  const [search, setSearch] = useState('');
  const [settlingOrderId, setSettlingOrderId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [locallySettledIds, setLocallySettledIds] = useState<Set<string>>(new Set());

  // Filter all orders with outstanding due
  const dueOrders = useMemo(() => {
    return orders
      .filter((o) => !locallySettledIds.has(o.id) && !(o.billNumber && locallySettledIds.has(o.billNumber)) && getOrderDue(o) > 0)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [orders, locallySettledIds]);

  // Search filter
  const filteredDueOrders = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return dueOrders;
    return dueOrders.filter((o) => {
      const matchName = o.customerName && o.customerName.toLowerCase().includes(q);
      const matchPhone = o.customerPhone && o.customerPhone.includes(q);
      const matchBill = o.billNumber.toLowerCase().includes(q);
      return matchName || matchPhone || matchBill;
    });
  }, [dueOrders, search]);

  const totalDueAmount = useMemo(() => {
    return dueOrders.reduce((sum, o) => sum + getOrderDue(o), 0);
  }, [dueOrders]);

  const uniqueCustomersCount = useMemo(() => {
    const set = new Set(dueOrders.map((o) => o.customerPhone || o.customerName || o.id));
    return set.size;
  }, [dueOrders]);

  if (!isOpen) return null;

  const handleSettle = async (order: OrderBill) => {
    if (!onSettleOrder) return;
    const due = getOrderDue(order);
    const displayBill = order.billNumber.startsWith('Bill #') ? order.billNumber : `Bill #${order.dailyBillNumber || order.billNumber}`;
    if (!window.confirm(`Mark ${displayBill} as fully paid?\nDue Amount: Rs. ${due.toFixed(2)}`)) {
      return;
    }

    try {
      setSettlingOrderId(order.id);
      setLocallySettledIds((prev) => {
        const next = new Set(prev);
        next.add(order.id);
        if (order.billNumber) next.add(order.billNumber);
        return next;
      });
      await onSettleOrder(order);
      setFeedback(`${displayBill} (Rs. ${due.toFixed(2)}) marked as fully settled.`);
      setTimeout(() => setFeedback(null), 3500);
    } catch {
      setLocallySettledIds((prev) => {
        const next = new Set(prev);
        next.delete(order.id);
        if (order.billNumber) next.delete(order.billNumber);
        return next;
      });
      setFeedback(`Could not settle ${displayBill}. Please try again.`);
      setTimeout(() => setFeedback(null), 3500);
    } finally {
      setSettlingOrderId(null);
    }
  };

  const handleSendWhatsAppReminder = (order: OrderBill) => {
    if (!order.customerPhone) return;
    const normalized = normalizeWhatsAppPhoneNumber(order.customerPhone);
    if (!normalized) {
      alert('Invalid customer phone number.');
      return;
    }

    const due = getOrderDue(order);
    const customerName = order.customerName ? `Dear ${order.customerName}` : 'Dear Customer';
    const message = encodeURIComponent(
      `${customerName},\n\nNamaste from *AL-BURHANI Sweets & Dry Items*.\n\nThis is a gentle reminder regarding pending balance for:\n• *Invoice:* ${order.billNumber}\n• *Bill Date:* ${order.createdAt}\n• *Total Bill:* Rs. ${order.grandTotal.toFixed(2)}\n• *Paid so far:* Rs. ${order.amountReceived.toFixed(2)}\n• *Pending Due (Udhar):* Rs. ${due.toFixed(2)}\n\nPlease settle the balance at your earliest convenience.\n\nThank you!\n*AL-BURHANI*'s Team`
    );

    window.open(`https://wa.me/${normalized}?text=${message}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-[#E8DEC8] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* 1. Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#E8DEC8] bg-[#FAF8F5] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-700 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-stone-900 font-serif">
                  Outstanding Due & Customer Udhar
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-800 border border-amber-500/30">
                  {dueOrders.length} Pending
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                All unsettled customer bills, credits, and pending balances
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Top Metric Bar */}
        <div className="p-4 bg-white border-b border-[#E8DEC8] grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Total Due Balance</span>
              <span className="text-xl font-bold font-mono text-amber-800">Rs. {totalDueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <IndianRupee className="w-5 h-5 text-amber-700 opacity-60" />
          </div>

          <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Unsettled Bills</span>
              <span className="text-xl font-bold font-mono text-stone-900">{dueOrders.length}</span>
            </div>
            <Clock className="w-5 h-5 text-stone-500 opacity-60" />
          </div>

          <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Unique Customers</span>
              <span className="text-xl font-bold font-mono text-stone-900">{uniqueCustomersCount}</span>
            </div>
            <CheckCircle className="w-5 h-5 text-stone-500 opacity-60" />
          </div>
        </div>

        {/* 3. Search & Filter Bar */}
        <div className="p-3 sm:px-4 bg-[#FAF8F5] border-b border-[#E8DEC8] flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer name, phone number, or invoice #..."
              style={{ paddingLeft: '34px', color: '#1C1917', backgroundColor: '#FFFFFF' }}
              className="w-full pr-8 py-2 text-xs bg-white border border-[#E8DEC8] rounded-xl text-stone-900 placeholder:text-stone-400 focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18]/25 focus:outline-none shadow-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className="text-xs text-stone-500 font-medium whitespace-nowrap hidden sm:inline">
            Showing {filteredDueOrders.length} of {dueOrders.length}
          </span>
        </div>

        {/* Feedback message banner */}
        {feedback && (
          <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* 4. Due Orders List / Table */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 custom-scrollbar bg-white">
          {filteredDueOrders.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-3">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-stone-900 text-base">
                {dueOrders.length === 0 ? 'All Bills Fully Settled!' : 'No Matching Due Bills Found'}
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mt-1">
                {dueOrders.length === 0 
                  ? 'There are currently no outstanding customer credit balances or unpaid bills.' 
                  : `No due orders match your search term "${search}".`}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredDueOrders.map((order) => {
                const due = getOrderDue(order);
                const isSettling = settlingOrderId === order.id;

                return (
                  <div 
                    key={order.id} 
                    className="p-3 sm:p-4 rounded-xl border border-[#E8DEC8] hover:border-[#D4AF37]/60 bg-white transition-all shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 group"
                  >
                    {/* Left: Customer Info & Invoice # */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-stone-900 text-sm">
                          {order.customerName || 'Walk-in Customer'}
                        </span>
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#E8DEC8] text-stone-600">
                          Bill #{order.dailyBillNumber || order.billNumber.replace(/^[A-Z-]+/, '')}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-800 border border-amber-300">
                          {order.paymentMethod === 'CREDIT' ? 'Udhar Sale' : `Partial (${order.paymentMethod})`}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-1.5 text-xs text-stone-500 flex-wrap">
                        {order.customerPhone && (
                          <a 
                            href={`tel:${order.customerPhone}`}
                            className="inline-flex items-center gap-1 font-mono text-stone-700 hover:text-[#C99A18] font-medium"
                          >
                            <Phone className="w-3 h-3 text-stone-400" />
                            <span>{order.customerPhone}</span>
                          </a>
                        )}
                        <span>•</span>
                        <span>{order.createdAt}</span>
                        <span>•</span>
                        <span>{order.items.length} items</span>
                      </div>
                    </div>

                    {/* Middle: Financials breakdown */}
                    <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-[#F0EBE0] pt-2 sm:pt-0 sm:pl-4">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-stone-400 block">Total Bill</span>
                        <span className="font-mono font-semibold text-stone-700 text-xs">Rs. {order.grandTotal.toFixed(2)}</span>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-stone-400 block">Paid</span>
                        <span className="font-mono font-semibold text-emerald-700 text-xs">Rs. {order.amountReceived.toFixed(2)}</span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-amber-700 block">Balance Due</span>
                        <span className="font-mono font-black text-amber-800 text-base">Rs. {due.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 border-t sm:border-t-0 pt-2 sm:pt-0 shrink-0">
                      {order.customerPhone && (
                        <button
                          type="button"
                          onClick={() => handleSendWhatsAppReminder(order)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Send courteous payment reminder on WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="hidden sm:inline">WhatsApp</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onViewReceipt(order)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#FAF8F5] hover:bg-[#F5F2EB] text-stone-700 border border-[#E8DEC8] text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="View & Print Bill Receipt"
                      >
                        <Printer className="w-3.5 h-3.5 text-[#B8860B]" />
                        <span className="hidden sm:inline">Receipt</span>
                      </button>

                      {onSettleOrder && (
                        <button
                          type="button"
                          disabled={isSettling}
                          onClick={() => handleSettle(order)}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:opacity-95 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-opacity disabled:opacity-50"
                          title="Mark this bill as fully settled / paid"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isSettling ? 'Settling...' : 'Settle Due'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. Footer */}
        <div className="p-3 bg-[#FAF8F5] border-t border-[#E8DEC8] flex items-center justify-between text-xs text-stone-500 shrink-0">
          <span className="font-mono">
            {dueOrders.length} pending bill{dueOrders.length !== 1 ? 's' : ''} · Total Rs. {totalDueAmount.toFixed(2)}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white border border-[#E8DEC8] text-stone-700 hover:text-stone-900 font-semibold text-xs transition-colors shadow-sm"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
