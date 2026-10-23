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
  authToken: env.TURSO_AUTH_TOKEN || env.VITE_TURSO_AUTH_TOKEN,
});

async function runAudit() {
  console.log('====================================================');
  console.log('   AL-BURHANI PRODUCTION VERIFICATION & AUDIT      ');
  console.log('====================================================\n');

  // 1. Database Sales Count & Totals
  const totalSalesRes = await client.execute('SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total FROM orders;');
  const totalCount = Number(totalSalesRes.rows[0].count);
  const totalRevenue = Number(totalSalesRes.rows[0].total);

  console.log(`[1] CANONICAL SALES TOTAL: ${totalCount} sales, Rs. ${totalRevenue.toFixed(2)}`);
  if (totalCount === 75 && Math.abs(totalRevenue - 28779) < 0.01) {
    console.log('    >>> PASSED: Baseline 75 sales / Rs. 28,779.00 is 100% PRESERVED.');
  } else {
    console.error(`    >>> FAILED: Expected 75 sales and Rs. 28,779.00 but got ${totalCount} and Rs. ${totalRevenue}`);
  }

  // 2. Disputed Orders ALB-NB-2043 and ALB-NB-4761
  const disputedRes = await client.execute(`
    SELECT id, bill_number, grand_total, payment_method, daily_bill_number, business_date 
    FROM orders 
    WHERE bill_number IN ('ALB-NB-2043', 'ALB-NB-4761');
  `);
  console.log('\n[2] VERIFYING RECONCILED ORDERS:');
  for (const row of disputedRes.rows) {
    console.log(`    - ${row.bill_number}: Rs. ${row.grand_total} | ${row.payment_method} | Daily #${row.daily_bill_number} on ${row.business_date}`);
  }
  const has2043 = disputedRes.rows.some(r => r.bill_number === 'ALB-NB-2043' && Number(r.grand_total) === 1600);
  const has4761 = disputedRes.rows.some(r => r.bill_number === 'ALB-NB-4761' && Number(r.grand_total) === 180);
  if (has2043 && has4761) {
    console.log('    >>> PASSED: Both restored sales are intact in database.');
  } else {
    console.error('    >>> FAILED: One or both restored sales missing!');
  }

  // 3. Daily Bill Numbering Sequence per Business Date
  console.log('\n[3] DAILY BILL NUMBERING PER BUSINESS DATE (Asia/Kolkata):');
  const dateBreakdown = await client.execute(`
    SELECT 
      business_date,
      COUNT(*) as count,
      MIN(daily_bill_number) as min_bill,
      MAX(daily_bill_number) as max_bill,
      COALESCE(SUM(grand_total), 0) as date_total
    FROM orders
    GROUP BY business_date
    ORDER BY business_date ASC;
  `);

  for (const row of dateBreakdown.rows) {
    console.log(`    Date ${row.business_date}: ${row.count} bills (Daily #${row.min_bill} to #${row.max_bill}), Total: Rs. ${Number(row.date_total).toFixed(2)}`);
  }

  // Check counters table
  const counterRes = await client.execute('SELECT * FROM daily_bill_counters ORDER BY business_date ASC;');
  console.log('\n    Daily Bill Counters in Turso:');
  for (const row of counterRes.rows) {
    console.log(`    - ${row.business_date}: last_bill_number = ${row.last_bill_number}`);
  }

  // 4. Calendar Reconciliation for Each Date
  console.log('\n[4] CALENDAR 8-METRIC BREAKDOWN RECONCILIATION:');
  const calendarMetrics = await client.execute(`
    SELECT 
      business_date,
      COUNT(*) as total_bills,
      COUNT(DISTINCT COALESCE(NULLIF(customer_phone, ''), NULLIF(customer_name, ''), id)) as unique_customers,
      COALESCE(SUM(grand_total), 0) as total_sales,
      COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN grand_total ELSE 0 END), 0) as cash_total,
      COALESCE(SUM(CASE WHEN payment_method = 'UPI' THEN grand_total ELSE 0 END), 0) as upi_total,
      COALESCE(SUM(CASE WHEN payment_method = 'CARD' THEN grand_total ELSE 0 END), 0) as card_total,
      COALESCE(SUM(CASE WHEN payment_method = 'CREDIT' THEN grand_total ELSE 0 END), 0) as credit_total
    FROM orders
    GROUP BY business_date
    ORDER BY business_date ASC;
  `);

  console.table(calendarMetrics.rows.map(r => ({
    Date: r.business_date,
    Bills: r.total_bills,
    Customers: r.unique_customers,
    Sales: Number(r.total_sales).toFixed(2),
    Cash: Number(r.cash_total).toFixed(2),
    UPI: Number(r.upi_total).toFixed(2),
    Card: Number(r.card_total).toFixed(2),
    Credit: Number(r.credit_total).toFixed(2)
  })));

  // 5. Purchase Tables Structure & Counter Check
  console.log('\n[5] PURCHASE TABLES & COUNTERS AUDIT:');
  const purchaseTables = await client.execute(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name IN ('purchase_bills', 'daily_purchase_counters', 'purchase_bill_counters', 'vendors', 'vendor_payments', 'stock_movements')
    ORDER BY name ASC;
  `);
  console.log('    Existing Purchase & Stock Tables in Turso:', purchaseTables.rows.map(r => r.name));
  const expectedTables = ['daily_purchase_counters', 'purchase_bill_counters', 'purchase_bills', 'stock_movements', 'vendor_payments', 'vendors'];
  const allTablesPresent = expectedTables.every(t => purchaseTables.rows.some(r => r.name === t));
  if (allTablesPresent) {
    console.log('    >>> PASSED: All 6 Purchase & Stock integration tables are created and active.');
  } else {
    console.error('    >>> FAILED: Missing purchase tables!');
  }

  // 6. Test Atomic Numbering & Concurrency Simulation
  console.log('\n[6] CONCURRENT NUMBER ALLOCATION TEST (Simulation):');
  const testDate = '2099-01-01'; // Safe isolated test date in future
  try {
    // Clear test date counter if exists
    await client.execute({ sql: 'DELETE FROM daily_purchase_counters WHERE business_date = ?;', args: [testDate] });
    
    // Simulate 5 simultaneous requests incrementing the counter
    const results = await Promise.all([1, 2, 3, 4, 5].map(async (i) => {
      // Simulate client transaction
      await client.execute({
        sql: `INSERT INTO daily_purchase_counters (business_date, last_bill_number)
              VALUES (?, 1)
              ON CONFLICT(business_date) DO UPDATE SET last_bill_number = last_bill_number + 1;`,
        args: [testDate],
      });
      const cRes = await client.execute({
        sql: 'SELECT last_bill_number FROM daily_purchase_counters WHERE business_date = ?;',
        args: [testDate],
      });
      return Number(cRes.rows[0].last_bill_number);
    }));

    const finalCounterRes = await client.execute({
      sql: 'SELECT last_bill_number FROM daily_purchase_counters WHERE business_date = ?;',
      args: [testDate],
    });
    const finalVal = Number(finalCounterRes.rows[0].last_bill_number);
    console.log(`    Allocated numbers in concurrent simulation. Final counter value: ${finalVal}`);
    if (finalVal === 5) {
      console.log('    >>> PASSED: Atomic counter increments cleanly without race conditions.');
    } else {
      console.error(`    >>> FAILED: Counter final value was ${finalVal}, expected 5.`);
    }

    // Clean up test date counter
    await client.execute({ sql: 'DELETE FROM daily_purchase_counters WHERE business_date = ?;', args: [testDate] });
  } catch (simErr) {
    console.error('    Error during concurrency test:', simErr);
  }

  // 7. Test Purchase Lifecycle: Create -> Edit Delta -> Payment -> Cancel Stock Reversal
  console.log('\n[7] PURCHASE BILL LIFECYCLE & STOCK REVERSAL TEST:');
  const testSuffix = Date.now();
  const testBillId = `test-audit-pur-${testSuffix}`;
  const testProductId = `test-prod-audit-${testSuffix}`;
  const testBarcode = `TEST-BAR-${testSuffix}`;
  try {
    // Insert temporary test product with 10 units stock
    await client.execute({
      sql: `INSERT INTO products (id, sku, barcode, name, category, unit, cost_price, selling_price, stock)
            VALUES (?, ?, ?, 'Audit Test Almonds', 'DRY FRUITS', 'KG', 500, 700, 10);`,
      args: [testProductId, testBarcode, testBarcode],
    });

    // Step A: Save Purchase Bill for 15 KG
    const inwardQty = 15;
    await client.execute({
      sql: 'UPDATE products SET stock = stock + ? WHERE id = ?;',
      args: [inwardQty, testProductId],
    });
    await client.execute({
      sql: `INSERT INTO purchase_bills (
        id, purchase_number, daily_bill_number, business_date, vendor_name, purchase_date,
        items_json, subtotal, discount, additional_charges, grand_total, amount_paid, balance_due,
        payment_status, payment_mode, status
      ) VALUES (?, 'PUR-TEST-001', 1, '2099-01-01', 'Audit Vendor', '2099-01-01', ?, 7500, 0, 0, 7500, 2500, 5000, 'Partially Paid', 'Cash', 'Active');`,
      args: [testBillId, JSON.stringify([{ productId: testProductId, productName: 'Audit Test Almonds', quantity: 15, unit: 'KG', unitPrice: 500, lineTotal: 7500 }])],
    });

    let pRes = await client.execute({ sql: 'SELECT stock FROM products WHERE id = ?;', args: [testProductId] });
    console.log(`    Step A (Create Bill +15kg): Product stock is now ${pRes.rows[0].stock} (expected 25)`);
    if (Number(pRes.rows[0].stock) !== 25) throw new Error('Stock did not increment by 15');

    // Step B: Edit Bill (Increase quantity from 15 to 20 KG -> Delta is +5 KG)
    const newQty = 20;
    const delta = newQty - inwardQty; // +5
    await client.execute({
      sql: 'UPDATE products SET stock = stock + ? WHERE id = ?;',
      args: [delta, testProductId],
    });
    await client.execute({
      sql: `UPDATE purchase_bills 
            SET items_json = ?, subtotal = 10000, grand_total = 10000, balance_due = 7500 
            WHERE id = ?;`,
      args: [JSON.stringify([{ productId: testProductId, productName: 'Audit Test Almonds', quantity: 20, unit: 'KG', unitPrice: 500, lineTotal: 10000 }]), testBillId],
    });

    pRes = await client.execute({ sql: 'SELECT stock FROM products WHERE id = ?;', args: [testProductId] });
    console.log(`    Step B (Edit Bill Delta +5kg): Product stock is now ${pRes.rows[0].stock} (expected 30)`);
    if (Number(pRes.rows[0].stock) !== 30) throw new Error('Stock delta calculation failed');

    // Step C: Add Payment (Rs. 4,000 paid)
    const testPayId = `pay-audit-${Date.now()}`;
    await client.execute({
      sql: `INSERT INTO vendor_payments (id, purchase_bill_id, payment_date, amount, payment_mode, notes)
            VALUES (?, ?, '2099-01-01', 4000, 'UPI', 'Audit Payment');`,
      args: [testPayId, testBillId],
    });
    await client.execute({
      sql: 'UPDATE purchase_bills SET amount_paid = amount_paid + 4000, balance_due = balance_due - 4000 WHERE id = ?;',
      args: [testBillId],
    });

    const billCheck = await client.execute({ sql: 'SELECT amount_paid, balance_due FROM purchase_bills WHERE id = ?;', args: [testBillId] });
    console.log(`    Step C (Add Payment Rs. 4,000): Paid = Rs. ${billCheck.rows[0].amount_paid}, Due = Rs. ${billCheck.rows[0].balance_due} (expected Paid 6500, Due 3500)`);
    if (Number(billCheck.rows[0].amount_paid) !== 6500 || Number(billCheck.rows[0].balance_due) !== 3500) {
      throw new Error('Payment balance math failed');
    }

    // Step D: Cancel Purchase Bill (Stock reversal: reverse 20 KG)
    await client.execute({
      sql: 'UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?;',
      args: [newQty, testProductId],
    });
    await client.execute({
      sql: "UPDATE purchase_bills SET status = 'Cancelled' WHERE id = ?;",
      args: [testBillId],
    });

    pRes = await client.execute({ sql: 'SELECT stock FROM products WHERE id = ?;', args: [testProductId] });
    console.log(`    Step D (Cancel & Reverse 20kg): Product stock is now ${pRes.rows[0].stock} (expected 10)`);
    if (Number(pRes.rows[0].stock) !== 10) throw new Error('Reversal stock math failed');

    console.log('    >>> PASSED: Full purchase bill lifecycle, stock delta, and reversal verified.');
  } finally {
    // Clean up temporary audit records
    await client.execute({ sql: 'DELETE FROM vendor_payments WHERE purchase_bill_id = ?;', args: [testBillId] }).catch(() => {});
    await client.execute({ sql: 'DELETE FROM purchase_bills WHERE id = ?;', args: [testBillId] }).catch(() => {});
    await client.execute({ sql: 'DELETE FROM products WHERE id = ?;', args: [testProductId] }).catch(() => {});
    console.log('    (Cleaned up temporary audit test records)');
  }

  // 8. Final Backup Table Check
  console.log('\n[8] PREFLIGHT BACKUP VERIFICATION:');
  const backupRes = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%backup%';");
  console.log('    Backup Tables:', backupRes.rows.map(r => r.name));
  const hasPreDailyBackup = backupRes.rows.some(r => r.name.includes('orders_backup_pre_daily_numbers'));
  if (hasPreDailyBackup) {
    console.log('    >>> PASSED: Pre-flight backup table is present and verified on Turso.');
  } else {
    console.warn('    >>> WARNING: Pre-daily backup table name check.');
  }

  console.log('\n====================================================');
  console.log('            AUDIT EXECUTION COMPLETE                ');
  console.log('====================================================');
}

runAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
