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

// Format date to YYYY-MM-DD in Asia/Kolkata
function toIstDateString(createdAt, timestamp) {
  if (timestamp && Number(timestamp) > 0) {
    const d = new Date(Number(timestamp));
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(d); // YYYY-MM-DD
  }

  // Parse string like '21-Oct-2026, 08:26 pm' or '2026-10-21...'
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
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      return formatter.format(d);
    }
  }

  return '2026-10-23';
}

async function analyze() {
  const res = await client.execute('SELECT id, bill_number, created_at, timestamp, grand_total, payment_method, transaction_type FROM orders ORDER BY COALESCE(timestamp, 0) ASC;');
  console.log('Total orders in DB:', res.rows.length);

  const dateGroups = {};
  for (const r of res.rows) {
    const bizDate = toIstDateString(r.created_at, r.timestamp);
    if (!dateGroups[bizDate]) dateGroups[bizDate] = [];
    dateGroups[bizDate].push(r);
  }

  console.log('--- Breakdown by Business Date (Asia/Kolkata) ---');
  for (const [date, orders] of Object.entries(dateGroups)) {
    const totalRev = orders.reduce((sum, o) => sum + Number(o.grand_total), 0);
    console.log(`Date: ${date} -> ${orders.length} orders, Total: ₹${totalRev.toFixed(2)}`);
    console.log(`  First order: ${orders[0].bill_number} (${orders[0].created_at})`);
    console.log(`  Last order: ${orders[orders.length - 1].bill_number} (${orders[orders.length - 1].created_at})`);
  }
}

analyze().catch(console.error);
