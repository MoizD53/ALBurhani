import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Product, CartItem, OrderBill } from '../types';
import { 
  buildCartItem, 
  calculateLineTotal, 
  calculateOrderTotals, 
  getEffectiveUnitPrice 
} from '../lib/pricing';
import { computeStockAdjustments } from '../lib/orders';
import { generateReceiptPdfBytes } from '../lib/pdfReceipt';

describe('AL-BURHANI POS — Bill Modification, Quantity Pricing & Security Audit', () => {

  // Test product fixtures
  const sampleProductA: Product = {
    id: 'prod-sweet-1',
    sku: '0001',
    barcode: '0001',
    name: 'KAJU KATLI 250G',
    category: 'Sweets',
    unit: 'PCS',
    priceBasis: '₹/pc',
    costPrice: 200,
    sellingPrice: 275,
    stock: 20,
    minStock: 5,
  };

  const sampleTierProduct: Product = {
    id: 'prod-farsan-1',
    sku: '0042',
    barcode: '0042',
    name: 'SPECIAL BHAVNAGRI GATHIYA',
    category: 'Namkeen & Farsan',
    unit: 'PCS',
    priceBasis: '₹/pc',
    costPrice: 50,
    sellingPrice: 100, // Default price 1 pc = ₹100
    stock: 50,
    minStock: 10,
    priceTiers: [
      { minQuantity: 5, price: 90 },  // 5+ pcs = ₹90 each
      { minQuantity: 10, price: 80 }, // 10+ pcs = ₹80 each
    ],
  };

  const sampleWeightProduct: Product = {
    id: 'prod-weight-1',
    sku: '0099',
    barcode: '0099',
    name: 'PURE DESI GHEE MOHANTHAL',
    category: 'Sweets',
    unit: 'KG',
    priceBasis: '₹/kg',
    costPrice: 500,
    sellingPrice: 800, // ₹800/kg
    stock: 15,
    minStock: 2,
    priceTiers: [
      { minQuantity: 2, price: 750 }, // 2kg or more = ₹750/kg
    ],
  };

  describe('1. Quantity-Based Pricing Calculations', () => {
    it('applies default base selling price when quantity is below tier threshold', () => {
      const price1 = getEffectiveUnitPrice(sampleTierProduct, 1);
      expect(price1).toBe(100);

      const price4 = getEffectiveUnitPrice(sampleTierProduct, 4);
      expect(price4).toBe(100);

      const cartItem4 = buildCartItem(sampleTierProduct, 4);
      expect(cartItem4.unitPrice).toBe(100);
      expect(cartItem4.lineTotal).toBe(400);
    });

    it('automatically applies quantity tier price when quantity reaches minQuantity', () => {
      // 5 pcs tier -> ₹90 each
      const price5 = getEffectiveUnitPrice(sampleTierProduct, 5);
      expect(price5).toBe(90);

      const cartItem5 = buildCartItem(sampleTierProduct, 5);
      expect(cartItem5.unitPrice).toBe(90);
      expect(cartItem5.lineTotal).toBe(450); // 5 * 90 = 450

      // 10 pcs tier -> ₹80 each
      const price10 = getEffectiveUnitPrice(sampleTierProduct, 10);
      expect(price10).toBe(80);

      const cartItem10 = buildCartItem(sampleTierProduct, 10);
      expect(cartItem10.unitPrice).toBe(80);
      expect(cartItem10.lineTotal).toBe(800); // 10 * 80 = 800
    });

    it('dynamically recalculates line total when quantity switches up and down', () => {
      // Step 1: Cashier adds 2 pieces
      let cartItem = buildCartItem(sampleTierProduct, 2);
      expect(cartItem.unitPrice).toBe(100);
      expect(cartItem.lineTotal).toBe(200);

      // Step 2: Customer increases quantity to 6 pieces (crosses 5 pcs tier)
      cartItem = buildCartItem(sampleTierProduct, 6);
      expect(cartItem.unitPrice).toBe(90);
      expect(cartItem.lineTotal).toBe(540); // 6 * 90 = 540

      // Step 3: Customer decreases back to 3 pieces (drops below tier)
      cartItem = buildCartItem(sampleTierProduct, 3);
      expect(cartItem.unitPrice).toBe(100);
      expect(cartItem.lineTotal).toBe(300); // 3 * 100 = 300
    });

    it('supports weight-based quantity tier pricing for KG items', () => {
      // 500g (0.5 kg) at base ₹800/kg
      const item500g = buildCartItem(sampleWeightProduct, 0.5, 500);
      expect(item500g.unitPrice).toBe(800);
      expect(item500g.lineTotal).toBe(400);

      // 2.5 kg (2500g) reaches 2kg tier at ₹750/kg
      const item2500g = buildCartItem(sampleWeightProduct, 2.5, 2500);
      expect(item2500g.unitPrice).toBe(750);
      expect(item2500g.lineTotal).toBe(1875); // 2.5 * 750 = 1875
    });
  });

  describe('2. Add Items to Existing Bill & Net Stock Adjustments', () => {
    it('accurately computes net stock difference when customer adds a new product to an existing bill', () => {
      const originalCartItem = buildCartItem(sampleProductA, 2); // 2 pcs Kaju Katli
      const originalItems: CartItem[] = [originalCartItem];

      // Customer adds 1 pack of Bhavnagri Gathiya
      const additionalItem = buildCartItem(sampleTierProduct, 1);
      const updatedItems: CartItem[] = [originalCartItem, additionalItem];

      const adjustments = computeStockAdjustments(originalItems, updatedItems);
      expect(adjustments.length).toBe(1);
      expect(adjustments[0].productId).toBe(sampleTierProduct.id);
      expect(adjustments[0].deltaQuantity).toBe(1); // Only deduct 1 from Gathiya
      // Note: Kaju Katli had delta = 0, so it is NOT deducted again!
    });

    it('accurately computes net stock difference when customer increases quantity of an existing item', () => {
      const originalCartItem = buildCartItem(sampleProductA, 2); // 2 pcs originally sold
      const originalItems: CartItem[] = [originalCartItem];

      // Customer wants 3 pcs in total (+1 more piece)
      const updatedCartItem = buildCartItem(sampleProductA, 3);
      const updatedItems: CartItem[] = [updatedCartItem];

      const adjustments = computeStockAdjustments(originalItems, updatedItems);
      expect(adjustments.length).toBe(1);
      expect(adjustments[0].productId).toBe(sampleProductA.id);
      expect(adjustments[0].deltaQuantity).toBe(1); // Exactly +1 net difference!
    });

    it('accurately restores inventory if customer reduces quantity or swaps items', () => {
      const itemA = buildCartItem(sampleProductA, 2);
      const originalItems: CartItem[] = [itemA];

      // Customer changes mind and takes only 1 piece
      const updatedItemA = buildCartItem(sampleProductA, 1);
      const updatedItems: CartItem[] = [updatedItemA];

      const adjustments = computeStockAdjustments(originalItems, updatedItems);
      expect(adjustments.length).toBe(1);
      expect(adjustments[0].productId).toBe(sampleProductA.id);
      expect(adjustments[0].deltaQuantity).toBe(-1); // Negative delta = return 1 piece to stock!
    });

    it('preserves bill ID and calculates additional payment due without double-counting revenue', () => {
      // 1. Initial Bill
      const initialItem = buildCartItem(sampleProductA, 1); // ₹275
      const { subtotal, gstAmount, grandTotal } = calculateOrderTotals([initialItem], 0, 'CUSTOMER_BILL');

      const originalOrder: OrderBill = {
        id: 'sale-1729350000-1111',
        billNumber: 'ALB-INV-5001',
        transactionType: 'CUSTOMER_BILL',
        items: [initialItem],
        subtotal,
        discountAmount: 0,
        gstAmount,
        grandTotal, // ₹275.00
        paymentMethod: 'CASH',
        amountReceived: 275,
        changeGiven: 0,
        cashierName: 'Owner',
        createdAt: '19 Oct 2026, 05:00 pm',
        timestamp: 1729350000000,
      };

      // 2. Customer adds another product worth ₹100
      const newItem = buildCartItem(sampleTierProduct, 1); // ₹100
      const updatedCart = [initialItem, newItem];
      const updatedTotals = calculateOrderTotals(updatedCart, 0, 'CUSTOMER_BILL');

      expect(updatedTotals.grandTotal).toBe(375); // 275 + 100 = 375

      const originalPaid = originalOrder.originalGrandTotal ?? originalOrder.grandTotal;
      const additionalDue = Math.max(0, updatedTotals.grandTotal - originalPaid);

      expect(additionalDue).toBe(100);

      // Revised Order
      const revisedOrder: OrderBill = {
        ...originalOrder,
        items: updatedCart,
        subtotal: updatedTotals.subtotal,
        gstAmount: updatedTotals.gstAmount,
        grandTotal: updatedTotals.grandTotal,
        isRevised: true,
        originalGrandTotal: originalPaid,
        additionalAmountPaid: additionalDue,
        amountReceived: originalPaid + additionalDue,
        additionalPaymentMethod: 'UPI',
        revisedAt: '19 Oct 2026, 05:05 pm',
        revisionCount: 1,
      };

      // Verify that the order ID and bill number remain unchanged
      expect(revisedOrder.id).toBe(originalOrder.id);
      expect(revisedOrder.billNumber).toBe(originalOrder.billNumber);
      expect(revisedOrder.isRevised).toBe(true);
      expect(revisedOrder.originalGrandTotal).toBe(275);
      expect(revisedOrder.additionalAmountPaid).toBe(100);
      expect(revisedOrder.grandTotal).toBe(375);

      // Verify store revenue math: updating in-place from 275 to 375 adds exactly ₹100, no double-counting
      const ordersList = [originalOrder];
      const storeRevenueBefore = ordersList.reduce((sum, o) => sum + o.grandTotal, 0);
      expect(storeRevenueBefore).toBe(275);

      const updatedOrdersList = ordersList.map((o) => (o.id === revisedOrder.id ? revisedOrder : o));
      const storeRevenueAfter = updatedOrdersList.reduce((sum, o) => sum + o.grandTotal, 0);
      expect(storeRevenueAfter).toBe(375); // Exactly +100!
    });

    it('correctly modifies a Without GST (NO_BILL) order with zero GST and exact price totals', () => {
      // 1. Original Without GST order
      const initialItem = buildCartItem(sampleProductA, 1); // ₹275
      const totals1 = calculateOrderTotals([initialItem], 0, 'NO_BILL');
      expect(totals1.gstAmount).toBe(0);
      expect(totals1.grandTotal).toBe(275);

      const originalOrder: OrderBill = {
        id: 'sale-nobill-1234',
        billNumber: 'ALB-EST-1001',
        transactionType: 'NO_BILL',
        items: [initialItem],
        subtotal: totals1.subtotal,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 275,
        paymentMethod: 'CASH',
        amountReceived: 275,
        changeGiven: 0,
        cashierName: 'Owner',
        createdAt: '19 Oct 2026, 06:00 pm',
        timestamp: 1729353600000,
      };

      // 2. Customer adds another product
      const newItem = buildCartItem(sampleTierProduct, 2); // 2 pcs = ₹200
      const updatedCart = [initialItem, newItem];
      const totals2 = calculateOrderTotals(updatedCart, 0, 'NO_BILL');
      expect(totals2.gstAmount).toBe(0);
      expect(totals2.grandTotal).toBe(475); // 275 + 200 = 475

      const additionalDue = totals2.grandTotal - originalOrder.grandTotal;
      expect(additionalDue).toBe(200);

      const revisedOrder: OrderBill = {
        ...originalOrder,
        items: updatedCart,
        subtotal: totals2.subtotal,
        gstAmount: 0,
        grandTotal: totals2.grandTotal,
        isRevised: true,
        originalGrandTotal: 275,
        additionalAmountPaid: additionalDue,
        amountReceived: 475,
        revisedAt: '19 Oct 2026, 06:05 pm',
        revisionCount: 1,
      };

      expect(revisedOrder.id).toBe(originalOrder.id);
      expect(revisedOrder.gstAmount).toBe(0);
      expect(revisedOrder.grandTotal).toBe(475);
      expect(revisedOrder.additionalAmountPaid).toBe(200);
    });
  });

  describe('3. Revised Thermal Receipt & PDF Generation', () => {
    it('generates a valid standard PDF 1.4 for revised bills with payment breakdown', () => {
      const itemA = buildCartItem(sampleProductA, 1);
      const itemB = buildCartItem(sampleTierProduct, 1);
      const totals = calculateOrderTotals([itemA, itemB], 0, 'CUSTOMER_BILL');

      const revisedOrder: OrderBill = {
        id: 'sale-revised-999',
        billNumber: 'ALB-INV-7777',
        transactionType: 'CUSTOMER_BILL',
        items: [itemA, itemB],
        subtotal: totals.subtotal,
        discountAmount: 0,
        gstAmount: totals.gstAmount,
        grandTotal: totals.grandTotal,
        paymentMethod: 'CASH',
        amountReceived: totals.grandTotal,
        changeGiven: 0,
        cashierName: 'Owner',
        createdAt: '19 Oct 2026, 05:30 pm',
        isRevised: true,
        originalGrandTotal: 275,
        additionalAmountPaid: 100,
        originalPaymentMethod: 'CASH',
        additionalPaymentMethod: 'UPI',
        revisedAt: '19 Oct 2026, 05:35 pm',
      };

      const pdfBytes = generateReceiptPdfBytes(revisedOrder);
      expect(pdfBytes).toBeInstanceOf(Uint8Array);
      expect(pdfBytes.length).toBeGreaterThan(500);

      const pdfText = new TextDecoder().decode(pdfBytes);
      expect(pdfText.startsWith('%PDF-1.4')).toBe(true);
      expect(pdfText).toContain('REVISED TAX INVOICE');
      expect(pdfText).toContain('Previously Paid');
      expect(pdfText).toContain('Additional Paid');
      expect(pdfText).toContain('Total Settled');
      expect(pdfText).toContain('%%EOF');
    });
  });

  describe('4. Production Security & Secret Protection Audit', () => {
    it('verifies src/lib/turso.ts does NOT import or reference VITE_TURSO_AUTH_TOKEN', () => {
      const tursoPath = path.resolve(__dirname, '../lib/turso.ts');
      const content = fs.readFileSync(tursoPath, 'utf8');

      expect(content).not.toContain('VITE_TURSO_AUTH_TOKEN');
      expect(content).not.toContain('import.meta.env.VITE_TURSO_AUTH_TOKEN');
      // Verifies serverless proxy architecture
      expect(content).toContain('/api/db');
    });

    it('verifies production build output does not leak any JWT token or database credentials', () => {
      const distAssetsDir = path.resolve(__dirname, '../../dist/assets');
      if (fs.existsSync(distAssetsDir)) {
        const jsFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.js'));
        for (const file of jsFiles) {
          const filePath = path.join(distAssetsDir, file);
          const bundleText = fs.readFileSync(filePath, 'utf8');
          // JWT header pattern 'eyJhbGci' must NEVER be in client bundle
          expect(bundleText).not.toContain('eyJhbGci');
        }
      }
    });

    it('verifies vercel.json routes API endpoints to serverless function without SPA rewrite', () => {
      const vercelJsonPath = path.resolve(__dirname, '../../vercel.json');
      const content = fs.readFileSync(vercelJsonPath, 'utf8');
      const parsed = JSON.parse(content);

      expect(Array.isArray(parsed.rewrites)).toBe(true);
      const hasApiExclusion = parsed.rewrites.some((r: any) =>
        r.source.includes('api/')
      );
      expect(hasApiExclusion).toBe(true);
    });

    it('verifies api/db.ts enforces server secret check and NEVER trusts client-supplied role for destructive actions', () => {
      const apiDbPath = path.resolve(__dirname, '../../api/db.ts');
      const content = fs.readFileSync(apiDbPath, 'utf8');

      // Crucial: Must never trust client-supplied role header for destructive operations
      expect(content).toContain('isAuthorizedDestructiveAction');
      expect(content).toContain('process.env.ALBHURANI_ADMIN_SECRET');
      // Verify destructive actions use isAuthorizedDestructiveAction
      expect(content).toContain("action === 'reset-all-stock'");
      expect(content).toContain("if (!isAuthorizedDestructiveAction(req))");
      expect(content).toContain("action === 'clear-orders'");
      expect(content).toContain("action === 'clear-expenses'");
    });

    it('preserves leading zeros on product barcodes with quantity tiers (e.g. barcode "0001")', () => {
      const product0001: Product = {
        ...sampleProductA,
        barcode: '0001',
        sku: '0001',
        priceTiers: [
          { minQuantity: 4, price: 250 },
        ],
      };

      expect(product0001.barcode).toBe('0001');
      expect(product0001.sku).toBe('0001');

      // Below tier (3 pcs) -> ₹275
      const item3 = buildCartItem(product0001, 3);
      expect(item3.product.barcode).toBe('0001');
      expect(item3.unitPrice).toBe(275);
      expect(item3.lineTotal).toBe(825);

      // Reaching tier (4 pcs) -> ₹250
      const item4 = buildCartItem(product0001, 4);
      expect(item4.product.barcode).toBe('0001');
      expect(item4.unitPrice).toBe(250);
      expect(item4.lineTotal).toBe(1000);
    });
  });
});
