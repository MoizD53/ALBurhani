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
  console.log('--- LINK PUR-0003 TO JEERA PURI & UPDATE STOCK ---');

  // Check PUR-0003
  const bRes = await client.execute("SELECT id, purchase_number, items_json FROM purchase_bills WHERE purchase_number = 'PUR-0003';");
  if (bRes.rows.length === 0) {
    console.log('PUR-0003 not found');
    return;
  }

  const bill = bRes.rows[0];
  const items = JSON.parse(String(bill.items_json));
  console.log('Current items:', items);

  // Link JEERA PURI to alb-0163
  items[0].productId = 'alb-0163';
  items[0].productName = 'JEERA PURI 250 GRAM JP';

  await client.batch([
    {
      sql: 'UPDATE purchase_bills SET items_json = ? WHERE id = ?;',
      args: [JSON.stringify(items), bill.id]
    },
    {
      sql: 'UPDATE products SET stock = stock + 1, cost_price = 60, updated_at = CURRENT_TIMESTAMP WHERE id = ?;',
      args: ['alb-0163']
    },
    {
      sql: `INSERT INTO stock_movements (product_id, movement_type, reference_id, quantity_delta, notes, timestamp)
            VALUES (?, 'PURCHASE', ?, 1, 'Linked Purchase PUR-0003 (+1)', ?);`,
      args: ['alb-0163', bill.id, Date.now()]
    }
  ], 'write');

  console.log('Successfully linked PUR-0003 to alb-0163 and increased stock by 1!');
  const p = await client.execute("SELECT id, name, stock, cost_price FROM products WHERE id = 'alb-0163';");
  console.log('Updated product:', p.rows[0]);
}

main().catch(console.error);
