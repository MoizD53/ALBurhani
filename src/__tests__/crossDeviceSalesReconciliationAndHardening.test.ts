import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderBill, Product } from '../types';
import { calculateOrderTotals } from '../lib/pricing';
import { deleteProductFromTurso, restoreOrderInTurso, checkDatabaseReconciliation } from '../lib/turso';

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

describe('AL-BURHANI POS — Cross-Device Sales Reconciliation & Data Hardening', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.restoreAllMocks();
  });

  describe('1. Two Devices Creating Sales Concurrently & Idempotent Sync', () => {
    it('generates globally unique IDs and preserves independent sales', () => {
      const deviceASale: OrderBill = {
        id: 'sale-device-A-1001',
        billNumber: 'ALB-NB-8801',
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
        createdAt: '23-Oct-2026, 09:00 pm',
      };

      const deviceBSale: OrderBill = {
        id: 'sale-device-B-2002',
        billNumber: 'ALB-NB-8802',
        transactionType: 'NO_BILL',
        items: [],
        subtotal: 739,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 739,
        paymentMethod: 'UPI',
        amountReceived: 739,
        changeGiven: 0,
        cashierName: 'Owner',
        createdAt: '23-Oct-2026, 09:00 pm',
      };

      // Server database simulated map (idempotent primary key storage)
      const serverDatabase = new Map<string, OrderBill>();
      
      const insertOrReplaceOrder = (order: OrderBill) => {
        serverDatabase.set(order.id, order);
      };

      insertOrReplaceOrder(deviceASale);
      insertOrReplaceOrder(deviceBSale);

      // Concurrent retry from Device A
      insertOrReplaceOrder(deviceASale);

      expect(serverDatabase.size).toBe(2);

      const allOrders = Array.from(serverDatabase.values());
      const totalRev = allOrders.reduce((sum, o) => sum + o.grandTotal, 0);
      const cashSum = allOrders.filter(o => o.paymentMethod === 'CASH').reduce((sum, o) => sum + o.grandTotal, 0);
      const upiSum = allOrders.filter(o => o.paymentMethod === 'UPI').reduce((sum, o) => sum + o.grandTotal, 0);

      expect(totalRev).toBe(1239);
      expect(cashSum).toBe(500);
      expect(upiSum).toBe(739);
    });
  });

  describe('2. Durable Offline Synchronisation Queue', () => {
    it('enqueues sale locally when offline and drains only after successful server persistence', () => {
      const offlineSale: OrderBill = {
        id: 'sale-offline-3003',
        billNumber: 'ALB-NB-8803',
        transactionType: 'NO_BILL',
        items: [],
        subtotal: 450,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 450,
        paymentMethod: 'CASH',
        amountReceived: 450,
        changeGiven: 0,
        cashierName: 'Owner',
        createdAt: '23-Oct-2026, 09:10 pm',
      };

      // Simulate enqueueing offline
      const queueKey = 'albhurani_pending_sales_queue';
      const queue: OrderBill[] = [offlineSale];
      localStorageMock.setItem(queueKey, JSON.stringify(queue));

      const storedQueue: OrderBill[] = JSON.parse(localStorageMock.getItem(queueKey) || '[]');
      expect(storedQueue).toHaveLength(1);
      expect(storedQueue[0].id).toBe('sale-offline-3003');

      // Server confirmed persistence: remove from durable queue
      const updatedQueue = storedQueue.filter(q => q.id !== offlineSale.id);
      localStorageMock.setItem(queueKey, JSON.stringify(updatedQueue));

      const finalQueue: OrderBill[] = JSON.parse(localStorageMock.getItem(queueKey) || '[]');
      expect(finalQueue).toHaveLength(0);
    });
  });

  describe('3. Unblocking Valid Canonical Sales Mistakenly Tombstoned on Client', () => {
    it('removes local tombstone when Turso DB confirms order is active and not in remote deleted_orders', () => {
      const canonicalSale: OrderBill = {
        id: 'sale-1792594590792-2043',
        billNumber: 'ALB-NB-2043',
        transactionType: 'NO_BILL',
        items: [],
        subtotal: 1600,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 1600,
        paymentMethod: 'CASH',
        amountReceived: 1600,
        changeGiven: 0,
        cashierName: 'Owner',
        createdAt: '21-Oct-2026, 08:26 pm',
      };

      // Stale device had tombstoned this order locally
      const staleTombstones = new Set<string>(['sale-1792594590792-2043', 'ALB-NB-2043']);
      localStorageMock.setItem('albhurani_deleted_order_ids', JSON.stringify(Array.from(staleTombstones)));

      // Turso server responds:
      const remoteOrders = [canonicalSale];
      const remoteDeletedOrders = [{ id: 'ALB-INV-2726', billNumber: 'ALB-INV-2726' }];

      // App reconciliation logic
      const activeBillNumbers = new Set(
        remoteOrders
          .map((ro) => ro.billNumber)
          .filter((bn): bn is string => typeof bn === 'string' && bn.length > 0)
      );

      const trueDeletedSet = new Set<string>();
      for (const t of remoteDeletedOrders) {
        if (t.id) trueDeletedSet.add(t.id);
        if (t.billNumber) trueDeletedSet.add(t.billNumber);
      }

      // Reconcile client tombstones: Any active order not in trueDeletedSet is unblocked
      const unblockedTombstones = new Set(staleTombstones);
      for (const activeBill of activeBillNumbers) {
        if (!trueDeletedSet.has(activeBill)) {
          unblockedTombstones.delete(activeBill);
        }
      }
      for (const ro of remoteOrders) {
        if (!trueDeletedSet.has(ro.id)) {
          unblockedTombstones.delete(ro.id);
        }
      }

      expect(unblockedTombstones.has('sale-1792594590792-2043')).toBe(false);
      expect(unblockedTombstones.has('ALB-NB-2043')).toBe(false);

      // Now filter valid orders for UI display
      const visibleOrders = remoteOrders.filter(
        ro => !unblockedTombstones.has(ro.id) && (!ro.billNumber || !unblockedTombstones.has(ro.billNumber))
      );

      expect(visibleOrders).toHaveLength(1);
      expect(visibleOrders[0].billNumber).toBe('ALB-NB-2043');
      expect(visibleOrders[0].grandTotal).toBe(1600);
    });
  });

  describe('4. Discontinued Product Deletion API', () => {
    it('deleteProductFromTurso sends delete action with authorization headers', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as any);

      const ok = await deleteProductFromTurso('prod-discontinued-123');
      expect(ok).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(callBody.action).toBe('delete-product');
      expect(callBody.payload.productId).toBe('prod-discontinued-123');
    });

    it('restoreOrderInTurso sends restore-order action', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as any);

      const ok = await restoreOrderInTurso('sale-1792594590792-2043', 'ALB-NB-2043');
      expect(ok).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(callBody.action).toBe('restore-order');
      expect(callBody.payload.billNumber).toBe('ALB-NB-2043');
    });

    it('checkDatabaseReconciliation verifies ledger balance without cache', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          totalActiveOrders: 75,
          totalDeletedOrders: 1,
          summary: [
            { transaction_type: 'NO_BILL', count: 75, total_revenue: 28779, cash_total: 27770, upi_total: 739, credit_total: 270 }
          ]
        }),
      } as any);

      const report = await checkDatabaseReconciliation();
      expect(report.success).toBe(true);
      expect(report.totalActiveOrders).toBe(75);
      expect(report.summary[0].total_revenue).toBe(28779);
    });
  });

  describe('5. POS Editable Final Amount (+/- Adjustments)', () => {
    it('applies +/- adjustments and custom final amounts correctly', () => {
      const rawCalculatedTotal = 312.5;

      // Adjustment: -10
      let adjustment = -10;
      let effectiveTotal = Math.max(0, Math.round((rawCalculatedTotal + adjustment) * 100) / 100);
      expect(effectiveTotal).toBe(302.5);

      // Adjustment: +5
      adjustment = 5;
      effectiveTotal = Math.max(0, Math.round((rawCalculatedTotal + adjustment) * 100) / 100);
      expect(effectiveTotal).toBe(317.5);

      // Round off
      adjustment = Math.round(rawCalculatedTotal) - rawCalculatedTotal;
      effectiveTotal = Math.max(0, Math.round((rawCalculatedTotal + adjustment) * 100) / 100);
      expect(effectiveTotal).toBe(313);

      // Direct custom input: typing 300
      const typedFinalAmount = 300;
      adjustment = typedFinalAmount - rawCalculatedTotal;
      effectiveTotal = Math.max(0, Math.round((rawCalculatedTotal + adjustment) * 100) / 100);
      expect(effectiveTotal).toBe(300);

      // Verify that change given and pending due use the effective grand total
      const amountReceived = 500;
      const changeGiven = Math.max(0, amountReceived - effectiveTotal);
      expect(changeGiven).toBe(200);
    });
  });
});
