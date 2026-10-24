import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportToCsv, formatDisplayBillNumber, resolveDailyBillNumber } from '../lib/utils';
import { buildCartItem, calculateLineTotal } from '../lib/pricing';
import { Product, OrderBill, CartItem } from '../types';

describe('Multi-Bill, Manual Edit, CSV Export, and Clean Bill Numbering', () => {
  const sampleProductWeight: Product = {
    id: 'prod-patra-1',
    sku: 'ALB-0010',
    barcode: '8901234567890',
    name: 'PATRA BOIL',
    category: 'FARSAAN MIX',
    sellingPrice: 200, // Rs 200 per kg
    costPrice: 150,
    unit: 'KG',
    stock: 25,
    minStock: 5,
  };

  const sampleProductPiece: Product = {
    id: 'prod-samosa-1',
    sku: 'ALB-0020',
    barcode: '8901234567891',
    name: 'PUNJABI SAMOSA',
    category: 'SNACKS',
    sellingPrice: 25, // Rs 25 per piece
    costPrice: 18,
    unit: 'PCS',
    stock: 50,
    minStock: 10,
  };

  describe('1. Clean Bill Numbering Display (No ALB- prefixes in UI)', () => {
    it('formats display bill as clean "Bill #1" when dailyBillNumber is present', () => {
      const order: OrderBill = {
        id: 'ord-123',
        billNumber: 'ALB-NB-9395',
        dailyBillNumber: 14,
        businessDate: '2026-10-24',
        transactionType: 'NO_BILL',
        items: [],
        subtotal: 100,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 100,
        paymentMethod: 'CASH',
        amountReceived: 100,
        changeGiven: 0,
        dueAmount: 0,
        isSettled: true,
        cashierName: 'Owner',
        createdAt: '24/10/2026, 04:30 pm',
        timestamp: 1792840200000,
      };

      const display = formatDisplayBillNumber(order);
      expect(display).toBe('Bill #14');
      expect(display).not.toContain('ALB');
      expect(display).not.toContain('NB');
    });

    it('falls back to chronological sequence without exposing internal ID', () => {
      const order1: OrderBill = {
        id: 'ord-1',
        billNumber: 'ALB-NB-1111',
        businessDate: '2026-10-24',
        transactionType: 'NO_BILL',
        items: [],
        subtotal: 50,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 50,
        paymentMethod: 'CASH',
        amountReceived: 50,
        changeGiven: 0,
        dueAmount: 0,
        isSettled: true,
        cashierName: 'Owner',
        createdAt: '24/10/2026, 10:00 am',
        timestamp: 1000,
      };

      const order2: OrderBill = {
        id: 'ord-2',
        billNumber: 'ALB-NB-2222',
        businessDate: '2026-10-24',
        transactionType: 'NO_BILL',
        items: [],
        subtotal: 80,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 80,
        paymentMethod: 'CASH',
        amountReceived: 80,
        changeGiven: 0,
        dueAmount: 0,
        isSettled: true,
        cashierName: 'Owner',
        createdAt: '24/10/2026, 10:15 am',
        timestamp: 2000,
      };

      expect(formatDisplayBillNumber(order1, [order1, order2])).toBe('Bill #1');
      expect(formatDisplayBillNumber(order2, [order1, order2])).toBe('Bill #2');
    });
  });

  describe('2. Manual Item Edit & Custom Rate Overrides', () => {
    it('builds cart item with default price when no custom rate is specified', () => {
      const item = buildCartItem(sampleProductWeight, 0.5, 500);
      expect(item.quantity).toBe(0.5);
      expect(item.weightInGrams).toBe(500);
      expect(item.unitPrice).toBe(200);
      expect(item.lineTotal).toBe(100); // 0.5kg * 200 = 100
    });

    it('builds cart item with custom unit price override', () => {
      // Selling at special rate Rs 180/kg instead of catalog Rs 200/kg
      const item = buildCartItem(sampleProductWeight, 0.5, 500, 0, 180);
      expect(item.quantity).toBe(0.5);
      expect(item.unitPrice).toBe(180);
      expect(item.lineTotal).toBe(90); // 0.5kg * 180 = 90
    });

    it('calculates exact grams and line total when entering ₹ amount', () => {
      // Customer asks: "Give me Rs 50 worth of Patra Boil" (Catalog rate: Rs 200/kg)
      const targetRupees = 50;
      const ratePerKg = sampleProductWeight.sellingPrice;
      const calculatedKg = targetRupees / ratePerKg; // 0.25 kg
      const calculatedGrams = Math.round(calculatedKg * 1000); // 250 grams

      const item = buildCartItem(sampleProductWeight, calculatedKg, calculatedGrams);
      expect(item.weightInGrams).toBe(250);
      expect(item.quantity).toBe(0.25);
      expect(item.lineTotal).toBe(50);
    });

    it('supports piece item manual quantity and rate override', () => {
      // 4 pieces samosa at discounted unit rate Rs 22 instead of Rs 25
      const item = buildCartItem(sampleProductPiece, 4, undefined, 0, 22);
      expect(item.quantity).toBe(4);
      expect(item.unitPrice).toBe(22);
      expect(item.lineTotal).toBe(88); // 4 * 22 = 88
    });
  });

  describe('3. CSV Export Functionality', () => {
    let createdBlob: any = null;
    let appendedLink: any = null;

    beforeEach(() => {
      createdBlob = null;
      appendedLink = null;

      // Mock Blob
      (globalThis as any).Blob = class MockBlob {
        content: any[];
        options: any;
        constructor(content: any[], options: any) {
          this.content = content;
          this.options = options;
          createdBlob = this;
        }
      } as any;

      // Mock URL.createObjectURL and revokeObjectURL
      (globalThis as any).URL = {
        createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
        revokeObjectURL: vi.fn(),
      };

      // Mock document and body methods
      (globalThis as any).document = {
        createElement: vi.fn((tag: string) => {
          const elem: any = {
            setAttribute: vi.fn(),
            style: {},
            click: vi.fn(),
          };
          if (tag === 'a') appendedLink = elem;
          return elem;
        }),
        body: {
          appendChild: vi.fn((elem: any) => elem),
          removeChild: vi.fn((elem: any) => elem),
        },
      };
    });

    it('exports CSV with UTF-8 BOM, escaped values, and triggers download', () => {
      const headers = ['SKU', 'Product Name', 'Price'];
      const rows = [
        ['ALB-001', 'JEERA PURI 250G', 60],
        ['ALB-002', 'SPECIAL "MAWA" SWEET, FRESH', 350],
      ];

      exportToCsv('products_export.csv', headers, rows);

      expect(createdBlob).not.toBeNull();
      const rawContent = createdBlob.content[0];
      // Must start with UTF-8 BOM \uFEFF
      expect(rawContent.startsWith('\uFEFF')).toBe(true);

      // Verify escaping: quotes inside cells doubled
      expect(rawContent).toContain('""MAWA""');
      expect(rawContent).toContain('"ALB-001"');
      expect(rawContent).toContain('"60"');

      // Verify download trigger
      expect(appendedLink.setAttribute).toHaveBeenCalledWith('download', 'products_export.csv');
      expect(appendedLink.click).toHaveBeenCalled();
    });

    it('appends .csv extension automatically if omitted in filename', () => {
      exportToCsv('sales_report', ['Bill', 'Amount'], [['Bill #1', 250]]);
      expect(appendedLink.setAttribute).toHaveBeenCalledWith('download', 'sales_report.csv');
    });
  });

  describe('4. Multi-Bill Concurrent Tabs State Isolation', () => {
    it('isolates carts between concurrent customer bills', () => {
      interface MockHeldBill {
        id: string;
        label: string;
        cart: CartItem[];
      }

      // Customer 1 adds Patra Boil
      const bill1Item = buildCartItem(sampleProductWeight, 0.5, 500);
      const bill1: MockHeldBill = {
        id: 'bill-1',
        label: 'Bill 1',
        cart: [bill1Item],
      };

      // Customer 2 comes while Customer 1 is thinking
      // Cashier opens Bill 2 and adds Punjabi Samosa
      const bill2Item = buildCartItem(sampleProductPiece, 2);
      const bill2: MockHeldBill = {
        id: 'bill-2',
        label: 'Bill 2',
        cart: [bill2Item],
      };

      // Ensure carts are strictly isolated
      expect(bill1.cart.length).toBe(1);
      expect(bill1.cart[0].product.name).toBe('PATRA BOIL');
      expect(bill1.cart[0].lineTotal).toBe(100);

      expect(bill2.cart.length).toBe(1);
      expect(bill2.cart[0].product.name).toBe('PUNJABI SAMOSA');
      expect(bill2.cart[0].lineTotal).toBe(50);

      // Customer 2 completes sale, Bill 2 is removed, Bill 1 remains intact
      let heldBills = [bill1, bill2];
      heldBills = heldBills.filter((b) => b.id !== 'bill-2');

      expect(heldBills.length).toBe(1);
      expect(heldBills[0].id).toBe('bill-1');
      expect(heldBills[0].cart[0].product.name).toBe('PATRA BOIL');
    });
  });
});
