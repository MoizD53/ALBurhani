const fs = require('fs');
const { createClient } = require('@libsql/client');

async function main() {
  const products = JSON.parse(fs.readFileSync('data/new_catalogue_extracted.json', 'utf8'));
  console.log(`Loaded ${products.length} products to import.`);

  // 1. Update src/data/importedProducts.json
  fs.writeFileSync('src/data/importedProducts.json', JSON.stringify(products, null, 2), 'utf8');
  console.log('Updated src/data/importedProducts.json');

  // 2. Update data/products_master_catalogue.csv
  const csvHeaders = ['ID', 'SKU', 'Barcode', 'Product Name', 'Category', 'Unit', 'Price Basis', 'Selling Price (Rs)', 'Cost Price (Rs)', 'Current Stock', 'Min Stock Alert', 'Status'];
  const csvRows = [csvHeaders.join(',')];
  for (const p of products) {
    const row = [
      `"${p.id}"`,
      `"${p.sku}"`,
      `"${p.barcode}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.category}"`,
      `"${p.unit}"`,
      `"${p.priceBasis}"`,
      p.sellingPrice,
      p.costPrice,
      p.stock,
      p.minStock,
      `"${p.isActive ? 'Active' : 'Inactive'}"`
    ];
    csvRows.push(row.join(','));
  }
  fs.writeFileSync('data/products_master_catalogue.csv', csvRows.join('\n'), 'utf8');
  console.log('Updated data/products_master_catalogue.csv');

  // 3. Update Turso live database
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL || 'libsql://alburhani-moizd.aws-ap-south-1.turso.io',
    authToken: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTI5Mzk1NDYsImlkIjoiMDFhMTczODYtMjEwMS03OWUxLTkzNzItZmVlOWQ5ODJkNTJmIiwia2lkIjoieWxOWFFLUTIzaE1Cc0xLZ2pUMHZpN2UtQ2N5akp5d01LWEdabmsxMkNkTSIsInJpZCI6IjFiNGE5NzNmLTUzMTEtNDEwOS1iODU2LWM4NzdjOTZlNTU3NyJ9.3750zpzlf8fmFoU6m8EO3fgiQAH8PjxnhByg4eC82RXctCrvYRGWBISAAaOxY14Fx-Nvk4o_0wdW_OJf4ESaAw'
  });

  console.log('Connecting to Turso...');
  const statements = [];

  for (const p of products) {
    statements.push({
      sql: `INSERT INTO products (
        id, sku, barcode, name, category, unit, price_basis, net_weight, cost_price, selling_price,
        stock, min_stock, shelf_life_days, batch_no, mfg_date, expiry_date, price_tiers, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, '', '', '', ?, CURRENT_TIMESTAMP)
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
        shelf_life_days=excluded.shelf_life_days,
        price_tiers=excluded.price_tiers,
        updated_at=CURRENT_TIMESTAMP;`,
      args: [
        p.id,
        p.sku,
        p.barcode,
        p.name,
        p.category,
        p.unit,
        p.priceBasis,
        Number(p.costPrice) || 0,
        Number(p.sellingPrice) || 0,
        Number(p.stock) || 0,
        Number(p.minStock) || 0,
        Number(p.shelfLifeDays) || 90,
        p.priceTiers ? JSON.stringify(p.priceTiers) : null
      ]
    });
  }

  // Execute in batches of 50 for Turso batch limit safety
  console.log(`Executing ${statements.length} upsert statements in batches of 50...`);
  const chunkSize = 50;
  for (let i = 0; i < statements.length; i += chunkSize) {
    const chunk = statements.slice(i, i + chunkSize);
    await client.batch(chunk, 'write');
    console.log(`Upserted products ${i + 1} to ${Math.min(i + chunkSize, statements.length)}`);
  }

  // Log sync event for catalogue refresh
  await client.execute({
    sql: `INSERT INTO sync_events (entity_type, entity_id, operation, payload_json, server_timestamp, branch)
          VALUES ('product', 'all', 'bulk_replace', ?, ?, 'all');`,
    args: [JSON.stringify({ count: products.length, filename: 'al burhani new stock 27-10-2026.xlsx' }), Date.now()]
  });

  const countRes = await client.execute('SELECT COUNT(*) as count FROM products;');
  console.log(`SUCCESS: Turso live database now has ${countRes.rows[0].count} products.`);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
