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
  console.log('--- BACKUP & RE-SEQUENCE DUPLICATE DAILY BILL NUMBERS ---');

  // 1. Create safety backup
  const backupName = `orders_backup_pre_fix_dups_${Date.now()}`;
  await client.execute(`CREATE TABLE ${backupName} AS SELECT * FROM orders;`);
  console.log(`Created backup table: ${backupName}`);

  // 2. Fetch all orders for 2026-10-24 ordered by timestamp
  const res = await client.execute("SELECT id, bill_number, daily_bill_number, created_at, timestamp FROM orders WHERE business_date = '2026-10-24' ORDER BY timestamp ASC");
  console.log(`Found ${res.rows.length} orders for 2026-10-24`);

  // Target mapping:
  // Rows 0 to 11 (Bills 1 to 13) stay untouched
  // Row 12 (ALB-NB-9395, was 11) -> 14
  // Row 13 (ALB-NB-9898, was 12) -> 15
  // Row 14 (ALB-NB-3119, was 13) -> 16
  // Rows 15 to 41 (ALB-NB-1484 onwards, were 16 to 42) -> shift by +1 (17 to 43)

  const updates = [];
  res.rows.forEach((r, idx) => {
    let targetDaily = Number(r.daily_bill_number);
    if (r.bill_number === 'ALB-NB-9395') targetDaily = 14;
    else if (r.bill_number === 'ALB-NB-9898') targetDaily = 15;
    else if (r.bill_number === 'ALB-NB-3119') targetDaily = 16;
    else if (idx >= 15) {
      targetDaily = Number(r.daily_bill_number) + 1;
    }

    if (targetDaily !== Number(r.daily_bill_number)) {
      updates.push({
        id: r.id,
        bill_number: r.bill_number,
        oldDaily: r.daily_bill_number,
        newDaily: targetDaily,
        time: r.created_at
      });
    }
  });

  console.log(`Applying updates to ${updates.length} orders:`);
  console.table(updates);

  // Apply batch updates
  const batch = updates.map(u => ({
    sql: 'UPDATE orders SET daily_bill_number = ? WHERE id = ?;',
    args: [u.newDaily, u.id]
  }));

  // Also update daily_bill_counters for 2026-10-24
  batch.push({
    sql: `INSERT INTO daily_bill_counters (business_date, last_bill_number)
          VALUES ('2026-10-24', 43)
          ON CONFLICT(business_date) DO UPDATE SET last_bill_number = 43;`
  });

  await client.batch(batch, 'write');
  console.log('Batch update committed successfully!');

  // Verify
  const verifyRes = await client.execute("SELECT id, bill_number, daily_bill_number, created_at FROM orders WHERE business_date = '2026-10-24' ORDER BY timestamp ASC");
  console.log('\n--- VERIFIED ORDERS AFTER RE-SEQUENCE ---');
  verifyRes.rows.forEach((r, i) => {
    console.log(`${String(i + 1).padStart(2)}: ${r.bill_number} | Daily #${r.daily_bill_number} | ${r.created_at}`);
  });

  // Check for any duplicates remaining
  const dupCheck = await client.execute(`
    SELECT daily_bill_number, COUNT(*) as cnt 
    FROM orders 
    WHERE business_date = '2026-10-24' 
    GROUP BY daily_bill_number 
    HAVING cnt > 1;
  `);
  console.log('\nRemaining duplicates (must be 0):', dupCheck.rows);

  const counterCheck = await client.execute("SELECT * FROM daily_bill_counters WHERE business_date = '2026-10-24';");
  console.log('Counter for today:', counterCheck.rows[0]);
}

main().catch(console.error);
