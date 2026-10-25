import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function parseCsv(content: string) {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length === headers.length) {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx];
      });
      rows.push(obj);
    }
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

describe('Fresh Catalogue Import & Validation', () => {
  const csvPath = path.resolve('data/products_master_catalogue.csv');

  it('1. Master CSV catalogue exists and is non-empty', () => {
    expect(fs.existsSync(csvPath)).toBe(true);
    const stat = fs.statSync(csvPath);
    expect(stat.size).toBeGreaterThan(1000);
  });

  it('2. Contains exactly 305 validated products', () => {
    const content = fs.readFileSync(csvPath, 'utf8');
    const products = parseCsv(content);
    expect(products.length).toBe(305);
  });

  it('3. Every product has unique primary ID and valid barcode', () => {
    const content = fs.readFileSync(csvPath, 'utf8');
    const products = parseCsv(content);

    const ids = new Set<string>();
    const barcodes = new Set<string>();

    for (const p of products) {
      expect(p.id).toBeDefined();
      expect(p.id.trim().length).toBeGreaterThan(0);
      expect(ids.has(p.id)).toBe(false); // No duplicate IDs!
      ids.add(p.id);

      expect(p.barcode).toBeDefined();
      expect(p.barcode.trim().length).toBeGreaterThan(0);
      expect(barcodes.has(p.barcode)).toBe(false); // No duplicate barcodes!
      barcodes.add(p.barcode);

      expect(p.name).toBeDefined();
      expect(p.name.trim().length).toBeGreaterThan(0);
      expect(p.category).toBeDefined();
      expect(Number(p.sellingPrice)).toBeGreaterThanOrEqual(0);
    }

    expect(ids.size).toBe(305);
    expect(barcodes.size).toBe(305);
  });

  it('4. Preserves categories across the catalogue with zero empty categories', () => {
    const content = fs.readFileSync(csvPath, 'utf8');
    const products = parseCsv(content);

    const categories = new Set(products.map(p => p.category.trim()));
    expect(categories.size).toBeGreaterThanOrEqual(15);
    expect(categories.has('SWEETS')).toBe(true);
    expect(categories.has('ROASTED')).toBe(true);
    expect(categories.has('SNACKS')).toBe(true);
  });

  it('5. Import repeatability simulation verifies zero duplicate generation', () => {
    const content = fs.readFileSync(csvPath, 'utf8');
    const products = parseCsv(content);

    // Simulate Turso SQLite primary key upsert (id map)
    const dbTable = new Map<string, any>();

    // 1st run
    for (const p of products) {
      dbTable.set(p.id, { ...p, updated_at: 'first_run' });
    }
    expect(dbTable.size).toBe(305);

    // 2nd run (idempotent repeated import)
    for (const p of products) {
      dbTable.set(p.id, { ...p, updated_at: 'second_run' });
    }
    // Size remains strictly 305 with zero duplicates
    expect(dbTable.size).toBe(305);
    expect(dbTable.get('alb-0001').updated_at).toBe('second_run');
  });
});
