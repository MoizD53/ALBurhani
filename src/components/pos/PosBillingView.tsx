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
  Tag
} from 'lucide-react';
import { Product, CartItem, OrderBill, PaymentMethod, ProductCategory } from '../../types';
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

  // Totals
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-130px)]">
      
      {/* LEFT COLUMN: Catalog & Barcode Bar (8 cols) */}
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4 overflow-hidden">
        
        {/* BARCODE SPEED SCANNER BAR (TENS11 Luxury Gold Accent) */}
        <div className="p-4 rounded-2xl liquid-glass border border-[#D4AF37]/25 relative">
          
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37]">
                Live Barcode Engine
              </span>
              <span className="text-[11px] text-[#B8B8B8] hidden sm:inline">
                (Plug USB Scanner or click Quick-Zap)
              </span>
            </div>

            <button
              onClick={() => setIsCameraOpen(true)}
              className="btn-dark text-xs py-1.5 px-3 flex items-center gap-1.5 hover:border-[#D4AF37]/50"
            >
              <Camera className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Camera Scan</span>
            </button>
          </div>

          {/* Barcode Input Form */}
          <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Barcode className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#D4AF37]" />
              <input
                ref={barcodeInputRef}
                type="text"
                data-barcode-input="true"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan barcode gun or type EAN code (e.g. 890100100101)..."
                className="pl-11 pr-4 py-2.5 text-sm font-mono tracking-wider bg-black/40 border border-[#D4AF37]/30 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
              />
            </div>
            <button
              type="submit"
              className="btn-gold text-xs px-5 py-2.5 shrink-0"
            >
              Scan Add
            </button>
          </form>

          {/* Notification Pill */}
          {scannerNotification && (
            <div className="mt-2.5 py-1.5 px-3 rounded-lg text-xs font-medium bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#E5C158] flex items-center gap-2 animate-fade-in">
              <Zap className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>{scannerNotification}</span>
            </div>
          )}

          {/* Quick-Zap Interactive Tray (For Meetings & Demos!) */}
          <div className="mt-3 pt-2.5 border-t border-white/5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#D4AF37]" /> Demo Quick-Zap Bar (Click to Simulate Scan):
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {products.slice(0, 5).map((p) => (
                <button
                  key={p.id}
                  onClick={() => addProductToCart(p)}
                  className="px-2.5 py-1 rounded-lg bg-black/60 border border-[#D4AF37]/20 hover:border-[#D4AF37] text-left shrink-0 text-xs transition-all hover:scale-[1.02] flex items-center gap-2 group"
                >
                  <Barcode className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#D4AF37]" />
                  <div>
                    <span className="text-white font-medium block text-[11px] leading-tight">
                      {p.name.split(' ')[0]} {p.name.split(' ')[1] || ''}
                    </span>
                    <span className="text-[9px] text-[#D4AF37] font-mono">
                      {p.barcode}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Categories */}
          <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-[#D4AF37] text-black font-semibold shadow-[0_2px_10px_rgba(212,175,55,0.3)]'
                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sweet / namkeen..."
              className="pl-9 pr-3 py-1.5 text-xs bg-black/40 border border-white/10 rounded-xl"
            />
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredProducts.map((p) => {
            const isLow = p.stock <= p.minStock;
            return (
              <div
                key={p.id}
                className="group relative p-3 rounded-2xl liquid-glass border border-white/10 hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between cursor-pointer"
                onClick={() => addProductToCart(p)}
              >
                <div>
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-white/5 text-[#D4AF37] border border-[#D4AF37]/15">
                      {p.category.split(' ')[0]}
                    </span>
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        isLow ? 'bg-red-950 text-red-300' : 'bg-emerald-950/60 text-emerald-400'
                      }`}
                    >
                      {p.stock} in stock
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-white group-hover:text-[#D4AF37] transition-colors leading-snug">
                    {p.name}
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5 font-medium">
                    {p.netWeight} • {p.unit}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-base font-bold text-white">
                      ₹{p.sellingPrice}
                    </span>
                    <div className="text-[10px] font-mono text-gray-500">
                      #{p.barcode.slice(-6)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
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
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* RIGHT COLUMN: Active POS Cart & Billing (4 cols) */}
      <div className="lg:col-span-5 xl:col-span-4 rounded-2xl liquid-glass border border-[#D4AF37]/20 p-5 flex flex-col justify-between overflow-hidden shadow-2xl">
        
        {/* Cart Header */}
        <div className="pb-3 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#D4AF37]" />
            <div>
              <h3 className="font-semibold text-white leading-none">Current Bill</h3>
              <span className="text-[11px] text-gray-400">
                {cart.reduce((c, i) => c + i.quantity, 0)} items added
              </span>
            </div>
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Customer Details (Optional for sweets/namkeen quick checkout) */}
        <div className="py-2.5 border-b border-white/5 grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Customer Name (Optional)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="text-xs py-1.5 px-2.5 bg-black/30 border-white/10 rounded-lg"
          />
          <input
            type="tel"
            placeholder="Phone / WhatsApp"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="text-xs py-1.5 px-2.5 bg-black/30 border-white/10 rounded-lg"
          />
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto py-2 space-y-2 pr-1 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
              <Barcode className="w-12 h-12 text-gray-600 mb-2 stroke-1" />
              <p className="text-sm font-medium text-gray-400">Cart is empty</p>
              <p className="text-xs mt-1">
                Scan product barcode or click items to start billing.
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <h5 className="text-xs font-semibold text-white truncate">
                    {item.product.name}
                  </h5>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                    <span>₹{item.product.sellingPrice}</span>
                    <span>•</span>
                    <span className="text-[#D4AF37] font-mono text-[10px]">
                      {item.product.netWeight}
                    </span>
                  </div>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateQuantity(item.product.id, -1)}
                    className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-300"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-xs font-bold text-white">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.product.id, 1)}
                    className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-300"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Item Total */}
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-white">
                    ₹{item.quantity * item.product.sellingPrice}
                  </div>
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-gray-500 hover:text-red-400 p-0.5"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Calculation & Payment Area */}
        <div className="pt-3 border-t border-white/10 space-y-2.5">
          
          {/* Subtotal & GST Summary */}
          <div className="space-y-1 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="text-white">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Discount</span>
              <div className="flex items-center gap-1">
                {[0, 5, 10].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDiscountPercent(d)}
                    className={`px-1.5 py-0.5 text-[10px] rounded ${
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
              <span>₹{gstAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Grand Total */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-[#D4AF37]/15 to-transparent border border-[#D4AF37]/30 flex justify-between items-baseline">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#D4AF37] block">
                Total Amount Due
              </span>
              <span className="text-[11px] text-gray-400 font-mono">
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
              className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                paymentMethod === 'CASH'
                  ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#D4AF37]'
                  : 'border-white/5 bg-black/40 text-gray-400 hover:text-white'
              }`}
            >
              <Banknote className="w-4 h-4" />
              <span className="text-[11px] font-semibold">Cash</span>
            </button>

            <button
              onClick={() => setPaymentMethod('UPI')}
              className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                paymentMethod === 'UPI'
                  ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#D4AF37]'
                  : 'border-white/5 bg-black/40 text-gray-400 hover:text-white'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span className="text-[11px] font-semibold">UPI QR</span>
            </button>

            <button
              onClick={() => setPaymentMethod('CARD')}
              className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                paymentMethod === 'CARD'
                  ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#D4AF37]'
                  : 'border-white/5 bg-black/40 text-gray-400 hover:text-white'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span className="text-[11px] font-semibold">Card</span>
            </button>
          </div>

          {/* Cash Change Calculator */}
          {paymentMethod === 'CASH' && grandTotal > 0 && (
            <div className="p-2 rounded-xl bg-black/30 border border-white/5 space-y-1.5">
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
                  className="w-24 text-right py-1 px-2 text-xs bg-black/50 border border-white/10 rounded font-mono"
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
            className="w-full btn-gold py-3 text-sm font-bold tracking-wide flex items-center justify-center gap-2 shadow-[0_4px_25px_rgba(212,175,55,0.3)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
            <span>Complete & Print Bill (₹{grandTotal})</span>
          </button>

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
