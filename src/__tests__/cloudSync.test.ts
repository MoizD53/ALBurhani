import { describe, it, expect, beforeEach, vi } from 'vitest';
import { syncManager, SyncEvent } from '../lib/syncManager';
import { 
  fetchOrdersFromTurso, 
  saveOrderToTurso, 
  batchSaveOrdersToTurso,
  fetchSettingsFromTurso,
  saveSettingToTurso
} from '../lib/turso';
import { OrderBill } from '../types';

describe('Real-Time Cloud Synchronization & Settings Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    syncManager.resetSyncTimestamp(0);
  });

  it('syncManager accurately transitions status and notifies listeners', () => {
    const statuses: string[] = [];
    const unsubscribe = syncManager.onStatusChange((status) => {
      statuses.push(status);
    });

    syncManager.setStatus('syncing');
    syncManager.setStatus('connected');
    syncManager.setStatus('offline');

    expect(statuses).toContain('syncing');
    expect(statuses).toContain('connected');
    expect(statuses).toContain('offline');
    unsubscribe();
  });

  it('syncManager deduplicates repeated sync events', async () => {
    const receivedEvents: SyncEvent[] = [];
    const unsubscribe = syncManager.subscribe('order', (ev) => {
      receivedEvents.push(ev);
    });

    // Mock fetch response with duplicate event ID
    const mockEvents: SyncEvent[] = [
      {
        id: 101,
        entityType: 'order',
        entityId: 'ord-101',
        operation: 'save',
        payload: { id: 'ord-101', billNumber: 'ALB-INV-101' },
        serverTimestamp: 1700000001000,
      },
      {
        id: 101, // Duplicate ID
        entityType: 'order',
        entityId: 'ord-101',
        operation: 'save',
        payload: { id: 'ord-101', billNumber: 'ALB-INV-101' },
        serverTimestamp: 1700000001000,
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        events: mockEvents,
        serverTime: 1700000002000,
      }),
    });

    await syncManager.pollForEvents();

    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0].entityId).toBe('ord-101');
    unsubscribe();
  });

  it('batchSaveOrdersToTurso sends batch-save-orders payload correctly', async () => {
    const mockOrders: OrderBill[] = [
      {
        id: 'ord-sync-1',
        billNumber: 'ALB-INV-001',
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
      },
    ];

    let capturedBody: any = null;
    globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
      capturedBody = JSON.parse(init.body);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, count: 1 }),
      });
    });

    const success = await batchSaveOrdersToTurso(mockOrders);
    expect(success).toBe(true);
    expect(capturedBody.action).toBe('batch-save-orders');
    expect(capturedBody.payload.length).toBe(1);
    expect(capturedBody.payload[0].billNumber).toBe('ALB-INV-001');
  });

  it('fetchSettingsFromTurso and saveSettingToTurso manage shared owner configuration', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url, init) => {
      if (init && init.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          setting: {
            key: 'label_preset',
            value: 'novajet-48l',
            updatedAt: new Date().toISOString(),
          },
        }),
      });
    });

    const saveSuccess = await saveSettingToTurso('label_preset', 'novajet-48l');
    expect(saveSuccess).toBe(true);

    const settings = await fetchSettingsFromTurso('label_preset');
    expect(settings).not.toBeNull();
    expect(settings?.label_preset).toBe('novajet-48l');
  });

  it('preserves CUSTOMER_BILL and NO_BILL distinction in fetchOrdersFromTurso', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      expect(url).toContain('action=fetch-orders');
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          rows: [
            {
              id: 'gst-1',
              bill_number: 'ALB-INV-01',
              transaction_type: 'CUSTOMER_BILL',
              items_json: '[]',
              subtotal: 100,
              discount_amount: 0,
              gst_amount: 5,
              grand_total: 105,
              payment_method: 'CASH',
              amount_received: 105,
              change_given: 0,
              cashier_name: 'Owner',
              created_at: '2026-10-20T10:00:00Z',
            },
            {
              id: 'nobill-1',
              bill_number: 'ALB-NOBILL-01',
              transaction_type: 'NO_BILL',
              items_json: '[]',
              subtotal: 50,
              discount_amount: 0,
              gst_amount: 0,
              grand_total: 50,
              payment_method: 'UPI',
              amount_received: 50,
              change_given: 0,
              cashier_name: 'Owner',
              created_at: '2026-10-20T10:05:00Z',
            },
          ],
        }),
      });
    });

    const orders = await fetchOrdersFromTurso();
    expect(orders).not.toBeNull();
    expect(orders?.length).toBe(2);
    expect(orders?.find((o) => o.id === 'gst-1')?.transactionType).toBe('CUSTOMER_BILL');
    expect(orders?.find((o) => o.id === 'nobill-1')?.transactionType).toBe('NO_BILL');
  });
});
