const fs = require('fs');

const products = JSON.parse(fs.readFileSync('src/data/importedProducts.json', 'utf8'));
for (const p of products) {
  p.stock = 0;
  p.unit = (p.unit === 'KG' || p.unit === 'kg') ? 'KG' : 'PCS';
  p.priceBasis = p.unit === 'KG' ? '₹/kg' : '₹/pc';
  if (p.name.includes('JUVAR PUFF') && p.sellingPrice === 0) {
    p.sellingPrice = 70;
  }
}
fs.writeFileSync('src/data/importedProducts.json', JSON.stringify(products, null, 2), 'utf8');

// Also update CSV
const headers = ['id', 'sku', 'barcode', 'name', 'category', 'unit', 'priceBasis', 'netWeight', 'costPrice', 'sellingPrice', 'stock', 'minStock'];
function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

const lines = [headers.join(',')];
for (const p of products) {
  const row = [
    p.id,
    p.sku || p.barcode,
    p.barcode,
    p.name,
    p.category,
    p.unit,
    p.priceBasis,
    p.netWeight || '',
    p.costPrice !== undefined ? p.costPrice : 0,
    p.sellingPrice !== undefined ? p.sellingPrice : 0,
    0, // stock = 0
    p.minStock !== undefined ? p.minStock : 0
  ];
  lines.push(row.map(escapeCsv).join(','));
}
fs.writeFileSync('data/products_master_catalogue.csv', lines.join('\n'), 'utf8');
console.log('Sanitized', products.length, 'products successfully.');
