import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderBill } from '../types';
import {
  getDeletedOrderIds,
  recordDeletedOrder,
  syncDeletedOrdersFromRemote,
  isOrderDeleted,
  isDemoOrTestOrder,
  DELETED_ORDERS_STORAGE_KEY,
} from '../lib/orders';
import { fetchDeletedOrdersFromTurso, fetchOrdersFromTurso } from '../lib/turso';

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

describe('AL-BURHANI POS — Cross-Device Real-Time Sync & Convergence', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.restoreAllMocks();
  });

  const orderA: OrderBill = {
    id: 'sale-1792740027290-7915',
    billNumber: 'ALB-NB-7915',
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
    createdAt: '23-Oct-2026, 12:50 pm',
  };

  const tombstonedOrder: OrderBill = {
    id: 'ALB-INV-2726',
    billNumber: 'ALB-INV-2726',
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
    createdAt: '23-Oct-2026, 04:53 pm',
  };

  it('syncDeletedOrdersFromRemote merges remote tombstones into local storage', () => {
    expect(getDeletedOrderIds().size).toBe(0);

    const remoteDeleted = [
      { id: 'ALB-INV-2726', billNumber: 'ALB-INV-2726' },
      { id: 'test-order-999', billNumber: 'TEST-999' },
    ];

    const merged = syncDeletedOrdersFromRemote(remoteDeleted);

    expect(merged.has('ALB-INV-2726')).toBe(true);
    expect(merged.has('test-order-999')).toBe(true);
    expect(isOrderDeleted('ALB-INV-2726')).toBe(true);
    expect(isOrderDeleted(undefined, 'ALB-INV-2726')).toBe(true);
  });

  it('filters out tombstoned orders and prevents them from appearing in valid remote orders', () => {
    syncDeletedOrdersFromRemote([
      { id: 'ALB-INV-2726', billNumber: 'ALB-INV-2726' },
    ]);

    const deletedIds = getDeletedOrderIds();
    const ordersList = [orderA, tombstonedOrder];

    const validOrders = ordersList.filter(
      (ro) => !isDemoOrTestOrder(ro) && !deletedIds.has(ro.id) && (!ro.billNumber || !deletedIds.has(ro.billNumber))
    );

    expect(validOrders).toHaveLength(1);
    expect(validOrders[0].billNumber).toBe('ALB-NB-7915');
    expect(validOrders[0].grandTotal).toBe(200);
  });

  it('prevents stale local orders from resurrecting if they exist in tombstones', () => {
    // Device A had tombstonedOrder saved locally before it was deleted on Device B
    const localSaved = [orderA, tombstonedOrder];
    localStorageMock.setItem('albhurani_orders', JSON.stringify(localSaved));

    // Device A receives tombstone from remote sync
    const remoteDeleted = [{ id: 'ALB-INV-2726', billNumber: 'ALB-INV-2726' }];
    const deletedIds = syncDeletedOrdersFromRemote(remoteDeleted);

    // Filter local orders
    const cleanLocalOrders = localSaved.filter(
      (lo) => lo && lo.id && !isDemoOrTestOrder(lo) && !deletedIds.has(lo.id) && (!lo.billNumber || !deletedIds.has(lo.billNumber))
    );

    expect(cleanLocalOrders).toHaveLength(1);
    expect(cleanLocalOrders[0].id).toBe(orderA.id);
  });

  it('fetchDeletedOrdersFromTurso requests fresh no-cache response from serverless proxy', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        rows: [
          { id: 'ALB-INV-2726', bill_number: 'ALB-INV-2726' },
        ],
      }),
    } as any);

    const result = await fetchDeletedOrdersFromTurso();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    const callInit = fetchSpy.mock.calls[0][1] as RequestInit;

    expect(callUrl).toContain('action=fetch-deleted-orders');
    expect(callUrl).toContain('_t=');
    expect(callInit.cache).toBe('no-store');
    expect(result).toHaveLength(1);
    expect(result![0].billNumber).toBe('ALB-INV-2726');
  });

  it('fetchOrdersFromTurso uses no-store and cache busting timestamp', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        rows: [],
      }),
    } as any);

    await fetchOrdersFromTurso();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    const callInit = fetchSpy.mock.calls[0][1] as RequestInit;

    expect(callUrl).toContain('action=fetch-orders');
    expect(callUrl).toContain('_t=');
    expect(callInit.cache).toBe('no-store');
  });
});
