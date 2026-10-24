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
  const p1 = await client.execute("SELECT id, name, stock, cost_price, selling_price FROM products WHERE name LIKE '%JEERA PURI%' OR name LIKE '%HAIDERY%'");
  console.log('Matching products:', p1.rows);

  const bills = await client.execute("SELECT id, purchase_number, items_json FROM purchase_bills");
  console.log('Purchase bills items:');
  bills.rows.forEach(b => console.log(b.purchase_number, b.items_json));
}

main().catch(console.error);
