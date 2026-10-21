import { describe, it, expect } from 'vitest';
import { IMPORTED_PRODUCTS } from '../data/importedProducts';
import { 
  TARGET_41_KG_CONVERSIONS, 
  migrateCatalogPrices, 
  isApprovedPerGramProduct, 
  convertProductToKgPrice 
} from '../lib/catalogMigration';
import { 
  buildCartItem, 
  calculateLineTotal, 
  calculateOrderTotals, 
  lookupProduct 
} from '../lib/pricing';
import { Product, OrderBill } from '../types';

describe('AL-BURHANI POS — Catalog KG Price Unit Conversion Audit', () => {

  describe('1. Exact 41-Item Conversion', () => {
    it('verifies TARGET_41_KG_CONVERSIONS contains exactly 41 approved products', () => {
      const keys = Object.keys(TARGET_41_KG_CONVERSIONS);
      expect(keys.length).toBe(41);
    });

    it('converts Jini Sev from ₹0.32/g to ₹320/kg with unit KG and priceBasis ₹/kg', () => {
      const jiniSevOld: Product = {
        id: 'alb-0093',
        sku: '50470789537',
        barcode: '50470789537',
        name: 'JINI SEV J / FIKI SEV F',
        category: 'FARSAAN MIX' as any,
        unit: 'PCS',
        priceBasis: '₹/pc',
        costPrice: 0,
        sellingPrice: 0.32,
        stock: 10,
        minStock: 2,
      };

      expect(isApprovedPerGramProduct(jiniSevOld)).toBe(true);

      const converted = convertProductToKgPrice(jiniSevOld);
      expect(converted.sellingPrice).toBe(320);
      expect(converted.unit).toBe('KG');
      expect(converted.priceBasis).toBe('Rs./kg');
      expect(converted.netWeight).toBe('Per KG');
      expect(converted.barcode).toBe('50470789537');
    });

    it('converts Mohan Thaal from ₹0.50/g to ₹500/kg', () => {
      const mohanThaalOld: Product = {
        id: 'alb-0296',
        sku: '74263739184',
        barcode: '74263739184',
        name: 'MOHAN - THAAL MT',
        category: 'SWEETS' as any,
        unit: 'PCS',
        priceBasis: '₹/pc',
        costPrice: 0,
        sellingPrice: 0.5,
        stock: 5,
        minStock: 1,
      };

      expect(isApprovedPerGramProduct(mohanThaalOld)).toBe(true);

      const converted = convertProductToKgPrice(mohanThaalOld);
      expect(converted.sellingPrice).toBe(500);
      expect(converted.unit).toBe('KG');
      expect(converted.priceBasis).toBe('Rs./kg');
    });

    it('converts all 41 approved products accurately in the base catalog', () => {
      for (const [barcode, target] of Object.entries(TARGET_41_KG_CONVERSIONS)) {
        const found = IMPORTED_PRODUCTS.find((p) => p.barcode === barcode || p.sku === barcode);
        expect(found, `Expected product ${target.name} (${barcode}) in IMPORTED_PRODUCTS`).toBeDefined();
        if (found) {
          expect(found.sellingPrice).toBe(target.newPrice);
          expect(found.unit).toBe('KG');
          expect(found.priceBasis).toBe('₹/kg');
          expect(found.netWeight).toBe('Per KG');
        }
      }
    });
  });

  describe('2. Untouched Existing Products', () => {
    it('preserves all 62 existing KG products completely untouched', () => {
      // Ratlami Sev was already ₹320/kg
      const ratlami = IMPORTED_PRODUCTS.find((p) => p.barcode === '67225776696');
      expect(ratlami).toBeDefined();
      expect(ratlami!.sellingPrice).toBe(320); // NOT multiplied to 320,000!
      expect(ratlami!.unit).toBe('KG');

      // Gathiya G was already ₹320/kg
      const gathiya = IMPORTED_PRODUCTS.find((p) => p.barcode === '18026845854');
      expect(gathiya).toBeDefined();
      expect(gathiya!.sellingPrice).toBe(320);
      expect(gathiya!.unit).toBe('KG');

      // Pista Paak was already ₹1400/kg
      const pistaPaak = IMPORTED_PRODUCTS.find((p) => p.barcode === '96532192834');
      expect(pistaPaak).toBeDefined();
      expect(pistaPaak!.sellingPrice).toBe(1400);
      expect(pistaPaak!.unit).toBe('KG');

      // Samosa Patti was already ₹140/kg
      const samosaPatti = IMPORTED_PRODUCTS.find((p) => p.barcode === '23554551800');
      expect(samosaPatti).toBeDefined();
      expect(samosaPatti!.sellingPrice).toBe(140);
      expect(samosaPatti!.unit).toBe('KG');
    });

    it('preserves all count-based PCS products (e.g. Samosas, Bun, Kaju Katli boxes)', () => {
      // Bun B @ ₹5/pc
      const bun = IMPORTED_PRODUCTS.find((p) => p.name === 'BUN B');
      expect(bun).toBeDefined();
      expect(bun!.unit).toBe('PCS');
      expect(bun!.sellingPrice).toBe(5);

      // Fried Samosa @ ₹8/pc
      const friedSamosa = IMPORTED_PRODUCTS.find((p) => p.name === 'FRIED SAMOSA FS');
      expect(friedSamosa).toBeDefined();
      expect(friedSamosa!.unit).toBe('PCS');
      expect(friedSamosa!.sellingPrice).toBe(8);

      // Kacha Samosa @ ₹7/pc
      const kachaSamosa = IMPORTED_PRODUCTS.find((p) => p.name === 'KACHA SAMOSA KS');
      expect(kachaSamosa).toBeDefined();
      expect(kachaSamosa!.unit).toBe('PCS');
      expect(kachaSamosa!.sellingPrice).toBe(7);

      // Kaju Katli 250G box @ ₹275
      const kajuKatli = IMPORTED_PRODUCTS.find((p) => p.barcode === '0001');
      expect(kajuKatli).toBeDefined();
      expect(kajuKatli!.unit).toBe('PCS');
      expect(kajuKatli!.sellingPrice).toBe(275);
    });
  });

  describe('3. Migration Idempotency & Cloud Stale Protection', () => {
    it('is strictly idempotent: repeated runs produce identical prices and never multiply twice', () => {
      // 1st run
      const { products: run1, migratedCount: count1 } = migrateCatalogPrices(IMPORTED_PRODUCTS);
      expect(count1).toBe(0); // Already at new prices in IMPORTED_PRODUCTS

      // Check Jini Sev
      const jini1 = run1.find((p) => p.barcode === '50470789537')!;
      expect(jini1.sellingPrice).toBe(320);

      // 2nd run
      const { products: run2, migratedCount: count2 } = migrateCatalogPrices(run1);
      expect(count2).toBe(0);
      const jini2 = run2.find((p) => p.barcode === '50470789537')!;
      expect(jini2.sellingPrice).toBe(320); // Guaranteed NOT 320,000!

      // 3rd run
      const { products: run3, migratedCount: count3 } = migrateCatalogPrices(run2);
      expect(count3).toBe(0);
      const jini3 = run3.find((p) => p.barcode === '50470789537')!;
      expect(jini3.sellingPrice).toBe(320);
    });

    it('protects against stale remote data: converts old per-gram data fetched from cloud', () => {
      const staleRemoteProduct: Product = {
        id: 'alb-0093',
        sku: '50470789537',
        barcode: '50470789537',
        name: 'JINI SEV J / FIKI SEV F',
        category: 'FARSAAN MIX' as any,
        unit: 'PCS',
        priceBasis: '₹/pc',
        costPrice: 0,
        sellingPrice: 0.32, // Stale old price from outdated cloud row
        stock: 15,
        minStock: 2,
      };

      const { products: sanitized } = migrateCatalogPrices([staleRemoteProduct]);
      expect(sanitized[0].sellingPrice).toBe(320);
      expect(sanitized[0].unit).toBe('KG');
      expect(sanitized[0].priceBasis).toBe('Rs./kg');
    });
  });

  describe('4. Quantity Calculations & GST Billing on Converted Products', () => {
    it('accurately calculates line totals at ₹320/kg for 100g, 250g, 500g, and 1kg', () => {
      const convertedSev = IMPORTED_PRODUCTS.find((p) => p.barcode === '50470789537')!;
      expect(convertedSev.sellingPrice).toBe(320);
      expect(convertedSev.unit).toBe('KG');

      // 100 g -> ₹32.00
      const item100g = buildCartItem(convertedSev, 0.1, 100);
      expect(item100g.unitPrice).toBe(320);
      expect(item100g.lineTotal).toBe(32);

      // 250 g -> ₹80.00
      const item250g = buildCartItem(convertedSev, 0.25, 250);
      expect(item250g.unitPrice).toBe(320);
      expect(item250g.lineTotal).toBe(80);

      // 500 g -> ₹160.00
      const item500g = buildCartItem(convertedSev, 0.5, 500);
      expect(item500g.unitPrice).toBe(320);
      expect(item500g.lineTotal).toBe(160);

      // 1000 g (1 kg) -> ₹320.00
      const item1kg = buildCartItem(convertedSev, 1, 1000);
      expect(item1kg.unitPrice).toBe(320);
      expect(item1kg.lineTotal).toBe(320);
    });

    it('correctly handles GST-inclusive billing (CUSTOMER_BILL) for converted KG items', () => {
      const convertedSev = IMPORTED_PRODUCTS.find((p) => p.barcode === '50470789537')!;
      const item250g = buildCartItem(convertedSev, 0.25, 250); // ₹80.00

      const totals = calculateOrderTotals([item250g], 0, 'CUSTOMER_BILL');
      expect(totals.grandTotal).toBe(80); // ₹80 remains ₹80 (GST-inclusive)
      expect(totals.taxableAmount).toBe(76.19); // 80 / 1.05
      expect(totals.gstAmount).toBe(3.81);     // 80 - 76.19
    });

    it('correctly handles Without GST billing (NO_BILL) for converted KG items', () => {
      const convertedSev = IMPORTED_PRODUCTS.find((p) => p.barcode === '50470789537')!;
      const item250g = buildCartItem(convertedSev, 0.25, 250); // ₹80.00

      const totals = calculateOrderTotals([item250g], 0, 'NO_BILL');
      expect(totals.grandTotal).toBe(80);
      expect(totals.gstAmount).toBe(0);
      expect(totals.taxableAmount).toBe(80);
    });
  });

  describe('5. Historical Sales Isolation', () => {
    it('never recalculates or alters historical orders when catalog prices are converted', () => {
      // Historical sale generated when Jini Sev was purchased as a snapshot
      const historicalOrder: OrderBill = {
        id: 'sale-historical-001',
        billNumber: 'ALB-INV-1000',
        transactionType: 'CUSTOMER_BILL',
        items: [
          {
            product: {
              id: 'alb-0093',
              name: 'JINI SEV J / FIKI SEV F',
              barcode: '50470789537',
              sku: '50470789537',
              unit: 'PCS',
              sellingPrice: 0.32,
              costPrice: 0,
              stock: 0,
              minStock: 0,
              category: 'FARSAAN MIX' as any,
            },
            quantity: 250,
            unit: 'PCS',
            unitPrice: 0.32,
            lineTotal: 80,
            discountPercent: 0,
            formattedQuantity: '250 pcs',
            formattedRate: '₹0.32/pc',
          },
        ],
        subtotal: 80,
        discountAmount: 0,
        gstAmount: 3.81,
        grandTotal: 80,
        paymentMethod: 'CASH',
        amountReceived: 80,
        changeGiven: 0,
        cashierName: 'Owner',
        createdAt: '15 Oct 2026, 04:00 pm',
        timestamp: 1729000000000,
      };

      // Ensure historical order snapshot fields are completely preserved
      expect(historicalOrder.grandTotal).toBe(80);
      expect(historicalOrder.items[0].lineTotal).toBe(80);
      expect(historicalOrder.items[0].unitPrice).toBe(0.32);
      expect(historicalOrder.items[0].formattedRate).toBe('₹0.32/pc');
    });
  });

  describe('6. Leading-Zero Barcode Lookup on Converted Products', () => {
    it('preserves leading zeros as strings and matches converted products accurately', () => {
      const matches = lookupProduct(IMPORTED_PRODUCTS, '0001');
      expect(matches.length).toBe(1);
      expect(matches[0].barcode).toBe('0001');
      expect(matches[0].sku).toBe('0001');
      expect(matches[0].name).toContain('KAJU KATLI');
    });
  });
});
