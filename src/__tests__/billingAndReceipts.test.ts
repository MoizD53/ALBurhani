import { describe, it, expect } from 'vitest';
import { calculateOrderTotals, buildCartItem } from '../lib/pricing';
import { generateReceiptPdfBytes } from '../lib/pdfReceipt';
import { Product, OrderBill } from '../types';

describe('AL-BHURANI POS — Billing Modes, GST-Inclusive Calculations & Receipts', () => {
  const sampleProduct60: Product = {
    id: 'prod-60',
    sku: 'SKU-060',
    barcode: '890123400060',
    name: 'Standard Sweet Box',
    category: 'Sweets',
    unit: 'PCS',
    costPrice: 40,
    sellingPrice: 60,
    stock: 50,
    minStock: 5,
  };

  const sampleWeightProduct800: Product = {
    id: 'prod-800',
    sku: 'SKU-800',
    barcode: '890123400800',
    name: 'Kaju Katli Special',
    category: 'Sweets',
    unit: 'KG',
    costPrice: 550,
    sellingPrice: 800,
    stock: 25.5,
    minStock: 2,
  };

  describe('1. Additional Critical Requirement — GST-Inclusive Pricing', () => {
    it('verifies that a displayed ₹60 item remains ₹60 in With GST mode with ~₹2.86 included GST', () => {
      const cart = [buildCartItem(sampleProduct60, 1)];
      const result = calculateOrderTotals(cart, 0, 'CUSTOMER_BILL', 0.05);

      // Customer's total for one unit MUST remain ₹60.00, not ₹63.00
      expect(result.grandTotal).toBe(60);
      expect(result.subtotal).toBe(60);
      expect(result.netAmount).toBe(60);

      // Taxable value = 60 / 1.05 = ₹57.14 (approximately)
      expect(result.taxableAmount).toBe(57.14);

      // Included GST = 60 - 57.14 = ₹2.86 (approximately)
      expect(result.gstAmount).toBe(2.86);

      // CGST (2.5%) + SGST (2.5%) sum to included GST
      expect(result.cgstAmount).toBe(1.43);
      expect(result.sgstAmount).toBe(1.43);
      expect(result.cgstAmount + result.sgstAmount).toBe(2.86);
      expect(result.taxableAmount + result.gstAmount).toBe(60);
    });

    it('verifies that Without GST mode also totals ₹60 with 0% GST', () => {
      const cart = [buildCartItem(sampleProduct60, 1)];
      const result = calculateOrderTotals(cart, 0, 'NO_BILL');

      // Customer pays catalog price without GST addition or calculation
      expect(result.grandTotal).toBe(60);
      expect(result.subtotal).toBe(60);
      expect(result.netAmount).toBe(60);
      expect(result.taxableAmount).toBe(60);
      expect(result.gstAmount).toBe(0);
      expect(result.cgstAmount).toBe(0);
      expect(result.sgstAmount).toBe(0);
    });

    it('handles multiple items and quantities consistently with paise-level rounding', () => {
      // 250g of ₹800/kg = ₹200.00
      // 2 pcs of ₹60 = ₹120.00
      // Total = ₹320.00
      const item1 = buildCartItem(sampleWeightProduct800, 0.25, 250);
      const item2 = buildCartItem(sampleProduct60, 2);
      expect(item1.lineTotal).toBe(200);
      expect(item2.lineTotal).toBe(120);

      const result = calculateOrderTotals([item1, item2], 0, 'CUSTOMER_BILL', 0.05);
      expect(result.subtotal).toBe(320);
      expect(result.grandTotal).toBe(320);

      // 320 / 1.05 = 304.7619 -> 304.76
      expect(result.taxableAmount).toBe(304.76);
      // 320 - 304.76 = 15.24
      expect(result.gstAmount).toBe(15.24);
      expect(result.taxableAmount + result.gstAmount).toBe(320);
    });

    it('ensures discounts do not cause GST to be added on top', () => {
      // 10% discount on ₹100 subtotal
      const mockProduct100: Product = {
        ...sampleProduct60,
        sellingPrice: 100,
      };
      const cart = [buildCartItem(mockProduct100, 1)];
      const result = calculateOrderTotals(cart, 10, 'CUSTOMER_BILL', 0.05);

      expect(result.subtotal).toBe(100);
      expect(result.discountAmount).toBe(10);
      expect(result.netAmount).toBe(90);
      // Customer pays net amount ₹90, NOT ₹90 + 4.50
      expect(result.grandTotal).toBe(90);

      // 90 / 1.05 = 85.71
      expect(result.taxableAmount).toBe(85.71);
      expect(result.gstAmount).toBe(4.29);
      expect(result.taxableAmount + result.gstAmount).toBe(90);
    });
  });

  describe('2. PDF Receipt Generation Verification', () => {
    it('generates a valid standard PDF 1.4 binary buffer for With GST receipts', () => {
      const cart = [buildCartItem(sampleProduct60, 1)];
      const calc = calculateOrderTotals(cart, 0, 'CUSTOMER_BILL', 0.05);

      const testOrder: OrderBill = {
        id: 'sale-test-1',
        billNumber: 'ALB-INV-8891',
        transactionType: 'CUSTOMER_BILL',
        items: cart,
        subtotal: calc.subtotal,
        discountAmount: calc.discountAmount,
        gstAmount: calc.gstAmount,
        grandTotal: calc.grandTotal,
        paymentMethod: 'CASH',
        amountReceived: 100,
        changeGiven: 40,
        customerName: 'Aarav Patel',
        customerPhone: '9876543210',
        cashierName: 'Owner',
        createdAt: '19 Oct 2026, 06:30 PM',
      };

      const bytes = generateReceiptPdfBytes(testOrder);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBeGreaterThan(500);

      const pdfText = new TextDecoder('latin1').decode(bytes);
      // Valid PDF 1.4 Header & Trailer
      expect(pdfText.startsWith('%PDF-1.4')).toBe(true);
      expect(pdfText.includes('%%EOF')).toBe(true);
      expect(pdfText.includes('ALB-INV-8891')).toBe(true);
      expect(pdfText.includes('AL-BHURANI')).toBe(true);
      expect(pdfText.includes('Standard Sweet Box')).toBe(true);
      expect(pdfText.includes('TAX INVOICE \\(GST INCLUSIVE\\)')).toBe(true);
      expect(pdfText.includes('Included 5% GST')).toBe(true);
      expect(pdfText.includes('Rs. 60.00')).toBe(true);
    });

    it('generates a valid standard PDF 1.4 binary buffer for Without GST receipts', () => {
      const cart = [buildCartItem(sampleProduct60, 1)];
      const calc = calculateOrderTotals(cart, 0, 'NO_BILL');

      const testOrder: OrderBill = {
        id: 'sale-test-2',
        billNumber: 'ALB-NB-4412',
        transactionType: 'NO_BILL',
        items: cart,
        subtotal: calc.subtotal,
        discountAmount: calc.discountAmount,
        gstAmount: calc.gstAmount,
        grandTotal: calc.grandTotal,
        paymentMethod: 'UPI',
        amountReceived: 60,
        changeGiven: 0,
        cashierName: 'Owner',
        createdAt: '19 Oct 2026, 06:35 PM',
      };

      const bytes = generateReceiptPdfBytes(testOrder);
      const pdfText = new TextDecoder('latin1').decode(bytes);
      expect(pdfText.startsWith('%PDF-1.4')).toBe(true);
      expect(pdfText.includes('%%EOF')).toBe(true);
      expect(pdfText.includes('ALB-NB-4412')).toBe(true);
      expect(pdfText.includes('RETAIL SALE MEMO \\(0% GST\\)')).toBe(true);
      expect(pdfText.includes('Rs. 60.00')).toBe(true);
    });
  });
});
