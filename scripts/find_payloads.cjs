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

async function findPayloads() {
  const syncRows = await client.execute(`
    SELECT id, entity_id, payload_json 
    FROM sync_events 
    WHERE entity_id IN ('sale-1792594590792-2043', 'sale-1792594676977-4761') 
       OR payload_json LIKE '%ALB-NB-2043%' 
       OR payload_json LIKE '%ALB-NB-4761%';
  `);
  console.log('Found sync events:', syncRows.rows.length);
  for (const r of syncRows.rows) {
    console.log('SyncEvent id:', r.id, 'entity_id:', r.entity_id);
    const p = JSON.parse(r.payload_json);
    console.log('BillNumber:', p.billNumber, 'GrandTotal:', p.grandTotal, 'Items count:', p.items?.length, 'PaymentMethod:', p.paymentMethod);
    console.log('Details:', JSON.stringify({
      id: p.id,
      billNumber: p.billNumber,
      createdAt: p.createdAt,
      subtotal: p.subtotal,
      grandTotal: p.grandTotal,
      paymentMethod: p.paymentMethod,
      items: p.items
    }, null, 2));
  }
}

findPayloads().catch(console.error);
