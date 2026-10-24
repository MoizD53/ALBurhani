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

const url = env.TURSO_DB_URL.replace('libsql://', 'https://');
async function test() {
  const endpoints = ['/v1/stats', '/stats', '/v2/pipeline', '/health', '/v1', '/v1/organization/duokarma53/database/al-bhurani/usage'];
  for (const ep of endpoints) {
    try {
      const res = await fetch(url + ep, {
        headers: { Authorization: 'Bearer ' + env.TURSO_AUTH_TOKEN }
      });
      console.log(ep, res.status);
      if (res.status === 200) {
        console.log(await res.text());
      }
    } catch (e) {
      console.log(ep, e.message);
    }
  }

  // Also test api.turso.tech
  try {
    const apiRes = await fetch('https://api.turso.tech/v1/organizations/duokarma53/databases/al-bhurani/usage', {
      headers: { Authorization: 'Bearer ' + env.TURSO_AUTH_TOKEN }
    });
    console.log('Turso Platform API usage status:', apiRes.status);
    if (apiRes.status === 200) {
      console.log(await apiRes.json());
    }
  } catch (e) {
    console.log('Platform API error:', e.message);
  }
}
test();
