import React, { useState, useEffect } from 'react';
import { Product, OrderBill, ExpenseItem, UserProfile, CompleteSaleResult } from './types';
import { IMPORTED_PRODUCTS } from './data/importedProducts';
import { deductStock, isWeightBasedProduct } from './lib/pricing';
import { 
  getTursoClient, 
  fetchOrdersFromTurso, 
  saveOrderToTurso, 
  saveProductToTurso,
  updateStockOnTurso,
  clearOrdersFromTurso,
  clearExpensesFromTurso,
  resetAllStockOnTursoToZero,
  deleteOrderFromTurso
} from './lib/turso';
import {
  preserveRealCustomersFromOrders,
  getSavedCustomers,
  upsertCustomerFromSale,
  CustomerRecord
} from './lib/customers';
import {
  getDeletedOrderIds,
  recordDeletedOrder,
  isOrderDeleted,
  isDemoOrTestOrder,
  computeStockAdjustments
} from './lib/orders';
import { migrateCatalogPrices, MIGRATION_STORAGE_KEY } from './lib/catalogMigration';
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
import { LabelStudioView } from './components/labels/LabelStudioView';
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


  // Products State (Reset all 305 products to stock: 0 for clean opening stock entry)
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const isZeroStockMigrated = typeof window !== 'undefined' ? localStorage.getItem('albhurani_opening_stock_zero_v1') : null;
      if (!isZeroStockMigrated) {
        const zeroStockProducts = IMPORTED_PRODUCTS.map((p) => ({ ...p, stock: 0 }));
        if (typeof window !== 'undefined') {
          localStorage.setItem('albhurani_products', JSON.stringify(zeroStockProducts));
          localStorage.setItem('albhurani_opening_stock_zero_v1', 'true');
        }
        return zeroStockProducts;
      }

      const saved = typeof window !== 'undefined' ? localStorage.getItem('albhurani_products') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 250) {
          const p0001 = parsed.find((p: Product) => p.barcode === '0001' || p.sku === '0001');
          const isStale = !p0001 || !p0001.name.includes('KAJU KATLI');

          if (isStale) {
            const zeroStockProducts = IMPORTED_PRODUCTS.map((p) => ({ ...p, stock: 0 }));
            localStorage.setItem('albhurani_products', JSON.stringify(zeroStockProducts));
            return zeroStockProducts;
          }

          // Apply approved 41-item KG price conversion if stored with old per-gram rates
          const { products: migrated, migratedCount } = migrateCatalogPrices(parsed);
          if (migratedCount > 0 && typeof window !== 'undefined') {
            try {
              localStorage.setItem('albhurani_products', JSON.stringify(migrated));
              localStorage.setItem(MIGRATION_STORAGE_KEY, 'true');
            } catch {}
          }
          return migrated;
        }
      }
      return IMPORTED_PRODUCTS.map((p) => ({ ...p, stock: 0 }));
    } catch {
      return IMPORTED_PRODUCTS.map((p) => ({ ...p, stock: 0 }));
    }
  });

  // Customer Records State (Preserved real customers)
  const [customers, setCustomers] = useState<CustomerRecord[]>(() => {
    return getSavedCustomers();
  });

  // Orders State (Clean real orders only, resets all demo/test orders for fresh opening while preserving genuine sales)
  const [orders, setOrders] = useState<OrderBill[]>(() => {
    try {
      const isFreshShopMigratedV2 = typeof window !== 'undefined' 
        ? localStorage.getItem('albhurani_fresh_shop_opening_v2') === 'true'
        : false;
      const isFreshShopMigratedV1 = typeof window !== 'undefined' 
        ? localStorage.getItem('albhurani_fresh_shop_opening_v1') === 'true'
        : false;

      const saved = typeof window !== 'undefined' ? localStorage.getItem('albhurani_orders') : null;
      let parsedOrders: OrderBill[] = [];
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            parsedOrders = parsed;
          }
        } catch {}
      }

      // Check for the specific incorrect test invoice ALB-INV-2726 and tombstone it immediately
      const deletedIds = getDeletedOrderIds();
      const wrongInvoice = parsedOrders.find(
        (o) => o.billNumber === 'ALB-INV-2726' || o.id === 'ALB-INV-2726'
      );
      if (wrongInvoice) {
        recordDeletedOrder(wrongInvoice.id, wrongInvoice.billNumber);
        deletedIds.add(wrongInvoice.id);
        deletedIds.add(wrongInvoice.billNumber);
        deleteOrderFromTurso(wrongInvoice.id, wrongInvoice.billNumber).catch(() => {});
      } else {
        recordDeletedOrder('ALB-INV-2726', 'ALB-INV-2726');
        deletedIds.add('ALB-INV-2726');
      }

      // Filter out test orders, ALB-INV-2726, and tombstones
      const cleanOrders = parsedOrders.filter(
        (o: OrderBill) =>
          o &&
          o.id &&
          !isDemoOrTestOrder(o) &&
          !deletedIds.has(o.id) &&
          (!o.billNumber || !deletedIds.has(o.billNumber))
      );

      // If neither v1 nor v2 migration has run yet:
      if (!isFreshShopMigratedV2 && !isFreshShopMigratedV1 && typeof window !== 'undefined') {
        if (cleanOrders.length > 0) {
          // Genuine sales already exist! Preserve real customers and keep genuine sales.
          preserveRealCustomersFromOrders(parsedOrders);
          localStorage.setItem('albhurani_orders', JSON.stringify(cleanOrders));
          localStorage.setItem('albhurani_fresh_shop_opening_v1', 'true');
          localStorage.setItem('albhurani_fresh_shop_opening_v2', 'true');
          return cleanOrders;
        } else {
          // First-time fresh opening with only demo/mock orders
          preserveRealCustomersFromOrders(parsedOrders);
          localStorage.setItem('albhurani_orders', JSON.stringify([]));
          localStorage.setItem('albhurani_expenses', JSON.stringify([]));
          localStorage.setItem('albhurani_fresh_shop_opening_v1', 'true');
          localStorage.setItem('albhurani_fresh_shop_opening_v2', 'true');
          localStorage.setItem('albhurani_fresh_opening_timestamp', String(Date.now()));
          clearOrdersFromTurso().catch(() => {});
          clearExpensesFromTurso().catch(() => {});
          return [];
        }
      }

      // If v1 was completed previously, mark v2 without wiping genuine sales or reset timestamps
      if (isFreshShopMigratedV1 && !isFreshShopMigratedV2 && typeof window !== 'undefined') {
        localStorage.setItem('albhurani_fresh_shop_opening_v2', 'true');
        localStorage.setItem('albhurani_orders', JSON.stringify(cleanOrders));
        return cleanOrders;
      }

      // If orders had bad orders stripped, persist the cleaned list
      if (typeof window !== 'undefined' && saved && cleanOrders.length !== parsedOrders.length) {
        localStorage.setItem('albhurani_orders', JSON.stringify(cleanOrders));
      }

      return cleanOrders;
    } catch {
      // fallback
    }
    return [];
  });

  // Operating Expenses State (Clean real expenses only, resets all demo/test expenses for fresh opening)
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => {
    try {
      const isFreshShopMigrated = typeof window !== 'undefined' 
        ? (localStorage.getItem('albhurani_fresh_shop_opening_v2') === 'true' || localStorage.getItem('albhurani_fresh_shop_opening_v1') === 'true')
        : false;

      if (!isFreshShopMigrated && typeof window !== 'undefined') {
        return [];
      }

      const saved = typeof window !== 'undefined' ? localStorage.getItem('albhurani_expenses') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const cleanExpenses = parsed.filter(
            (e: ExpenseItem) =>
              e &&
              e.id &&
              !e.id.startsWith('exp-1') &&
              !e.id.startsWith('exp-2') &&
              !e.id.startsWith('exp-3') &&
              !e.id.startsWith('mock-')
          );
          return cleanExpenses;
        }
      }
    } catch {
      // fallback
    }
    return [];
  });

  const [stickerModalProduct, setStickerModalProduct] = useState<Product | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrderBill | null>(null);

  // Clean up obsolete test mode key from localStorage and sync remote data if configured
  useEffect(() => {
    try {
      localStorage.removeItem('albhurani_pos_test_mode');
    } catch {
      // ignore
    }

    async function syncRemoteData() {
      try {
        const client = getTursoClient();
        if (!client) return;

        const isFreshShopMigrated = typeof window !== 'undefined' 
          ? (localStorage.getItem('albhurani_fresh_shop_opening_v2') === 'true' || localStorage.getItem('albhurani_fresh_shop_opening_v1') === 'true')
          : false;
        const resetTimestamp = typeof window !== 'undefined'
          ? Number(localStorage.getItem('albhurani_fresh_opening_timestamp') || '0')
          : 0;
        const deletedIds = getDeletedOrderIds();

        const remoteOrders = await fetchOrdersFromTurso();
        if (remoteOrders && remoteOrders.length > 0) {
          // Filter out orders that were created before fresh opening reset, match mock IDs, or are deleted
          const validRemoteOrders = remoteOrders.filter((ro) => {
            if (deletedIds.has(ro.id) || (ro.billNumber && deletedIds.has(ro.billNumber))) {
              deleteOrderFromTurso(ro.id, ro.billNumber).catch(() => {});
              return false;
            }
            if (isDemoOrTestOrder(ro)) return false;
            if (isFreshShopMigrated && resetTimestamp > 0 && ro.timestamp && ro.timestamp < resetTimestamp) {
              return false;
            }
            return true;
          });

          if (validRemoteOrders.length === 0 && remoteOrders.length > 0 && isFreshShopMigrated) {
            clearOrdersFromTurso().catch(() => {});
          }

          if (validRemoteOrders.length > 0) {
            setOrders((localOrders) => {
              const localIds = new Set(localOrders.map((o) => o.id));
              const localBillNumbers = new Set(localOrders.map((o) => o.billNumber));
              const toAdd = validRemoteOrders.filter(
                (ro) =>
                  !localIds.has(ro.id) &&
                  !localBillNumbers.has(ro.billNumber) &&
                  !deletedIds.has(ro.id) &&
                  (!ro.billNumber || !deletedIds.has(ro.billNumber))
              );
              if (toAdd.length === 0) return localOrders;
              const merged = [...localOrders, ...toAdd];
              try {
                localStorage.setItem('albhurani_orders', JSON.stringify(merged));
              } catch {}
              return merged;
            });
          }
        }
      } catch (err) {
        console.warn('Could not sync remote data from Turso:', err);
      }
    }
    syncRemoteData();
  }, []);

  // Save states to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('albhurani_sidebar_collapsed', String(isSidebarCollapsed));
    } catch {}
  }, [isSidebarCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem('albhurani_current_user', JSON.stringify(currentUser));
    } catch {}
  }, [currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem('albhurani_products', JSON.stringify(products));
    } catch {}
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem('albhurani_orders', JSON.stringify(orders));
    } catch {}
  }, [orders]);

  useEffect(() => {
    try {
      localStorage.setItem('albhurani_expenses', JSON.stringify(expenses));
    } catch {}
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
  const handleCompleteSale = async (newOrder: OrderBill): Promise<CompleteSaleResult> => {
    // 1. Validation guards
    if (!newOrder || !newOrder.id || !newOrder.billNumber) {
      return { success: false, error: 'Invalid order data: Missing identifier' };
    }
    if (newOrder.id.startsWith('sim-') || newOrder.billNumber.startsWith('ALB-SIM')) {
      return { success: false, error: 'Simulated orders are rejected' };
    }
    if (!Array.isArray(newOrder.items) || newOrder.items.length === 0) {
      return { success: false, error: 'Cannot checkout an empty bill' };
    }
    if (typeof newOrder.grandTotal !== 'number' || newOrder.grandTotal < 0) {
      return { success: false, error: 'Invalid bill grand total' };
    }

    // 2. Duplicate prevention guard
    if (orders.some((o) => o.id === newOrder.id || o.billNumber === newOrder.billNumber)) {
      return { success: false, error: `Duplicate order: ${newOrder.billNumber} is already recorded` };
    }

    // 3. Deduct stock safely with unit support
    const updatedProducts = products.map((prod) => {
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
    });

    const updatedOrders = [newOrder, ...orders];

    // 4. Synchronous persistent write before confirming checkout success
    try {
      localStorage.setItem('albhurani_orders', JSON.stringify(updatedOrders));
      localStorage.setItem('albhurani_products', JSON.stringify(updatedProducts));
    } catch (storageErr: any) {
      console.error('Failed to save to localStorage:', storageErr);
      return { 
        success: false, 
        error: `Storage failure: ${storageErr?.message || 'Storage quota exceeded'}` 
      };
    }

    // 5. Update component state
    setOrders(updatedOrders);
    setProducts(updatedProducts);

    // Save customer if real non-demo customer
    if (newOrder.customerName || newOrder.customerPhone) {
      upsertCustomerFromSale(newOrder.customerName, newOrder.customerPhone, newOrder.grandTotal);
      setCustomers(getSavedCustomers());
    }

    // 6. Asynchronous remote backup to Turso if configured
    try {
      const client = getTursoClient();
      if (client) {
        saveOrderToTurso(newOrder).catch((err) => 
          console.warn('Turso saveOrder background error:', err)
        );
        for (const it of newOrder.items) {
          const p = updatedProducts.find((x) => x.id === it.product.id);
          if (p) {
            updateStockOnTurso(p.id, p.stock).catch((err) => 
              console.warn('Turso updateStock background error:', err)
            );
          }
        }
      }
    } catch (tursoErr) {
      console.warn('Turso dispatch error:', tursoErr);
    }

    return { success: true, order: newOrder };
  };

  /**
   * Reset all test sales, payment tenders, and expenses to zero for fresh shop opening.
   * Real customer contacts are safely preserved.
   */
  const handleResetStoreData = async (): Promise<{ success: boolean; message: string }> => {
    try {
      // 1. Preserve real customers before clearing orders
      const preserved = preserveRealCustomersFromOrders(orders);
      setCustomers(preserved);

      // 2. Reset in-memory orders & expenses
      setOrders([]);
      setExpenses([]);

      // 3. Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('albhurani_orders', JSON.stringify([]));
        localStorage.setItem('albhurani_expenses', JSON.stringify([]));
        localStorage.setItem('albhurani_fresh_shop_opening_v1', 'true');
        localStorage.setItem('albhurani_fresh_shop_opening_v2', 'true');
        localStorage.setItem('albhurani_fresh_opening_timestamp', String(Date.now()));
      }

      // 4. Clear Turso database
      await clearOrdersFromTurso();
      await clearExpensesFromTurso();

      return {
        success: true,
        message: 'All test sales, customer counts, payment tenders, and expenses successfully reset to ₹0 for fresh shop opening.',
      };
    } catch (err: any) {
      console.error('Failed to reset store data:', err);
      return {
        success: false,
        message: err?.message || 'Failed to complete reset.',
      };
    }
  };

  /**
   * Reset all product stock to 0 for fresh manual physical inventory entry
   */
  const handleResetAllStockToZero = async (): Promise<{ success: boolean; message: string }> => {
    try {
      const zeroStockProducts = products.map((p) => ({ ...p, stock: 0 }));
      setProducts(zeroStockProducts);
      if (typeof window !== 'undefined') {
        localStorage.setItem('albhurani_products', JSON.stringify(zeroStockProducts));
      }
      await resetAllStockOnTursoToZero();
      return { success: true, message: 'All 305 product stock counts have been reset to 0.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Stock reset failed.' };
    }
  };

  const handleDeleteOrder = async (orderId: string): Promise<boolean> => {
    const orderToDelete = orders.find((o) => o.id === orderId);
    const billNumber = orderToDelete?.billNumber;

    // 1. Immediately record in persistent tombstone storage to prevent resurrection on sync/refresh
    recordDeletedOrder(orderId, billNumber);

    // 2. Immediately update state and localStorage consistently
    let updatedOrders: OrderBill[] = [];
    setOrders((prev) => {
      updatedOrders = prev.filter((o) => o.id !== orderId && (!billNumber || o.billNumber !== billNumber));
      try {
        localStorage.setItem('albhurani_orders', JSON.stringify(updatedOrders));
      } catch (storageErr) {
        console.error('Failed to update localStorage after deleting order:', storageErr);
      }
      return updatedOrders;
    });

    // 3. Delete from Turso database (both by id and bill_number)
    try {
      const ok = await deleteOrderFromTurso(orderId, billNumber);
      if (!ok) {
        console.warn(`Turso deletion for order ${orderId} (${billNumber || ''}) failed or offline. Tombstone will clean it up on sync.`);
      }
      return true;
    } catch (tursoErr) {
      console.warn('Failed to delete order from Turso:', tursoErr);
      return true;
    }
  };

  const handleStartModifyOrder = (order: OrderBill) => {
    setEditingOrder(order);
    setActiveTab('pos');
  };

  const handleCancelModifyOrder = () => {
    setEditingOrder(null);
  };

  const handleSaveModifiedOrder = async (
    updatedOrder: OrderBill,
    originalOrder: OrderBill
  ): Promise<CompleteSaleResult> => {
    try {
      // 1. Calculate net stock difference between original and updated order
      const adjustments = computeStockAdjustments(originalOrder.items, updatedOrder.items);

      const updatedProducts = products.map((p) => {
        const adj = adjustments.find((a) => a.productId === p.id);
        if (!adj) return p;
        const newStock = Math.max(0, p.stock - adj.deltaQuantity);
        return {
          ...p,
          stock: adj.isWeight ? Math.round(newStock * 1000) / 1000 : Math.round(newStock),
        };
      });

      // 2. Update orders array atomically replacing the original order
      const updatedOrders = orders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));

      // 3. Persist to localStorage immediately
      if (typeof window !== 'undefined') {
        localStorage.setItem('albhurani_orders', JSON.stringify(updatedOrders));
        localStorage.setItem('albhurani_products', JSON.stringify(updatedProducts));
      }

      setOrders(updatedOrders);
      setProducts(updatedProducts);
      setEditingOrder(null);

      // 4. Update customer spend if additional payment was made
      if (
        (updatedOrder.customerName || updatedOrder.customerPhone) &&
        updatedOrder.additionalAmountPaid &&
        updatedOrder.additionalAmountPaid > 0
      ) {
        upsertCustomerFromSale(
          updatedOrder.customerName,
          updatedOrder.customerPhone,
          updatedOrder.additionalAmountPaid
        );
        setCustomers(getSavedCustomers());
      }

      // 5. Remote backup if configured
      try {
        saveOrderToTurso(updatedOrder).catch((err) =>
          console.warn('Turso saveOrder background error:', err)
        );
        for (const adj of adjustments) {
          const p = updatedProducts.find((x) => x.id === adj.productId);
          if (p) {
            updateStockOnTurso(p.id, p.stock).catch((err) =>
              console.warn('Turso updateStock background error:', err)
            );
          }
        }
      } catch (tursoErr) {
        console.warn('Turso dispatch error:', tursoErr);
      }

      return { success: true, order: updatedOrder };
    } catch (err: any) {
      console.error('Failed to save modified order:', err);
      return {
        success: false,
        error: err?.message || 'Failed to update order',
      };
    }
  };

  const handleAddProduct = (newProduct: Product) => {
    const updated = [newProduct, ...products];
    setProducts(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('albhurani_products', JSON.stringify(updated));
    }
    saveProductToTurso(newProduct).catch(() => {});
  };

  const handleUpdateProduct = (updatedProd: Product) => {
    const updated = products.map((p) => (p.id === updatedProd.id ? updatedProd : p));
    setProducts(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('albhurani_products', JSON.stringify(updated));
    }
    saveProductToTurso(updatedProd).catch(() => {});
  };

  const handleUpdateStock = (productId: string, newStock: number) => {
    const validStock = Math.max(0, newStock);
    const updated = products.map((p) => (p.id === productId ? { ...p, stock: validStock } : p));
    setProducts(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('albhurani_products', JSON.stringify(updated));
    }
    updateStockOnTurso(productId, validStock).catch(() => {});
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
              onDeleteOrder={handleDeleteOrder}
              onModifyOrder={handleStartModifyOrder}
            />
          )}

          {activeTab === 'pos' && (
            <PosBillingView
              products={products}
              onCompleteSale={handleCompleteSale}
              onOpenStickerModal={(p) => setStickerModalProduct(p)}
              initialTransactionType="CUSTOMER_BILL"
              editingOrder={editingOrder}
              onCancelEditOrder={handleCancelModifyOrder}
              onSaveModifiedOrder={handleSaveModifiedOrder}
            />
          )}

          {activeTab === 'customer-bills' && (
            <CustomerBillsView 
              orders={orders} 
              onDeleteOrder={handleDeleteOrder}
              onModifyOrder={handleStartModifyOrder}
            />
          )}

          {activeTab === 'no-bill-sales' && (
            <NoBillSalesView 
              orders={orders} 
              onDeleteOrder={handleDeleteOrder}
              onModifyOrder={handleStartModifyOrder}
            />
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

          {activeTab === 'label-studio' && currentUser.role === 'Owner' && (
            <LabelStudioView
              products={products}
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
              ordersCount={orders.length}
              totalRevenue={orders.reduce((sum, o) => sum + o.grandTotal, 0)}
              expensesCount={expenses.length}
              totalExpenses={expenses.reduce((sum, e) => sum + e.amount, 0)}
              savedCustomersCount={customers.length}
              onResetStoreData={handleResetStoreData}
              onResetAllStockToZero={handleResetAllStockToZero}
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
