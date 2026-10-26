const fs = require('fs');
const { createClient } = require('@libsql/client');

async function backup() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL || 'libsql://alburhani-moizd.aws-ap-south-1.turso.io',
    authToken: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTI5Mzk1NDYsImlkIjoiMDFhMTczODYtMjEwMS03OWUxLTkzNzItZmVlOWQ5ODJkNTJmIiwia2lkIjoieWxOWFFLUTIzaE1Cc0xLZ2pUMHZpN2UtQ2N5akp5d01LWEdabmsxMkNkTSIsInJpZCI6IjFiNGE5NzNmLTUzMTEtNDEwOS1iODU2LWM4NzdjOTZlNTU3NyJ9.3750zpzlf8fmFoU6m8EO3fgiQAH8PjxnhByg4eC82RXctCrvYRGWBISAAaOxY14Fx-Nvk4o_0wdW_OJf4ESaAw'
  });

  console.log('Fetching products and categories from Turso...');
  const prodRes = await client.execute('SELECT * FROM products ORDER BY name ASC;');
  const catRes = await client.execute('SELECT * FROM categories ORDER BY name ASC;');

  const localProducts = JSON.parse(fs.readFileSync('src/data/importedProducts.json', 'utf8'));

  const backupData = {
    timestamp: new Date().toISOString(),
    epoch: Date.now(),
    tursoProductCount: prodRes.rows.length,
    tursoCategoryCount: catRes.rows.length,
    localProductCount: localProducts.length,
    tursoProducts: prodRes.rows,
    tursoCategories: catRes.rows,
    localProducts: localProducts
  };

  const backupPath = 'backups/catalogue_backup_pre_27_10_2026.json';
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`Backup saved to ${backupPath} (size: ${(fs.statSync(backupPath).size / 1024).toFixed(1)} KB)`);
  console.log(`Verified Turso products: ${prodRes.rows.length}, Categories: ${catRes.rows.length}`);
}

backup().catch(console.error);
