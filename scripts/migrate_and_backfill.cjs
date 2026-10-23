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

function toIstDateString(createdAt, timestamp, id) {
  // If timestamp exists
  if (timestamp && Number(timestamp) > 0) {
    const d = new Date(Number(timestamp));
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  }

  // If id is sale-${timestamp}
  if (id && id.startsWith('sale-')) {
    const parts = id.split('-');
    const ts = parseInt(parts[1], 10);
    if (!isNaN(ts) && ts > 1600000000000) {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date(ts));
    }
  }

  // Parse string like '21-Oct-2026, 08:26 pm'
  if (createdAt) {
    const m = createdAt.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
    if (m) {
      const months = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
      };
      const day = m[1].padStart(2, '0');
      const month = months[m[2].toLowerCase()] || '10';
      const year = m[3];
      return `${year}-${month}-${day}`;
    }
  }

  return '2026-10-23';
}

function extractSortTime(order) {
  if (order.timestamp && Number(order.timestamp) > 0) {
    return Number(order.timestamp);
  }
  if (order.id && order.id.startsWith('sale-')) {
    const parts = order.id.split('-');
    const ts = parseInt(parts[1], 10);
    if (!isNaN(ts) && ts > 1600000000000) return ts;
  }
  if (order.created_at) {
    const parsed = Date.parse(order.created_at);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

async function migrateAndBackfill() {
  console.log('--- Step 1: Adding Columns & Tables ---');
  try {
    await client.execute('ALTER TABLE orders ADD COLUMN business_date TEXT;');
    console.log('Added column business_date to orders.');
  } catch (err) {
    console.log('Column business_date already exists or note:', err.message);
  }

  try {
    await client.execute('ALTER TABLE orders ADD COLUMN daily_bill_number INTEGER;');
    console.log('Added column daily_bill_number to orders.');
  } catch (err) {
    console.log('Column daily_bill_number already exists or note:', err.message);
  }

  await client.execute(`
    CREATE TABLE IF NOT EXISTS daily_bill_counters (
      business_date TEXT PRIMARY KEY,
      last_bill_number INTEGER NOT NULL DEFAULT 0
    );
  `);
  console.log('Created table daily_bill_counters.');

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_orders_biz_date ON orders (business_date, daily_bill_number);
  `);
  console.log('Created index idx_orders_biz_date.');

  console.log('--- Step 2: Fetching Existing Orders ---');
  const res = await client.execute('SELECT id, bill_number, created_at, timestamp, grand_total FROM orders;');
  console.log(`Fetched ${res.rows.length} orders.`);

  // Group by business date
  const groups = {};
  for (const row of res.rows) {
    const bDate = toIstDateString(row.created_at, row.timestamp, row.id);
    if (!groups[bDate]) groups[bDate] = [];
    groups[bDate].push(row);
  }

  console.log('--- Step 3: Backfilling Sequential Daily Bill Numbers ---');
  const sortedDates = Object.keys(groups).sort();
  for (const bDate of sortedDates) {
    const ordersInDate = groups[bDate];
    // Sort orders ascending by time
    ordersInDate.sort((a, b) => extractSortTime(a) - extractSortTime(b));

    console.log(`Backfilling date ${bDate} (${ordersInDate.length} orders)...`);
    let seq = 1;
    for (const order of ordersInDate) {
      await client.execute({
        sql: `UPDATE orders SET business_date = ?, daily_bill_number = ? WHERE id = ?;`,
        args: [bDate, seq, order.id],
      });
      seq++;
    }

    const lastBillNum = ordersInDate.length;
    await client.execute({
      sql: `INSERT OR REPLACE INTO daily_bill_counters (business_date, last_bill_number) VALUES (?, ?);`,
      args: [bDate, lastBillNum],
    });
    console.log(`Initialized counter for ${bDate}: last_bill_number = ${lastBillNum}`);
  }

  console.log('--- Step 4: Verification of Backfilled Records ---');
  const checkRes = await client.execute(`
    SELECT business_date, COUNT(*) as count, MIN(daily_bill_number) as min_seq, MAX(daily_bill_number) as max_seq, SUM(grand_total) as revenue
    FROM orders
    GROUP BY business_date
    ORDER BY business_date ASC;
  `);
  console.log('Grouped verification:', checkRes.rows);

  const totalCheck = await client.execute('SELECT COUNT(*) as total_orders, SUM(grand_total) as total_rev FROM orders;');
  console.log('Total check:', totalCheck.rows[0]);

  const countersCheck = await client.execute('SELECT * FROM daily_bill_counters ORDER BY business_date ASC;');
  console.log('Counters check:', countersCheck.rows);
}

migrateAndBackfill().catch(console.error);
