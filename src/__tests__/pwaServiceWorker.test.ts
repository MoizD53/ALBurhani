import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getKolkataDateString, isOrderInDateRange, isExpenseInDateRange } from '../lib/utils';
import { OrderBill, ExpenseItem } from '../types';

describe('PWA & Service Worker Configuration', () => {
  const swPath = path.resolve(__dirname, '../../public/sw.js');
  const mainPath = path.resolve(__dirname, '../../src/main.tsx');

  it('verifies sw.js exists and is bumped to v2 with skipWaiting listener', () => {
    expect(fs.existsSync(swPath)).toBe(true);
    const swContent = fs.readFileSync(swPath, 'utf8');

    // Version bumped
    expect(swContent).toMatch(/CACHE_NAME = 'albhurani-pos-v\d+'/);

    // Skip waiting listener present
    expect(swContent).toContain('SKIP_WAITING');
    expect(swContent).toContain('self.skipWaiting()');

    // Never cache API or Turso DB
    expect(swContent).toContain('isRemoteApiOrDb');
    expect(swContent).toContain('/api');
    expect(swContent).toContain('turso.io');
  });

  it('verifies main.tsx registers SW with updateViaCache: none and controllerchange reload', () => {
    const mainContent = fs.readFileSync(mainPath, 'utf8');

    expect(mainContent).toContain("updateViaCache: 'none'");
    expect(mainContent).toContain('controllerchange');
    expect(mainContent).toContain('registration.update()');
    expect(mainContent).toContain('visibilitychange');
  });

  it('verifies Kolkata date calculations and date range filtering for orders & expenses', () => {
    const nowEpoch = Date.now();
    const todayKolkata = getKolkataDateString(nowEpoch);
    expect(todayKolkata).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const testOrder: OrderBill = {
      id: `sale-${nowEpoch}`,
      billNumber: 'AB-TEST-1',
      transactionType: 'CUSTOMER_BILL',
      items: [],
      subtotal: 100,
      discountAmount: 0,
      gstAmount: 0,
      grandTotal: 100,
      amountReceived: 100,
      changeGiven: 0,
      paymentMethod: 'CASH',
      cashierName: 'Owner',
      timestamp: nowEpoch,
      createdAt: new Date(nowEpoch).toISOString(),
    };

    expect(isOrderInDateRange(testOrder, 'today')).toBe(true);
    expect(isOrderInDateRange(testOrder, '7days')).toBe(true);
    expect(isOrderInDateRange(testOrder, 'month')).toBe(true);
    expect(isOrderInDateRange(testOrder, 'all')).toBe(true);

    const testExpense: ExpenseItem = {
      id: `expense-${nowEpoch}`,
      title: 'Store Cleaning',
      category: 'Store Operations',
      amount: 250,
      date: 'Today, 10:00 AM',
      paymentMode: 'Cash',
    };

    expect(isExpenseInDateRange(testExpense, 'today')).toBe(true);
    expect(isExpenseInDateRange(testExpense, '7days')).toBe(true);
    expect(isExpenseInDateRange(testExpense, 'all')).toBe(true);
  });
});
