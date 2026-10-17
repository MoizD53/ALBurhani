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
import { playBeep } from './lib/utils';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
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

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('albhurani_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('albhurani_orders', JSON.stringify(orders));
  }, [orders]);

  // Global Barcode Scanner Listener
  useBarcodeScanner({
    onScan: (scannedBarcode) => {
      // Auto-switch to POS if not already there
      if (activeTab !== 'pos') {
        setActiveTab('pos');
      }
    },
    enabled: true,
  });

  // Handlers
  const handleCompleteSale = (newOrder: OrderBill) => {
    setOrders((prev) => [newOrder, ...prev]);

    // Deduct stock
    setProducts((prev) =>
      prev.map((prod) => {
        const itemInBill = newOrder.items.find((i) => i.product.id === prod.id);
        if (itemInBill) {
          return {
            ...prod,
            stock: Math.max(0, prod.stock - itemInBill.quantity),
          };
        }
        return prod;
      })
    );
  };

  const handleAddProduct = (newProduct: Product) => {
    setProducts((prev) => [newProduct, ...prev]);
  };

  const handleUpdateStock = (productId: string, newStock: number) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, stock: Math.max(0, newStock) } : p))
    );
  };

  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050505] text-[#EAEAEA]">
      
      {/* Sidebar (TENS11 Style) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lowStockCount={lowStockCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Header */}
        <Header />

        {/* View Body */}
        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
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
