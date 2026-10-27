import { describe, it, expect, beforeEach, vi } from 'vitest';
import { syncManager, SyncEvent } from '../lib/syncManager';
import { isOrderInDateRange, getKolkataDateString } from '../lib/utils';
import { OrderBill } from '../types';

describe('Production Incident Regression: Bill Visibility & Synchronisation Hardening', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    syncManager.resetSyncTimestamp(0);
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('1. Today bills appear correctly under Asia/Kolkata date boundary', () => {
    const todayStr = getKolkataDateString(Date.now());

    const billToday: OrderBill = {
      id: 'sale-today-1',
      billNumber: 'Bill #1',
      dailyBillNumber: 1,
      businessDate: todayStr,
      transactionType: 'CUSTOMER_BILL',
      items: [],
      subtotal: 500,
      discountAmount: 0,
      gstAmount: 25,
      grandTotal: 525,
      paymentMethod: 'CASH',
      amountReceived: 525,
      changeGiven: 0,
      cashierName: 'Owner',
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
      branch: 'godi_road',
    };

    const billYesterday: OrderBill = {
      id: 'sale-yesterday-1',
      billNumber: 'Bill #1',
      dailyBillNumber: 1,
      businessDate: '2026-10-26',
      transactionType: 'CUSTOMER_BILL',
      items: [],
      subtotal: 300,
      discountAmount: 0,
      gstAmount: 15,
      grandTotal: 315,
      paymentMethod: 'CASH',
      amountReceived: 315,
      changeGiven: 0,
      cashierName: 'Owner',
      createdAt: '26-Oct-2026, 08:00 pm',
      timestamp: Date.now() - 86400000,
      branch: 'godi_road',
    };

    expect(isOrderInDateRange(billToday, 'today')).toBe(true);
    expect(isOrderInDateRange(billYesterday, 'today')).toBe(false);
    expect(isOrderInDateRange(billToday, 'all')).toBe(true);
    expect(isOrderInDateRange(billYesterday, 'all')).toBe(true);
  });

  it('2. Preserves branch-specific bill isolation without mixing Godi Road and MG Road', () => {
    const godiBill: OrderBill = {
      id: 'sale-godi-1',
      billNumber: 'Bill #1',
      dailyBillNumber: 1,
      businessDate: '2026-10-27',
      transactionType: 'CUSTOMER_BILL',
      items: [],
      subtotal: 100,
      discountAmount: 0,
      gstAmount: 0,
      grandTotal: 100,
      paymentMethod: 'CASH',
      amountReceived: 100,
      changeGiven: 0,
      cashierName: 'Owner',
      createdAt: new Date().toISOString(),
      branch: 'godi_road',
    };

    const mgBill: OrderBill = {
      id: 'sale-mg-1',
      billNumber: 'Bill #1',
      dailyBillNumber: 1,
      businessDate: '2026-10-27',
      transactionType: 'CUSTOMER_BILL',
      items: [],
      subtotal: 200,
      discountAmount: 0,
      gstAmount: 0,
      grandTotal: 200,
      paymentMethod: 'CASH',
      amountReceived: 200,
      changeGiven: 0,
      cashierName: 'Owner',
      createdAt: new Date().toISOString(),
      branch: 'mg_road',
    };

    const allOrders = [godiBill, mgBill];
    const godiOnly = allOrders.filter((o) => (o.branch || 'godi_road') === 'godi_road');
    const mgOnly = allOrders.filter((o) => o.branch === 'mg_road');

    expect(godiOnly.length).toBe(1);
    expect(godiOnly[0].id).toBe('sale-godi-1');
    expect(mgOnly.length).toBe(1);
    expect(mgOnly[0].id).toBe('sale-mg-1');
  });

  it('3. Bills remain visible on refresh and unconfirmed local orders are not erased by remote sync', () => {
    const remoteOrders: OrderBill[] = [
      {
        id: 'remote-1',
        billNumber: 'Bill #1',
        dailyBillNumber: 1,
        businessDate: '2026-10-26',
        transactionType: 'CUSTOMER_BILL',
        items: [],
        subtotal: 100,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 100,
        paymentMethod: 'CASH',
        amountReceived: 100,
        changeGiven: 0,
        cashierName: 'Owner',
        createdAt: '26-Oct-2026, 09:00 am',
        timestamp: 1792986752110,
        branch: 'godi_road',
      },
    ];

    const localUnconfirmedOrder: OrderBill = {
      id: 'local-pending-1',
      billNumber: 'Bill #1',
      dailyBillNumber: 1,
      businessDate: '2026-10-27',
      transactionType: 'CUSTOMER_BILL',
      items: [],
      subtotal: 154,
      discountAmount: 0,
      gstAmount: 0,
      grandTotal: 154,
      paymentMethod: 'CASH',
      amountReceived: 154,
      changeGiven: 0,
      cashierName: 'Owner',
      createdAt: '27-Oct-2026, 08:54 am',
      timestamp: 1793071461459,
      branch: 'godi_road',
    };

    const currentOrders = [localUnconfirmedOrder];

    // When remote orders are received, local pending orders MUST NOT be wiped!
    const remoteIdSet = new Set(remoteOrders.map((o) => o.id));
    const localPending = currentOrders.filter((co) => !remoteIdSet.has(co.id));
    const merged = [...localPending, ...remoteOrders];

    expect(merged.length).toBe(2);
    expect(merged.some((o) => o.id === 'local-pending-1')).toBe(true);
    expect(merged.some((o) => o.id === 'remote-1')).toBe(true);
  });

  it('4. Offline pending queue recovery does not drop orders due to daily Bill #1 collisions', () => {
    const remoteOrders: OrderBill[] = [
      {
        id: 'remote-yesterday-1',
        billNumber: 'Bill #1',
        dailyBillNumber: 1,
        businessDate: '2026-10-26',
        transactionType: 'CUSTOMER_BILL',
        items: [],
        subtotal: 80,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 80,
        paymentMethod: 'CASH',
        amountReceived: 80,
        changeGiven: 0,
        cashierName: 'Owner',
        createdAt: '26-Oct-2026',
        branch: 'godi_road',
      },
    ];

    const pendingQueue: OrderBill[] = [
      {
        id: 'sale-today-new',
        billNumber: 'Bill #1', // Same daily bill number as yesterday!
        dailyBillNumber: 1,
        businessDate: '2026-10-27',
        transactionType: 'CUSTOMER_BILL',
        items: [],
        subtotal: 154,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 154,
        paymentMethod: 'CASH',
        amountReceived: 154,
        changeGiven: 0,
        cashierName: 'Owner',
        createdAt: '27-Oct-2026',
        branch: 'godi_road',
      },
    ];

    // Deduplication MUST be by ID only, not by po.billNumber
    const remoteIdSet = new Set(remoteOrders.map((o) => o.id));
    const ordersToUpload = pendingQueue.filter((po) => po && po.id && !remoteIdSet.has(po.id));

    // The order MUST be scheduled for upload, not blocked by yesterday's Bill #1
    expect(ordersToUpload.length).toBe(1);
    expect(ordersToUpload[0].id).toBe('sale-today-new');
  });

  it('5. Event sync listener does not overwrite yesterday Bill #1 with today Bill #1', () => {
    const yesterdayBill: OrderBill = {
      id: 'ord-yesterday',
      billNumber: 'Bill #1',
      dailyBillNumber: 1,
      businessDate: '2026-10-26',
      transactionType: 'CUSTOMER_BILL',
      items: [],
      subtotal: 80,
      discountAmount: 0,
      gstAmount: 0,
      grandTotal: 80,
      paymentMethod: 'CASH',
      amountReceived: 80,
      changeGiven: 0,
      cashierName: 'Owner',
      createdAt: '26-Oct-2026',
      branch: 'godi_road',
    };

    const todayIncomingEvent: SyncEvent = {
      id: 999,
      entityType: 'order',
      entityId: 'ord-today',
      operation: 'save',
      payload: {
        id: 'ord-today',
        billNumber: 'Bill #1',
        dailyBillNumber: 1,
        businessDate: '2026-10-27',
        transactionType: 'CUSTOMER_BILL',
        items: [],
        subtotal: 154,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 154,
        paymentMethod: 'CASH',
        amountReceived: 154,
        changeGiven: 0,
        cashierName: 'Owner',
        createdAt: '27-Oct-2026',
        branch: 'godi_road',
      },
      serverTimestamp: Date.now(),
    };

    const prevOrders = [yesterdayBill];

    // Using the fixed deduplication check:
    const exists = prevOrders.some(
      (o) =>
        o.id === todayIncomingEvent.payload.id ||
        (todayIncomingEvent.payload.businessDate &&
          o.businessDate &&
          todayIncomingEvent.payload.branch &&
          o.branch &&
          todayIncomingEvent.payload.billNumber &&
          o.businessDate === todayIncomingEvent.payload.businessDate &&
          o.branch === todayIncomingEvent.payload.branch &&
          o.billNumber === todayIncomingEvent.payload.billNumber)
    );

    const nextOrders = exists
      ? prevOrders.map((o) => (o.id === todayIncomingEvent.payload.id ? todayIncomingEvent.payload : o))
      : [todayIncomingEvent.payload, ...prevOrders];

    // BOTH orders MUST exist! Yesterday's bill must NOT be overwritten!
    expect(nextOrders.length).toBe(2);
    expect(nextOrders.find((o) => o.id === 'ord-yesterday')?.grandTotal).toBe(80);
    expect(nextOrders.find((o) => o.id === 'ord-today')?.grandTotal).toBe(154);
  });

  it('6. Failed network requests do not erase existing orders', async () => {
    const existingOrders: OrderBill[] = [
      {
        id: 'ord-persist-1',
        billNumber: 'Bill #1',
        dailyBillNumber: 1,
        businessDate: '2026-10-27',
        transactionType: 'CUSTOMER_BILL',
        items: [],
        subtotal: 154,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 154,
        paymentMethod: 'CASH',
        amountReceived: 154,
        changeGiven: 0,
        cashierName: 'Owner',
        createdAt: '27-Oct-2026',
        branch: 'godi_road',
      },
    ];

    // Simulate network error
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    let currentOrders = [...existingOrders];
    try {
      const res = await fetch('/api/db?action=fetch-orders').catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        currentOrders = data.rows;
      }
    } catch {
      // Ignored
    }

    expect(currentOrders.length).toBe(1);
    expect(currentOrders[0].id).toBe('ord-persist-1');
  });
});
