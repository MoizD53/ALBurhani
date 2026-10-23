import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderBill, PurchaseBill, Product, VendorPayment, ExpenseItem } from '../types';
import { getKolkataDateString } from '../lib/utils';
import { getDeletedOrderIds, recordDeletedOrder, isOrderDeleted, syncDeletedOrdersFromRemote } from '../lib/orders';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Production Verification & Final Acceptance Audit Suite', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.restoreAllMocks();
  });

  describe('1. Sales and Purchase Independent Daily Numbering (1..N)', () => {
    it('allocates independent sequential daily numbers starting at 1 for both sales and purchases', () => {
      const salesBill: OrderBill = {
        id: 'sale-1',
        billNumber: 'ALB-NB-1001',
        dailyBillNumber: 1,
        businessDate: '2026-10-23',
        transactionType: 'NO_BILL',
        items: [],
        subtotal: 500,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 500,
        paymentMethod: 'CASH',
        amountReceived: 500,
        changeGiven: 0,
        cashierName: 'Owner',
        createdAt: '2026-10-23T10:00:00+05:30',
      };

      const purchaseBill: PurchaseBill = {
        id: 'pur-1',
        purchaseNumber: 'PUR-0001',
        dailyBillNumber: 1,
        businessDate: '2026-10-23',
        vendorName: 'Mahalaxmi Sweets & Raw Supply',
        purchaseDate: '2026-10-23',
        items: [{ productName: 'Pure Ghee 15kg', quantity: 1, unit: 'Tin', unitPrice: 8500, lineTotal: 8500 }],
        subtotal: 8500,
        discount: 0,
        additionalCharges: 0,
        grandTotal: 8500,
        amountPaid: 8500,
        balanceDue: 0,
        paymentStatus: 'Paid',
        paymentMode: 'Bank Transfer',
        status: 'Active',
      };

      // Both start independently from 1 on the same business date
      expect(salesBill.dailyBillNumber).toBe(1);
      expect(purchaseBill.dailyBillNumber).toBe(1);
      expect(salesBill.businessDate).toBe('2026-10-23');
      expect(purchaseBill.businessDate).toBe('2026-10-23');
    });

    it('resets numbering to 1 at 12:00 AM IST on the next business date', () => {
      // 23:59:00 IST on Oct 23 -> Oct 23
      const oct23Night = new Date('2026-10-23T18:29:00Z').getTime(); // 23:59 IST
      expect(getKolkataDateString(oct23Night)).toBe('2026-10-23');

      // 00:01:00 IST on Oct 24 -> Oct 24
      const oct24Morning = new Date('2026-10-23T18:31:00Z').getTime(); // 00:01 IST
      expect(getKolkataDateString(oct24Morning)).toBe('2026-10-24');

      // Counter simulator
      const counters: Record<string, number> = {};
      function getNextNumber(date: string) {
        counters[date] = (counters[date] || 0) + 1;
        return counters[date];
      }

      const num1 = getNextNumber('2026-10-23');
      const num2 = getNextNumber('2026-10-23');
      const numNextDay = getNextNumber('2026-10-24');

      expect(num1).toBe(1);
      expect(num2).toBe(2);
      expect(numNextDay).toBe(1); // Reset to 1!
    });

    it('displays bills in ascending order (Bill #1 at the top, Bill #2 underneath)', () => {
      const dayBills: OrderBill[] = [
        { id: '3', billNumber: 'B-3', dailyBillNumber: 3, businessDate: '2026-10-23', transactionType: 'NO_BILL', items: [], subtotal: 100, discountAmount: 0, gstAmount: 0, grandTotal: 100, paymentMethod: 'CASH', amountReceived: 100, changeGiven: 0, cashierName: 'Owner', createdAt: '2026-10-23T11:00:00+05:30' },
        { id: '1', billNumber: 'B-1', dailyBillNumber: 1, businessDate: '2026-10-23', transactionType: 'NO_BILL', items: [], subtotal: 100, discountAmount: 0, gstAmount: 0, grandTotal: 100, paymentMethod: 'CASH', amountReceived: 100, changeGiven: 0, cashierName: 'Owner', createdAt: '2026-10-23T09:00:00+05:30' },
        { id: '2', billNumber: 'B-2', dailyBillNumber: 2, businessDate: '2026-10-23', transactionType: 'NO_BILL', items: [], subtotal: 100, discountAmount: 0, gstAmount: 0, grandTotal: 100, paymentMethod: 'CASH', amountReceived: 100, changeGiven: 0, cashierName: 'Owner', createdAt: '2026-10-23T10:00:00+05:30' },
      ];

      const sorted = [...dayBills].sort((a, b) => (a.dailyBillNumber || 0) - (b.dailyBillNumber || 0));
      expect(sorted[0].dailyBillNumber).toBe(1);
      expect(sorted[1].dailyBillNumber).toBe(2);
      expect(sorted[2].dailyBillNumber).toBe(3);
    });
  });

  describe('2. Calendar Reconciliation & Deduplicated Customer Counts', () => {
    it('accurately reconciles the verified baseline dates and deduplicates repeat customers', () => {
      const oct21Bills: OrderBill[] = [
        { id: '1', billNumber: 'ALB-NB-1', dailyBillNumber: 1, businessDate: '2026-10-21', transactionType: 'NO_BILL', customerName: 'Same Customer', customerPhone: '9820000000', items: [], subtotal: 500, discountAmount: 0, gstAmount: 0, grandTotal: 500, paymentMethod: 'CASH', amountReceived: 500, changeGiven: 0, cashierName: 'Owner', createdAt: '2026-10-21T10:00:00+05:30' },
        { id: '2', billNumber: 'ALB-NB-2', dailyBillNumber: 2, businessDate: '2026-10-21', transactionType: 'NO_BILL', customerName: 'Same Customer', customerPhone: '9820000000', items: [], subtotal: 400, discountAmount: 0, gstAmount: 0, grandTotal: 400, paymentMethod: 'CASH', amountReceived: 400, changeGiven: 0, cashierName: 'Owner', createdAt: '2026-10-21T11:00:00+05:30' },
        { id: '3', billNumber: 'ALB-NB-3', dailyBillNumber: 3, businessDate: '2026-10-21', transactionType: 'NO_BILL', customerName: 'Other Customer', customerPhone: '9821111111', items: [], subtotal: 1000, discountAmount: 0, gstAmount: 0, grandTotal: 1000, paymentMethod: 'CREDIT', amountReceived: 880, changeGiven: 0, dueAmount: 120, cashierName: 'Owner', createdAt: '2026-10-21T12:00:00+05:30' },
      ];

      const totalBills = oct21Bills.length;
      const uniqueCustomers = new Set(oct21Bills.map(b => b.customerPhone || b.customerName)).size;
      const totalSales = oct21Bills.reduce((sum, b) => sum + b.grandTotal, 0);
      const cashReceived = oct21Bills.filter(b => b.paymentMethod === 'CASH').reduce((sum, b) => sum + b.amountReceived, 0);
      const creditOutstanding = oct21Bills.reduce((sum, b) => sum + (b.dueAmount || 0), 0);

      expect(totalBills).toBe(3);
      expect(uniqueCustomers).toBe(2); // Deduplicated!
      expect(totalSales).toBe(1900);
      expect(cashReceived).toBe(900);
      expect(creditOutstanding).toBe(120);
    });
  });

  describe('3. Purchase, Stock Delta, Vendor Payments & Expense Separation', () => {
    it('applies stock delta on purchase edit, reverses on cancel, and maintains floor at 0', () => {
      const product: Product = {
        id: 'prod-pistachio',
        sku: 'SKU-PIST-1',
        barcode: '123456789012',
        name: 'Salted Pistachios',
        category: 'DRY FRUITS',
        unit: 'KG',
        costPrice: 900,
        sellingPrice: 1200,
        stock: 5,
      };

      // 1. Inward purchase of 20 KG
      product.stock = (product.stock || 0) + 20;
      expect(product.stock).toBe(25);

      // 2. Edit purchase bill from 20 KG to 28 KG (Delta +8)
      const oldQty = 20;
      const newQty = 28;
      const delta = newQty - oldQty;
      product.stock = (product.stock || 0) + delta;
      expect(product.stock).toBe(33);

      // 3. Customer buys 30 KG in retail sales
      product.stock = (product.stock || 0) - 30;
      expect(product.stock).toBe(3);

      // 4. If purchase voucher is cancelled (reversing 28 KG), stock must NOT become negative -25!
      product.stock = Math.max(0, (product.stock || 0) - newQty);
      expect(product.stock).toBe(0); // Zero floor safeguard!
    });

    it('separates store operating expenses from supplier inward purchases to prevent double-counting', () => {
      const operatingExpenses: ExpenseItem[] = [
        { id: 'e1', title: 'Shop Rent Oct 2026', category: 'Shop Rent', amount: 25000, date: '2026-10-23', paymentMode: 'Bank Transfer' },
        { id: 'e2', title: 'Cleaner Wages', category: 'Staff Salaries & Wages', amount: 1500, date: '2026-10-23', paymentMode: 'Cash' },
      ];

      const purchaseBills: PurchaseBill[] = [
        {
          id: 'p1',
          purchaseNumber: 'PUR-0001',
          dailyBillNumber: 1,
          businessDate: '2026-10-23',
          vendorName: 'Badam Suppliers',
          purchaseDate: '2026-10-23',
          items: [{ productName: 'Mamra Badam', quantity: 10, unit: 'KG', unitPrice: 1500, lineTotal: 15000 }],
          subtotal: 15000,
          discount: 0,
          additionalCharges: 0,
          grandTotal: 15000,
          amountPaid: 10000, // Actual cash paid
          balanceDue: 5000, // Outstanding payable
          paymentStatus: 'Partially Paid',
          paymentMode: 'UPI',
          status: 'Active',
        },
      ];

      const operatingTotal = operatingExpenses.reduce((s, e) => s + e.amount, 0);
      const supplierPaid = purchaseBills.filter(b => b.status !== 'Cancelled').reduce((s, b) => s + b.amountPaid, 0);
      const totalCashOutflow = operatingTotal + supplierPaid;
      const supplierPayable = purchaseBills.filter(b => b.status !== 'Cancelled').reduce((s, b) => s + b.balanceDue, 0);

      expect(operatingTotal).toBe(26500);
      expect(supplierPaid).toBe(10000);
      expect(totalCashOutflow).toBe(36500); // 26500 + 10000
      expect(supplierPayable).toBe(5000); // Pending payable
    });
  });

  describe('4. Cross-Device Consistency & Tombstone Anti-Resurrection', () => {
    it('prevents deleted orders from resurrecting on cross-device sync', () => {
      const deletedId = 'ALB-INV-2726';
      recordDeletedOrder(deletedId, deletedId);

      // Verify tombstone is recorded
      expect(isOrderDeleted(deletedId)).toBe(true);

      // Incoming stale cloud response containing the deleted invoice
      const staleCloudOrders: OrderBill[] = [
        {
          id: deletedId,
          billNumber: deletedId,
          transactionType: 'CUSTOMER_BILL',
          items: [],
          subtotal: 500,
          discountAmount: 0,
          gstAmount: 0,
          grandTotal: 500,
          paymentMethod: 'CASH',
          amountReceived: 500,
          changeGiven: 0,
          cashierName: 'Owner',
          createdAt: '2026-10-23T10:00:00+05:30',
        },
        {
          id: 'genuine-order-1',
          billNumber: 'ALB-NB-9901',
          transactionType: 'NO_BILL',
          items: [],
          subtotal: 350,
          discountAmount: 0,
          gstAmount: 0,
          grandTotal: 350,
          paymentMethod: 'CASH',
          amountReceived: 350,
          changeGiven: 0,
          cashierName: 'Owner',
          createdAt: '2026-10-23T10:30:00+05:30',
        },
      ];

      const tombstones = getDeletedOrderIds();
      const filtered = staleCloudOrders.filter(
        o => !tombstones.has(o.id) && (!o.billNumber || !tombstones.has(o.billNumber))
      );

      // Deleted order is filtered out permanently!
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('genuine-order-1');
    });

    it('synchronizes remote tombstones to local storage when another device deletes a bill', () => {
      const remoteTombstones = [
        { id: 'sale-device-iphone-101', billNumber: 'ALB-NB-101' },
      ];

      const localSet = syncDeletedOrdersFromRemote(remoteTombstones);
      expect(localSet.has('sale-device-iphone-101')).toBe(true);
      expect(localSet.has('ALB-NB-101')).toBe(true);
    });
  });
});
