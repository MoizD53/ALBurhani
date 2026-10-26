import openpyxl
import os
import json

file_path = "al burhani new stock 27-10-2026.xlsx"
print(f"Loading {file_path}...")

wb = openpyxl.load_workbook(file_path, data_only=False)
print("Sheet names:", wb.sheetnames)

for sheet_name in wb.sheetnames:
    ws = wb[sheet_name]
    print(f"\n--- Sheet: {sheet_name} ---")
    print(f"Max row: {ws.max_row}, Max column: {ws.max_column}")
    
    # Read first 10 rows
    rows = list(ws.iter_rows(values_only=False))
    if not rows:
        print("Empty sheet")
        continue
    
    headers = [cell.value for cell in rows[0]]
    print("Headers (row 1):", headers)
    
    print("\nFirst 5 data rows:")
    for i, row in enumerate(rows[1:6], start=2):
        row_vals = []
        for cell in row:
            val = cell.value
            data_type = cell.data_type
            number_format = cell.number_format
            row_vals.append({
                "val": str(val) if val is not None else None,
                "type": data_type,
                "fmt": number_format
            })
        print(f"Row {i}: {row_vals}")

# Also check data_only=True to compare formulas vs calculated values
wb_data = openpyxl.load_workbook(file_path, data_only=True)
ws_data = wb_data[wb.sheetnames[0]]
print("\n--- Value inspection (data_only=True) ---")
total_rows = 0
for row_idx, row in enumerate(ws_data.iter_rows(values_only=True), start=1):
    if any(row):
        total_rows += 1
print(f"Total non-empty rows across sheet: {total_rows}")
