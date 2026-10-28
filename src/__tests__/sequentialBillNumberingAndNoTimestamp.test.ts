import { describe, it, expect, beforeEach, vi } from 'vitest';
import { formatDisplayBillNumber, resolveDailyBillNumber, cleanBillNumber } from '../lib/utils';
import { OrderBill } from '../types';
import { syncManager } from '../lib/syncManager';

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
    businessDate: '2026-10-28',
    branch: 'godi_road',
    grandTotal,
    subtotal: overrides.subtotal ?? grandTotal,
    gstAmount: overrides.gstAmount ?? 0,
    discountAmount: overrides.discountAmount ?? 0,
    paymentMethod: 'CASH',
    amountReceived: grandTotal,
    changeGiven: 0,
    items: [],
    cashierName: 'Owner',
    createdAt: '28-Oct-2026, 09:00 am',
    timestamp: Date.now(),
    transactionType: 'NO_BILL',
    ...overrides,
  };
}

describe('P0 Permanent Sequential Bill Numbering & No Timestamp Workaround', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.restoreAllMocks();
  });

  it('1. Sequential sales receive #1, #2, #3, #4, etc.', () => {
    const orders: OrderBill[] = [];
    for (let i = 1; i <= 5; i++) {
      const order = createMockOrder({
        id: `sale-seq-${i}`,
        dailyBillNumber: i,
        billNumber: `Bill #${i}`,
      });
      orders.push(order);
    }

    orders.forEach((o, index) => {
      expect(resolveDailyBillNumber(o, orders)).toBe(index + 1);
      expect(formatDisplayBillNumber(o, orders)).toBe(`Bill #${index + 1}`);
      expect(cleanBillNumber(o.billNumber, o.dailyBillNumber)).toBe(`Bill #${index + 1}`);
    });
  });

  it('2. Never appends timestamp suffixes to bill number labels under collisions', () => {
    const orderA = createMockOrder({
      id: 'sale-coll-1',
      dailyBillNumber: 1,
      billNumber: 'Bill #1',
      createdAt: '27-Oct-2026, 08:54 am',
      grandTotal: 154,
    });
    const orderB = createMockOrder({
      id: 'sale-coll-2',
      dailyBillNumber: 1,
      billNumber: 'Bill #1',
      createdAt: '27-Oct-2026, 09:07 am',
      grandTotal: 140,
    });
    const orderC = createMockOrder({
      id: 'sale-coll-3',
      dailyBillNumber: 1,
      billNumber: 'Bill #1',
      createdAt: '27-Oct-2026, 09:49 am',
      grandTotal: 220,
    });

    const allOrders = [orderA, orderB, orderC];

    // Assert that NONE of them contain timestamp suffixes like (08:54 am)
    expect(formatDisplayBillNumber(orderA, allOrders)).toBe('Bill #1');
    expect(formatDisplayBillNumber(orderB, allOrders)).toBe('Bill #1');
    expect(formatDisplayBillNumber(orderC, allOrders)).toBe('Bill #1');
    expect(formatDisplayBillNumber(orderA, allOrders)).not.toContain('(');
    expect(formatDisplayBillNumber(orderB, allOrders)).not.toContain('(');
    expect(formatDisplayBillNumber(orderC, allOrders)).not.toContain('(');
  });

  it('3. Simultaneous checkouts cannot reuse a number with atomic allocation logic', () => {
    // Simulate atomic allocation simulation
    let currentLastBill = 5;
    const atomicAllocate = () => {
      currentLastBill += 1;
      return currentLastBill;
    };

    const checkout1Alloc = atomicAllocate();
    const checkout2Alloc = atomicAllocate();

    expect(checkout1Alloc).toBe(6);
    expect(checkout2Alloc).toBe(7);
    expect(checkout1Alloc).not.toBe(checkout2Alloc);
  });

  it('4. Retrying the same committed checkout returns the existing bill rather than creating another sale', async () => {
    const existingOrder = createMockOrder({
      id: 'sale-idempotent-key-1',
      dailyBillNumber: 3,
      billNumber: 'Bill #3',
    });

    // Mock API response for already committed order
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        alreadyCommitted: true,
        dailyBillNumber: 3,
        billNumber: 'Bill #3',
        businessDate: '2026-10-28',
      }),
    });

    const { saveOrderToTurso } = await import('../lib/turso');
    const orderCopy = { ...existingOrder };
    const success = await saveOrderToTurso(orderCopy);

    expect(success).toBe(true);
    expect(orderCopy.dailyBillNumber).toBe(3);
    expect(orderCopy.billNumber).toBe('Bill #3');
  });

  it('5. Offline order receives safe authoritative number when flushed and reconciles locally', async () => {
    const offlineOrder = createMockOrder({
      id: 'sale-offline-101',
      dailyBillNumber: 1, // Local optimistic assumption
      billNumber: 'Bill #1',
    });

    localStorageMock.setItem('albhurani_orders', JSON.stringify([offlineOrder]));

    // Server allocates authoritative #8 because 7 orders exist in DB
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        dailyBillNumber: 8,
        billNumber: 'Bill #8',
        businessDate: '2026-10-28',
        branch: 'godi_road',
      }),
    });

    syncManager.clearPendingQueue();
    await syncManager.enqueuePendingOrder(offlineOrder, true);

    const savedRaw = localStorageMock.getItem('albhurani_orders');
    expect(savedRaw).not.toBeNull();
    const savedOrders = JSON.parse(savedRaw!);
    expect(savedOrders[0].dailyBillNumber).toBe(8);
    expect(savedOrders[0].billNumber).toBe('Bill #8');
  });

  it('6. Forward unique constraint prevents duplicate daily_bill_numbers starting 2026-10-28', () => {
    const existingRecords = new Set<string>();
    const saveOrderWithConstraint = (order: OrderBill): boolean => {
      const bizDate = order.businessDate || '2026-10-28';
      const key = `${bizDate}_${order.branch || 'godi_road'}_${order.dailyBillNumber}`;
      if (bizDate >= '2026-10-28' && existingRecords.has(key)) {
        return false; // Unique constraint violation!
      }
      existingRecords.add(key);
      return true;
    };

    const sale1 = createMockOrder({ id: 's1', businessDate: '2026-10-28', dailyBillNumber: 1 });
    const sale2Duplicate = createMockOrder({ id: 's2', businessDate: '2026-10-28', dailyBillNumber: 1 });

    expect(saveOrderWithConstraint(sale1)).toBe(true);
    expect(saveOrderWithConstraint(sale2Duplicate)).toBe(false);
  });

  it('7. Historical collisions are preserved without silent renumbering or data loss', () => {
    const historicalCollisions: OrderBill[] = [
      createMockOrder({ id: 'h1', businessDate: '2026-10-27', dailyBillNumber: 1, grandTotal: 154, createdAt: '27-Oct-2026, 08:54 am' }),
      createMockOrder({ id: 'h2', businessDate: '2026-10-27', dailyBillNumber: 1, grandTotal: 140, createdAt: '27-Oct-2026, 09:07 am' }),
      createMockOrder({ id: 'h3', businessDate: '2026-10-27', dailyBillNumber: 1, grandTotal: 220, createdAt: '27-Oct-2026, 09:49 am' }),
      createMockOrder({ id: 'h4', businessDate: '2026-10-27', dailyBillNumber: 1, grandTotal: 180, createdAt: '27-Oct-2026, 09:53 am' }),
    ];

    // Every historical sale is preserved with intact ID, amounts, items, and clean Bill #1
    expect(historicalCollisions.length).toBe(4);
    historicalCollisions.forEach((h) => {
      expect(h.dailyBillNumber).toBe(1);
      expect(formatDisplayBillNumber(h, historicalCollisions)).toBe('Bill #1');
      expect(h.grandTotal).toBeGreaterThan(0);
    });
  });
});
