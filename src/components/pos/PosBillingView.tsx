import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Product, CartItem, OrderBill, PaymentMethod, TransactionType, CompleteSaleResult } from '../../types';
import { playBeep } from '../../lib/utils';
import { 
  formatPriceWithBasis, 
  formatStock, 
  lookupProduct, 
  buildCartItem, 
  isWeightBasedProduct,
  calculateOrderTotals
} from '../../lib/pricing';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { QuantitySelectorModal } from './QuantitySelectorModal';
import { MultipleMatchModal } from './MultipleMatchModal';
import { CameraBarcodeScannerModal } from '../barcode/CameraBarcodeScannerModal';
import { ReceiptModal } from './ReceiptModal';
import { getSavedCustomers } from '../../lib/customers';

interface PosBillingViewProps {
  products: Product[];
  onCompleteSale: (order: OrderBill) => Promise<CompleteSaleResult | void> | CompleteSaleResult | void;
  onOpenStickerModal: (product: Product) => void;
  initialTransactionType?: TransactionType;
  editingOrder?: OrderBill | null;
  onCancelEditOrder?: () => void;
  onSaveModifiedOrder?: (updatedOrder: OrderBill, originalOrder: OrderBill) => Promise<CompleteSaleResult | void> | CompleteSaleResult | void;
}

export const PosBillingView: React.FC<PosBillingViewProps> = ({
  products,
  onCompleteSale,
  onOpenStickerModal,
  initialTransactionType = 'CUSTOMER_BILL',
  editingOrder = null,
  onCancelEditOrder,
  onSaveModifiedOrder,
}) => {
  // Billing Mode: Formal Customer Bill vs Internal No-Bill Sale
  const [transactionType, setTransactionType] = useState<TransactionType>(
    editingOrder?.transactionType || initialTransactionType
  );

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
  const isSubmittingRef = useRef<boolean>(false);
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  // Right Checkout Panel Scrolling
  const rightPanelScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);

  const checkRightPanelScroll = () => {
    const el = rightPanelScrollRef.current;
    if (!el) return;
    const isScrollable = el.scrollHeight > el.clientHeight + 10;
    const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 25;
    const isAtTop = el.scrollTop <= 10;
    setCanScrollDown(isScrollable && !isAtBottom);
    setCanScrollUp(isScrollable && !isAtTop);
  };

  const handleScrollDown = () => {
    rightPanelScrollRef.current?.scrollBy({ top: 200, behavior: 'smooth' });
  };

  const handleScrollUp = () => {
    rightPanelScrollRef.current?.scrollBy({ top: -200, behavior: 'smooth' });
  };

  const handleScrollToBottom = () => {
    if (rightPanelScrollRef.current) {
      rightPanelScrollRef.current.scrollTo({ top: rightPanelScrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    checkRightPanelScroll();
    window.addEventListener('resize', checkRightPanelScroll);
    return () => window.removeEventListener('resize', checkRightPanelScroll);
  }, [cart.length, paymentMethod, editingOrder, transactionType]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    const primaryOrder = [
      'SNACKS',
      'FARSAAN MIX',
      'SWEETS',
      'BAKERY',
      'PURI',
      'ROASTED',
      'CHIPS',
      'KHARAS',
      'ACHAR',
      'CHATNI',
      'PAPAD',
      'MUKHWAS',
      'MAWA',
      'PAAK',
      'PARA',
      'TOAST',
      'PANIPURI PANI FLAVOUR',
    ];
    const ordered = primaryOrder.filter((c) => set.has(c));
    const others = Array.from(set).filter((c) => !primaryOrder.includes(c)).sort();
    return ['All', ...ordered, ...others];
  }, [products]);

  // Auto-focus barcode input without stealing focus from active cashier form editing
  const refocusBarcode = () => {
    setTimeout(() => {
      // Never steal focus from active text inputs (search, customer details, payment amounts, etc.)
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable) &&
        activeEl.getAttribute('data-barcode-input') !== 'true'
      ) {
        return; // Cashier is actively editing another form field
      }

      if (!selectedProductForQuantity && multipleMatchedProducts.length === 0 && !completedOrder && !isCameraOpen) {
        barcodeInputRef.current?.focus();
      }
    }, 50);
  };

  useEffect(() => {
    refocusBarcode();
  }, []);

  // Restore focus when window regains focus
  useEffect(() => {
    const handleWindowFocus = () => {
      refocusBarcode();
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [selectedProductForQuantity, multipleMatchedProducts.length, completedOrder, isCameraOpen]);

  // Synchronize cart and customer inputs whenever an order is reopened for modification
  useEffect(() => {
    if (editingOrder) {
      setCart([...editingOrder.items]);
      setTransactionType(editingOrder.transactionType || 'CUSTOMER_BILL');
      setCustomerName(editingOrder.customerName || '');
      setCustomerPhone(editingOrder.customerPhone || '');
      const calcDiscount = editingOrder.subtotal > 0 && editingOrder.discountAmount > 0
        ? Math.round((editingOrder.discountAmount / editingOrder.subtotal) * 100)
        : 0;
      setDiscountPercent(calcDiscount);
      setPaymentMethod(editingOrder.additionalPaymentMethod || editingOrder.paymentMethod || 'CASH');
      setAmountReceived('');
    }
  }, [editingOrder]);

  // Refocus on background click if not clicking on interactive elements or modals
  const handleBackgroundClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button, input, select, textarea, a, [role="dialog"], [role="menu"]');
    if (!isInteractive && !selectedProductForQuantity && multipleMatchedProducts.length === 0 && !completedOrder && !isCameraOpen) {
      barcodeInputRef.current?.focus();
    }
  };

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
  // 2. Physical USB/Bluetooth HID Barcode Scanner (keyboard-wedge)
  // 3. Mobile Camera Barcode Scanner
  const processBarcode = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    // Prevent duplicate scan within 400ms window for identical barcode
    const now = Date.now();
    if (lastScanRef.current.code === code && (now - lastScanRef.current.time) < 400) {
      return;
    }
    lastScanRef.current = { code, time: now };

    const matches = lookupProduct(products, code);

    if (matches.length === 1) {
      const matched = matches[0];
      setBarcodeInput('');
      // Auto-add unique product directly to cart (1 unit / increment) without requiring Enter or modal click
      handleConfirmQuantity(matched, 1);
    } else if (matches.length > 1) {
      setMultipleMatchedProducts(matches);
      setBarcodeInput('');
    } else {
      playBeep('error');
      triggerScanFeedback(`Product not found for "${code}"`, true);
      setBarcodeInput('');
      refocusBarcode();
    }
  };

  // Physical Barcode Scanner listener (captures rapid HID keyboard sweeps anywhere on POS)
  useBarcodeScanner({
    onScan: (scannedCode) => {
      // Only process when no modal is currently taking user focus
      if (!selectedProductForQuantity && multipleMatchedProducts.length === 0 && !completedOrder && !isCameraOpen) {
        processBarcode(scannedCode);
      }
    },
    enabled: true,
    minChars: 2,
    maxIntervalMs: 120,
    noSuffixTimeoutMs: 130,
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

  // Financial Calculations using shared GST-inclusive pricing logic
  const {
    subtotal,
    discountAmount,
    taxableAmount,
    gstAmount,
    grandTotal,
  } = calculateOrderTotals(cart, discountPercent, transactionType);

  const receivedNum = parseFloat(amountReceived) || grandTotal;
  const changeGiven = Math.max(0, receivedNum - grandTotal);
  const totalCartCount = cart.length;

  // Checkout Handler
  const handleCheckout = async () => {
    if (cart.length === 0 || isCheckingOut || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setIsCheckingOut(true);

    try {
      if (editingOrder) {
        const originalPaid = editingOrder.originalGrandTotal ?? editingOrder.grandTotal;
        const additionalDue = Math.max(0, grandTotal - originalPaid);

        const revisedOrder: OrderBill = {
          ...editingOrder,
          transactionType,
          items: [...cart],
          subtotal,
          discountAmount,
          gstAmount,
          grandTotal,
          isRevised: true,
          originalGrandTotal: originalPaid,
          additionalAmountPaid: additionalDue,
          originalPaymentMethod: editingOrder.originalPaymentMethod || editingOrder.paymentMethod,
          additionalPaymentMethod: additionalDue > 0 ? paymentMethod : undefined,
          amountReceived: originalPaid + (paymentMethod === 'CASH' ? (parseFloat(amountReceived) || additionalDue) : additionalDue),
          changeGiven: paymentMethod === 'CASH' && parseFloat(amountReceived) > additionalDue ? parseFloat(amountReceived) - additionalDue : 0,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          revisedAt: new Date().toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          }),
          revisedTimestamp: Date.now(),
          revisionCount: (editingOrder.revisionCount || 0) + 1,
        };

        if (onSaveModifiedOrder) {
          const result = await onSaveModifiedOrder(revisedOrder, editingOrder);
          if (result && result.success === false) {
            playBeep('error');
            triggerScanFeedback(`❌ Could not save revised bill: ${result.error || 'Persistence failed'}`);
            return;
          }
        }

        playBeep('success');
        setCompletedOrder(revisedOrder);

        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        setDiscountPercent(0);
        setAmountReceived('');
        if (onCancelEditOrder) {
          onCancelEditOrder();
        }
        refocusBarcode();
        return;
      }

      const prefix = transactionType === 'CUSTOMER_BILL' ? 'INV' : 'NB';
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const billNumber = `ALB-${prefix}-${randomNum}`;
      const timestamp = Date.now();

      const newOrder: OrderBill = {
        id: `sale-${timestamp}-${randomNum}`,
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
        cashierName: 'Owner',
        createdAt: new Date(timestamp).toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
        timestamp,
      };

      const result = await onCompleteSale(newOrder);
      if (result && result.success === false) {
        playBeep('error');
        triggerScanFeedback(`❌ Could not save sale: ${result.error || 'Persistence failed'}`);
        return;
      }

      playBeep('success');

      // Present the optional receipt choice modal (Print, WhatsApp PDF, or No Receipt)
      setCompletedOrder(newOrder);

      // Reset local billing state ONLY after successful save
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setDiscountPercent(0);
      setAmountReceived('');
      refocusBarcode();
    } catch (err: any) {
      playBeep('error');
      triggerScanFeedback(`❌ Checkout error: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsCheckingOut(false);
      isSubmittingRef.current = false;
    }
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
    <div onClick={handleBackgroundClick} className="flex flex-col h-full w-full overflow-hidden bg-[#FAF8F5] text-[#1C1917] select-none">
      
      {/* ─── Bill Modification Active Banner ─── */}
      {editingOrder && (
        <div className="shrink-0 bg-amber-500/15 border-b border-amber-500/30 px-3 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 font-bold font-mono shrink-0">
              EDITING BILL {editingOrder.billNumber}
            </span>
            <span className="text-stone-700 truncate text-[11px]">
              Customer: <strong>{editingOrder.customerName || 'Walk-in'}</strong> · Original: <strong>Rs. {(editingOrder.originalGrandTotal ?? editingOrder.grandTotal).toFixed(2)}</strong>
            </span>
          </div>
          {onCancelEditOrder && (
            <button
              type="button"
              onClick={onCancelEditOrder}
              className="px-2 py-1 rounded-lg bg-white hover:bg-stone-100 text-stone-700 hover:text-stone-900 text-[11px] font-semibold flex items-center gap-1 transition-colors shrink-0 shadow-sm border border-[#E8DEC8]"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel / Discard</span>
            </button>
          )}
        </div>
      )}

      {/* ─── Mobile Segmented Toggle (< 1024px) ─── */}
      <div className="lg:hidden shrink-0 flex items-center p-2 bg-white border-b border-[#E8DEC8] gap-2 shadow-sm">
        <button
          onClick={() => setMobileTab('catalog')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === 'catalog'
              ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-sm'
              : 'text-stone-600 bg-[#FAF8F5] border border-[#E8DEC8]'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Catalog ({filteredProducts.length})</span>
        </button>
        <button
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === 'cart'
              ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-sm'
              : 'text-stone-600 bg-[#FAF8F5] border border-[#E8DEC8]'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Bill ({totalCartCount})</span>
          {grandTotal > 0 && (
            <span className="font-mono font-bold text-[11px] bg-stone-100 px-1.5 py-0.5 rounded text-[#B8860B]">
              Rs. {grandTotal}
            </span>
          )}
        </button>
      </div>

      {/* ─── Main Two-Panel Workspace ─── */}
      <div className="flex-1 min-h-0 flex gap-3 sm:gap-3.5 p-2 sm:p-3 lg:p-3.5 overflow-hidden">
        
        {/* ══════════════════════════════════════════
            LEFT PANEL: SCANNER & PRODUCT CATALOGUE
           ══════════════════════════════════════════ */}
        <div className={`flex-1 min-w-0 flex flex-col min-h-0 gap-2.5 ${
          mobileTab === 'cart' ? 'hidden lg:flex' : 'flex'
        }`}>
          
          {/* 1. Barcode Input & Scanner Status */}
          <div className="shrink-0 p-2 sm:p-2.5 rounded-xl bg-white border border-[#E8DEC8] shadow-sm">
            <div className="flex items-center gap-2">
              
              <form onSubmit={handleBarcodeSubmit} className="flex-1 min-w-0 flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <Barcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    data-barcode-input="true"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Tab' && barcodeInput.trim()) {
                        e.preventDefault();
                        processBarcode(barcodeInput);
                      }
                    }}
                    style={{ paddingLeft: '38px' }}
                    className="w-full pr-8 py-2 text-xs sm:text-sm font-mono bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-[#1C1917] placeholder:text-stone-400 focus:border-[#C99A18] focus:bg-white focus:outline-none transition-colors shadow-sm"
                    placeholder="Scan barcode or enter SKU..."
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.preventDefault();
                }}
                style={{ paddingLeft: '34px' }}
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
              {categories.map((cat: string) => {
                const isSelected = selectedCategory === cat;
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
                    {cat}
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
                      className={`group relative flex flex-col justify-between rounded-xl border p-2.5 transition-all duration-150 select-none bg-white border-[#E8DEC8] hover:border-[#C99A18] hover:bg-[#FAF8F5] cursor-pointer shadow-sm ${
                        inCartItem ? 'border-[#C99A18] bg-[#FDFBF7] ring-1 ring-[#C99A18]/30' : ''
                      }`}
                    >
                      {/* In-cart indicator badge */}
                      {inCartItem && (
                        <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white text-[10px] font-black shadow-md">
                          {inCartItem.formattedQuantity}
                        </div>
                      )}

                      <div>
                        {/* Top: Category & Unit Indicator */}
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] text-stone-500 uppercase tracking-wider font-bold truncate">
                            {p.category.split(' ')[0]}
                          </span>
                          <span className="text-[10px] font-bold text-[#A67D0C] bg-[#FAF8F5] border border-[#E8DEC8] px-1.5 py-0.2 rounded shrink-0">
                            {p.unit === 'KG' ? 'Weight' : 'Piece'}
                          </span>
                        </div>

                        {/* Title */}
                        <h4 className="text-xs sm:text-[13px] font-bold text-[#1C1917] leading-snug line-clamp-2 h-9 group-hover:text-[#A67D0C] transition-colors">
                          {p.name}
                        </h4>

                        {/* SKU & Barcode subtitle */}
                        <div className="flex items-center gap-1 text-[10px] text-stone-500 font-mono mt-0.5">
                          <span>{p.sku}</span>
                          <span>•</span>
                          <span>{isWeightBasedProduct(p) ? 'Per KG' : 'Per Piece'}</span>
                        </div>
                      </div>

                      {/* Bottom Row: Price Basis & Action */}
                      <div className="mt-2 pt-1.5 border-t border-[#F0EBE0] flex items-center justify-between gap-1">
                        <div>
                          <span className="text-xs sm:text-sm font-bold font-mono text-[#B8860B] leading-none">
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
                  <span>Rs. {grandTotal}</span>
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
          bg-white rounded-2xl border border-[#E8DEC8] shadow-sm overflow-hidden
          ${mobileTab === 'catalog' ? 'hidden lg:flex' : 'flex'}
        `}>
          
          {/* Bill Mode Tabs: "With GST" vs "Without GST" (2 clean headings) */}
          <div className="p-2 sm:p-2.5 border-b border-[#E8DEC8] bg-[#FAF8F5] shrink-0">
            <div className="flex items-center gap-2">
              <div className="grid grid-cols-2 flex-1 p-0.5 bg-white rounded-xl border border-[#E8DEC8] shadow-sm">
                <button
                  type="button"
                  onClick={() => setTransactionType('CUSTOMER_BILL')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 transition-all ${
                    transactionType === 'CUSTOMER_BILL'
                      ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>With GST</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTransactionType('NO_BILL')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 transition-all ${
                    transactionType === 'NO_BILL'
                      ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5]'
                  }`}
                >
                  <ReceiptText className="w-3.5 h-3.5" />
                  <span>Without GST</span>
                </button>
              </div>

              {/* Scroll Controls */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleScrollUp}
                  className="p-1.5 text-stone-500 hover:text-stone-800 bg-[#FAF8F5] hover:bg-stone-100 border border-[#E8DEC8] rounded-lg transition-all"
                  title="Scroll cart up"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleScrollDown}
                  className="p-1.5 text-[#B8860B] hover:text-[#A67D0C] bg-[#FAF8F5] hover:bg-stone-100 border border-[#E8DEC8] rounded-lg transition-all"
                  title="Scroll down to Complete Sale"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="px-2.5 py-1.5 text-xs font-medium text-stone-500 hover:text-rose-600 bg-[#FAF8F5] hover:bg-rose-50 border border-[#E8DEC8] hover:border-rose-200 rounded-xl transition-all shrink-0"
                  title="Clear all cart items"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Workspace Container */}
          <div 
            ref={rightPanelScrollRef} 
            onScroll={checkRightPanelScroll} 
            className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col relative bg-white"
          >

          {/* Customer Details Inputs (only for Customer Bill) */}
          {transactionType === 'CUSTOMER_BILL' && (
            <div className="px-3 py-2 border-b border-[#E8DEC8] bg-[#FAF8F5] grid grid-cols-2 gap-2 shrink-0">
              <input
                type="text"
                placeholder="Customer Name (optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.preventDefault();
                }}
                className="text-xs py-1.5 px-2.5 bg-white border border-[#E8DEC8] rounded-lg text-stone-900 placeholder:text-stone-400 focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
              />
              <input
                type="tel"
                placeholder="Phone (optional)"
                value={customerPhone}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomerPhone(val);
                  const clean = val.replace(/[^0-9]/g, '');
                  if (clean.length >= 7 && !customerName) {
                    const saved = getSavedCustomers();
                    const match = saved.find((c) => c.phone && c.phone.replace(/[^0-9]/g, '').endsWith(clean));
                    if (match && match.name) {
                      setCustomerName(match.name);
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.preventDefault();
                }}
                className="text-xs py-1.5 px-2.5 bg-white border border-[#E8DEC8] rounded-lg text-stone-900 font-mono placeholder:text-stone-400 focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
              />
            </div>
          )}

          {/* Cart Items List */}
          <div className="flex-1 min-h-[140px] overflow-y-auto px-3 py-2 space-y-1.5 custom-scrollbar bg-white">
            {cart.length === 0 ? (
              <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center p-6 text-stone-400">
                <Barcode className="w-9 h-9 text-stone-300 mb-2 stroke-1" />
                <p className="text-xs font-semibold text-stone-600">Cart is empty</p>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Scan barcode with gun or click products to bill
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center gap-2 p-2 rounded-xl bg-[#FAF8F5] hover:bg-[#F5F2EB] border border-[#E8DEC8] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-bold text-stone-900 truncate leading-tight">
                      {item.product.name}
                    </h5>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-stone-500 font-mono">
                      <span>{item.formattedRate}</span>
                      <span>·</span>
                      <span className="text-[#B8860B] font-bold">{item.formattedQuantity}</span>
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1 shrink-0 bg-white border border-[#E8DEC8] rounded-lg p-0.5 shadow-sm">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="w-5 h-5 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 flex items-center justify-center transition-colors"
                      title="Decrease quantity"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-12 text-center text-[11px] font-bold text-stone-900 font-mono truncate px-0.5">
                      {item.formattedQuantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="w-5 h-5 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 flex items-center justify-center transition-colors"
                      title="Increase quantity"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Line Total & Remove */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-bold text-stone-900 font-mono w-14 text-right">
                      Rs. {item.lineTotal.toFixed(2)}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-stone-400 hover:text-rose-600 transition-colors p-1 rounded"
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
          <div className="shrink-0 border-t border-[#E8DEC8] p-3 space-y-2.5 bg-[#FAF8F5]">
            
            {/* Subtotal & Discount & Tax */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>Subtotal ({totalCartCount} items)</span>
                <span className="font-mono font-medium text-stone-900">Rs. {subtotal.toFixed(2)}</span>
              </div>

              {/* Discount selection */}
              <div className="flex items-center justify-between">
                <span className="text-stone-600">Discount</span>
                <div className="flex items-center gap-1">
                  {[0, 5, 10].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDiscountPercent(d)}
                      className={`px-2 py-0.5 text-[10px] rounded font-semibold transition-colors ${
                        discountPercent === d
                          ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-sm'
                          : 'bg-white border border-[#E8DEC8] text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {d}%
                    </button>
                  ))}
                </div>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 text-xs font-medium">
                  <span>Discount Savings</span>
                  <span className="font-mono font-bold">−Rs. {discountAmount.toFixed(2)}</span>
                </div>
              )}

              {transactionType === 'CUSTOMER_BILL' && (
                <div className="flex justify-between text-stone-600 text-[11px]">
                  <span>Included GST (5%):</span>
                  <span className="font-mono font-medium text-stone-900">Rs. {gstAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Total Due Display */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#E8DEC8] shadow-sm">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#B8860B] font-bold block">
                  Total Payable
                </span>
                <span className="text-[10px] text-stone-500">
                  {transactionType === 'CUSTOMER_BILL' ? 'catalog price incl. 5% GST' : 'no tax (0% GST)'}
                </span>
              </div>
              <span className="text-2xl font-black text-stone-900 font-mono tracking-tight">
                Rs. {grandTotal}
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
                        ? 'border-[#C99A18] bg-[#FBF7EE] text-[#A67D0C] shadow-sm'
                        : 'border-[#E8DEC8] bg-white text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5]'
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
              <div className="p-2 rounded-lg bg-white border border-[#E8DEC8] space-y-1.5 shadow-sm">
                <div className="flex gap-1">
                  {[100, 200, 500, 2000].map((val) => (
                    <button
                      key={val}
                      onClick={() => setAmountReceived(val.toString())}
                      className="flex-1 py-0.5 rounded bg-[#FAF8F5] hover:bg-stone-100 border border-[#E8DEC8] text-[10px] font-mono text-stone-700 hover:text-stone-900 transition-colors"
                    >
                      Rs. {val}
                    </button>
                  ))}
                  <button
                    onClick={() => setAmountReceived(grandTotal.toString())}
                    className="flex-1 py-0.5 rounded bg-[#FBF7EE] border border-[#C99A18]/40 text-[#A67D0C] text-[10px] font-mono font-bold"
                  >
                    Exact
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-600 font-medium">Cash Received:</span>
                  <input
                    type="number"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    placeholder={`Rs. ${grandTotal}`}
                    className="w-24 text-right py-1 px-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded font-mono text-stone-900 focus:border-[#C99A18] focus:outline-none"
                  />
                </div>

                {receivedNum >= grandTotal && amountReceived && (
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-600 pt-1 border-t border-[#E8DEC8]">
                    <span>Change to Return:</span>
                    <span className="font-mono text-sm">Rs. {changeGiven.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Bill Modification Reconciliation Card */}
            {editingOrder && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-1 font-mono">
                <div className="flex justify-between text-stone-600 text-[11px]">
                  <span>Original Paid:</span>
                  <span>Rs. {(editingOrder.originalGrandTotal ?? editingOrder.grandTotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-700 text-[11px]">
                  <span>Updated Total:</span>
                  <span className="font-bold text-stone-900">Rs. {grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-amber-700 border-t border-amber-200 pt-1 text-xs">
                  <span>Additional Due:</span>
                  <span className="text-sm">Rs. {Math.max(0, grandTotal - (editingOrder.originalGrandTotal ?? editingOrder.grandTotal)).toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Checkout Action Button */}
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || isCheckingOut}
              className="w-full py-2.5 text-xs font-bold tracking-wide flex items-center justify-center gap-2 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all btn-gold shadow-md"
            >
              <Receipt className="w-4 h-4" />
              <span>
                {isCheckingOut 
                  ? 'Saving Changes...' 
                  : editingOrder
                    ? `Save Bill Changes (${Math.max(0, grandTotal - (editingOrder.originalGrandTotal ?? editingOrder.grandTotal)) > 0 ? `Collect Rs. ${Math.max(0, grandTotal - (editingOrder.originalGrandTotal ?? editingOrder.grandTotal)).toFixed(2)}` : 'No Extra Due'})`
                    : transactionType === 'CUSTOMER_BILL' 
                      ? `Complete Sale (With GST — Rs. ${grandTotal})` 
                      : `Complete Sale (Without GST — Rs. ${grandTotal})`}
              </span>
            </button>

          </div>

          {/* Floating Quick Scroll to Complete Sale Button */}
          {canScrollDown && (
            <div className="sticky bottom-2 flex justify-center z-30 pointer-events-none my-1">
              <button
                type="button"
                onClick={handleScrollToBottom}
                className="pointer-events-auto py-1 px-3.5 rounded-full bg-[#D4AF37] hover:bg-[#E7C75A] text-black font-extrabold text-[11px] flex items-center gap-1 shadow-[0_4px_20px_rgba(212,175,55,0.5)] transition-all animate-bounce border border-black/20"
                title="Scroll down to Complete Sale button"
              >
                <ChevronDown className="w-3.5 h-3.5 stroke-[3]" />
                <span>Scroll to Complete Sale</span>
              </button>
            </div>
          )}

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
          const isWeight = isWeightBasedProduct(p);
          if (isWeight) {
            handleInitiateQuantitySelection(p);
          } else {
            handleConfirmQuantity(p, 1);
          }
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
        onClose={() => {
          setCompletedOrder(null);
          refocusBarcode();
        }}
      />

    </div>
  );
};
