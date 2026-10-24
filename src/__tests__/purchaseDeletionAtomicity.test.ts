import { describe, it, expect, beforeEach } from 'vitest';
import { createClient, type Client, type InStatement } from '@libsql/client';

describe('Purchase Bill Deletion Atomicity & Concurrency Safety', () => {
  let client: Client;

  beforeEach(async () => {
    client = createClient({ url: ':memory:' });

    await client.execute(`
      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        stock REAL NOT NULL DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.execute(`
      CREATE TABLE purchase_bills (
        id TEXT PRIMARY KEY,
        purchase_number TEXT NOT NULL UNIQUE,
        vendor_name TEXT NOT NULL,
        grand_total REAL NOT NULL DEFAULT 0,
        items_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Active',
        branch TEXT DEFAULT 'godi_road',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.execute(`
      CREATE TABLE vendor_payments (
        id TEXT PRIMARY KEY,
        purchase_bill_id TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_mode TEXT NOT NULL
      );
    `);

    await client.execute(`
      CREATE TABLE stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id TEXT NOT NULL,
        movement_type TEXT NOT NULL,
        reference_id TEXT NOT NULL,
        quantity_delta REAL NOT NULL,
        notes TEXT,
        timestamp INTEGER NOT NULL
      );
    `);

    await client.execute(`
      CREATE TABLE financial_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        amount REAL,
        payment_method TEXT,
        details_json TEXT,
        actor TEXT,
        timestamp INTEGER
      );
    `);

    await client.execute(`
      CREATE TABLE sync_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload_json TEXT,
        server_timestamp INTEGER NOT NULL,
        branch TEXT
      );
    `);
  });

  // Helper matching the exact implementation in api/db.ts
  async function executeDeletePurchaseBill(billId: string, intentionalFailure = false) {
    const billRes = await client.execute({
      sql: 'SELECT * FROM purchase_bills WHERE id = ? LIMIT 1;',
      args: [billId],
    });

    if (billRes.rows.length === 0) {
      return { success: true, message: 'Already deleted or not found' };
    }

    const bill = billRes.rows[0];
    const batchStatements: InStatement[] = [];
    const now = Date.now();

    if (bill.status !== 'Cancelled') {
      let items: any[] = [];
      try {
        items = bill.items_json ? JSON.parse(String(bill.items_json)) : [];
      } catch {}

      for (const it of items) {
        if (it.productId && typeof it.quantity === 'number') {
          const qty = Number(it.quantity);
          batchStatements.push({
            sql: `UPDATE products 
                  SET stock = MAX(0, stock - ?), updated_at = CURRENT_TIMESTAMP 
                  WHERE id = ? AND EXISTS (SELECT 1 FROM purchase_bills WHERE id = ? AND status != 'Cancelled');`,
            args: [qty, it.productId, billId],
          });

          batchStatements.push({
            sql: `INSERT INTO stock_movements (product_id, movement_type, reference_id, quantity_delta, notes, timestamp)
                  SELECT ?, 'PURCHASE_DELETED', ?, ?, ?, ?
                  WHERE EXISTS (SELECT 1 FROM purchase_bills WHERE id = ? AND status != 'Cancelled');`,
            args: [it.productId, billId, -qty, `Deleted Purchase ${bill.purchase_number}`, now, billId],
          });
        }
      }
    }

    if (intentionalFailure) {
      // Simulate mid-transaction network or database error
      batchStatements.push({
        sql: 'INSERT INTO non_existent_table_cause_rollback (dummy) VALUES (1);',
      });
    }

    batchStatements.push({
      sql: 'DELETE FROM vendor_payments WHERE purchase_bill_id = ?;',
      args: [billId],
    });

    batchStatements.push({
      sql: 'DELETE FROM purchase_bills WHERE id = ?;',
      args: [billId],
    });

    batchStatements.push({
      sql: `INSERT INTO financial_audit_logs (action, entity_type, entity_id, amount, payment_method, details_json, actor, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      args: ['DELETE_PURCHASE', 'purchase_bill', billId, Number(bill.grand_total) || 0, null, JSON.stringify({ purchaseNumber: bill.purchase_number }), 'Owner', now],
    });

    const eventBranch = (bill.branch as string) || 'all';
    batchStatements.push({
      sql: `INSERT INTO sync_events (entity_type, entity_id, operation, payload_json, server_timestamp, branch)
            VALUES (?, ?, ?, ?, ?, ?);`,
      args: ['purchase_bill', billId, 'delete', JSON.stringify({ id: billId, purchaseNumber: bill.purchase_number }), now, eventBranch],
    });

    await client.batch(batchStatements, 'write');
    return { success: true, id: billId };
  }

  it('successfully executes atomic purchase bill deletion with stock reversal and payment purge', async () => {
    // Seed initial product with 20 stock
    await client.execute("INSERT INTO products (id, name, stock) VALUES ('prod-1', 'Almonds', 20);");
    // Seed purchase bill with 10 quantity inward
    await client.execute({
      sql: `INSERT INTO purchase_bills (id, purchase_number, vendor_name, grand_total, items_json, status, branch)
            VALUES ('bill-100', 'PUR-0100', 'DryFruit Co', 5000, ?, 'Active', 'godi_road');`,
      args: [JSON.stringify([{ productId: 'prod-1', quantity: 10 }])],
    });
    // Seed linked payment
    await client.execute("INSERT INTO vendor_payments (id, purchase_bill_id, amount, payment_mode) VALUES ('pay-100', 'bill-100', 5000, 'Cash');");

    const result = await executeDeletePurchaseBill('bill-100');
    expect(result.success).toBe(true);

    // 1. Stock must be decremented from 20 to 10
    const prodRes = await client.execute("SELECT stock FROM products WHERE id = 'prod-1';");
    expect(prodRes.rows[0].stock).toBe(10);

    // 2. Bill must be permanently deleted
    const billRes = await client.execute("SELECT COUNT(*) as cnt FROM purchase_bills WHERE id = 'bill-100';");
    expect(billRes.rows[0].cnt).toBe(0);

    // 3. Payment must be deleted
    const payRes = await client.execute("SELECT COUNT(*) as cnt FROM vendor_payments WHERE purchase_bill_id = 'bill-100';");
    expect(payRes.rows[0].cnt).toBe(0);

    // 4. Stock movement audit must exist
    const smRes = await client.execute("SELECT * FROM stock_movements WHERE reference_id = 'bill-100';");
    expect(smRes.rows).toHaveLength(1);
    expect(smRes.rows[0].movement_type).toBe('PURCHASE_DELETED');
    expect(smRes.rows[0].quantity_delta).toBe(-10);

    // 5. Financial audit log and sync tombstone must exist
    const auditRes = await client.execute("SELECT * FROM financial_audit_logs WHERE entity_id = 'bill-100';");
    expect(auditRes.rows).toHaveLength(1);
    expect(auditRes.rows[0].action).toBe('DELETE_PURCHASE');

    const syncRes = await client.execute("SELECT * FROM sync_events WHERE entity_id = 'bill-100';");
    expect(syncRes.rows).toHaveLength(1);
    expect(syncRes.rows[0].operation).toBe('delete');
  });

  it('rolls back all mutations when failure occurs midway through the transaction', async () => {
    // Seed product with 15 stock
    await client.execute("INSERT INTO products (id, name, stock) VALUES ('prod-fail', 'Pistachio', 15);");
    // Seed purchase bill with 5 quantity inward
    await client.execute({
      sql: `INSERT INTO purchase_bills (id, purchase_number, vendor_name, grand_total, items_json, status, branch)
            VALUES ('bill-fail', 'PUR-0999', 'Spice Trader', 2500, ?, 'Active', 'godi_road');`,
      args: [JSON.stringify([{ productId: 'prod-fail', quantity: 5 }])],
    });
    // Seed payment
    await client.execute("INSERT INTO vendor_payments (id, purchase_bill_id, amount, payment_mode) VALUES ('pay-fail', 'bill-fail', 2500, 'UPI');");

    let errorThrown = false;
    try {
      await executeDeletePurchaseBill('bill-fail', true); // intentional failure midway
    } catch {
      errorThrown = true;
    }
    expect(errorThrown).toBe(true);

    // ALL mutations must be rolled back:
    // 1. Stock must remain untouched at 15 (NOT reduced to 10)
    const prodRes = await client.execute("SELECT stock FROM products WHERE id = 'prod-fail';");
    expect(prodRes.rows[0].stock).toBe(15);

    // 2. Bill must still exist
    const billRes = await client.execute("SELECT COUNT(*) as cnt FROM purchase_bills WHERE id = 'bill-fail';");
    expect(billRes.rows[0].cnt).toBe(1);

    // 3. Payment must still exist
    const payRes = await client.execute("SELECT COUNT(*) as cnt FROM vendor_payments WHERE purchase_bill_id = 'bill-fail';");
    expect(payRes.rows[0].cnt).toBe(1);

    // 4. No stock movement or audit log created
    const smRes = await client.execute("SELECT COUNT(*) as cnt FROM stock_movements WHERE reference_id = 'bill-fail';");
    expect(smRes.rows[0].cnt).toBe(0);

    const auditRes = await client.execute("SELECT COUNT(*) as cnt FROM financial_audit_logs WHERE entity_id = 'bill-fail';");
    expect(auditRes.rows[0].cnt).toBe(0);
  });

  it('prevents duplicate stock reversals on concurrent or repeated deletion attempts', async () => {
    await client.execute("INSERT INTO products (id, name, stock) VALUES ('prod-conc', 'Kaju', 30);");
    await client.execute({
      sql: `INSERT INTO purchase_bills (id, purchase_number, vendor_name, grand_total, items_json, status, branch)
            VALUES ('bill-conc', 'PUR-0300', 'Kaju Mart', 8000, ?, 'Active', 'godi_road');`,
      args: [JSON.stringify([{ productId: 'prod-conc', quantity: 12 }])],
    });

    // Request 1 succeeds
    const res1 = await executeDeletePurchaseBill('bill-conc');
    expect(res1.success).toBe(true);

    // Stock should be 30 - 12 = 18
    const prodRes1 = await client.execute("SELECT stock FROM products WHERE id = 'prod-conc';");
    expect(prodRes1.rows[0].stock).toBe(18);

    // Request 2 (duplicate/concurrent) must NOT reverse stock again
    const res2 = await executeDeletePurchaseBill('bill-conc');
    expect(res2.success).toBe(true);
    expect(res2.message).toBe('Already deleted or not found');

    const prodRes2 = await client.execute("SELECT stock FROM products WHERE id = 'prod-conc';");
    expect(prodRes2.rows[0].stock).toBe(18); // STILL 18, never 6!

    const smCount = await client.execute("SELECT COUNT(*) as cnt FROM stock_movements WHERE reference_id = 'bill-conc';");
    expect(smCount.rows[0].cnt).toBe(1); // exactly 1 movement record
  });

  it('does not reverse stock if the bill was already cancelled', async () => {
    // A cancelled bill has already had its inward stock reversed at cancellation time
    await client.execute("INSERT INTO products (id, name, stock) VALUES ('prod-canc', 'Anjeer', 8);");
    await client.execute({
      sql: `INSERT INTO purchase_bills (id, purchase_number, vendor_name, grand_total, items_json, status, branch)
            VALUES ('bill-canc', 'PUR-0400', 'Afghan Fruits', 4000, ?, 'Cancelled', 'godi_road');`,
      args: [JSON.stringify([{ productId: 'prod-canc', quantity: 8 }])],
    });

    const res = await executeDeletePurchaseBill('bill-canc');
    expect(res.success).toBe(true);

    // Stock must remain at 8 (no double-subtraction)
    const prodRes = await client.execute("SELECT stock FROM products WHERE id = 'prod-canc';");
    expect(prodRes.rows[0].stock).toBe(8);

    // Bill record must be purged
    const billCount = await client.execute("SELECT COUNT(*) as cnt FROM purchase_bills WHERE id = 'bill-canc';");
    expect(billCount.rows[0].cnt).toBe(0);

    // No duplicate stock movement inserted
    const smCount = await client.execute("SELECT COUNT(*) as cnt FROM stock_movements WHERE reference_id = 'bill-canc';");
    expect(smCount.rows[0].cnt).toBe(0);
  });

  it('returns safely and cleanly when attempting to delete a missing or nonexistent bill', async () => {
    const res = await executeDeletePurchaseBill('non-existent-id-999');
    expect(res.success).toBe(true);
    expect(res.message).toBe('Already deleted or not found');
  });
});
