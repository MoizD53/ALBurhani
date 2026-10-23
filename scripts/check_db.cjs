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
  url: env.TURSO_DB_URL || env.TURSO_DATABASE_URL || env.VITE_TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN || env.VITE_TURSO_AUTH_TOKEN
});

async function main() {
  const countRes = await client.execute('SELECT COUNT(*) as count, SUM(grand_total) as total_rev FROM orders;');
  console.log('Orders summary:', countRes.rows[0]);

  const pmRes = await client.execute('SELECT payment_method, COUNT(*) as count, SUM(grand_total) as sum FROM orders GROUP BY payment_method;');
  console.log('Payment method breakdown:', pmRes.rows);

  const disputed = await client.execute("SELECT id, bill_number, grand_total, payment_method FROM orders WHERE bill_number IN ('ALB-NB-2043', 'ALB-NB-4761');");
  console.log('Disputed orders in DB:', disputed.rows);

  const delRes = await client.execute('SELECT * FROM deleted_orders;');
  console.log('Deleted orders table:', delRes.rows);

  const backupTables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'orders_backup%';");
  console.log('Backup tables:', backupTables.rows);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
