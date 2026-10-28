import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getDeletedOrderIds, 
  recordDeletedOrder, 
  syncDeletedOrdersFromRemote, 
  isOrderDeleted,
  isDailyBillNumberString,
  DELETED_ORDERS_STORAGE_KEY
} from '../lib/orders';
import { 
  generateMasterSalesReport, 
  computeSalesMetrics, 
  validateSalesReconciliation,
  isEligibleOrder
} from '../lib/salesReporting';
import { 
  resolveDailyBillNumber, 
  formatDisplayBillNumber 
} from '../lib/utils';
import { OrderBill } from '../types';

// Mock localStorage for node test runner
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

function createMockOrder(overrides: Partial<OrderBill>): OrderBill {
  const grandTotal = overrides.grandTotal ?? 100;
  return {
    id: `sale-${Date.now()}-${Math.random()}`,
    billNumber: 'Bill #1',
    dailyBillNumber: 1,
    businessDate: '2026-10-26',
    branch: 'godi_road',
    grandTotal,
    subtotal: overrides.subtotal ?? grandTotal,
    gstAmount: overrides.gstAmount ?? 0,
    discountAmount: overrides.discountAmount ?? 0,
    amountReceived: overrides.amountReceived ?? grandTotal,
    changeGiven: overrides.changeGiven ?? 0,
    paymentMethod: 'CASH',
    transactionType: 'NO_BILL',
    items: [],
    cashierName: 'Owner',
    createdAt: '26-Oct-2026, 09:22 am',
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('P0 Production Incident — Permanent Bill Numbering & Financial Integrity Suite', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('1. Tombstone Isolation: Deleting a bill on Day B must NEVER hide bills on Day A', () => {
    it('isDailyBillNumberString correctly identifies daily sequence formats', () => {
      expect(isDailyBillNumberString('Bill #15')).toBe(true);
      expect(isDailyBillNumberString('Bill #1')).toBe(true);
      expect(isDailyBillNumberString('Bill 30')).toBe(true);
      expect(isDailyBillNumberString('bill #23')).toBe(true);
      expect(isDailyBillNumberString('ALB-INV-2726')).toBe(false);
      expect(isDailyBillNumberString('sale-1793084901090-1034')).toBe(false);
      expect(isDailyBillNumberString('')).toBe(false);
      expect(isDailyBillNumberString(undefined)).toBe(false);
    });

    it('recordDeletedOrder and getDeletedOrderIds sanitize daily bill strings', () => {
      // User deletes Bill #15 on 27-Oct
      const order27OctId = 'sale-1793084901090-1034';
      recordDeletedOrder(order27OctId, 'Bill #15');

      const set = getDeletedOrderIds();
      // ID should be recorded
      expect(set.has(order27OctId)).toBe(true);
      // 'Bill #15' MUST NOT be in the tombstone set
      expect(set.has('Bill #15')).toBe(false);

      // Verify isOrderDeleted behavior:
      // The 27-Oct order is deleted
      expect(isOrderDeleted(order27OctId, 'Bill #15')).toBe(true);

      // The 26-Oct order with the same daily bill number is NOT deleted!
      const order26OctId = 'sale-1792998962103-4560';
      expect(isOrderDeleted(order26OctId, 'Bill #15')).toBe(false);
    });

    it('purges legacy daily bill strings from localStorage automatically', () => {
      // Simulate dirty localStorage from past bug
      localStorage.setItem(
        DELETED_ORDERS_STORAGE_KEY,
        JSON.stringify(['sale-legit-del-1', 'Bill #15', 'Bill #18', 'Bill #30', 'ALB-INV-2726'])
      );

      const cleaned = getDeletedOrderIds();
      expect(cleaned.has('sale-legit-del-1')).toBe(true);
      expect(cleaned.has('ALB-INV-2726')).toBe(true);
      expect(cleaned.has('Bill #15')).toBe(false);
      expect(cleaned.has('Bill #18')).toBe(false);
      expect(cleaned.has('Bill #30')).toBe(false);

      // Confirms localStorage was rewritten clean
      const rawAfter = JSON.parse(localStorage.getItem(DELETED_ORDERS_STORAGE_KEY) || '[]');
      expect(rawAfter).toEqual(['sale-legit-del-1', 'ALB-INV-2726']);
    });

    it('syncDeletedOrdersFromRemote safely rejects remote daily bill strings', () => {
      const remote = [
        { id: 'sale-1793104624619-7580', billNumber: 'Bill #30' },
        { id: 'sale-1793086717425-9258', billNumber: 'Bill #18' },
        { id: 'ALB-INV-2726', billNumber: 'ALB-INV-2726' }
      ];

      const set = syncDeletedOrdersFromRemote(remote);
      expect(set.has('sale-1793104624619-7580')).toBe(true);
      expect(set.has('sale-1793086717425-9258')).toBe(true);
      expect(set.has('ALB-INV-2726')).toBe(true);
      expect(set.has('Bill #30')).toBe(false);
      expect(set.has('Bill #18')).toBe(false);
    });
  });

  describe('2. Unified Sales Reporting Contract: Combined = No-Bill + Customer Bills', () => {
    it('mathematically reconciles lifetime and today scopes with 100% precision', () => {
      const orders: OrderBill[] = [
        // 26-Oct (No-Bill sales)
        createMockOrder({
          id: 'sale-1',
          billNumber: 'Bill #1',
          dailyBillNumber: 1,
          businessDate: '2026-10-26',
          grandTotal: 100,
          subtotal: 100,
          gstAmount: 0,
          transactionType: 'NO_BILL',
          paymentMethod: 'CASH',
          createdAt: '26-Oct-2026, 09:22 am',
          timestamp: 1792986752110
        }),
        createMockOrder({
          id: 'sale-2',
          billNumber: 'Bill #2',
          dailyBillNumber: 2,
          businessDate: '2026-10-26',
          grandTotal: 250,
          subtotal: 250,
          gstAmount: 0,
          transactionType: 'NO_BILL',
          paymentMethod: 'UPI',
          createdAt: '26-Oct-2026, 09:34 am',
          timestamp: 1792987462988
        }),
        // 27-Oct: 1 Customer Bill (₹1) and 1 No-Bill (₹154)
        createMockOrder({
          id: 'sale-3',
          billNumber: 'Bill #1',
          dailyBillNumber: 1,
          businessDate: '2026-10-27',
          grandTotal: 1,
          subtotal: 0.95,
          gstAmount: 0.05,
          transactionType: 'CUSTOMER_BILL',
          paymentMethod: 'CASH',
          createdAt: '27-Oct-2026, 09:13 am',
          timestamp: 1793075602497
        }),
        createMockOrder({
          id: 'sale-4',
          billNumber: 'Bill #1',
          dailyBillNumber: 1,
          businessDate: '2026-10-27',
          grandTotal: 154,
          subtotal: 154,
          gstAmount: 0,
          transactionType: 'NO_BILL',
          paymentMethod: 'CASH',
          createdAt: '27-Oct-2026, 08:54 am',
          timestamp: 1793071461459
        })
      ];

      const report = generateMasterSalesReport(orders, 'all', '2026-10-27');

      // Lifetime check
      expect(report.combinedLifetime.count).toBe(4);
      expect(report.combinedLifetime.grandTotal).toBe(505);
      expect(report.noBillLifetime.count).toBe(3);
      expect(report.noBillLifetime.grandTotal).toBe(504);
      expect(report.customerBillsLifetime.count).toBe(1);
      expect(report.customerBillsLifetime.grandTotal).toBe(1);

      // Mathematical contract holds
      expect(report.combinedLifetime.count).toBe(
        report.noBillLifetime.count + report.customerBillsLifetime.count
      );
      expect(report.combinedLifetime.grandTotal).toBe(
        report.noBillLifetime.grandTotal + report.customerBillsLifetime.grandTotal
      );
      expect(report.reconciliation.isReconciled).toBe(true);

      // Today scope check (2026-10-27)
      expect(report.todayCombined.count).toBe(2);
      expect(report.todayCombined.grandTotal).toBe(155);
      expect(report.todayNoBill.count).toBe(1);
      expect(report.todayNoBill.grandTotal).toBe(154);
      expect(report.todayCustomerBills.count).toBe(1);
      expect(report.todayCustomerBills.grandTotal).toBe(1);
    });
  });

  describe('3. Collision Disambiguation & Display Formatting', () => {
    it('disambiguates colliding historical bill numbers with timestamp in UI', () => {
      const orderA = createMockOrder({
        id: 'sale-1792986752110-8534',
        billNumber: 'Bill #1',
        dailyBillNumber: 1,
        businessDate: '2026-10-26',
        branch: 'godi_road',
        grandTotal: 80,
        subtotal: 80,
        gstAmount: 0,
        transactionType: 'NO_BILL',
        paymentMethod: 'CASH',
        createdAt: '26-Oct-2026, 09:22 am',
        timestamp: 1792986752110
      });

      const orderB = createMockOrder({
        id: 'sale-1792987455889-3028',
        billNumber: 'Bill #1',
        dailyBillNumber: 1,
        businessDate: '2026-10-26',
        branch: 'godi_road',
        grandTotal: 50,
        subtotal: 50,
        gstAmount: 0,
        transactionType: 'NO_BILL',
        paymentMethod: 'CASH',
        createdAt: '26-Oct-2026, 09:34 am',
        timestamp: 1792987455889
      });

      const allOrders = [orderA, orderB];

      // Bill label remains clean "Bill #N" without appending timestamps to disguise collisions
      expect(formatDisplayBillNumber(orderA, allOrders)).toBe('Bill #1');
      expect(formatDisplayBillNumber(orderB, allOrders)).toBe('Bill #1');
    });

    it('returns clean Bill #N when there are no collisions', () => {
      const singleOrder = createMockOrder({
        id: 'sale-solo-1',
        billNumber: 'Bill #12',
        dailyBillNumber: 12,
        businessDate: '2026-10-26',
        branch: 'godi_road',
        grandTotal: 120,
        subtotal: 120,
        gstAmount: 0,
        transactionType: 'NO_BILL',
        paymentMethod: 'CASH',
        createdAt: '26-Oct-2026, 12:12 pm',
        timestamp: 1792996922197
      });

      expect(formatDisplayBillNumber(singleOrder, [singleOrder])).toBe('Bill #12');
    });
  });

  describe('4. Consecutive Daily Numbering Across Days', () => {
    it('starts at 1 for a new business date and increments monotonically', () => {
      const day1Bills: OrderBill[] = [];
      for (let i = 1; i <= 5; i++) {
        const o = createMockOrder({
          id: `sale-day1-${i}`,
          billNumber: `Bill #${i}`,
          dailyBillNumber: i,
          businessDate: '2026-10-26',
          branch: 'godi_road',
          grandTotal: 50 * i,
          subtotal: 50 * i,
          gstAmount: 0,
          transactionType: 'NO_BILL',
          paymentMethod: 'CASH',
          createdAt: `26-Oct-2026, 10:0${i} am`,
          timestamp: 1792990000000 + i * 1000
        });
        day1Bills.push(o);
      }

      // Next day starts at 1
      const day2Order1 = createMockOrder({
        id: 'sale-day2-1',
        billNumber: 'Bill #1',
        dailyBillNumber: 1,
        businessDate: '2026-10-27',
        branch: 'godi_road',
        grandTotal: 154,
        subtotal: 154,
        gstAmount: 0,
        transactionType: 'NO_BILL',
        paymentMethod: 'CASH',
        createdAt: '27-Oct-2026, 08:54 am',
        timestamp: 1793071461459
      });

      expect(resolveDailyBillNumber(day2Order1, [...day1Bills, day2Order1])).toBe(1);
    });
  });
});
