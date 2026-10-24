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
  const tables = [
    'products', 'orders', 'categories', 'purchase_bills', 
    'vendor_payments', 'vendors', 'daily_bill_counters', 
    'daily_purchase_counters', 'customers', 'deleted_orders', 
    'financial_audit_logs', 'sync_events'
  ];

  console.log('=== CANONICAL DATABASE ROW COUNTS ===');
  for (const t of tables) {
    const res = await client.execute('SELECT COUNT(*) as cnt FROM ' + t);
    console.log(t.padEnd(25) + ': ' + res.rows[0].cnt);
  }

  console.log('\n=== PURCHASE BILL DETAIL (GENUINE BUSINESS RECORD) ===');
  const bills = await client.execute('SELECT id, purchase_number, business_date, vendor_name, grand_total, status, branch FROM purchase_bills');
  console.log(JSON.stringify(bills.rows, null, 2));

  console.log('\n=== VENDOR PAYMENTS DETAIL ===');
  const cols = await client.execute('PRAGMA table_info(vendor_payments)');
  console.log('Columns:', cols.rows.map(c => c.name));
  const payments = await client.execute('SELECT * FROM vendor_payments');
  console.log(JSON.stringify(payments.rows, null, 2));
}

main().catch(console.error);
