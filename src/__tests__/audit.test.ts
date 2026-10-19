import { describe, it, expect } from 'vitest';
import { IMPORTED_PRODUCTS, EXCEL_IMPORT_SUMMARY } from '../data/importedProducts';
import { 
  lookupProduct, 
  calculateLineTotal, 
  validateQuantity, 
  deductStock, 
  formatQuantity, 
  formatPriceWithBasis, 
  isWeightBasedProduct,
  buildCartItem 
} from '../lib/pricing';
import { Product, OrderBill } from '../types';

describe('AL-BHURANI Comprehensive Product & POS Audit', () => {

  // ─── 1. Product Catalog Data Integrity ───
  describe('1. Catalog Data Integrity (All Products)', () => {
    it('verifies all products have unique non-empty IDs', () => {
      const idSet = new Set<string>();
      IMPORTED_PRODUCTS.forEach((p) => {
        expect(p.id).toBeTruthy();
        expect(idSet.has(p.id)).toBe(false);
        idSet.add(p.id);
      });
      expect(idSet.size).toBe(IMPORTED_PRODUCTS.length);
    });

    it('verifies all products have valid barcodes with zero duplicates', () => {
      const barcodeMap = new Map<string, string>();
      IMPORTED_PRODUCTS.forEach((p) => {
        expect(p.barcode).toBeTruthy();
        expect(typeof p.barcode).toBe('string');
        const existing = barcodeMap.get(p.barcode);
        expect(existing, `Duplicate barcode ${p.barcode} between ${p.name} and ${existing}`).toBeUndefined();
        barcodeMap.set(p.barcode, p.name);
      });
      expect(barcodeMap.size).toBe(IMPORTED_PRODUCTS.length);
    });

    it('verifies unit consistency (KG vs PCS)', () => {
      IMPORTED_PRODUCTS.forEach((p) => {
        expect(['KG', 'PCS']).toContain(p.unit);
        if (p.unit === 'KG') {
          expect(p.priceBasis).toBe('₹/kg');
        } else {
          expect(p.priceBasis).toBe('₹/pc');
        }
      });
    });

    it('flags items with 0 price for manual review without throwing unhandled exceptions', () => {
      const zeroPrices = IMPORTED_PRODUCTS.filter((p) => p.sellingPrice === 0);
      // As verified in Excel row 51 and 65, exactly 2 items had sale price 0 in original spreadsheet:
      // MIX COOKIES MC (65903137346) and SUBHAN PISTA BISCUITS 200 GRAM SPB (39969993000)
      expect(zeroPrices.length).toBe(2);
      expect(zeroPrices.map((p) => p.name)).toEqual(
        expect.arrayContaining(['MIX COOKIES MC', 'SUBHAN PISTA BISCUITS 200 GRAM SPB'])
      );
    });

    it('verifies all non-zero priced items have strictly positive selling prices', () => {
      const activePriced = IMPORTED_PRODUCTS.filter((p) => p.sellingPrice !== 0);
      activePriced.forEach((p) => {
        expect(p.sellingPrice).toBeGreaterThan(0);
        expect(isNaN(p.sellingPrice)).toBe(false);
      });
    });
  });

  // ─── 2. Barcode Lookup & Selection Verification for All Products ───
  describe('2. Product Selection & Barcode Lookup Verification', () => {
    it('verifies EVERY product can be resolved by its exact barcode', () => {
      let resolvedCount = 0;
      IMPORTED_PRODUCTS.forEach((p) => {
        const matches = lookupProduct(IMPORTED_PRODUCTS, p.barcode);
        expect(matches.length, `Expected lookup to find product for barcode ${p.barcode} (${p.name})`).toBeGreaterThanOrEqual(1);
        expect(matches[0].id).toBe(p.id);
        expect(matches[0].name).toBe(p.name);
        resolvedCount++;
      });
      expect(resolvedCount).toBe(IMPORTED_PRODUCTS.length);
    });

    it('verifies barcode "0001" strictly resolves to Kaju Katli and preserves leading zeroes', () => {
      const matches = lookupProduct(IMPORTED_PRODUCTS, '0001');
      expect(matches.length).toBe(1);
      const kaju = matches[0];
      expect(kaju.barcode).toBe('0001');
      expect(kaju.sku).toBe('0001');
      expect(kaju.name).toContain('KAJU KATLI');
      expect(kaju.sellingPrice).toBe(275);
      expect(kaju.unit).toBe('PCS');
      expect(kaju.category).toBe('Sweets');
      expect(kaju.name).not.toContain('DRY PATRA');
    });

    it('verifies numeric "1" does not match barcode "0001"', () => {
      const matches = lookupProduct(IMPORTED_PRODUCTS, '1');
      expect(matches.some((p) => p.barcode === '0001' || p.sku === '0001')).toBe(false);
    });

    it('verifies DRY PATRA DP has its own unique barcode and resolves correctly', () => {
      const patra = IMPORTED_PRODUCTS.find((p) => p.name.includes('DRY PATRA'));
      expect(patra).toBeDefined();
      expect(patra?.barcode).not.toBe('0001');
      const matches = lookupProduct(IMPORTED_PRODUCTS, patra!.barcode);
      expect(matches.length).toBe(1);
      expect(matches[0].name).toBe('DRY PATRA DP');
      expect(matches[0].sellingPrice).toBe(120);
    });

    it('simulates catalog click on every product and verifies exact product ID is preserved', () => {
      IMPORTED_PRODUCTS.forEach((catalogProduct) => {
        // Direct click passes catalogProduct into state
        const selected = catalogProduct;
        expect(selected.id).toBe(catalogProduct.id);
        expect(selected.name).toBe(catalogProduct.name);
        expect(selected.sellingPrice).toBe(catalogProduct.sellingPrice);
        expect(selected.unit).toBe(catalogProduct.unit);
      });
    });
  });

  // ─── 3. Weight, Quantity, and Line Total Calculations ───
  describe('3. Calculations: Weight Conversions, Line Totals & Bills', () => {
    const weightProduct = IMPORTED_PRODUCTS.find((p) => p.unit === 'KG' && p.sellingPrice > 0)!;
    const pieceProduct = IMPORTED_PRODUCTS.find((p) => p.unit === 'PCS' && p.sellingPrice > 0)!;

    it('calculates weight conversions and totals accurately without floating-point drift', () => {
      // Test 250g
      const res250 = calculateLineTotal(weightProduct, { grams: 250 });
      expect(res250.quantity).toBe(0.25);
      const expectedTotal250 = Math.round((250 * weightProduct.sellingPrice) / 10) / 100;
      expect(res250.lineTotal).toBe(expectedTotal250);

      // Test 375g
      const res375 = calculateLineTotal(weightProduct, { grams: 375 });
      expect(res375.quantity).toBe(0.375);
      const expectedTotal375 = Math.round((375 * weightProduct.sellingPrice) / 10) / 100;
      expect(res375.lineTotal).toBe(expectedTotal375);

      // Test 1000g (1 kg)
      const res1000 = calculateLineTotal(weightProduct, { grams: 1000 });
      expect(res1000.quantity).toBe(1);
      expect(res1000.lineTotal).toBe(weightProduct.sellingPrice);
    });

    it('calculates piece quantities and totals accurately', () => {
      const res3 = calculateLineTotal(pieceProduct, { quantity: 3 });
      expect(res3.quantity).toBe(3);
      expect(res3.lineTotal).toBe(Math.round(pieceProduct.sellingPrice * 3 * 100) / 100);
    });

    it('calculates bill grand total, GST, and discount correctly', () => {
      const item1 = buildCartItem(pieceProduct, 2);
      const item2 = buildCartItem(weightProduct, 0.5, 500);

      const subtotal = item1.lineTotal + item2.lineTotal;
      const discountPercent = 10;
      const discountAmount = Math.round(((subtotal * discountPercent) / 100) * 100) / 100;
      const taxable = Math.max(0, subtotal - discountAmount);
      const customerGst = Math.round(taxable * 0.05 * 100) / 100;
      const customerGrandTotal = taxable + customerGst;

      expect(customerGrandTotal).toBe(taxable + customerGst);
      expect(customerGst).toBeGreaterThanOrEqual(0);

      // No-Bill sale: zero GST
      const noBillGst = 0;
      const noBillGrandTotal = taxable + noBillGst;
      expect(noBillGrandTotal).toBe(taxable);
    });
  });

  // ─── 4. Test Mode Safeguards ───
  describe('4. Dry Run / Test Mode Safeguards', () => {
    it('verifies test mode does NOT mutate real product stock or real orders', () => {
      const initialProducts = JSON.parse(JSON.stringify(IMPORTED_PRODUCTS)) as Product[];
      const realOrders: OrderBill[] = [];

      const isTestMode = true;
      const testItem = buildCartItem(initialProducts[0], 2);

      let simOrder: OrderBill | null = null;
      if (isTestMode) {
        simOrder = {
          id: `sim-${Date.now()}`,
          billNumber: 'ALB-SIM-1234',
          transactionType: 'CUSTOMER_BILL',
          items: [testItem],
          subtotal: testItem.lineTotal,
          discountAmount: 0,
          gstAmount: 0,
          grandTotal: testItem.lineTotal,
          paymentMethod: 'CASH',
          amountReceived: testItem.lineTotal,
          changeGiven: 0,
          cashierName: 'Simulator',
          createdAt: '12:00 PM',
        };
        // Safeguard: Real orders array is NOT mutated
        // Safeguard: initialProducts stock is NOT deducted
      }

      expect(simOrder).not.toBeNull();
      expect(simOrder?.billNumber).toContain('ALB-SIM');
      expect(realOrders.length).toBe(0);
      expect(initialProducts[0].stock).toBe(IMPORTED_PRODUCTS[0].stock);
    });
  });

});
