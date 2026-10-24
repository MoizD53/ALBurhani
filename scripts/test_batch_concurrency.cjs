const { createClient } = require('@libsql/client');

async function testExists() {
  const c = createClient({ url: ':memory:' });
  
  await c.execute(`
    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      stock REAL NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await c.execute(`
    CREATE TABLE purchase_bills (
      id TEXT PRIMARY KEY,
      purchase_number TEXT,
      status TEXT NOT NULL DEFAULT 'Active'
    );
  `);

  await c.execute(`
    CREATE TABLE vendor_payments (
      id TEXT PRIMARY KEY,
      purchase_bill_id TEXT
    );
  `);

  await c.execute(`
    CREATE TABLE stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT,
      movement_type TEXT,
      reference_id TEXT,
      quantity_delta REAL,
      notes TEXT,
      timestamp INTEGER
    );
  `);

  await c.execute("INSERT INTO products VALUES ('p1', 10, CURRENT_TIMESTAMP);");
  await c.execute("INSERT INTO purchase_bills VALUES ('bill-1', 'PUR-1', 'Active');");
  await c.execute("INSERT INTO vendor_payments VALUES ('pay-1', 'bill-1');");

  console.log('--- TEST 1: Normal Deletion ---');
  const batch1 = [
    {
      sql: `UPDATE products 
            SET stock = MAX(0, stock - ?), updated_at = CURRENT_TIMESTAMP 
            WHERE id = ? AND EXISTS (SELECT 1 FROM purchase_bills WHERE id = ? AND status != 'Cancelled');`,
      args: [4, 'p1', 'bill-1']
    },
    {
      sql: `INSERT INTO stock_movements (product_id, movement_type, reference_id, quantity_delta, notes, timestamp)
            SELECT ?, 'PURCHASE_DELETED', ?, ?, ?, ?
            WHERE EXISTS (SELECT 1 FROM purchase_bills WHERE id = ? AND status != 'Cancelled');`,
      args: ['p1', 'bill-1', -4, 'Deleted', Date.now(), 'bill-1']
    },
    {
      sql: `DELETE FROM vendor_payments WHERE purchase_bill_id = ?;`,
      args: ['bill-1']
    },
    {
      sql: `DELETE FROM purchase_bills WHERE id = ?;`,
      args: ['bill-1']
    }
  ];

  await c.batch(batch1, 'write');
  console.log('Stock after batch1 (should be 6):', (await c.execute("SELECT stock FROM products WHERE id='p1'")).rows[0].stock);
  console.log('Movements after batch1 (should be 1):', (await c.execute("SELECT COUNT(*) as c FROM stock_movements")).rows[0].c);
  console.log('Payments after batch1 (should be 0):', (await c.execute("SELECT COUNT(*) as c FROM vendor_payments WHERE purchase_bill_id='bill-1'")).rows[0].c);
  console.log('Bills after batch1 (should be 0):', (await c.execute("SELECT COUNT(*) as c FROM purchase_bills WHERE id='bill-1'")).rows[0].c);

  console.log('\n--- TEST 2: Concurrent / Duplicate Deletion ---');
  // Run identical batch again (simulating concurrent request)
  await c.batch(batch1, 'write');
  console.log('Stock after duplicate batch (MUST STILL BE 6):', (await c.execute("SELECT stock FROM products WHERE id='p1'")).rows[0].stock);
  console.log('Movements after duplicate batch (MUST STILL BE 1):', (await c.execute("SELECT COUNT(*) as c FROM stock_movements")).rows[0].c);

  console.log('\n--- TEST 3: Already-Cancelled Bill ---');
  await c.execute("INSERT INTO purchase_bills VALUES ('bill-cancelled', 'PUR-2', 'Cancelled');");
  const batchCancelled = [
    {
      sql: `UPDATE products 
            SET stock = MAX(0, stock - ?), updated_at = CURRENT_TIMESTAMP 
            WHERE id = ? AND EXISTS (SELECT 1 FROM purchase_bills WHERE id = ? AND status != 'Cancelled');`,
      args: [3, 'p1', 'bill-cancelled']
    },
    {
      sql: `INSERT INTO stock_movements (product_id, movement_type, reference_id, quantity_delta, notes, timestamp)
            SELECT ?, 'PURCHASE_DELETED', ?, ?, ?, ?
            WHERE EXISTS (SELECT 1 FROM purchase_bills WHERE id = ? AND status != 'Cancelled');`,
      args: ['p1', 'bill-cancelled', -3, 'Deleted', Date.now(), 'bill-cancelled']
    },
    {
      sql: `DELETE FROM vendor_payments WHERE purchase_bill_id = ?;`,
      args: ['bill-cancelled']
    },
    {
      sql: `DELETE FROM purchase_bills WHERE id = ?;`,
      args: ['bill-cancelled']
    }
  ];
  await c.batch(batchCancelled, 'write');
  console.log('Stock after cancelled bill delete (MUST STILL BE 6):', (await c.execute("SELECT stock FROM products WHERE id='p1'")).rows[0].stock);
  console.log('Movements after cancelled bill delete (MUST STILL BE 1):', (await c.execute("SELECT COUNT(*) as c FROM stock_movements")).rows[0].c);

  console.log('\n--- TEST 4: Midway Failure Rollback ---');
  await c.execute("INSERT INTO purchase_bills VALUES ('bill-fail', 'PUR-3', 'Active');");
  await c.execute("INSERT INTO vendor_payments VALUES ('pay-fail', 'bill-fail');");
  const failingBatch = [
    {
      sql: `UPDATE products 
            SET stock = MAX(0, stock - ?), updated_at = CURRENT_TIMESTAMP 
            WHERE id = ? AND EXISTS (SELECT 1 FROM purchase_bills WHERE id = ? AND status != 'Cancelled');`,
      args: [2, 'p1', 'bill-fail']
    },
    {
      sql: `INSERT INTO nonexistent_table VALUES (1);` // INTENTIONAL FAILURE
    },
    {
      sql: `DELETE FROM purchase_bills WHERE id = ?;`,
      args: ['bill-fail']
    }
  ];

  let threw = false;
  try {
    await c.batch(failingBatch, 'write');
  } catch (err) {
    threw = true;
    console.log('Caught expected error from failing batch:', err.message);
  }
  console.log('Did batch throw error?', threw);
  console.log('Stock after failure (MUST REMAIN 6, not 4):', (await c.execute("SELECT stock FROM products WHERE id='p1'")).rows[0].stock);
  console.log('Bill after failure (MUST STILL EXIST):', (await c.execute("SELECT COUNT(*) as c FROM purchase_bills WHERE id='bill-fail'")).rows[0].c);
  console.log('Payment after failure (MUST STILL EXIST):', (await c.execute("SELECT COUNT(*) as c FROM vendor_payments WHERE purchase_bill_id='bill-fail'")).rows[0].c);
}

testExists().catch(console.error);
