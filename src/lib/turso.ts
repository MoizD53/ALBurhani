import { createClient, Client } from '@libsql/client/web';
import { Product, OrderBill, ExpenseItem } from '../types';
import { IMPORTED_PRODUCTS } from '../data/importedProducts';

// Read config from Vite env or localStorage
const getTursoConfig = () => {
  const envUrl = import.meta.env.VITE_TURSO_DB_URL || 'libsql://al-bhurani-duokarma53.aws-ap-south-1.turso.io';
  const envToken = import.meta.env.VITE_TURSO_AUTH_TOKEN || '';
  
  const savedToken = typeof window !== 'undefined' ? localStorage.getItem('albhurani_turso_token') : null;
  const savedUrl = typeof window !== 'undefined' ? localStorage.getItem('albhurani_turso_url') : null;

  return {
    url: (savedUrl || envUrl).trim(),
    authToken: (savedToken !== null ? savedToken : envToken).trim(),
  };
};

let clientInstance: Client | null = null;
let lastConfigKey = '';

export function getTursoClient(): Client | null {
  const { url, authToken } = getTursoConfig();
  if (!url || !authToken) {
    return null;
  }

  const configKey = `${url}:::${authToken}`;
  if (clientInstance && lastConfigKey === configKey) {
    return clientInstance;
  }

  try {
    clientInstance = createClient({
      url,
      authToken,
    });
    lastConfigKey = configKey;
    return clientInstance;
  } catch (err) {
    console.error('Failed to create Turso client:', err);
    return null;
  }
}

export interface TursoConnectionStatus {
  isConnected: boolean;
  isConfigured: boolean;
  url: string;
  hasToken: boolean;
  error?: string;
  source: 'env' | 'custom' | 'none';
}

export function checkTursoConfig(): TursoConnectionStatus {
  const { url, authToken } = getTursoConfig();
  const hasToken = Boolean(authToken && authToken.length > 5);
  const isConfigured = Boolean(url && hasToken);

  return {
    isConnected: false, // determined via ping
    isConfigured,
    url,
    hasToken,
    source: (typeof window !== 'undefined' && localStorage.getItem('albhurani_turso_token')) ? 'custom' : (import.meta.env.VITE_TURSO_AUTH_TOKEN ? 'env' : 'none'),
  };
}

export function saveTursoCustomCredentials(url: string, token: string) {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem('albhurani_turso_url', url.trim());
    if (token) localStorage.setItem('albhurani_turso_token', token.trim());
    else localStorage.removeItem('albhurani_turso_token');
    clientInstance = null;
    lastConfigKey = '';
  }
}

/**
 * Initialize database schema on Turso with safe non-destructive migrations
 */
export async function initializeTursoSchema(): Promise<{ success: boolean; message: string }> {
  const client = getTursoClient();
  if (!client) {
    return { success: false, message: 'Turso client not initialized. Auth token missing.' };
  }

  try {
    // Create products table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        sku TEXT,
        barcode TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        unit TEXT NOT NULL,
        price_basis TEXT,
        net_weight TEXT,
        cost_price REAL NOT NULL,
        selling_price REAL NOT NULL,
        stock REAL NOT NULL,
        min_stock REAL NOT NULL,
        shelf_life_days INTEGER,
        batch_no TEXT,
        mfg_date TEXT,
        expiry_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Safe column migrations for existing tables
    try { await client.execute('ALTER TABLE products ADD COLUMN sku TEXT;'); } catch {}
    try { await client.execute('ALTER TABLE products ADD COLUMN price_basis TEXT;'); } catch {}

    // Create orders table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        bill_number TEXT NOT NULL,
        transaction_type TEXT DEFAULT 'CUSTOMER_BILL',
        items_json TEXT NOT NULL,
        subtotal REAL NOT NULL,
        discount_amount REAL NOT NULL,
        gst_amount REAL NOT NULL,
        grand_total REAL NOT NULL,
        payment_method TEXT NOT NULL,
        amount_received REAL NOT NULL,
        change_given REAL NOT NULL,
        customer_name TEXT,
        customer_phone TEXT,
        cashier_name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    try { await client.execute("ALTER TABLE orders ADD COLUMN transaction_type TEXT DEFAULT 'CUSTOMER_BILL';"); } catch {}

    // Create expenses table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        payment_mode TEXT NOT NULL,
        paid_to TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create customers table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Check count; if 0 seed with IMPORTED_PRODUCTS
    const countRes = await client.execute('SELECT COUNT(*) as count FROM products;');
    const count = Number(countRes.rows[0]?.count ?? 0);

    if (count === 0) {
      for (const p of IMPORTED_PRODUCTS) {
        await client.execute({
          sql: `INSERT OR REPLACE INTO products (
            id, sku, barcode, name, category, unit, price_basis, net_weight, cost_price, selling_price,
            stock, min_stock, shelf_life_days, batch_no, mfg_date, expiry_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          args: [
            p.id,
            p.sku || p.barcode,
            p.barcode,
            p.name,
            p.category,
            p.unit,
            p.priceBasis || '₹/pc',
            p.netWeight || '',
            p.costPrice,
            p.sellingPrice,
            p.stock,
            p.minStock,
            p.shelfLifeDays || 90,
            p.batchNo || 'BATCH-01',
            p.mfgDate || '2026-10-18',
            p.expiryDate || '2027-01-18',
          ],
        });
      }
    }

    return { 
      success: true, 
      message: `Turso connected! Ready with ${count === 0 ? `${IMPORTED_PRODUCTS.length} imported products` : `${count} products found`}.` 
    };
  } catch (err: any) {
    console.error('Turso schema initialization error:', err);
    return { success: false, message: err?.message || 'Failed to initialize Turso database schema.' };
  }
}

/**
 * Fetch all products from Turso
 */
export async function fetchProductsFromTurso(): Promise<Product[] | null> {
  const client = getTursoClient();
  if (!client) return null;

  try {
    const res = await client.execute('SELECT * FROM products ORDER BY category ASC, name ASC;');
    const products: Product[] = res.rows.map((row) => ({
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
      isActive: true,
    }));

    return products;
  } catch (err) {
    console.error('Error fetching products from Turso:', err);
    return null;
  }
}

/**
 * Save / Update a product on Turso
 */
export async function saveProductToTurso(product: Product): Promise<boolean> {
  const client = getTursoClient();
  if (!client) return false;

  try {
    await client.execute({
      sql: `INSERT INTO products (
        id, sku, barcode, name, category, unit, price_basis, net_weight, cost_price, selling_price,
        stock, min_stock, shelf_life_days, batch_no, mfg_date, expiry_date, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        sku=excluded.sku,
        barcode=excluded.barcode,
        name=excluded.name,
        category=excluded.category,
        unit=excluded.unit,
        price_basis=excluded.price_basis,
        net_weight=excluded.net_weight,
        cost_price=excluded.cost_price,
        selling_price=excluded.selling_price,
        stock=excluded.stock,
        min_stock=excluded.min_stock,
        shelf_life_days=excluded.shelf_life_days,
        batch_no=excluded.batch_no,
        mfg_date=excluded.mfg_date,
        expiry_date=excluded.expiry_date,
        updated_at=CURRENT_TIMESTAMP;`,
      args: [
        product.id,
        product.sku || product.barcode,
        product.barcode,
        product.name,
        product.category,
        product.unit,
        product.priceBasis || '₹/pc',
        product.netWeight || '',
        product.costPrice,
        product.sellingPrice,
        product.stock,
        product.minStock,
        product.shelfLifeDays || 90,
        product.batchNo || '',
        product.mfgDate || '',
        product.expiryDate || '',
      ],
    });
    return true;
  } catch (err) {
    console.error('Error saving product to Turso:', err);
    return false;
  }
}

/**
 * Update stock on Turso
 */
export async function updateStockOnTurso(productId: string, newStock: number): Promise<boolean> {
  const client = getTursoClient();
  if (!client) return false;

  try {
    await client.execute({
      sql: 'UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;',
      args: [newStock, productId],
    });
    return true;
  } catch (err) {
    console.error('Error updating stock on Turso:', err);
    return false;
  }
}

/**
 * Fetch orders from Turso
 */
export async function fetchOrdersFromTurso(): Promise<OrderBill[] | null> {
  const client = getTursoClient();
  if (!client) return null;

  try {
    const res = await client.execute('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200;');
    const orders: OrderBill[] = res.rows.map((row) => ({
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
  } catch (err) {
    console.error('Error fetching orders from Turso:', err);
    return null;
  }
}

/**
 * Save an order to Turso
 */
export async function saveOrderToTurso(order: OrderBill): Promise<boolean> {
  const client = getTursoClient();
  if (!client) return false;

  try {
    await client.execute({
      sql: `INSERT OR REPLACE INTO orders (
        id, bill_number, transaction_type, items_json, subtotal, discount_amount, gst_amount, grand_total,
        payment_method, amount_received, change_given, customer_name, customer_phone, cashier_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      args: [
        order.id,
        order.billNumber,
        order.transactionType || 'CUSTOMER_BILL',
        JSON.stringify(order.items),
        order.subtotal,
        order.discountAmount,
        order.gstAmount,
        order.grandTotal,
        order.paymentMethod,
        order.amountReceived,
        order.changeGiven,
        order.customerName || null,
        order.customerPhone || null,
        order.cashierName,
        order.createdAt,
      ],
    });
    return true;
  } catch (err) {
    console.error('Error saving order to Turso:', err);
    return false;
  }
}

/**
 * Fetch expenses from Turso
 */
export async function fetchExpensesFromTurso(): Promise<ExpenseItem[] | null> {
  const client = getTursoClient();
  if (!client) return null;

  try {
    const res = await client.execute('SELECT * FROM expenses ORDER BY created_at DESC LIMIT 200;');
    return res.rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      category: String(row.category),
      amount: Number(row.amount),
      date: String(row.date),
      paymentMode: row.payment_mode as any,
      paidTo: row.paid_to ? String(row.paid_to) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
    }));
  } catch (err) {
    console.error('Error fetching expenses from Turso:', err);
    return null;
  }
}

/**
 * Save expense to Turso
 */
export async function saveExpenseToTurso(expense: ExpenseItem): Promise<boolean> {
  const client = getTursoClient();
  if (!client) return false;

  try {
    await client.execute({
      sql: `INSERT OR REPLACE INTO expenses (
        id, title, category, amount, date, payment_mode, paid_to, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      args: [
        expense.id,
        expense.title,
        expense.category,
        expense.amount,
        expense.date,
        expense.paymentMode,
        expense.paidTo || null,
        expense.notes || null,
      ],
    });
    return true;
  } catch (err) {
    console.error('Error saving expense to Turso:', err);
    return false;
  }
}

/**
 * Reset all product stock to zero on Turso database for fresh opening stock entry
 */
export async function resetAllStockOnTursoToZero(): Promise<{ success: boolean; count?: number; error?: string }> {
  const client = getTursoClient();
  if (!client) return { success: false, error: 'Turso client not connected' };

  try {
    const res = await client.execute('UPDATE products SET stock = 0, updated_at = CURRENT_TIMESTAMP;');
    return { success: true, count: res.rowsAffected };
  } catch (err: any) {
    console.error('Error resetting stock on Turso:', err);
    return { success: false, error: err?.message || 'Turso query failed' };
  }
}

/**
 * Delete all orders from Turso database (for fresh shop opening reset)
 */
export async function clearOrdersFromTurso(): Promise<{ success: boolean; count?: number; error?: string }> {
  const client = getTursoClient();
  if (!client) return { success: false, error: 'Turso client not connected' };

  try {
    const res = await client.execute('DELETE FROM orders;');
    return { success: true, count: res.rowsAffected };
  } catch (err: any) {
    console.error('Error clearing orders on Turso:', err);
    return { success: false, error: err?.message || 'Turso query failed' };
  }
}

/**
 * Delete all expenses from Turso database (for fresh shop opening reset)
 */
export async function clearExpensesFromTurso(): Promise<{ success: boolean; count?: number; error?: string }> {
  const client = getTursoClient();
  if (!client) return { success: false, error: 'Turso client not connected' };

  try {
    const res = await client.execute('DELETE FROM expenses;');
    return { success: true, count: res.rowsAffected };
  } catch (err: any) {
    console.error('Error clearing expenses on Turso:', err);
    return { success: false, error: err?.message || 'Turso query failed' };
  }
}

/**
 * Delete a specific order from Turso database by order ID or bill number
 */
export async function deleteOrderFromTurso(orderId: string, billNumber?: string): Promise<boolean> {
  const client = getTursoClient();
  if (!client) return false;

  try {
    const targetBill = billNumber || orderId;
    await client.execute({
      sql: 'DELETE FROM orders WHERE id = ? OR bill_number = ?;',
      args: [orderId, targetBill],
    });
    return true;
  } catch (err) {
    console.error('Error deleting order from Turso:', err);
    return false;
  }
}




