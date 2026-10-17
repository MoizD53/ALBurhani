import React, { useState, useRef } from 'react';
import { 
  Barcode, 
  Search, 
  Camera, 
  Plus, 
  Minus, 
  Trash2, 
  Check, 
  CreditCard, 
  Banknote, 
  QrCode, 
  ShoppingBag,
  Tag,
  ArrowRight,
  AlertTriangle,
  PackageX
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
  const [scannerNotification, setScannerNotification] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  
  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const categories: string[] = ['All', 'Sweets', 'Namkeen & Farsan', 'Dry Fruits', 'Snacks & Khakhra', 'Festive Gift Hampers'];

  const triggerScanFeedback = (msg: string, isError = false) => {
    setScannerNotification(isError ? `error:${msg}` : `ok:${msg}`);
    setTimeout(() => setScannerNotification(null), 3000);
  };

  const addProductToCart = (product: Product) => {
    if (product.stock <= 0) {
      playBeep('error');
      triggerScanFeedback(`"${product.name}" is out of stock`, true);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          playBeep('error');
          triggerScanFeedback(`Max stock reached — ${product.stock} units available`, true);
          return prev;
        }
        playBeep('scan');
        triggerScanFeedback(`+1 ${product.name}`);
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      playBeep('scan');
      triggerScanFeedback(`${product.name} · ₹${product.sellingPrice}`);
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
              triggerScanFeedback(`Max ${item.product.stock} units available`, true);
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

  // Totals
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
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      cashierName: 'Counter 01 - Cashier',
      createdAt: new Date().toLocaleString('en-IN', {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
    };

    onCompleteSale(newOrder);
    setCompletedOrder(newOrder);
    setCart([]);
    setAmountReceived('');
    setCustomerName('');
    setCustomerPhone('');
    setMobileTab('catalog');
    setIsCheckingOut(false);
  };

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || 
      p.name.toLowerCase().includes(q) ||
      p.barcode.includes(q) ||
      p.category.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const scanNotifIsError = scannerNotification?.startsWith('error:');
  const scanNotifMsg = scannerNotification?.replace(/^(ok:|error:)/, '');

  return (
    // Full-height flex layout — fills main scroll area
    <div className="h-full flex flex-col gap-0 -m-3 sm:-m-5 lg:-m-6">

      {/* ─── Mobile Tab Switcher ─── */}
      <div className="lg:hidden flex items-center gap-1 px-3 pt-3 pb-2 shrink-0">
        <button
          onClick={() => setMobileTab('catalog')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === 'catalog'
              ? 'bg-[#D4AF37] text-black'
              : 'text-gray-400 bg-white/[0.04] hover:text-white'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Products ({products.length})</span>
        </button>
        <button
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === 'cart'
              ? 'bg-[#D4AF37] text-black'
              : 'text-gray-400 bg-white/[0.04] hover:text-white'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Bill ({totalCartCount})</span>
          {grandTotal > 0 && <span className="font-mono font-bold text-[11px]">₹{grandTotal}</span>}
        </button>
      </div>

      {/* ─── Main 3-column layout ─── */}
      <div className="flex-1 min-h-0 flex gap-0 lg:gap-4 lg:px-4 lg:pb-4 overflow-hidden">

        {/* ═══ LEFT: Catalogue Panel ═══ */}
        <div className={`flex flex-col min-h-0 w-full lg:flex-1 px-3 lg:px-0 pt-2 lg:pt-4 pb-3 lg:pb-0 gap-3 ${mobileTab === 'cart' ? 'hidden lg:flex' : 'flex'}`}>

          {/* ── Compact Barcode Toolbar ── */}
          <div className="shrink-0">
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2 items-center">
              {/* Input */}
              <div className="relative flex-1 min-w-0">
                <Barcode className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  data-barcode-input="true"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scan barcode or type product code…"
                  className="pl-9 pr-3 py-2 text-sm font-mono bg-[#111] border border-white/[0.08] text-white rounded-xl focus:border-[#D4AF37]/50 w-full"
                  autoFocus
                />
              </div>
              {/* Scan Add */}
              <button
                type="submit"
                className="btn-gold text-xs px-4 py-2 shrink-0 rounded-xl font-semibold"
              >
                Add
              </button>
              {/* Camera */}
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white border border-white/[0.06] transition-colors shrink-0"
                title="Camera scan"
              >
                <Camera className="w-4 h-4" />
              </button>
            </form>

            {/* Scanner status + notification */}
            <div className="flex items-center gap-3 mt-1.5 px-1">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-[11px] text-gray-600">USB Scanner Ready</span>
              </div>
              {scannerNotification && scanNotifMsg && (
                <div className={`flex items-center gap-1.5 text-[11px] font-medium animate-fade-in truncate ${
                  scanNotifIsError ? 'text-red-400' : 'text-emerald-400'
                }`}>
                  <span>·</span>
                  <span className="truncate">{scanNotifMsg}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Search + Categories ── */}
          <div className="shrink-0 space-y-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search products, SKU or barcode…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm bg-[#111] border border-white/[0.08] rounded-xl text-white w-full focus:border-[#D4AF37]/50"
              />
            </div>

            {/* Category filter pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 flex-nowrap no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-[#D4AF37] text-black font-semibold'
                      : 'bg-white/[0.04] text-gray-400 hover:text-white hover:bg-white/[0.07] border border-white/[0.06]'
                  }`}
                >
                  {cat === 'Namkeen & Farsan' ? 'Namkeen' : cat === 'Snacks & Khakhra' ? 'Snacks' : cat === 'Festive Gift Hampers' ? 'Hampers' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* ── Product Grid (Scrollable) ── */}
          <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
            {filteredProducts.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center p-6">
                <Search className="w-8 h-8 text-gray-700 mb-3 stroke-1" />
                <p className="text-sm font-medium text-gray-400">No products found</p>
                <p className="text-xs text-gray-600 mt-1">Try a different search or select "All"</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5">
                {filteredProducts.map((p) => {
                  const isLow = p.stock <= p.minStock;
                  const isOut = p.stock <= 0;
                  const inCart = cart.find((i) => i.product.id === p.id);

                  return (
                    <div
                      key={p.id}
                      onClick={() => !isOut && addProductToCart(p)}
                      className={`group relative flex flex-col rounded-xl border transition-all duration-150 ${
                        isOut
                          ? 'bg-[#0f0f0f] border-white/[0.05] opacity-60 cursor-not-allowed'
                          : 'bg-[#111] border-white/[0.07] hover:border-white/[0.18] hover:-translate-y-px cursor-pointer'
                      } ${inCart ? 'border-[#D4AF37]/30' : ''}`}
                    >
                      {/* Card body */}
                      <div className="p-3 flex flex-col flex-1">
                        {/* Top row: category + stock */}
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className="text-[10px] text-gray-600 uppercase tracking-wide font-medium truncate">
                            {p.category.split(' ')[0]}
                          </span>
                          <span className={`text-[10px] font-medium shrink-0 flex items-center gap-0.5 ${
                            isOut ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-gray-600'
                          }`}>
                            {isOut && <PackageX className="w-3 h-3" />}
                            {isLow && !isOut && <AlertTriangle className="w-2.5 h-2.5" />}
                            {isOut ? 'Out' : `${p.stock}`}
                          </span>
                        </div>

                        {/* Product name — fixed 2-line height */}
                        <h4 className="text-[13px] font-semibold text-white leading-snug line-clamp-2 min-h-[2.6rem] mb-1 group-hover:text-[#E5C158] transition-colors">
                          {p.name}
                        </h4>

                        {/* Package size */}
                        <p className="text-[11px] text-gray-600 truncate mb-3">
                          {p.netWeight} · {p.unit}
                        </p>

                        {/* Price row */}
                        <div className="mt-auto flex items-center justify-between">
                          <span className="text-[15px] font-bold text-white font-mono">
                            ₹{p.sellingPrice}
                          </span>

                          <div className="flex items-center gap-1">
                            {/* Sticker print */}
                            <button
                              title="Print Barcode Sticker"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenStickerModal(p);
                              }}
                              className="p-1 rounded-lg text-gray-700 hover:text-gray-400 hover:bg-white/[0.05] transition-colors"
                            >
                              <Tag className="w-3 h-3" />
                            </button>

                            {/* Add to cart */}
                            <div className={`p-1.5 rounded-lg transition-colors ${
                              isOut 
                                ? 'bg-white/[0.03] text-gray-700'
                                : 'bg-[#D4AF37]/15 text-[#D4AF37] group-hover:bg-[#D4AF37] group-hover:text-black'
                            }`}>
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* In-cart badge */}
                      {inCart && (
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#D4AF37] text-black text-[10px] font-bold flex items-center justify-center shadow-md">
                          {inCart.quantity}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mobile sticky cart bar */}
          {cart.length > 0 && (
            <div className="lg:hidden shrink-0">
              <button
                onClick={() => setMobileTab('cart')}
                className="w-full btn-gold py-3 px-4 rounded-xl flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 stroke-[2.5]" />
                  <span className="font-bold text-sm">
                    {totalCartCount} item{totalCartCount > 1 ? 's' : ''} in bill
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono font-black">
                  <span>₹{grandTotal}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            </div>
          )}
        </div>

        {/* ═══ RIGHT: Billing Panel ═══ */}
        <div className={`
          w-full lg:w-[400px] xl:w-[420px] shrink-0 flex flex-col min-h-0
          px-3 lg:px-0 pt-2 lg:pt-4 pb-3 lg:pb-0
          ${mobileTab === 'catalog' ? 'hidden lg:flex' : 'flex'}
        `}>
          <div className="flex flex-col flex-1 min-h-0 rounded-xl bg-[#0e0e0e] border border-white/[0.08] overflow-hidden">
            
            {/* ── Bill Header ── */}
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <ShoppingBag className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white leading-none">Current Bill</h3>
                  <span className="text-[11px] text-gray-600 mt-0.5 block">
                    {totalCartCount === 0 ? 'Empty cart' : `${totalCartCount} item${totalCartCount > 1 ? 's' : ''}`}
                  </span>
                </div>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-[11px] text-gray-600 hover:text-red-400 transition-colors font-medium"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* ── Customer info ── */}
            <div className="px-4 py-2.5 border-b border-white/[0.05] grid grid-cols-2 gap-2 shrink-0">
              <input
                type="text"
                placeholder="Customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="text-xs py-2 px-2.5 bg-white/[0.03] border-white/[0.06] rounded-lg text-white placeholder:text-gray-700"
              />
              <input
                type="tel"
                placeholder="Phone / WhatsApp"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="text-xs py-2 px-2.5 bg-white/[0.03] border-white/[0.06] rounded-lg text-white font-mono placeholder:text-gray-700"
              />
            </div>

            {/* ── Cart Items (Scrollable) ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 py-2">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <Barcode className="w-10 h-10 text-gray-800 mb-3 stroke-1" />
                  <p className="text-sm font-medium text-gray-500">Cart is empty</p>
                  <p className="text-xs text-gray-700 mt-1">
                    Scan a barcode or tap a product
                  </p>
                </div>
              ) : (
                <div className="space-y-1 px-3">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center gap-2.5 py-2.5 px-3 rounded-lg bg-white/[0.025] hover:bg-white/[0.04] transition-colors border border-white/[0.04]"
                    >
                      {/* Product info */}
                      <div className="flex-1 min-w-0">
                        <h5 className="text-[13px] font-medium text-white truncate leading-tight">
                          {item.product.name}
                        </h5>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-600">
                          <span className="font-mono">₹{item.product.sellingPrice}</span>
                          <span>·</span>
                          <span>{item.product.netWeight}</span>
                        </div>
                      </div>

                      {/* Qty controls */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="w-6 h-6 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-gray-400 hover:text-white flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-[13px] font-bold text-white font-mono">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="w-6 h-6 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-gray-400 hover:text-white flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Line total + remove */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[13px] font-bold text-white font-mono w-14 text-right">
                          ₹{item.quantity * item.product.sellingPrice}
                        </span>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-gray-700 hover:text-red-400 transition-colors p-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Totals + Payment + Checkout (Fixed footer) ── */}
            <div className="shrink-0 border-t border-white/[0.07] px-4 pt-3 pb-4 space-y-3">

              {/* Subtotal / Discount / GST */}
              <div className="space-y-1.5 text-[12px]">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span className="font-mono text-gray-300">₹{subtotal.toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Discount</span>
                  <div className="flex items-center gap-1">
                    {[0, 5, 10].map((d) => (
                      <button
                        key={d}
                        onClick={() => setDiscountPercent(d)}
                        className={`w-8 py-0.5 text-[11px] rounded font-semibold transition-colors ${
                          discountPercent === d
                            ? 'bg-[#D4AF37] text-black'
                            : 'bg-white/[0.05] text-gray-500 hover:text-white'
                        }`}
                      >
                        {d}%
                      </button>
                    ))}
                  </div>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-500">
                    <span>Savings</span>
                    <span className="font-mono">−₹{discountAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-gray-600">
                  <span>GST 5% (Mithai & Namkeen)</span>
                  <span className="font-mono">₹{gstAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Grand Total */}
              <div className="flex items-baseline justify-between py-2.5 px-3 rounded-lg bg-white/[0.025] border border-white/[0.06]">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-bold block">Total Due</span>
                  <span className="text-[10px] text-gray-700">incl. GST & rounding</span>
                </div>
                <span className="text-[28px] font-black text-white font-mono">
                  ₹{grandTotal}
                </span>
              </div>

              {/* Payment method */}
              <div className="grid grid-cols-3 gap-1.5">
                {([['CASH', 'Cash', Banknote], ['UPI', 'UPI QR', QrCode], ['CARD', 'Card', CreditCard]] as const).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    onClick={() => setPaymentMethod(key as PaymentMethod)}
                    className={`py-2 rounded-lg border flex flex-col items-center gap-0.5 transition-all text-[11px] font-medium ${
                      paymentMethod === key
                        ? 'border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[#D4AF37]'
                        : 'border-white/[0.06] bg-white/[0.02] text-gray-600 hover:text-gray-300 hover:border-white/[0.12]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Cash change calculator */}
              {paymentMethod === 'CASH' && grandTotal > 0 && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {[100, 200, 500, 2000].map((val) => (
                      <button
                        key={val}
                        onClick={() => setAmountReceived(val.toString())}
                        className="flex-1 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-mono text-gray-500 hover:text-white transition-colors"
                      >
                        ₹{val}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Cash received</span>
                    <input
                      type="number"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      placeholder={`₹${grandTotal}`}
                      className="w-24 text-right py-1 px-2 text-xs bg-white/[0.04] border-white/[0.08] rounded-lg font-mono text-white"
                    />
                  </div>
                  {receivedNum >= grandTotal && amountReceived && (
                    <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
                      <span>Return change</span>
                      <span className="font-mono">₹{changeGiven.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Checkout button */}
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0 || isCheckingOut}
                className="w-full btn-gold py-3.5 text-sm font-bold tracking-wide flex items-center justify-center gap-2 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(212,175,55,0.2)]"
              >
                {isCheckingOut ? (
                  <span>Processing…</span>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      {cart.length === 0 ? 'Complete & Print Bill' : `Complete & Print  ₹${grandTotal}`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Camera Scanner Modal */}
      <CameraBarcodeScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScanSuccess={(code) => {
          setBarcodeInput(code);
          const matched = products.find(
            (p) => p.barcode.toLowerCase() === code.toLowerCase()
          );
          if (matched) {
            addProductToCart(matched);
          } else {
            playBeep('error');
            triggerScanFeedback(`Barcode "${code}" not found`, true);
          }
        }}
      />

      {/* Receipt Modal */}
      <ReceiptModal
        order={completedOrder}
        onClose={() => setCompletedOrder(null)}
      />
    </div>
  );
};
