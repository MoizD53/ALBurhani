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
const client = createClient({ url: env.TURSO_DB_URL, authToken: env.TURSO_AUTH_TOKEN });

async function createPurchaseTables() {
  console.log('--- Creating Purchase Bills & Vendor tables in Turso ---');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_number TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Table vendors created.');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS purchase_bills (
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
    );
  `);
  console.log('Table purchase_bills created.');

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_purchase_bills_date ON purchase_bills (purchase_date DESC);
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS purchase_bill_counters (
      counter_type TEXT PRIMARY KEY,
      last_number INTEGER NOT NULL DEFAULT 0
    );
  `);
  console.log('Table purchase_bill_counters created.');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS vendor_payments (
      id TEXT PRIMARY KEY,
      purchase_bill_id TEXT NOT NULL,
      vendor_id TEXT,
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Table vendor_payments created.');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS daily_purchase_counters (
      business_date TEXT PRIMARY KEY,
      last_bill_number INTEGER NOT NULL DEFAULT 0
    );
  `);

  try {
    await client.execute('ALTER TABLE purchase_bills ADD COLUMN business_date TEXT;');
  } catch {}
  try {
    await client.execute('ALTER TABLE purchase_bills ADD COLUMN daily_bill_number INTEGER DEFAULT 1;');
  } catch {}
  try {
    await client.execute('CREATE INDEX IF NOT EXISTS idx_purchase_biz_date ON purchase_bills (business_date, daily_bill_number);');
  } catch {}

  console.log('All purchase tables created successfully.');
}

createPurchaseTables().catch(console.error);
