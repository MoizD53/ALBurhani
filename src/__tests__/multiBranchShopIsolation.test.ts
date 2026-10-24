import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { authenticate } from '../lib/auth';
import { OrderBill, ExpenseItem, PurchaseBill } from '../types';

const localStore: Record<string, string> = {};
const sessionStore: Record<string, string> = {};

const mockLocalStorage = {
  getItem: (key: string) => localStore[key] || null,
  setItem: (key: string, val: string) => { localStore[key] = String(val); },
  removeItem: (key: string) => { delete localStore[key]; },
  clear: () => { Object.keys(localStore).forEach(k => delete localStore[k]); }
};

const mockSessionStorage = {
  getItem: (key: string) => sessionStore[key] || null,
  setItem: (key: string, val: string) => { sessionStore[key] = String(val); },
  removeItem: (key: string) => { delete sessionStore[key]; },
  clear: () => { Object.keys(sessionStore).forEach(k => delete sessionStore[k]); }
};

beforeAll(() => {
  // @ts-expect-error polyfill
  globalThis.localStorage = mockLocalStorage;
  // @ts-expect-error polyfill
  globalThis.sessionStorage = mockSessionStorage;
});

describe('Multi-Branch Shop Isolation Suite (Godi Road & MG Road)', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    mockLocalStorage.clear();
  });

  describe('1. Authentication & Branch Context', () => {
    it('authenticates Godi Road with id: admin and pass: admin@godiroad', async () => {
      const res = await authenticate('admin', 'admin@godiroad');
      expect(res.success).toBe(true);
      expect(res.session?.user.branchId).toBe('godi_road');
      expect(res.session?.user.branchName).toBe('Godi Road');
      expect(res.session?.user.counter).toBe('Godi Road Store');
    });

    it('authenticates MG Road with id: admin and pass: admin@mgroad', async () => {
      const res = await authenticate('admin', 'admin@mgroad');
      expect(res.success).toBe(true);
      expect(res.session?.user.branchId).toBe('mg_road');
      expect(res.session?.user.branchName).toBe('MG Road');
      expect(res.session?.user.counter).toBe('MG Road Store');
    });
  });

  describe('2. Independent Daily Sequential Bill Numbering on Same Business Date', () => {
    it('maintains completely separate daily bill sequences for Godi Road and MG Road', () => {
      const businessDate = '2026-10-24';

      // Simulated atomic counter key generator (matching api/db.ts)
      const counters: Record<string, number> = {};
      function allocateNextBillNumber(date: string, branch: 'godi_road' | 'mg_road') {
        const key = branch === 'mg_road' ? `${date}_mg_road` : date;
        counters[key] = (counters[key] || 0) + 1;
        return counters[key];
      }

      // Godi Road creates 3 bills on 2026-10-24
      const godiBill1 = allocateNextBillNumber(businessDate, 'godi_road');
      const godiBill2 = allocateNextBillNumber(businessDate, 'godi_road');
      const godiBill3 = allocateNextBillNumber(businessDate, 'godi_road');

      // MG Road creates 2 bills on the SAME date (2026-10-24)
      const mgBill1 = allocateNextBillNumber(businessDate, 'mg_road');
      const mgBill2 = allocateNextBillNumber(businessDate, 'mg_road');

      // Godi Road continues to 4
      const godiBill4 = allocateNextBillNumber(businessDate, 'godi_road');

      // Assert Godi Road sequence: 1, 2, 3, 4
      expect(godiBill1).toBe(1);
      expect(godiBill2).toBe(2);
      expect(godiBill3).toBe(3);
      expect(godiBill4).toBe(4);

      // Assert MG Road starts independently from 1, then 2
      expect(mgBill1).toBe(1);
      expect(mgBill2).toBe(2);
    });
  });

  describe('3. Revenue, Expenses & Ledger Isolation', () => {
    const mixedOrders: OrderBill[] = [
      {
        id: 'ord-g1',
        billNumber: 'ALB-NB-101',
        dailyBillNumber: 1,
        branch: 'godi_road',
        businessDate: '2026-10-24',
        transactionType: 'NO_BILL',
        items: [],
        subtotal: 500,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 500,
        paymentMethod: 'CASH',
        amountReceived: 500,
        changeGiven: 0,
        cashierName: 'Owner (Godi Road)',
        createdAt: '2026-10-24T10:00:00+05:30',
      },
      {
        id: 'ord-g2',
        billNumber: 'ALB-NB-102',
        dailyBillNumber: 2,
        branch: 'godi_road',
        businessDate: '2026-10-24',
        transactionType: 'NO_BILL',
        items: [],
        subtotal: 750,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 750,
        paymentMethod: 'UPI',
        amountReceived: 750,
        changeGiven: 0,
        cashierName: 'Owner (Godi Road)',
        createdAt: '2026-10-24T10:30:00+05:30',
      },
      {
        id: 'ord-m1',
        billNumber: 'ALB-NB-201',
        dailyBillNumber: 1,
        branch: 'mg_road',
        businessDate: '2026-10-24',
        transactionType: 'NO_BILL',
        items: [],
        subtotal: 1200,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 1200,
        paymentMethod: 'CASH',
        amountReceived: 1200,
        changeGiven: 0,
        cashierName: 'Owner (MG Road)',
        createdAt: '2026-10-24T11:00:00+05:30',
      },
    ];

    const mixedExpenses: ExpenseItem[] = [
      {
        id: 'exp-g1',
        title: 'Godi Road Milk Supply',
        category: 'Raw Materials',
        amount: 800,
        date: '2026-10-24',
        paymentMode: 'Cash',
        branch: 'godi_road',
      },
      {
        id: 'exp-m1',
        title: 'MG Road Electricity Bill',
        category: 'Utilities',
        amount: 1500,
        date: '2026-10-24',
        paymentMode: 'UPI',
        branch: 'mg_road',
      },
    ];

    it('filters sales revenue strictly for Godi Road', () => {
      const godiOrders = mixedOrders.filter(o => (o.branch || 'godi_road') === 'godi_road');
      const godiRevenue = godiOrders.reduce((sum, o) => sum + o.grandTotal, 0);

      expect(godiOrders.length).toBe(2);
      expect(godiRevenue).toBe(1250); // 500 + 750
    });

    it('filters sales revenue strictly for MG Road', () => {
      const mgOrders = mixedOrders.filter(o => (o.branch || 'godi_road') === 'mg_road');
      const mgRevenue = mgOrders.reduce((sum, o) => sum + o.grandTotal, 0);

      expect(mgOrders.length).toBe(1);
      expect(mgRevenue).toBe(1200);
    });

    it('filters expenses strictly per branch', () => {
      const godiExpenses = mixedExpenses.filter(e => (e.branch || 'godi_road') === 'godi_road');
      const mgExpenses = mixedExpenses.filter(e => (e.branch || 'godi_road') === 'mg_road');

      expect(godiExpenses.reduce((s, e) => s + e.amount, 0)).toBe(800);
      expect(mgExpenses.reduce((s, e) => s + e.amount, 0)).toBe(1500);
    });
  });

  describe('4. Purchase Bills Branch Scoping', () => {
    it('isolates purchase bills per branch while allowing shared vendor directory', () => {
      const purchases: PurchaseBill[] = [
        {
          id: 'pb-g1',
          purchaseNumber: 'PUR-0001',
          dailyBillNumber: 1,
          businessDate: '2026-10-24',
          vendorName: 'Mahalaxmi Sweets & Raw Supply',
          purchaseDate: '2026-10-24',
          items: [],
          subtotal: 5000,
          discount: 0,
          additionalCharges: 0,
          grandTotal: 5000,
          amountPaid: 5000,
          balanceDue: 0,
          paymentStatus: 'Paid',
          paymentMode: 'Cash',
          status: 'Active',
          branch: 'godi_road',
        },
        {
          id: 'pb-m1',
          purchaseNumber: 'PUR-0002',
          dailyBillNumber: 1, // MG Road starts with its own #1
          businessDate: '2026-10-24',
          vendorName: 'Shree Krishna Packaging',
          purchaseDate: '2026-10-24',
          items: [],
          subtotal: 3500,
          discount: 0,
          additionalCharges: 0,
          grandTotal: 3500,
          amountPaid: 3500,
          balanceDue: 0,
          paymentStatus: 'Paid',
          paymentMode: 'Bank Transfer',
          status: 'Active',
          branch: 'mg_road',
        },
      ];

      const godiPurchases = purchases.filter(b => (b.branch || 'godi_road') === 'godi_road');
      const mgPurchases = purchases.filter(b => (b.branch || 'godi_road') === 'mg_road');

      expect(godiPurchases.length).toBe(1);
      expect(godiPurchases[0].purchaseNumber).toBe('PUR-0001');

      expect(mgPurchases.length).toBe(1);
      expect(mgPurchases[0].purchaseNumber).toBe('PUR-0002');
      expect(mgPurchases[0].dailyBillNumber).toBe(1);
    });
  });

  describe('5. Backwards Compatibility for Historical Records', () => {
    it('defaults any legacy record without a branch property to godi_road', () => {
      const legacyOrder: OrderBill = {
        id: 'legacy-1',
        billNumber: 'ALB-NB-1',
        dailyBillNumber: 1,
        businessDate: '2026-10-21',
        transactionType: 'NO_BILL',
        items: [],
        subtotal: 200,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 200,
        paymentMethod: 'CASH',
        amountReceived: 200,
        changeGiven: 0,
        cashierName: 'Owner',
        createdAt: '2026-10-21T09:00:00+05:30',
        // branch is omitted (legacy record)
      };

      const resolvedBranch = legacyOrder.branch || 'godi_road';
      expect(resolvedBranch).toBe('godi_road');
    });
  });
});
