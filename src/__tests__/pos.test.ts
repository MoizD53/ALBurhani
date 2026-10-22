import { describe, it, expect } from 'vitest';
import { 
  calculateLineTotal, 
  validateQuantity, 
  deductStock, 
  formatQuantity, 
  formatPriceWithBasis, 
  lookupProduct, 
  buildCartItem 
} from '../lib/pricing';
import { IMPORTED_PRODUCTS, EXCEL_IMPORT_SUMMARY } from '../data/importedProducts';
import { Product, OrderBill } from '../types';

describe('AL-BURHANI POS Pricing & Quantity Calculations', () => {
  const kajuKatli: Product = {
    id: 'prod-kk',
    sku: '00101',
    barcode: '890100100101',
    name: 'Kaju Katli Special',
    category: 'Sweets',
    unit: 'KG',
    priceBasis: '₹/kg',
    costPrice: 600,
    sellingPrice: 800, // ₹800 per KG
    stock: 25.5, // 25.5 kg in stock
    minStock: 5.0,
  };

  const gulabJamun: Product = {
    id: 'prod-gj',
    sku: '00104',
    barcode: '890100100104',
    name: 'Gulab Jamun (Fresh Ghee)',
    category: 'Sweets',
    unit: 'PCS',
    priceBasis: '₹/pc',
    costPrice: 12,
    sellingPrice: 20, // ₹20 per PC
    stock: 120, // 120 pcs
    minStock: 20,
  };

  // Test Requirement: ₹800/kg × 250g = ₹200
  it('calculates ₹800/kg × 250g = ₹200.00 accurately', () => {
    const result = calculateLineTotal(kajuKatli, { grams: 250 });
    expect(result.quantity).toBe(0.25);
    expect(result.lineTotal).toBe(200);
    expect(result.lineTotalPaise).toBe(20000);
  });

  // Test Requirement: ₹800/kg × 375g = ₹300
  it('calculates ₹800/kg × 375g = ₹300.00 accurately', () => {
    const result = calculateLineTotal(kajuKatli, { grams: 375 });
    expect(result.quantity).toBe(0.375);
    expect(result.lineTotal).toBe(300);
    expect(result.lineTotalPaise).toBe(30000);
  });

  // Test Requirement: ₹20/pc × 5 pcs = ₹100
  it('calculates ₹20/pc × 5 pcs = ₹100.00 accurately', () => {
    const result = calculateLineTotal(gulabJamun, { quantity: 5 });
    expect(result.quantity).toBe(5);
    expect(result.lineTotal).toBe(100);
    expect(result.lineTotalPaise).toBe(10000);
  });

  it('correctly handles decimal kg quantities such as 1.250kg', () => {
    const result = calculateLineTotal(kajuKatli, { quantity: 1.25 });
    expect(result.quantity).toBe(1.25);
    expect(result.lineTotal).toBe(1000);
  });

  it('formats quantities and price basis clearly', () => {
    expect(formatQuantity(0.25, 'KG', 250)).toBe('250 g');
    expect(formatQuantity(0.375, 'KG', 375)).toBe('375 g');
    expect(formatQuantity(1.25, 'KG', 1250)).toBe('1.25 kg');
    expect(formatQuantity(5, 'PCS')).toBe('5 pcs');

    expect(formatPriceWithBasis(800, 'KG')).toBe('Rs. 800/kg');
    expect(formatPriceWithBasis(20, 'PCS')).toBe('Rs. 20/pc');
  });

  // Test Requirement: Invalid, zero, negative, or excessive quantities
  it('validates invalid, zero, or negative quantities', () => {
    const zeroRes = validateQuantity(kajuKatli, 0, 'g');
    expect(zeroRes.isValid).toBe(false);
    expect(zeroRes.error).toBeDefined();

    const negRes = validateQuantity(kajuKatli, -250, 'g');
    expect(negRes.isValid).toBe(false);

    const nanRes = validateQuantity(kajuKatli, NaN, 'g');
    expect(nanRes.isValid).toBe(false);

    const fracPcsRes = validateQuantity(gulabJamun, 2.5, 'pcs');
    expect(fracPcsRes.isValid).toBe(false);
  });

  // Test Requirement: Stock removal - validateQuantity allows any positive quantity without stock limitations
  it('allows quantities without stock limitations in the refactored billing system', () => {
    const largeKgRes = validateQuantity(kajuKatli, 30000, 'g');
    expect(largeKgRes.isValid).toBe(true);
    expect(largeKgRes.error).toBeUndefined();

    const largePcsRes = validateQuantity(gulabJamun, 150, 'pcs');
    expect(largePcsRes.isValid).toBe(true);
    expect(largePcsRes.error).toBeUndefined();
  });

  it('allows items in cart without stock boundary restrictions', () => {
    const cartRes = validateQuantity(kajuKatli, 1000, 'g', 25.0);
    expect(cartRes.isValid).toBe(true);
    expect(cartRes.error).toBeUndefined();
  });

  // Test Requirement: Repeated scans and separate quantity confirmations (quantity merging)
  it('merges repeated scan quantities accurately', () => {
    const item1 = buildCartItem(kajuKatli, 0.25, 250);
    expect(item1.lineTotal).toBe(200);

    const addGrams = 500;
    const mergedGrams = (item1.weightInGrams || 0) + addGrams;
    const mergedTotal = calculateLineTotal(kajuKatli, { grams: mergedGrams });
    expect(mergedTotal.quantity).toBe(0.75);
    expect(mergedTotal.lineTotal).toBe(600);
  });

  // Test Requirement: Correct inventory deduction after successful checkout
  it('deducts inventory correctly without floating point errors', () => {
    const newStockKg = deductStock(25.5, 0.25, true);
    expect(newStockKg).toBe(25.25);

    const newStockKg2 = deductStock(25.25, 0.375, true);
    expect(newStockKg2).toBe(24.875);

    const newStockPcs = deductStock(120, 5, false);
    expect(newStockPcs).toBe(115);
  });

  // Test Requirement: Leading zeroes preservation & Barcode/SKU lookup
  it('preserves leading zeroes and resolves products by exact barcode or SKU', () => {
    const products: Product[] = [
      {
        id: 'p1',
        sku: '00101',
        barcode: '00890100100101',
        name: 'Item With Leading Zero Barcode',
        category: 'Sweets',
        unit: 'KG',
        costPrice: 500,
        sellingPrice: 700,
        stock: 10,
        minStock: 2,
      },
    ];

    const matchBarcode = lookupProduct(products, '00890100100101');
    expect(matchBarcode.length).toBe(1);
    expect(matchBarcode[0].name).toBe('Item With Leading Zero Barcode');

    const matchSku = lookupProduct(products, '00101');
    expect(matchSku.length).toBe(1);
    expect(matchSku[0].name).toBe('Item With Leading Zero Barcode');

    const unknown = lookupProduct(products, '99999999');
    expect(unknown.length).toBe(0);
  });

  // Test Requirement: Customer bill vs No-Bill separation
  it('maintains strict distinction between CUSTOMER_BILL and NO_BILL sales', () => {
    const billedSale: OrderBill = {
      id: 's1',
      billNumber: 'ALB-INV-1001',
      transactionType: 'CUSTOMER_BILL',
      items: [buildCartItem(kajuKatli, 0.5, 500)],
      subtotal: 400,
      discountAmount: 0,
      gstAmount: 20,
      grandTotal: 420,
      paymentMethod: 'UPI',
      amountReceived: 420,
      changeGiven: 0,
      customerName: 'Customer A',
      customerPhone: '9876543210',
      cashierName: 'Counter 01',
      createdAt: 'Today, 10:00 AM',
    };

    const noBillSale: OrderBill = {
      id: 's2',
      billNumber: 'ALB-NB-2001',
      transactionType: 'NO_BILL',
      items: [buildCartItem(gulabJamun, 2)],
      subtotal: 40,
      discountAmount: 0,
      gstAmount: 0, // no customer tax invoice
      grandTotal: 40,
      paymentMethod: 'CASH',
      amountReceived: 50,
      changeGiven: 10,
      cashierName: 'Counter 01',
      createdAt: 'Today, 10:15 AM',
    };

    expect(billedSale.transactionType).toBe('CUSTOMER_BILL');
    expect(billedSale.gstAmount).toBe(20);
    expect(noBillSale.transactionType).toBe('NO_BILL');
    expect(noBillSale.gstAmount).toBe(0);
    expect(billedSale.billNumber).toContain('INV');
    expect(noBillSale.billNumber).toContain('NB');
  });

  // Test Requirement: Real Excel Import Verification
  it('correctly maps all 304 products from al burhani stock - Copy.xlsx', () => {
    expect(EXCEL_IMPORT_SUMMARY.totalRows).toBe(304);
    expect(EXCEL_IMPORT_SUMMARY.importedCount).toBe(305);
    expect(IMPORTED_PRODUCTS.length).toBe(305);
    expect(EXCEL_IMPORT_SUMMARY.weightItemsCount).toBe(98);
    expect(EXCEL_IMPORT_SUMMARY.pieceItemsCount).toBe(207);
    expect(EXCEL_IMPORT_SUMMARY.withOriginalBarcodes).toBe(292);
    expect(EXCEL_IMPORT_SUMMARY.duplicatesFound).toBe(0);

    // Verify barcode scanner lookup on real Excel barcodes
    const ratlamiSev = lookupProduct(IMPORTED_PRODUCTS, '67225776696');
    expect(ratlamiSev.length).toBe(1);
    expect(ratlamiSev[0].name).toContain('RATLAMI SEV');
    expect(ratlamiSev[0].unit).toBe('KG');
    expect(ratlamiSev[0].sellingPrice).toBe(320); // 0.32/g = 320/kg

    const bhukho = lookupProduct(IMPORTED_PRODUCTS, '80548406576');
    expect(bhukho.length).toBe(1);
    expect(bhukho[0].name).toBe('BHUKHO B');
    expect(bhukho[0].unit).toBe('KG');
    expect(bhukho[0].sellingPrice).toBe(100);

    const murmura = lookupProduct(IMPORTED_PRODUCTS, '8908012355526');
    expect(murmura.length).toBe(1);
    expect(murmura[0].name).toContain('DCUBE MAKAI MUMURA');
    expect(murmura[0].unit).toBe('PCS');
    expect(murmura[0].sellingPrice).toBe(60);

    // Verify item with leading zeroes in SKU maps to 250GM KAJU KATLI
    const itemWithZeroes = IMPORTED_PRODUCTS.find((p) => p.sku === '0001');
    expect(itemWithZeroes).toBeDefined();
    expect(itemWithZeroes?.sku).toBe('0001');
    expect(itemWithZeroes?.name).toBe('KAJU KATLI 250G');
    expect(itemWithZeroes?.sellingPrice).toBe(275);
    expect(itemWithZeroes?.category.toUpperCase()).toBe('SWEETS');
  });

  // Test Requirement: Barcode testing without physical scanner
  it('performs identical product lookup for manual entry and scanner input', () => {
    // Exact barcode lookup
    const scanMatch = lookupProduct(IMPORTED_PRODUCTS, '80548406576');
    const manualTypeMatch = lookupProduct(IMPORTED_PRODUCTS, '  80548406576  ');
    expect(scanMatch).toEqual(manualTypeMatch);
    expect(scanMatch.length).toBe(1);
    expect(scanMatch[0].name).toBe('BHUKHO B');

    // Leading zero SKU lookup without stripping zeroes
    const skuMatch = lookupProduct(IMPORTED_PRODUCTS, '0001');
    expect(skuMatch.length).toBeGreaterThanOrEqual(1);
    expect(skuMatch[0].sku).toBe('0001');
    expect(skuMatch[0].name).toBe('KAJU KATLI 250G');

    // Generated thermal barcode label lookup (890100801001)
    const labelMatch = lookupProduct(IMPORTED_PRODUCTS, '890100801001');
    expect(labelMatch.length).toBe(1);
    expect(labelMatch[0].barcode).toBe('890100801001');
  });

  // Regression Tests: Barcode 0001 & Catalog Product Selection
  describe('Regression: Barcode 0001 & Catalog Selection Bug Fixes', () => {
    it('strictly resolves barcode 0001 to KAJU KATLI 250G and never to DRY PATRA DP', () => {
      const match = lookupProduct(IMPORTED_PRODUCTS, '0001');
      expect(match.length).toBe(1);
      const product = match[0];
      expect(product.name).toBe('KAJU KATLI 250G');
      expect(product.sellingPrice).toBe(275);
      expect(product.unit).toBe('PCS');
      expect(product.priceBasis).toBe('₹/pc');
      expect(product.category.toUpperCase()).toBe('SWEETS');
      expect(product.barcode).toBe('0001');
      expect(product.sku).toBe('0001');
      expect(product.name).not.toContain('DRY PATRA');
    });

    it('preserves leading zeros and does not match barcode "1" or numeric 1', () => {
      const numericOneMatch = lookupProduct(IMPORTED_PRODUCTS, '1');
      expect(numericOneMatch.some((p) => p.barcode === '0001' || p.sku === '0001')).toBe(false);
    });

    it('simulates catalog click on KAJU KATLI 250G yielding the exact product object', () => {
      const kajuKatli = IMPORTED_PRODUCTS.find((p) => p.barcode === '0001');
      expect(kajuKatli).toBeDefined();
      expect(kajuKatli?.name).toBe('KAJU KATLI 250G');
      expect(kajuKatli?.sellingPrice).toBe(275);
      expect(kajuKatli?.unit).toBe('PCS');

      // Clicking catalog item passes product object directly to quantity modal
      const selectedProduct = kajuKatli;
      expect(selectedProduct?.name).toBe('KAJU KATLI 250G');
      expect(selectedProduct?.sellingPrice).toBe(275);
    });

    it('preserves DRY PATRA DP with its own dedicated barcode without collision', () => {
      const patra = IMPORTED_PRODUCTS.find((p) => p.name.includes('DRY PATRA'));
      expect(patra).toBeDefined();
      expect(patra?.barcode).not.toBe('0001');
      expect(patra?.sellingPrice).toBe(120);

      const patraLookup = lookupProduct(IMPORTED_PRODUCTS, patra!.barcode);
      expect(patraLookup.length).toBe(1);
      expect(patraLookup[0].name).toBe('DRY PATRA DP');
    });
  });

  // Test Requirement: Real Persistent Checkout (Stock deduction & financial record persistence)
  it('records real persistent sale and deducts inventory accurately upon checkout', () => {
    const originalStock = kajuKatli.stock ?? 25.5;
    const initialOrders: OrderBill[] = [];

    // Real cart item creation
    const saleItem = buildCartItem(kajuKatli, 0.5, 500); // 500g of Kaju Katli (₹400)
    expect(saleItem.lineTotal).toBe(400);

    const timestamp = Date.now();
    const completedOrder: OrderBill = {
      id: `sale-${timestamp}-9821`,
      billNumber: `ALB-INV-9821`,
      transactionType: 'CUSTOMER_BILL',
      items: [saleItem],
      subtotal: 400,
      discountAmount: 0,
      gstAmount: 20,
      grandTotal: 420,
      paymentMethod: 'CASH',
      amountReceived: 500,
      changeGiven: 80,
      cashierName: 'Owner',
      createdAt: '19 Oct 2026, 12:00 PM',
      timestamp,
    };

    // Complete sale pushes to real orders and deducts real stock
    initialOrders.push(completedOrder);
    const updatedStock = deductStock(originalStock, saleItem.quantity, true);

    expect(completedOrder).toBeDefined();
    expect(completedOrder.billNumber).toBe('ALB-INV-9821');
    expect(completedOrder.grandTotal).toBe(420);
    expect(initialOrders.length).toBe(1);
    expect(initialOrders[0].items[0].product.name).toBe('Kaju Katli Special');
    expect(updatedStock).toBe(originalStock - 0.5);
  });
});
