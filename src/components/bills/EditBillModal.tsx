import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  IndianRupee, 
  Receipt, 
  CreditCard, 
  User, 
  Phone,
  Store,
  Tag,
  ArrowRight,
  Save,
  RotateCcw
} from 'lucide-react';
import { OrderBill, CartItem, Product, PaymentMethod } from '../../types';
import { 
  buildCartItem, 
  calculateOrderTotals, 
  isWeightBasedProduct, 
  deductStock, 
  restoreStock 
} from '../../lib/pricing';
import { cleanBillNumber } from '../../lib/utils';

export interface EditBillModalProps {
  isOpen: boolean;
  order: OrderBill | null;
  products: Product[];
  onClose: () => void;
  onSave: (
    updatedOrder: OrderBill, 
    originalOrder: OrderBill
  ) => Promise<{ success: boolean; error?: string } | void> | { success: boolean; error?: string } | void;
}

export const EditBillModal: React.FC<EditBillModalProps> = ({
  isOpen,
  order,
  products,
  onClose,
  onSave,
}) => {
  if (!isOpen || !order) return null;

  // Local state initialized from order
  const [items, setItems] = useState<CartItem[]>(() => [...(order.items || [])]);
  const [discountPercent, setDiscountPercent] = useState<number>(() => {
    if (order.subtotal > 0 && order.discountAmount > 0) {
      return Math.round((order.discountAmount / order.subtotal) * 100);
    }
    return 0;
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(order.paymentMethod || 'CASH');
  const [amountReceived, setAmountReceived] = useState<string>(
    order.amountReceived !== undefined ? String(order.amountReceived) : String(order.grandTotal)
  );
  const [customerName, setCustomerName] = useState<string>(order.customerName || '');
  const [customerPhone, setCustomerPhone] = useState<string>(order.customerPhone || '');
  
  // Product Search state for adding items
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronize state when order changes
  useEffect(() => {
    if (order) {
      setItems([...(order.items || [])]);
      setDiscountPercent(
        order.subtotal > 0 && order.discountAmount > 0
          ? Math.round((order.discountAmount / order.subtotal) * 100)
          : 0
      );
      setPaymentMethod(order.paymentMethod || 'CASH');
      setAmountReceived(
        order.amountReceived !== undefined ? String(order.amountReceived) : String(order.grandTotal)
      );
      setCustomerName(order.customerName || '');
      setCustomerPhone(order.customerPhone || '');
      setSearchQuery('');
      setErrorMessage(null);
    }
  }, [order]);

  // Recalculate totals whenever items or discount changes
  const totals = useMemo(() => {
    return calculateOrderTotals(items, discountPercent, order.transactionType);
  }, [items, discountPercent, order.transactionType]);

  // Auto-sync amountReceived if paying full in cash/card/upi unless custom value
  const numReceived = parseFloat(amountReceived) || 0;
  const changeGiven = paymentMethod === 'CASH' && numReceived > totals.grandTotal 
    ? Math.round((numReceived - totals.grandTotal) * 100) / 100 
    : 0;
  const pendingDue = (paymentMethod === 'CASH' || paymentMethod === 'CREDIT') && numReceived < totals.grandTotal
    ? Math.round((totals.grandTotal - numReceived) * 100) / 100
    : 0;

  // Search filtered products (catalog search)
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    return products
      .filter((p) => {
        return (
          p.name.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          p.category.toLowerCase().includes(q)
        );
      })
      .slice(0, 8); // Top 8 matches
  }, [products, searchQuery]);

  // Handle adding product to items
  const handleAddProduct = (prod: Product) => {
    const isWeight = isWeightBasedProduct(prod);
    const existingIndex = items.findIndex((it) => 
      (it.product.id && it.product.id === prod.id) || 
      (it.product.barcode && it.product.barcode === prod.barcode)
    );

    if (existingIndex >= 0) {
      // Increment existing item
      const updated = [...items];
      const current = updated[existingIndex];
      const addQty = isWeight ? 0.25 : 1;
      const newQty = Math.round((current.quantity + addQty) * 1000) / 1000;
      updated[existingIndex] = buildCartItem(
        current.product, 
        newQty, 
        isWeight ? Math.round(newQty * 1000) : undefined, 
        current.discountPercent
      );
      setItems(updated);
    } else {
      // Add new item
      const initialQty = isWeight ? 0.25 : 1;
      const newItem = buildCartItem(
        prod, 
        initialQty, 
        isWeight ? Math.round(initialQty * 1000) : undefined
      );
      setItems([...items, newItem]);
    }

    setSearchQuery('');
    setIsSearchOpen(false);
  };

  // Handle quantity adjustment
  const handleUpdateQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    const updated = [...items];
    const item = updated[index];
    const isWeight = isWeightBasedProduct(item.product);
    const safeQty = isWeight ? Math.round(newQty * 1000) / 1000 : Math.round(newQty);
    updated[index] = buildCartItem(
      item.product,
      safeQty,
      isWeight ? Math.round(safeQty * 1000) : undefined,
      item.discountPercent
    );
    setItems(updated);
  };

  // Handle item removal
  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  // Reset back to original order state
  const handleReset = () => {
    setItems([...(order.items || [])]);
    setDiscountPercent(
      order.subtotal > 0 && order.discountAmount > 0
        ? Math.round((order.discountAmount / order.subtotal) * 100)
        : 0
    );
    setPaymentMethod(order.paymentMethod || 'CASH');
    setAmountReceived(
      order.amountReceived !== undefined ? String(order.amountReceived) : String(order.grandTotal)
    );
    setCustomerName(order.customerName || '');
    setCustomerPhone(order.customerPhone || '');
    setErrorMessage(null);
  };

  // Save changes
  const handleSave = async () => {
    if (items.length === 0) {
      setErrorMessage('Cannot save bill with 0 items. Please add at least one product or cancel.');
      return;
    }

    if (totals.grandTotal < 0) {
      setErrorMessage('Invalid bill total.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const originalGrandTotal = order.originalGrandTotal ?? order.grandTotal;
      const additionalPaid = Math.max(0, totals.grandTotal - originalGrandTotal);
      const finalAmountReceived = (paymentMethod === 'CASH' || paymentMethod === 'CREDIT')
        ? (parseFloat(amountReceived) || totals.grandTotal)
        : totals.grandTotal;
      const finalDue = (paymentMethod === 'CASH' || paymentMethod === 'CREDIT')
        ? Math.max(0, totals.grandTotal - finalAmountReceived)
        : 0;

      const revisedOrder: OrderBill = {
        ...order,
        items: [...items],
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        gstAmount: totals.gstAmount,
        grandTotal: totals.grandTotal,
        paymentMethod,
        amountReceived: finalAmountReceived,
        changeGiven: paymentMethod === 'CASH' && finalAmountReceived > totals.grandTotal ? finalAmountReceived - totals.grandTotal : 0,
        dueAmount: finalDue,
        isSettled: finalDue === 0,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        // Mark Revision metadata
        isRevised: true,
        originalGrandTotal,
        additionalAmountPaid: additionalPaid,
        originalPaymentMethod: order.originalPaymentMethod || order.paymentMethod,
        additionalPaymentMethod: additionalPaid > 0 ? paymentMethod : undefined,
        revisedAt: new Date().toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
        revisedTimestamp: Date.now(),
        revisionCount: (order.revisionCount || 0) + 1,
      };

      const result = await onSave(revisedOrder, order);
      if (result && result.success === false) {
        setErrorMessage(result.error || 'Failed to save updated bill.');
        setIsSubmitting(false);
        return;
      }

      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unexpected error occurred while updating bill.');
      setIsSubmitting(false);
    }
  };

  const displayBillNumber = order.dailyBillNumber ? `Bill #${order.dailyBillNumber}` : cleanBillNumber(order.billNumber);
  const grandTotalDiff = totals.grandTotal - order.grandTotal;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div 
        className="w-full max-w-4xl max-h-[92vh] rounded-3xl bg-[#FAF8F5] border border-[#E8DEC8] shadow-2xl flex flex-col overflow-hidden text-[#1C1917]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── 1. Header Bar ─── */}
        <div className="p-4 sm:p-5 border-b border-[#E8DEC8] bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-[#B8860B] flex items-center justify-center shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-serif text-[#1C1917]">
                  Edit {displayBillNumber}
                </h2>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                  order.transactionType === 'NO_BILL'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-blue-50 text-blue-800 border-blue-200'
                }`}>
                  {order.transactionType === 'NO_BILL' ? 'Retail No-Bill' : 'Tax Invoice'}
                </span>
                <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200 uppercase">
                  {order.branch === 'mg_road' ? 'MG Road' : 'Godi Road'}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Created: {order.createdAt} · Cashier: {order.cashierName || 'Owner'}
                {order.isRevised && (
                  <span className="ml-1.5 text-amber-700 font-semibold">(Previously revised {order.revisionCount || 1}x)</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="p-2 rounded-xl text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer"
              title="Reset all changes to original bill"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              title="Close editor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error message alert */}
        {errorMessage && (
          <div className="bg-rose-50 border-b border-rose-200 px-5 py-2.5 flex items-center gap-2 text-xs text-rose-800 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ─── 2. Scrollable Body: Items & Adjustments ─── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* Quick Product Search & Add */}
          <div className="relative">
            <div className="flex items-center gap-2 p-1.5 pl-3 rounded-2xl bg-white border border-[#E8DEC8] focus-within:border-[#C99A18] focus-within:ring-2 focus-within:ring-[#C99A18]/20 transition-all shadow-xs">
              <Search className="w-4 h-4 text-stone-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="Add item: type product name, barcode, or SKU..."
                className="w-full bg-transparent text-xs sm:text-sm text-[#1C1917] placeholder-stone-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Instant Search Dropdown Results */}
            {isSearchOpen && filteredProducts.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 rounded-2xl bg-white border border-[#E8DEC8] shadow-2xl z-40 max-h-60 overflow-y-auto divide-y divide-[#F0EBE0] animate-fade-in">
                {filteredProducts.map((p) => {
                  const isWeight = isWeightBasedProduct(p);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAddProduct(p)}
                      className="w-full px-4 py-2.5 text-left hover:bg-[#FAF8F5] flex items-center justify-between gap-3 transition-colors cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs sm:text-sm text-[#1C1917] group-hover:text-[#B8860B] transition-colors truncate">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-stone-500 flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-stone-400">{p.barcode}</span>
                          <span>•</span>
                          <span>{p.category}</span>
                          <span>•</span>
                          <span className="text-stone-600 font-medium">Stock: {p.stock ?? 0} {p.unit}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold font-mono text-xs sm:text-sm text-[#B8860B]">
                          ₹{p.sellingPrice.toFixed(2)}
                          <span className="text-[10px] text-stone-500 font-normal">/{p.unit}</span>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 mt-0.5">
                          <Plus className="w-3 h-3" /> Add
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Items Table Card */}
          <div className="rounded-2xl bg-white border border-[#E8DEC8] shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-[#FBF9F6] border-b border-[#E8DEC8] flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
                Bill Items ({items.length})
              </span>
              <span className="text-xs font-mono font-bold text-stone-600">
                Items Subtotal: ₹{totals.subtotal.toFixed(2)}
              </span>
            </div>

            {items.length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-xs">
                No items in this bill. Use the search bar above to add products.
              </div>
            ) : (
              <div className="divide-y divide-[#F0EBE0] max-h-72 overflow-y-auto">
                {items.map((it, idx) => {
                  const isWeight = isWeightBasedProduct(it.product);
                  const step = isWeight ? 0.25 : 1;
                  return (
                    <div key={`${it.product.id || it.product.barcode}-${idx}`} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF8F5]/60 transition-colors">
                      {/* Product Name & Rate */}
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs sm:text-sm text-[#1C1917] truncate">
                          {it.product.name}
                        </div>
                        <div className="text-[11px] text-stone-500 flex items-center gap-2 mt-0.5 font-mono">
                          <span>₹{it.unitPrice.toFixed(2)}/{it.unit}</span>
                          <span>•</span>
                          <span>{it.formattedQuantity}</span>
                        </div>
                      </div>

                      {/* Quantity Stepper & Line Total */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0">
                        {/* Stepper */}
                        <div className="flex items-center rounded-xl border border-[#E8DEC8] bg-[#FAF8F5] p-0.5 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(idx, it.quantity - step)}
                            className="w-7 h-7 rounded-lg bg-white hover:bg-stone-100 text-stone-700 flex items-center justify-center border border-[#E8DEC8] shadow-2xs transition-colors cursor-pointer"
                            title="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          
                          <input
                            type="number"
                            step={isWeight ? '0.05' : '1'}
                            min="0.01"
                            value={it.quantity}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) {
                                handleUpdateQuantity(idx, val);
                              }
                            }}
                            className="w-14 text-center font-mono font-bold text-xs sm:text-sm bg-transparent focus:outline-none text-[#1C1917]"
                          />

                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(idx, it.quantity + step)}
                            className="w-7 h-7 rounded-lg bg-white hover:bg-stone-100 text-stone-700 flex items-center justify-center border border-[#E8DEC8] shadow-2xs transition-colors cursor-pointer"
                            title="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Line Total */}
                        <div className="text-right min-w-[70px]">
                          <div className="font-bold font-mono text-xs sm:text-sm text-[#1C1917]">
                            ₹{it.lineTotal.toFixed(2)}
                          </div>
                        </div>

                        {/* Delete Item */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove item from bill"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── 3. Payment & Customer Adjustments ─── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Left: Payment Method & Customer */}
            <div className="p-4 rounded-2xl bg-white border border-[#E8DEC8] shadow-xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-600 block">
                Payment & Customer
              </span>

              {/* Payment Mode Pills */}
              <div>
                <label className="text-[11px] font-bold text-stone-500 block mb-1">
                  Payment Mode
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['CASH', 'UPI', 'CARD', 'CREDIT'] as PaymentMethod[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMethod(mode)}
                      className={`py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        paymentMethod === mode
                          ? 'bg-[#B8860B] text-white border-[#B8860B] shadow-xs'
                          : 'bg-[#FAF8F5] text-stone-600 border-[#E8DEC8] hover:bg-stone-100'
                      }`}
                    >
                      {mode === 'CREDIT' ? 'Udhar' : mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash Tender / Received */}
              {(paymentMethod === 'CASH' || paymentMethod === 'CREDIT') && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[11px] font-bold text-stone-500 block mb-1">
                      Amount Received (₹)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      placeholder={totals.grandTotal.toString()}
                      className="w-full px-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] text-xs font-mono font-bold focus:outline-none focus:border-[#C99A18]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-stone-500 block mb-1">
                      {pendingDue > 0 ? 'Pending Due (Udhar)' : 'Change to Return'}
                    </label>
                    <div className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold ${
                      pendingDue > 0 
                        ? 'bg-rose-50 border-rose-200 text-rose-700' 
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    }`}>
                      ₹{pendingDue > 0 ? pendingDue.toFixed(2) : changeGiven.toFixed(2)}
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-stone-500 block mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] text-xs focus:outline-none focus:border-[#C99A18]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-stone-500 block mb-1">
                    Customer Phone
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="10-digit mobile"
                    className="w-full px-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] text-xs font-mono focus:outline-none focus:border-[#C99A18]"
                  />
                </div>
              </div>
            </div>

            {/* Right: Financial Summary & Discount */}
            <div className="p-4 rounded-2xl bg-white border border-[#E8DEC8] shadow-xs flex flex-col justify-between space-y-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-600 block mb-3">
                  Summary & Totals
                </span>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-stone-600">
                    <span>Items Subtotal:</span>
                    <span className="font-mono font-bold">₹{totals.subtotal.toFixed(2)}</span>
                  </div>

                  {/* Discount percentage adjustment */}
                  <div className="flex items-center justify-between gap-3 text-stone-600">
                    <span className="shrink-0">Discount (%):</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                        className="w-16 px-2 py-1 text-right font-mono font-bold rounded-lg border border-[#E8DEC8] bg-[#FAF8F5] text-xs focus:outline-none focus:border-[#C99A18]"
                      />
                      <span className="font-mono font-bold text-rose-600 min-w-[70px] text-right">
                        -₹{totals.discountAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {order.transactionType === 'CUSTOMER_BILL' && totals.gstAmount > 0 && (
                    <div className="flex items-center justify-between text-stone-600">
                      <span>Included GST (5%):</span>
                      <span className="font-mono font-bold text-stone-500">
                        ₹{totals.gstAmount.toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-[#E8DEC8] flex items-center justify-between">
                    <span className="font-bold text-sm text-[#1C1917]">Revised Grand Total:</span>
                    <span className="font-bold font-mono text-base text-[#B8860B]">
                      ₹{totals.grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Difference vs Original Bill */}
              <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] text-xs flex items-center justify-between">
                <span className="text-stone-500">
                  Original: <strong className="font-mono text-stone-700">₹{order.grandTotal.toFixed(2)}</strong>
                </span>
                <span className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded-full ${
                  grandTotalDiff === 0 
                    ? 'bg-stone-100 text-stone-600'
                    : grandTotalDiff > 0
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {grandTotalDiff === 0 ? 'No price change' : (grandTotalDiff > 0 ? `+₹${grandTotalDiff.toFixed(2)}` : `-₹${Math.abs(grandTotalDiff).toFixed(2)}`)}
                </span>
              </div>
            </div>

          </div>

        </div>

        {/* ─── 4. Footer Controls ─── */}
        <div className="p-4 sm:p-5 border-t border-[#E8DEC8] bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-stone-500 hidden sm:block">
            * Changes update this bill in-place without generating a new bill number.
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-[#E8DEC8] hover:bg-stone-100 text-xs font-bold text-stone-600 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isSubmitting || items.length === 0}
              onClick={handleSave}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-105 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Updating Bill...</span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save & Update {displayBillNumber}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
