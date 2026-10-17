import { createClient, Client } from '@libsql/client/web';
import { Product, OrderBill } from '../types';
import { INITIAL_PRODUCTS } from '../data/mockProducts';

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
    clientInstance = null; // force re-create
    lastConfigKey = '';
  }
}

/**
 * Initialize database schema on Turso
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
        barcode TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        unit TEXT NOT NULL,
        net_weight TEXT NOT NULL,
        cost_price REAL NOT NULL,
        selling_price REAL NOT NULL,
        stock INTEGER NOT NULL,
        min_stock INTEGER NOT NULL,
        shelf_life_days INTEGER NOT NULL,
        batch_no TEXT NOT NULL,
        mfg_date TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create orders table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        bill_number TEXT NOT NULL,
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

    // Create expenses table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        payment_mode TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Check if products exist; if 0, seed with INITIAL_PRODUCTS
    const countRes = await client.execute('SELECT COUNT(*) as count FROM products;');
    const count = Number(countRes.rows[0]?.count ?? 0);

    if (count === 0) {
      for (const p of INITIAL_PRODUCTS) {
        await client.execute({
          sql: `INSERT OR REPLACE INTO products (
            id, barcode, name, category, unit, net_weight, cost_price, selling_price,
            stock, min_stock, shelf_life_days, batch_no, mfg_date, expiry_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          args: [
            p.id,
            p.barcode,
            p.name,
            p.category,
            p.unit,
            p.netWeight,
            p.costPrice,
            p.sellingPrice,
            p.stock,
            p.minStock,
            p.shelfLifeDays,
            p.batchNo,
            p.mfgDate,
            p.expiryDate,
          ],
        });
      }
    }

    return { success: true, message: `Connected to Turso successfully! Schema ready (${count === 0 ? 'Seeded initial products' : `${count} products found`}).` };
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
      barcode: String(row.barcode),
      name: String(row.name),
      category: row.category as any,
      unit: String(row.unit),
      netWeight: String(row.net_weight),
      costPrice: Number(row.cost_price),
      sellingPrice: Number(row.selling_price),
      stock: Number(row.stock),
      minStock: Number(row.min_stock),
      shelfLifeDays: Number(row.shelf_life_days),
      batchNo: String(row.batch_no),
      mfgDate: String(row.mfg_date),
      expiryDate: String(row.expiry_date),
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
        id, barcode, name, category, unit, net_weight, cost_price, selling_price,
        stock, min_stock, shelf_life_days, batch_no, mfg_date, expiry_date, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        barcode=excluded.barcode,
        name=excluded.name,
        category=excluded.category,
        unit=excluded.unit,
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
        product.barcode,
        product.name,
        product.category,
        product.unit,
        product.netWeight,
        product.costPrice,
        product.sellingPrice,
        product.stock,
        product.minStock,
        product.shelfLifeDays,
        product.batchNo,
        product.mfgDate,
        product.expiryDate,
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
    const res = await client.execute('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100;');
    const orders: OrderBill[] = res.rows.map((row) => ({
      id: String(row.id),
      billNumber: String(row.bill_number),
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
        id, bill_number, items_json, subtotal, discount_amount, gst_amount, grand_total,
        payment_method, amount_received, change_given, customer_name, customer_phone, cashier_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      args: [
        order.id,
        order.billNumber,
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
