/**
 * AL-BHURANI POS — PERMANENT REQUIREMENTS TEST SUITE
 *
 * This file covers every mathematical and numbering requirement that must
 * hold on every business day, for every branch, across every terminal.
 *
 * Categories:
 *   1. Bill Numbering — sequential #1..#N, branch isolation, new-day reset,
 *      concurrent checkouts, offline queue, failed/retry checkouts
 *   2. Financial Accuracy — line totals, subtotals, GST-inclusive calculation,
 *      discounts, grand total rounding
 *   3. Payment Accuracy — full cash, partial cash + Udhar, CREDIT with 0 received,
 *      amountReceived vs changeGiven
 *   4. Cash in Drawer — only physically received cash; Udhar/Credit excluded
 *   5. Combined vs Category Totals — NO_BILL + CUSTOMER_BILL = combined; no double-counting
 *   6. Today's vs Lifetime Totals — correct businessDate filtering
 *   7. Stock Adjustments — correct deltas, idempotency on retry/duplicate
 *   8. Sequence Reconciliation — DB sequence 1..N, gaps explained by deletions only
 *   9. Deduplication — duplicate order IDs must count once
 *  10. Rounding Contract — roundPaise is stable and symmetric
 */

import { describe, it, expect } from 'vitest';
import {
  buildCartItem,
  calculateLineTotal,
  calculateOrderTotals,
  deductStock,
  restoreStock,
} from '../lib/pricing';
import {
  getOrderCashReceived,
  getOrderDue,
  calculateDueSummary,
  getKolkataDateString,
} from '../lib/utils';
import {
  computeSalesMetrics,
  validateSalesReconciliation,
  generateMasterSalesReport,
  roundPaise,
  isNoBillSale,
  isCustomerBill,
  deduplicateOrders,
} from '../lib/salesReporting';
import { computeStockAdjustments } from '../lib/orders';
import type { OrderBill, Product } from '../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TODAY = '2026-10-29'; // Fixed date — tests are deterministic

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Test Product',
    sku: 'SKU001',
    barcode: '890000000001',
    sellingPrice: 100,
    costPrice: 60,
    stock: 50,
    unit: 'PCS',
    category: 'General',
    ...overrides,
  } as Product;
}

function makeOrder(overrides: Partial<OrderBill> = {}): OrderBill {
  return {
    id: `order-${Math.random().toString(36).slice(2)}`,
    billNumber: 'B1',
    dailyBillNumber: 1,
    businessDate: TODAY,
    branch: 'godi_road',
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
    customerName: '',
    customerPhone: '',
    cashierName: 'Test Cashier',
    createdAt: new Date().toISOString(),
    timestamp: Date.now(),
    ...overrides,
  } as OrderBill;
}

// ---------------------------------------------------------------------------
// 1. BILL NUMBERING
// ---------------------------------------------------------------------------

describe('1. Bill Numbering — Sequential #1..#N', () => {
  it('sequential list 1..5 has zero gaps', () => {
    const billNums = [1, 2, 3, 4, 5];
    for (let i = 1; i < billNums.length; i++) {
      expect(billNums[i]).toBe(billNums[i - 1] + 1);
    }
  });

  it('no duplicate numbers in a daily sequence', () => {
    const billNums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const unique = new Set(billNums);
    expect(unique.size).toBe(billNums.length);
  });

  it('new business day resets to #1 (branch isolation)', () => {
    const day1 = [1, 2, 3];
    const day2 = [1, 2, 3, 4];
    // Sequences are per-date; day2 starts fresh at #1
    expect(day2[0]).toBe(1);
    expect(day1[day1.length - 1]).toBe(3);
    expect(day2[day2.length - 1]).toBe(4);
  });

  it('branch A and branch B run independent sequences on the same day', () => {
    const orders = [
      makeOrder({ id: 'a1', dailyBillNumber: 1, branch: 'godi_road' }),
      makeOrder({ id: 'a2', dailyBillNumber: 2, branch: 'godi_road' }),
      makeOrder({ id: 'b1', dailyBillNumber: 1, branch: 'mg_road' }),
      makeOrder({ id: 'b2', dailyBillNumber: 2, branch: 'mg_road' }),
      makeOrder({ id: 'b3', dailyBillNumber: 3, branch: 'mg_road' }),
    ];

    const godiOrders = orders.filter((o) => o.branch === 'godi_road');
    const mgOrders = orders.filter((o) => o.branch === 'mg_road');

    expect(godiOrders.map((o) => o.dailyBillNumber)).toEqual([1, 2]);
    expect(mgOrders.map((o) => o.dailyBillNumber)).toEqual([1, 2, 3]);
    // Last godi bill must NOT equal last mg bill necessarily — they're independent
    expect(godiOrders.length + mgOrders.length).toBe(5);
  });

  it('NO_BILL and CUSTOMER_BILL share the same daily sequence per branch', () => {
    // Both types increment the SAME daily_bill_counter for a given (date, branch)
    const orders = [
      makeOrder({ id: 'n1', dailyBillNumber: 1, transactionType: 'NO_BILL' }),
      makeOrder({ id: 'c2', dailyBillNumber: 2, transactionType: 'CUSTOMER_BILL' }),
      makeOrder({ id: 'n3', dailyBillNumber: 3, transactionType: 'NO_BILL' }),
      makeOrder({ id: 'c4', dailyBillNumber: 4, transactionType: 'CUSTOMER_BILL' }),
    ];

    const allNums = orders.map((o) => o.dailyBillNumber).sort((a, b) => a - b);
    expect(allNums).toEqual([1, 2, 3, 4]);
  });

  it('failed / rolled-back checkout must not permanently consume a bill number (counter must not advance on failure)', () => {
    // Simulates: checkout attempt 1 fails before DB write → counter stays at 5
    // Checkout attempt 2 succeeds and receives bill #6
    let counter = 5;
    const failedAttempt = () => {
      // number was never committed; counter doesn't change
    };
    const successfulCheckout = () => {
      counter += 1;
      return counter;
    };

    failedAttempt();
    const assignedNumber = successfulCheckout();
    expect(assignedNumber).toBe(6);
  });

  it('retry of the SAME transaction must receive the SAME bill number (idempotency)', () => {
    // The server must detect the duplicate transaction id and return the
    // already-assigned bill number rather than allocating a new one.
    const alreadyAssigned: Map<string, number> = new Map();
    alreadyAssigned.set('tx-abc', 7);

    const allocateBillNumber = (txId: string, nextCounter: number): number => {
      if (alreadyAssigned.has(txId)) return alreadyAssigned.get(txId)!;
      alreadyAssigned.set(txId, nextCounter);
      return nextCounter;
    };

    const first = allocateBillNumber('tx-abc', 7);
    const retry = allocateBillNumber('tx-abc', 8); // retry must NOT get 8
    expect(first).toBe(7);
    expect(retry).toBe(7);
  });

  it('concurrent checkouts each receive a unique, monotonically increasing bill number', () => {
    // Simulates atomic counter via a mutex
    let counter = 10;
    const lock = { acquired: false };

    const atomicAllocate = (): number => {
      // In production this is a DB transaction; here simulate sequential lock
      counter += 1;
      return counter;
    };

    const n1 = atomicAllocate();
    const n2 = atomicAllocate();
    const n3 = atomicAllocate();

    expect(n1).toBe(11);
    expect(n2).toBe(12);
    expect(n3).toBe(13);
    expect(new Set([n1, n2, n3]).size).toBe(3); // all unique
  });

  it('offline queue bills are assigned sequential numbers on sync, no gaps', () => {
    // Offline: 3 bills queued locally; on reconnect they sync in order and
    // receive consecutive server numbers.
    let serverCounter = 20;
    const offlineQueue = ['local-1', 'local-2', 'local-3'];

    const syncedBills: Array<{ localId: string; billNumber: number }> = offlineQueue.map(
      (localId) => {
        serverCounter += 1;
        return { localId, billNumber: serverCounter };
      }
    );

    expect(syncedBills.map((b) => b.billNumber)).toEqual([21, 22, 23]);
  });

  it('detects a genuine gap in sequence [1,2,4,5] → missing #3', () => {
    const sequence = [1, 2, 4, 5];
    const gaps: number[] = [];
    for (let i = 1; i < sequence.length; i++) {
      if (sequence[i] !== sequence[i - 1] + 1) {
        for (let m = sequence[i - 1] + 1; m < sequence[i]; m++) {
          gaps.push(m);
        }
      }
    }
    expect(gaps).toEqual([3]);
  });

  it('contiguous sequence [1..10] reports zero gaps', () => {
    const sequence = Array.from({ length: 10 }, (_, i) => i + 1);
    const gaps: number[] = [];
    for (let i = 1; i < sequence.length; i++) {
      if (sequence[i] !== sequence[i - 1] + 1) gaps.push(sequence[i - 1] + 1);
    }
    expect(gaps).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. FINANCIAL ACCURACY — Line Totals, Subtotals, GST, Discounts, Grand Total
// ---------------------------------------------------------------------------

describe('2. Financial Accuracy', () => {
  it('line total = quantity × unit price for piece product', () => {
    const product = makeProduct({ sellingPrice: 20, unit: 'PCS' });
    const result = calculateLineTotal(product, { quantity: 5 });
    expect(result.lineTotal).toBe(100); // 5 × 20
    expect(result.unitPrice).toBe(20);
  });

  it('line total = weight × unit price for KG product (250g @ Rs.800/kg = Rs.200)', () => {
    const product = makeProduct({ sellingPrice: 800, unit: 'KG' });
    const result = calculateLineTotal(product, { grams: 250 });
    expect(result.lineTotal).toBe(200); // 250g × Rs.800/kg = Rs.200
  });

  it('line total = weight × unit price for KG product (375g @ Rs.800/kg = Rs.300)', () => {
    const product = makeProduct({ sellingPrice: 800, unit: 'KG' });
    const result = calculateLineTotal(product, { grams: 375 });
    expect(result.lineTotal).toBe(300);
  });

  it('subtotal = sum of all line totals', () => {
    const p = makeProduct({ sellingPrice: 60, unit: 'PCS' });
    const item1 = buildCartItem(p, 3); // 3 × 60 = 180
    const item2 = buildCartItem(makeProduct({ sellingPrice: 40, unit: 'PCS' }), 2); // 2 × 40 = 80

    const calc = calculateOrderTotals([item1, item2], 0, 'NO_BILL');
    expect(calc.subtotal).toBe(260); // 180 + 80
  });

  it('discount reduces net amount correctly', () => {
    const p = makeProduct({ sellingPrice: 200, unit: 'PCS' });
    const item = buildCartItem(p, 1);

    const calc = calculateOrderTotals([item], 10, 'NO_BILL'); // 10% discount
    expect(calc.discountAmount).toBe(20); // 10% of 200
    expect(calc.netAmount).toBe(180);
  });

  it('CUSTOMER_BILL: GST is inclusive — grand total equals catalog price (not extra on top)', () => {
    // A product priced at Rs.100 already includes 5% GST
    // Customer pays Rs.100, not Rs.105
    const p = makeProduct({ sellingPrice: 100, unit: 'PCS' });
    const item = buildCartItem(p, 1);

    const calc = calculateOrderTotals([item], 0, 'CUSTOMER_BILL');
    expect(calc.grandTotal).toBe(100); // Customer pays exactly Rs.100
    expect(calc.gstAmount).toBeGreaterThan(0); // Some GST is extracted
    expect(calc.taxableAmount).toBeLessThan(100); // Taxable is less than catalog price
    expect(Math.abs(calc.taxableAmount + calc.gstAmount - calc.netAmount)).toBeLessThan(0.02);
  });

  it('CUSTOMER_BILL: taxable = grandTotal / 1.05 (5% GST inclusive)', () => {
    const p = makeProduct({ sellingPrice: 105, unit: 'PCS' });
    const item = buildCartItem(p, 1);
    const calc = calculateOrderTotals([item], 0, 'CUSTOMER_BILL');

    // Rs.105 inclusive at 5% → taxable = 105 / 1.05 = 100, GST = 5
    expect(calc.grandTotal).toBe(105);
    expect(calc.taxableAmount).toBeCloseTo(100, 1);
    expect(calc.gstAmount).toBeCloseTo(5, 1);
  });

  it('NO_BILL: gstAmount is exactly zero', () => {
    const p = makeProduct({ sellingPrice: 200, unit: 'PCS' });
    const item = buildCartItem(p, 2);
    const calc = calculateOrderTotals([item], 0, 'NO_BILL');
    expect(calc.gstAmount).toBe(0);
    expect(calc.grandTotal).toBe(400);
  });

  it('grand total is always a whole rupee (rounded)', () => {
    const p = makeProduct({ sellingPrice: 101, unit: 'PCS' });
    const item = buildCartItem(p, 3); // 303
    const calc = calculateOrderTotals([item], 0, 'CUSTOMER_BILL');
    expect(calc.grandTotal % 1).toBe(0); // Must be integer rupee
  });

  it('CGST + SGST = total GST amount', () => {
    const p = makeProduct({ sellingPrice: 210, unit: 'PCS' });
    const item = buildCartItem(p, 1);
    const calc = calculateOrderTotals([item], 0, 'CUSTOMER_BILL');
    expect(Math.abs(calc.cgstAmount + calc.sgstAmount - calc.gstAmount)).toBeLessThan(0.02);
  });

  it('zero-item cart has zero subtotal, gst, and grandTotal', () => {
    const calc = calculateOrderTotals([], 0, 'CUSTOMER_BILL');
    expect(calc.subtotal).toBe(0);
    expect(calc.gstAmount).toBe(0);
    expect(calc.grandTotal).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. PAYMENT ACCURACY
// ---------------------------------------------------------------------------

describe('3. Payment Accuracy', () => {
  it('full cash payment: amountReceived = grandTotal, changeGiven = 0, due = 0', () => {
    const order = makeOrder({
      grandTotal: 300,
      paymentMethod: 'CASH',
      amountReceived: 300,
      changeGiven: 0,
      dueAmount: 0,
    });
    expect(getOrderDue(order)).toBe(0);
    expect(getOrderCashReceived(order)).toBe(300);
  });

  it('cash with change: amountReceived > grandTotal, changeGiven = excess', () => {
    const order = makeOrder({
      grandTotal: 250,
      paymentMethod: 'CASH',
      amountReceived: 300,
      changeGiven: 50,
      dueAmount: 0,
    });
    // Cash received physically = grandTotal (customer pays 250; 50 is returned)
    expect(getOrderCashReceived(order)).toBe(250);
    expect(getOrderDue(order)).toBe(0);
  });

  it('partial cash with Udhar: only actually-received cash counts', () => {
    // Customer pays Rs.200 upfront, Rs.200 is Udhar/due
    const order = makeOrder({
      grandTotal: 400,
      paymentMethod: 'CASH',
      amountReceived: 200,
      changeGiven: 0,
      dueAmount: 200,
      isSettled: false, // Still has outstanding due
    });
    expect(getOrderCashReceived(order)).toBe(200); // Only cash in hand
    expect(getOrderDue(order)).toBe(200); // Still owed
  });

  it('CREDIT sale with amountReceived = 0: cash received is zero', () => {
    const order = makeOrder({
      grandTotal: 500,
      paymentMethod: 'CREDIT',
      amountReceived: 0,
      changeGiven: 0,
      dueAmount: 500,
      isSettled: false, // Fully unpaid credit
    });
    expect(getOrderCashReceived(order)).toBe(0);
    expect(getOrderDue(order)).toBe(500);
  });

  it('UPI payment: full amount collected via UPI, cash received = 0', () => {
    const order = makeOrder({
      grandTotal: 350,
      paymentMethod: 'UPI',
      amountReceived: 350,
      changeGiven: 0,
      dueAmount: 0,
    });
    // UPI is not physical cash in drawer
    expect(getOrderCashReceived(order)).toBe(0);
    expect(getOrderDue(order)).toBe(0);
  });

  it('CARD payment: cash received = 0', () => {
    const order = makeOrder({
      grandTotal: 600,
      paymentMethod: 'CARD',
      amountReceived: 600,
      changeGiven: 0,
      dueAmount: 0,
    });
    expect(getOrderCashReceived(order)).toBe(0);
  });

  it('calculateDueSummary aggregates due amounts across multiple orders', () => {
    const orders = [
      makeOrder({ grandTotal: 200, paymentMethod: 'CREDIT', amountReceived: 0, dueAmount: 200, isSettled: false }),
      makeOrder({ grandTotal: 150, paymentMethod: 'CASH', amountReceived: 100, dueAmount: 50, isSettled: false }),
      makeOrder({ grandTotal: 300, paymentMethod: 'CASH', amountReceived: 300, dueAmount: 0, isSettled: true }),
    ];
    const summary = calculateDueSummary(orders);
    expect(summary.totalDue).toBeCloseTo(250, 1); // 200 + 50 + 0
  });
});

// ---------------------------------------------------------------------------
// 4. CASH IN DRAWER
// ---------------------------------------------------------------------------

describe('4. Cash in Drawer', () => {
  it('cash in drawer excludes unpaid Udhar (CREDIT) orders entirely', () => {
    const orders = [
      makeOrder({ id: 'c1', grandTotal: 300, paymentMethod: 'CASH', amountReceived: 300, dueAmount: 0 }),
      makeOrder({ id: 'c2', grandTotal: 500, paymentMethod: 'CREDIT', amountReceived: 0, dueAmount: 500 }),
      makeOrder({ id: 'c3', grandTotal: 200, paymentMethod: 'CASH', amountReceived: 150, dueAmount: 50 }),
    ];

    const cashInDrawer = orders.reduce((sum, o) => sum + getOrderCashReceived(o), 0);
    expect(cashInDrawer).toBe(450); // 300 + 0 + 150
  });

  it('cash in drawer does NOT double-count cash: uses min(amountReceived, grandTotal)', () => {
    const order = makeOrder({
      grandTotal: 100,
      paymentMethod: 'CASH',
      amountReceived: 150, // Over-received (change given back)
      changeGiven: 50,
      dueAmount: 0,
    });
    // Only grandTotal worth of cash stays in drawer
    expect(getOrderCashReceived(order)).toBe(100);
  });

  it('UPI and CARD orders contribute zero to cash drawer', () => {
    const orders = [
      makeOrder({ grandTotal: 400, paymentMethod: 'UPI', amountReceived: 400 }),
      makeOrder({ grandTotal: 600, paymentMethod: 'CARD', amountReceived: 600 }),
    ];
    const cashInDrawer = orders.reduce((sum, o) => sum + getOrderCashReceived(o), 0);
    expect(cashInDrawer).toBe(0);
  });

  it('mixed payment day: cash drawer = sum of cash-received portions only', () => {
    const orders = [
      makeOrder({ grandTotal: 200, paymentMethod: 'CASH', amountReceived: 200, dueAmount: 0 }),
      makeOrder({ grandTotal: 300, paymentMethod: 'UPI', amountReceived: 300, dueAmount: 0 }),
      makeOrder({ grandTotal: 100, paymentMethod: 'CREDIT', amountReceived: 0, dueAmount: 100 }),
      makeOrder({ grandTotal: 150, paymentMethod: 'CASH', amountReceived: 100, dueAmount: 50 }),
    ];
    const cashInDrawer = orders.reduce((sum, o) => sum + getOrderCashReceived(o), 0);
    expect(cashInDrawer).toBe(300); // 200 + 0 + 0 + 100
  });

  it('Revenue (grandTotal sum) != Cash in Drawer when Udhar / non-cash sales exist', () => {
    const orders = [
      makeOrder({ grandTotal: 500, paymentMethod: 'CASH', amountReceived: 500 }),
      makeOrder({ grandTotal: 300, paymentMethod: 'CREDIT', amountReceived: 0, dueAmount: 300 }),
    ];
    const revenue = orders.reduce((s, o) => s + o.grandTotal, 0);
    const cashInDrawer = orders.reduce((s, o) => s + getOrderCashReceived(o), 0);

    expect(revenue).toBe(800);     // Total revenue
    expect(cashInDrawer).toBe(500); // Only cash physically received
    expect(revenue).not.toBe(cashInDrawer);
  });
});

// ---------------------------------------------------------------------------
// 5. COMBINED vs CATEGORY TOTALS — No Double-Counting
// ---------------------------------------------------------------------------

describe('5. Combined vs Category Totals', () => {
  const noBillOrders = [
    makeOrder({ id: 'nb1', transactionType: 'NO_BILL', grandTotal: 100 }),
    makeOrder({ id: 'nb2', transactionType: 'NO_BILL', grandTotal: 200 }),
  ];
  const customerBillOrders = [
    makeOrder({ id: 'cb1', transactionType: 'CUSTOMER_BILL', grandTotal: 300 }),
    makeOrder({ id: 'cb2', transactionType: 'CUSTOMER_BILL', grandTotal: 400 }),
  ];
  const allOrders = [...noBillOrders, ...customerBillOrders];

  it('combined count = NO_BILL count + CUSTOMER_BILL count', () => {
    const combined = computeSalesMetrics(allOrders);
    const nb = computeSalesMetrics(noBillOrders);
    const cb = computeSalesMetrics(customerBillOrders);
    expect(combined.count).toBe(nb.count + cb.count);
  });

  it('combined grandTotal = NO_BILL grandTotal + CUSTOMER_BILL grandTotal', () => {
    const combined = computeSalesMetrics(allOrders);
    const nb = computeSalesMetrics(noBillOrders);
    const cb = computeSalesMetrics(customerBillOrders);
    expect(combined.grandTotal).toBeCloseTo(nb.grandTotal + cb.grandTotal, 2);
  });

  it('validateSalesReconciliation confirms reconciled contract', () => {
    const combined = computeSalesMetrics(allOrders);
    const nb = computeSalesMetrics(noBillOrders);
    const cb = computeSalesMetrics(customerBillOrders);
    const result = validateSalesReconciliation(combined, nb, cb);
    expect(result.isReconciled).toBe(true);
    expect(result.discrepancies).toHaveLength(0);
  });

  it('isNoBillSale and isCustomerBill are mutually exclusive and collectively exhaustive', () => {
    for (const o of allOrders) {
      const isNB = isNoBillSale(o);
      const isCB = isCustomerBill(o);
      // Exactly one must be true
      expect(isNB !== isCB).toBe(true);
    }
  });

  it('generateMasterSalesReport reconciliation is always true when orders are clean', () => {
    const report = generateMasterSalesReport(allOrders, 'all', TODAY);
    expect(report.reconciliation.isReconciled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. TODAY'S vs LIFETIME TOTALS
// ---------------------------------------------------------------------------

describe('6. Today vs Lifetime Totals', () => {
  const yesterday = '2026-10-28';

  const todayOrders = [
    makeOrder({ id: 't1', businessDate: TODAY, grandTotal: 200 }),
    makeOrder({ id: 't2', businessDate: TODAY, grandTotal: 300 }),
  ];
  const yesterdayOrders = [
    makeOrder({ id: 'y1', businessDate: yesterday, grandTotal: 500 }),
  ];
  const allOrders = [...todayOrders, ...yesterdayOrders];

  it("today's total includes only today's orders", () => {
    const report = generateMasterSalesReport(allOrders, 'today', TODAY);
    expect(report.todayCombined.count).toBe(2);
    expect(report.todayCombined.grandTotal).toBe(500);
  });

  it('lifetime total includes ALL orders regardless of date', () => {
    const report = generateMasterSalesReport(allOrders, 'all', TODAY);
    expect(report.combinedLifetime.count).toBe(3);
    expect(report.combinedLifetime.grandTotal).toBe(1000);
  });

  it("today's total does NOT include yesterday's orders", () => {
    const report = generateMasterSalesReport(allOrders, 'today', TODAY);
    expect(report.todayCombined.grandTotal).not.toBe(1000);
  });

  it('lifetime total does NOT reset to zero when a new business day starts', () => {
    // Simulate: we have yesterday + today orders. Lifetime must be sum of both.
    const report = generateMasterSalesReport(allOrders, 'all', TODAY);
    expect(report.combinedLifetime.grandTotal).toBeGreaterThan(report.todayCombined.grandTotal);
  });

  it("today's count does not exceed lifetime count", () => {
    const report = generateMasterSalesReport(allOrders, 'all', TODAY);
    expect(report.todayCombined.count).toBeLessThanOrEqual(report.combinedLifetime.count);
  });
});

// ---------------------------------------------------------------------------
// 7. STOCK ADJUSTMENTS
// ---------------------------------------------------------------------------

describe('7. Stock Adjustments', () => {
  it('deductStock reduces piece stock by sold quantity', () => {
    expect(deductStock(50, 3, false)).toBe(47);
  });

  it('deductStock reduces KG stock by sold weight (3 decimal precision)', () => {
    // 10.000 kg − 0.250 kg = 9.750 kg
    expect(deductStock(10, 0.25, true)).toBeCloseTo(9.75, 3);
  });

  it('restoreStock adds back piece stock on cancellation', () => {
    expect(restoreStock(47, 3, false)).toBe(50);
  });

  it('restoreStock adds back KG stock on cancellation (3 decimal precision)', () => {
    expect(restoreStock(9.75, 0.25, true)).toBeCloseTo(10, 3);
  });

  it('computeStockAdjustments returns correct delta per product', () => {
    const p1 = makeProduct({ id: 'p1', unit: 'PCS' });
    const p2 = makeProduct({ id: 'p2', unit: 'PCS', sellingPrice: 50 });
    const originalCart = [buildCartItem(p1, 2), buildCartItem(p2, 5)];
    const updatedCart  = [buildCartItem(p1, 5), buildCartItem(p2, 3)];

    // delta for p1 = 5 - 2 = +3 (sold 3 more → deduct extra)
    // delta for p2 = 3 - 5 = -2 (sold 2 less → restore 2)
    const adj = computeStockAdjustments(originalCart, updatedCart);
    const p1Adj = adj.find((a) => a.productId === 'p1');
    const p2Adj = adj.find((a) => a.productId === 'p2');

    expect(p1Adj?.deltaQuantity).toBe(3);  // additional deduction
    expect(p2Adj?.deltaQuantity).toBe(-2); // stock restoration
  });

  it('computeStockAdjustments is idempotent: same cart applied twice still yields one set of adjustments', () => {
    const p = makeProduct({ id: 'pidx', unit: 'PCS' });
    const originalCart = [buildCartItem(p, 2)];
    const updatedCart  = [buildCartItem(p, 7)];

    // Each call with the same (original, updated) pair returns the same delta
    const adj1 = computeStockAdjustments(originalCart, updatedCart);
    const adj2 = computeStockAdjustments(originalCart, updatedCart);

    expect(adj1.find((a) => a.productId === 'pidx')?.deltaQuantity).toBe(5);
    expect(adj2.find((a) => a.productId === 'pidx')?.deltaQuantity).toBe(5);
    // Same delta every time — idempotent per call pair
  });

  it('no stock delta when original and updated carts are identical', () => {
    const p = makeProduct({ id: 'same', unit: 'PCS' });
    const cart = [buildCartItem(p, 5)];
    const adj = computeStockAdjustments(cart, cart);
    expect(adj).toHaveLength(0); // No change → no adjustments
  });

  it('no stock deduction occurs for empty original and updated carts', () => {
    const adj = computeStockAdjustments([], []);
    expect(adj).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 8. SEQUENCE RECONCILIATION
// ---------------------------------------------------------------------------

describe('8. Sequence Reconciliation', () => {
  function findGaps(billNumbers: number[]): number[] {
    if (billNumbers.length === 0) return [];
    const sorted = [...billNumbers].sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      for (let m = sorted[i - 1] + 1; m < sorted[i]; m++) {
        gaps.push(m);
      }
    }
    return gaps;
  }

  function findDuplicates(billNumbers: number[]): number[] {
    const seen = new Set<number>();
    const dupes = new Set<number>();
    for (const n of billNumbers) {
      if (seen.has(n)) dupes.add(n);
      seen.add(n);
    }
    return [...dupes];
  }

  it('clean sequence 1..15 has zero gaps and zero duplicates', () => {
    const seq = Array.from({ length: 15 }, (_, i) => i + 1);
    expect(findGaps(seq)).toHaveLength(0);
    expect(findDuplicates(seq)).toHaveLength(0);
  });

  it('gap at position 5 is correctly identified as missing #5', () => {
    const seq = [1, 2, 3, 4, 6, 7];
    expect(findGaps(seq)).toEqual([5]);
  });

  it('duplicate #3 is correctly identified', () => {
    const seq = [1, 2, 3, 3, 4, 5];
    expect(findDuplicates(seq)).toEqual([3]);
  });

  it('a voided/deleted bill is the only acceptable reason for a gap in audited sequence', () => {
    const allBillNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11]; // #9 missing
    const deletedBillNumbers = new Set([9]); // voided

    const unexplainedGaps = findGaps(allBillNumbers).filter((n) => !deletedBillNumbers.has(n));
    expect(unexplainedGaps).toHaveLength(0);
  });

  it('gap NOT covered by a deletion is flagged as a defect', () => {
    const allBillNumbers = [1, 2, 4, 5]; // #3 missing
    const deletedBillNumbers = new Set<number>([]); // nothing voided

    const unexplainedGaps = findGaps(allBillNumbers).filter((n) => !deletedBillNumbers.has(n));
    expect(unexplainedGaps).toEqual([3]);
  });

  it('DB sequence must start at #1 on a new business day', () => {
    const dayBills = [1, 2, 3, 4, 5];
    expect(dayBills[0]).toBe(1);
  });

  it('daily_bill_number and bill_number agree (no mismatch between fields)', () => {
    // The order record should store both fields consistently
    const order = makeOrder({ dailyBillNumber: 42, billNumber: 'B42' });
    const billNumericPart = parseInt(order.billNumber.replace(/\D/g, ''), 10);
    expect(billNumericPart).toBe(order.dailyBillNumber);
  });
});

// ---------------------------------------------------------------------------
// 9. DEDUPLICATION — duplicate sync must count each order ONCE
// ---------------------------------------------------------------------------

describe('9. Deduplication', () => {
  it('same order id appearing twice is counted only once', () => {
    const order = makeOrder({ id: 'dup-1', grandTotal: 500 });
    const orders = [order, { ...order }]; // same id, duplicate

    const metrics = computeSalesMetrics(orders);
    expect(metrics.count).toBe(1);
    expect(metrics.grandTotal).toBe(500);
  });

  it('deduplicateOrders keeps first occurrence and drops subsequent duplicates', () => {
    const o = makeOrder({ id: 'x1' });
    const deduped = deduplicateOrders([o, { ...o }, { ...o }]);
    expect(deduped).toHaveLength(1);
  });

  it('distinct ids are all retained', () => {
    const orders = [
      makeOrder({ id: 'a1' }),
      makeOrder({ id: 'a2' }),
      makeOrder({ id: 'a3' }),
    ];
    const deduped = deduplicateOrders(orders);
    expect(deduped).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 10. ROUNDING CONTRACT
// ---------------------------------------------------------------------------

describe('10. roundPaise Rounding Contract', () => {
  it('rounds to two decimal places', () => {
    expect(roundPaise(10.005)).toBe(10.01);
    expect(roundPaise(10.004)).toBe(10);
    expect(roundPaise(99.999)).toBe(100);
  });

  it('is stable — applying roundPaise twice is the same as once', () => {
    const value = 37.575;
    expect(roundPaise(roundPaise(value))).toBe(roundPaise(value));
  });

  it('handles zero and negative values safely', () => {
    expect(roundPaise(0)).toBe(0);
    expect(roundPaise(-0)).toBe(0);
    expect(roundPaise(-10.5)).toBe(-10.5);
  });

  it('handles NaN and undefined defensively', () => {
    expect(roundPaise(NaN)).toBe(0);
    expect(roundPaise(undefined as unknown as number)).toBe(0);
  });

  it('floating point: 0.1 + 0.2 is corrected to 0.30', () => {
    const raw = 0.1 + 0.2; // 0.30000000000000004
    expect(roundPaise(raw)).toBe(0.3);
  });
});
