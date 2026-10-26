import openpyxl
import json
import os

file_path = "al burhani new stock 27-10-2026.xlsx"
wb = openpyxl.load_workbook(file_path, data_only=True)
ws = wb["in"]

# Load old products to preserve IDs
with open('src/data/importedProducts.json', 'r', encoding='utf-8') as f:
    old_products = json.load(f)

old_by_barcode = {str(p.get('barcode')).strip(): p for p in old_products if p.get('barcode')}
old_by_name = {str(p.get('name')).strip().lower(): p for p in old_products if p.get('name')}

# Also load existing IDs from database backup
with open('backups/catalogue_backup_pre_27_10_2026.json', 'r', encoding='utf-8') as f:
    backup_data = json.load(f)

for tp in backup_data.get('tursoProducts', []):
    bc = str(tp.get('barcode', '')).strip()
    nm = str(tp.get('name', '')).strip().lower()
    if bc and bc not in old_by_barcode:
        old_by_barcode[bc] = tp
    if nm and nm not in old_by_name:
        old_by_name[nm] = tp

new_items = []
used_ids = set()
for p in old_products:
    if p.get('id'):
        used_ids.add(p['id'])

next_auto_id = 339

for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
    if not any(row):
        continue
    sku_raw, bc_raw, name_raw, cat_raw, unit_raw, sp_raw, cp_raw, stock_raw, min_stock_raw, status_raw = row[:10]
    
    sku = str(sku_raw).strip() if sku_raw is not None else ""
    if isinstance(sku_raw, float) and sku_raw.is_integer():
        sku = str(int(sku_raw))
        
    if isinstance(bc_raw, float):
        if bc_raw.is_integer():
            barcode = str(int(bc_raw))
        else:
            barcode = f"{bc_raw:.0f}"
    elif isinstance(bc_raw, int):
        barcode = str(bc_raw)
    else:
        barcode = str(bc_raw).strip() if bc_raw is not None else ""
        
    name = str(name_raw).strip() if name_raw is not None else ""
    category = str(cat_raw).strip().upper() if cat_raw is not None else "GENERAL"
    unit = str(unit_raw).strip().upper() if unit_raw is not None else "PCS"
    if unit not in ("KG", "PCS"):
        unit = "PCS"
        
    selling_price = float(sp_raw) if sp_raw is not None else 0.0
    cost_price = float(cp_raw) if cp_raw is not None else 0.0
    current_stock = float(stock_raw) if stock_raw is not None else 0.0
    min_stock = float(min_stock_raw) if min_stock_raw is not None else 0.0
    status_str = str(status_raw).strip().lower() if status_raw is not None else "active"
    is_active = status_str != "inactive" and status_str != "discontinued"

    price_basis = "₹/kg" if unit == "KG" else "₹/pc"

    # Match ID to preserve historical integrity
    matched_id = None
    if barcode in old_by_barcode:
        matched_id = old_by_barcode[barcode].get('id')
    elif name.lower() in old_by_name:
        matched_id = old_by_name[name.lower()].get('id')

    if not matched_id or matched_id in [item['id'] for item in new_items]:
        # Assign clean unique ID
        while f"alb-{next_auto_id:04d}" in used_ids:
            next_auto_id += 1
        matched_id = f"alb-{next_auto_id:04d}"
        used_ids.add(matched_id)
        next_auto_id += 1

    new_items.append({
        "id": matched_id,
        "sku": sku,
        "barcode": barcode,
        "name": name,
        "category": category,
        "unit": unit,
        "priceBasis": price_basis,
        "costPrice": cost_price,
        "sellingPrice": selling_price,
        "stock": current_stock,
        "minStock": min_stock,
        "shelfLifeDays": 90,
        "isActive": is_active,
        "taxRate": 5,
        "mrp": selling_price,
    })

print(f"Extracted {len(new_items)} valid product records.")

# Save to data/new_catalogue_extracted.json
with open('data/new_catalogue_extracted.json', 'w', encoding='utf-8') as f:
    json.dump(new_items, f, indent=2, ensure_ascii=False)

print("Saved to data/new_catalogue_extracted.json")
