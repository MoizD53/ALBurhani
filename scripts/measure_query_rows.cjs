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

async function main() {
  console.log('--- READ ROW COUNT PER QUERY ---');
  
  const queries = [
    { name: 'fetch-deleted-orders', sql: 'SELECT id, bill_number, deleted_at FROM deleted_orders ORDER BY deleted_at DESC LIMIT 1000;' },
    { name: 'fetch-products', sql: 'SELECT * FROM products ORDER BY category ASC, name ASC;' },
    { name: 'fetch-orders (all)', sql: 'SELECT * FROM orders ORDER BY created_at DESC;' },
    { name: 'fetch-orders (godi_road)', sql: "SELECT * FROM orders WHERE branch = 'godi_road' ORDER BY created_at DESC;" },
    { name: 'fetch-orders (mg_road)', sql: "SELECT * FROM orders WHERE branch = 'mg_road' ORDER BY created_at DESC;" },
    { name: 'fetch-expenses', sql: 'SELECT * FROM expenses ORDER BY date DESC;' },
    { name: 'fetch-customers', sql: 'SELECT * FROM customers ORDER BY total_spent DESC LIMIT 200;' },
    { name: 'fetch-settings', sql: 'SELECT * FROM settings;' },
    { name: 'fetch-customer-orders', sql: 'SELECT * FROM customer_orders ORDER BY created_at DESC;' },
    { name: 'fetch-categories', sql: 'SELECT * FROM categories ORDER BY display_order ASC, name ASC;' },
    { name: 'fetch-purchase-bills (bills)', sql: 'SELECT * FROM purchase_bills ORDER BY business_date DESC, daily_bill_number ASC LIMIT 500;' },
    { name: 'fetch-purchase-bills (payments)', sql: 'SELECT * FROM vendor_payments ORDER BY payment_date ASC;' },
    { name: 'fetch-vendors (vendors)', sql: 'SELECT * FROM vendors ORDER BY name ASC;' },
    { name: 'fetch-vendors (stats)', sql: "SELECT vendor_name, COUNT(*) as bills_count, COALESCE(SUM(grand_total), 0) as total_purchases, COALESCE(SUM(amount_paid), 0) as total_paid, COALESCE(SUM(balance_due), 0) as balance_due FROM purchase_bills WHERE status != 'Cancelled' GROUP BY vendor_name;" },
    { name: 'fetch-events (empty)', sql: 'SELECT id, entity_type, entity_id, operation, payload_json, server_timestamp FROM sync_events WHERE server_timestamp > ? ORDER BY server_timestamp ASC LIMIT 100;', args: [Date.now()] },
    { name: 'fetch-events (past hour)', sql: 'SELECT id, entity_type, entity_id, operation, payload_json, server_timestamp FROM sync_events WHERE server_timestamp > ? ORDER BY server_timestamp ASC LIMIT 100;', args: [Date.now() - 3600000] },
    { name: 'reconcile-check (summary)', sql: "SELECT transaction_type, COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total_revenue, COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN grand_total ELSE 0 END), 0) as cash_total, COALESCE(SUM(CASE WHEN payment_method = 'UPI' THEN grand_total ELSE 0 END), 0) as upi_total, COALESCE(SUM(CASE WHEN payment_method = 'CREDIT' THEN grand_total ELSE 0 END), 0) as credit_total FROM orders GROUP BY transaction_type;" },
    { name: 'reconcile-check (totalOrders)', sql: 'SELECT COUNT(*) as count FROM orders;' },
    { name: 'reconcile-check (totalDeleted)', sql: 'SELECT COUNT(*) as count FROM deleted_orders;' },
  ];

  let totalRows = 0;
  for (const q of queries) {
    const res = await client.execute({ sql: q.sql, args: q.args || [] });
    console.log(`  ${q.name.padEnd(35)}: ${res.rows.length} rows`);
    if (!q.name.includes('(godi_road)') && !q.name.includes('(mg_road)') && !q.name.includes('(past hour)') && !q.name.includes('reconcile-check')) {
      totalRows += res.rows.length;
    }
  }
  console.log(`\nSingle complete cold-boot load total rows = ${totalRows}`);
}

main().catch(console.error);
