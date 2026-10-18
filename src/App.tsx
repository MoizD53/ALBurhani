import React, { useState, useEffect } from 'react';
import { Product, OrderBill } from './types';
import { INITIAL_PRODUCTS } from './data/mockProducts';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { PosBillingView } from './components/pos/PosBillingView';
import { InventoryView } from './components/inventory/InventoryView';
import { FinanceView } from './components/finance/FinanceView';
import { BarcodeGuideView } from './components/barcode/BarcodeGuideView';
import { BarcodeStickerModal } from './components/barcode/BarcodeStickerModal';
import { useBarcodeScanner } from './hooks/useBarcodeScanner';
import { 
  checkTursoConfig, 
  initializeTursoSchema, 
  fetchProductsFromTurso, 
  fetchOrdersFromTurso, 
  saveOrderToTurso, 
  saveProductToTurso, 
  updateStockOnTurso 
} from './lib/turso';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return typeof window !== 'undefined' ? localStorage.getItem('albhurani_sidebar_collapsed') === 'true' : false;
    } catch {
      return false;
    }
  });

  const [isTursoConnected, setIsTursoConnected] = useState(false);

  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('albhurani_products') : null;
      return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
    } catch {
      return INITIAL_PRODUCTS;
    }
  });

  const [orders, setOrders] = useState<OrderBill[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('albhurani_orders') : null;
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }

    // Initial realistic seeded bills
    return [
      {
        id: 'bill-init-1',
        billNumber: 'ALB-8421',
        items: [
          { product: INITIAL_PRODUCTS[0], quantity: 1, discountPercent: 0 }, // Kaju Katli
          { product: INITIAL_PRODUCTS[4], quantity: 2, discountPercent: 0 }, // Ratlam Sev
        ],
        subtotal: 900,
        discountAmount: 0,
        gstAmount: 45,
        grandTotal: 945,
        paymentMethod: 'UPI',
        amountReceived: 945,
        changeGiven: 0,
        customerName: 'Sanjay Shah',
        customerPhone: '98250 11223',
        cashierName: 'Counter 01',
        createdAt: 'Today, 10:15 AM',
      },
      {
        id: 'bill-init-2',
        billNumber: 'ALB-8422',
        items: [
          { product: INITIAL_PRODUCTS[1], quantity: 2, discountPercent: 0 }, // Motichoor Ladoo
          { product: INITIAL_PRODUCTS[8], quantity: 1, discountPercent: 0 }, // California Badam
        ],
        subtotal: 1230,
        discountAmount: 0,
        gstAmount: 61.5,
        grandTotal: 1292,
        paymentMethod: 'CASH',
        amountReceived: 1500,
        changeGiven: 208,
        cashierName: 'Counter 01',
        createdAt: 'Today, 11:40 AM',
      },
      {
        id: 'bill-init-3',
        billNumber: 'ALB-8423',
        items: [
          { product: INITIAL_PRODUCTS[11], quantity: 1, discountPercent: 0 }, // Shahi Hamper
        ],
        subtotal: 1850,
        discountAmount: 0,
        gstAmount: 92.5,
        grandTotal: 1943,
        paymentMethod: 'CARD',
        amountReceived: 1943,
        changeGiven: 0,
        customerName: 'Fatima Bhurani',
        customerPhone: '94280 88990',
        cashierName: 'Counter 01',
        createdAt: 'Today, 01:25 PM',
      },
    ];
  });

  const [stickerModalProduct, setStickerModalProduct] = useState<Product | null>(null);

  // Save sidebar collapsed state
  useEffect(() => {
    localStorage.setItem('albhurani_sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('albhurani_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('albhurani_orders', JSON.stringify(orders));
  }, [orders]);

  // Initialize Turso connection on mount
  useEffect(() => {
    const connectTurso = async () => {
      const cfg = checkTursoConfig();
      if (!cfg.isConfigured) {
        setIsTursoConnected(false);
        return;
      }

      const res = await initializeTursoSchema();
      if (res.success) {
        setIsTursoConnected(true);
        // Fetch remote products
        const remoteProds = await fetchProductsFromTurso();
        if (remoteProds && remoteProds.length > 0) {
          setProducts(remoteProds);
        }
        // Fetch remote orders
        const remoteOrders = await fetchOrdersFromTurso();
        if (remoteOrders && remoteOrders.length > 0) {
          setOrders(remoteOrders);
        }
      } else {
        setIsTursoConnected(false);
      }
    };

    connectTurso();
  }, []);

  // Global Barcode Scanner Listener
  useBarcodeScanner({
    onScan: () => {
      // Auto-switch to POS if not already there
      if (activeTab !== 'pos') {
        setActiveTab('pos');
      }
    },
    enabled: true,
  });

  // Handlers with Turso Cloud Sync
  const handleCompleteSale = (newOrder: OrderBill) => {
    setOrders((prev) => [newOrder, ...prev]);

    // Deduct stock in state
    setProducts((prev) =>
      prev.map((prod) => {
        const itemInBill = newOrder.items.find((i) => i.product.id === prod.id);
        if (itemInBill) {
          const updatedStock = Math.max(0, prod.stock - itemInBill.quantity);
          // Sync stock to Turso in background
          updateStockOnTurso(prod.id, updatedStock);
          return {
            ...prod,
            stock: updatedStock,
          };
        }
        return prod;
      })
    );

    // Sync order to Turso in background
    saveOrderToTurso(newOrder);
  };

  const handleAddProduct = (newProduct: Product) => {
    setProducts((prev) => [newProduct, ...prev]);
    // Sync product to Turso in background
    saveProductToTurso(newProduct);
  };

  const handleUpdateStock = (productId: string, newStock: number) => {
    const validStock = Math.max(0, newStock);
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, stock: validStock } : p))
    );
    // Sync stock to Turso in background
    updateStockOnTurso(productId, validStock);
  };

  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050505] text-[#EAEAEA]">
      
      {/* Sidebar (Dual-Mode: Desktop Rail + Mobile Slide-over Drawer) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lowStockCount={lowStockCount}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        isTursoConnected={isTursoConnected}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        
        {/* Header */}
        <Header 
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
          isTursoConnected={isTursoConnected}
        />

        {/* View Body */}
        <main className={`flex-1 min-h-0 min-w-0 ${
          activeTab === 'pos' ? 'overflow-hidden' : 'overflow-y-auto p-3 sm:p-5 lg:p-6 custom-scrollbar'
        }`}>
          {activeTab === 'pos' && (
            <PosBillingView
              products={products}
              onCompleteSale={handleCompleteSale}
              onOpenStickerModal={(p) => setStickerModalProduct(p)}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              products={products}
              onAddProduct={handleAddProduct}
              onUpdateStock={handleUpdateStock}
              onOpenStickerModal={(p) => setStickerModalProduct(p)}
            />
          )}

          {activeTab === 'finance' && (
            <FinanceView orders={orders} />
          )}

          {activeTab === 'barcode-guide' && (
            <BarcodeGuideView />
          )}
        </main>
      </div>

      {/* Barcode Thermal Sticker Generator Modal */}
      <BarcodeStickerModal
        product={stickerModalProduct}
        onClose={() => setStickerModalProduct(null)}
      />


    </div>
  );
}

export default App;
