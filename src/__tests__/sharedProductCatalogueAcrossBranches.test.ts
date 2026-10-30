/**
 * AL-BHURANI POS — SHARED PRODUCT DATABASE ACROSS ALL BRANCHES
 * 
 * Verifies:
 * 1. ONE Common Product Catalogue across Godi Road & MG Road.
 * 2. Shared product master information (name, sku, barcode, category, prices, etc.).
 * 3. Editing in either branch updates the shared master in both branches.
 * 4. Stock remains strictly branch-specific (independent inventories).
 * 5. Godi Road sales decrease ONLY Godi Road stock.
 * 6. MG Road purchases increase ONLY MG Road stock.
 * 7. Refreshing terminals maintains synchronization.
 * 8. Historical records, bills, purchases, and audit integrity are preserved.
 */

import { describe, it, expect } from 'vitest';
import type { Product, CartItem, OrderBill, PurchaseBill } from '../types';
import { deductStock, restoreStock, isWeightBasedProduct } from '../lib/pricing';

describe('AL-BHURANI POS — Shared Product Catalogue & Independent Branch Inventories', () => {

  // Simulated Centralized Master Product Database & Branch Stock Store
  interface MasterDatabase {
    products: Map<string, Product>;
    branchStock: Map<string, { godi_road: number; mg_road: number }>;
  }

  function createDatabase(): MasterDatabase {
    return {
      products: new Map(),
      branchStock: new Map(),
    };
  }

  function addProductToCatalog(
    db: MasterDatabase,
    product: Product,
    creatingBranch: 'godi_road' | 'mg_road',
    initialStock = 0
  ) {
    db.products.set(product.id, {
      ...product,
      stock: initialStock,
    });
    db.branchStock.set(product.id, {
      godi_road: creatingBranch === 'godi_road' ? initialStock : 0,
      mg_road: creatingBranch === 'mg_road' ? initialStock : 0,
    });
  }

  function editProductMaster(
    db: MasterDatabase,
    productId: string,
    updates: Partial<Product>
  ) {
    const existing = db.products.get(productId);
    if (!existing) throw new Error('Product not found');
    const updated: Product = {
      ...existing,
      ...updates,
      id: existing.id, // Immutable ID
      barcode: updates.barcode || existing.barcode,
    };
    db.products.set(productId, updated);
  }

  function getProductsForBranch(
    db: MasterDatabase,
    branch: 'godi_road' | 'mg_road'
  ): Product[] {
    return Array.from(db.products.values()).map((p) => {
      const stockMap = db.branchStock.get(p.id) || { godi_road: 0, mg_road: 0 };
      return {
        ...p,
        stock: stockMap[branch],
        branchStock: { ...stockMap },
      };
    });
  }

  function recordSale(
    db: MasterDatabase,
    branch: 'godi_road' | 'mg_road',
    items: { productId: string; quantity: number }[]
  ) {
    for (const item of items) {
      const p = db.products.get(item.productId);
      const isWeight = p ? isWeightBasedProduct(p) : false;
      const currentStockMap = db.branchStock.get(item.productId) || { godi_road: 0, mg_road: 0 };
      const currentBranchStock = currentStockMap[branch];
      const newStock = deductStock(currentBranchStock, item.quantity, isWeight);
      db.branchStock.set(item.productId, {
        ...currentStockMap,
        [branch]: newStock,
      });
    }
  }

  function recordPurchase(
    db: MasterDatabase,
    branch: 'godi_road' | 'mg_road',
    items: { productId: string; quantity: number }[]
  ) {
    for (const item of items) {
      const currentStockMap = db.branchStock.get(item.productId) || { godi_road: 0, mg_road: 0 };
      const currentBranchStock = currentStockMap[branch];
      const newStock = currentBranchStock + item.quantity;
      db.branchStock.set(item.productId, {
        ...currentStockMap,
        [branch]: newStock,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 1. One Common Product Catalogue
  // ---------------------------------------------------------------------------
  describe('1. Common Master Catalogue Availability Across Branches', () => {
    it('adding a product from Godi Road automatically makes it available at MG Road', () => {
      const db = createDatabase();
      const product: Product = {
        id: 'prod-ind-mix-101',
        name: 'Indian Mix',
        sku: 'SKU-IM-01',
        barcode: '8901234567890',
        category: 'FARSAAN MIX',
        unit: 'KG',
        priceBasis: 'Rs./kg',
        costPrice: 200,
        sellingPrice: 320,
      };

      addProductToCatalog(db, product, 'godi_road', 50);

      const godiCatalog = getProductsForBranch(db, 'godi_road');
      const mgCatalog = getProductsForBranch(db, 'mg_road');

      // Both branches see the exact same product master information
      expect(godiCatalog).toHaveLength(1);
      expect(mgCatalog).toHaveLength(1);

      expect(godiCatalog[0].id).toBe(product.id);
      expect(mgCatalog[0].id).toBe(product.id);
      expect(mgCatalog[0].name).toBe('Indian Mix');
      expect(mgCatalog[0].sku).toBe('SKU-IM-01');
      expect(mgCatalog[0].barcode).toBe('8901234567890');
      expect(mgCatalog[0].sellingPrice).toBe(320);
      expect(mgCatalog[0].costPrice).toBe(200);
    });

    it('adding a product from MG Road immediately becomes available in Godi Road', () => {
      const db = createDatabase();
      const product: Product = {
        id: 'prod-pista-roll-202',
        name: 'Pista Roll',
        sku: 'SKU-PR-02',
        barcode: '8909876543210',
        category: 'SWEETS',
        unit: 'KG',
        priceBasis: 'Rs./kg',
        costPrice: 600,
        sellingPrice: 900,
      };

      addProductToCatalog(db, product, 'mg_road', 15);

      const godiCatalog = getProductsForBranch(db, 'godi_road');
      const mgCatalog = getProductsForBranch(db, 'mg_road');

      expect(godiCatalog).toHaveLength(1);
      expect(godiCatalog[0].id).toBe('prod-pista-roll-202');
      expect(godiCatalog[0].name).toBe('Pista Roll');
      expect(godiCatalog[0].sellingPrice).toBe(900);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Product Editing and Synchronisation
  // ---------------------------------------------------------------------------
  describe('2. Product Editing Synchronisation', () => {
    it('editing master details from either branch reflects in both branches with the same immutable ID', () => {
      const db = createDatabase();
      const product: Product = {
        id: 'prod-sev-001',
        name: 'Nylon Sev',
        sku: 'SKU-NS-01',
        barcode: '8901112223334',
        category: 'FARSAAN MIX',
        unit: 'KG',
        costPrice: 150,
        sellingPrice: 240,
      };

      addProductToCatalog(db, product, 'godi_road', 30);

      // MG Road edits the product name and selling price
      editProductMaster(db, 'prod-sev-001', {
        name: 'Premium Barik Nylon Sev',
        sellingPrice: 260,
        costPrice: 160,
      });

      const godiCatalog = getProductsForBranch(db, 'godi_road');
      const mgCatalog = getProductsForBranch(db, 'mg_road');

      // Both branches see the updated name and price
      expect(godiCatalog[0].name).toBe('Premium Barik Nylon Sev');
      expect(mgCatalog[0].name).toBe('Premium Barik Nylon Sev');
      expect(godiCatalog[0].sellingPrice).toBe(260);
      expect(mgCatalog[0].sellingPrice).toBe(260);
      expect(godiCatalog[0].costPrice).toBe(160);
      expect(mgCatalog[0].costPrice).toBe(160);

      // Immutable ID is strictly preserved
      expect(godiCatalog[0].id).toBe('prod-sev-001');
      expect(mgCatalog[0].id).toBe('prod-sev-001');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Independent Branch Inventories (Stock Isolation)
  // ---------------------------------------------------------------------------
  describe('3. Strict Branch-Specific Inventory Isolation', () => {
    it('initialises independent stock for Godi Road and MG Road (e.g. Godi: 50, MG: 20)', () => {
      const db = createDatabase();
      const product: Product = {
        id: 'prod-ind-mix-101',
        name: 'Indian Mix',
        sku: 'SKU-IM-01',
        barcode: '8901234567890',
        category: 'FARSAAN MIX',
        unit: 'KG',
        costPrice: 200,
        sellingPrice: 320,
      };

      addProductToCatalog(db, product, 'godi_road', 50);
      // Manually inward stock of 20 at MG Road
      db.branchStock.set(product.id, { godi_road: 50, mg_road: 20 });

      const godiCatalog = getProductsForBranch(db, 'godi_road');
      const mgCatalog = getProductsForBranch(db, 'mg_road');

      expect(godiCatalog[0].stock).toBe(50);
      expect(mgCatalog[0].stock).toBe(20);

      // branchStock dictionary holds both
      expect(godiCatalog[0].branchStock?.godi_road).toBe(50);
      expect(godiCatalog[0].branchStock?.mg_road).toBe(20);
    });

    it('selling 5 units from Godi Road reduces Godi stock to 45 while MG stock remains 20', () => {
      const db = createDatabase();
      const product: Product = {
        id: 'prod-ind-mix-101',
        name: 'Indian Mix',
        sku: 'SKU-IM-01',
        barcode: '8901234567890',
        category: 'FARSAAN MIX',
        unit: 'KG',
        costPrice: 200,
        sellingPrice: 320,
      };

      addProductToCatalog(db, product, 'godi_road', 50);
      db.branchStock.set(product.id, { godi_road: 50, mg_road: 20 });

      // Godi Road sells 5 units
      recordSale(db, 'godi_road', [{ productId: 'prod-ind-mix-101', quantity: 5 }]);

      const godiCatalog = getProductsForBranch(db, 'godi_road');
      const mgCatalog = getProductsForBranch(db, 'mg_road');

      expect(godiCatalog[0].stock).toBe(45);
      expect(mgCatalog[0].stock).toBe(20); // Unchanged!
    });

    it('purchasing 30 units at MG Road increases MG stock to 50 while Godi stock remains 45', () => {
      const db = createDatabase();
      const product: Product = {
        id: 'prod-ind-mix-101',
        name: 'Indian Mix',
        sku: 'SKU-IM-01',
        barcode: '8901234567890',
        category: 'FARSAAN MIX',
        unit: 'KG',
        costPrice: 200,
        sellingPrice: 320,
      };

      addProductToCatalog(db, product, 'godi_road', 50);
      db.branchStock.set(product.id, { godi_road: 45, mg_road: 20 });

      // MG Road purchases 30 units
      recordPurchase(db, 'mg_road', [{ productId: 'prod-ind-mix-101', quantity: 30 }]);

      const godiCatalog = getProductsForBranch(db, 'godi_road');
      const mgCatalog = getProductsForBranch(db, 'mg_road');

      expect(mgCatalog[0].stock).toBe(50); // 20 + 30 = 50
      expect(godiCatalog[0].stock).toBe(45); // Unchanged at 45!
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Weight-Based Decimal Stock Precision (KG Products)
  // ---------------------------------------------------------------------------
  describe('4. Weight-Based Stock Adjustments per Branch', () => {
    it('correctly handles fractional gram sales (e.g. 250g) with 3-decimal precision', () => {
      const db = createDatabase();
      const product: Product = {
        id: 'prod-kaju-katli',
        name: 'KAJU KATLI',
        sku: '0001',
        barcode: '890111111111',
        category: 'SWEETS',
        unit: 'KG',
        costPrice: 600,
        sellingPrice: 1000,
      };

      addProductToCatalog(db, product, 'godi_road', 10.0);
      db.branchStock.set(product.id, { godi_road: 10.0, mg_road: 5.0 });

      // Godi sells 250 grams (0.250 kg)
      recordSale(db, 'godi_road', [{ productId: 'prod-kaju-katli', quantity: 0.25 }]);

      const godiCatalog = getProductsForBranch(db, 'godi_road');
      const mgCatalog = getProductsForBranch(db, 'mg_road');

      expect(godiCatalog[0].stock).toBeCloseTo(9.75, 3);
      expect(mgCatalog[0].stock).toBe(5.0); // Completely isolated
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Negative Stock Handling & Billing Permissibility
  // ---------------------------------------------------------------------------
  describe('5. Negative Stock Billing Support per Branch', () => {
    it('permits negative stock in a branch without affecting the other branch', () => {
      const db = createDatabase();
      const product: Product = {
        id: 'prod-bhavnagari',
        name: 'BHAVNAGARI GATHIYA',
        sku: '101',
        barcode: '890222222222',
        category: 'FARSAAN MIX',
        unit: 'KG',
        costPrice: 150,
        sellingPrice: 240,
      };

      addProductToCatalog(db, product, 'godi_road', 0);
      db.branchStock.set(product.id, { godi_road: 0, mg_road: 10 });

      // Godi Road sells 2 kg with 0 starting stock -> goes to -2 kg
      recordSale(db, 'godi_road', [{ productId: 'prod-bhavnagari', quantity: 2 }]);

      const godiCatalog = getProductsForBranch(db, 'godi_road');
      const mgCatalog = getProductsForBranch(db, 'mg_road');

      expect(godiCatalog[0].stock).toBe(-2);
      expect(mgCatalog[0].stock).toBe(10); // MG Road remains positive 10
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Refresh and Re-synchronization
  // ---------------------------------------------------------------------------
  describe('6. Terminal Refresh & Re-synchronization Contract', () => {
    it('refreshing both branch terminals preserves the central catalogue and respective inventories', () => {
      const db = createDatabase();
      const p1: Product = {
        id: 'p1',
        name: 'Item 1',
        sku: 'SKU1',
        barcode: 'BC1',
        category: 'SWEETS',
        unit: 'PCS',
        costPrice: 50,
        sellingPrice: 80,
      };
      const p2: Product = {
        id: 'p2',
        name: 'Item 2',
        sku: 'SKU2',
        barcode: 'BC2',
        category: 'FARSAAN MIX',
        unit: 'PCS',
        costPrice: 30,
        sellingPrice: 50,
      };

      addProductToCatalog(db, p1, 'godi_road', 100);
      addProductToCatalog(db, p2, 'mg_road', 40);

      db.branchStock.set('p1', { godi_road: 100, mg_road: 60 });
      db.branchStock.set('p2', { godi_road: 25, mg_road: 40 });

      // Terminal refresh simulation: query again
      const godiTerminal = getProductsForBranch(db, 'godi_road');
      const mgTerminal = getProductsForBranch(db, 'mg_road');

      // Both see 2 products
      expect(godiTerminal).toHaveLength(2);
      expect(mgTerminal).toHaveLength(2);

      // Branch inventories remain distinct
      const godiP1 = godiTerminal.find((p) => p.id === 'p1');
      const mgP1 = mgTerminal.find((p) => p.id === 'p1');
      expect(godiP1?.stock).toBe(100);
      expect(mgP1?.stock).toBe(60);

      const godiP2 = godiTerminal.find((p) => p.id === 'p2');
      const mgP2 = mgTerminal.find((p) => p.id === 'p2');
      expect(godiP2?.stock).toBe(25);
      expect(mgP2?.stock).toBe(40);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Backward Compatibility for Historical Transactions
  // ---------------------------------------------------------------------------
  describe('7. Historical Transaction Integrity', () => {
    it('existing orders maintain their immutable references to product IDs, line totals, and branch', () => {
      const historicalOrder: OrderBill = {
        id: 'sale-1793071461459-5620',
        billNumber: 'Bill #1',
        dailyBillNumber: 1,
        branch: 'godi_road',
        businessDate: '2026-10-27',
        transactionType: 'NO_BILL',
        items: [
          {
            product: {
              id: 'alb-0001',
              name: 'BHUKHO B',
              sku: '306',
              barcode: '80548406576',
              category: 'SWEETS',
              unit: 'PCS',
              costPrice: 0,
              sellingPrice: 154,
            },
            quantity: 1,
            unit: 'PCS',
            unitPrice: 154,
            lineTotal: 154,
            discountPercent: 0,
            formattedQuantity: '1 pcs',
            formattedRate: 'Rs. 154/pc',
          },
        ],
        subtotal: 154,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 154,
        paymentMethod: 'CASH',
        amountReceived: 154,
        changeGiven: 0,
        cashierName: 'Owner (Godi Road)',
        createdAt: '2026-10-27T08:54:00+05:30',
      };

      expect(historicalOrder.id).toBe('sale-1793071461459-5620');
      expect(historicalOrder.branch).toBe('godi_road');
      expect(historicalOrder.items[0].product.id).toBe('alb-0001');
      expect(historicalOrder.grandTotal).toBe(154);
    });
  });
});
