import React, { useState, useEffect } from 'react';
import { Product, OrderBill, ExpenseItem, UserProfile } from './types';
import { IMPORTED_PRODUCTS } from './data/importedProducts';
import { deductStock, isWeightBasedProduct } from './lib/pricing';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { PosBillingView } from './components/pos/PosBillingView';
import { CustomerBillsView } from './components/bills/CustomerBillsView';
import { NoBillSalesView } from './components/bills/NoBillSalesView';
import { OverviewDashboardView } from './components/dashboard/OverviewDashboardView';
import { InventoryView } from './components/inventory/InventoryView';
import { ExpensesView } from './components/expenses/ExpensesView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { BarcodeStickerModal } from './components/barcode/BarcodeStickerModal';
import { useBarcodeScanner } from './hooks/useBarcodeScanner';
import { getCurrentSession, terminateSession } from './lib/auth';
import { LoginView } from './components/auth/LoginView';

const DEFAULT_USER: UserProfile = {
  id: 'user-owner',
  name: 'Owner',
  role: 'Owner',
  counter: 'Godi Road Store',
};

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const session = getCurrentSession();
    return Boolean(session && session.token);
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return typeof window !== 'undefined' ? localStorage.getItem('albhurani_sidebar_collapsed') === 'true' : false;
    } catch {
      return false;
    }
  });

  // User Profile (Single User Mode: Owner)
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('albhurani_current_user') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed) {
          return {
            ...parsed,
            name: 'Owner',
            counter: parsed.counter === 'Station Road Store' ? 'Godi Road Store' : (parsed.counter || 'Godi Road Store'),
          };
        }
      }
      return DEFAULT_USER;
    } catch {
      return DEFAULT_USER;
    }
  });


  // Products State (Initialized with 304 products from al burhani stock - Copy.xlsx)
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('albhurani_products') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 250) {
          const p0001 = parsed.find((p: Product) => p.barcode === '0001' || p.sku === '0001');
          const isStale =
            parsed.length !== IMPORTED_PRODUCTS.length ||
            !p0001 ||
            !p0001.name.includes('KAJU KATLI') ||
            (parsed[0] && (parsed[0].costPrice > 0 || parsed[0].stock === 25 || parsed[0].mrp !== undefined));

          if (isStale) {
            localStorage.setItem('albhurani_products', JSON.stringify(IMPORTED_PRODUCTS));
            return IMPORTED_PRODUCTS;
          }
          return parsed;
        }
      }
      return IMPORTED_PRODUCTS;
    } catch {
      return IMPORTED_PRODUCTS;
    }
  });

  // Orders State (Clean real orders only, no mock data)
  const [orders, setOrders] = useState<OrderBill[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('albhurani_orders') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const cleanOrders = parsed.filter((o: OrderBill) => !o.id.startsWith('bill-init-'));
          return cleanOrders;
        }
      }
    } catch {
      // fallback
    }
    return [];
  });

  // Operating Expenses State (Clean real expenses only, no mock data)
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('albhurani_expenses') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const cleanExpenses = parsed.filter((e: ExpenseItem) => !e.id.startsWith('exp-'));
          return cleanExpenses;
        }
      }
    } catch {
      // fallback
    }
    return [];
  });

  const [stickerModalProduct, setStickerModalProduct] = useState<Product | null>(null);

  // Save states to localStorage
  useEffect(() => {
    localStorage.setItem('albhurani_sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem('albhurani_current_user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('albhurani_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('albhurani_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('albhurani_expenses', JSON.stringify(expenses));
  }, [expenses]);

  // Global Barcode Scanner Listener
  useBarcodeScanner({
    onScan: () => {
      if (activeTab !== 'pos') {
        setActiveTab('pos');
      }
    },
    enabled: isAuthenticated,
  });

  // Handlers
  const handleCompleteSale = (newOrder: OrderBill) => {
    // Defense-in-Depth Guard: Reject any simulated or dry-run orders from touching real stock or ledger
    if (newOrder.id.startsWith('sim-') || newOrder.billNumber.startsWith('ALB-SIM')) {
      return;
    }

    setOrders((prev) => [newOrder, ...prev]);

    // Deduct stock safely with accurate unit support
    setProducts((prev) =>
      prev.map((prod) => {
        const itemInBill = newOrder.items.find((i) => i.product.id === prod.id);
        if (itemInBill) {
          const isWeight = isWeightBasedProduct(prod);
          const updatedStock = deductStock(prod.stock, itemInBill.quantity, isWeight);
          return {
            ...prod,
            stock: updatedStock,
          };
        }
        return prod;
      })
    );
  };

  const handleAddProduct = (newProduct: Product) => {
    setProducts((prev) => [newProduct, ...prev]);
  };

  const handleUpdateProduct = (updated: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleUpdateStock = (productId: string, newStock: number) => {
    const validStock = Math.max(0, newStock);
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, stock: validStock } : p))
    );
  };

  const handleAddExpense = (newExpense: ExpenseItem) => {
    setExpenses((prev) => [newExpense, ...prev]);
  };

  const handleSignOut = () => {
    terminateSession();
    setIsAuthenticated(false);
    setActiveTab('overview');
    setIsMobileMenuOpen(false);
  };

  const handleLoginSuccess = () => {
    const session = getCurrentSession();
    if (session) {
      setCurrentUser({
        id: session.user.id,
        name: session.user.name,
        role: session.user.role,
        counter: session.user.counter,
      });
    }
    setIsAuthenticated(true);
    setActiveTab('overview');
  };

  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;

  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#080808] text-[#F5F5F5] antialiased">
      
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lowStockCount={lowStockCount}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        currentUser={currentUser}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden bg-[#080808]">
        
        {/* Top Header */}
        <Header 
          activeTab={activeTab}
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
          currentUser={currentUser}
          onOpenSettings={() => setActiveTab('settings')}
          onSignOut={handleSignOut}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* View Body */}
        <main className={`flex-1 min-h-0 min-w-0 ${
          activeTab === 'pos' ? 'overflow-hidden' : 'overflow-y-auto p-3 sm:p-5 lg:p-6 custom-scrollbar'
        }`}>
          {activeTab === 'overview' && (
            <OverviewDashboardView
              products={products}
              orders={orders}
              expenses={expenses}
              onNavigateToTab={setActiveTab}
            />
          )}

          {activeTab === 'pos' && (
            <PosBillingView
              products={products}
              onCompleteSale={handleCompleteSale}
              onOpenStickerModal={(p) => setStickerModalProduct(p)}
              initialTransactionType="CUSTOMER_BILL"
            />
          )}

          {activeTab === 'customer-bills' && (
            <CustomerBillsView orders={orders} />
          )}

          {activeTab === 'no-bill-sales' && (
            <NoBillSalesView orders={orders} />
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              products={products}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onUpdateStock={handleUpdateStock}
              onOpenStickerModal={(p) => setStickerModalProduct(p)}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpensesView
              expenses={expenses}
              onAddExpense={handleAddExpense}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              products={products}
              orders={orders}
              expenses={expenses}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              currentUser={currentUser}
              onChangeUser={setCurrentUser}
              productsCount={products.length}
            />
          )}
        </main>
      </div>

      {/* Barcode Thermal Sticker Modal */}
      <BarcodeStickerModal
        product={stickerModalProduct}
        onClose={() => setStickerModalProduct(null)}
      />

    </div>
  );
}

export default App;
