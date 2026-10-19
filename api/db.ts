import { createClient, Client } from '@libsql/client';

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
 * Verify authorization for destructive actions (e.g. wipe database, reset all stock).
 * SECURITY: Never trust client-supplied headers or roles (e.g. x-albhurani-role: Owner).
 * Requires an explicit server-side configured secret: process.env.ALBHURANI_ADMIN_SECRET.
 */
function isAuthorizedDestructiveAction(req: VercelRequest): boolean {
  const authHeader = req.headers['authorization'];
  const adminSecret = process.env.ALBHURANI_ADMIN_SECRET;

  if (!adminSecret) {
    // If no admin secret is configured on the server, reject destructive actions by default
    return false;
  }

  return authHeader === `Bearer ${adminSecret}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers for safe local development / custom domains
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

  // 1. GET Requests: Status & Read-only queries
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
        const result = await client.execute('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200;');
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

    return res.status(400).json({ success: false, error: 'Unknown GET action' });
  }

  // 2. POST Requests: Writes, Updates, Deletions
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
        // Idempotently add price_tiers column if it does not exist
        try {
          await client.execute('ALTER TABLE products ADD COLUMN price_tiers TEXT;');
        } catch {
          // column already exists
        }

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
        return res.status(200).json({ success: true });
      } catch (err: any) {
        // Fallback for legacy tables where ALTER TABLE may not be permitted
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
            ],
          });
          return res.status(200).json({ success: true });
        } catch (fallbackErr: any) {
          return res.status(500).json({ success: false, error: fallbackErr?.message || err?.message });
        }
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
        return res.status(200).json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Save Order (Initial Sale or Revision)
    if (action === 'save-order') {
      const o = payload;
      if (!o || !o.id || !o.billNumber) {
        return res.status(400).json({ success: false, error: 'Invalid order payload' });
      }

      try {
        await client.execute({
          sql: `INSERT OR REPLACE INTO orders (
            id, bill_number, transaction_type, items_json, subtotal, discount_amount, gst_amount, grand_total,
            payment_method, amount_received, change_given, customer_name, customer_phone, cashier_name, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
          ],
        });
        return res.status(200).json({ success: true });
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
            id, title, category, amount, date, payment_mode, paid_to, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          args: [
            e.id,
            e.title,
            e.category || 'Store Operations',
            Number(e.amount) || 0,
            e.date || new Date().toISOString(),
            e.paymentMode || 'Cash',
            e.paidTo || null,
            e.notes || null,
          ],
        });
        return res.status(200).json({ success: true });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    // Destructive Administrative Actions (Protected by server secret check - NEVER trust client role)
    if (action === 'reset-all-stock') {
      if (!isAuthorizedDestructiveAction(req)) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Server-side Owner secret required for destructive action' });
      }

      try {
        const resExec = await client.execute('UPDATE products SET stock = 0, updated_at = CURRENT_TIMESTAMP;');
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
        return res.status(200).json({ success: true, count: resExec.rowsAffected });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message });
      }
    }

    return res.status(400).json({ success: false, error: `Unsupported POST action: ${action}` });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
