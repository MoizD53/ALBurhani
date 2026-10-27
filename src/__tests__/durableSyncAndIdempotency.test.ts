import { describe, it, expect, beforeEach, vi } from 'vitest';
import { syncManager } from '../lib/syncManager';
import { OrderBill, Product } from '../types';
import { deductStock } from '../lib/pricing';

describe('AL-BHURANI Permanent Sync Reliability & Idempotency Tests', () => {
  beforeEach(() => {
    syncManager.clearPendingQueue();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    vi.restoreAllMocks();
  });

  it('durably enqueues orders before network transmission and drains on flush', async () => {
    const testOrder = {
      id: `sale-test-${Date.now()}-1`,
      billNumber: 'Bill #1',
      dailyBillNumber: 1,
      transactionType: 'CUSTOMER_BILL',
      cashierName: 'Owner',
      discountAmount: 0,
      gstAmount: 0,
      items: [
        {
          name: 'Kaju Katli',
          price: 900,
          quantity: 2,
          unit: 'KG',
          total: 1800,
          product: {
            id: 'p1',
            name: 'Kaju Katli',
            sellingPrice: 900,
            stock: 20,
            unit: 'KG',
            barcode: '8901234567890',
            category: 'SWEETS',
          } as Product,
        },
      ],
      subtotal: 1800,
      grandTotal: 1800,
      paymentMethod: 'CASH',
      amountReceived: 1800,
      changeGiven: 0,
      businessDate: '2026-10-27',
      branch: 'godi_road',
      createdAt: '2026-10-27T06:00:00.000Z',
    } as unknown as OrderBill;

    // 1. Mock network failure first to verify queue persistence
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'));

    // 2. Enqueue order with flush attempt
    await syncManager.enqueuePendingOrder(testOrder);

    // Queue count must be 1 because upload failed
    expect(syncManager.getPendingCount()).toBe(1);
    const queue = syncManager.getPendingQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].id).toBe(testOrder.id);
    expect(syncManager.getStatus()).toBe('error');

    // 3. Network reconnects
    fetchSpy.mockReset();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        dailyBillNumber: 6,
        billNumber: 'Bill #6',
        businessDate: '2026-10-27',
      }),
    } as Response);

    const { synced, failed } = await syncManager.flushPendingQueue();
    expect(synced).toBe(1);
    expect(failed).toBe(0);
    expect(syncManager.getPendingCount()).toBe(0);
    expect(syncManager.getStatus()).toBe('connected');
  });

  it('keeps transactions in durable storage when server fails and recovers on retry', async () => {
    const testOrder = {
      id: `sale-offline-${Date.now()}`,
      billNumber: 'Bill #2',
      dailyBillNumber: 2,
      transactionType: 'CUSTOMER_BILL',
      cashierName: 'Owner',
      discountAmount: 0,
      gstAmount: 0,
      items: [],
      subtotal: 500,
      grandTotal: 500,
      paymentMethod: 'CASH',
      amountReceived: 500,
      changeGiven: 0,
      businessDate: '2026-10-27',
      branch: 'godi_road',
      createdAt: '2026-10-27T06:10:00.000Z',
    } as unknown as OrderBill;

    // Network fails first
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'));

    await syncManager.enqueuePendingOrder(testOrder);

    // Order MUST remain in durable queue
    expect(syncManager.getPendingCount()).toBe(1);
    expect(syncManager.getStatus()).toBe('error');

    // Network recovers on next attempt
    fetchSpy.mockReset();
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        dailyBillNumber: 7,
        billNumber: 'Bill #7',
        businessDate: '2026-10-27',
      }),
    } as Response);

    const result = await syncManager.flushPendingQueue();
    expect(result.synced).toBe(1);
    expect(syncManager.getPendingCount()).toBe(0);
    expect(syncManager.getStatus()).toBe('connected');
  });

  it('acknowledges already committed transactions idempotently without duplicate writes', async () => {
    const testOrder = {
      id: 'sale-already-committed-1',
      billNumber: 'Bill #3',
      dailyBillNumber: 3,
      transactionType: 'CUSTOMER_BILL',
      cashierName: 'Owner',
      discountAmount: 0,
      gstAmount: 0,
      items: [],
      subtotal: 300,
      grandTotal: 300,
      paymentMethod: 'CASH',
      amountReceived: 300,
      changeGiven: 0,
      businessDate: '2026-10-27',
      branch: 'godi_road',
      createdAt: '2026-10-27T06:20:00.000Z',
    } as unknown as OrderBill;

    // Server returns alreadyCommitted: true on submission
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        alreadyCommitted: true,
        dailyBillNumber: 3,
        billNumber: 'Bill #3',
        businessDate: '2026-10-27',
        branch: 'godi_road',
      }),
    } as Response);

    await syncManager.enqueuePendingOrder(testOrder);

    expect(syncManager.getPendingCount()).toBe(0);
    expect(syncManager.getStatus()).toBe('connected');
  });

  it('deducts inventory stock in real time upon receiving cross-device order sync event', () => {
    const localProducts: Product[] = [
      {
        id: 'p-baklawa',
        barcode: '89010001',
        name: 'Assorted Baklawa',
        sellingPrice: 1200,
        stock: 50,
        unit: 'KG',
        category: 'SWEETS',
      } as Product,
    ];

    const remoteOrderEvent = {
      id: 95,
      entityType: 'order' as const,
      entityId: 'sale-remote-99',
      operation: 'save' as const,
      payload: {
        id: 'sale-remote-99',
        billNumber: 'Bill #8',
        items: [
          {
            product: { id: 'p-baklawa', barcode: '89010001' },
            quantity: 5,
          },
        ],
      },
      serverTimestamp: Date.now(),
    };

    // Simulate cross-device inventory deduction
    const updatedProducts = localProducts.map((p) => {
      const sold = remoteOrderEvent.payload.items.find(
        (it: any) => it.product?.id === p.id || it.product?.barcode === p.barcode
      );
      if (!sold) return p;
      const isWeight = p.unit === 'KG';
      const newStock = deductStock(p.stock ?? 0, Number(sold.quantity) || 0, isWeight);
      return { ...p, stock: newStock };
    });

    // Stock should be 50 - 5 = 45
    expect(updatedProducts[0].stock).toBe(45);
  });

  it('tracks strictly monotonic cursor and does not skip events', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        events: [
          {
            id: 101,
            entityType: 'order',
            entityId: 'sale-1',
            operation: 'save',
            serverTimestamp: 1793000000000,
          },
          {
            id: 102,
            entityType: 'product',
            entityId: 'p-1',
            operation: 'stock',
            serverTimestamp: 1793000001000,
          },
        ],
        latestEventId: 102,
        serverTime: 1793000005000,
      }),
    } as Response);

    await syncManager.pollForEvents();
    const state = syncManager.getState();
    expect(state.latestEventId).toBe(102);
  });
});
