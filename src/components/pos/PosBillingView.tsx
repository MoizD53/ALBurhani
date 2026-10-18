import React, { useState, useRef } from 'react';
import { 
  Barcode, 
  Search, 
  Camera, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Banknote, 
  QrCode, 
  ShoppingBag,
  Tag,
  ArrowRight,
  AlertTriangle,
  PackageX,
  X,
  CheckCircle2,
  Receipt
} from 'lucide-react';
import { Product, CartItem, OrderBill, PaymentMethod } from '../../types';
import { playBeep } from '../../lib/utils';
import { CameraBarcodeScannerModal } from '../barcode/CameraBarcodeScannerModal';
import { ReceiptModal } from './ReceiptModal';

interface PosBillingViewProps {
  products: Product[];
  onCompleteSale: (order: OrderBill) => void;
  onOpenStickerModal: (product: Product) => void;
}

export const PosBillingView: React.FC<PosBillingViewProps> = ({
  products,
  onCompleteSale,
  onOpenStickerModal,
}) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [completedOrder, setCompletedOrder] = useState<OrderBill | null>(null);
  const [scannerNotification, setScannerNotification] = useState<{ text: string; isError: boolean } | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  
  // Mobile segmented tab state
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const categories: string[] = [
    'All', 
    'Sweets', 
    'Namkeen & Farsan', 
    'Dry Fruits', 
    'Snacks & Khakhra', 
    'Festive Gift Hampers'
  ];

  const triggerScanFeedback = (text: string, isError = false) => {
    setScannerNotification({ text, isError });
    setTimeout(() => setScannerNotification(null), 3000);
  };

  const addProductToCart = (product: Product) => {
    if (product.stock <= 0) {
      playBeep('error');
      triggerScanFeedback(`"${product.name}" is out of stock!`, true);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          playBeep('error');
          triggerScanFeedback(`Stock limit reached (${product.stock} units max)`, true);
          return prev;
        }
        playBeep('scan');
        triggerScanFeedback(`+1 ${product.name} (x${existing.quantity + 1})`);
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      playBeep('scan');
      triggerScanFeedback(`Added: ${product.name} · ₹${product.sellingPrice}`);
      return [...prev, { product, quantity: 1, discountPercent: 0 }];
    });
  };

  const handleBarcodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    const matched = products.find(
      (p) => p.barcode.toLowerCase() === code.toLowerCase()
    );

    if (matched) {
      addProductToCart(matched);
      setBarcodeInput('');
      barcodeInputRef.current?.focus();
    } else {
      playBeep('error');
      triggerScanFeedback(`Barcode "${code}" not found in inventory`, true);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty > item.product.stock) {
              triggerScanFeedback(`Only ${item.product.stock} units available`, true);
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Financial Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.product.sellingPrice, 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const taxableAmount = subtotal - discountAmount;
  const gstAmount = taxableAmount * 0.05;
  const grandTotal = Math.round(taxableAmount + gstAmount);

  const receivedNum = parseFloat(amountReceived) || grandTotal;
  const changeGiven = Math.max(0, receivedNum - grandTotal);
  const totalCartCount = cart.reduce((c, i) => c + i.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0 || isCheckingOut) return;

    setIsCheckingOut(true);
    playBeep('success');

    const newOrder: OrderBill = {
      id: `bill-${Date.now()}`,
      billNumber: `ALB-${Math.floor(1000 + Math.random() * 9000)}`,
      items: [...cart],
      subtotal,
      discountAmount,
      gstAmount,
      grandTotal,
      paymentMethod,
      amountReceived: paymentMethod === 'CASH' ? receivedNum : grandTotal,
      changeGiven: paymentMethod === 'CASH' ? changeGiven : 0,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      cashierName: 'Counter 01',
      createdAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };

    onCompleteSale(newOrder);
    setCompletedOrder(newOrder);

    // Reset local billing state
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscountPercent(0);
    setAmountReceived('');
    setIsCheckingOut(false);
  };

  // Filter products by search and category
  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#070707] text-[#eaeaea]">
      
      {/* ─── Mobile Segmented Toggle (Shown only < 1024px) ─── */}
      <div className="lg:hidden shrink-0 flex items-center p-2 bg-[#0d0d0d] border-b border-white/[0.08] gap-2">
        <button
          onClick={() => setMobileTab('catalog')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === 'catalog'
              ? 'bg-[#D4AF37] text-black shadow-sm'
              : 'text-gray-400 bg-white/[0.04] hover:text-white'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Catalog ({filteredProducts.length})</span>
        </button>
        <button
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === 'cart'
              ? 'bg-[#D4AF37] text-black shadow-sm'
              : 'text-gray-400 bg-white/[0.04] hover:text-white'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Bill ({totalCartCount})</span>
          {grandTotal > 0 && (
            <span className="font-mono font-bold text-[11px] bg-black/20 px-1.5 py-0.5 rounded">
              ₹{grandTotal}
            </span>
          )}
        </button>
      </div>

      {/* ─── Main 2-Panel Workspace Layout ─── */}
      <div className="flex-1 min-h-0 flex gap-0 lg:gap-3.5 p-2 sm:p-3 lg:p-4 overflow-hidden">

        {/* ══════════════════════════════════════════
            LEFT PANEL: PRODUCT CATALOGUE & SCANNER
           ══════════════════════════════════════════ */}
        <div className={`flex-1 min-w-0 flex flex-col min-h-0 gap-3 ${
          mobileTab === 'cart' ? 'hidden lg:flex' : 'flex'
        }`}>

          {/* ── 1. Compact Barcode Input Toolbar ── */}
          <div className="shrink-0 p-2 sm:p-2.5 rounded-xl bg-[#0f0f0f] border border-white/[0.08] shadow-sm">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              
              {/* Form Barcode Input */}
              <form onSubmit={handleBarcodeSubmit} className="flex-1 min-w-0 flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    data-barcode-input="true"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Scan barcode gun or type product SKU code (Press Enter)..."
                    className="w-full pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm font-mono bg-black/60 border border-white/[0.1] rounded-lg text-white placeholder:text-gray-600 focus:border-[#D4AF37]/60 focus:bg-black transition-colors"
                    autoFocus
                  />
                  {barcodeInput && (
                    <button
                      type="button"
                      onClick={() => setBarcodeInput('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Manual Add Button */}
                <button
                  type="submit"
                  disabled={!barcodeInput.trim()}
                  className="btn-gold text-xs px-3.5 py-1.5 sm:py-2 rounded-lg font-bold flex items-center gap-1.5 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Add</span>
                </button>

                {/* Camera Scan Trigger */}
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="p-1.5 sm:p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white border border-white/[0.08] transition-colors shrink-0"
                  title="Scan with Camera"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </form>

              {/* Status & Live Scan Feedback */}
              <div className="flex items-center gap-2 shrink-0 px-1 text-xs">
                {scannerNotification ? (
                  <div className={`flex items-center gap-1.5 text-xs font-semibold animate-fade-in ${
                    scannerNotification.isError ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    {scannerNotification.isError ? (
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="truncate max-w-[200px] sm:max-w-[240px]">{scannerNotification.text}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-gray-500 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    <span>Hardware Ready</span>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ── 2. Search & Category Filters Hub ── */}
          <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            
            {/* Search input */}
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search products by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 sm:py-2 text-xs bg-[#111] border border-white/[0.08] rounded-xl text-white placeholder:text-gray-600 focus:border-[#D4AF37]/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Pills (Smooth scroll) */}
            <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar flex-nowrap">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                const shortLabel = 
                  cat === 'Namkeen & Farsan' ? 'Namkeen' : 
                  cat === 'Snacks & Khakhra' ? 'Snacks' : 
                  cat === 'Festive Gift Hampers' ? 'Hampers' : cat;

                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                      isSelected
                        ? 'bg-[#D4AF37] text-black font-semibold shadow-sm'
                        : 'bg-white/[0.03] text-gray-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.06]'
                    }`}
                  >
                    {shortLabel}
                  </button>
                );
              })}
            </div>

          </div>

          {/* ── 3. Product Grid (Independently Scrollable) ── */}
          <div className="flex-1 overflow-y-auto min-h-0 pr-1 custom-scrollbar">
            {filteredProducts.length === 0 ? (
              <div className="h-60 flex flex-col items-center justify-center text-center p-6 bg-white/[0.01] rounded-2xl border border-white/[0.04]">
                <Search className="w-9 h-9 text-gray-600 mb-2 stroke-1" />
                <p className="text-sm font-semibold text-gray-300">No matching products found</p>
                <p className="text-xs text-gray-500 mt-0.5">Try searching with a different keyword or select "All"</p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-3 text-xs text-[#D4AF37] hover:underline font-medium"
                  >
                    Clear search filter
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-2.5 sm:gap-3">
                {filteredProducts.map((p) => {
                  const isLow = p.stock <= p.minStock && p.stock > 0;
                  const isOut = p.stock <= 0;
                  const inCart = cart.find((i) => i.product.id === p.id);

                  return (
                    <div
                      key={p.id}
                      onClick={() => !isOut && addProductToCart(p)}
                      className={`group relative flex flex-col justify-between rounded-xl border p-3 transition-all duration-150 select-none ${
                        isOut
                          ? 'bg-[#0c0c0c] border-white/[0.04] opacity-50 cursor-not-allowed'
                          : 'bg-[#101010] border-white/[0.07] hover:border-white/[0.2] hover:bg-[#141414] cursor-pointer shadow-sm hover:shadow-md'
                      } ${inCart ? 'border-[#D4AF37]/40 ring-1 ring-[#D4AF37]/20 bg-[#121210]' : ''}`}
                    >
                      {/* In-cart count badge */}
                      {inCart && (
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#D4AF37] text-black text-[11px] font-black flex items-center justify-center shadow-md">
                          {inCart.quantity}
                        </div>
                      )}

                      <div>
                        {/* Top Metadata: Category & Stock Status */}
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold truncate">
                            {p.category.split(' ')[0]}
                          </span>

                          <span className={`text-[10px] font-medium shrink-0 flex items-center gap-0.5 ${
                            isOut ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-gray-500'
                          }`}>
                            {isOut && <PackageX className="w-3 h-3" />}
                            {isLow && <AlertTriangle className="w-2.5 h-2.5" />}
                            <span>{isOut ? 'Out of Stock' : isLow ? `${p.stock} left` : `${p.stock} in stock`}</span>
                          </span>
                        </div>

                        {/* Product Title (Strict 2-line height for uniform alignment) */}
                        <h4 className="text-[13px] sm:text-[14px] font-semibold text-white leading-snug line-clamp-2 h-10 group-hover:text-[#E5C158] transition-colors">
                          {p.name}
                        </h4>

                        {/* Package Specification */}
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">
                          {p.netWeight} · {p.unit}
                        </p>
                      </div>

                      {/* Bottom Row: Price & Action Controls */}
                      <div className="mt-3 pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] text-gray-500 block leading-none">MRP</span>
                          <span className="text-base sm:text-lg font-bold font-mono text-white leading-tight">
                            ₹{p.sellingPrice}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Sticker Action */}
                          <button
                            title="Generate Thermal Barcode Sticker"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenStickerModal(p);
                            }}
                            className="p-1 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/[0.06] transition-colors"
                          >
                            <Tag className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Add Button */}
                          <div className={`p-1.5 rounded-lg transition-colors ${
                            isOut 
                              ? 'bg-white/[0.02] text-gray-600'
                              : 'bg-[#D4AF37]/15 text-[#D4AF37] group-hover:bg-[#D4AF37] group-hover:text-black shadow-sm'
                          }`}>
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── 4. Mobile Sticky Bottom Cart Drawer Bar (When items in cart) ── */}
          {cart.length > 0 && (
            <div className="lg:hidden shrink-0 pt-1">
              <button
                onClick={() => setMobileTab('cart')}
                className="w-full btn-gold py-3 px-4 rounded-xl flex items-center justify-between shadow-lg"
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 stroke-[2.5]" />
                  <span className="font-bold text-sm">
                    {totalCartCount} item{totalCartCount > 1 ? 's' : ''} in bill
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono font-black text-sm">
                  <span>₹{grandTotal}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            </div>
          )}

        </div>

        {/* ══════════════════════════════════════════
            RIGHT PANEL: STRUCTURED BILLING WORKSPACE
           ══════════════════════════════════════════ */}
        <div className={`
          w-full lg:w-[390px] xl:w-[420px] shrink-0 flex flex-col min-h-0
          bg-[#0c0c0c] rounded-2xl border border-white/[0.08] shadow-xl overflow-hidden
          ${mobileTab === 'catalog' ? 'hidden lg:flex' : 'flex'}
        `}>
          
          {/* ── Bill Header ── */}
          <div className="px-4 py-3 border-b border-white/[0.07] bg-[#0f0f0f] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <ShoppingBag className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white leading-none">Current Bill</h3>
                <span className="text-[11px] text-gray-500 mt-0.5 block">
                  {totalCartCount === 0 ? 'No items in cart' : `${totalCartCount} item${totalCartCount > 1 ? 's' : ''} added`}
                </span>
              </div>
            </div>

            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-[11px] text-gray-500 hover:text-red-400 transition-colors font-medium"
              >
                Clear all
              </button>
            )}
          </div>

          {/* ── Customer Details Inputs ── */}
          <div className="px-3.5 py-2 border-b border-white/[0.05] bg-white/[0.015] grid grid-cols-2 gap-2 shrink-0">
            <input
              type="text"
              placeholder="Customer Name (optional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="text-xs py-1.5 px-2.5 bg-black/50 border border-white/[0.07] rounded-lg text-white placeholder:text-gray-600 focus:border-[#D4AF37]/50 transition-colors"
            />
            <input
              type="tel"
              placeholder="Phone / WhatsApp"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="text-xs py-1.5 px-2.5 bg-black/50 border border-white/[0.07] rounded-lg text-white font-mono placeholder:text-gray-600 focus:border-[#D4AF37]/50 transition-colors"
            />
          </div>

          {/* ── Cart Items List (Independently Scrollable) ── */}
          <div className="flex-1 min-h-[120px] overflow-y-auto px-3 py-2 space-y-1.5 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-center p-6 text-gray-500">
                <Barcode className="w-10 h-10 text-gray-700 mb-2 stroke-1" />
                <p className="text-sm font-semibold text-gray-400">Cart is empty</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Scan barcode with gun or click products to bill
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center gap-2.5 p-2 rounded-lg bg-white/[0.025] hover:bg-white/[0.04] border border-white/[0.04] transition-colors"
                >
                  {/* Product information */}
                  <div className="flex-1 min-w-0">
                    <h5 className="text-[13px] font-semibold text-white truncate leading-tight">
                      {item.product.name}
                    </h5>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-500">
                      <span className="font-mono text-gray-400">₹{item.product.sellingPrice}</span>
                      <span>·</span>
                      <span>{item.product.netWeight}</span>
                    </div>
                  </div>

                  {/* Quantity adjustment buttons */}
                  <div className="flex items-center gap-1 shrink-0 bg-black/40 border border-white/[0.08] rounded-lg p-0.5">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="w-5 h-5 rounded bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 hover:text-white flex items-center justify-center transition-colors"
                      title="Decrease quantity"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-white font-mono">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="w-5 h-5 rounded bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 hover:text-white flex items-center justify-center transition-colors"
                      title="Increase quantity"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Line Total & Remove */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[13px] font-bold text-white font-mono w-14 text-right">
                      ₹{item.quantity * item.product.sellingPrice}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors p-1 rounded"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Anchored Financial Summary & Checkout Footer ── */}
          <div className="shrink-0 border-t border-white/[0.08] p-3 sm:p-3.5 space-y-2.5 bg-[#090909]">
            
            {/* Subtotal & Discount & Tax details */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal ({totalCartCount} items)</span>
                <span className="font-mono text-gray-200">₹{subtotal.toFixed(2)}</span>
              </div>

              {/* Discount pills */}
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Store Discount</span>
                <div className="flex items-center gap-1">
                  {[0, 5, 10].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDiscountPercent(d)}
                      className={`px-2 py-0.5 text-[11px] rounded font-semibold transition-colors ${
                        discountPercent === d
                          ? 'bg-[#D4AF37] text-black font-bold'
                          : 'bg-white/[0.04] text-gray-400 hover:text-white'
                      }`}
                    >
                      {d}%
                    </button>
                  ))}
                </div>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-400 text-xs font-medium">
                  <span>Discount Savings</span>
                  <span className="font-mono">−₹{discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-gray-500 text-[11px]">
                <span>GST (5% Mithai/Namkeen)</span>
                <span className="font-mono">₹{gstAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Total Due Prominent Display */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.07]">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-bold block">
                  Total Due
                </span>
                <span className="text-[10px] text-gray-500">incl. all taxes & rounding</span>
              </div>
              <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
                ₹{grandTotal}
              </span>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-1.5">
              {([['CASH', 'Cash', Banknote], ['UPI', 'UPI QR', QrCode], ['CARD', 'Card', CreditCard]] as const).map(([key, label, Icon]) => {
                const isSelected = paymentMethod === key;
                return (
                  <button
                    key={key}
                    onClick={() => setPaymentMethod(key as PaymentMethod)}
                    className={`py-1.5 sm:py-2 px-2 rounded-lg border flex flex-col items-center gap-1 transition-all text-xs font-semibold ${
                      isSelected
                        ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#D4AF37]'
                        : 'border-white/[0.06] bg-white/[0.02] text-gray-400 hover:text-white hover:border-white/[0.12]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px]">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Cash Tender & Change Calculation */}
            {paymentMethod === 'CASH' && grandTotal > 0 && (
              <div className="p-2 rounded-lg bg-black/40 border border-white/[0.06] space-y-1.5">
                <div className="flex gap-1">
                  {[100, 200, 500, 2000].map((val) => (
                    <button
                      key={val}
                      onClick={() => setAmountReceived(val.toString())}
                      className="flex-1 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-[10px] font-mono text-gray-400 hover:text-white transition-colors"
                    >
                      ₹{val}
                    </button>
                  ))}
                  <button
                    onClick={() => setAmountReceived(grandTotal.toString())}
                    className="flex-1 py-0.5 rounded bg-[#D4AF37]/20 text-[#D4AF37] text-[10px] font-mono font-bold"
                  >
                    Exact
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Cash Received:</span>
                  <input
                    type="number"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    placeholder={`₹${grandTotal}`}
                    className="w-24 text-right py-1 px-2 text-xs bg-black border border-white/[0.1] rounded font-mono text-white focus:border-[#D4AF37]/60"
                  />
                </div>

                {receivedNum >= grandTotal && amountReceived && (
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-400 pt-1 border-t border-white/[0.05]">
                    <span>Return Change:</span>
                    <span className="font-mono text-sm">₹{changeGiven.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Checkout Primary Action Button */}
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || isCheckingOut}
              className="w-full btn-gold py-3 text-sm font-bold tracking-wide flex items-center justify-center gap-2 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_4px_16px_rgba(212,175,55,0.2)]"
            >
              <Receipt className="w-4 h-4" />
              <span>{isCheckingOut ? 'Processing Sale...' : 'Complete Sale & Print Bill'}</span>
            </button>

          </div>

        </div>

      </div>

      {/* ─── Camera Barcode Scanner Modal ─── */}
      <CameraBarcodeScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScanSuccess={(code: string) => {
          setBarcodeInput(code);
          setIsCameraOpen(false);
          const matched = products.find(
            (p) => p.barcode.toLowerCase() === code.toLowerCase()
          );
          if (matched) {
            addProductToCart(matched);
            setBarcodeInput('');
          } else {
            playBeep('error');
            triggerScanFeedback(`Barcode "${code}" not found`, true);
          }
        }}
      />

      {/* ─── Completed Sale Receipt Modal ─── */}
      <ReceiptModal
        order={completedOrder}
        onClose={() => setCompletedOrder(null)}
      />

    </div>
  );
};
