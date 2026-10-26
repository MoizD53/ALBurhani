const fs = require('fs');
const { createClient } = require('@libsql/client');

async function main() {
  console.log('=== Setting Current Stock = 0 for all 342 products ===');

  // 1. Update data/new_catalogue_extracted.json
  const extracted = JSON.parse(fs.readFileSync('data/new_catalogue_extracted.json', 'utf8'));
  for (const p of extracted) {
    p.stock = 0;
  }
  fs.writeFileSync('data/new_catalogue_extracted.json', JSON.stringify(extracted, null, 2), 'utf8');
  console.log(`Updated data/new_catalogue_extracted.json: all ${extracted.length} products set to stock = 0.`);

  // 2. Update src/data/importedProducts.json
  const imported = JSON.parse(fs.readFileSync('src/data/importedProducts.json', 'utf8'));
  for (const p of imported) {
    p.stock = 0;
  }
  fs.writeFileSync('src/data/importedProducts.json', JSON.stringify(imported, null, 2), 'utf8');
  console.log(`Updated src/data/importedProducts.json: all ${imported.length} products set to stock = 0.`);

  // 3. Update data/products_master_catalogue.csv
  const csvHeaders = ['id', 'sku', 'barcode', 'name', 'category', 'unit', 'priceBasis', 'netWeight', 'costPrice', 'sellingPrice', 'stock', 'minStock'];
  function escapeCsv(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  const csvLines = [csvHeaders.join(',')];
  for (const p of imported) {
    const row = [
      p.id,
      p.sku || p.barcode,
      p.barcode,
      p.name,
      p.category,
      p.unit,
      p.priceBasis || '₹/pc',
      p.unit === 'KG' ? 'Per KG' : '',
      p.costPrice !== undefined ? p.costPrice : 0,
      p.sellingPrice !== undefined ? p.sellingPrice : 0,
      0, // strictly 0 stock
      p.minStock !== undefined ? p.minStock : 0
    ];
    csvLines.push(row.map(escapeCsv).join(','));
  }
  fs.writeFileSync('data/products_master_catalogue.csv', csvLines.join('\n'), 'utf8');
  console.log(`Updated data/products_master_catalogue.csv: all 342 products set to stock = 0.`);

  // 4. Update Turso database products table
  const client = createClient({
    url: 'libsql://alburhani-moizd.aws-ap-south-1.turso.io',
    authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTI5Mzk1NDYsImlkIjoiMDFhMTczODYtMjEwMS03OWUxLTkzNzItZmVlOWQ5ODJkNTJmIiwia2lkIjoieWxOWFFLUTIzaE1Cc0xLZ2pUMHZpN2UtQ2N5akp5d01LWEdabmsxMkNkTSIsInJpZCI6IjFiNGE5NzNmLTUzMTEtNDEwOS1iODU2LWM4NzdjOTZlNTU3NyJ9.3750zpzlf8fmFoU6m8EO3fgiQAH8PjxnhByg4eC82RXctCrvYRGWBISAAaOxY14Fx-Nvk4o_0wdW_OJf4ESaAw'
  });

  const res = await client.execute('UPDATE products SET stock = 0, updated_at = CURRENT_TIMESTAMP;');
  console.log(`Updated live Turso database: ${res.rowsAffected} products reset to stock = 0.`);

  const verifyRes = await client.execute('SELECT COUNT(*) as nonZeroCount FROM products WHERE stock != 0;');
  console.log(`Verification on Turso: non-zero stock products count = ${verifyRes.rows[0].nonZeroCount}`);

  const totalRes = await client.execute('SELECT COUNT(*) as totalCount FROM products;');
  console.log(`Total products on Turso = ${totalRes.rows[0].totalCount}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
