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
  console.log('--- EXPLAIN QUERY PLAN BENCHMARK ---');

  const queries = [
    {
      name: 'fetch-events (all branches)',
      sql: 'EXPLAIN QUERY PLAN SELECT id, entity_type, entity_id, operation, payload_json, server_timestamp FROM sync_events WHERE server_timestamp > ? ORDER BY server_timestamp ASC LIMIT 100;',
      args: [1792825000000]
    },
    {
      name: 'fetch-events (scoped branch)',
      sql: `EXPLAIN QUERY PLAN SELECT id, entity_type, entity_id, operation, payload_json, server_timestamp FROM sync_events WHERE server_timestamp > ? AND (branch = ? OR branch = 'all' OR branch IS NULL) ORDER BY server_timestamp ASC LIMIT 100;`,
      args: [1792825000000, 'godi_road']
    },
    {
      name: 'fetch-products',
      sql: 'EXPLAIN QUERY PLAN SELECT * FROM products ORDER BY category ASC, name ASC;',
      args: []
    },
    {
      name: 'fetch-orders (godi_road)',
      sql: 'EXPLAIN QUERY PLAN SELECT * FROM orders WHERE branch = ? ORDER BY created_at DESC;',
      args: ['godi_road']
    },
    {
      name: 'fetch-expenses (godi_road)',
      sql: 'EXPLAIN QUERY PLAN SELECT * FROM expenses WHERE branch = ? ORDER BY date DESC;',
      args: ['godi_road']
    },
    {
      name: 'fetch-purchase-bills (godi_road)',
      sql: 'EXPLAIN QUERY PLAN SELECT * FROM purchase_bills WHERE branch = ? ORDER BY purchase_date DESC;',
      args: ['godi_road']
    }
  ];

  for (const q of queries) {
    console.log(`\nQuery: ${q.name}`);
    const res = await client.execute({ sql: q.sql, args: q.args });
    for (const r of res.rows) {
      console.log(`  detail: ${r.detail}`);
    }
  }
}

main().catch(console.error);
