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
  Sparkles,
  Zap,
  Tag,
  ArrowRight
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
  
  // Mobile tab state: 'catalog' vs 'cart'
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const categories: string[] = ['All', 'Sweets', 'Namkeen & Farsan', 'Dry Fruits', 'Snacks & Khakhra', 'Festive Gift Hampers'];

  const triggerScanFeedback = (msg: string) => {
    setScannerNotification(msg);
    setTimeout(() => setScannerNotification(null), 3000);
  };

  const addProductToCart = (product: Product) => {
    if (product.stock <= 0) {
      playBeep('error');
      triggerScanFeedback(`⚠️ "${product.name}" is OUT OF STOCK!`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          playBeep('error');
          triggerScanFeedback(`⚠️ Max stock limit reached (${product.stock} units)`);
          return prev;
        }
        playBeep('scan');
        triggerScanFeedback(`✓ Added +1 "${product.name}"`);
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      playBeep('scan');
      triggerScanFeedback(`✓ Scanned: "${product.name}" (₹${product.sellingPrice})`);
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
    } else {
      playBeep('error');
      triggerScanFeedback(`❌ Barcode "${code}" not found in AL-BHURANI inventory!`);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
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

  // Totals calculations
  const subtotal = cart.reduce(
    (sum, item) => sum + item.quantity * item.product.sellingPrice,
    0
  );
  const discountAmount = (subtotal * discountPercent) / 100;
  const taxableAmount = subtotal - discountAmount;
  // 5% GST on sweets/snacks
  const gstAmount = taxableAmount * 0.05;
  const grandTotal = Math.round(taxableAmount + gstAmount);

  const receivedNum = parseFloat(amountReceived) || grandTotal;
  const changeGiven = Math.max(0, receivedNum - grandTotal);
  const totalCartCount = cart.reduce((c, i) => c + i.quantity, 0);

  const handleCheckout = () => {
    if (cart.length === 0) return;

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
  };

  const filteredProducts = products.filter((p) => {
    const matchesCat =
      selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery);
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full space-y-4">
      
      {/* Mobile Segmented Switcher (< 1024px) */}
      <div className="lg:hidden flex items-center p-1 rounded-xl bg-black/60 border border-[#D4AF37]/25 shrink-0">
        <button
          onClick={() => setMobileTab('catalog')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            mobileTab === 'catalog'
              ? 'bg-[#D4AF37] text-black shadow-[0_0_12px_rgba(212,175,55,0.4)]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Products ({products.length})</span>
        </button>

        <button
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            mobileTab === 'cart'
              ? 'bg-[#D4AF37] text-black shadow-[0_0_12px_rgba(212,175,55,0.4)]'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Current Bill ({totalCartCount})</span>
          {grandTotal > 0 && (
            <span className="font-mono text-[11px] font-bold">₹{grandTotal}</span>
          )}
        </button>
      </div>

      {/* Main Grid: Dual Column on Laptop/Desktop, Switched on Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0">
        
        {/* LEFT COLUMN: Catalog & Barcode Bar (Hidden on mobile if cart tab selected) */}
        <div className={`lg:col-span-7 xl:col-span-8 flex flex-col gap-4 min-h-0 ${mobileTab === 'cart' ? 'hidden lg:flex' : 'flex'}`}>
          
          {/* BARCODE SPEED SCANNER BAR (TENS11 Luxury Gold Accent) */}
          <div className="p-3.5 sm:p-4 rounded-2xl liquid-glass border border-[#D4AF37]/25 relative shrink-0">
            
            <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] truncate">
                  Live Barcode Engine
                </span>
                <span className="text-[11px] text-gray-400 hidden sm:inline truncate">
                  (Plug USB Scanner Gun or Zap)
                </span>
              </div>

              <button
                onClick={() => setIsCameraOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-[#D4AF37] border border-white/10 text-xs flex items-center gap-1.5 transition-colors shrink-0"
              >
                <Camera className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Camera Scan</span>
              </button>
            </div>

            {/* Barcode Input Form */}
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Barcode className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#D4AF37]" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  data-barcode-input="true"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scan barcode gun or type code (e.g. 890100100101)..."
                  className="pl-10 pr-3 py-2 text-xs sm:text-sm font-mono tracking-wider bg-black/50 border border-[#D4AF37]/30 text-white rounded-xl focus:border-[#D4AF37]"
                />
              </div>
              <button
                type="submit"
                className="btn-gold text-xs px-4 sm:px-5 py-2 shrink-0 font-bold"
              >
                Scan Add
              </button>
            </form>

            {/* Notification Pill */}
            {scannerNotification && (
              <div className="mt-2.5 py-1.5 px-3 rounded-lg text-xs font-medium bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[#E5C158] flex items-center gap-2 animate-fade-in">
                <Zap className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                <span className="truncate">{scannerNotification}</span>
              </div>
            )}

            {/* Quick-Zap Interactive Tray (For Instant Scanning Demos) */}
            <div className="mt-2.5 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#D4AF37]" /> Demo Quick-Zap Bar (Tap to simulate scan):
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar flex-nowrap">
                {products.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addProductToCart(p)}
                    className="px-2.5 py-1 rounded-lg bg-black/60 border border-[#D4AF37]/25 hover:border-[#D4AF37] text-left shrink-0 text-xs transition-all hover:scale-[1.02] flex items-center gap-1.5 group whitespace-nowrap"
                  >
                    <Barcode className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#D4AF37]" />
                    <span className="font-medium text-white group-hover:text-[#D4AF37]">{p.name.split(' ')[0]}</span>
                    <span className="text-[10px] text-gray-500 font-mono">₹{p.sellingPrice}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Search & Category Filter Controls */}
          <div className="space-y-2.5 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search mithai, namkeen, or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 text-xs bg-black/40 border border-white/10 rounded-xl text-white"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar flex-nowrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-[#D4AF37] text-black shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                      : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid (Responsive & Fluid Scroll) */}
          <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-[300px]">
            {filteredProducts.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-gray-500">
                <Search className="w-8 h-8 text-gray-600 mb-2 stroke-1" />
                <p className="text-sm font-medium text-gray-400">No items matched</p>
                <p className="text-xs mt-1">Try another search keyword or select "All".</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredProducts.map((p) => {
                  const isLow = p.stock <= p.minStock;
                  return (
                    <div
                      key={p.id}
                      className="group relative p-3 rounded-2xl liquid-glass border border-white/10 hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between cursor-pointer hover:-translate-y-0.5 shadow-md"
                      onClick={() => addProductToCart(p)}
                    >
                      <div>
                        {/* Badges row: category + stock */}
                        <div className="flex items-center justify-between gap-1.5 mb-2">
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-white/5 text-[#D4AF37] border border-[#D4AF37]/15 truncate max-w-[120px]">
                            {p.category.split(' ')[0]}
                          </span>
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                              isLow ? 'bg-red-950/80 text-red-300 border border-red-500/30' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {p.stock} in stock
                          </span>
                        </div>

                        {/* Product Name (Zero overlap: line-clamp-2) */}
                        <h4 className="text-xs sm:text-sm font-semibold text-white group-hover:text-[#E5C158] transition-colors leading-snug line-clamp-2 min-h-[2.4rem] break-words">
                          {p.name}
                        </h4>
                        
                        <p className="text-[11px] text-gray-400 mt-1 font-medium truncate">
                          {p.netWeight} • {p.unit}
                        </p>
                      </div>

                      {/* Card Footer: Price & Add Actions */}
                      <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                        <div>
                          <span className="text-base font-bold text-white font-mono">
                            ₹{p.sellingPrice}
                          </span>
                          <div className="text-[9px] font-mono text-gray-500 truncate">
                            #{p.barcode.slice(-6)}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            title="Print Barcode Sticker"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenStickerModal(p);
                            }}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-[#D4AF37]/20 text-gray-400 hover:text-[#D4AF37] transition-colors"
                          >
                            <Tag className="w-3.5 h-3.5" />
                          </button>
                          
                          <div className="p-1.5 rounded-lg bg-[#D4AF37]/20 text-[#D4AF37] group-hover:bg-[#D4AF37] group-hover:text-black transition-colors">
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

          {/* Sticky Mobile Bottom Bar: Visible on phones when in catalog mode with items in cart */}
          {cart.length > 0 && (
            <div className="lg:hidden sticky bottom-0 pt-2 shrink-0 animate-fade-in">
              <button
                onClick={() => setMobileTab('cart')}
                className="w-full btn-gold py-3 px-4 rounded-xl flex items-center justify-between shadow-[0_4px_25px_rgba(212,175,55,0.4)]"
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 stroke-[2.5]" />
                  <span className="font-bold text-xs sm:text-sm">
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

        {/* RIGHT COLUMN: Active POS Cart & Billing (Hidden on mobile if catalog tab selected) */}
        <div className={`lg:col-span-5 xl:col-span-4 rounded-2xl liquid-glass border border-[#D4AF37]/25 p-4 sm:p-5 flex flex-col justify-between overflow-hidden shadow-2xl min-h-0 ${mobileTab === 'catalog' ? 'hidden lg:flex' : 'flex'}`}>
          
          {/* Cart Header */}
          <div className="pb-3 border-b border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <ShoppingBag className="w-5 h-5 text-[#D4AF37] shrink-0" />
              <div className="min-w-0">
                <h3 className="font-semibold text-white leading-none text-sm truncate">Current Bill</h3>
                <span className="text-[11px] text-gray-400">
                  {totalCartCount} items added
                </span>
              </div>
            </div>

            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-xs text-red-400 hover:text-red-300 transition-colors shrink-0 font-medium"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Customer Details */}
          <div className="py-2.5 border-b border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-2 shrink-0">
            <input
              type="text"
              placeholder="Customer Name (Optional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="text-xs py-1.5 px-2.5 bg-black/40 border-white/10 rounded-lg text-white"
            />
            <input
              type="tel"
              placeholder="Phone / WhatsApp"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="text-xs py-1.5 px-2.5 bg-black/40 border-white/10 rounded-lg text-white font-mono"
            />
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto py-2 space-y-2 pr-1 custom-scrollbar min-h-[160px]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
                <Barcode className="w-10 h-10 text-gray-600 mb-2 stroke-1" />
                <p className="text-sm font-medium text-gray-400">Cart is empty</p>
                <p className="text-xs mt-1 text-gray-500">
                  Scan barcode gun or tap items from catalog.
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="p-2.5 rounded-xl bg-black/50 border border-white/5 hover:border-[#D4AF37]/20 flex items-center justify-between gap-2.5 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-semibold text-white truncate leading-tight">
                      {item.product.name}
                    </h5>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-400">
                      <span className="font-mono text-white">₹{item.product.sellingPrice}</span>
                      <span>•</span>
                      <span className="text-[#D4AF37] font-mono text-[10px]">
                        {item.product.netWeight}
                      </span>
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-gray-300"
                      title="Decrease"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-white font-mono">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-gray-300"
                      title="Increase"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Item Total & Trash */}
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div className="text-xs font-bold text-white font-mono min-w-[42px] text-right">
                      ₹{item.quantity * item.product.sellingPrice}
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-white/5 transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Calculation & Payment Area (Fixed Footer in Cart) */}
          <div className="pt-3 border-t border-white/10 space-y-2 shrink-0">
            
            {/* Subtotal & GST Summary */}
            <div className="space-y-1 text-xs text-gray-400">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-white font-mono">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Discount</span>
                <div className="flex items-center gap-1">
                  {[0, 5, 10].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDiscountPercent(d)}
                      className={`px-1.5 py-0.5 text-[10px] rounded font-semibold ${
                        discountPercent === d
                          ? 'bg-[#D4AF37] text-black font-bold'
                          : 'bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      {d}%
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>GST (5% Mithai & Namkeen)</span>
                <span className="font-mono">₹{gstAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Grand Total */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-[#D4AF37]/20 via-[#D4AF37]/10 to-transparent border border-[#D4AF37]/35 flex justify-between items-baseline">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#D4AF37] block">
                  Total Amount Due
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  Round-off included
                </span>
              </div>
              <span className="text-2xl font-black text-white font-mono">
                ₹{grandTotal}
              </span>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => setPaymentMethod('CASH')}
                className={`p-2 rounded-xl border flex flex-col items-center gap-0.5 transition-all ${
                  paymentMethod === 'CASH'
                    ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.2)]'
                    : 'border-white/5 bg-black/40 text-gray-400 hover:text-white'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span className="text-[11px] font-semibold">Cash</span>
              </button>

              <button
                onClick={() => setPaymentMethod('UPI')}
                className={`p-2 rounded-xl border flex flex-col items-center gap-0.5 transition-all ${
                  paymentMethod === 'UPI'
                    ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.2)]'
                    : 'border-white/5 bg-black/40 text-gray-400 hover:text-white'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span className="text-[11px] font-semibold">UPI QR</span>
              </button>

              <button
                onClick={() => setPaymentMethod('CARD')}
                className={`p-2 rounded-xl border flex flex-col items-center gap-0.5 transition-all ${
                  paymentMethod === 'CARD'
                    ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.2)]'
                    : 'border-white/5 bg-black/40 text-gray-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span className="text-[11px] font-semibold">Card</span>
              </button>
            </div>

            {/* Cash Change Calculator */}
            {paymentMethod === 'CASH' && grandTotal > 0 && (
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5">
                <div className="flex gap-1.5">
                  {[100, 200, 500, 2000].map((val) => (
                    <button
                      key={val}
                      onClick={() => setAmountReceived(val.toString())}
                      className="flex-1 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] font-mono text-gray-300"
                    >
                      ₹{val}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Cash Received:</span>
                  <input
                    type="number"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    placeholder={`₹${grandTotal}`}
                    className="w-24 text-right py-1 px-2 text-xs bg-black/60 border border-[#D4AF37]/30 rounded font-mono text-white"
                  />
                </div>
                {receivedNum >= grandTotal && (
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
                    <span>Return Change:</span>
                    <span className="font-mono">₹{changeGiven.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="w-full btn-gold py-3 text-xs sm:text-sm font-bold tracking-wide flex items-center justify-center gap-2 shadow-[0_4px_25px_rgba(212,175,55,0.3)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="w-5 h-5 stroke-[2.5]" />
              <span>Complete & Print Bill (₹{grandTotal})</span>
            </button>

          </div>

        </div>

      </div>

      {/* Camera Barcode Modal */}
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
            triggerScanFeedback(`Barcode "${code}" scanned but not found in stock.`);
          }
        }}
      />

      {/* Completed Thermal Receipt Modal */}
      <ReceiptModal
        order={completedOrder}
        onClose={() => setCompletedOrder(null)}
      />

    </div>
  );
};
