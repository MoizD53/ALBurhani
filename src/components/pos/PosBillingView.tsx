import React, { useState, useRef, useEffect } from 'react';
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
  X,
  Receipt,
  FileText,
  ReceiptText,
  FlaskConical,
  Sparkles
} from 'lucide-react';
import { Product, CartItem, OrderBill, PaymentMethod, TransactionType } from '../../types';
import { playBeep } from '../../lib/utils';
import { 
  formatPriceWithBasis, 
  formatStock, 
  lookupProduct, 
  buildCartItem, 
  isWeightBasedProduct 
} from '../../lib/pricing';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { QuantitySelectorModal } from './QuantitySelectorModal';
import { MultipleMatchModal } from './MultipleMatchModal';
import { CameraBarcodeScannerModal } from '../barcode/CameraBarcodeScannerModal';
import { ReceiptModal } from './ReceiptModal';

interface PosBillingViewProps {
  products: Product[];
  onCompleteSale: (order: OrderBill) => void;
  onOpenStickerModal: (product: Product) => void;
  initialTransactionType?: TransactionType;
}

export const PosBillingView: React.FC<PosBillingViewProps> = ({
  products,
  onCompleteSale,
  onOpenStickerModal,
  initialTransactionType = 'CUSTOMER_BILL',
}) => {
  // Billing Mode: Formal Customer Bill vs Internal No-Bill Sale
  const [transactionType, setTransactionType] = useState<TransactionType>(initialTransactionType);

  // Safe Scanner Simulation / Test Mode (Dry Run)
  const [isTestMode, setIsTestMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('albhurani_pos_test_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [isTestBenchOpen, setIsTestBenchOpen] = useState<boolean>(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  
  // Modals for quantity & disambiguation
  const [selectedProductForQuantity, setSelectedProductForQuantity] = useState<Product | null>(null);
  const [multipleMatchedProducts, setMultipleMatchedProducts] = useState<Product[]>([]);
  
  // Checkout & Customer State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [completedOrder, setCompletedOrder] = useState<OrderBill | null>(null);
  const [scannerNotification, setScannerNotification] = useState<{ text: string; isError: boolean } | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Mobile Segmented View (Catalog vs Cart)
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Persist test mode state
  useEffect(() => {
    try {
      localStorage.setItem('albhurani_pos_test_mode', String(isTestMode));
    } catch {
      // ignore
    }
  }, [isTestMode]);

  const categories: string[] = [
    'All', 
    'Sweets', 
    'Namkeen & Farsan', 
    'Dry Fruits', 
    'Snacks & Khakhra', 
    'Festive Gift Hampers'
  ];

  // Auto-focus barcode input
  const refocusBarcode = () => {
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 50);
  };

  useEffect(() => {
    refocusBarcode();
  }, []);

  const triggerScanFeedback = (text: string, isError = false) => {
    setScannerNotification({ text, isError });
    setTimeout(() => setScannerNotification(null), 3000);
  };

  // Called when product is chosen to open quantity selector
  const handleInitiateQuantitySelection = (product: Product) => {
    setSelectedProductForQuantity(product);
  };

  // Unified Barcode/SKU lookup function used by:
  // 1. Manual typing in barcode input + Enter
  // 2. Physical USB/Bluetooth HID Barcode Scanner
  // 3. Mobile Camera Barcode Scanner
  // 4. Quick Simulation Test Bench
  const processBarcode = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    const matches = lookupProduct(products, code);

    if (matches.length === 1) {
      handleInitiateQuantitySelection(matches[0]);
      setBarcodeInput('');
    } else if (matches.length > 1) {
      setMultipleMatchedProducts(matches);
      setBarcodeInput('');
    } else {
      playBeep('error');
      triggerScanFeedback(`Product not found for "${code}"`, true);
      refocusBarcode();
    }
  };

  // Physical Barcode Scanner listener (captures rapid HID keyboard sweeps anywhere on POS)
  useBarcodeScanner({
    onScan: (scannedCode) => {
      // Only process when no modal is currently taking user focus
      if (!selectedProductForQuantity && multipleMatchedProducts.length === 0 && !completedOrder) {
        processBarcode(scannedCode);
      }
    },
    enabled: true,
    minChars: 2,
    maxIntervalMs: 60,
  });

  // Manual barcode / SKU input submission (pressing Enter)
  const handleBarcodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    processBarcode(barcodeInput);
  };

  // Adding confirmed item to cart (with automatic quantity merging for repeat scans)
  const handleConfirmQuantity = (product: Product, quantity: number, weightInGrams?: number) => {
    playBeep('scan');

    setCart((prev) => {
      // Find compatible existing item (same product and same discount)
      const existingIdx = prev.findIndex(
        (it) => it.product.id === product.id && it.discountPercent === 0
      );

      if (existingIdx !== -1) {
        // Merge quantities
        const existing = prev[existingIdx];
        const isWeight = isWeightBasedProduct(product);

        let newQty = existing.quantity + quantity;
        let newGrams = isWeight ? ((existing.weightInGrams || 0) + (weightInGrams || Math.round(quantity * 1000))) : undefined;

        const updatedItem = buildCartItem(product, newQty, newGrams, 0);
        triggerScanFeedback(`Updated: ${product.name} (${updatedItem.formattedQuantity})`);

        const next = [...prev];
        next[existingIdx] = updatedItem;
        return next;
      }

      // Add new cart item
      const newItem = buildCartItem(product, quantity, weightInGrams, 0);
      triggerScanFeedback(`Added: ${product.name} (${newItem.formattedQuantity})`);
      return [...prev, newItem];
    });

    refocusBarcode();
  };

  // Cart item adjustments
  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const isWeight = isWeightBasedProduct(item.product);
            if (isWeight) {
              // Adjust by 100 grams for weight items
              const currentGrams = item.weightInGrams || Math.round(item.quantity * 1000);
              const newGrams = currentGrams + (delta > 0 ? 100 : -100);
              if (newGrams <= 0) return null;
              const newKg = newGrams / 1000;
              if (item.product.stock > 0 && newKg > item.product.stock) {
                triggerScanFeedback(`Stock limit (${formatStock(item.product.stock, item.product.unit)}) reached!`, true);
                return item;
              }
              return buildCartItem(item.product, newKg, newGrams, item.discountPercent);
            } else {
              // Adjust by 1 piece
              const newQty = item.quantity + delta;
              if (newQty <= 0) return null;
              if (item.product.stock > 0 && newQty > item.product.stock) {
                triggerScanFeedback(`Stock limit (${item.product.stock} pcs) reached!`, true);
                return item;
              }
              return buildCartItem(item.product, newQty, undefined, item.discountPercent);
            }
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
    refocusBarcode();
  };

  // Financial Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const discountAmount = Math.round(((subtotal * discountPercent) / 100) * 100) / 100;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  // GST applied only for formal CUSTOMER_BILL, zero tax for internal NO_BILL sales
  const gstAmount = transactionType === 'CUSTOMER_BILL' ? Math.round(taxableAmount * 0.05 * 100) / 100 : 0;
  const grandTotal = Math.round(taxableAmount + gstAmount);

  const receivedNum = parseFloat(amountReceived) || grandTotal;
  const changeGiven = Math.max(0, receivedNum - grandTotal);
  const totalCartCount = cart.length;

  // Checkout Handler
  const handleCheckout = async () => {
    if (cart.length === 0 || isCheckingOut) return;

    setIsCheckingOut(true);
    playBeep('success');

    const prefix = isTestMode ? 'SIM' : transactionType === 'CUSTOMER_BILL' ? 'INV' : 'NB';
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const billNumber = `ALB-${prefix}-${randomNum}`;

    const newOrder: OrderBill = {
      id: isTestMode ? `sim-${Date.now()}` : `sale-${Date.now()}`,
      billNumber,
      transactionType,
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
      cashierName: isTestMode ? 'Simulator (Dry Run)' : 'Owner',
      createdAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };

    if (isTestMode) {
      // In TEST MODE: Do NOT call onCompleteSale! Real inventory & financial ledger remain completely untouched.
      setCompletedOrder(newOrder);
      triggerScanFeedback(`🧪 Dry-Run #${billNumber} simulated! Real stock untouched.`);
    } else {
      onCompleteSale(newOrder);

      // Only open thermal receipt popup for customer bills
      if (transactionType === 'CUSTOMER_BILL') {
        setCompletedOrder(newOrder);
      } else {
        triggerScanFeedback(`No-Bill Sale #${billNumber} recorded successfully!`);
      }
    }

    // Reset local billing state
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscountPercent(0);
    setAmountReceived('');
    setIsCheckingOut(false);
    refocusBarcode();
  };

  // Filter products by search query and category
  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      p.category.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#080808] text-[#F5F5F5] select-none">
      
      {/* ─── Mobile Segmented Toggle (< 1024px) ─── */}
      <div className="lg:hidden shrink-0 flex items-center p-2 bg-[#121214] border-b border-white/[0.08] gap-2">
        <button
          onClick={() => setMobileTab('catalog')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === 'catalog'
              ? 'bg-[#D4AF37] text-black shadow-sm'
              : 'text-zinc-400 bg-white/[0.04]'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Catalog ({filteredProducts.length})</span>
        </button>
        <button
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === 'cart'
              ? 'bg-[#D4AF37] text-black shadow-sm'
              : 'text-zinc-400 bg-white/[0.04]'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Bill ({totalCartCount})</span>
          {grandTotal > 0 && (
            <span className="font-mono font-bold text-[11px] bg-black/30 px-1.5 py-0.5 rounded text-white">
              ₹{grandTotal}
            </span>
          )}
        </button>
      </div>

      {/* ─── Prominent Test Mode Active Banner ─── */}
      {isTestMode && (
        <div className="shrink-0 px-3.5 py-2 bg-gradient-to-r from-amber-950/70 via-amber-900/40 to-amber-950/70 border-b border-amber-500/40 flex items-center justify-between text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-bold text-amber-300 tracking-wide flex items-center gap-1.5 uppercase text-[11px]">
              <FlaskConical className="w-3.5 h-3.5" />
              Scanner Simulation & Dry-Run Test Active
            </span>
            <span className="hidden md:inline text-amber-200/80 text-[11px]">
              — Scans, KG/PCS quantity prompts, and cart calculations are live. Real stock and accounting ledgers will NOT be modified.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-mono font-bold">
              SAFE DRY RUN
            </span>
            <button
              type="button"
              onClick={() => {
                setIsTestMode(false);
                refocusBarcode();
              }}
              className="text-[11px] font-semibold text-amber-300 hover:text-white underline underline-offset-2 ml-1"
            >
              Exit Test Mode
            </button>
          </div>
        </div>
      )}

      {/* ─── Main Two-Panel Workspace ─── */}
      <div className="flex-1 min-h-0 flex gap-3 sm:gap-3.5 p-2 sm:p-3 lg:p-3.5 overflow-hidden">
        
        {/* ══════════════════════════════════════════
            LEFT PANEL: SCANNER & PRODUCT CATALOGUE
           ══════════════════════════════════════════ */}
        <div className={`flex-1 min-w-0 flex flex-col min-h-0 gap-2.5 ${
          mobileTab === 'cart' ? 'hidden lg:flex' : 'flex'
        }`}>
          
          {/* 1. Elegant Barcode Input & Scanner Status */}
          <div className="shrink-0 p-2 sm:p-2.5 rounded-xl bg-[#121214] border border-white/[0.08] shadow-sm">
            <div className="flex items-center gap-2">
              
              <form onSubmit={handleBarcodeSubmit} className="flex-1 min-w-0 flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    data-barcode-input="true"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    style={{ paddingLeft: '38px' }}
                    className="w-full pr-8 py-2 text-xs sm:text-sm font-mono bg-black/60 border border-white/[0.1] rounded-xl text-white placeholder:text-zinc-500 focus:border-[#D4AF37]/70 focus:bg-black focus:outline-none transition-colors"
                    autoFocus
                  />
                  {barcodeInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setBarcodeInput('');
                        refocusBarcode();
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Camera Scan Trigger */}
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/[0.08] transition-colors shrink-0"
                  title="Scan using Camera"
                >
                  <Camera className="w-4 h-4" />
                </button>

                {/* Test Mode / Simulation Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    setIsTestMode((prev) => !prev);
                    refocusBarcode();
                  }}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                    isTestMode
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                      : 'bg-white/[0.04] text-zinc-400 hover:text-white border-white/[0.08]'
                  }`}
                  title="Toggle Safe Scanner Simulation & Dry-Run Mode"
                >
                  <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">{isTestMode ? 'Dry Run' : 'Test Mode'}</span>
                </button>
              </form>

              {/* Discreet Scanner Status & Scan Feedback */}
              <div className="shrink-0 flex items-center gap-1.5 px-2 text-xs">
                {scannerNotification ? (
                  <div className={`flex items-center gap-1.5 font-medium animate-fade-in ${
                    scannerNotification.isError ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    <span className="truncate max-w-[200px]">{scannerNotification.text}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    <span className="hidden sm:inline">Scanner Ready</span>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* 1.1 Hardware Scanner Simulation Tray (Quick Barcode Test Bench) */}
          <div className="shrink-0 p-2 sm:p-2.5 rounded-xl bg-[#121214] border border-white/[0.07] space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="font-semibold text-zinc-200">Hardware Scanner Simulation Bench:</span>
                <span className="text-zinc-500 hidden md:inline">Click sample barcode to simulate HID scanner scan + Enter</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">HID Emulation</span>
                <button
                  type="button"
                  onClick={() => setIsTestBenchOpen(!isTestBenchOpen)}
                  className="text-[11px] text-[#D4AF37] hover:underline"
                >
                  {isTestBenchOpen ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {isTestBenchOpen && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar pt-0.5">
                {[
                  { label: 'KG Weight 1', code: '80548406576', name: 'BHUKHO B', rate: '₹100/kg', type: 'Weight' },
                  { label: 'KG Weight 2', code: '67225776696', name: 'RATLAMI SEV', rate: '₹320/kg', type: 'Weight' },
                  { label: 'PCS Item', code: '8908012355526', name: 'DCUBE MAKAI', rate: '₹10/pc', type: 'Count' },
                  { label: 'Leading Zero', code: '0001', name: 'KAJU KATLI 250G', rate: '₹275/pc', type: 'Leading 0' },
                  { label: 'Generated Label', code: '890100801001', name: 'KHAJOOR ROLL', rate: '₹1200/kg', type: 'Sticker' },
                ].map((sample) => (
                  <button
                    key={sample.code}
                    type="button"
                    onClick={() => processBarcode(sample.code)}
                    className="px-2.5 py-1.5 rounded-lg bg-black/60 hover:bg-[#D4AF37]/15 border border-white/[0.08] hover:border-[#D4AF37]/50 text-left shrink-0 transition-all group shadow-sm"
                    title={`Click to simulate hardware scan of ${sample.name} (${sample.code})`}
                  >
                    <div className="flex items-center gap-1 text-[11px] text-zinc-300 group-hover:text-[#D4AF37]">
                      <span className="font-semibold">{sample.name}</span>
                      <span className="font-mono text-[10px] text-zinc-500 group-hover:text-zinc-400">[{sample.code}]</span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-zinc-500 font-mono mt-0.5">
                      <span>{sample.rate}</span>
                      <span className="text-[#D4AF37]/80 font-sans ml-2">{sample.type}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Search & Category Filters Hub */}
          <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            
            {/* Search Input */}
            <div className="relative w-full sm:w-56 shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '32px' }}
                className="w-full pr-7 py-1.5 text-xs bg-[#111115] border border-white/[0.08] rounded-xl text-white placeholder:text-zinc-500 focus:border-[#D4AF37]/50 focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
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
                        : 'bg-white/[0.03] text-zinc-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.06]'
                    }`}
                  >
                    {shortLabel}
                  </button>
                );
              })}
            </div>

          </div>

          {/* 3. Product Grid (Clean luxury cards with uniform heights) */}
          <div className="flex-1 overflow-y-auto min-h-0 pr-1 custom-scrollbar">
            {filteredProducts.length === 0 ? (
              <div className="h-60 flex flex-col items-center justify-center text-center p-6 bg-white/[0.01] rounded-2xl border border-white/[0.04]">
                <Search className="w-8 h-8 text-zinc-600 mb-2 stroke-1" />
                <p className="text-sm font-semibold text-zinc-300">No matching products found</p>
                <p className="text-xs text-zinc-500 mt-0.5">Try searching with product name, SKU or barcode</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                {filteredProducts.map((p) => {
                  const inCartItem = cart.find((i) => i.product.id === p.id);

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleInitiateQuantitySelection(p)}
                      className={`group relative flex flex-col justify-between rounded-xl border p-2.5 transition-all duration-150 select-none bg-[#121214] border-white/[0.07] hover:border-[#D4AF37]/50 hover:bg-[#161619] cursor-pointer shadow-sm ${
                        inCartItem ? 'border-[#D4AF37]/50 bg-[#161619] ring-1 ring-[#D4AF37]/20' : ''
                      }`}
                    >
                      {/* In-cart indicator badge */}
                      {inCartItem && (
                        <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-md bg-[#D4AF37] text-black text-[10px] font-black shadow-md">
                          {inCartItem.formattedQuantity}
                        </div>
                      )}

                      <div>
                        {/* Top: Category & Unit Indicator */}
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold truncate">
                            {p.category.split(' ')[0]}
                          </span>
                          <span className="text-[10px] font-medium text-[#D4AF37]/80 bg-[#D4AF37]/10 px-1.5 py-0.2 rounded shrink-0">
                            {p.unit === 'KG' ? 'Weight' : 'Piece'}
                          </span>
                        </div>

                        {/* Title */}
                        <h4 className="text-xs sm:text-[13px] font-semibold text-white leading-snug line-clamp-2 h-9 group-hover:text-[#E5C158] transition-colors">
                          {p.name}
                        </h4>

                        {/* SKU & Barcode subtitle */}
                        <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono mt-0.5">
                          <span>{p.sku}</span>
                          <span>•</span>
                          <span>{isWeightBasedProduct(p) ? 'Per KG' : 'Per Piece'}</span>
                        </div>
                      </div>

                      {/* Bottom Row: Price Basis & Action */}
                      <div className="mt-2 pt-1.5 border-t border-white/[0.06] flex items-center justify-between gap-1">
                        <div>
                          <span className="text-xs sm:text-sm font-bold font-mono text-white leading-none">
                            {formatPriceWithBasis(p.sellingPrice, p.unit)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            title="Generate Thermal Barcode Sticker"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenStickerModal(p);
                            }}
                            className="p-1 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
                          >
                            <Tag className="w-3.5 h-3.5" />
                          </button>
                          
                          <div className="p-1 rounded-lg bg-[#D4AF37]/15 text-[#D4AF37] group-hover:bg-[#D4AF37] group-hover:text-black transition-colors">
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

          {/* Mobile Bottom Bar for Cart Navigation */}
          {cart.length > 0 && (
            <div className="lg:hidden shrink-0 pt-1">
              <button
                onClick={() => setMobileTab('cart')}
                className="w-full btn-gold py-2.5 px-4 rounded-xl flex items-center justify-between shadow-lg"
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  <span className="font-bold text-xs">{totalCartCount} item(s) in bill</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono font-bold text-xs">
                  <span>₹{grandTotal}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            </div>
          )}

        </div>

        {/* ══════════════════════════════════════════
            RIGHT PANEL: STRUCTURED CHECKOUT WORKSPACE
           ══════════════════════════════════════════ */}
        <div className={`
          w-full lg:w-[380px] xl:w-[410px] shrink-0 flex flex-col min-h-0
          bg-[#121214] rounded-2xl border border-white/[0.08] shadow-xl overflow-hidden
          ${mobileTab === 'catalog' ? 'hidden lg:flex' : 'flex'}
        `}>
          
          {/* Bill Mode Tabs: "With Bill" vs "No Bill" (2 clean headings) */}
          <div className="p-2 sm:p-2.5 border-b border-white/[0.08] bg-[#161619] shrink-0">
            <div className="flex items-center gap-2">
              <div className="grid grid-cols-2 flex-1 p-0.5 bg-black/60 rounded-xl border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setTransactionType('CUSTOMER_BILL')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 transition-all ${
                    transactionType === 'CUSTOMER_BILL'
                      ? 'bg-[#D4AF37] text-black shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>With Bill</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTransactionType('NO_BILL')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 transition-all ${
                    transactionType === 'NO_BILL'
                      ? 'bg-[#D4AF37] text-black shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <ReceiptText className="w-3.5 h-3.5" />
                  <span>No Bill</span>
                </button>
              </div>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="px-2.5 py-2 text-xs font-medium text-zinc-400 hover:text-red-400 bg-white/[0.04] hover:bg-red-500/10 border border-white/[0.08] hover:border-red-500/30 rounded-xl transition-all shrink-0"
                  title="Clear all cart items"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Customer Details Inputs (only for Customer Bill) */}
          {transactionType === 'CUSTOMER_BILL' && (
            <div className="px-3 py-1.5 border-b border-white/[0.05] bg-white/[0.015] grid grid-cols-2 gap-2 shrink-0">
              <input
                type="text"
                placeholder="Customer Name (optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="text-xs py-1 px-2 bg-black/40 border border-white/[0.07] rounded-lg text-white placeholder:text-zinc-600 focus:border-[#D4AF37]/50 focus:outline-none"
              />
              <input
                type="tel"
                placeholder="Phone (optional)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="text-xs py-1 px-2 bg-black/40 border border-white/[0.07] rounded-lg text-white font-mono placeholder:text-zinc-600 focus:border-[#D4AF37]/50 focus:outline-none"
              />
            </div>
          )}

          {/* Cart Items List */}
          <div className="flex-1 min-h-[140px] overflow-y-auto px-3 py-2 space-y-1.5 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                <Barcode className="w-9 h-9 text-zinc-700 mb-2 stroke-1" />
                <p className="text-xs font-semibold text-zinc-400">Cart is empty</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">
                  Scan barcode with gun or click products to bill
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.025] hover:bg-white/[0.04] border border-white/[0.04] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-semibold text-white truncate leading-tight">
                      {item.product.name}
                    </h5>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-zinc-400 font-mono">
                      <span>{item.formattedRate}</span>
                      <span>·</span>
                      <span className="text-[#D4AF37] font-semibold">{item.formattedQuantity}</span>
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1 shrink-0 bg-black/40 border border-white/[0.08] rounded-lg p-0.5">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="w-5 h-5 rounded bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white flex items-center justify-center transition-colors"
                      title="Decrease quantity"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-12 text-center text-[11px] font-bold text-white font-mono truncate px-0.5">
                      {item.formattedQuantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="w-5 h-5 rounded bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white flex items-center justify-center transition-colors"
                      title="Increase quantity"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Line Total & Remove */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-bold text-white font-mono w-14 text-right">
                      ₹{item.lineTotal.toFixed(2)}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-zinc-600 hover:text-red-400 transition-colors p-1 rounded"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Anchored Financial Summary & Checkout */}
          <div className="shrink-0 border-t border-white/[0.08] p-3 space-y-2.5 bg-[#161619]">
            
            {/* Subtotal & Discount & Tax */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal ({totalCartCount} items)</span>
                <span className="font-mono text-zinc-200">₹{subtotal.toFixed(2)}</span>
              </div>

              {/* Discount selection */}
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Discount</span>
                <div className="flex items-center gap-1">
                  {[0, 5, 10].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDiscountPercent(d)}
                      className={`px-2 py-0.5 text-[10px] rounded font-semibold transition-colors ${
                        discountPercent === d
                          ? 'bg-[#D4AF37] text-black font-bold'
                          : 'bg-white/[0.04] text-zinc-400 hover:text-white'
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

              {transactionType === 'CUSTOMER_BILL' && (
                <div className="flex justify-between text-zinc-500 text-[11px]">
                  <span>GST (CGST 2.5% + SGST 2.5%)</span>
                  <span className="font-mono">₹{gstAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Total Due Display */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.07]">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-bold block">
                  Total Payable
                </span>
                <span className="text-[10px] text-zinc-500">
                  {transactionType === 'CUSTOMER_BILL' ? 'incl. taxes & rounding' : 'no-bill cash transaction'}
                </span>
              </div>
              <span className="text-2xl font-black text-white font-mono tracking-tight">
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
                    type="button"
                    onClick={() => setPaymentMethod(key as PaymentMethod)}
                    className={`py-1.5 px-2 rounded-lg border flex flex-col items-center gap-0.5 transition-all text-xs font-semibold ${
                      isSelected
                        ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#D4AF37]'
                        : 'border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-[10px]">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Cash Tender Calculation */}
            {paymentMethod === 'CASH' && grandTotal > 0 && (
              <div className="p-2 rounded-lg bg-black/40 border border-white/[0.06] space-y-1.5">
                <div className="flex gap-1">
                  {[100, 200, 500, 2000].map((val) => (
                    <button
                      key={val}
                      onClick={() => setAmountReceived(val.toString())}
                      className="flex-1 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-[10px] font-mono text-zinc-400 hover:text-white transition-colors"
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
                  <span className="text-zinc-400">Cash Received:</span>
                  <input
                    type="number"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    placeholder={`₹${grandTotal}`}
                    className="w-24 text-right py-1 px-2 text-xs bg-black border border-white/[0.1] rounded font-mono text-white focus:border-[#D4AF37]/60 focus:outline-none"
                  />
                </div>

                {receivedNum >= grandTotal && amountReceived && (
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-400 pt-1 border-t border-white/[0.05]">
                    <span>Change to Return:</span>
                    <span className="font-mono text-sm">₹{changeGiven.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Checkout Action Button */}
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || isCheckingOut}
              className={`w-full py-2.5 text-xs font-bold tracking-wide flex items-center justify-center gap-2 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all ${
                isTestMode
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-[0_4px_16px_rgba(245,158,11,0.25)] hover:brightness-110'
                  : 'btn-gold shadow-[0_4px_16px_rgba(212,175,55,0.2)]'
              }`}
            >
              {isTestMode ? (
                <>
                  <FlaskConical className="w-4 h-4" />
                  <span>
                    {isCheckingOut 
                      ? 'Simulating...' 
                      : `Simulate Checkout (Dry Run — ₹${grandTotal})`}
                  </span>
                </>
              ) : (
                <>
                  <Receipt className="w-4 h-4" />
                  <span>
                    {isCheckingOut 
                      ? 'Processing Sale...' 
                      : transactionType === 'CUSTOMER_BILL' 
                        ? `Complete Sale (With Bill — ₹${grandTotal})` 
                        : `Complete Sale (No Bill — ₹${grandTotal})`}
                  </span>
                </>
              )}
            </button>

          </div>

        </div>

      </div>

      {/* ─── Scan-Time Quantity Selector Modal ─── */}
      <QuantitySelectorModal
        product={selectedProductForQuantity}
        isOpen={Boolean(selectedProductForQuantity)}
        onClose={() => {
          setSelectedProductForQuantity(null);
          refocusBarcode();
        }}
        onConfirm={handleConfirmQuantity}
        existingCartQuantity={
          selectedProductForQuantity
            ? cart
                .filter((i) => i.product.id === selectedProductForQuantity.id)
                .reduce((sum, i) => sum + i.quantity, 0)
            : 0
        }
      />

      {/* ─── Disambiguation Multiple Match Modal ─── */}
      <MultipleMatchModal
        products={multipleMatchedProducts}
        isOpen={multipleMatchedProducts.length > 0}
        onClose={() => {
          setMultipleMatchedProducts([]);
          refocusBarcode();
        }}
        onSelectProduct={(p) => {
          setMultipleMatchedProducts([]);
          handleInitiateQuantitySelection(p);
        }}
      />

      {/* ─── Camera Barcode Scanner Modal ─── */}
      <CameraBarcodeScannerModal
        isOpen={isCameraOpen}
        onClose={() => {
          setIsCameraOpen(false);
          refocusBarcode();
        }}
        onScanSuccess={(code: string) => {
          setIsCameraOpen(false);
          processBarcode(code);
        }}
      />

      {/* ─── Thermal Receipt Modal ─── */}
      <ReceiptModal
        order={completedOrder}
        isTestMode={isTestMode}
        onClose={() => {
          setCompletedOrder(null);
          refocusBarcode();
        }}
      />

    </div>
  );
};
