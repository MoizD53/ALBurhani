import { Product, OrderBill, ExpenseItem } from '../types';
import { migrateCatalogPrices } from './catalogMigration';

/**
 * AL-BHURANI POS — Production Database Client
 * 
 * SECURITY ARCHITECTURE CONSTRAINTS:
 * 1. Database credentials (TURSO_DB_URL and TURSO_AUTH_TOKEN) MUST remain strictly server-side.
 * 2. NEVER import or bundle auth tokens into client JavaScript bundles.
 * 3. Client communicates securely with the Vercel serverless proxy endpoint `/api/db`.
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
  // Always return proxy object so App.tsx can dispatch sync calls through /api/db
  return {
    isServerlessProxy: true,
  };
}

/**
 * Fetch all products from remote database
 */
export async function fetchProductsFromTurso(): Promise<Product[] | null> {
  try {
    const res = await fetch(`${API_ENDPOINT}?action=fetch-products`);
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
 * Fetch orders from remote database
 */
export async function fetchOrdersFromTurso(): Promise<OrderBill[] | null> {
  try {
    const res = await fetch(`${API_ENDPOINT}?action=fetch-orders`);
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
      customerName: row.customer_name ? String(row.customer_name) : undefined,
      customerPhone: row.customer_phone ? String(row.customer_phone) : undefined,
      cashierName: String(row.cashier_name),
      createdAt: String(row.created_at),
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
 * Fetch expenses from remote database
 */
export async function fetchExpensesFromTurso(): Promise<ExpenseItem[] | null> {
  try {
    const res = await fetch(`${API_ENDPOINT}?action=fetch-expenses`);
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
