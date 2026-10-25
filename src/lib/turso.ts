import { Product, OrderBill, ExpenseItem, CustomerOrder, CustomerOrderStatus, CategoryItem, PurchaseBill, Vendor, VendorPayment } from '../types';
import { CustomerRecord } from './customers';
import { migrateCatalogPrices } from './catalogMigration';

/**
 * AL-BURHANI POS — Production Database Client
 * 
 * SECURITY ARCHITECTURE CONSTRAINTS:
 * 1. Database credentials (TURSO_DB_URL and TURSO_AUTH_TOKEN) MUST remain strictly server-side.
 * 2. NEVER import or bundle auth tokens into client JavaScript bundles.
 * 3. Client communicates securely with the serverless proxy endpoint `/api/db`.
 * 4. Write operations enforce role-based authorization headers.
 * 5. Offline fallback: If `/api/db` is unreachable, all POS operations gracefully fall back to localStorage.
 */

// Purge any legacy plain-text tokens from localStorage
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('albhurani_turso_token');
  } catch {}
}

const API_ENDPOINT = '/api/db';

// Shared In-Memory Caches & Deduplication to prevent runaway database reads
let productsCache: { data: Product[]; timestamp: number } | null = null;
let productsFetchPromise: Promise<Product[] | null> | null = null;
let lastProductsUpdatedAt: string | null = null;
const PRODUCTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let ordersCache: Map<string, { data: OrderBill[]; timestamp: number }> = new Map();
let ordersFetchPromise: Map<string, Promise<OrderBill[] | null>> = new Map();
const ORDERS_CACHE_TTL = 30 * 1000; // 30 seconds

let categoriesCache: { data: CategoryItem[]; timestamp: number } | null = null;
let categoriesFetchPromise: Promise<CategoryItem[] | null> | null = null;
let lastCategoriesUpdatedAt: string | null = null;
const CATEGORIES_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

let expensesCache: Map<string, { data: ExpenseItem[]; timestamp: number }> = new Map();
const EXPENSES_CACHE_TTL = 60 * 1000; // 60 seconds

let purchasesCache: Map<string, { data: PurchaseBill[]; timestamp: number }> = new Map();
const PURCHASES_CACHE_TTL = 60 * 1000; // 60 seconds

let customersCache: { data: CustomerRecord[]; timestamp: number } | null = null;
const CUSTOMERS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let vendorsCache: { data: Vendor[]; timestamp: number } | null = null;
const VENDORS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let settingsCache: { data: Record<string, any>; timestamp: number } | null = null;
const SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let deletedOrdersCache: { data: { id: string; billNumber?: string }[]; timestamp: number } | null = null;
let lastDeletedOrdersUpdatedAt: string | null = null;
let budgetStatusCache: { data: TursoBudgetStatus; timestamp: number } | null = null;
const BUDGET_STATUS_CACHE_TTL = 30 * 1000; // 30 seconds
const DELETED_ORDERS_CACHE_TTL = 60 * 1000; // 60 seconds

export function invalidateProductsCache() {
  productsCache = null;
}

export function invalidateOrdersCache(branch?: string) {
  if (branch) {
    for (const key of Array.from(ordersCache.keys())) {
      if (key.startsWith(`${branch}_`)) {
        ordersCache.delete(key);
      }
    }
  } else {
    ordersCache.clear();
  }
}

export function invalidateCategoriesCache() {
  categoriesCache = null;
}

export function invalidateExpensesCache() {
  expensesCache.clear();
}

export function invalidatePurchasesCache() {
  purchasesCache.clear();
}

export function invalidateCustomersCache() {
  customersCache = null;
}

export function invalidateVendorsCache() {
  vendorsCache = null;
}

export function invalidateSettingsCache() {
  settingsCache = null;
}

export function invalidateDeletedOrdersCache() {
  deletedOrdersCache = null;
}

export interface TursoConnectionStatus {
  isConnected: boolean;
  isConfigured: boolean;
  url: string;
  hasToken: boolean;
  error?: string;
  source: 'serverless' | 'offline';
}

/**
 * Checks server-side database proxy status
 */
export async function checkTursoConfig(): Promise<TursoConnectionStatus> {
  if (typeof window === 'undefined') {
    return {
      isConnected: false,
      isConfigured: false,
      url: 'serverless-proxy',
      hasToken: false,
      source: 'offline',
    };
  }

  try {
    const res = await fetch(`${API_ENDPOINT}?action=status`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (res.ok) {
      const data = await res.json();
      return {
        isConnected: Boolean(data.connected),
        isConfigured: Boolean(data.configured),
        url: 'Protected Server Proxy (/api/db)',
        hasToken: true,
        source: 'serverless',
      };
    }

    return {
      isConnected: false,
      isConfigured: false,
      url: 'Protected Server Proxy (/api/db)',
      hasToken: false,
      error: `Server endpoint returned ${res.status}`,
      source: 'offline',
    };
  } catch {
    return {
      isConnected: false,
      isConfigured: false,
      url: 'Offline / Static Client',
      hasToken: false,
      source: 'offline',
    };
  }
}

/**
 * Lightweight client proxy indicator for backwards compatibility.
 * Allows App.tsx to verify if remote sync is active.
 */
export function getTursoClient() {
  return {
    isServerlessProxy: true,
  };
}

/**
 * Fetch all products from remote database (with shared in-memory TTL caching and request deduplication)
 */
export async function fetchProductsFromTurso(forceRefresh = false): Promise<Product[] | null> {
  const now = Date.now();
  if (!forceRefresh && productsCache && (now - productsCache.timestamp < PRODUCTS_CACHE_TTL)) {
    return productsCache.data;
  }

  // Warm in-memory cache from valid existing localStorage data before making network requests
  if (!forceRefresh && !productsCache && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('albhurani_products');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          Array.isArray(parsed) &&
          parsed.length >= 250 &&
          parsed[0]?.id &&
          parsed[0]?.name &&
          typeof parsed[0]?.sellingPrice === 'number'
        ) {
          const { products: clean } = migrateCatalogPrices(parsed);
          productsCache = { data: clean, timestamp: now };
          return clean;
        }
      }
    } catch {}
  }

  if (productsFetchPromise) {
    return productsFetchPromise;
  }

  productsFetchPromise = (async () => {
    try {
      const sinceParam = (!forceRefresh && lastProductsUpdatedAt) ? `&since=${encodeURIComponent(lastProductsUpdatedAt)}` : '';
      const res = await fetch(`${API_ENDPOINT}?action=fetch-products${sinceParam}&_t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return null;

      const data = await res.json();
      if (!data.success) return null;
      if (data.notModified) {
        if (!productsCache && typeof window !== 'undefined') {
          try {
            const raw = localStorage.getItem('albhurani_products');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length > 0) {
                productsCache = { data: parsed, timestamp: Date.now() };
              }
            }
          } catch {}
        }
        if (productsCache) {
          productsCache.timestamp = Date.now();
          return productsCache.data;
        }
      }
      if (!Array.isArray(data.rows)) return null;
      if (data.lastUpdated) {
        lastProductsUpdatedAt = String(data.lastUpdated);
      }
      const products: Product[] = data.rows.map((row: any) => ({
        id: String(row.id),
        sku: String(row.sku || row.barcode),
        barcode: String(row.barcode),
        name: String(row.name),
        category: row.category as any,
        unit: String(row.unit),
        priceBasis: row.price_basis ? String(row.price_basis) : undefined,
        netWeight: row.net_weight ? String(row.net_weight) : undefined,
        costPrice: Number(row.cost_price),
        sellingPrice: Number(row.selling_price),
        stock: Number(row.stock),
        minStock: Number(row.min_stock),
        shelfLifeDays: Number(row.shelf_life_days || 90),
        batchNo: String(row.batch_no || ''),
        mfgDate: String(row.mfg_date || ''),
        expiryDate: String(row.expiry_date || ''),
        priceTiers: row.price_tiers ? (typeof row.price_tiers === 'string' ? JSON.parse(row.price_tiers) : row.price_tiers) : undefined,
        isActive: true,
      }));

      // Ensure remote products are converted to per-kg and cannot overwrite local state with stale rates
      const { products: cleanProducts } = migrateCatalogPrices(products);
      productsCache = { data: cleanProducts, timestamp: Date.now() };
      return cleanProducts;
    } catch {
      return null;
    } finally {
      productsFetchPromise = null;
    }
  })();

  return productsFetchPromise;
}

/**
 * Save / Update a product via serverless proxy
 */
export async function saveProductToTurso(product: Product): Promise<boolean> {
  invalidateProductsCache();
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'save-product',
        payload: product,
      }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

/**
 * Update stock on remote database
 */
/**
 * Batch save/backfill products to remote database
 */
export async function batchSaveProductsToTurso(products: Product[]): Promise<boolean> {
  invalidateProductsCache();
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'batch-save-products',
        payload: { products },
      }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

export async function updateStockOnTurso(productId: string, newStock: number): Promise<boolean> {
  invalidateProductsCache();
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'update-stock',
        payload: {
          productId,
          stock: newStock,
        },
      }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

/**
 * Atomically adjust stock by a delta value on the remote database.
 * Use negative delta for deductions (sales) and positive for additions (restocking).
 * This is safe for concurrent multi-device operations.
 */
export async function adjustStockOnTurso(productId: string, delta: number): Promise<{ success: boolean; stock?: number }> {
  invalidateProductsCache();
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'update-stock',
        payload: {
          productId,
          delta,
        },
      }),
    });

    if (!res.ok) return { success: false };
    const data = await res.json();
    return { success: Boolean(data.success), stock: data.stock };
  } catch {
    return { success: false };
  }
}

/**
 * Delete a product item from remote database
 */
export async function deleteProductFromTurso(productId: string): Promise<boolean> {
  invalidateProductsCache();
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'delete-product',
        payload: { productId },
      }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

/**
 * Fetch deleted order tombstones from remote database (with shared TTL cache)
 */
export async function fetchDeletedOrdersFromTurso(forceRefresh = false): Promise<{ id: string; billNumber?: string }[] | null> {
  const now = Date.now();
  if (!forceRefresh && deletedOrdersCache && (now - deletedOrdersCache.timestamp < DELETED_ORDERS_CACHE_TTL)) {
    return deletedOrdersCache.data;
  }

  try {
    const sinceParam = (!forceRefresh && lastDeletedOrdersUpdatedAt) ? `&since=${encodeURIComponent(lastDeletedOrdersUpdatedAt)}` : '';
    const res = await fetch(`${API_ENDPOINT}?action=fetch-deleted-orders${sinceParam}&_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.success) return null;
    if (data.notModified && deletedOrdersCache) {
      deletedOrdersCache.timestamp = Date.now();
      return deletedOrdersCache.data;
    }
    if (!Array.isArray(data.rows)) return null;
    if (data.lastDeleted) {
      lastDeletedOrdersUpdatedAt = String(data.lastDeleted);
    }
    const rows = data.rows.map((row: any) => ({
      id: String(row.id),
      billNumber: row.bill_number ? String(row.bill_number) : undefined,
    }));
    deletedOrdersCache = { data: rows, timestamp: Date.now() };
    return rows;
  } catch {
    return null;
  }
}

/**
 * Fetch orders from remote database (with branch-scoped caching & in-flight deduplication)
 */
export async function fetchOrdersFromTurso(
  transactionType?: 'CUSTOMER_BILL' | 'NO_BILL' | 'ALL',
  branch?: string,
  forceRefresh = false
): Promise<OrderBill[] | null> {
  const cacheKey = `${branch || 'all'}_${transactionType || 'all'}`;
  const now = Date.now();
  if (!forceRefresh && ordersCache.has(cacheKey)) {
    const cached = ordersCache.get(cacheKey)!;
    if (now - cached.timestamp < ORDERS_CACHE_TTL) {
      return cached.data;
    }
  }

  if (ordersFetchPromise.has(cacheKey)) {
    return ordersFetchPromise.get(cacheKey)!;
  }

  const promise = (async () => {
    try {
      const typeParam = transactionType && transactionType !== 'ALL' ? `&type=${transactionType}` : '';
      const branchParam = branch && branch !== 'ALL' ? `&branch=${branch}` : '';
      const res = await fetch(`${API_ENDPOINT}?action=fetch-orders${typeParam}${branchParam}&_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return null;

      const data = await res.json();
      if (!data.success || !Array.isArray(data.rows)) return null;

      const orders: OrderBill[] = data.rows.map((row: any) => ({
        id: String(row.id),
        billNumber: String(row.bill_number),
        transactionType: (row.transaction_type as any) || 'CUSTOMER_BILL',
        items: JSON.parse(String(row.items_json || '[]')),
        subtotal: Number(row.subtotal),
        discountAmount: Number(row.discount_amount),
        gstAmount: Number(row.gst_amount),
        grandTotal: Number(row.grand_total),
        paymentMethod: row.payment_method as any,
        amountReceived: Number(row.amount_received),
        changeGiven: Number(row.change_given),
        dueAmount: row.due_amount !== undefined && row.due_amount !== null ? Number(row.due_amount) : Math.max(0, Number(row.grand_total) - Number(row.amount_received || 0)),
        isSettled: row.is_settled !== undefined && row.is_settled !== null ? Boolean(row.is_settled) : undefined,
        customerName: row.customer_name ? String(row.customer_name) : undefined,
        customerPhone: row.customer_phone ? String(row.customer_phone) : undefined,
        cashierName: String(row.cashier_name),
        createdAt: String(row.created_at),
        timestamp: row.timestamp ? Number(row.timestamp) : (row.created_at ? new Date(row.created_at).getTime() : undefined),
        dailyBillNumber: row.daily_bill_number ? Number(row.daily_bill_number) : undefined,
        businessDate: row.business_date ? String(row.business_date) : undefined,
        isRevised: Boolean(row.is_revised),
        originalGrandTotal: row.original_grand_total ? Number(row.original_grand_total) : undefined,
        additionalAmountPaid: row.additional_amount_paid ? Number(row.additional_amount_paid) : undefined,
        originalPaymentMethod: row.original_payment_method as any,
        additionalPaymentMethod: row.additional_payment_method as any,
        revisedAt: row.revised_at ? String(row.revised_at) : undefined,
        revisedTimestamp: row.revised_timestamp ? Number(row.revised_timestamp) : undefined,
        revisionCount: row.revision_count ? Number(row.revision_count) : 0,
        branch: row.branch ? String(row.branch) : 'godi_road',
      }));

      ordersCache.set(cacheKey, { data: orders, timestamp: Date.now() });
      return orders;
    } catch {
      return null;
    } finally {
      ordersFetchPromise.delete(cacheKey);
    }
  })();

  ordersFetchPromise.set(cacheKey, promise);
  return promise;
}

/**
 * Save an order to remote database
 */
export async function saveOrderToTurso(order: OrderBill): Promise<boolean> {
  invalidateOrdersCache(order.branch);
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'save-order',
        payload: order,
      }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    if (data.success) {
      if (data.dailyBillNumber) order.dailyBillNumber = Number(data.dailyBillNumber);
      if (data.businessDate) order.businessDate = String(data.businessDate);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Batch save multiple orders to remote database (Used for cross-device synchronization and backfills)
 */
export async function batchSaveOrdersToTurso(orders: OrderBill[]): Promise<boolean> {
  if (!orders || orders.length === 0) return true;
  invalidateOrdersCache();
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'batch-save-orders',
        payload: orders,
      }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

/**
 * Delete a specific order from remote database
 */
export async function deleteOrderFromTurso(orderId: string, billNumber?: string): Promise<boolean> {
  invalidateOrdersCache();
  invalidateDeletedOrdersCache();
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'delete-order',
        payload: { orderId, billNumber },
      }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

/**
 * Restore a previously deleted order in remote database
 */
export async function restoreOrderInTurso(orderId: string, billNumber?: string): Promise<boolean> {
  invalidateOrdersCache();
  invalidateDeletedOrdersCache();
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'restore-order',
        payload: { orderId, billNumber },
      }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

/**
 * Check database reconciliation health and financial summary
 */
export async function checkDatabaseReconciliation(): Promise<any> {
  try {
    const res = await fetch(`${API_ENDPOINT}?action=reconcile-check&_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch expenses from remote database (with TTL caching)
 */
export async function fetchExpensesFromTurso(branch?: string, forceRefresh = false): Promise<ExpenseItem[] | null> {
  const cacheKey = branch || 'all';
  const now = Date.now();
  if (!forceRefresh && expensesCache.has(cacheKey)) {
    const cached = expensesCache.get(cacheKey)!;
    if (now - cached.timestamp < EXPENSES_CACHE_TTL) {
      return cached.data;
    }
  }

  try {
    const branchParam = branch && branch !== 'ALL' ? `&branch=${branch}` : '';
    const res = await fetch(`${API_ENDPOINT}?action=fetch-expenses${branchParam}&_t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.success || !Array.isArray(data.rows)) return null;

    const expenses: ExpenseItem[] = data.rows.map((row: any) => ({
      id: String(row.id),
      title: String(row.title),
      category: String(row.category),
      amount: Number(row.amount),
      date: String(row.date),
      paymentMode: row.payment_mode as any,
      paidTo: row.paid_to ? String(row.paid_to) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
      branch: row.branch ? String(row.branch) : 'godi_road',
    }));

    expensesCache.set(cacheKey, { data: expenses, timestamp: Date.now() });
    return expenses;
  } catch {
    return null;
  }
}

/**
 * Save expense to remote database
 */
export async function saveExpenseToTurso(expense: ExpenseItem): Promise<boolean> {
  invalidateExpensesCache();
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'save-expense',
        payload: expense,
      }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

/**
 * Fetch customers from remote database
 */
export async function fetchCustomersFromTurso(): Promise<CustomerRecord[] | null> {
  try {
    const res = await fetch(`${API_ENDPOINT}?action=fetch-customers&_t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.success || !Array.isArray(data.rows)) return null;

    return data.rows.map((row: any) => ({
      id: String(row.id),
      name: String(row.name || ''),
      phone: String(row.phone || ''),
      totalSpent: Number(row.total_spent || 0),
      totalVisits: Number(row.total_visits || 1),
      lastVisit: String(row.last_visit || ''),
      createdAt: String(row.created_at || ''),
    }));
  } catch {
    return null;
  }
}

/**
 * Save customer to remote database
 */
export async function saveCustomerToTurso(customer: CustomerRecord): Promise<boolean> {
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'save-customer',
        payload: customer,
      }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

/**
 * Fetch shared owner settings from remote database
 */
export async function fetchSettingsFromTurso(key?: string): Promise<Record<string, any> | null> {
  try {
    const keyParam = key ? `&key=${encodeURIComponent(key)}` : '';
    const res = await fetch(`${API_ENDPOINT}?action=fetch-settings${keyParam}`);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.success) return null;

    if (key) {
      return data.setting ? { [key]: data.setting.value } : null;
    }
    return data.settings || {};
  } catch {
    return null;
  }
}

/**
 * Save shared owner setting to remote database
 */
export async function saveSettingToTurso(key: string, value: any): Promise<boolean> {
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'save-setting',
        payload: { key, value },
      }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

/**
 * Reset all product stock to zero on remote database (Admin restricted)
 */
export async function resetAllStockOnTursoToZero(): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'reset-all-stock',
      }),
    });

    if (!res.ok) return { success: false, error: `Server error ${res.status}` };
    const data = await res.json();
    return { success: Boolean(data.success), count: data.count, error: data.error };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

/**
 * Delete all orders from remote database (Admin restricted)
 */
export async function clearOrdersFromTurso(): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'clear-orders',
      }),
    });

    if (!res.ok) return { success: false, error: `Server error ${res.status}` };
    const data = await res.json();
    return { success: Boolean(data.success), count: data.count, error: data.error };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

/**
 * Delete all expenses from remote database (Admin restricted)
 */
export async function clearExpensesFromTurso(): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'clear-expenses',
      }),
    });

    if (!res.ok) return { success: false, error: `Server error ${res.status}` };
    const data = await res.json();
    return { success: Boolean(data.success), count: data.count, error: data.error };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}
// ---------------------------------------------------------------------------
// Customer Booking & Scheduled Delivery Orders Remote API
// ---------------------------------------------------------------------------

/**
 * Fetch customer orders from remote database
 */
export async function fetchCustomerOrdersFromTurso(): Promise<CustomerOrder[] | null> {
  try {
    const res = await fetch(`${API_ENDPOINT}?action=fetch-customer-orders`);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.success || !Array.isArray(data.rows)) return null;

    const orders: CustomerOrder[] = data.rows.map((row: any) => ({
      id: String(row.id),
      orderNumber: String(row.order_number),
      customerName: String(row.customer_name),
      customerPhone: String(row.customer_phone),
      items: row.items_json ? (typeof row.items_json === 'string' ? JSON.parse(row.items_json) : row.items_json) : [],
      subtotal: Number(row.subtotal) || 0,
      discountAmount: Number(row.discount_amount) || 0,
      gstAmount: Number(row.gst_amount) || 0,
      totalAmount: Number(row.total_amount) || 0,
      advancePaid: Number(row.advance_paid) || 0,
      balanceDue: Number(row.balance_due) || 0,
      orderDate: String(row.order_date || ''),
      deliveryDate: String(row.delivery_date || ''),
      deliveryTime: row.delivery_time ? String(row.delivery_time) : undefined,
      deliveryAddress: row.delivery_address ? String(row.delivery_address) : undefined,
      status: row.status as CustomerOrderStatus,
      paymentMethod: row.payment_method ? String(row.payment_method) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
      branch: row.branch ? String(row.branch) : 'godi_road',
      createdAt: String(row.created_at || ''),
      updatedAt: row.updated_at ? String(row.updated_at) : undefined,
    }));

    return orders;
  } catch {
    return null;
  }
}

/**
 * Save / Update a customer order on remote database
 */
export async function saveCustomerOrderToTurso(order: CustomerOrder): Promise<boolean> {
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'save-customer-order',
        payload: order,
      }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

/**
 * Update customer order status on remote database
 */
export async function updateCustomerOrderStatusOnTurso(
  orderId: string,
  status: CustomerOrderStatus
): Promise<boolean> {
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'update-customer-order-status',
        payload: { orderId, status },
      }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

/**
 * Delete / Cancel customer order on remote database
 */
export async function deleteCustomerOrderFromTurso(orderId: string): Promise<boolean> {
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'delete-customer-order',
        payload: { orderId },
      }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Categories Remote API
// ---------------------------------------------------------------------------

/**
 * Fetch categories from remote database (with shared TTL cache & request deduplication)
 */
export async function fetchCategoriesFromTurso(forceRefresh = false): Promise<CategoryItem[] | null> {
  const now = Date.now();
  if (!forceRefresh && categoriesCache && (now - categoriesCache.timestamp < CATEGORIES_CACHE_TTL)) {
    return categoriesCache.data;
  }

  if (categoriesFetchPromise) return categoriesFetchPromise;

  categoriesFetchPromise = (async () => {
    try {
      const sinceParam = (!forceRefresh && lastCategoriesUpdatedAt) ? `&since=${encodeURIComponent(lastCategoriesUpdatedAt)}` : '';
      const res = await fetch(`${API_ENDPOINT}?action=fetch-categories${sinceParam}&_t=${Date.now()}`);
      if (!res.ok) return null;

      const data = await res.json();
      if (!data.success) return null;
      if (data.notModified) {
        if (!categoriesCache && typeof window !== 'undefined') {
          try {
            const raw = localStorage.getItem('albhurani_categories');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length > 0) {
                categoriesCache = { data: parsed, timestamp: Date.now() };
              }
            }
          } catch {}
        }
        if (categoriesCache) {
          categoriesCache.timestamp = Date.now();
          return categoriesCache.data;
        }
      }
      if (!Array.isArray(data.rows)) return null;
      if (data.lastUpdated) {
        lastCategoriesUpdatedAt = String(data.lastUpdated);
      }
      const categories: CategoryItem[] = data.rows.map((row: any) => ({
        id: String(row.id),
        name: String(row.name),
        description: row.description ? String(row.description) : '',
        isActive: Boolean(row.is_active !== 0),
        displayOrder: Number(row.display_order) || 0,
        createdAt: row.created_at ? String(row.created_at) : undefined,
        updatedAt: row.updated_at ? String(row.updated_at) : undefined,
      }));

      categoriesCache = { data: categories, timestamp: Date.now() };
      return categories;
    } catch {
      return null;
    } finally {
      categoriesFetchPromise = null;
    }
  })();

  return categoriesFetchPromise;
}

/**
 * Save / Update category on remote database
 */
export async function saveCategoryToTurso(category: CategoryItem): Promise<boolean> {
  invalidateCategoriesCache();
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'save-category',
        payload: category,
      }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

/**
 * Rename category on remote database and cascade to products
 */
export async function renameCategoryOnTurso(
  oldName: string,
  newName: string,
  categoryId?: string
): Promise<boolean> {
  invalidateCategoriesCache();
  invalidateProductsCache();
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'rename-category',
        payload: { oldName, newName, categoryId },
      }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

/**
 * Delete category from remote database
 */
export async function deleteCategoryFromTurso(categoryId: string): Promise<boolean> {
  invalidateCategoriesCache();
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'delete-category',
        payload: { categoryId },
      }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}


/**
 * Fetch all purchase bills from remote database (with TTL caching)
 */
export async function fetchPurchaseBillsFromTurso(branch?: string, forceRefresh = false): Promise<PurchaseBill[] | null> {
  const cacheKey = branch || 'all';
  const now = Date.now();
  if (!forceRefresh && purchasesCache.has(cacheKey)) {
    const cached = purchasesCache.get(cacheKey)!;
    if (now - cached.timestamp < PURCHASES_CACHE_TTL) {
      return cached.data;
    }
  }

  try {
    const branchParam = branch && branch !== 'ALL' ? `&branch=${branch}` : '';
    const res = await fetch(`${API_ENDPOINT}?action=fetch-purchase-bills${branchParam}&_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success || !Array.isArray(data.rows)) return null;
    purchasesCache.set(cacheKey, { data: data.rows, timestamp: Date.now() });
    return data.rows;
  } catch {
    return null;
  }
}

/**
 * Fetch all vendors with their ledger statistics (with TTL caching)
 */
export async function fetchVendorsFromTurso(forceRefresh = false): Promise<Vendor[] | null> {
  const now = Date.now();
  if (!forceRefresh && vendorsCache && (now - vendorsCache.timestamp < VENDORS_CACHE_TTL)) {
    return vendorsCache.data;
  }

  try {
    const res = await fetch(`${API_ENDPOINT}?action=fetch-vendors&_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success || !Array.isArray(data.vendors)) return null;
    vendorsCache = { data: data.vendors, timestamp: Date.now() };
    return data.vendors;
  } catch {
    return null;
  }
}

/**
 * Save or update a purchase bill in remote database
 */
export async function savePurchaseBillToTurso(bill: PurchaseBill): Promise<PurchaseBill | null> {
  invalidatePurchasesCache();
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'save-purchase-bill',
        payload: bill,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.success && data.purchaseBill ? data.purchaseBill : null;
  } catch {
    return null;
  }
}

/**
 * Cancel a purchase bill with safe stock reversal
 */
export async function cancelPurchaseBillOnTurso(billId: string, reason?: string): Promise<boolean> {
  invalidatePurchasesCache();
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'cancel-purchase-bill',
        payload: { billId, reason },
      }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

/**
 * Permanently delete a purchase bill with stock reversal
 */
export async function deletePurchaseBillOnTurso(billId: string): Promise<boolean> {
  invalidatePurchasesCache();
  invalidateProductsCache();
  invalidateVendorsCache();
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'delete-purchase-bill',
        payload: { billId },
      }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

/**
 * Add a payment against a purchase bill
 */
export async function addVendorPaymentOnTurso(payment: VendorPayment): Promise<boolean> {
  invalidatePurchasesCache();
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-albhurani-role': 'Owner',
      },
      body: JSON.stringify({
        action: 'add-vendor-payment',
        payload: { payment },
      }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}


// ---------------------------------------------------------------------------
// Shared 200M Turso Rows Read Budget Diagnostics API
// ---------------------------------------------------------------------------

export interface TursoBudgetConsumer {
  action: string;
  queryCount: number;
  estimatedRows: number;
  percentOfTotal: number;
  lastCalledAt?: string;
}

export interface TursoBudgetStatus {
  success: boolean;
  periodMonth: string;
  budgetLimit: number;
  totalEstimatedRowsRead: number;
  totalQueryCount: number;
  percentageUsed: number;
  daysElapsed: number;
  daysInMonth: number;
  projectedMonthlyRows: number;
  projectedPercentage: number;
  thresholdStatus: 'normal' | '50%' | '70%' | '85%' | '95%' | 'exceeded';
  alertMessage: string | null;
  shouldThrottleNonEssential: boolean;
  criticalOperationsGuaranteed: boolean;
  metricType: string;
  clarification: string;
  topConsumers: TursoBudgetConsumer[];
}

/**
 * Fetch real-time shared 200M Turso Rows Read budget status and projections
 */
export async function fetchTursoBudgetStatus(forceRefresh = false): Promise<TursoBudgetStatus | null> {
  const now = Date.now();
  if (!forceRefresh && budgetStatusCache && (now - budgetStatusCache.timestamp < BUDGET_STATUS_CACHE_TTL)) {
    return budgetStatusCache.data;
  }

  try {
    const res = await fetch(`${API_ENDPOINT}?action=turso-budget-status&_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.success) return null;

    budgetStatusCache = { data: data as TursoBudgetStatus, timestamp: Date.now() };
    return data as TursoBudgetStatus;
  } catch {
    return null;
  }
}
