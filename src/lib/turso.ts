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
 * Fetch all products from remote database
 */
export async function fetchProductsFromTurso(): Promise<Product[] | null> {
  try {
    const res = await fetch(`${API_ENDPOINT}?action=fetch-products&_t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.success || !Array.isArray(data.rows)) return null;

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
    return cleanProducts;
  } catch {
    return null;
  }
}

/**
 * Save / Update a product via serverless proxy
 */
export async function saveProductToTurso(product: Product): Promise<boolean> {
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
 * Fetch deleted order tombstones from remote database
 */
export async function fetchDeletedOrdersFromTurso(): Promise<{ id: string; billNumber?: string }[] | null> {
  try {
    const res = await fetch(`${API_ENDPOINT}?action=fetch-deleted-orders&_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.success || !Array.isArray(data.rows)) return null;

    return data.rows.map((row: any) => ({
      id: String(row.id),
      billNumber: row.bill_number ? String(row.bill_number) : undefined,
    }));
  } catch {
    return null;
  }
}

/**
 * Fetch orders from remote database
 */
export async function fetchOrdersFromTurso(transactionType?: 'CUSTOMER_BILL' | 'NO_BILL' | 'ALL'): Promise<OrderBill[] | null> {
  try {
    const typeParam = transactionType && transactionType !== 'ALL' ? `&type=${transactionType}` : '';
    const res = await fetch(`${API_ENDPOINT}?action=fetch-orders${typeParam}&_t=${Date.now()}`, {
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

    return orders;
  } catch {
    return null;
  }
}

/**
 * Save an order to remote database
 */
export async function saveOrderToTurso(order: OrderBill): Promise<boolean> {
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
 * Fetch expenses from remote database
 */
export async function fetchExpensesFromTurso(): Promise<ExpenseItem[] | null> {
  try {
    const res = await fetch(`${API_ENDPOINT}?action=fetch-expenses&_t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.success || !Array.isArray(data.rows)) return null;

    return data.rows.map((row: any) => ({
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
  } catch {
    return null;
  }
}

/**
 * Save expense to remote database
 */
export async function saveExpenseToTurso(expense: ExpenseItem): Promise<boolean> {
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
 * Fetch categories from remote database
 */
export async function fetchCategoriesFromTurso(): Promise<CategoryItem[] | null> {
  try {
    const res = await fetch(`${API_ENDPOINT}?action=fetch-categories`);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.success || !Array.isArray(data.rows)) return null;

    const categories: CategoryItem[] = data.rows.map((row: any) => ({
      id: String(row.id),
      name: String(row.name),
      description: row.description ? String(row.description) : '',
      isActive: Boolean(row.is_active !== 0),
      displayOrder: Number(row.display_order) || 0,
      createdAt: row.created_at ? String(row.created_at) : undefined,
      updatedAt: row.updated_at ? String(row.updated_at) : undefined,
    }));

    return categories;
  } catch {
    return null;
  }
}

/**
 * Save / Update category on remote database
 */
export async function saveCategoryToTurso(category: CategoryItem): Promise<boolean> {
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
 * Fetch all purchase bills from remote database
 */
export async function fetchPurchaseBillsFromTurso(): Promise<PurchaseBill[] | null> {
  try {
    const res = await fetch(`${API_ENDPOINT}?action=fetch-purchase-bills&_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success || !Array.isArray(data.rows)) return null;
    return data.rows;
  } catch {
    return null;
  }
}

/**
 * Fetch all vendors with their ledger statistics
 */
export async function fetchVendorsFromTurso(): Promise<Vendor[] | null> {
  try {
    const res = await fetch(`${API_ENDPOINT}?action=fetch-vendors&_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success || !Array.isArray(data.vendors)) return null;
    return data.vendors;
  } catch {
    return null;
  }
}

/**
 * Save or update a purchase bill in remote database
 */
export async function savePurchaseBillToTurso(bill: PurchaseBill): Promise<PurchaseBill | null> {
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
 * Add a payment against a purchase bill
 */
export async function addVendorPaymentOnTurso(payment: VendorPayment): Promise<boolean> {
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
