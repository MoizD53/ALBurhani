const fs = require('fs');
const { createClient } = require('@libsql/client');

async function main() {
  const products = JSON.parse(fs.readFileSync('data/new_catalogue_extracted.json', 'utf8'));

  // Find and update Kaju Katli
  for (let i = 0; i < products.length; i++) {
    if (products[i].name.toUpperCase().includes('KAJU KATLI')) {
      products[i] = {
        ...products[i],
        id: 'alb-0207',
        sku: '0001',
        barcode: '0001',
        name: 'KAJU KATLI 250G',
        category: 'SWEETS',
        unit: 'PCS',
        priceBasis: '₹/pc',
        costPrice: 0,
        sellingPrice: 275,
        mrp: 275,
        stock: 0,
        minStock: 0,
        shelfLifeDays: 90,
        isActive: true
      };
      console.log('Updated Kaju Katli to alb-0207 with barcode 0001');
    }
  }

  // Save to data/new_catalogue_extracted.json and src/data/importedProducts.json
  fs.writeFileSync('data/new_catalogue_extracted.json', JSON.stringify(products, null, 2), 'utf8');
  fs.writeFileSync('src/data/importedProducts.json', JSON.stringify(products, null, 2), 'utf8');

  // Write data/products_master_catalogue.csv with lowercase standard headers
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
  for (const p of products) {
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
      p.stock !== undefined ? p.stock : 0,
      p.minStock !== undefined ? p.minStock : 0
    ];
    csvLines.push(row.map(escapeCsv).join(','));
  }
  fs.writeFileSync('data/products_master_catalogue.csv', csvLines.join('\n'), 'utf8');
  console.log('Wrote data/products_master_catalogue.csv with 342 rows');

  // Update Turso database
  const client = createClient({
    url: 'libsql://alburhani-moizd.aws-ap-south-1.turso.io',
    authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTI5Mzk1NDYsImlkIjoiMDFhMTczODYtMjEwMS03OWUxLTkzNzItZmVlOWQ5ODJkNTJmIiwia2lkIjoieWxOWFFLUTIzaE1Cc0xLZ2pUMHZpN2UtQ2N5akp5d01LWEdabmsxMkNkTSIsInJpZCI6IjFiNGE5NzNmLTUzMTEtNDEwOS1iODU2LWM4NzdjOTZlNTU3NyJ9.3750zpzlf8fmFoU6m8EO3fgiQAH8PjxnhByg4eC82RXctCrvYRGWBISAAaOxY14Fx-Nvk4o_0wdW_OJf4ESaAw'
  });

  // Upsert Kaju Katli (alb-0207)
  await client.execute({
    sql: `INSERT INTO products (id, sku, barcode, name, category, unit, price_basis, net_weight, cost_price, selling_price, stock, min_stock, shelf_life_days, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) 
          ON CONFLICT(id) DO UPDATE SET 
            sku=excluded.sku, 
            barcode=excluded.barcode, 
            name=excluded.name, 
            category=excluded.category, 
            unit=excluded.unit, 
            price_basis=excluded.price_basis, 
            cost_price=excluded.cost_price, 
            selling_price=excluded.selling_price, 
            stock=excluded.stock, 
            min_stock=excluded.min_stock, 
            updated_at=CURRENT_TIMESTAMP`,
    args: ['alb-0207', '0001', '0001', 'KAJU KATLI 250G', 'SWEETS', 'PCS', '₹/pc', '', 0, 275, 0, 0, 90]
  });

  // Delete any alb-0343 created previously
  await client.execute("DELETE FROM products WHERE id = 'alb-0343'");

  const countRes = await client.execute('SELECT COUNT(*) as c FROM products');
  console.log('Turso active products count:', countRes.rows[0].c);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
