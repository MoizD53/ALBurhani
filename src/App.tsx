import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Product, 
  OrderBill, 
  ExpenseItem, 
  UserProfile, 
  CompleteSaleResult, 
  CustomerOrder, 
  CustomerOrderStatus, 
  CategoryItem,
  PurchaseBill,
  Vendor,
  VendorPayment
} from './types';
import { IMPORTED_PRODUCTS } from './data/importedProducts';
import { isWeightBasedProduct, deductStock, restoreStock } from './lib/pricing';
import { 
  getTursoClient, 
  fetchOrdersFromTurso, 
  fetchDeletedOrdersFromTurso,
  saveOrderToTurso, 
  batchSaveOrdersToTurso,
  saveProductToTurso,
  updateStockOnTurso,
  adjustStockOnTurso,
  invalidateProductsCache,
  deleteProductFromTurso,
  batchSaveProductsToTurso,
  clearOrdersFromTurso,
  clearExpensesFromTurso,
  deleteOrderFromTurso,
  fetchProductsFromTurso,
  fetchExpensesFromTurso,
  fetchCustomersFromTurso,
  saveCustomerToTurso,
  fetchSettingsFromTurso,
  saveSettingToTurso,
  saveExpenseToTurso,
  fetchCustomerOrdersFromTurso,
  saveCustomerOrderToTurso,
  updateCustomerOrderStatusOnTurso,
  deleteCustomerOrderFromTurso,
  fetchCategoriesFromTurso,
  saveCategoryToTurso,
  renameCategoryOnTurso,
  deleteCategoryFromTurso,
  fetchPurchaseBillsFromTurso,
  savePurchaseBillToTurso,
  cancelPurchaseBillOnTurso,
  deletePurchaseBillOnTurso,
  addVendorPaymentOnTurso,
  fetchVendorsFromTurso
} from './lib/turso';
import { syncManager, SyncState } from './lib/syncManager';
import { getKolkataDateString, extractOrderTimestamp } from './lib/utils';
import {
  preserveRealCustomersFromOrders,
  getSavedCustomers,
  upsertCustomerFromSale,
  CustomerRecord
} from './lib/customers';
import {
  getDeletedOrderIds,
  recordDeletedOrder,
  syncDeletedOrdersFromRemote,
  isOrderDeleted,
  isDemoOrTestOrder,
  DELETED_ORDERS_STORAGE_KEY,
  computeStockAdjustments
} from './lib/orders';
import { getSavedCustomerOrders, saveCustomerOrdersLocally } from './lib/customerOrders';
import { getSavedCategories, saveCategoriesLocally } from './lib/categories';
import { migrateCatalogPrices, MIGRATION_STORAGE_KEY } from './lib/catalogMigration';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';
import { PosBillingView } from './components/pos/PosBillingView';
import { OrdersView } from './components/orders/OrdersView';
import { CustomerBillsView } from './components/bills/CustomerBillsView';
import { NoBillSalesView } from './components/bills/NoBillSalesView';
import { PurchaseBillsView } from './components/purchases/PurchaseBillsView';
import { OverviewDashboardView } from './components/dashboard/OverviewDashboardView';
import { ProductManagementView } from './components/product-management/ProductManagementView';
import { ExpensesView } from './components/expenses/ExpensesView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { LabelStudioView } from './components/labels/LabelStudioView';
import { BarcodeStickerModal } from './components/barcode/BarcodeStickerModal';
import { useBarcodeScanner } from './hooks/useBarcodeScanner';
import { getCurrentSession, terminateSession, isSessionValid } from './lib/auth';
import { LoginView } from './components/auth/LoginView';
import { useAppRoute } from './lib/routing';
import { PublicWebsite } from './components/public/PublicWebsite';
import { TursoBudgetModal } from './components/dashboard/TursoBudgetModal';
import { SyncHealthModal } from './components/dashboard/SyncHealthModal';
import { EditBillModal } from './components/bills/EditBillModal';

const DEFAULT_USER: UserProfile = {
  id: 'user-owner',
  name: 'Owner',
  role: 'Owner',
  counter: 'Godi Road Store',
  branchId: 'godi_road',
  branchName: 'Godi Road',
};

const VALID_TABS: ActiveTab[] = [
  'overview',
  'pos',
  'no-bill-sales',
  'purchases',
  'orders',
  'customer-bills',
  'product-management',
  'label-studio',
  'expenses',
  'reports',
  'settings',
];

function getTabFromHash(): ActiveTab {
  if (typeof window === 'undefined') return 'overview';
  const raw = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase();
  if (raw === 'dashboard' || raw === 'overview') return 'overview';
  if (raw === 'customer-bills' || raw === 'bills' || raw === 'counter-sales') return 'no-bill-sales';
  if (raw === 'stock' || raw === 'inventory') return 'product-management';
  if (raw === 'order' || raw === 'orders') return 'orders';
  if (raw === 'product-management' || raw === 'products' || raw === 'categories') return 'product-management';
  if (raw === 'purchases' || raw === 'purchase-bills' || raw === 'vendors') return 'purchases';
  return VALID_TABS.includes(raw as ActiveTab) ? (raw as ActiveTab) : 'overview';
}

export function App() {
  const { route, navigate } = useAppRoute();

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const session = getCurrentSession();
    return Boolean(session && isSessionValid(session));
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const session = getCurrentSession();
    if (session && isSessionValid(session)) {
      if (route.type === 'admin' && route.subRoute) {
        return route.subRoute;
      }
      return getTabFromHash();
    }
    return 'overview';
  });

  // Synchronize active tab when admin subRoute is navigated
  useEffect(() => {
    if (route.type === 'admin' && route.subRoute) {
      setActiveTab(route.subRoute);
    }
  }, [route]);

  const handleTabChange = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    if (route.type === 'admin') {
      navigate(`/admin/${tab}`, { replace: true });
    }
  }, [route.type, navigate]);

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
        branchId: session.user.branchId || 'godi_road',
        branchName: session.user.branchName || 'Godi Road',
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

          // Guarantee all 338 products from IMPORTED_PRODUCTS exist in local cache
          if (parsed.length < IMPORTED_PRODUCTS.length) {
            const existingIds = new Set(parsed.map((p: Product) => p.id));
            const missing = IMPORTED_PRODUCTS.filter((p) => !existingIds.has(p.id));
            if (missing.length > 0) {
              parsed.push(...missing.map((p) => ({ ...p, stock: 0 })));
              try {
                localStorage.setItem('albhurani_products', JSON.stringify(parsed));
              } catch {}
            }
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
          !deletedIds.has(o.id)
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

  // Purchase Bills State
  const [purchaseBills, setPurchaseBills] = useState<PurchaseBill[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('albhurani_purchase_bills') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  // Vendors State
  const [vendors, setVendors] = useState<Vendor[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('albhurani_vendors') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [stickerModalProduct, setStickerModalProduct] = useState<Product | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrderBill | null>(null);
  const [editingBillModalOrder, setEditingBillModalOrder] = useState<OrderBill | null>(null);
  const [barcodeToRegister, setBarcodeToRegister] = useState<string | null>(null);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState<boolean>(false);
  const [isSyncHealthOpen, setIsSyncHealthOpen] = useState<boolean>(false);
  const [syncState, setSyncState] = useState<SyncState>(() => syncManager.getState());

  // Customer Orders State (Advance bookings, deliveries)
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>(() => {
    return getSavedCustomerOrders();
  });

  // Categories State (Unified category management)
  const [categories, setCategories] = useState<CategoryItem[]>(() => {
    return getSavedCategories(products);
  });

  // Multi-Shop Branch Isolation: Godi Road (Main) vs MG Road (New)
  const activeBranch = currentUser.branchId || 'godi_road';

  const branchOrders = useMemo(() => {
    return orders.filter((o) => (o.branch || 'godi_road') === activeBranch);
  }, [orders, activeBranch]);

  const branchExpenses = useMemo(() => {
    return expenses.filter((e) => (e.branch || 'godi_road') === activeBranch);
  }, [expenses, activeBranch]);

  const branchPurchaseBills = useMemo(() => {
    return purchaseBills.filter((b) => (b.branch || 'godi_road') === activeBranch);
  }, [purchaseBills, activeBranch]);

  const branchCustomerOrders = useMemo(() => {
    return customerOrders.filter((co) => (co.branch || 'godi_road') === activeBranch);
  }, [customerOrders, activeBranch]);

  // Clean up obsolete test mode key from localStorage and sync remote data if configured
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);
  const lastSyncTimeRef = useRef<number>(0);
  const productsRef = useRef<Product[]>(products);
  const activeBranchRef = useRef<string>(activeBranch);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    activeBranchRef.current = activeBranch;
    // Update active stock display for products when switching active branch
    setProducts((prev) => {
      let changed = false;
      const updated = prev.map((p) => {
        const branchStockVal = p.branchStock?.[activeBranch];
        if (typeof branchStockVal === 'number' && p.stock !== branchStockVal) {
          changed = true;
          return { ...p, stock: branchStockVal };
        }
        return p;
      });
      return changed ? updated : prev;
    });
  }, [activeBranch]);

  const syncRemoteData = useCallback(async (forceRefresh = false) => {
    if (isSyncingRef.current) return;
    const now = Date.now();
    if (!forceRefresh && now - lastSyncTimeRef.current < 15000) return;
    lastSyncTimeRef.current = now;
    isSyncingRef.current = true;
    try {
      setIsSyncing(true);

      // Parallel fetch of remote entities (reducing 10s waterfall to < 1s)
      const branchToQuery = activeBranchRef.current || 'godi_road';
      const [
        remoteDeleted,
        remoteProducts,
        remoteOrders,
        remoteExpenses,
        remoteCustomers,
        remoteSettings,
        remoteCustomerOrders,
        remoteCategories,
        remotePurchases,
        remoteVendors
      ] = await Promise.all([
        fetchDeletedOrdersFromTurso(forceRefresh),
        fetchProductsFromTurso(forceRefresh, branchToQuery),
        fetchOrdersFromTurso('ALL', branchToQuery, forceRefresh),
        fetchExpensesFromTurso(undefined, forceRefresh),
        fetchCustomersFromTurso(),
        fetchSettingsFromTurso(),
        fetchCustomerOrdersFromTurso(),
        fetchCategoriesFromTurso(forceRefresh),
        fetchPurchaseBillsFromTurso(undefined, forceRefresh).catch(() => null),
        fetchVendorsFromTurso(forceRefresh).catch(() => null)
      ]);

      // 0. Synchronize remote deleted order tombstones
      let deletedIds = getDeletedOrderIds();
      if (remoteDeleted && remoteDeleted.length > 0) {
        deletedIds = syncDeletedOrdersFromRemote(remoteDeleted);
      }

      // 1. Synchronize products with safeguarding against partial catalog wipes
      if (remoteProducts && remoteProducts.length >= 250) {
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
          for (const up of unsyncedProducts) {
            await saveProductToTurso(up);
          }
        }

        const mergedProducts = [...remoteProducts, ...unsyncedProducts];
        setProducts((prev) => {
          if (prev.length === mergedProducts.length) {
            const hasChange = prev.some((p, i) => p.id !== mergedProducts[i]?.id || p.stock !== mergedProducts[i]?.stock || p.sellingPrice !== mergedProducts[i]?.sellingPrice);
            if (!hasChange) return prev;
          }
          return mergedProducts;
        });
        try {
          localStorage.setItem('albhurani_products', JSON.stringify(mergedProducts));
        } catch {}
      } else if (remoteProducts !== null && remoteProducts.length < 250) {
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

      // 2. Synchronize orders scoped to current active branch
      if (remoteOrders !== null) {
        const remoteDeletedIdSet = new Set((remoteDeleted || []).map((r) => r.id.trim()));
        const localDeletedSet = getDeletedOrderIds();
        let tombstonesCleaned = false;
        for (const ro of remoteOrders) {
          if (!remoteDeletedIdSet.has(ro.id)) {
            if (localDeletedSet.has(ro.id)) {
              localDeletedSet.delete(ro.id);
              tombstonesCleaned = true;
            }
          }
        }
        if (tombstonesCleaned && typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(DELETED_ORDERS_STORAGE_KEY, JSON.stringify(Array.from(localDeletedSet)));
          } catch {}
        }

        const validRemoteOrders = remoteOrders.filter(
          (ro) => !isDemoOrTestOrder(ro) && !localDeletedSet.has(ro.id)
        );

        // Process durable offline queue: only upload orders strictly keyed by ID
        const pendingQueueRaw = typeof window !== 'undefined' ? localStorage.getItem('albhurani_pending_sales_queue') : null;
        let pendingQueue: OrderBill[] = [];
        if (pendingQueueRaw) {
          try {
            const parsed = JSON.parse(pendingQueueRaw);
            if (Array.isArray(parsed)) pendingQueue = parsed;
          } catch {}
        }

        const remoteIdSet = new Set(validRemoteOrders.map((o) => o.id));

        const ordersToUpload = pendingQueue.filter(
          (po) => po && po.id && !remoteIdSet.has(po.id)
        );

        if (ordersToUpload.length > 0) {
          const uploadedOk = await batchSaveOrdersToTurso(ordersToUpload);
          if (uploadedOk && typeof window !== 'undefined') {
            const uploadedIdSet = new Set(ordersToUpload.map((uo) => uo.id));
            const remaining = pendingQueue.filter((po) => !uploadedIdSet.has(po.id));
            localStorage.setItem('albhurani_pending_sales_queue', JSON.stringify(remaining));
          }
        }

        // Canonical server orders + preserved local pending orders (NEVER wipe unconfirmed local orders!)
        setOrders((currentOrders) => {
          const localPending = (currentOrders || []).filter(
            (co) => co && co.id && !remoteIdSet.has(co.id) && !localDeletedSet.has(co.id)
          );
          const combined = [...localPending, ...validRemoteOrders];
          combined.sort((a, b) => {
            const tA = a.timestamp || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const tB = b.timestamp || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            return tB - tA;
          });
          try {
            localStorage.setItem('albhurani_orders', JSON.stringify(combined));
          } catch {}
          return combined;
        });
      }

      // 3. Synchronize expenses
      if (remoteExpenses !== null) {
        const localSaved = typeof window !== 'undefined' ? localStorage.getItem('albhurani_expenses') : null;
        let localExpenses: ExpenseItem[] = [];
        if (localSaved) {
          try {
            const parsed = JSON.parse(localSaved);
            if (Array.isArray(parsed)) localExpenses = parsed;
          } catch {}
        }
        const remoteExpSet = new Set(remoteExpenses.map((e) => e.id));
        const unsyncedExp = localExpenses.filter((le) => le && le.id && !remoteExpSet.has(le.id));
        for (const exp of unsyncedExp) {
          await saveExpenseToTurso(exp).catch(() => {});
        }
        const mergedExpenses = [...remoteExpenses, ...unsyncedExp];
        setExpenses(mergedExpenses);
        try {
          localStorage.setItem('albhurani_expenses', JSON.stringify(mergedExpenses));
        } catch {}
      }

      // 4. Synchronize customers
      if (remoteCustomers && remoteCustomers.length > 0) {
        setCustomers(remoteCustomers);
      }

      // 5. Synchronize shared settings
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

      // 6. Synchronize customer orders (advance bookings)
      if (remoteCustomerOrders !== null) {
        const localSavedOrders = getSavedCustomerOrders();
        const remoteMap = new Map(remoteCustomerOrders.map((o) => [o.id, o]));
        const unsynced = localSavedOrders.filter((lo) => !remoteMap.has(lo.id));
        for (const u of unsynced) {
          await saveCustomerOrderToTurso(u).catch(() => {});
        }
        const merged = [...remoteCustomerOrders, ...unsynced];
        setCustomerOrders(merged);
        saveCustomerOrdersLocally(merged);
      }

      // 7. Synchronize categories
      if (remoteCategories !== null && remoteCategories.length > 0) {
        const localSavedCats = getSavedCategories(productsRef.current);
        const remoteCatMap = new Map(remoteCategories.map((c) => [c.id, c]));
        const unsyncedCats = localSavedCats.filter((lc) => !remoteCatMap.has(lc.id));
        for (const uc of unsyncedCats) {
          await saveCategoryToTurso(uc).catch(() => {});
        }
        const mergedCats = [...remoteCategories, ...unsyncedCats];
        setCategories(mergedCats);
        saveCategoriesLocally(mergedCats);
      } else if (remoteCategories !== null && remoteCategories.length === 0) {
        const localCats = getSavedCategories(productsRef.current);
        for (const c of localCats) {
          await saveCategoryToTurso(c).catch(() => {});
        }
        setCategories(localCats);
      }

      // 8. Synchronize Purchase Bills and Vendors
      try {
        if (remotePurchases !== null && Array.isArray(remotePurchases)) {
          setPurchaseBills(remotePurchases);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('albhurani_purchase_bills', JSON.stringify(remotePurchases));
            } catch {}
          }
        }
        if (remoteVendors !== null && Array.isArray(remoteVendors)) {
          setVendors(remoteVendors);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('albhurani_vendors', JSON.stringify(remoteVendors));
            } catch {}
          }
        }
      } catch (purErr) {
        console.warn('Could not sync purchase bills from Turso:', purErr);
      }
    } catch (err) {
      console.warn('Could not sync remote data from Turso:', err);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem('albhurani_pos_test_mode');
    } catch {}

    // Strictly gate data sync behind authentication: unauthenticated login screen makes 0 database reads
    if (!isAuthenticated) return;

    syncRemoteData();

    // Start background sync manager scoped by active branch (event-driven delta feed)
    syncManager.setBranch(activeBranch);
    syncManager.start(30000);

    // Subscribe to sync health state
    const unsubSyncState = syncManager.onSyncStateChange(setSyncState); // 30-second active background delta heartbeat with adaptive idle backoff

    // On network reconnect, perform single catch-up sync for durable recovery
    const handleOnlineReconnect = () => {
      if (!isAuthenticated) return;
      syncRemoteData(false);
      syncManager.flushPendingQueue();
      syncManager.pollForEvents();
    };

    window.addEventListener('online', handleOnlineReconnect);

    // Listen for real-time events from other devices
    const unsubOrder = syncManager.subscribe('order', (ev) => {
      if (ev.operation === 'save' && ev.payload) {
        setOrders((prev) => {
          const exists = prev.some((o) => o.id === ev.payload.id);
          // Deduct product stock locally for incoming remote order
          if (!exists && Array.isArray(ev.payload.items) && ev.payload.items.length > 0) {
            setProducts((prevProds) => {
              const updatedProds = prevProds.map((p) => {
                const sold = ev.payload.items.find((it: any) =>
                  (it.product?.id === p.id) || (it.id === p.id) ||
                  (it.product?.barcode && it.product.barcode === p.barcode) ||
                  (it.barcode && it.barcode === p.barcode)
                );
                if (!sold) return p;
                const isWeight = p.unit === 'KG';
                const newStock = deductStock(p.stock ?? 0, Number(sold.quantity) || 0, isWeight);
                return { ...p, stock: newStock };
              });
              try {
                localStorage.setItem('albhurani_products', JSON.stringify(updatedProds));
              } catch {}
              return updatedProds;
            });
          }

          const updated = exists
            ? prev.map((o) => (o.id === ev.payload.id ? ev.payload : o))
            : [ev.payload, ...prev];
          try {
            localStorage.setItem('albhurani_orders', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      } else if (ev.operation === 'delete' && ev.payload) {
        const delId = ev.payload.orderId || ev.entityId;
        setOrders((prev) => {
          const filtered = prev.filter((o) => o.id !== delId);
          try {
            localStorage.setItem('albhurani_orders', JSON.stringify(filtered));
          } catch {}
          return filtered;
        });
      } else if (ev.operation === 'batch_save' || ev.operation === 'clear_orders') {
        const branchToQuery = activeBranchRef.current || 'godi_road';
        fetchOrdersFromTurso('ALL', branchToQuery, true).then((freshOrders) => {
          if (freshOrders) {
            setOrders((prev) => {
              const remoteIdSet = new Set(freshOrders.map((o) => o.id));
              const localPending = prev.filter((o) => !remoteIdSet.has(o.id));
              const combined = [...localPending, ...freshOrders];
              combined.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
              try {
                localStorage.setItem('albhurani_orders', JSON.stringify(combined));
              } catch {}
              return combined;
            });
          }
        });
      }
    });

    const unsubProduct = syncManager.subscribe('product', (ev) => {
      if (ev.operation === 'save' && ev.payload) {
        // Immediate local state update for zero-latency cross-device feedback
        if (ev.payload.id) {
          setProducts((prev) => {
            const existing = prev.find((p) => p.id === ev.payload.id || (p.barcode && p.barcode === ev.payload.barcode));
            const mergedBranchStock = {
              ...(existing?.branchStock || {}),
              ...(ev.payload.branchStock || {}),
            };
            if (ev.payload.branch && typeof ev.payload.stock === 'number') {
              mergedBranchStock[ev.payload.branch] = ev.payload.stock;
            }
            const activeStock = mergedBranchStock[activeBranch] ?? existing?.stock ?? ev.payload.stock ?? 0;
            const clean = {
              ...ev.payload,
              stock: activeStock,
              branchStock: mergedBranchStock,
              isActive: true,
            };
            const next = existing ? prev.map((p) => (p.id === clean.id ? clean : p)) : [clean, ...prev];
            try {
              localStorage.setItem('albhurani_products', JSON.stringify(next));
            } catch {}
            return next;
          });
        }
      } else if (ev.operation === 'stock' && ev.payload) {
        const { productId, stock, branch: eventBranch } = ev.payload;
        if (productId && typeof stock === 'number') {
          setProducts((prev) => {
            const next = prev.map((p) => {
              if (p.id !== productId) return p;
              const targetBranch = eventBranch || 'godi_road';
              const updatedBranchStock = {
                ...(p.branchStock || {}),
                [targetBranch]: stock,
              };
              return {
                ...p,
                stock: targetBranch === activeBranch ? stock : p.stock,
                branchStock: updatedBranchStock,
              };
            });
            try {
              localStorage.setItem('albhurani_products', JSON.stringify(next));
            } catch {}
            return next;
          });
        }
      } else if (ev.operation === 'delete') {
        const prodId = ev.entityId || ev.payload?.productId;
        setProducts((prev) => {
          const next = prev.filter((p) => p.id !== prodId);
          try {
            localStorage.setItem('albhurani_products', JSON.stringify(next));
          } catch {}
          return next;
        });
      }
    });

    const unsubExpense = syncManager.subscribe('expense', (ev) => {
      if (ev.operation === 'save' && ev.payload) {
        setExpenses((prev) => {
          const exists = prev.some((e) => e.id === ev.payload.id);
          const next = exists ? prev.map((e) => (e.id === ev.payload.id ? ev.payload : e)) : [ev.payload, ...prev];
          try {
            localStorage.setItem('albhurani_expenses', JSON.stringify(next));
          } catch {}
          return next;
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
        setCustomers((prev) => {
          const exists = prev.some((c) => c.id === ev.payload.id || (ev.payload.phone && c.phone === ev.payload.phone));
          return exists ? prev.map((c) => (c.id === ev.payload.id || c.phone === ev.payload.phone ? ev.payload : c)) : [ev.payload, ...prev];
        });
      }
    });

    const unsubPurchase = syncManager.subscribe('purchase_bill' as any, (ev) => {
      if (ev.operation === 'save' && ev.payload) {
        setPurchaseBills((prev) => {
          const exists = prev.some((b) => b.id === ev.payload.id || (ev.payload.purchaseNumber && b.purchaseNumber === ev.payload.purchaseNumber));
          const next = exists ? prev.map((b) => (b.id === ev.payload.id || b.purchaseNumber === ev.payload.purchaseNumber ? ev.payload : b)) : [ev.payload, ...prev];
          try {
            localStorage.setItem('albhurani_purchase_bills', JSON.stringify(next));
          } catch {}
          return next;
        });
      } else if (ev.operation === 'delete' && ev.entityId) {
        setPurchaseBills((prev) => {
          const next = prev.filter((b) => b.id !== ev.entityId && b.purchaseNumber !== ev.entityId);
          try {
            localStorage.setItem('albhurani_purchase_bills', JSON.stringify(next));
          } catch {}
          return next;
        });
      }
    });

    const unsubCustomerOrder = syncManager.subscribe('customer_order', (ev) => {
      if (ev.operation === 'save' && ev.payload) {
        setCustomerOrders((prev) => {
          const exists = prev.some((o) => o.id === ev.payload.id || o.orderNumber === ev.payload.orderNumber);
          const next = exists
            ? prev.map((o) => (o.id === ev.payload.id || o.orderNumber === ev.payload.orderNumber ? ev.payload : o))
            : [ev.payload, ...prev];
          saveCustomerOrdersLocally(next);
          return next;
        });
      } else if (ev.operation === 'delete') {
        setCustomerOrders((prev) => {
          const next = prev.filter((o) => o.id !== ev.entityId);
          saveCustomerOrdersLocally(next);
          return next;
        });
      }
    });

    const unsubCategory = syncManager.subscribe('category', (ev) => {
      if (ev.operation === 'save' && ev.payload) {
        setCategories((prev) => {
          const exists = prev.some((c) => c.id === ev.payload.id || c.name.toLowerCase() === ev.payload.name.toLowerCase());
          const next = exists
            ? prev.map((c) => (c.id === ev.payload.id ? ev.payload : c))
            : [...prev, ev.payload];
          saveCategoriesLocally(next);
          return next;
        });
      } else if (ev.operation === 'rename' && ev.payload) {
        setCategories((prev) => {
          const next = prev.map((c) => (c.id === ev.payload.id ? ev.payload : c));
          saveCategoriesLocally(next);
          return next;
        });
        if (ev.payload.oldName && ev.payload.name) {
          setProducts((prev) => {
            const nextProds = prev.map((p) => p.category === ev.payload.oldName ? { ...p, category: ev.payload.name } : p);
            try {
              localStorage.setItem('albhurani_products', JSON.stringify(nextProds));
            } catch {}
            return nextProds;
          });
        }
      } else if (ev.operation === 'delete') {
        setCategories((prev) => {
          const next = prev.filter((c) => c.id !== ev.entityId);
          saveCategoriesLocally(next);
          return next;
        });
      }
    });

    return () => {
      window.removeEventListener('online', handleOnlineReconnect);
      syncManager.stop();
      unsubSyncState();
      unsubOrder();
      unsubProduct();
      unsubExpense();
      unsubSettings();
      unsubCustomer();
      unsubPurchase();
      unsubCustomerOrder();
      unsubCategory();
    };
  }, [isAuthenticated]);

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
      syncManager.setBranch(activeBranch);
    } catch {}
  }, [currentUser, isAuthenticated, activeBranch]);

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
    if (orders.some((o) => o.id === newOrder.id)) {
      return { success: false, error: `Duplicate order: ${newOrder.billNumber} is already recorded` };
    }

    // 3. Immediately assign IST business date, branch, and sequential daily bill number (1, 2, 3... N)
    const todayKolkata = getKolkataDateString(newOrder.timestamp || Date.now());
    if (!newOrder.businessDate) {
      newOrder.businessDate = todayKolkata;
    }
    if (!newOrder.branch) {
      newOrder.branch = activeBranch;
    }
    if (!newOrder.dailyBillNumber || newOrder.dailyBillNumber <= 0) {
      const todayBills = orders.filter((o) => {
        const oBranch = o.branch || 'godi_road';
        if (oBranch !== activeBranch) return false;
        const oDate = o.businessDate || getKolkataDateString(extractOrderTimestamp(o) || Date.now());
        return oDate === todayKolkata;
      });
      const maxDaily = todayBills.reduce((max, b) => Math.max(max, b.dailyBillNumber || 0), 0);
      newOrder.dailyBillNumber = maxDaily + 1;
    }
    newOrder.billNumber = `Bill #${newOrder.dailyBillNumber}`;

    const updatedOrders = [newOrder, ...orders];

    // 4. Synchronous persistent write before confirming checkout success
    try {
      localStorage.setItem('albhurani_orders', JSON.stringify(updatedOrders));
    } catch (storageErr: any) {
      console.error('Failed to save to localStorage:', storageErr);
      return { 
        success: false, 
        error: `Storage failure: ${storageErr?.message || 'Storage quota exceeded'}` 
      };
    }

    // 5. Update component state immediately
    setOrders(updatedOrders);

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

    // 6. Persist to durable offline queue and trigger reliable retry worker.
    //    After the server confirms the bill number, reconcile React state so the
    //    UI shows the authoritative sequential number without a page reload.
    syncManager.enqueuePendingOrder(newOrder).then(() => {
      // newOrder.billNumber and .dailyBillNumber are mutated in-place by
      // saveOrderToTurso (turso.ts lines 555-556) once the server responds.
      // Re-apply the confirmed values to component state.
      setOrders((prev) =>
        prev.map((o) =>
          o.id === newOrder.id
            ? { ...o, billNumber: newOrder.billNumber, dailyBillNumber: newOrder.dailyBillNumber }
            : o
        )
      );
      try {
        const saved = localStorage.getItem('albhurani_orders');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const updated = parsed.map((o: OrderBill) =>
              o.id === newOrder.id
                ? { ...o, billNumber: newOrder.billNumber, dailyBillNumber: newOrder.dailyBillNumber }
                : o
            );
            localStorage.setItem('albhurani_orders', JSON.stringify(updated));
          }
        }
      } catch {}
    }).catch(() => {});

    // Deduct stock for sold items strictly for this order's branch (permits negative stock if sold beyond recorded stock)
    if (Array.isArray(newOrder.items) && newOrder.items.length > 0) {
      const orderBranch = newOrder.branch || activeBranch;
      setProducts((prev) => {
        const updated = prev.map((p) => {
          const sold = newOrder.items.find((it) => (it.product?.id === p.id) || (it.product?.barcode && it.product.barcode === p.barcode));
          if (!sold) return p;
          const isWeight = isWeightBasedProduct(p);
          const currentBranchStock = p.branchStock?.[orderBranch] ?? p.stock ?? 0;
          const newBranchStock = deductStock(currentBranchStock, Number(sold.quantity) || 0, isWeight);
          return {
            ...p,
            stock: orderBranch === activeBranch ? newBranchStock : p.stock,
            branchStock: {
              ...(p.branchStock || {}),
              [orderBranch]: newBranchStock,
            },
          };
        });
        try {
          localStorage.setItem('albhurani_products', JSON.stringify(updated));
        } catch {}
        return updated;
      });
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

  const handleDeleteOrder = async (orderId: string): Promise<boolean> => {
    const orderToDelete = orders.find((o) => o.id === orderId);
    const billNumber = orderToDelete?.billNumber;

    // 1. Immediately record in persistent tombstone storage to prevent resurrection on sync/refresh
    recordDeletedOrder(orderId, billNumber);

    // Restore stock for deleted order items
    if (orderToDelete && Array.isArray(orderToDelete.items) && orderToDelete.items.length > 0) {
      setProducts((prev) => {
        const updated = prev.map((p) => {
          const matched = orderToDelete.items.find((it) => (it.product?.id === p.id) || (it.product?.barcode && it.product.barcode === p.barcode));
          if (!matched) return p;
          const isWeight = p.unit === 'KG';
          const newStock = restoreStock(p.stock ?? 0, Number(matched.quantity) || 0, isWeight);
          return { ...p, stock: newStock };
        });
        try {
          localStorage.setItem('albhurani_products', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }

    // 2. Immediately update state and localStorage consistently (instant 0ms UI response)
    setOrders((prev) => {
      const updatedOrders = prev.filter((o) => o.id !== orderId);
      try {
        localStorage.setItem('albhurani_orders', JSON.stringify(updatedOrders));
      } catch (storageErr) {
        console.error('Failed to update localStorage after deleting order:', storageErr);
      }
      return updatedOrders;
    });

    // 3. Non-blocking background deletion in Turso database
    deleteOrderFromTurso(orderId, billNumber).catch((tursoErr) => {
      console.warn('Turso background deletion error (tombstone will clean on sync):', tursoErr);
    });

    return true;
  };

  const handleStartModifyOrder = (order: OrderBill) => {
    // Open in-place EditBillModal on the current screen (Sales Bills, Customer Bills, etc.)
    // Do NOT switch activeTab to 'pos' — owner edits right where they are!
    setEditingBillModalOrder(order);
    setEditingOrder(order);
  };

  const handleCancelModifyOrder = () => {
    setEditingOrder(null);
    setEditingBillModalOrder(null);
  };

  const handleSettleOrder = async (order: OrderBill): Promise<void> => {
    const settledOrder: OrderBill = {
      ...order,
      amountReceived: order.grandTotal,
      dueAmount: 0,
      isSettled: true,
      settledAt: new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
    };

    setOrders((prev) => {
      const updated = prev.map((o) => (o.id === order.id ? settledOrder : o));
      try {
        localStorage.setItem('albhurani_orders', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      await saveOrderToTurso(settledOrder);
    } catch (err) {
      console.warn('Error syncing settled order to Turso:', err);
    }
  };

  const handleSaveModifiedOrder = async (
    updatedOrder: OrderBill,
    originalOrder?: OrderBill
  ): Promise<CompleteSaleResult> => {
    try {
      // 1. Update orders array replacing the original order
      const updatedOrders = orders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));

      // 2. Persist to localStorage immediately
      if (typeof window !== 'undefined') {
        localStorage.setItem('albhurani_orders', JSON.stringify(updatedOrders));
      }

      setOrders(updatedOrders);
      setEditingOrder(null);
      setEditingBillModalOrder(null);

      // 3. Stock Adjustment Delta for Item Changes
      if (originalOrder && Array.isArray(originalOrder.items) && Array.isArray(updatedOrder.items)) {
        try {
          const adjustments = computeStockAdjustments(originalOrder.items, updatedOrder.items);
          if (adjustments.length > 0) {
            const orderBranch = updatedOrder.branch || originalOrder?.branch || activeBranch;
            setProducts((prevProducts) => {
              const updatedProducts = prevProducts.map((p) => {
                const adj = adjustments.find((a) => a.productId === p.id);
                if (!adj) return p;
                const isWeight = isWeightBasedProduct(p);
                const currentBranchStock = p.branchStock?.[orderBranch] ?? p.stock ?? 0;
                // deltaQuantity > 0 means items were added/increased (deduct from inventory)
                // deltaQuantity < 0 means items were removed/decreased (restore to inventory)
                const newBranchStock = adj.deltaQuantity > 0
                  ? deductStock(currentBranchStock, adj.deltaQuantity, isWeight)
                  : restoreStock(currentBranchStock, Math.abs(adj.deltaQuantity), isWeight);

                // Sync stock change to Turso for this specific branch
                adjustStockOnTurso(p.id, -adj.deltaQuantity, orderBranch).catch((err) =>
                  console.warn('Error adjusting stock on Turso during bill revision:', err)
                );

                return {
                  ...p,
                  stock: orderBranch === activeBranch ? newBranchStock : p.stock,
                  branchStock: {
                    ...(p.branchStock || {}),
                    [orderBranch]: newBranchStock,
                  },
                };
              });

              if (typeof window !== 'undefined') {
                try {
                  localStorage.setItem('albhurani_products', JSON.stringify(updatedProducts));
                } catch {}
              }
              return updatedProducts;
            });
          }
        } catch (stockErr) {
          console.warn('Error computing stock adjustments on bill edit:', stockErr);
        }
      }

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
        if (updatedCustomer) {
          saveCustomerToTurso(updatedCustomer).catch((err) =>
            console.warn('Turso saveCustomer background error:', err)
          );
        }
      }

      // 5. Remote backup if configured
      try {
        saveOrderToTurso(updatedOrder).then((success) => {
          if (success) {
            syncManager.broadcast({
              entityType: 'order',
              entityId: updatedOrder.id,
              operation: 'save',
              payload: { ...updatedOrder }
            });
          }
        }).catch((err) =>
          console.warn('Turso saveOrder background error:', err)
        );
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
    const prodWithBranchStock: Product = {
      ...newProduct,
      branchStock: {
        godi_road: activeBranch === 'godi_road' ? (newProduct.stock ?? 0) : 0,
        mg_road: activeBranch === 'mg_road' ? (newProduct.stock ?? 0) : 0,
        ...(newProduct.branchStock || {}),
      },
    };
    const updated = [prodWithBranchStock, ...products];
    setProducts(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('albhurani_products', JSON.stringify(updated));
    }
    const saved = await saveProductToTurso(prodWithBranchStock, activeBranch);
    if (!saved) {
      console.warn('Failed to persist new product to Turso cloud database');
      syncManager.setStatus('error');
    } else {
      syncManager.setStatus('connected');
    }
  };

  const handleUpdateStock = async (
    productId: string, 
    newStock: number, 
    reason = 'Manual adjustment', 
    actor = 'Admin',
    branch: string = activeBranch
  ): Promise<boolean> => {
    const prevProd = products.find(p => p.id === productId);
    const prevStock = prevProd ? (prevProd.branchStock?.[branch] ?? prevProd.stock ?? 0) : 0;

    setProducts((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== productId) return p;
        const updatedBranchStock = {
          ...(p.branchStock || {}),
          [branch]: newStock,
        };
        return {
          ...p,
          stock: branch === activeBranch ? newStock : p.stock,
          branchStock: updatedBranchStock,
        };
      });
      try {
        localStorage.setItem('albhurani_products', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    invalidateProductsCache();
    try {
      await updateStockOnTurso(productId, newStock, reason, actor, branch);
      syncManager.broadcast({
        entityType: 'product',
        entityId: productId,
        operation: 'stock',
        payload: { productId, stock: newStock, previousStock: prevStock, reason, actor, branch },
      });
      return true;
    } catch (err) {
      console.warn('Background Turso stock update error:', err);
      return false;
    }
  };

  const handleUpdateProduct = async (updatedProd: Product) => {
    const existing = products.find(p => p.id === updatedProd.id);
    const merged: Product = {
      ...updatedProd,
      // preserve branchStock across shared master updates
      branchStock: updatedProd.branchStock || existing?.branchStock || {
        godi_road: existing?.stock ?? 0,
        mg_road: 0,
      },
    };
    const updated = products.map((p) => (p.id === merged.id ? merged : p));
    setProducts(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('albhurani_products', JSON.stringify(updated));
    }
    const saved = await saveProductToTurso(merged, activeBranch);
    if (!saved) {
      console.warn('Failed to update product on Turso cloud database');
      syncManager.setStatus('error');
    } else {
      syncManager.setStatus('connected');
    }
  };

  const handleDeleteProduct = async (productId: string): Promise<boolean> => {
    const updated = products.filter((p) => p.id !== productId);
    setProducts(updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('albhurani_products', JSON.stringify(updated));
      } catch {}
    }
    const ok = await deleteProductFromTurso(productId);
    if (ok) {
      syncManager.broadcast({
        entityType: 'product',
        entityId: productId,
        operation: 'delete',
        payload: { productId },
      });
    }
    return ok;
  };

  // Customer Orders Handlers
  const handleCreateCustomerOrder = async (newOrder: CustomerOrder): Promise<boolean> => {
    try {
      const orderWithBranch = {
        ...newOrder,
        branch: newOrder.branch || activeBranch,
      };
      const updated = [orderWithBranch, ...customerOrders];
      setCustomerOrders(updated);
      saveCustomerOrdersLocally(updated);

      const ok = await saveCustomerOrderToTurso(orderWithBranch);
      if (!ok) {
        console.warn('Failed to save customer order to Turso cloud');
      }

      syncManager.broadcast({
        entityType: 'customer_order',
        operation: 'save',
        entityId: orderWithBranch.id,
        payload: orderWithBranch,
      });

      return true;
    } catch (err) {
      console.error('Error creating customer order:', err);
      return false;
    }
  };

  const handleUpdateCustomerOrder = async (updatedOrder: CustomerOrder): Promise<boolean> => {
    try {
      const updated = customerOrders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
      setCustomerOrders(updated);
      saveCustomerOrdersLocally(updated);

      const ok = await saveCustomerOrderToTurso(updatedOrder);
      if (!ok) {
        console.warn('Failed to update customer order on Turso cloud');
      }

      syncManager.broadcast({
        entityType: 'customer_order',
        operation: 'save',
        entityId: updatedOrder.id,
        payload: updatedOrder,
      });

      return true;
    } catch (err) {
      console.error('Error updating customer order:', err);
      return false;
    }
  };

  const handleUpdateCustomerOrderStatus = async (
    orderId: string,
    status: CustomerOrderStatus
  ): Promise<boolean> => {
    try {
      const target = customerOrders.find((o) => o.id === orderId);
      if (!target) return false;

      const updatedOrder: CustomerOrder = {
        ...target,
        status,
        updatedAt: new Date().toISOString(),
      };

      const updated = customerOrders.map((o) => (o.id === orderId ? updatedOrder : o));
      setCustomerOrders(updated);
      saveCustomerOrdersLocally(updated);

      const ok = await updateCustomerOrderStatusOnTurso(orderId, status);
      if (!ok) {
        console.warn('Failed to update customer order status on Turso');
      }

      syncManager.broadcast({
        entityType: 'customer_order',
        operation: 'save',
        entityId: orderId,
        payload: updatedOrder,
      });

      return true;
    } catch (err) {
      console.error('Error updating customer order status:', err);
      return false;
    }
  };

  const handleCancelCustomerOrder = async (orderId: string): Promise<boolean> => {
    return handleUpdateCustomerOrderStatus(orderId, 'Cancelled');
  };

  // Categories Handlers
  const handleAddCategory = async (newCategory: CategoryItem): Promise<boolean> => {
    try {
      const exists = categories.some(
        (c) => c.name.trim().toLowerCase() === newCategory.name.trim().toLowerCase()
      );
      if (exists) {
        return false;
      }

      const updated = [...categories, newCategory];
      setCategories(updated);
      saveCategoriesLocally(updated);

      const ok = await saveCategoryToTurso(newCategory);
      if (!ok) {
        console.warn('Failed to save category to Turso cloud');
      }

      syncManager.broadcast({
        entityType: 'category',
        operation: 'save',
        entityId: newCategory.id,
        payload: newCategory,
      });

      return true;
    } catch (err) {
      console.error('Error adding category:', err);
      return false;
    }
  };

  const handleUpdateCategory = async (
    updatedCategory: CategoryItem,
    oldName?: string
  ): Promise<boolean> => {
    try {
      const updated = categories.map((c) => (c.id === updatedCategory.id ? updatedCategory : c));
      setCategories(updated);
      saveCategoriesLocally(updated);

      if (oldName && oldName !== updatedCategory.name) {
        // Cascade rename to existing products in memory & localStorage
        const updatedProducts = products.map((p) =>
          p.category === oldName ? { ...p, category: updatedCategory.name } : p
        );
        setProducts(updatedProducts);
        try {
          localStorage.setItem('albhurani_products', JSON.stringify(updatedProducts));
        } catch {}

        await renameCategoryOnTurso(updatedCategory.id, updatedCategory.name, oldName);
      } else {
        await saveCategoryToTurso(updatedCategory);
      }

      syncManager.broadcast({
        entityType: 'category',
        operation: 'rename',
        entityId: updatedCategory.id,
        payload: { ...updatedCategory, oldName },
      });

      return true;
    } catch (err) {
      console.error('Error updating category:', err);
      return false;
    }
  };

  const handleToggleCategoryActive = async (categoryId: string): Promise<boolean> => {
    try {
      const target = categories.find((c) => c.id === categoryId);
      if (!target) return false;

      const updatedCat: CategoryItem = {
        ...target,
        isActive: !target.isActive,
        updatedAt: new Date().toISOString(),
      };

      const updated = categories.map((c) => (c.id === categoryId ? updatedCat : c));
      setCategories(updated);
      saveCategoriesLocally(updated);

      await saveCategoryToTurso(updatedCat);

      syncManager.broadcast({
        entityType: 'category',
        operation: 'save',
        entityId: categoryId,
        payload: updatedCat,
      });

      return true;
    } catch (err) {
      console.error('Error toggling category status:', err);
      return false;
    }
  };

  const handleAddExpense = (newExpense: ExpenseItem) => {
    const expenseWithBranch: ExpenseItem = {
      ...newExpense,
      branch: newExpense.branch || activeBranch,
    };
    setExpenses((prev) => [expenseWithBranch, ...prev]);
    // Persist to cloud database for cross-device sync
    saveExpenseToTurso(expenseWithBranch).catch((err) =>
      console.warn('Turso saveExpense background error:', err)
    );
  };

  const handleSavePurchaseBill = async (bill: PurchaseBill): Promise<boolean> => {
    try {
      const billId = bill.id || `pb-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const istDate = bill.businessDate || getKolkataDateString();
      const dailyNum = bill.dailyBillNumber || (purchaseBills.filter((b) => (b.businessDate || b.purchaseDate || '').slice(0, 10) === istDate).length + 1);

      const billWithBranch: PurchaseBill = {
        ...bill,
        id: billId,
        dailyBillNumber: dailyNum,
        purchaseNumber: bill.purchaseNumber || `Bill #${dailyNum}`,
        branch: bill.branch || activeBranch,
        createdAt: bill.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 1. Instant local state & localStorage update (< 5ms)
      setPurchaseBills((prev) => {
        const idx = prev.findIndex((b) => b.id === billWithBranch.id);
        let next;
        if (idx >= 0) {
          next = [...prev];
          next[idx] = billWithBranch;
        } else {
          next = [billWithBranch, ...prev];
        }
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('albhurani_purchase_bills', JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      // 2. Inward stock addition with duplicate prevention and delta calculation
      if (billWithBranch.items && billWithBranch.items.length > 0) {
        const existingBill = purchaseBills.find((b) => b.id === billWithBranch.id);
        const oldQtyMap: Record<string, number> = {};
        if (existingBill && Array.isArray(existingBill.items)) {
          for (const item of existingBill.items) {
            const key = item.productId || item.productName.trim().toLowerCase();
            oldQtyMap[key] = (oldQtyMap[key] || 0) + Number(item.quantity || 0);
          }
        }

        const newQtyMap: Record<string, number> = {};
        for (const item of billWithBranch.items) {
          const key = item.productId || item.productName.trim().toLowerCase();
          newQtyMap[key] = (newQtyMap[key] || 0) + Number(item.quantity || 0);
        }

        const purchaseBranch = billWithBranch.branch || activeBranch;
        setProducts((prev) => {
          let updated = [...prev];
          for (const item of billWithBranch.items) {
            const key = item.productId || item.productName.trim().toLowerCase();
            const oldQty = oldQtyMap[key] || 0;
            const newQty = newQtyMap[key] || 0;
            const delta = newQty - oldQty;

            const matchedIdx = updated.findIndex((p) => (item.productId && p.id === item.productId) || p.name.trim().toLowerCase() === item.productName.trim().toLowerCase());
            if (matchedIdx >= 0) {
              if (delta !== 0) {
                const targetProd = updated[matchedIdx];
                const prevBranchStock = targetProd.branchStock?.[purchaseBranch] ?? targetProd.stock ?? 0;
                const newBranchStock = prevBranchStock + delta;
                updated[matchedIdx] = {
                  ...targetProd,
                  stock: purchaseBranch === activeBranch ? newBranchStock : targetProd.stock,
                  branchStock: {
                    ...(targetProd.branchStock || {}),
                    [purchaseBranch]: newBranchStock,
                  },
                  costPrice: Number(item.unitPrice) > 0 ? Number(item.unitPrice) : targetProd.costPrice,
                };
              }
            } else {
              const newP: Product = {
                id: item.productId || `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                sku: `PUR-${Math.floor(1000 + Math.random() * 9000)}`,
                barcode: String(Math.floor(100000000000 + Math.random() * 900000000000)),
                name: item.productName.trim(),
                category: 'General',
                unit: (item.unit as any) || 'PCS',
                costPrice: Number(item.unitPrice) || 0,
                sellingPrice: Math.round((Number(item.unitPrice) || 0) * 1.25) || 100,
                stock: purchaseBranch === activeBranch ? (Number(item.quantity) || 0) : 0,
                branchStock: {
                  godi_road: purchaseBranch === 'godi_road' ? (Number(item.quantity) || 0) : 0,
                  mg_road: purchaseBranch === 'mg_road' ? (Number(item.quantity) || 0) : 0,
                },
                minStock: 5,
                isActive: true,
              };
              updated = [newP, ...updated];
            }
          }
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('albhurani_products', JSON.stringify(updated));
            } catch {}
          }
          return updated;
        });
      }

      invalidateProductsCache();

      // 3. Instant vendor balance update
      if (billWithBranch.vendorId) {
        setVendors((prev) => {
          const updated = prev.map((v) => {
            if (v.id !== billWithBranch.vendorId) return v;
            return { ...v, balanceDue: (v.balanceDue || 0) + (billWithBranch.balanceDue || 0) };
          });
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('albhurani_vendors', JSON.stringify(updated));
            } catch {}
          }
          return updated;
        });
      }

      // 4. Background Turso persistence without blocking cashier / owner UI
      void (async () => {
        try {
          const saved = await savePurchaseBillToTurso(billWithBranch);
          if (saved) {
            setPurchaseBills((prev) => {
              const idx = prev.findIndex((b) => b.id === saved.id || b.id === billWithBranch.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = saved;
                try {
                  localStorage.setItem('albhurani_purchase_bills', JSON.stringify(next));
                } catch {}
                return next;
              }
              return prev;
            });
          }
        } catch (err) {
          console.warn('Background purchase sync error (offline cached):', err);
        }
      })();

      return true;
    } catch (err) {
      console.error('Error saving purchase bill:', err);
      return false;
    }
  };

  const handleCancelPurchaseBill = async (billId: string): Promise<boolean> => {
    try {
      const cancelledBill = purchaseBills.find((b) => b.id === billId);
      if (!cancelledBill || cancelledBill.status === 'Cancelled') {
        // Prevent duplicate stock reversals if bill is already cancelled
        return true;
      }

      // 1. Instant local update
      setPurchaseBills((prev) => {
        const next = prev.map((b) => (b.id === billId ? { ...b, status: 'Cancelled' as const } : b));
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('albhurani_purchase_bills', JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      // 2. Instant inward stock reversal locally (permits negative stock if sold)
      if (cancelledBill.items && cancelledBill.items.length > 0) {
        const purchaseBranch = cancelledBill.branch || activeBranch;
        setProducts((prev) => {
          const updated = prev.map((p) => {
            const matched = cancelledBill.items.find((item) => item.productId === p.id);
            if (!matched) return p;
            const prevBranchStock = p.branchStock?.[purchaseBranch] ?? p.stock ?? 0;
            const newBranchStock = prevBranchStock - Number(matched.quantity || 0);
            return {
              ...p,
              stock: purchaseBranch === activeBranch ? newBranchStock : p.stock,
              branchStock: {
                ...(p.branchStock || {}),
                [purchaseBranch]: newBranchStock,
              },
            };
          });
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('albhurani_products', JSON.stringify(updated));
            } catch {}
          }
          return updated;
        });
      }

      // 3. Background Turso cancellation
      void cancelPurchaseBillOnTurso(billId);
      return true;
    } catch (err) {
      console.error('Error cancelling purchase bill:', err);
      return false;
    }
  };

  const handleDeletePurchaseBill = async (billId: string): Promise<boolean> => {
    try {
      const billToDelete = purchaseBills.find((b) => b.id === billId);

      // 1. Instant local deletion (< 5ms)
      setPurchaseBills((prev) => {
        const next = prev.filter((b) => b.id !== billId);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('albhurani_purchase_bills', JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      // 2. Instant stock reversal locally if not already cancelled (permits negative stock)
      if (billToDelete && billToDelete.items && billToDelete.items.length > 0 && billToDelete.status !== 'Cancelled') {
        const purchaseBranch = billToDelete.branch || activeBranch;
        setProducts((prev) => {
          const updated = prev.map((p) => {
            const matched = billToDelete.items.find((item) => item.productId === p.id);
            if (!matched) return p;
            const prevBranchStock = p.branchStock?.[purchaseBranch] ?? p.stock ?? 0;
            const newBranchStock = prevBranchStock - Number(matched.quantity || 0);
            return {
              ...p,
              stock: purchaseBranch === activeBranch ? newBranchStock : p.stock,
              branchStock: {
                ...(p.branchStock || {}),
                [purchaseBranch]: newBranchStock,
              },
            };
          });
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('albhurani_products', JSON.stringify(updated));
            } catch {}
          }
          return updated;
        });
      }

      // 3. Background Turso deletion
      void deletePurchaseBillOnTurso(billId);
      return true;
    } catch (err) {
      console.error('Error deleting purchase bill:', err);
      return false;
    }
  };

  const handleAddVendorPayment = async (payment: VendorPayment): Promise<boolean> => {
    try {
      const ok = await addVendorPaymentOnTurso(payment);
      if (ok) {
        setPurchaseBills((prev) => {
          const next = prev.map((b) => {
            if (b.id === payment.purchaseBillId) {
              const newAmountPaid = (b.amountPaid || 0) + payment.amount;
              const newBalanceDue = Math.max(0, (b.grandTotal || 0) - newAmountPaid);
              const newStatus: 'Paid' | 'Partially Paid' | 'Unpaid' =
                newBalanceDue <= 0.01 ? 'Paid' : newAmountPaid > 0 ? 'Partially Paid' : 'Unpaid';
              const existingPayments = b.payments || [];
              return {
                ...b,
                amountPaid: newAmountPaid,
                balanceDue: newBalanceDue,
                paymentStatus: newStatus,
                payments: [...existingPayments, payment],
              };
            }
            return b;
          });
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('albhurani_purchase_bills', JSON.stringify(next));
            } catch {}
          }
          return next;
        });

        // Refresh vendors in background
        fetchVendorsFromTurso().then((v) => {
          if (v) {
            setVendors(v);
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('albhurani_vendors', JSON.stringify(v));
              } catch {}
            }
          }
        }).catch(() => {});

        return true;
      }
      return false;
    } catch (err) {
      console.error('Error adding vendor payment:', err);
      return false;
    }
  };

  const handleSignOut = () => {
    terminateSession();
    setIsAuthenticated(false);
    setCurrentUser(DEFAULT_USER);
    setActiveTab('overview');
    setIsMobileMenuOpen(false);
    navigate('/admin', { replace: true });
  };

  const handleLoginSuccess = () => {
    const session = getCurrentSession();
    if (session) {
      setCurrentUser({
        id: session.user.id,
        name: session.user.name,
        role: session.user.role,
        counter: session.user.counter,
        branchId: session.user.branchId || 'godi_road',
        branchName: session.user.branchName || 'Godi Road',
      });
    }
    setIsAuthenticated(true);
    const targetTab = (route.type === 'admin' && route.subRoute) ? route.subRoute : 'overview';
    setActiveTab(targetTab);
    navigate(`/admin/${targetTab}`, { replace: true });
  };

  // 1. Future public business website landing page foundation
  if (route.type === 'public') {
    return (
      <PublicWebsite
        onNavigateToAdmin={() => navigate('/admin')}
        currentUser={isAuthenticated ? currentUser : null}
      />
    );
  }

  // 2. Admin portal login gate (unauthenticated users cannot view POS data)
  if (!isAuthenticated) {
    return (
      <LoginView 
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <div className="flex h-screen h-[100dvh] w-screen overflow-hidden bg-[#FAF8F5] text-[#1C1917] antialiased">
      
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        currentUser={currentUser}
        onViewPublicWebsite={() => navigate('/')}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen h-[100dvh] min-w-0 overflow-hidden bg-[#FAF8F5]">
        
        {/* Top Header */}
        <Header 
          activeTab={activeTab}
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
          currentUser={currentUser}
          onOpenSettings={() => handleTabChange('settings')}
          onSignOut={handleSignOut}
          onViewPublicWebsite={() => navigate('/')}
          onOpenBudgetDiagnostics={() => setIsBudgetModalOpen(true)}
          onOpenSyncHealth={() => setIsSyncHealthOpen(true)}
          syncState={syncState}
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
              orders={branchOrders}
              expenses={branchExpenses}
              customerOrders={branchCustomerOrders}
              onNavigateToTab={handleTabChange}
              onDeleteOrder={handleDeleteOrder}
              onModifyOrder={handleStartModifyOrder}
              onSettleOrder={handleSettleOrder}
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
              onNavigateToProducts={(code) => {
                setBarcodeToRegister(code || null);
                handleTabChange('product-management');
              }}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersView
              orders={branchCustomerOrders}
              products={products}
              currentUser={currentUser}
              onCreateOrder={handleCreateCustomerOrder}
              onUpdateOrder={handleUpdateCustomerOrder}
              onUpdateOrderStatus={handleUpdateCustomerOrderStatus}
              onCancelOrder={handleCancelCustomerOrder}
            />
          )}

          {activeTab === 'customer-bills' && (
            <CustomerBillsView 
              orders={branchOrders} 
              onDeleteOrder={handleDeleteOrder}
              onModifyOrder={handleStartModifyOrder}
              onSettleOrder={handleSettleOrder}
              onSyncNow={syncRemoteData}
              isSyncing={isSyncing}
            />
          )}

          {activeTab === 'no-bill-sales' && (
            <NoBillSalesView 
              orders={branchOrders} 
              onDeleteOrder={handleDeleteOrder}
              onModifyOrder={handleStartModifyOrder}
              onSettleOrder={handleSettleOrder}
              onSyncNow={syncRemoteData}
              isSyncing={isSyncing}
            />
          )}

          {activeTab === 'purchases' && (
            <PurchaseBillsView
              purchaseBills={branchPurchaseBills}
              vendors={vendors}
              products={products}
              onSavePurchaseBill={handleSavePurchaseBill}
              onCancelPurchaseBill={handleCancelPurchaseBill}
              onDeletePurchaseBill={handleDeletePurchaseBill}
              onAddVendorPayment={handleAddVendorPayment}
              onSyncNow={syncRemoteData}
              isSyncing={isSyncing}
            />
          )}

          {activeTab === 'product-management' && (
            <ProductManagementView
              products={products}
              categories={categories}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
              onUpdateStock={handleUpdateStock}
              actingUser="Admin"
              activeBranch={activeBranch}
              onOpenStickerModal={(p) => setStickerModalProduct(p)}
              onAddCategory={handleAddCategory}
              onUpdateCategory={handleUpdateCategory}
              onToggleCategoryActive={handleToggleCategoryActive}
              initialBarcodeToRegister={barcodeToRegister}
              onClearInitialBarcode={() => setBarcodeToRegister(null)}
            />
          )}

          {activeTab === 'label-studio' && currentUser.role === 'Owner' && (
            <LabelStudioView
              products={products}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpensesView
              expenses={branchExpenses}
              onAddExpense={handleAddExpense}
              purchaseBills={branchPurchaseBills}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              products={products}
              orders={branchOrders}
              expenses={branchExpenses}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              currentUser={currentUser}
              onChangeUser={setCurrentUser}
              productsCount={products.length}
              ordersCount={branchOrders.length}
              totalRevenue={branchOrders.reduce((sum: number, o: OrderBill) => sum + o.grandTotal, 0)}
              expensesCount={branchExpenses.length}
              totalExpenses={branchExpenses.reduce((sum: number, e: ExpenseItem) => sum + e.amount, 0)}
              savedCustomersCount={customers.length}
              onResetStoreData={handleResetStoreData}
            />
          )}
        </main>

        {/* Mobile Bottom Navigation Bar (Phones & Small Screens) */}
        <BottomNav
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />
      </div>

      {/* Barcode Thermal Sticker Modal */}
      <BarcodeStickerModal
        product={stickerModalProduct}
        onClose={() => setStickerModalProduct(null)}
      />

      {/* Turso 200M Shared Read Budget Diagnostic Modal */}
      <TursoBudgetModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
      />

      {/* Sync Health & Transaction Durability Modal */}
      <SyncHealthModal
        isOpen={isSyncHealthOpen}
        onClose={() => setIsSyncHealthOpen(false)}
        syncState={syncState}
        currentUser={currentUser}
        onForceReconcile={() => syncRemoteData(true)}
      />

      {/* In-Place Bill Editor Modal */}
      {editingBillModalOrder && (
        <EditBillModal
          isOpen={Boolean(editingBillModalOrder)}
          order={editingBillModalOrder}
          products={products}
          onClose={() => setEditingBillModalOrder(null)}
          onSave={handleSaveModifiedOrder}
        />
      )}

    </div>
  );
}

export default App;
