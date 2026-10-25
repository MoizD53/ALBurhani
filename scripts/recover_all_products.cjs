const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Step 1: Loading current 305 master products ===');
const baseProducts = JSON.parse(fs.readFileSync('src/data/importedProducts.json', 'utf8'));
const masterMap = new Map();

for (const p of baseProducts) {
  const norm = {
    id: String(p.id),
    sku: String(p.sku || p.barcode || p.id),
    barcode: String(p.barcode || p.sku || p.id),
    name: String(p.name).trim(),
    category: p.category || 'Namkeen & Farsan',
    unit: p.unit || 'PCS',
    priceBasis: p.priceBasis || '₹/pc',
    netWeight: p.netWeight || '',
    costPrice: Number(p.costPrice || 0),
    sellingPrice: Number(p.sellingPrice || 0),
    stock: Number(p.stock || 0),
    minStock: Number(p.minStock || 0),
    shelfLifeDays: Number(p.shelfLifeDays || 90),
    batchNo: String(p.batchNo || ''),
    mfgDate: String(p.mfgDate || ''),
    expiryDate: String(p.expiryDate || ''),
    priceTiers: p.priceTiers || undefined
  };
  masterMap.set(norm.id, norm);
}
console.log('Initial master products count:', masterMap.size);

console.log('=== Step 2: Extracting products from all backups ===');
const backupDir = path.resolve('backups');
if (fs.existsSync(backupDir)) {
  const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const fullPath = path.join(backupDir, f);
    try {
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

      // Check syncEvents
      if (Array.isArray(data.syncEvents)) {
        for (const ev of data.syncEvents) {
          if (ev.entity_type === 'product' && ev.payload_json) {
            try {
              const p = JSON.parse(ev.payload_json);
              if (p && p.id && p.name) {
                const id = String(p.id);
                if (!id.startsWith('test-') && !masterMap.has(id)) {
                  const unit = (p.unit === 'KG' || p.unit === 'kg') ? 'KG' : 'PCS';
                  const priceBasis = unit === 'KG' ? '₹/kg' : '₹/pc';
                  let sellingPrice = Number(p.sellingPrice || p.selling_price || 0);
                  if (sellingPrice === 0 && String(p.name).includes('JUVAR PUFF')) sellingPrice = 70;

                  masterMap.set(id, {
                    id: String(p.id),
                    sku: String(p.sku || p.barcode || p.id),
                    barcode: String(p.barcode || p.sku || p.id),
                    name: String(p.name).trim(),
                    category: p.category || 'Namkeen & Farsan',
                    unit,
                    priceBasis,
                    netWeight: p.netWeight || p.net_weight || '',
                    costPrice: Number(p.costPrice || p.cost_price || 0),
                    sellingPrice,
                    stock: Number(p.stock || 0),
                    minStock: Number(p.minStock || p.min_stock || 0),
                    shelfLifeDays: Number(p.shelfLifeDays || p.shelf_life_days || 90),
                    batchNo: String(p.batchNo || p.batch_no || ''),
                    mfgDate: String(p.mfgDate || p.mfg_date || ''),
                    expiryDate: String(p.expiryDate || p.expiry_date || ''),
                    priceTiers: p.priceTiers || p.price_tiers || undefined
                  });
                  console.log(`Recovered from ${f} (syncEvents): [${p.id}] ${p.name}`);
                }
              }
            } catch {}
          }
        }
      }

      // Check orders items
      const orders = data.orders || (data.tables && data.tables.orders) || [];
      if (Array.isArray(orders)) {
        for (const o of orders) {
          let items = [];
          if (typeof o.items === 'string') {
            try { items = JSON.parse(o.items); } catch {}
          } else if (Array.isArray(o.items)) {
            items = o.items;
          } else if (typeof o.items_json === 'string') {
            try { items = JSON.parse(o.items_json); } catch {}
          }
          for (const it of items) {
            const p = it.product;
            if (p && p.id && p.name) {
              const id = String(p.id);
              if (!id.startsWith('test-') && !masterMap.has(id)) {
                const unit = (p.unit === 'KG' || p.unit === 'kg') ? 'KG' : 'PCS';
                const priceBasis = unit === 'KG' ? '₹/kg' : '₹/pc';
                let sellingPrice = Number(p.sellingPrice || p.selling_price || it.unitPrice || 0);
                if (sellingPrice === 0 && String(p.name).includes('JUVAR PUFF')) sellingPrice = 70;

                masterMap.set(id, {
                  id: String(p.id),
                  sku: String(p.sku || p.barcode || p.id),
                  barcode: String(p.barcode || p.sku || p.id),
                  name: String(p.name).trim(),
                  category: p.category || 'Namkeen & Farsan',
                  unit,
                  priceBasis,
                  netWeight: p.netWeight || p.net_weight || '',
                  costPrice: Number(p.costPrice || p.cost_price || 0),
                  sellingPrice,
                  stock: Number(p.stock || 0),
                  minStock: Number(p.minStock || p.min_stock || 0),
                  shelfLifeDays: Number(p.shelfLifeDays || p.shelf_life_days || 90),
                  batchNo: String(p.batchNo || p.batch_no || ''),
                  mfgDate: String(p.mfgDate || p.mfg_date || ''),
                  expiryDate: String(p.expiryDate || p.expiry_date || ''),
                  priceTiers: p.priceTiers || p.price_tiers || undefined
                });
                console.log(`Recovered from ${f} (orders): [${p.id}] ${p.name}`);
              }
            }
          }
        }
      }

      // Check tables.products
      if (data.tables && Array.isArray(data.tables.products)) {
        for (const p of data.tables.products) {
          if (p && p.id && p.name) {
            const id = String(p.id);
            if (!id.startsWith('test-') && !masterMap.has(id)) {
              masterMap.set(id, {
                id: String(p.id),
                sku: String(p.sku || p.barcode || p.id),
                barcode: String(p.barcode || p.sku || p.id),
                name: String(p.name).trim(),
                category: p.category || 'Namkeen & Farsan',
                unit: p.unit || 'PCS',
                priceBasis: p.price_basis || '₹/pc',
                netWeight: p.net_weight || '',
                costPrice: Number(p.cost_price || 0),
                sellingPrice: Number(p.selling_price || 0),
                stock: Number(p.stock || 0),
                minStock: Number(p.min_stock || 0),
                shelfLifeDays: Number(p.shelf_life_days || 90),
                batchNo: String(p.batch_no || ''),
                mfgDate: String(p.mfg_date || ''),
                expiryDate: String(p.expiry_date || ''),
                priceTiers: p.price_tiers || undefined
              });
              console.log(`Recovered from ${f} (tables.products): [${p.id}] ${p.name}`);
            }
          }
        }
      }

    } catch (err) {
      console.warn('Error reading backup file', f, err.message);
    }
  }
}

console.log('=== Step 3: Extracting from git reflog / commit diffs ===');
try {
  const diff = execSync('git log -p -S "save-product" -n 20', { encoding: 'utf8', maxBuffer: 20*1024*1024 });
  const regex = /\"action\":\s*\"save-product\"[\s\S]*?\"payload\":\s*(\{[\s\S]*?\n\s*\})/g;
  let m;
  while ((m = regex.exec(diff)) !== null) {
    try {
      const p = JSON.parse(m[1]);
      if (p && p.id && p.name) {
        const id = String(p.id);
        if (!id.startsWith('test-') && !masterMap.has(id)) {
          masterMap.set(id, {
            id: String(p.id),
            sku: String(p.sku || p.barcode || p.id),
            barcode: String(p.barcode || p.sku || p.id),
            name: String(p.name).trim(),
            category: p.category || 'Namkeen & Farsan',
            unit: p.unit || 'PCS',
            priceBasis: p.priceBasis || '₹/pc',
            netWeight: p.netWeight || '',
            costPrice: Number(p.costPrice || 0),
            sellingPrice: Number(p.sellingPrice || 0),
            stock: Number(p.stock || 0),
            minStock: Number(p.minStock || 0),
            shelfLifeDays: Number(p.shelfLifeDays || 90),
            batchNo: String(p.batchNo || ''),
            mfgDate: String(p.mfgDate || ''),
            expiryDate: String(p.expiryDate || ''),
            priceTiers: p.priceTiers || undefined
          });
          console.log(`Recovered from git diff: [${p.id}] ${p.name}`);
        }
      }
    } catch {}
  }
} catch {}

console.log('====================================================');
console.log('TOTAL RECOVERED CATALOG COUNT:', masterMap.size);
console.log('====================================================');

const allRecovered = Array.from(masterMap.values());
allRecovered.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

// Output to recovered JSON
fs.writeFileSync('src/data/importedProducts.json', JSON.stringify(allRecovered, null, 2), 'utf8');

// Also update data/products_master_catalogue.csv
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
for (const p of allRecovered) {
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
fs.writeFileSync('data/products_master_catalogue.csv', lines.join('\n'), 'utf8');
console.log('Updated src/data/importedProducts.json and data/products_master_catalogue.csv with all products.');
