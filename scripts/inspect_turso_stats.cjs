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
  console.log('--- TURSO DATABASE INSPECTION ---');
  
  const tablesRes = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
  console.log('Tables in database:');
  for (const row of tablesRes.rows) {
    try {
      const countRes = await client.execute(`SELECT COUNT(*) as c FROM "${row.name}";`);
      console.log(`  - ${row.name}: ${countRes.rows[0].c} rows`);
    } catch (e) {
      console.log(`  - ${row.name}: error reading (${e.message})`);
    }
  }

  console.log('\nIndexes in database:');
  const indexRes = await client.execute("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%';");
  for (const row of indexRes.rows) {
    console.log(`  - ${row.name} on ${row.tbl_name}`);
  }

  console.log('\nLatest 5 Sync Events:');
  const events = await client.execute("SELECT id, entity_type, operation, entity_id, branch, server_timestamp FROM sync_events ORDER BY id DESC LIMIT 5;");
  for (const ev of events.rows) {
    const d = new Date(Number(ev.server_timestamp)).toISOString();
    console.log(`  - #${ev.id}: ${ev.entity_type} [${ev.operation}] id=${ev.entity_id} branch=${ev.branch} at ${d} (${ev.server_timestamp})`);
  }

  console.log('\nDaily Bill Counters:');
  const counters = await client.execute("SELECT * FROM daily_bill_counters;");
  console.log(counters.rows);
}

main().catch(console.error);
