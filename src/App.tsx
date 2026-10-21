import React, { useState, useEffect } from 'react';
import { Product, OrderBill, ExpenseItem, UserProfile, CompleteSaleResult } from './types';
import { IMPORTED_PRODUCTS } from './data/importedProducts';
import { deductStock, restoreStock, isWeightBasedProduct } from './lib/pricing';
import { 
  getTursoClient, 
  fetchOrdersFromTurso, 
  saveOrderToTurso, 
  batchSaveOrdersToTurso,
  saveProductToTurso,
  batchSaveProductsToTurso,
  updateStockOnTurso,
  clearOrdersFromTurso,
  clearExpensesFromTurso,
  resetAllStockOnTursoToZero,
  deleteOrderFromTurso,
  fetchProductsFromTurso,
  fetchExpensesFromTurso,
  fetchCustomersFromTurso,
  saveCustomerToTurso,
  fetchSettingsFromTurso,
  saveSettingToTurso,
  saveExpenseToTurso
} from './lib/turso';
import { syncManager } from './lib/syncManager';
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
import { BottomNav } from './components/layout/BottomNav';
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
import { getCurrentSession, terminateSession, isSessionValid } from './lib/auth';
import { LoginView } from './components/auth/LoginView';

const DEFAULT_USER: UserProfile = {
  id: 'user-owner',
  name: 'Owner',
  role: 'Owner',
  counter: 'Godi Road Store',
};

const VALID_TABS: ActiveTab[] = [
  'overview',
  'pos',
  'customer-bills',
  'no-bill-sales',
  'inventory',
  'label-studio',
  'expenses',
  'reports',
  'settings',
];

function getTabFromHash(): ActiveTab {
  if (typeof window === 'undefined') return 'pos';
  const raw = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase();
  if (raw === 'dashboard' || raw === 'overview') return 'overview';
  if (raw === 'customer-bills' || raw === 'bills' || raw === 'counter-sales') return 'no-bill-sales';
  if (raw === 'stock') return 'inventory';
  return VALID_TABS.includes(raw as ActiveTab) ? (raw as ActiveTab) : 'pos';
}

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const session = getCurrentSession();
    return Boolean(session && isSessionValid(session));
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const session = getCurrentSession();
    if (session && isSessionValid(session)) {
      return getTabFromHash();
    }
    return 'pos';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return typeof window !== 'undefined' ? localStorage.getItem('albhurani_sidebar_collapsed') === 'true' : false;
    } catch {
      return false;
    }
  });

  // User Profile (Synchronized with authenticated session)
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const session = getCurrentSession();
    if (session && session.user) {
      return {
        id: session.user.id,
        name: session.user.name,
        role: session.user.role,
        counter: session.user.counter,
      };
    }
    return DEFAULT_USER;
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
          // Normalize any legacy categories to uppercase Excel categories
          const normalized = migrated.map((p) => {
            if (p.category === 'Sweets') return { ...p, category: 'SWEETS' };
            if (p.category === 'Namkeen & Farsan') return { ...p, category: p.name.includes('MUKHWAS') ? 'MUKHWAS' : 'FARSAAN MIX' };
            return p;
          });
          return normalized;
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

      return cleanOrders;
    } catch {
      return [];
    }
  });

  // Operating Expenses State
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('albhurani_expenses') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (e: ExpenseItem) =>
              e &&
              e.id &&
              !e.id.startsWith('exp-1') &&
              !e.id.startsWith('exp-2') &&
              !e.id.startsWith('exp-3') &&
              !e.id.startsWith('mock-')
          );
        }
      }
    } catch {}
    return [];
  });

  const [stickerModalProduct, setStickerModalProduct] = useState<Product | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrderBill | null>(null);

  // Clean up obsolete test mode key from localStorage and sync remote data if configured
  useEffect(() => {
    try {
      localStorage.removeItem('albhurani_pos_test_mode');
    } catch {}

    async function syncRemoteData() {
      try {
        const deletedIds = getDeletedOrderIds();

        // 1. Synchronize products with safeguarding against partial catalog wipes
        const remoteProducts = await fetchProductsFromTurso();
        if (remoteProducts && remoteProducts.length >= 250) {
          // Check if this device has local products that haven't reached Turso yet
          const remoteIdSet = new Set(remoteProducts.map((p) => p.id));
          const localSaved = typeof window !== 'undefined' ? localStorage.getItem('albhurani_products') : null;
          let localProducts: Product[] = [];
          if (localSaved) {
            try {
              const parsed = JSON.parse(localSaved);
              if (Array.isArray(parsed)) localProducts = parsed;
            } catch {}
          }

          const unsyncedProducts = localProducts.filter(
            (lp) => lp && lp.id && !remoteIdSet.has(lp.id)
          );

          if (unsyncedProducts.length > 0) {
            // Upload unsynced local products to Turso cloud so other devices see them
            for (const up of unsyncedProducts) {
              await saveProductToTurso(up);
            }
          }

          const mergedProducts = [...remoteProducts, ...unsyncedProducts];
          setProducts(mergedProducts);
          try {
            localStorage.setItem('albhurani_products', JSON.stringify(mergedProducts));
          } catch {}
        } else if (remoteProducts !== null && remoteProducts.length < 250) {
          // Safeguard: Never allow a partial or empty cloud response (<250 items) to truncate local 305-product catalog.
          // Instead, ensure local state is complete and backfill the master catalog to Turso.
          setProducts((currentProducts) => {
            const catalogToPreserve = (currentProducts && currentProducts.length >= 250)
              ? currentProducts
              : IMPORTED_PRODUCTS.map((p) => ({ ...p, stock: 0 }));

            batchSaveProductsToTurso(catalogToPreserve).catch((err) =>
              console.error('Failed to backfill catalog to Turso:', err)
            );

            try {
              localStorage.setItem('albhurani_products', JSON.stringify(catalogToPreserve));
            } catch {}
            return catalogToPreserve;
          });
        }

        // 2. Synchronize orders
        const remoteOrders = await fetchOrdersFromTurso();
        if (remoteOrders !== null) {
          const validRemoteOrders = remoteOrders.filter(
            (ro) => !isDemoOrTestOrder(ro) && !deletedIds.has(ro.id) && (!ro.billNumber || !deletedIds.has(ro.billNumber))
          );

          // Check if this device has local genuine orders that haven't reached Turso yet
          const remoteIdSet = new Set(validRemoteOrders.map((o) => o.id));
          const remoteBillSet = new Set(validRemoteOrders.map((o) => o.billNumber));

          const localSaved = typeof window !== 'undefined' ? localStorage.getItem('albhurani_orders') : null;
          let localOrders: OrderBill[] = [];
          if (localSaved) {
            try {
              const parsed = JSON.parse(localSaved);
              if (Array.isArray(parsed)) localOrders = parsed;
            } catch {}
          }

          const unsyncedLocalOrders = localOrders.filter(
            (lo) =>
              lo &&
              lo.id &&
              !isDemoOrTestOrder(lo) &&
              !deletedIds.has(lo.id) &&
              (!lo.billNumber || !deletedIds.has(lo.billNumber)) &&
              !remoteIdSet.has(lo.id) &&
              (!lo.billNumber || !remoteBillSet.has(lo.billNumber))
          );

          if (unsyncedLocalOrders.length > 0) {
            // Upload to cloud so all other devices see them
            await batchSaveOrdersToTurso(unsyncedLocalOrders);
          }

          const mergedOrders = [...validRemoteOrders, ...unsyncedLocalOrders];
          setOrders(mergedOrders);
          try {
            localStorage.setItem('albhurani_orders', JSON.stringify(mergedOrders));
          } catch {}
        }

        // 3. Synchronize expenses
        const remoteExpenses = await fetchExpensesFromTurso();
        if (remoteExpenses !== null) {
          setExpenses(remoteExpenses);
          try {
            localStorage.setItem('albhurani_expenses', JSON.stringify(remoteExpenses));
          } catch {}
        }

        // 4. Synchronize customers
        const remoteCustomers = await fetchCustomersFromTurso();
        if (remoteCustomers && remoteCustomers.length > 0) {
          setCustomers(remoteCustomers);
        }

        // 5. Synchronize shared settings
        const remoteSettings = await fetchSettingsFromTurso();
        if (remoteSettings) {
          if (remoteSettings.label_preset) {
            localStorage.setItem('albhurani_label_preset', remoteSettings.label_preset);
          }
          if (remoteSettings.label_settings) {
            localStorage.setItem('albhurani_label_settings', JSON.stringify(remoteSettings.label_settings));
          }
          if (remoteSettings.store_profile) {
            localStorage.setItem('albhurani_store_profile', JSON.stringify(remoteSettings.store_profile));
          }
        }
      } catch (err) {
        console.warn('Could not sync remote data from Turso:', err);
      }
    }

    syncRemoteData();

    // Start background sync manager (polling delta events every 2.5s and on focus/online)
    syncManager.start();

    // Listen for real-time events from other devices
    const unsubOrder = syncManager.subscribe('order', (ev) => {
      if (ev.operation === 'save' && ev.payload) {
        setOrders((prev) => {
          const exists = prev.some((o) => o.id === ev.payload.id || (ev.payload.billNumber && o.billNumber === ev.payload.billNumber));
          if (exists) {
            return prev.map((o) => (o.id === ev.payload.id || o.billNumber === ev.payload.billNumber ? ev.payload : o));
          }
          return [ev.payload, ...prev];
        });
      } else if (ev.operation === 'delete') {
        const orderId = ev.entityId;
        const billNumber = ev.payload?.billNumber;
        setOrders((prev) => prev.filter((o) => o.id !== orderId && (!billNumber || o.billNumber !== billNumber)));
      } else if (ev.operation === 'batch_save' || ev.operation === 'clear_orders') {
        fetchOrdersFromTurso().then((res) => {
          if (res) setOrders(res);
        });
      }
    });

    const unsubProduct = syncManager.subscribe('product', (ev) => {
      if (ev.operation === 'stock' && ev.payload) {
        setProducts((prev) =>
          prev.map((p) => (p.id === ev.payload.productId ? { ...p, stock: ev.payload.stock } : p))
        );
      } else if (ev.operation === 'save' && ev.payload) {
        // Immediate local state update for zero-latency cross-device feedback
        if (ev.payload.id) {
          setProducts((prev) => {
            const exists = prev.some((p) => p.id === ev.payload.id || (p.barcode && p.barcode === ev.payload.barcode));
            const clean = { ...ev.payload, isActive: true };
            const next = exists ? prev.map((p) => (p.id === ev.payload.id ? clean : p)) : [clean, ...prev];
            try {
              localStorage.setItem('albhurani_products', JSON.stringify(next));
            } catch {}
            return next;
          });
        }
        // Re-fetch full canonical product list from cloud to ensure all fields are synchronized
        fetchProductsFromTurso().then((remoteProducts) => {
          if (remoteProducts && remoteProducts.length >= 250) {
            setProducts(remoteProducts);
            try {
              localStorage.setItem('albhurani_products', JSON.stringify(remoteProducts));
            } catch {}
          }
        });
      } else if (ev.operation === 'reset_stock') {
        setProducts((prev) => prev.map((p) => ({ ...p, stock: 0 })));
      }
    });

    const unsubExpense = syncManager.subscribe('expense', (ev) => {
      if (ev.operation === 'save' && ev.payload) {
        // Re-fetch expenses from cloud for properly formatted data
        fetchExpensesFromTurso().then((remoteExpenses) => {
          if (remoteExpenses) {
            setExpenses(remoteExpenses);
            try {
              localStorage.setItem('albhurani_expenses', JSON.stringify(remoteExpenses));
            } catch {}
          }
        });
      } else if (ev.operation === 'clear_expenses') {
        setExpenses([]);
      }
    });

    const unsubSettings = syncManager.subscribe('settings', (ev) => {
      if (ev.payload?.key === 'label_preset') {
        localStorage.setItem('albhurani_label_preset', ev.payload.value);
      } else if (ev.payload?.key === 'label_settings') {
        localStorage.setItem('albhurani_label_settings', JSON.stringify(ev.payload.value));
      } else if (ev.payload?.key === 'store_profile') {
        localStorage.setItem('albhurani_store_profile', JSON.stringify(ev.payload.value));
      }
    });

    const unsubCustomer = syncManager.subscribe('customer', (ev) => {
      if (ev.operation === 'save' && ev.payload) {
        // Re-fetch customers from cloud for properly formatted data
        fetchCustomersFromTurso().then((remoteCustomers) => {
          if (remoteCustomers && remoteCustomers.length > 0) {
            setCustomers(remoteCustomers);
          }
        });
      }
    });

    return () => {
      syncManager.stop();
      unsubOrder();
      unsubProduct();
      unsubExpense();
      unsubSettings();
      unsubCustomer();
    };
  }, []);

  // Save states to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('albhurani_sidebar_collapsed', String(isSidebarCollapsed));
    } catch {}
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      localStorage.setItem('albhurani_current_user', JSON.stringify(currentUser));
    } catch {}
  }, [currentUser, isAuthenticated]);

  // Synchronize URL hash when activeTab changes while authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof window !== 'undefined') {
      const currentHash = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase();
      const targetHash = activeTab === 'overview' ? 'dashboard' : activeTab;
      if (currentHash !== targetHash && !(activeTab === 'overview' && (currentHash === 'overview' || currentHash === 'dashboard'))) {
        window.location.hash = `#${targetHash}`;
      }
    }
  }, [activeTab, isAuthenticated]);

  // Route guard listener for hash changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleHashChange = () => {
      const session = getCurrentSession();
      if (!session || !isSessionValid(session)) {
        setIsAuthenticated(false);
        return;
      }
      const targetTab = getTabFromHash();
      setActiveTab((prev) => (prev !== targetTab ? targetTab : prev));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Listen for order updates (e.g. phone number added from ReceiptModal)
  useEffect(() => {
    const handleOrdersUpdated = (e: Event) => {
      const customEvt = e as CustomEvent<OrderBill>;
      if (customEvt.detail && customEvt.detail.id) {
        setOrders((prev) =>
          prev.map((o) => (o.id === customEvt.detail.id ? customEvt.detail : o))
        );
      }
    };
    window.addEventListener('albhurani_orders_updated', handleOrdersUpdated);
    return () => window.removeEventListener('albhurani_orders_updated', handleOrdersUpdated);
  }, []);

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
      const updatedCustomer = upsertCustomerFromSale(newOrder.customerName, newOrder.customerPhone, newOrder.grandTotal);
      setCustomers(getSavedCustomers());
      // Persist customer to cloud for cross-device sync
      if (updatedCustomer) {
        saveCustomerToTurso(updatedCustomer).catch((err) =>
          console.warn('Turso saveCustomer background error:', err)
        );
      }
    }

    // 6. Persist to cloud database for cross-device sync (await to confirm)
    try {
      const client = getTursoClient();
      if (client) {
        const orderSaved = await saveOrderToTurso(newOrder);
        if (!orderSaved) {
          console.warn('Turso saveOrder returned false — order may not be visible on other devices');
        }
        // Update stock on cloud for each item in the bill
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
        message: 'All test sales, customer counts, payment tenders, and expenses successfully reset to Rs. 0 for fresh shop opening.',
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

    // 2. Immediately restore inventory stock for all products in this deleted order
    let updatedProducts = products;
    if (orderToDelete && Array.isArray(orderToDelete.items) && orderToDelete.items.length > 0) {
      const quantityByProductId = new Map<string, number>();
      for (const it of orderToDelete.items) {
        if (it?.product?.id) {
          const prev = quantityByProductId.get(it.product.id) || 0;
          quantityByProductId.set(it.product.id, prev + (Number(it.quantity) || 0));
        }
      }

      updatedProducts = products.map((prod) => {
        const qtyToRestore = quantityByProductId.get(prod.id);
        if (qtyToRestore && qtyToRestore > 0) {
          const isWeight = isWeightBasedProduct(prod);
          const restored = restoreStock(prod.stock, qtyToRestore, isWeight);
          return {
            ...prod,
            stock: restored,
          };
        }
        return prod;
      });

      setProducts(updatedProducts);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('albhurani_products', JSON.stringify(updatedProducts));
        } catch {}
      }
    }

    // 3. Immediately update state and localStorage consistently
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

    // 4. Delete from Turso database and sync restored stock remotely
    try {
      const ok = await deleteOrderFromTurso(orderId, billNumber);
      if (!ok) {
        console.warn(`Turso deletion for order ${orderId} (${billNumber || ''}) failed or offline. Tombstone will clean it up on sync.`);
      }
      if (orderToDelete && Array.isArray(orderToDelete.items)) {
        for (const it of orderToDelete.items) {
          const p = updatedProducts.find((x) => x.id === it.product.id);
          if (p) {
            updateStockOnTurso(p.id, p.stock).catch((err) =>
              console.warn('Turso updateStock after delete error:', err)
            );
          }
        }
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
        const updatedCustomer = upsertCustomerFromSale(
          updatedOrder.customerName,
          updatedOrder.customerPhone,
          updatedOrder.additionalAmountPaid
        );
        setCustomers(getSavedCustomers());
        // Persist customer to cloud for cross-device sync
        if (updatedCustomer) {
          saveCustomerToTurso(updatedCustomer).catch((err) =>
            console.warn('Turso saveCustomer background error:', err)
          );
        }
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

  const handleAddProduct = async (newProduct: Product) => {
    const updated = [newProduct, ...products];
    setProducts(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('albhurani_products', JSON.stringify(updated));
    }
    const saved = await saveProductToTurso(newProduct);
    if (!saved) {
      console.warn('Failed to persist new product to Turso cloud database');
      syncManager.setStatus('error');
    } else {
      syncManager.setStatus('connected');
    }
  };

  const handleUpdateProduct = async (updatedProd: Product) => {
    const updated = products.map((p) => (p.id === updatedProd.id ? updatedProd : p));
    setProducts(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('albhurani_products', JSON.stringify(updated));
    }
    const saved = await saveProductToTurso(updatedProd);
    if (!saved) {
      console.warn('Failed to update product on Turso cloud database');
      syncManager.setStatus('error');
    } else {
      syncManager.setStatus('connected');
    }
  };

  const handleUpdateStock = async (productId: string, newStock: number) => {
    const validStock = Math.max(0, newStock);
    const updated = products.map((p) => (p.id === productId ? { ...p, stock: validStock } : p));
    setProducts(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('albhurani_products', JSON.stringify(updated));
    }
    const ok = await updateStockOnTurso(productId, validStock);
    if (!ok) {
      console.warn('Failed to sync updated stock to Turso cloud');
    }
  };

  const handleAddExpense = (newExpense: ExpenseItem) => {
    setExpenses((prev) => [newExpense, ...prev]);
    // Persist to cloud database for cross-device sync
    saveExpenseToTurso(newExpense).catch((err) =>
      console.warn('Turso saveExpense background error:', err)
    );
  };

  const handleSignOut = () => {
    terminateSession();
    setIsAuthenticated(false);
    setCurrentUser(DEFAULT_USER);
    setActiveTab('overview');
    setIsMobileMenuOpen(false);
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
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
    const targetTab = getTabFromHash();
    setActiveTab(targetTab);
  };

  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;

  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen h-[100dvh] w-screen overflow-hidden bg-[#FAF8F5] text-[#1C1917] antialiased">
      
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
      <div className="flex-1 flex flex-col h-screen h-[100dvh] min-w-0 overflow-hidden bg-[#FAF8F5]">
        
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
          activeTab === 'pos' 
            ? 'overflow-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0' 
            : 'overflow-y-auto p-3 sm:p-5 lg:p-6 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:pb-6 custom-scrollbar'
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
              initialTransactionType="NO_BILL"
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

        {/* Mobile Bottom Navigation Bar (Phones & Small Screens) */}
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          lowStockCount={lowStockCount}
        />
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
