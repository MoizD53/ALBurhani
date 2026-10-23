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

async function createBackup() {
  const timestamp = Date.now();
  const backupTableName = `orders_backup_pre_daily_numbers_${timestamp}`;
  console.log(`Creating cloud backup table: ${backupTableName}...`);

  await client.execute(`CREATE TABLE ${backupTableName} AS SELECT * FROM orders;`);
  const backupCount = await client.execute(`SELECT COUNT(*) as count FROM ${backupTableName};`);
  console.log(`Backup table created with ${backupCount.rows[0].count} orders.`);

  // Local JSON backup
  const allOrders = await client.execute('SELECT * FROM orders;');
  const allDeleted = await client.execute('SELECT * FROM deleted_orders;');
  const backupData = {
    timestamp,
    orders: allOrders.rows,
    deleted_orders: allDeleted.rows
  };

  if (!fs.existsSync('backups')) {
    fs.mkdirSync('backups');
  }
  const localFile = `backups/backup_pre_daily_numbers_${timestamp}.json`;
  fs.writeFileSync(localFile, JSON.stringify(backupData, null, 2));
  console.log(`Saved local JSON backup to ${localFile} (${allOrders.rows.length} orders).`);
}

createBackup().catch(console.error);
