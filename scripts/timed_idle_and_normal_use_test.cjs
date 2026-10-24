const fs = require('fs');
const dotenv = fs.readFileSync('.env', 'utf-8');
const env = {};
dotenv.split(/\r?\n/).forEach(line => {
  const m = line.match(/^\s*([\w.-]+)\s*=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^['\"]|['\"]$/g, '').trim();
});

const { createClient } = require('@libsql/client');
const client = createClient({
  url: env.TURSO_DB_URL,
  authToken: env.TURSO_AUTH_TOKEN
});

async function runTimedMeasurement() {
  console.log('========================================================');
  console.log('  AL-BHURANI TIMED IDLE & NORMAL-USE VERIFICATION TEST  ');
  console.log('========================================================\n');

  const startTime = new Date();
  console.log(`[TEST START] Timestamp: ${startTime.toISOString()} (${startTime.toLocaleString()})`);

  // --- PHASE 1: IDLE PERIOD TEST (60 seconds) ---
  console.log('\n--- PHASE 1: TIMED IDLE PERIOD TEST (60 seconds) ---');
  console.log('Simulating active client with shop open, polling delta events every 10s...');

  let cursor = Date.now();
  let idleQueriesExecuted = 0;
  let idleRowsRead = 0;

  const intervalSeconds = 10;
  const totalIdleSeconds = 60;
  const iterations = totalIdleSeconds / intervalSeconds;

  for (let i = 1; i <= iterations; i++) {
    const qStart = Date.now();
    const res = await client.execute({
      sql: `SELECT id, entity_type, entity_id, operation, payload_json, server_timestamp
            FROM sync_events
            WHERE server_timestamp > ? AND (branch = ? OR branch = 'all' OR branch IS NULL)
            ORDER BY server_timestamp ASC LIMIT 100;`,
      args: [cursor, 'godi_road']
    });
    const qDuration = Date.now() - qStart;
    idleQueriesExecuted++;
    idleRowsRead += res.rows.length;
    console.log(`  [Poll #${i} at +${i * intervalSeconds}s] ${res.rows.length} rows returned (${qDuration}ms). Cursor: ${cursor}`);
    
    // In syncManager, cursor advances to latest event or server timestamp
    cursor = Date.now();

    if (i < iterations) {
      await new Promise(r => setTimeout(r, intervalSeconds * 1000));
    }
  }

  const idleEndTime = new Date();
  const idleElapsedMinutes = (idleEndTime - startTime) / 60000;
  const idleReadsPerMinute = idleRowsRead / idleElapsedMinutes;

  console.log(`\n[IDLE TEST RESULTS]`);
  console.log(`  Duration:             ${(idleEndTime - startTime) / 1000} seconds`);
  console.log(`  Queries Executed:     ${idleQueriesExecuted}`);
  console.log(`  Total Rows Read:      ${idleRowsRead} rows`);
  console.log(`  Measured Growth Rate: ${idleReadsPerMinute.toFixed(2)} rows/minute`);

  // --- PHASE 2: SAFE NORMAL-USE TEST ---
  console.log('\n--- PHASE 2: SAFE NORMAL-USE TEST ---');
  console.log('Testing common POS operations without creating fake transactions or altering records...');

  const normalUseStart = Date.now();
  let normalUseRowsRead = 0;
  let normalUseQueries = 0;

  // 1. Barcode product lookup (Index scan on barcode)
  const barcodeTest = await client.execute({
    sql: 'SELECT * FROM products WHERE barcode = ? LIMIT 1;',
    args: ['1001']
  });
  normalUseQueries++;
  normalUseRowsRead += barcodeTest.rows.length;
  console.log(`  1. Barcode scan lookup (1001):          ${barcodeTest.rows.length} rows read`);

  // 2. Category list read
  const catTest = await client.execute({
    sql: 'SELECT * FROM categories ORDER BY display_order ASC, name ASC;'
  });
  normalUseQueries++;
  normalUseRowsRead += catTest.rows.length;
  console.log(`  2. Category catalogue navigation:      ${catTest.rows.length} rows read`);

  // 3. Daily bill counter check for today (2026-10-24)
  const counterTest = await client.execute({
    sql: 'SELECT last_bill_number FROM daily_bill_counters WHERE business_date = ? LIMIT 1;',
    args: ['2026-10-24']
  });
  normalUseQueries++;
  normalUseRowsRead += counterTest.rows.length;
  console.log(`  3. Daily bill counter read (today):     ${counterTest.rows.length} rows read (counter = ${counterTest.rows[0]?.last_bill_number || 0})`);

  // 4. Branch order count verification
  const orderCountTest = await client.execute({
    sql: "SELECT COUNT(*) as count FROM orders WHERE branch = 'godi_road';"
  });
  normalUseQueries++;
  normalUseRowsRead += 1;
  console.log(`  4. Branch order summary (godi_road):    1 row read (count = ${orderCountTest.rows[0]?.count})`);

  // 5. Vendor directory check
  const vendorTest = await client.execute({
    sql: 'SELECT * FROM vendors ORDER BY name ASC;'
  });
  normalUseQueries++;
  normalUseRowsRead += vendorTest.rows.length;
  console.log(`  5. Vendor directory fetch:              ${vendorTest.rows.length} rows read`);

  const normalUseDuration = (Date.now() - normalUseStart) / 1000;
  console.log(`\n[NORMAL-USE TEST RESULTS]`);
  console.log(`  Duration:             ${normalUseDuration.toFixed(2)} seconds`);
  console.log(`  Queries Executed:     ${normalUseQueries}`);
  console.log(`  Total Rows Read:      ${normalUseRowsRead} rows`);

  const overallEndTime = new Date();
  console.log(`\n[OVERALL VERIFICATION COMPLETE]`);
  console.log(`  Start Time:           ${startTime.toISOString()}`);
  console.log(`  End Time:             ${overallEndTime.toISOString()}`);
  console.log(`  Total Test Duration:  ${((overallEndTime - startTime) / 1000).toFixed(1)} seconds`);
}

runTimedMeasurement().catch(console.error);
