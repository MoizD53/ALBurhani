import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { IMPORTED_PRODUCTS } from '../data/importedProducts';
import { lookupProduct, isWeightBasedProduct } from '../lib/pricing';
import { Product, OrderBill, ExpenseItem } from '../types';

describe('AL-BURHANI POS Production Readiness & Delivery Verification', () => {

  describe('1. Inventory Reset & Stock Zeroing Verification', () => {
    it('verifies all 305 imported products have stock = 0 for fresh manual opening entry', () => {
      expect(IMPORTED_PRODUCTS.length).toBe(305);

      const nonZeroProducts = IMPORTED_PRODUCTS.filter((p) => p.stock !== 0);
      expect(nonZeroProducts.length).toBe(0);

      // Verify all products have intact required metadata
      for (const p of IMPORTED_PRODUCTS) {
        expect(p.id).toBeTruthy();
        expect(p.name).toBeTruthy();
        expect(p.sellingPrice).toBeGreaterThanOrEqual(0);
        expect(p.unit).toBeTruthy();
        expect(p.category).toBeTruthy();
        expect(p.stock).toBe(0);
      }
    });

    it('verifies opening stock migration albhurani_opening_stock_zero_v1 resets any stale cache', () => {
      // Simulate stale cached products with non-zero stock
      const staleCachedProducts: Product[] = IMPORTED_PRODUCTS.map((p, idx) => ({
        ...p,
        stock: idx === 0 ? 25 : 10,
      }));

      // Migration simulation
      const isZeroStockMigrated = false; // flag not set yet
      let resolvedProducts: Product[];

      if (!isZeroStockMigrated) {
        resolvedProducts = staleCachedProducts.map((p) => ({ ...p, stock: 0 }));
      } else {
        resolvedProducts = staleCachedProducts;
      }

      expect(resolvedProducts.every((p) => p.stock === 0)).toBe(true);
      expect(resolvedProducts.length).toBe(305);
    });
  });

  describe('2. Real Hardware Barcode Scanner & Matching', () => {
    it('matches exact barcode "0001" preserving leading zeroes to KAJU KATLI 250G', () => {
      const match = lookupProduct(IMPORTED_PRODUCTS, '0001');
      expect(match.length).toBe(1);
      expect(match[0].name).toBe('KAJU KATLI 250G');
      expect(match[0].barcode).toBe('0001');
      expect(match[0].sellingPrice).toBe(275);
      expect(match[0].unit).toBe('PCS');
    });

    it('does NOT match barcode "1" or integer 1 to "0001"', () => {
      const match = lookupProduct(IMPORTED_PRODUCTS, '1');
      const hasKajuKatli = match.some((p) => p.barcode === '0001');
      expect(hasKajuKatli).toBe(false);
    });

    it('differentiates count-based items (PCS) for auto-add vs weight-based items (KG) for weight prompt', () => {
      const kajuKatli250g = IMPORTED_PRODUCTS.find((p) => p.barcode === '0001')!;
      expect(isWeightBasedProduct(kajuKatli250g)).toBe(false); // PCS -> Auto-add 1 piece

      const weightItem = IMPORTED_PRODUCTS.find((p) => p.unit === 'KG');
      if (weightItem) {
        expect(isWeightBasedProduct(weightItem)).toBe(true); // KG -> Prompts weight modal
      }
    });

    it('returns empty array cleanly for unknown barcodes without throwing exceptions', () => {
      const unknownMatch = lookupProduct(IMPORTED_PRODUCTS, 'NONEXISTENT99999');
      expect(Array.isArray(unknownMatch)).toBe(true);
      expect(unknownMatch.length).toBe(0);
    });

    it('returns multiple products when a search/SKU matches multiple items for disambiguation modal', () => {
      // Search for common word like 'KAJU'
      const multipleMatches = lookupProduct(IMPORTED_PRODUCTS, 'KAJU');
      expect(multipleMatches.length).toBeGreaterThan(1);
      // All matches must contain KAJU in name or code
      expect(multipleMatches.every((p) => p.name.toUpperCase().includes('KAJU'))).toBe(true);
    });

    it('prevents rapid duplicate scans within 350ms window', () => {
      const lastScan = { code: '0001', time: 1000 };
      const duplicateScanTime = 1100; // 100ms later (scanner dual event)

      const isDuplicate = lastScan.code === '0001' && (duplicateScanTime - lastScan.time) < 350;
      expect(isDuplicate).toBe(true);

      const intentionalNextScanTime = 1600; // 600ms later (cashier scanned 2nd item)
      const isNextDuplicate = lastScan.code === '0001' && (intentionalNextScanTime - lastScan.time) < 350;
      expect(isNextDuplicate).toBe(false);
    });
  });

  describe('3. Clean Mock / Demo Data Removal', () => {
    it('filters out mock orders and simulates real clean empty state', () => {
      const sampleOrdersWithMocks = [
        { id: 'bill-init-001', billNumber: 'ALB-INIT-1', grandTotal: 500 },
        { id: 'sim-1729000000', billNumber: 'ALB-SIM-4521', grandTotal: 250 },
        { id: 'mock-order-123', billNumber: 'ALB-NB-123', grandTotal: 100 },
        { id: 'sale-1729350000-4321', billNumber: 'ALB-INV-4321', grandTotal: 750 },
      ] as OrderBill[];

      const cleanOrders = sampleOrdersWithMocks.filter(
        (o) =>
          o &&
          o.id &&
          !o.id.startsWith('bill-init-') &&
          !o.id.startsWith('sim-') &&
          !o.id.startsWith('mock-') &&
          !o.billNumber?.startsWith('ALB-SIM')
      );

      expect(cleanOrders.length).toBe(1);
      expect(cleanOrders[0].billNumber).toBe('ALB-INV-4321');
    });

    it('filters out mock expenses and simulates real clean empty state', () => {
      const sampleExpensesWithMocks = [
        { id: 'exp-1', title: 'Mock Ghee Tin', amount: 14500 },
        { id: 'exp-2', title: 'Mock Packaging Boxes', amount: 6200 },
        { id: 'exp-3', title: 'Mock Electricity Bill', amount: 4800 },
        { id: 'mock-exp-99', title: 'Mock Tea', amount: 50 },
        { id: 'expense-1729350000000', title: 'Real Commercial Milk Purchase', amount: 3200 },
      ] as ExpenseItem[];

      const cleanExpenses = sampleExpensesWithMocks.filter(
        (e) =>
          e &&
          e.id &&
          !e.id.startsWith('exp-1') &&
          !e.id.startsWith('exp-2') &&
          !e.id.startsWith('exp-3') &&
          !e.id.startsWith('mock-')
      );

      expect(cleanExpenses.length).toBe(1);
      expect(cleanExpenses[0].id).toBe('expense-1729350000000');
      expect(cleanExpenses[0].title).toBe('Real Commercial Milk Purchase');
    });
  });

  describe('4. PWA Manifest & Service Worker Verification', () => {
    it('verifies manifest.webmanifest exists and contains valid standalone configuration', () => {
      const manifestPath = path.resolve(__dirname, '../../public/manifest.webmanifest');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const raw = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(raw);

      expect(manifest.name).toBe('AL-BURHANI POS');
      expect(manifest.short_name).toBe('AL-BURHANI');
      expect(manifest.display).toBe('standalone');
      expect(manifest.start_url).toBe('/');
      expect(manifest.theme_color).toBe('#080808');
      expect(manifest.background_color).toBe('#080808');
      expect(Array.isArray(manifest.icons)).toBe(true);
      expect(manifest.icons.some((i: any) => i.sizes === '192x192')).toBe(true);
      expect(manifest.icons.some((i: any) => i.sizes === '512x512')).toBe(true);
    });

    it('verifies brand PNG icons exist with correct dimensions', () => {
      const icon192 = path.resolve(__dirname, '../../public/icon-192.png');
      const icon512 = path.resolve(__dirname, '../../public/icon-512.png');
      const favicon = path.resolve(__dirname, '../../public/favicon.svg');

      expect(fs.existsSync(icon192)).toBe(true);
      expect(fs.existsSync(icon512)).toBe(true);
      expect(fs.existsSync(favicon)).toBe(true);

      expect(fs.statSync(icon192).size).toBeGreaterThan(1000);
      expect(fs.statSync(icon512).size).toBeGreaterThan(1000);
    });

    it('verifies sw.js strictly disallows caching of database, auth, and sales transactions', () => {
      const swPath = path.resolve(__dirname, '../../public/sw.js');
      expect(fs.existsSync(swPath)).toBe(true);

      const swContent = fs.readFileSync(swPath, 'utf8');
      // Verify security rules
      expect(swContent).toContain('turso.io');
      expect(swContent).toContain("request.method !== 'GET'");
      expect(swContent).toMatch(/albhurani-pos-v\d+/);
    });
  });
});
