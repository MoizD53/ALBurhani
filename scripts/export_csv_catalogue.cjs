const fs = require('fs');
const path = require('path');

const jsonPath = path.resolve('src/data/importedProducts.json');
const outDir = path.resolve('data');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const products = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
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
    p.priceBasis || '₹/pc',
    p.netWeight || '',
    p.costPrice !== undefined ? p.costPrice : 0,
    p.sellingPrice !== undefined ? p.sellingPrice : 0,
    p.stock !== undefined ? p.stock : 0,
    p.minStock !== undefined ? p.minStock : 0
  ];
  lines.push(row.map(escapeCsv).join(','));
}

const outPath = path.join(outDir, 'products_master_catalogue.csv');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`Successfully generated ${outPath} with ${products.length} products.`);
