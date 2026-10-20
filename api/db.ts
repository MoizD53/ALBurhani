import { createClient, type Client } from '@libsql/client';

export interface VercelRequest {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  body: any;
  headers: Record<string, string | string[] | undefined>;
}

export interface VercelResponse {
  status: (statusCode: number) => VercelResponse;
  json: (data: any) => VercelResponse;
  setHeader: (name: string, value: string) => VercelResponse;
  end: () => void;
}

// Server-side Turso client initialization using server-only environment variables
let serverClient: Client | null = null;
let isSchemaInitialized = false;

function getServerTursoClient(): Client | null {
  const url = process.env.TURSO_DB_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    return null;
  }

  if (!serverClient) {
    serverClient = createClient({
      url: url.trim(),
      authToken: authToken.trim(),
    });
  }

  return serverClient;
}

/**
 * Automatically initializes and verifies database schema.
 * Runs once per serverless instance lifecycle.
 */
async function ensureSchema(client: Client): Promise<void> {
  if (isSchemaInitialized) return;

  const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT,
      barcode TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL,
      price_basis TEXT DEFAULT '₹/pc',
      net_weight TEXT DEFAULT '',
      cost_price REAL NOT NULL DEFAULT 0,
      selling_price REAL NOT NULL DEFAULT 0,
      stock REAL NOT NULL DEFAULT 0,
      min_stock REAL NOT NULL DEFAULT 0,
      shelf_life_days INTEGER DEFAULT 90,
      batch_no TEXT DEFAULT '',
      mfg_date TEXT DEFAULT '',
      expiry_date TEXT DEFAULT '',
      price_tiers TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      bill_number TEXT NOT NULL,
      transaction_type TEXT NOT NULL DEFAULT 'CUSTOMER_BILL',
      items_json TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      gst_amount REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'CASH',
      amount_received REAL NOT NULL DEFAULT 0,
      change_given REAL NOT NULL DEFAULT 0,
      customer_name TEXT,
      customer_phone TEXT,
      cashier_name TEXT NOT NULL DEFAULT 'Owner',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      timestamp INTEGER,
      is_revised INTEGER DEFAULT 0,
      original_grand_total REAL,
      additional_amount_paid REAL,
      original_payment_method TEXT,
      additional_payment_method TEXT,
      revised_at TEXT,
      revised_timestamp INTEGER,
      revision_count INTEGER DEFAULT 0
    );`,

    `CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_orders_tx_type ON orders (transaction_type);`,
    `CREATE INDEX IF NOT EXISTS idx_orders_bill_num ON orders (bill_number);`,

    `CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      payment_mode TEXT NOT NULL,
      paid_to TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT UNIQUE,
      total_spent REAL DEFAULT 0,
      total_visits INTEGER DEFAULT 0,
      last_visit TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT DEFAULT 'Owner'
    );`,

    `CREATE TABLE IF NOT EXISTS sync_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload_json TEXT,
      server_timestamp INTEGER NOT NULL
    );`,

    `CREATE INDEX IF NOT EXISTS idx_sync_events_timestamp ON sync_events (server_timestamp ASC);`
  ];

  for (const sql of schemaStatements) {
    try {
      await client.execute(sql);
    } catch {
      // Ignore if table/index exists
    }
  }

  isSchemaInitialized = true;
}

/**
 * Log a change event for real-time cross-device propagation
 */
async function logSyncEvent(
  client: Client,
  entityType: string,
  entityId: string,
  operation: string,
  payload?: any
): Promise<void> {
  try {
    const timestamp = Date.now();
    await client.execute({
      sql: `INSERT INTO sync_events (entity_type, entity_id, operation, payload_json, server_timestamp)
            VALUES (?, ?, ?, ?, ?);`,
      args: [
        entityType,
        entityId,
        operation,
        payload ? JSON.stringify(payload) : null,
        timestamp,
      ],
    });

    // Clean up events older than 7 days to keep sync_events fast and lightweight
    const sevenDaysAgo = timestamp - 7 * 24 * 60 * 60 * 1000;
    client.execute({
      sql: `DELETE FROM sync_events WHERE server_timestamp < ?;`,
      args: [sevenDaysAgo],
    }).catch(() => {});
  } catch (err) {
    console.warn('Failed to log sync event:', err);
  }
}

/**
 * Verify authorization for destructive actions
 */
function isAuthorizedDestructiveAction(req: VercelRequest): boolean {
  const authHeader = req.headers['authorization'];
  const adminSecret = process.env.ALBHURANI_ADMIN_SECRET;

  if (!adminSecret) {
    return false;
  }

  return authHeader === `Bearer ${adminSecret}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-albhurani-role'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const client = getServerTursoClient();
  if (!client) {
    return res.status(503).json({
      success: false,
      error: 'Turso server configuration missing. Ensure TURSO_DB_URL and TURSO_AUTH_TOKEN are set in Vercel environment variables.',
    });
  }

  // Ensure tables and schema exist
  try {
    await ensureSchema(client);
  } catch (schemaErr: any) {
    console.error('Schema initialization error:', schemaErr);
  }

  // 1. GET Requests
  if (req.method === 'GET') {
    const action = req.query.action as string;

    if (action === 'status') {
      try {
        await client.execute('SELECT 1;');
        return res.status(200).json({
          success: true,
          configured: true,
          connected: true,
          message: 'Server-side Turso connection active',
          serverTime: Date.now(),
        });
      } catch (err: any) {
        return res.status(500).json({
          success: false,
          configured: true,
          connected: false,
          error: err?.message || 'Database ping failed',
        });
      }
    }

    if (action === 'fetch-products') {
      try {
        const result = await client.execute('SELECT * FROM products ORDER BY category ASC, name ASC;');
        return res.status(200).json({ success: true, rows: result.rows });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    if (action === 'fetch-orders') {
      try {
        const type = req.query.type as string | undefined;
        let query = 'SELECT * FROM orders';
        const args: any[] = [];

        if (type && type !== 'ALL') {
          query += ' WHERE transaction_type = ?';
          args.push(type);
        }

        query += ' ORDER BY created_at DESC LIMIT 500;';

        const result = await client.execute({ sql: query, args });
        return res.status(200).json({ success: true, rows: result.rows });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    if (action === 'fetch-expenses') {
      try {
        const result = await client.execute('SELECT * FROM expenses ORDER BY created_at DESC LIMIT 200;');
        return res.status(200).json({ success: true, rows: result.rows });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    if (action === 'fetch-customers') {
      try {
        const result = await client.execute('SELECT * FROM customers ORDER BY total_spent DESC LIMIT 200;');
        return res.status(200).json({ success: true, rows: result.rows });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    if (action === 'fetch-settings') {
      try {
        const key = req.query.key as string | undefined;
        if (key) {
          const result = await client.execute({
            sql: 'SELECT * FROM settings WHERE key = ?;',
            args: [key],
          });
          const row = result.rows[0];
          return res.status(200).json({
            success: true,
            setting: row ? { key: row.key, value: JSON.parse(String(row.value_json)), updatedAt: row.updated_at } : null,
          });
        }

        const result = await client.execute('SELECT * FROM settings;');
        const settingsMap: Record<string, any> = {};
        for (const row of result.rows) {
          try {
            settingsMap[String(row.key)] = JSON.parse(String(row.value_json));
          } catch {
            settingsMap[String(row.key)] = row.value_json;
          }
        }
        return res.status(200).json({ success: true, settings: settingsMap });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Real-Time Event Sync: returns change events since given timestamp
    if (action === 'fetch-events') {
      try {
        const since = Number(req.query.since || 0);
        const result = await client.execute({
          sql: `SELECT id, entity_type, entity_id, operation, payload_json, server_timestamp
                FROM sync_events
                WHERE server_timestamp > ?
                ORDER BY server_timestamp ASC
                LIMIT 100;`,
          args: [since],
        });

        const events = result.rows.map((r: any) => ({
          id: Number(r.id),
          entityType: String(r.entity_type),
          entityId: String(r.entity_id),
          operation: String(r.operation),
          payload: r.payload_json ? JSON.parse(String(r.payload_json)) : null,
          serverTimestamp: Number(r.server_timestamp),
        }));

        return res.status(200).json({
          success: true,
          events,
          serverTime: Date.now(),
        });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    return res.status(400).json({ success: false, error: 'Unknown GET action' });
  }

  // 2. POST Requests
  if (req.method === 'POST') {
    const { action, payload } = req.body || {};

    if (!action) {
      return res.status(400).json({ success: false, error: 'Missing action in request body' });
    }

    // Save / Update Product
    if (action === 'save-product') {
      const p = payload;
      if (!p || !p.id || !p.barcode || !p.name) {
        return res.status(400).json({ success: false, error: 'Invalid product payload' });
      }

      try {
        await client.execute({
          sql: `INSERT INTO products (
            id, sku, barcode, name, category, unit, price_basis, net_weight, cost_price, selling_price,
            stock, min_stock, shelf_life_days, batch_no, mfg_date, expiry_date, price_tiers, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
            price_tiers=excluded.price_tiers,
            updated_at=CURRENT_TIMESTAMP;`,
          args: [
            p.id,
            p.sku || p.barcode,
            p.barcode,
            p.name,
            p.category,
            p.unit,
            p.priceBasis || '₹/pc',
            p.netWeight || '',
            Number(p.costPrice) || 0,
            Number(p.sellingPrice) || 0,
            Number(p.stock) || 0,
            Number(p.minStock) || 0,
            Number(p.shelfLifeDays) || 90,
            p.batchNo || '',
            p.mfgDate || '',
            p.expiryDate || '',
            p.priceTiers ? JSON.stringify(p.priceTiers) : null,
          ],
        });

        await logSyncEvent(client, 'product', p.id, 'save', p);
        return res.status(200).json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Update Stock
    if (action === 'update-stock') {
      const { productId, stock } = payload || {};
      if (!productId || typeof stock !== 'number') {
        return res.status(400).json({ success: false, error: 'Invalid stock update payload' });
      }

      try {
        await client.execute({
          sql: 'UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;',
          args: [Math.max(0, stock), productId],
        });

        await logSyncEvent(client, 'product', productId, 'stock', { productId, stock });
        return res.status(200).json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Batch Save / Backfill Products (Ensures cloud database has all 305 master products)
    if (action === 'batch-save-products') {
      const products = Array.isArray(payload) ? payload : payload?.products;
      if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ success: false, error: 'Invalid products array' });
      }

      try {
        let inserted = 0;
        for (const p of products) {
          if (!p || !p.id || !p.barcode || !p.name) continue;
          await client.execute({
            sql: `INSERT INTO products (
              id, sku, barcode, name, category, unit, price_basis, net_weight, cost_price, selling_price,
              stock, min_stock, shelf_life_days, batch_no, mfg_date, expiry_date, price_tiers, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
              min_stock=excluded.min_stock,
              shelf_life_days=excluded.shelf_life_days,
              batch_no=excluded.batch_no,
              mfg_date=excluded.mfg_date,
              expiry_date=excluded.expiry_date,
              price_tiers=excluded.price_tiers,
              updated_at=CURRENT_TIMESTAMP;`,
            args: [
              p.id,
              p.sku || p.barcode,
              p.barcode,
              p.name,
              p.category,
              p.unit,
              p.priceBasis || 'Rs./pc',
              p.netWeight || '',
              Number(p.costPrice) || 0,
              Number(p.sellingPrice) || 0,
              Number(p.stock) || 0,
              Number(p.minStock) || 0,
              Number(p.shelfLifeDays) || 90,
              p.batchNo || '',
              p.mfgDate || '',
              p.expiryDate || '',
              p.priceTiers ? JSON.stringify(p.priceTiers) : null,
            ],
          });
          inserted++;
        }
        return res.status(200).json({ success: true, count: inserted });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Save Order (Single Sale or Modification)
    if (action === 'save-order') {
      const o = payload;
      if (!o || !o.id || !o.billNumber) {
        return res.status(400).json({ success: false, error: 'Invalid order payload' });
      }

      try {
        await client.execute({
          sql: `INSERT OR REPLACE INTO orders (
            id, bill_number, transaction_type, items_json, subtotal, discount_amount, gst_amount, grand_total,
            payment_method, amount_received, change_given, customer_name, customer_phone, cashier_name, created_at,
            timestamp, is_revised, original_grand_total, additional_amount_paid, original_payment_method,
            additional_payment_method, revised_at, revised_timestamp, revision_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          args: [
            o.id,
            o.billNumber,
            o.transactionType || 'CUSTOMER_BILL',
            JSON.stringify(o.items || []),
            Number(o.subtotal) || 0,
            Number(o.discountAmount) || 0,
            Number(o.gstAmount) || 0,
            Number(o.grandTotal) || 0,
            o.paymentMethod || 'CASH',
            Number(o.amountReceived) || 0,
            Number(o.changeGiven) || 0,
            o.customerName || null,
            o.customerPhone || null,
            o.cashierName || 'Owner',
            o.createdAt || new Date().toISOString(),
            Number(o.timestamp) || Date.now(),
            o.isRevised ? 1 : 0,
            o.originalGrandTotal !== undefined ? Number(o.originalGrandTotal) : null,
            o.additionalAmountPaid !== undefined ? Number(o.additionalAmountPaid) : null,
            o.originalPaymentMethod || null,
            o.additionalPaymentMethod || null,
            o.revisedAt || null,
            o.revisedTimestamp !== undefined ? Number(o.revisedTimestamp) : null,
            Number(o.revisionCount) || 0,
          ],
        });

        await logSyncEvent(client, 'order', o.id, 'save', o);
        return res.status(200).json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Batch Save Orders (Used during initial sync to ensure local orders are safely uploaded to Turso)
    if (action === 'batch-save-orders') {
      const orders = Array.isArray(payload) ? payload : payload?.orders;
      if (!Array.isArray(orders) || orders.length === 0) {
        return res.status(400).json({ success: false, error: 'Invalid orders array' });
      }

      try {
        let inserted = 0;
        for (const o of orders) {
          if (!o || !o.id || !o.billNumber) continue;
          await client.execute({
            sql: `INSERT OR REPLACE INTO orders (
              id, bill_number, transaction_type, items_json, subtotal, discount_amount, gst_amount, grand_total,
              payment_method, amount_received, change_given, customer_name, customer_phone, cashier_name, created_at,
              timestamp, is_revised, original_grand_total, additional_amount_paid, original_payment_method,
              additional_payment_method, revised_at, revised_timestamp, revision_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            args: [
              o.id,
              o.billNumber,
              o.transactionType || 'CUSTOMER_BILL',
              JSON.stringify(o.items || []),
              Number(o.subtotal) || 0,
              Number(o.discountAmount) || 0,
              Number(o.gstAmount) || 0,
              Number(o.grandTotal) || 0,
              o.paymentMethod || 'CASH',
              Number(o.amountReceived) || 0,
              Number(o.changeGiven) || 0,
              o.customerName || null,
              o.customerPhone || null,
              o.cashierName || 'Owner',
              o.createdAt || new Date().toISOString(),
              Number(o.timestamp) || Date.now(),
              o.isRevised ? 1 : 0,
              o.originalGrandTotal !== undefined ? Number(o.originalGrandTotal) : null,
              o.additionalAmountPaid !== undefined ? Number(o.additionalAmountPaid) : null,
              o.originalPaymentMethod || null,
              o.additionalPaymentMethod || null,
              o.revisedAt || null,
              o.revisedTimestamp !== undefined ? Number(o.revisedTimestamp) : null,
              Number(o.revisionCount) || 0,
            ],
          });
          inserted++;
        }

        await logSyncEvent(client, 'order', 'batch', 'batch_save', { count: inserted });
        return res.status(200).json({ success: true, count: inserted });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Delete Order
    if (action === 'delete-order') {
      const { orderId, billNumber } = payload || {};
      if (!orderId) {
        return res.status(400).json({ success: false, error: 'Missing orderId' });
      }

      try {
        const targetBill = billNumber || orderId;
        await client.execute({
          sql: 'DELETE FROM orders WHERE id = ? OR bill_number = ?;',
          args: [orderId, targetBill],
        });

        await logSyncEvent(client, 'order', orderId, 'delete', { orderId, billNumber });
        return res.status(200).json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Save Expense
    if (action === 'save-expense') {
      const e = payload;
      if (!e || !e.id || !e.title || typeof e.amount !== 'number') {
        return res.status(400).json({ success: false, error: 'Invalid expense payload' });
      }

      try {
        await client.execute({
          sql: `INSERT OR REPLACE INTO expenses (
            id, title, category, amount, date, payment_mode, paid_to, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          args: [
            e.id,
            e.title,
            e.category || 'Store Operations',
            Number(e.amount) || 0,
            e.date || new Date().toISOString(),
            e.paymentMode || 'Cash',
            e.paidTo || null,
            e.notes || null,
            e.createdAt || new Date().toISOString(),
          ],
        });

        await logSyncEvent(client, 'expense', e.id, 'save', e);
        return res.status(200).json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Save Customer
    if (action === 'save-customer') {
      const c = payload;
      if (!c || !c.id) {
        return res.status(400).json({ success: false, error: 'Invalid customer payload' });
      }

      try {
        await client.execute({
          sql: `INSERT INTO customers (id, name, phone, total_spent, total_visits, last_visit, created_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET
                  name=excluded.name,
                  phone=excluded.phone,
                  total_spent=excluded.total_spent,
                  total_visits=excluded.total_visits,
                  last_visit=excluded.last_visit;`,
          args: [
            c.id,
            c.name || 'Walk-in Customer',
            c.phone || null,
            Number(c.totalSpent) || 0,
            Number(c.totalVisits) || 1,
            c.lastVisit || new Date().toISOString(),
          ],
        });

        await logSyncEvent(client, 'customer', c.id, 'save', c);
        return res.status(200).json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Save Shared Setting (Owner business settings, GST config, label formats, etc.)
    if (action === 'save-setting') {
      const { key, value } = payload || {};
      if (!key || value === undefined) {
        return res.status(400).json({ success: false, error: 'Invalid setting payload' });
      }

      try {
        await client.execute({
          sql: `INSERT INTO settings (key, value_json, updated_at, updated_by)
                VALUES (?, ?, CURRENT_TIMESTAMP, 'Owner')
                ON CONFLICT(key) DO UPDATE SET
                  value_json=excluded.value_json,
                  updated_at=CURRENT_TIMESTAMP;`,
          args: [key, JSON.stringify(value)],
        });

        await logSyncEvent(client, 'settings', key, 'save', { key, value });
        return res.status(200).json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Destructive Administrative Actions (Protected by server secret check)
    if (action === 'reset-all-stock') {
      if (!isAuthorizedDestructiveAction(req)) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Server-side Owner secret required for destructive action' });
      }

      try {
        const resExec = await client.execute('UPDATE products SET stock = 0, updated_at = CURRENT_TIMESTAMP;');
        await logSyncEvent(client, 'product', 'all', 'reset_stock');
        return res.status(200).json({ success: true, count: resExec.rowsAffected });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    if (action === 'clear-orders') {
      if (!isAuthorizedDestructiveAction(req)) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Server-side Owner secret required for destructive action' });
      }

      try {
        const resExec = await client.execute('DELETE FROM orders;');
        await logSyncEvent(client, 'order', 'all', 'clear_orders');
        return res.status(200).json({ success: true, count: resExec.rowsAffected });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    if (action === 'clear-expenses') {
      if (!isAuthorizedDestructiveAction(req)) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Server-side Owner secret required for destructive action' });
      }

      try {
        const resExec = await client.execute('DELETE FROM expenses;');
        await logSyncEvent(client, 'expense', 'all', 'clear_expenses');
        return res.status(200).json({ success: true, count: resExec.rowsAffected });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    return res.status(400).json({ success: false, error: `Unsupported POST action: ${action}` });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
