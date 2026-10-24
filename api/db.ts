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
      revision_count INTEGER DEFAULT 0,
      due_amount REAL DEFAULT 0,
      is_settled INTEGER DEFAULT 1
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

    `CREATE TABLE IF NOT EXISTS customer_orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      items_json TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      gst_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      advance_paid REAL NOT NULL DEFAULT 0,
      balance_due REAL NOT NULL DEFAULT 0,
      order_date TEXT NOT NULL,
      delivery_date TEXT NOT NULL,
      delivery_time TEXT,
      delivery_address TEXT,
      status TEXT NOT NULL DEFAULT 'Pending',
      payment_method TEXT DEFAULT 'CASH',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE INDEX IF NOT EXISTS idx_cust_orders_delivery ON customer_orders (delivery_date ASC);`,
    `CREATE INDEX IF NOT EXISTS idx_cust_orders_status ON customer_orders (status);`,
    `CREATE INDEX IF NOT EXISTS idx_cust_orders_number ON customer_orders (order_number);`,

    `CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE INDEX IF NOT EXISTS idx_categories_name ON categories (name);`,

    `CREATE TABLE IF NOT EXISTS deleted_orders (
      id TEXT PRIMARY KEY,
      bill_number TEXT,
      deleted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_by TEXT DEFAULT 'Owner',
      reason TEXT DEFAULT 'Discontinued / Cancelled'
    );`,

    `CREATE INDEX IF NOT EXISTS idx_del_orders_bill ON deleted_orders (bill_number);`,

    `CREATE TABLE IF NOT EXISTS daily_bill_counters (
      business_date TEXT PRIMARY KEY,
      last_bill_number INTEGER NOT NULL DEFAULT 0
    );`,

    `CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_number TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS purchase_bills (
      id TEXT PRIMARY KEY,
      purchase_number TEXT NOT NULL UNIQUE,
      vendor_id TEXT,
      vendor_name TEXT NOT NULL,
      vendor_contact TEXT,
      vendor_invoice_number TEXT,
      purchase_date TEXT NOT NULL,
      items_json TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL DEFAULT 0,
      additional_charges REAL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      amount_paid REAL NOT NULL DEFAULT 0,
      balance_due REAL NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'Unpaid',
      payment_mode TEXT NOT NULL DEFAULT 'Cash',
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE INDEX IF NOT EXISTS idx_purchase_bills_date ON purchase_bills (purchase_date DESC);`,

    `CREATE TABLE IF NOT EXISTS purchase_bill_counters (
      counter_type TEXT PRIMARY KEY,
      last_number INTEGER NOT NULL DEFAULT 0
    );`,

    `CREATE TABLE IF NOT EXISTS vendor_payments (
      id TEXT PRIMARY KEY,
      purchase_bill_id TEXT NOT NULL,
      vendor_id TEXT,
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      movement_type TEXT NOT NULL,
      reference_id TEXT NOT NULL,
      quantity_delta REAL NOT NULL,
      notes TEXT,
      timestamp INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE INDEX IF NOT EXISTS idx_stock_movements_ref ON stock_movements (reference_id);`,

    `CREATE TABLE IF NOT EXISTS financial_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      amount REAL DEFAULT 0,
      payment_method TEXT,
      details_json TEXT,
      actor TEXT DEFAULT 'Owner',
      timestamp INTEGER NOT NULL
    );`,

    `CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON financial_audit_logs (timestamp DESC);`,

    `CREATE TABLE IF NOT EXISTS sync_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload_json TEXT,
      server_timestamp INTEGER NOT NULL,
      branch TEXT DEFAULT 'all'
    );`,

    `CREATE INDEX IF NOT EXISTS idx_sync_events_timestamp ON sync_events (server_timestamp ASC);`,
    `CREATE INDEX IF NOT EXISTS idx_products_cat_name ON products (category ASC, name ASC);`,
    `CREATE INDEX IF NOT EXISTS idx_orders_branch_created ON orders (branch, created_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_expenses_branch_date ON expenses (branch, date DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_purchase_bills_branch_date ON purchase_bills (branch, purchase_date DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_sync_events_ts_branch ON sync_events (server_timestamp ASC, branch);`
  ];

  for (const sql of schemaStatements) {
    try {
      await client.execute(sql);
    } catch {
      // Ignore if table/index exists
    }
  }

  // Idempotent column migrations for tables created in earlier versions
  const columnMigrations = [
    'ALTER TABLE orders ADD COLUMN timestamp INTEGER;',
    'ALTER TABLE orders ADD COLUMN revised_timestamp INTEGER;',
    'ALTER TABLE orders ADD COLUMN due_amount REAL DEFAULT 0;',
    'ALTER TABLE orders ADD COLUMN is_settled INTEGER DEFAULT 1;',
    'ALTER TABLE orders ADD COLUMN business_date TEXT;',
    'ALTER TABLE orders ADD COLUMN daily_bill_number INTEGER;',
    "ALTER TABLE orders ADD COLUMN branch TEXT DEFAULT 'godi_road';",
    "ALTER TABLE expenses ADD COLUMN branch TEXT DEFAULT 'godi_road';",
    "ALTER TABLE purchase_bills ADD COLUMN branch TEXT DEFAULT 'godi_road';",
    "ALTER TABLE customer_orders ADD COLUMN branch TEXT DEFAULT 'godi_road';",
    "ALTER TABLE sync_events ADD COLUMN branch TEXT DEFAULT 'all';",
    "CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders (branch);",
    "CREATE INDEX IF NOT EXISTS idx_expenses_branch ON expenses (branch);",
    "CREATE INDEX IF NOT EXISTS idx_purchase_bills_branch ON purchase_bills (branch);",
    "CREATE INDEX IF NOT EXISTS idx_products_cat_name ON products (category ASC, name ASC);",
    "CREATE INDEX IF NOT EXISTS idx_orders_branch_created ON orders (branch, created_at DESC);",
    "CREATE INDEX IF NOT EXISTS idx_expenses_branch_date ON expenses (branch, date DESC);",
    "CREATE INDEX IF NOT EXISTS idx_purchase_bills_branch_date ON purchase_bills (branch, purchase_date DESC);",
    "CREATE INDEX IF NOT EXISTS idx_sync_events_ts_branch ON sync_events (server_timestamp ASC, branch);",
  ];

  for (const alterSql of columnMigrations) {
    try {
      await client.execute(alterSql);
    } catch {
      // Ignore if column already exists
    }
  }

  // Ensure known deleted test orders and tombstones are recorded and purged
  try {
    await client.execute(`INSERT OR IGNORE INTO deleted_orders (id, bill_number, deleted_at)
      VALUES
        ('ALB-INV-2726', 'ALB-INV-2726', CURRENT_TIMESTAMP);`);

    await client.execute(`DELETE FROM orders WHERE id IN (SELECT id FROM deleted_orders)
      OR (bill_number IS NOT NULL AND bill_number != '' AND bill_number IN (SELECT bill_number FROM deleted_orders WHERE bill_number IS NOT NULL AND bill_number != ''));`);
  } catch (tombstoneErr) {
    console.warn('Tombstone table synchronization warning:', tombstoneErr);
  }

  isSchemaInitialized = true;
}

/**
 * Format timestamp or date to YYYY-MM-DD in Asia/Kolkata (IST)
 */
function getKolkataDate(dateOrTimestamp?: any): string {
  try {
    let d: Date;
    if (!dateOrTimestamp) {
      d = new Date();
    } else if (typeof dateOrTimestamp === 'number') {
      d = new Date(dateOrTimestamp);
    } else if (dateOrTimestamp instanceof Date) {
      d = dateOrTimestamp;
    } else {
      const str = String(dateOrTimestamp);
      const m = str.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
      if (m) {
        const months: Record<string, string> = {
          jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
          jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
        };
        const day = m[1].padStart(2, '0');
        const month = months[m[2].toLowerCase()] || '10';
        return `${m[3]}-${month}-${day}`;
      }
      const parsed = Date.parse(str);
      d = isNaN(parsed) ? new Date() : new Date(parsed);
    }

    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Log a change event for real-time cross-device propagation
 */
async function logSyncEvent(
  client: Client,
  entityType: string,
  entityId: string,
  operation: string,
  payload?: any,
  branch?: string
): Promise<void> {
  try {
    const timestamp = Date.now();
    const eventBranch = branch || payload?.branch || 'all';
    await client.execute({
      sql: `INSERT INTO sync_events (entity_type, entity_id, operation, payload_json, server_timestamp, branch)
            VALUES (?, ?, ?, ?, ?, ?);`,
      args: [
        entityType,
        entityId,
        operation,
        payload ? JSON.stringify(payload) : null,
        timestamp,
        eventBranch,
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
 * Log financial mutation for tamper-evident ledger tracking
 */
async function logFinancialAudit(
  client: Client,
  action: string,
  entityType: string,
  entityId: string,
  amount: number,
  paymentMethod: string | null,
  details: any,
  actor: string = 'Owner'
): Promise<void> {
  try {
    await client.execute({
      sql: `INSERT INTO financial_audit_logs (action, entity_type, entity_id, amount, payment_method, details_json, actor, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      args: [action, entityType, entityId, amount, paymentMethod || null, JSON.stringify(details || {}), actor, Date.now()],
    });
  } catch (err) {
    console.warn('Failed to record financial audit log:', err);
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

  // Strict No-Cache Headers to prevent stale iOS Safari and edge CDN caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

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

  // Schema verification: Run full DDL check on mutation requests (POST) or explicit health checks
  // Read-only queries (like fetch-events) execute directly without running 55 DDL statements per request
  if (!isSchemaInitialized && (req.method === 'POST' || req.query.action === 'status')) {
    try {
      await ensureSchema(client);
    } catch (schemaErr: any) {
      console.error('Schema initialization error:', schemaErr);
    }
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
        const branch = req.query.branch as string | undefined;
        let query = 'SELECT * FROM orders WHERE 1=1';
        const args: any[] = [];

        if (type && type !== 'ALL') {
          query += ' AND transaction_type = ?';
          args.push(type);
        }

        if (branch && branch !== 'ALL') {
          if (branch === 'mg_road') {
            query += ' AND branch = ?';
            args.push('mg_road');
          } else {
            query += " AND (branch = 'godi_road' OR branch IS NULL OR branch = '')";
          }
        }

        query += ' ORDER BY created_at DESC LIMIT 500;';

        const result = await client.execute({ sql: query, args });
        return res.status(200).json({ success: true, rows: result.rows });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    if (action === 'fetch-deleted-orders') {
      try {
        const result = await client.execute('SELECT id, bill_number, deleted_at FROM deleted_orders ORDER BY deleted_at DESC LIMIT 1000;');
        return res.status(200).json({ success: true, rows: result.rows });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    if (action === 'fetch-expenses') {
      try {
        const branch = req.query.branch as string | undefined;
        let query = 'SELECT * FROM expenses';
        const args: any[] = [];

        if (branch && branch !== 'ALL') {
          if (branch === 'mg_road') {
            query += ' WHERE branch = ?';
            args.push('mg_road');
          } else {
            query += " WHERE (branch = 'godi_road' OR branch IS NULL OR branch = '')";
          }
        }

        query += ' ORDER BY created_at DESC LIMIT 200;';

        const result = await client.execute({ sql: query, args });
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

    if (action === 'fetch-customer-orders') {
      try {
        const branch = req.query.branch as string | undefined;
        let query = 'SELECT * FROM customer_orders';
        const args: any[] = [];

        if (branch && branch !== 'ALL') {
          if (branch === 'mg_road') {
            query += ' WHERE branch = ?';
            args.push('mg_road');
          } else {
            query += " WHERE (branch = 'godi_road' OR branch IS NULL OR branch = '')";
          }
        }

        query += ' ORDER BY delivery_date ASC, created_at DESC LIMIT 500;';
        const result = await client.execute({ sql: query, args });
        return res.status(200).json({ success: true, rows: result.rows });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    if (action === 'fetch-categories') {
      try {
        const result = await client.execute('SELECT * FROM categories ORDER BY display_order ASC, name ASC;');
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
        const branch = req.query.branch as string | undefined;
        let sql = `SELECT id, entity_type, entity_id, operation, payload_json, server_timestamp
              FROM sync_events
              WHERE server_timestamp > ?`;
        const args: any[] = [since];

        if (branch && branch !== 'ALL' && branch !== 'all') {
          sql += ` AND (branch = ? OR branch = 'all' OR branch IS NULL)`;
          args.push(branch);
        }

        sql += ` ORDER BY server_timestamp ASC LIMIT 100;`;

        const result = await client.execute({
          sql,
          args,
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

    // Health & Reconciliation Verification Check
    if (action === 'reconcile-check') {
      try {
        const orderSummary = await client.execute(`
          SELECT 
            transaction_type,
            COUNT(*) as count,
            COALESCE(SUM(grand_total), 0) as total_revenue,
            COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN grand_total ELSE 0 END), 0) as cash_total,
            COALESCE(SUM(CASE WHEN payment_method = 'UPI' THEN grand_total ELSE 0 END), 0) as upi_total,
            COALESCE(SUM(CASE WHEN payment_method = 'CREDIT' THEN grand_total ELSE 0 END), 0) as credit_total
          FROM orders
          GROUP BY transaction_type;
        `);

        const totalOrders = await client.execute('SELECT COUNT(*) as count FROM orders;');
        const totalDeleted = await client.execute('SELECT COUNT(*) as count FROM deleted_orders;');

        return res.status(200).json({
          success: true,
          serverTime: Date.now(),
          summary: orderSummary.rows,
          totalActiveOrders: totalOrders.rows[0]?.count || 0,
          totalDeletedOrders: totalDeleted.rows[0]?.count || 0,
        });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Fetch Purchase Bills with payments & items
    if (action === 'fetch-purchase-bills') {
      try {
        const branch = req.query.branch as string | undefined;
        let billQuery = 'SELECT * FROM purchase_bills';
        const args: any[] = [];

        if (branch && branch !== 'ALL') {
          if (branch === 'mg_road') {
            billQuery += ' WHERE branch = ?';
            args.push('mg_road');
          } else {
            billQuery += " WHERE (branch = 'godi_road' OR branch IS NULL OR branch = '')";
          }
        }

        billQuery += ' ORDER BY business_date DESC, daily_bill_number ASC LIMIT 500;';
        const billsRes = await client.execute({ sql: billQuery, args });
        const paymentsRes = await client.execute('SELECT * FROM vendor_payments ORDER BY payment_date ASC;');

        const paymentsByBill: Record<string, any[]> = {};
        for (const p of paymentsRes.rows) {
          const bId = String(p.purchase_bill_id);
          if (!paymentsByBill[bId]) paymentsByBill[bId] = [];
          paymentsByBill[bId].push({
            id: p.id,
            purchaseBillId: p.purchase_bill_id,
            vendorId: p.vendor_id,
            paymentDate: p.payment_date,
            amount: Number(p.amount) || 0,
            paymentMode: p.payment_mode,
            notes: p.notes,
            createdAt: p.created_at,
          });
        }

        const rows = billsRes.rows.map((b: any) => {
          let items = [];
          try {
            items = b.items_json ? JSON.parse(b.items_json) : [];
          } catch {}
          return {
            id: b.id,
            purchaseNumber: b.purchase_number,
            dailyBillNumber: Number(b.daily_bill_number) || 1,
            businessDate: b.business_date || getKolkataDate(b.purchase_date),
            vendorId: b.vendor_id,
            vendorName: b.vendor_name,
            vendorContact: b.vendor_contact,
            vendorInvoiceNumber: b.vendor_invoice_number,
            purchaseDate: b.purchase_date,
            items,
            subtotal: Number(b.subtotal) || 0,
            discount: Number(b.discount) || 0,
            additionalCharges: Number(b.additional_charges) || 0,
            grandTotal: Number(b.grand_total) || 0,
            amountPaid: Number(b.amount_paid) || 0,
            balanceDue: Number(b.balance_due) || 0,
            paymentStatus: b.payment_status || 'Unpaid',
            paymentMode: b.payment_mode || 'Cash',
            notes: b.notes,
            status: b.status || 'Active',
            branch: b.branch || 'godi_road',
            createdAt: b.created_at,
            updatedAt: b.updated_at,
            payments: paymentsByBill[b.id] || [],
          };
        });

        return res.status(200).json({ success: true, rows });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Fetch Vendors with calculated ledger balances
    if (action === 'fetch-vendors') {
      try {
        const vendorsRes = await client.execute('SELECT * FROM vendors ORDER BY name ASC;');
        const statsRes = await client.execute(`
          SELECT 
            vendor_name,
            COUNT(*) as bills_count,
            COALESCE(SUM(grand_total), 0) as total_purchases,
            COALESCE(SUM(amount_paid), 0) as total_paid,
            COALESCE(SUM(balance_due), 0) as balance_due
          FROM purchase_bills
          WHERE status != 'Cancelled'
          GROUP BY vendor_name;
        `);

        const statsMap: Record<string, any> = {};
        for (const s of statsRes.rows) {
          statsMap[String(s.vendor_name).toLowerCase().trim()] = {
            billsCount: Number(s.bills_count) || 0,
            totalPurchases: Number(s.total_purchases) || 0,
            totalPaid: Number(s.total_paid) || 0,
            balanceDue: Number(s.balance_due) || 0,
          };
        }

        const rows = vendorsRes.rows.map((v: any) => {
          const stats = statsMap[String(v.name).toLowerCase().trim()] || {
            billsCount: 0,
            totalPurchases: 0,
            totalPaid: 0,
            balanceDue: 0,
          };
          return {
            id: v.id,
            name: v.name,
            contactNumber: v.contact_number,
            address: v.address,
            notes: v.notes,
            ...stats,
          };
        });

        return res.status(200).json({ success: true, vendors: rows });
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

    // Delete Discontinued Product
    if (action === 'delete-product') {
      const { productId } = payload || {};
      if (!productId) {
        return res.status(400).json({ success: false, error: 'Missing productId' });
      }

      try {
        await client.execute({
          sql: 'DELETE FROM products WHERE id = ?;',
          args: [productId],
        });

        await logSyncEvent(client, 'product', productId, 'delete', { productId });
        return res.status(200).json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Update Stock
    if (action === 'update-stock') {
      const { productId, stock, delta } = payload || {};
      if (!productId) {
        return res.status(400).json({ success: false, error: 'Invalid stock update payload: missing productId' });
      }

      try {
        if (typeof delta === 'number') {
          // Atomic relative stock adjustment — safe for concurrent multi-device sales
          await client.execute({
            sql: 'UPDATE products SET stock = MAX(0, stock + ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?;',
            args: [delta, productId],
          });
          // Fetch the actual resulting stock for the sync event
          const result = await client.execute({
            sql: 'SELECT stock FROM products WHERE id = ?;',
            args: [productId],
          });
          const actualStock = result.rows[0] ? Number(result.rows[0].stock) : 0;
          await logSyncEvent(client, 'product', productId, 'stock', { productId, stock: actualStock });
          return res.status(200).json({ success: true, stock: actualStock });
        } else if (typeof stock === 'number') {
          // Absolute stock set — used for manual inventory entry
          await client.execute({
            sql: 'UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;',
            args: [Math.max(0, stock), productId],
          });
          await logSyncEvent(client, 'product', productId, 'stock', { productId, stock });
          return res.status(200).json({ success: true });
        } else {
          return res.status(400).json({ success: false, error: 'Invalid stock update payload: need stock or delta' });
        }
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

    // Save Order (Single Sale or Modification with Atomic Daily Numbering)
    if (action === 'save-order') {
      const o = payload;
      if (!o || !o.id || !o.billNumber) {
        return res.status(400).json({ success: false, error: 'Invalid order payload' });
      }

      try {
        // Prevent zombie order resurrection: check if order is in deleted_orders
        const tombstone = await client.execute({
          sql: 'SELECT 1 FROM deleted_orders WHERE id = ? OR (bill_number IS NOT NULL AND bill_number != "" AND bill_number = ?) LIMIT 1;',
          args: [o.id, o.billNumber],
        });
        if (tombstone.rows.length > 0) {
          return res.status(200).json({ success: true, ignored: true, reason: 'Order has been tombstoned / deleted' });
        }

        const branch = o.branch === 'mg_road' ? 'mg_road' : 'godi_road';
        const istDate = o.businessDate || getKolkataDate(o.timestamp || o.createdAt);
        const counterKey = branch === 'mg_road' ? `${istDate}_mg_road` : istDate;
        let dailyBillNum = o.dailyBillNumber ? Number(o.dailyBillNumber) : 0;

        // Check existing order in DB to preserve its assigned daily number across revisions/retries
        const existingOrder = await client.execute({
          sql: 'SELECT daily_bill_number, business_date, branch FROM orders WHERE id = ? OR bill_number = ? LIMIT 1;',
          args: [o.id, o.billNumber]
        });

        if (existingOrder.rows.length > 0 && existingOrder.rows[0].daily_bill_number) {
          dailyBillNum = Number(existingOrder.rows[0].daily_bill_number);
        } else if (!dailyBillNum || dailyBillNum <= 0) {
          // Atomically allocate next sequential daily bill number for this business date & branch
          await client.execute({
            sql: `INSERT INTO daily_bill_counters (business_date, last_bill_number)
                  VALUES (?, 1)
                  ON CONFLICT(business_date) DO UPDATE SET last_bill_number = last_bill_number + 1;`,
            args: [counterKey]
          });
          const counterRes = await client.execute({
            sql: 'SELECT last_bill_number FROM daily_bill_counters WHERE business_date = ?;',
            args: [counterKey]
          });
          dailyBillNum = Number(counterRes.rows[0]?.last_bill_number) || 1;
        }

        await client.execute({
          sql: `INSERT OR REPLACE INTO orders (
            id, bill_number, transaction_type, items_json, subtotal, discount_amount, gst_amount, grand_total,
            payment_method, amount_received, change_given, customer_name, customer_phone, cashier_name, created_at,
            timestamp, is_revised, original_grand_total, additional_amount_paid, original_payment_method,
            additional_payment_method, revised_at, revised_timestamp, revision_count, due_amount, is_settled,
            business_date, daily_bill_number, branch
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
            o.dueAmount !== undefined ? Number(o.dueAmount) : Math.max(0, (Number(o.grandTotal) || 0) - (Number(o.amountReceived) || 0)),
            o.isSettled !== undefined ? (o.isSettled ? 1 : 0) : ((o.dueAmount !== undefined ? Number(o.dueAmount) : Math.max(0, (Number(o.grandTotal) || 0) - (Number(o.amountReceived) || 0))) > 0 ? 0 : 1),
            istDate,
            dailyBillNum,
            branch
          ],
        });

        const savedOrder = {
          ...o,
          businessDate: istDate,
          dailyBillNumber: dailyBillNum,
          branch
        };

        await logFinancialAudit(client, 'RECORD_SALE', 'order', o.id, Number(o.grandTotal) || 0, o.paymentMethod || 'CASH', {
          billNumber: o.billNumber,
          dailyBillNumber: dailyBillNum,
          businessDate: istDate,
          itemsCount: o.items?.length,
          transactionType: o.transactionType
        });
        await logSyncEvent(client, 'order', o.id, 'save', savedOrder);
        return res.status(200).json({ success: true, dailyBillNumber: dailyBillNum, businessDate: istDate });
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
        const deletedRows = await client.execute('SELECT id, bill_number FROM deleted_orders;');
        const deletedIdSet = new Set(deletedRows.rows.map((r: any) => String(r.id)));
        const deletedBillSet = new Set(deletedRows.rows.map((r: any) => String(r.bill_number)).filter(Boolean));

        let inserted = 0;
        for (const o of orders) {
          if (!o || !o.id || !o.billNumber) continue;
          if (deletedIdSet.has(o.id) || (o.billNumber && deletedBillSet.has(o.billNumber))) continue;

          const branch = o.branch === 'mg_road' ? 'mg_road' : 'godi_road';
          const istDate = o.businessDate || getKolkataDate(o.timestamp || o.createdAt);
          const counterKey = branch === 'mg_road' ? `${istDate}_mg_road` : istDate;
          let dailyBillNum = o.dailyBillNumber ? Number(o.dailyBillNumber) : 0;

          // Check if order already has an assigned daily_bill_number in Turso
          const existingOrder = await client.execute({
            sql: 'SELECT daily_bill_number, business_date, branch FROM orders WHERE id = ? OR bill_number = ? LIMIT 1;',
            args: [o.id, o.billNumber]
          });

          if (existingOrder.rows.length > 0 && existingOrder.rows[0].daily_bill_number) {
            dailyBillNum = Number(existingOrder.rows[0].daily_bill_number);
          } else if (!dailyBillNum || dailyBillNum <= 0) {
            // Atomically allocate next sequential daily bill number for this branch & business date
            await client.execute({
              sql: `INSERT INTO daily_bill_counters (business_date, last_bill_number)
                    VALUES (?, 1)
                    ON CONFLICT(business_date) DO UPDATE SET last_bill_number = last_bill_number + 1;`,
              args: [counterKey]
            });
            const counterRes = await client.execute({
              sql: 'SELECT last_bill_number FROM daily_bill_counters WHERE business_date = ?;',
              args: [counterKey]
            });
            dailyBillNum = Number(counterRes.rows[0]?.last_bill_number) || 1;
          }

          await client.execute({
            sql: `INSERT OR REPLACE INTO orders (
              id, bill_number, transaction_type, items_json, subtotal, discount_amount, gst_amount, grand_total,
              payment_method, amount_received, change_given, customer_name, customer_phone, cashier_name, created_at,
              timestamp, is_revised, original_grand_total, additional_amount_paid, original_payment_method,
              additional_payment_method, revised_at, revised_timestamp, revision_count, due_amount, is_settled,
              business_date, daily_bill_number, branch
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
              o.dueAmount !== undefined ? Number(o.dueAmount) : Math.max(0, (Number(o.grandTotal) || 0) - (Number(o.amountReceived) || 0)),
              o.isSettled !== undefined ? (o.isSettled ? 1 : 0) : ((o.dueAmount !== undefined ? Number(o.dueAmount) : Math.max(0, (Number(o.grandTotal) || 0) - (Number(o.amountReceived) || 0))) > 0 ? 0 : 1),
              istDate,
              dailyBillNum,
              branch
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
          sql: 'INSERT OR REPLACE INTO deleted_orders (id, bill_number, deleted_at) VALUES (?, ?, CURRENT_TIMESTAMP);',
          args: [orderId, targetBill],
        });

        await client.execute({
          sql: 'DELETE FROM orders WHERE id = ? OR bill_number = ?;',
          args: [orderId, targetBill],
        });

        await logFinancialAudit(client, 'DELETE_SALE', 'order', orderId, 0, null, { billNumber: targetBill });
        await logSyncEvent(client, 'order', orderId, 'delete', { orderId, billNumber: targetBill });
        return res.status(200).json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Restore Order
    if (action === 'restore-order') {
      const { orderId, billNumber } = payload || {};
      if (!orderId && !billNumber) {
        return res.status(400).json({ success: false, error: 'Missing orderId or billNumber' });
      }

      try {
        await client.execute({
          sql: 'DELETE FROM deleted_orders WHERE id = ? OR bill_number = ?;',
          args: [orderId || '', billNumber || ''],
        });

        await logFinancialAudit(client, 'RESTORE_SALE', 'order', orderId || billNumber, 0, null, payload);
        await logSyncEvent(client, 'order', orderId || billNumber, 'restore', payload);
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
        const branch = e.branch === 'mg_road' ? 'mg_road' : 'godi_road';
        await client.execute({
          sql: `INSERT OR REPLACE INTO expenses (
            id, title, category, amount, date, payment_mode, paid_to, notes, created_at, branch
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
            branch,
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

    // Save Customer Order (Advance Booking / Scheduled Delivery)
    if (action === 'save-customer-order') {
      const o = payload;
      if (!o || !o.id || !o.orderNumber || !o.customerName || !o.deliveryDate) {
        return res.status(400).json({ success: false, error: 'Invalid customer order payload' });
      }

      try {
        const items = Array.isArray(o.items) ? o.items : [];
        const subtotal = Number(o.subtotal) || items.reduce((s: number, i: any) => s + (Number(i.subtotal) || (Number(i.unitPrice) * Number(i.quantity))), 0);
        const discountAmount = Number(o.discountAmount) || 0;
        const gstAmount = Number(o.gstAmount) || 0;
        const totalAmount = Number(o.totalAmount) || Math.max(0, subtotal - discountAmount + gstAmount);
        const advancePaid = Number(o.advancePaid) || 0;
        const balanceDue = Number(o.balanceDue) !== undefined ? Number(o.balanceDue) : Math.max(0, totalAmount - advancePaid);

        const branch = o.branch === 'mg_road' ? 'mg_road' : 'godi_road';
        await client.execute({
          sql: `INSERT INTO customer_orders (
            id, order_number, customer_name, customer_phone, items_json, subtotal, discount_amount,
            gst_amount, total_amount, advance_paid, balance_due, order_date, delivery_date,
            delivery_time, delivery_address, status, payment_method, notes, created_at, updated_at, branch
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
          ON CONFLICT(id) DO UPDATE SET
            order_number=excluded.order_number,
            customer_name=excluded.customer_name,
            customer_phone=excluded.customer_phone,
            items_json=excluded.items_json,
            subtotal=excluded.subtotal,
            discount_amount=excluded.discount_amount,
            gst_amount=excluded.gst_amount,
            total_amount=excluded.total_amount,
            advance_paid=excluded.advance_paid,
            balance_due=excluded.balance_due,
            order_date=excluded.order_date,
            delivery_date=excluded.delivery_date,
            delivery_time=excluded.delivery_time,
            delivery_address=excluded.delivery_address,
            status=excluded.status,
            payment_method=excluded.payment_method,
            notes=excluded.notes,
            branch=excluded.branch,
            updated_at=CURRENT_TIMESTAMP;`,
          args: [
            o.id,
            o.orderNumber,
            o.customerName,
            o.customerPhone,
            JSON.stringify(items),
            subtotal,
            discountAmount,
            gstAmount,
            totalAmount,
            advancePaid,
            balanceDue,
            o.orderDate || new Date().toISOString().split('T')[0],
            o.deliveryDate,
            o.deliveryTime || '',
            o.deliveryAddress || '',
            o.status || 'Pending',
            o.paymentMethod || 'CASH',
            o.notes || '',
            o.createdAt || new Date().toISOString(),
            branch
          ],
        });

        await logSyncEvent(client, 'customer_order', o.id, 'save', o);
        return res.status(200).json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Update Customer Order Status
    if (action === 'update-customer-order-status') {
      const { orderId, status } = payload || {};
      if (!orderId || !status) {
        return res.status(400).json({ success: false, error: 'Missing orderId or status' });
      }

      try {
        await client.execute({
          sql: 'UPDATE customer_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;',
          args: [status, orderId],
        });

        await logSyncEvent(client, 'customer_order', orderId, 'status_update', { orderId, status });
        return res.status(200).json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Delete Customer Order
    if (action === 'delete-customer-order') {
      const { orderId } = payload || {};
      if (!orderId) {
        return res.status(400).json({ success: false, error: 'Missing orderId' });
      }

      try {
        await client.execute({
          sql: 'DELETE FROM customer_orders WHERE id = ?;',
          args: [orderId],
        });

        await logSyncEvent(client, 'customer_order', orderId, 'delete', { orderId });
        return res.status(200).json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Save Category
    if (action === 'save-category') {
      const cat = payload;
      if (!cat || !cat.id || !cat.name) {
        return res.status(400).json({ success: false, error: 'Invalid category payload' });
      }

      try {
        await client.execute({
          sql: `INSERT INTO categories (id, name, description, is_active, display_order, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET
                  name=excluded.name,
                  description=excluded.description,
                  is_active=excluded.is_active,
                  display_order=excluded.display_order,
                  updated_at=CURRENT_TIMESTAMP;`,
          args: [
            cat.id,
            cat.name.trim(),
            cat.description || '',
            cat.isActive !== false ? 1 : 0,
            Number(cat.displayOrder) || 0,
          ],
        });

        await logSyncEvent(client, 'category', cat.id, 'save', cat);
        return res.status(200).json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Rename Category (and cascade to products)
    if (action === 'rename-category') {
      const { oldName, newName, categoryId } = payload || {};
      if (!oldName || !newName) {
        return res.status(400).json({ success: false, error: 'Missing oldName or newName' });
      }

      try {
        if (categoryId) {
          await client.execute({
            sql: 'UPDATE categories SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;',
            args: [newName.trim(), categoryId],
          });
        }
        await client.execute({
          sql: 'UPDATE products SET category = ?, updated_at = CURRENT_TIMESTAMP WHERE category = ?;',
          args: [newName.trim(), oldName.trim()],
        });

        await logSyncEvent(client, 'category', categoryId || 'rename', 'rename', { oldName, newName });
        return res.status(200).json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Delete Category
    if (action === 'delete-category') {
      const { categoryId } = payload || {};
      if (!categoryId) {
        return res.status(400).json({ success: false, error: 'Missing categoryId' });
      }

      try {
        await client.execute({
          sql: 'DELETE FROM categories WHERE id = ?;',
          args: [categoryId],
        });

        await logSyncEvent(client, 'category', categoryId, 'delete', { categoryId });
        return res.status(200).json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Save Purchase Bill with Atomic Sequential Numbering & Stock Movement
    if (action === 'save-purchase-bill') {
      const b = payload;
      if (!b || !b.id || !b.vendorName) {
        return res.status(400).json({ success: false, error: 'Invalid purchase bill payload: missing id or vendorName' });
      }

      try {
        const branch = b.branch === 'mg_road' ? 'mg_road' : 'godi_road';
        const istDate = b.businessDate || getKolkataDate(b.purchaseDate || Date.now());
        const counterKey = branch === 'mg_road' ? `${istDate}_mg_road` : istDate;
        let dailyBillNum = b.dailyBillNumber ? Number(b.dailyBillNumber) : 0;
        let purchaseNum = b.purchaseNumber || '';

        // Check if bill already exists (editing)
        const existingRes = await client.execute({
          sql: 'SELECT id, purchase_number, daily_bill_number, business_date, items_json, status, branch FROM purchase_bills WHERE id = ? LIMIT 1;',
          args: [b.id],
        });

        const isEdit = existingRes.rows.length > 0;
        let oldItems: any[] = [];

        if (isEdit) {
          const row = existingRes.rows[0];
          purchaseNum = String(row.purchase_number);
          dailyBillNum = Number(row.daily_bill_number) || 1;
          try {
            oldItems = row.items_json ? JSON.parse(String(row.items_json)) : [];
          } catch {}
        } else {
          // Allocate daily bill number atomically
          if (!dailyBillNum || dailyBillNum <= 0) {
            await client.execute({
              sql: `INSERT INTO daily_purchase_counters (business_date, last_bill_number)
                    VALUES (?, 1)
                    ON CONFLICT(business_date) DO UPDATE SET last_bill_number = last_bill_number + 1;`,
              args: [counterKey],
            });
            const counterRes = await client.execute({
              sql: 'SELECT last_bill_number FROM daily_purchase_counters WHERE business_date = ?;',
              args: [counterKey],
            });
            dailyBillNum = Number(counterRes.rows[0]?.last_bill_number) || 1;
          }

          // Allocate global sequential purchase number (PUR-0001, etc.)
          if (!purchaseNum) {
            await client.execute(`
              INSERT INTO purchase_bill_counters (counter_type, last_number)
              VALUES ('purchase', 1)
              ON CONFLICT(counter_type) DO UPDATE SET last_number = last_number + 1;
            `);
            const pCounterRes = await client.execute("SELECT last_number FROM purchase_bill_counters WHERE counter_type = 'purchase';");
            const lastNum = Number(pCounterRes.rows[0]?.last_number) || 1;
            purchaseNum = `PUR-${String(lastNum).padStart(4, '0')}`;
          }
        }

        const newItems = Array.isArray(b.items) ? b.items : [];

        // Inventory Stock Integration: calculate deltas for linked products
        const oldProductQtyMap: Record<string, number> = {};
        for (const it of oldItems) {
          if (it.productId && typeof it.quantity === 'number') {
            oldProductQtyMap[it.productId] = (oldProductQtyMap[it.productId] || 0) + Number(it.quantity);
          }
        }

        const newProductQtyMap: Record<string, number> = {};
        for (const it of newItems) {
          if (it.productId && typeof it.quantity === 'number') {
            newProductQtyMap[it.productId] = (newProductQtyMap[it.productId] || 0) + Number(it.quantity);
          }
        }

        // Apply stock deltas
        const allProductIds = new Set([...Object.keys(oldProductQtyMap), ...Object.keys(newProductQtyMap)]);
        for (const prodId of allProductIds) {
          const oldQty = oldProductQtyMap[prodId] || 0;
          const newQty = newProductQtyMap[prodId] || 0;
          const delta = newQty - oldQty;

          if (delta !== 0) {
            await client.execute({
              sql: 'UPDATE products SET stock = MAX(0, stock + ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?;',
              args: [delta, prodId],
            });

            await client.execute({
              sql: `INSERT INTO stock_movements (product_id, movement_type, reference_id, quantity_delta, notes, timestamp)
                    VALUES (?, 'PURCHASE', ?, ?, ?, ?);`,
              args: [prodId, b.id, delta, `Purchase Bill ${purchaseNum} (${delta > 0 ? '+' : ''}${delta})`, Date.now()],
            });
          }
        }

        // Upsert Vendor record
        if (b.vendorName) {
          const vendorId = b.vendorId || `ven-${b.vendorName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
          await client.execute({
            sql: `INSERT INTO vendors (id, name, contact_number, address, notes, updated_at)
                  VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                  ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    contact_number = COALESCE(excluded.contact_number, vendors.contact_number),
                    updated_at = CURRENT_TIMESTAMP;`,
            args: [vendorId, b.vendorName.trim(), b.vendorContact || null, b.vendorAddress || null, b.vendorNotes || null],
          });
        }

        const subtotal = Number(b.subtotal) || 0;
        const discount = Number(b.discount) || 0;
        const additionalCharges = Number(b.additionalCharges) || 0;
        const grandTotal = Number(b.grandTotal) || Math.max(0, subtotal - discount + additionalCharges);
        const amountPaid = Number(b.amountPaid) || 0;
        const balanceDue = Math.max(0, grandTotal - amountPaid);
        const paymentStatus = balanceDue <= 0.01 ? 'Paid' : (amountPaid > 0 ? 'Partially Paid' : 'Unpaid');

        // Save Purchase Bill
        await client.execute({
          sql: `INSERT INTO purchase_bills (
            id, purchase_number, daily_bill_number, business_date, vendor_id, vendor_name, vendor_contact,
            vendor_invoice_number, purchase_date, items_json, subtotal, discount, additional_charges,
            grand_total, amount_paid, balance_due, payment_status, payment_mode, notes, status, updated_at, branch
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
          ON CONFLICT(id) DO UPDATE SET
            vendor_name = excluded.vendor_name,
            vendor_contact = excluded.vendor_contact,
            vendor_invoice_number = excluded.vendor_invoice_number,
            purchase_date = excluded.purchase_date,
            items_json = excluded.items_json,
            subtotal = excluded.subtotal,
            discount = excluded.discount,
            additional_charges = excluded.additional_charges,
            grand_total = excluded.grand_total,
            amount_paid = excluded.amount_paid,
            balance_due = excluded.balance_due,
            payment_status = excluded.payment_status,
            payment_mode = excluded.payment_mode,
            notes = excluded.notes,
            status = excluded.status,
            branch = excluded.branch,
            updated_at = CURRENT_TIMESTAMP;`,
          args: [
            b.id,
            purchaseNum,
            dailyBillNum,
            istDate,
            b.vendorId || null,
            b.vendorName.trim(),
            b.vendorContact || null,
            b.vendorInvoiceNumber || null,
            b.purchaseDate || istDate,
            JSON.stringify(newItems),
            subtotal,
            discount,
            additionalCharges,
            grandTotal,
            amountPaid,
            balanceDue,
            paymentStatus,
            b.paymentMode || 'Cash',
            b.notes || null,
            b.status || 'Active',
            branch,
          ],
        });

        // Record initial payment in vendor_payments if not previously recorded and amountPaid > 0
        if (!isEdit && amountPaid > 0) {
          const payId = `pay-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
          await client.execute({
            sql: `INSERT INTO vendor_payments (id, purchase_bill_id, vendor_id, payment_date, amount, payment_mode, notes)
                  VALUES (?, ?, ?, ?, ?, ?, ?);`,
            args: [
              payId,
              b.id,
              b.vendorId || null,
              b.purchaseDate || istDate,
              amountPaid,
              b.paymentMode || 'Cash',
              `Initial payment for ${purchaseNum}`,
            ],
          });
        }

        const savedBill = {
          ...b,
          purchaseNumber: purchaseNum,
          dailyBillNumber: dailyBillNum,
          businessDate: istDate,
          grandTotal,
          amountPaid,
          balanceDue,
          paymentStatus,
          status: b.status || 'Active',
          branch,
        };

        await logFinancialAudit(client, isEdit ? 'UPDATE_PURCHASE' : 'RECORD_PURCHASE', 'purchase_bill', b.id, grandTotal, b.paymentMode || 'Cash', {
          purchaseNumber: purchaseNum,
          dailyBillNumber: dailyBillNum,
          businessDate: istDate,
          vendorName: b.vendorName,
          amountPaid,
          balanceDue,
        });

        await logSyncEvent(client, 'purchase_bill', b.id, 'save', savedBill);
        return res.status(200).json({ success: true, purchaseBill: savedBill });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Cancel Purchase Bill (with Stock Reversal)
    if (action === 'cancel-purchase-bill') {
      const { billId, reason } = payload || {};
      if (!billId) {
        return res.status(400).json({ success: false, error: 'Missing billId' });
      }

      try {
        const billRes = await client.execute({
          sql: 'SELECT * FROM purchase_bills WHERE id = ? LIMIT 1;',
          args: [billId],
        });

        if (billRes.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Purchase bill not found' });
        }

        const bill = billRes.rows[0];
        if (bill.status === 'Cancelled') {
          return res.status(200).json({ success: true, message: 'Already cancelled' });
        }

        // Reverse stock on linked products
        let items: any[] = [];
        try {
          items = bill.items_json ? JSON.parse(String(bill.items_json)) : [];
        } catch {}

        for (const it of items) {
          if (it.productId && typeof it.quantity === 'number') {
            await client.execute({
              sql: 'UPDATE products SET stock = MAX(0, stock - ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?;',
              args: [Number(it.quantity), it.productId],
            });

            await client.execute({
              sql: `INSERT INTO stock_movements (product_id, movement_type, reference_id, quantity_delta, notes, timestamp)
                    VALUES (?, 'PURCHASE_CANCEL', ?, ?, ?, ?);`,
              args: [it.productId, billId, -Number(it.quantity), `Cancelled Purchase ${bill.purchase_number}`, Date.now()],
            });
          }
        }

        // Soft-cancel the bill
        await client.execute({
          sql: "UPDATE purchase_bills SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?;",
          args: [billId],
        });

        await logFinancialAudit(client, 'CANCEL_PURCHASE', 'purchase_bill', billId, Number(bill.grand_total) || 0, null, {
          purchaseNumber: bill.purchase_number,
          reason: reason || 'Cancelled by user',
        });

        await logSyncEvent(client, 'purchase_bill', billId, 'cancel', { billId });
        return res.status(200).json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Add Vendor Payment
    if (action === 'add-vendor-payment') {
      const { payment } = payload || {};
      if (!payment || !payment.purchaseBillId || !payment.amount) {
        return res.status(400).json({ success: false, error: 'Invalid payment payload: missing purchaseBillId or amount' });
      }

      try {
        const payId = payment.id || `pay-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const payAmount = Number(payment.amount) || 0;

        await client.execute({
          sql: `INSERT INTO vendor_payments (id, purchase_bill_id, vendor_id, payment_date, amount, payment_mode, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?);`,
          args: [
            payId,
            payment.purchaseBillId,
            payment.vendorId || null,
            payment.paymentDate || getKolkataDate(),
            payAmount,
            payment.paymentMode || 'Cash',
            payment.notes || null,
          ],
        });

        // Update purchase bill amount_paid and balance_due
        await client.execute({
          sql: `UPDATE purchase_bills
                SET amount_paid = amount_paid + ?,
                    balance_due = MAX(0, balance_due - ?),
                    payment_status = CASE WHEN balance_due - ? <= 0.01 THEN 'Paid' ELSE 'Partially Paid' END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?;`,
          args: [payAmount, payAmount, payAmount, payment.purchaseBillId],
        });

        // Fetch updated bill for real-time broadcast
        const updatedBillRes = await client.execute({
          sql: 'SELECT * FROM purchase_bills WHERE id = ?;',
          args: [payment.purchaseBillId],
        });

        await logFinancialAudit(client, 'VENDOR_PAYMENT', 'vendor_payment', payId, payAmount, payment.paymentMode || 'Cash', {
          purchaseBillId: payment.purchaseBillId,
        });

        await logSyncEvent(client, 'vendor_payment', payId, 'save', {
          payment: { ...payment, id: payId },
          updatedBill: updatedBillRes.rows[0],
        });

        return res.status(200).json({ success: true, paymentId: payId, updatedBill: updatedBillRes.rows[0] });
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
