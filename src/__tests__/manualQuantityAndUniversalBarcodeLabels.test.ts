import { describe, it, expect } from 'vitest';
import { 
  parseQuantityInput, 
  calculateEan13CheckDigit, 
  generateEan13Barcode, 
  buildCartItem, 
  isWeightBasedProduct 
} from '../lib/pricing';
import { Product, OrderBill } from '../types';

describe('Manual Quantity Input, Customer Credit Details & Universal Barcode Labels', () => {

  const weightProduct: Product = {
    id: 'prod-athol-mix',
    name: 'ATHOL MIX KM',
    sku: 'ATH-001',
    barcode: '890100801001',
    category: 'FARSAAN MIX',
    unit: 'KG',
    priceBasis: 'Rs./kg',
    costPrice: 200,
    sellingPrice: 320,
    stock: 50,
  };

  const pieceProduct: Product = {
    id: 'prod-cheesy-ball',
    name: 'DCUBE CHEESY BALL',
    sku: '38662573928',
    barcode: '38662573928',
    category: 'ROASTED',
    unit: 'PCS',
    priceBasis: 'Rs./pc',
    costPrice: 30,
    sellingPrice: 50,
    stock: 100,
  };

  // ─── 1. Manual Quantity Input Parsing (e.g. 300gm, 300g, 0.3kg, etc.) ───
  describe('1. Flexible Manual Quantity Parsing', () => {
    it('parses "300gm" correctly into 300g and 0.3kg', () => {
      const res = parseQuantityInput('300gm', true);
      expect(res.isValid).toBe(true);
      expect(res.grams).toBe(300);
      expect(res.quantity).toBe(0.3);
    });

    it('parses "300g" and "300 gm" correctly into 300g and 0.3kg', () => {
      const res1 = parseQuantityInput('300g', true);
      expect(res1.isValid).toBe(true);
      expect(res1.grams).toBe(300);
      expect(res1.quantity).toBe(0.3);

      const res2 = parseQuantityInput('300 gm', true);
      expect(res2.isValid).toBe(true);
      expect(res2.grams).toBe(300);
      expect(res2.quantity).toBe(0.3);
    });

    it('parses "300" (pure number without unit for weight product) as 300 grams', () => {
      const res = parseQuantityInput('300', true);
      expect(res.isValid).toBe(true);
      expect(res.grams).toBe(300);
      expect(res.quantity).toBe(0.3);
    });

    it('correctly calculates line total for 300gm of 320/kg item to be Rs. 96.00', () => {
      const parsed = parseQuantityInput('300gm', true);
      const cartItem = buildCartItem(weightProduct, parsed.quantity, parsed.grams, 0);
      expect(cartItem.formattedQuantity).toBe('300 g');
      expect(cartItem.lineTotal).toBe(96.00);
    });

    it('parses "0.3kg" and "0.3" as 300g', () => {
      const res1 = parseQuantityInput('0.3kg', true);
      expect(res1.isValid).toBe(true);
      expect(res1.grams).toBe(300);

      const res2 = parseQuantityInput('0.3', true);
      expect(res2.isValid).toBe(true);
      expect(res2.grams).toBe(300);
    });

    it('parses "1.5kg" as 1500g and 1.5kg', () => {
      const res = parseQuantityInput('1.5kg', true);
      expect(res.isValid).toBe(true);
      expect(res.grams).toBe(1500);
      expect(res.quantity).toBe(1.5);
    });

    it('parses count/piece products like "5" and "5 pcs"', () => {
      const res1 = parseQuantityInput('5', false);
      expect(res1.isValid).toBe(true);
      expect(res1.quantity).toBe(5);

      const res2 = parseQuantityInput('5 pcs', false);
      expect(res2.isValid).toBe(true);
      expect(res2.quantity).toBe(5);
    });

    it('rejects invalid or negative inputs', () => {
      expect(parseQuantityInput('', true).isValid).toBe(false);
      expect(parseQuantityInput('abc', true).isValid).toBe(false);
      expect(parseQuantityInput('-50g', true).isValid).toBe(false);
      expect(parseQuantityInput('0', true).isValid).toBe(false);
    });
  });

  // ─── 2. EAN-13 Generation & Universal Smartphone/Tablet Compatibility ───
  describe('2. EAN-13 Barcode Calculation and Generation', () => {
    it('correctly computes standard modulo-10 EAN-13 check digit for Indian barcodes', () => {
      // 890801235552 -> check digit should be 6
      expect(calculateEan13CheckDigit('890801235552')).toBe(6);
      // 890801235554 -> check digit should be 0
      expect(calculateEan13CheckDigit('890801235554')).toBe(0);
      // 890608034994 -> check digit should be 2
      expect(calculateEan13CheckDigit('890608034994')).toBe(2);
    });

    it('generates valid 13-digit EAN-13 barcode starting with 890 for future products', () => {
      const generated = generateEan13Barcode();
      expect(generated.length).toBe(13);
      expect(generated.startsWith('890')).toBe(true);

      // Verify checksum
      const base12 = generated.slice(0, 12);
      const expectedChecksum = calculateEan13CheckDigit(base12);
      expect(parseInt(generated[12], 10)).toBe(expectedChecksum);
    });
  });

  // ─── 3. Customer Name & Phone for Credit / Udhar Sales ───
  describe('3. Credit & No-Bill Customer Recording', () => {
    it('saves customer name and phone on credit / no-bill orders so debtor is known', () => {
      const order: OrderBill = {
        id: 'sale-test-1',
        billNumber: 'ALB-NB-1001',
        transactionType: 'NO_BILL',
        items: [buildCartItem(weightProduct, 0.3, 300, 0)],
        subtotal: 96,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 96,
        paymentMethod: 'CREDIT',
        amountReceived: 0,
        changeGiven: 0,
        dueAmount: 96,
        isSettled: false,
        customerName: 'Fatema Taiyebi',
        customerPhone: '9876543210',
        cashierName: 'Owner',
        createdAt: '22-Oct-2026, 01:30 PM',
      };

      expect(order.customerName).toBe('Fatema Taiyebi');
      expect(order.customerPhone).toBe('9876543210');
      expect(order.paymentMethod).toBe('CREDIT');
      expect(order.dueAmount).toBe(96);
    });
  });

});
