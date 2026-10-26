import json

with open('data/new_catalogue_extracted.json', 'r', encoding='utf-8') as f:
    items = json.load(f)

print(f"Total extracted items: {len(items)}")

ids = [p['id'] for p in items]
skus = [p['sku'] for p in items]
barcodes = [p['barcode'] for p in items]

print(f"Unique IDs: {len(set(ids))} / {len(ids)}")
print(f"Unique SKUs: {len(set(skus))} / {len(skus)}")
print(f"Unique Barcodes: {len(set(barcodes))} / {len(barcodes)}")

# Check referenced product IDs in historical orders
referenced_ids = [
  'alb-0121', 'alb-0303', 'alb-0020', 'alb-0124', 'alb-0080', 'alb-0129',
  'alb-0093', 'alb-0272', 'alb-0292', 'alb-0270', 'alb-0295', 'alb-0038',
  'alb-0258', 'alb-0215', 'alb-0092', 'alb-0297', 'alb-0103', '1792654193876',
  'alb-0083', 'alb-0190', 'alb-0230', 'alb-0163', 'alb-0244', 'alb-0024',
  'alb-0078', 'alb-0154', 'alb-0302', 'alb-0227', 'alb-0195', 'alb-0278',
  'alb-0170', 'alb-0131', 'alb-0298', '1793007971375', '1792746920219', 'alb-0003',
  '1792749145882', '1792739712919', '1792738343670', 'alb-0091'
]

item_id_set = set(ids)
missing_ref_ids = [rid for rid in referenced_ids if rid not in item_id_set]
print(f"Historical order references preserved: {len(referenced_ids) - len(missing_ref_ids)} / {len(referenced_ids)}")
if missing_ref_ids:
    print(f"Missing referenced IDs: {missing_ref_ids}")
else:
    print("ALL 40 historical order references are 100% PRESERVED!")
