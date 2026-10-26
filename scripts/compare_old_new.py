import json
import openpyxl

with open('src/data/importedProducts.json', 'r', encoding='utf-8') as f:
    old_products = json.load(f)

print(f"Old products count: {len(old_products)}")

wb = openpyxl.load_workbook("al burhani new stock 27-10-2026.xlsx", data_only=True)
ws = wb["in"]

new_products = []
for row in ws.iter_rows(min_row=2, values_only=True):
    if not any(row):
        continue
    sku, barcode, name, category, unit, sp, cp, stock, min_stock, status = row[:10]
    new_products.append({
        "sku": str(sku).strip() if sku is not None else "",
        "barcode": str(int(barcode)) if isinstance(barcode, (int, float)) else str(barcode).strip(),
        "name": str(name).strip() if name is not None else "",
        "category": str(category).strip() if category is not None else "",
        "unit": str(unit).strip() if unit is not None else "PCS",
        "selling_price": float(sp) if sp is not None else 0.0,
        "cost_price": float(cp) if cp is not None else 0.0,
        "stock": float(stock) if stock is not None else 0.0,
        "min_stock": float(min_stock) if min_stock is not None else 0.0,
        "status": str(status).strip() if status is not None else "Active"
    })

print(f"New products count: {len(new_products)}")

old_by_barcode = {p["barcode"]: p for p in old_products if p.get("barcode")}
old_by_name = {p["name"].strip().lower(): p for p in old_products if p.get("name")}

matched_by_barcode = 0
matched_by_name_diff_barcode = 0
brand_new_products = []

for np in new_products:
    bc = np["barcode"]
    name_key = np["name"].lower()
    
    if bc in old_by_barcode:
        matched_by_barcode += 1
    elif name_key in old_by_name:
        matched_by_name_diff_barcode += 1
        print(f"Name match but diff barcode: '{np['name']}' -> New BC: '{bc}', Old BC: '{old_by_name[name_key]['barcode']}'")
    else:
        brand_new_products.append(np)

print(f"\nMatched by barcode: {matched_by_barcode}")
print(f"Matched by name (different barcode): {matched_by_name_diff_barcode}")
print(f"Brand new products not in old catalogue: {len(brand_new_products)}")
if brand_new_products:
    print("Sample new products:")
    for p in brand_new_products[:10]:
        print(f"  - [{p['category']}] {p['name']} ({p['barcode']}) - Rs.{p['selling_price']}/{p['unit']}")

# Check old products that are NOT in new catalogue
new_barcodes = {p["barcode"] for p in new_products}
new_names = {p["name"].lower() for p in new_products}
removed_products = [p for p in old_products if p.get("barcode") not in new_barcodes and p.get("name", "").strip().lower() not in new_names]
print(f"\nOld products NOT in new catalogue: {len(removed_products)}")
for p in removed_products:
    print(f"  - [{p.get('category')}] {p.get('name')} ({p.get('barcode')}) ID: {p.get('id')}")
