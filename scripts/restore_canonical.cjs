const fs = require('fs');
const dotenv = fs.readFileSync('.env', 'utf-8');
const env = {};
dotenv.split(/\r?\n/).forEach(line => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let v = m[2] || '';
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
    env[m[1]] = v.trim();
  }
});

const { createClient } = require('@libsql/client');
const client = createClient({
  url: env.TURSO_DB_URL,
  authToken: env.TURSO_AUTH_TOKEN
});

async function restoreCanonicalOrders() {
  console.log('--- Step 1: Pre-flight check ---');
  const countBefore = await client.execute('SELECT COUNT(*) as count, SUM(grand_total) as sum FROM orders;');
  console.log('Count before:', countBefore.rows[0]);

  // Create financial_audit_logs if not exists
  await client.execute(`
    CREATE TABLE IF NOT EXISTS financial_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      amount REAL DEFAULT 0,
      payment_method TEXT,
      details_json TEXT,
      actor TEXT DEFAULT 'Owner',
      timestamp INTEGER NOT NULL
    );
  `);

  console.log('--- Step 2: Clear tombstones for 2043 and 4761 ---');
  await client.execute(`
    DELETE FROM deleted_orders 
    WHERE id IN ('sale-1792594590792-2043', 'sale-1792594676977-4761') 
       OR bill_number IN ('ALB-NB-2043', 'ALB-NB-4761');
  `);

  // Fetch payload for 2043 (SyncEvent 380)
  const ev2043 = await client.execute(`SELECT payload_json FROM sync_events WHERE id = 380;`);
  const o2043 = JSON.parse(ev2043.rows[0].payload_json);

  // Fetch payload for 4761 (SyncEvent 862)
  const ev4761 = await client.execute(`SELECT payload_json FROM sync_events WHERE id = 862;`);
  const o4761 = JSON.parse(ev4761.rows[0].payload_json);

  console.log('--- Step 3: Insert / Restore orders in Turso DB ---');
  for (const o of [o2043, o4761]) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO orders (
        id, bill_number, transaction_type, items_json, subtotal, discount_amount, gst_amount, grand_total,
        payment_method, amount_received, change_given, customer_name, customer_phone, cashier_name, created_at,
        timestamp, is_revised, original_grand_total, additional_amount_paid, original_payment_method,
        additional_payment_method, revised_at, revised_timestamp, revision_count, due_amount, is_settled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
        Number(o.amountReceived) || Number(o.grandTotal) || 0,
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
        Number(o.dueAmount) || 0,
        o.isSettled !== undefined ? (o.isSettled ? 1 : 0) : 1,
      ],
    });

    // Record in financial_audit_logs
    await client.execute({
      sql: `INSERT INTO financial_audit_logs (action, entity_type, entity_id, amount, payment_method, details_json, actor, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      args: [
        'RESTORE_CANONICAL_ORDER',
        'order',
        o.id,
        o.grandTotal,
        o.paymentMethod,
        JSON.stringify({ billNumber: o.billNumber, itemsCount: o.items?.length, reason: 'Reconciliation restoration of genuine sale' }),
        'System Auditor',
        Date.now()
      ]
    });
    console.log(`Restored ${o.billNumber} (${o.id}): ₹${o.grandTotal}`);
  }

  console.log('--- Step 4: Verification ---');
  const countAfter = await client.execute('SELECT COUNT(*) as count, SUM(grand_total) as total_rev FROM orders;');
  console.log('Count after:', countAfter.rows[0]);

  const pmBreakdown = await client.execute('SELECT payment_method, COUNT(*) as count, SUM(grand_total) as sum FROM orders GROUP BY payment_method;');
  console.log('Payment breakdown:', pmBreakdown.rows);

  const delList = await client.execute('SELECT * FROM deleted_orders;');
  console.log('Remaining deleted orders:', delList.rows);
}

restoreCanonicalOrders().catch(console.error);
