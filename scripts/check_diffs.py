import openpyxl
import json

with open('src/data/importedProducts.json', 'r', encoding='utf-8') as f:
    old_products = {p['name'].strip().lower(): p for p in json.load(f)}

wb = openpyxl.load_workbook('al burhani new stock 27-10-2026.xlsx', data_only=True)
ws = wb['in']
for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
    name = str(row[2]).strip().lower()
    if name in old_products:
        old_bc = str(old_products[name].get('barcode'))
        new_bc = str(row[1])
        if old_bc != new_bc:
            print(f"Row {idx}: {row[2]}")
            print(f"  Old SKU: {old_products[name].get('sku')}, Old BC: {old_bc}")
            print(f"  New SKU: {row[0]}, New BC: {new_bc}")
