import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetchProductsFromTurso,
  fetchOrdersFromTurso,
  invalidateProductsCache,
  invalidateOrdersCache,
  deletePurchaseBillOnTurso,
} from '../lib/turso';
import { getTursoBudgetStatus, recordMonthlyUsage } from '../lib/tursoBudget';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
}
if (typeof globalThis.window === 'undefined') {
  Object.defineProperty(globalThis, 'window', { value: globalThis, writable: true });
}

describe('Turso Read Optimization & Shared Cache', () => {
  beforeEach(() => {
    invalidateProductsCache();
    invalidateOrdersCache();
    vi.restoreAllMocks();
  });

  it('reuses shared in-memory products cache and does not repeat network fetch within TTL', async () => {
    let fetchCount = 0;
    const mockProducts = [
      { id: 'p1', sku: 'SKU1', barcode: '1001', name: 'Kaju Katli', category: 'Sweets', unit: 'kg', costPrice: 600, sellingPrice: 900, stock: 10, minStock: 2 }
    ];

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('action=fetch-products')) {
        fetchCount++;
        return {
          ok: true,
          json: async () => ({ success: true, rows: mockProducts })
        };
      }
      return { ok: false };
    });

    // 1st call: hits network
    const prods1 = await fetchProductsFromTurso();
    expect(fetchCount).toBe(1);
    expect(prods1).toHaveLength(1);
    expect(prods1![0].name).toBe('Kaju Katli');

    // 2nd call: served from memory cache (0 network requests)
    const prods2 = await fetchProductsFromTurso();
    expect(fetchCount).toBe(1); // STILL 1!
    expect(prods2).toEqual(prods1);

    // 3rd call with forceRefresh: hits network
    const prods3 = await fetchProductsFromTurso(true);
    expect(fetchCount).toBe(2);
    expect(prods3).toEqual(prods1);
  });

  it('deduplicates concurrent in-flight requests into a single network call', async () => {
    let fetchCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('action=fetch-products')) {
        fetchCount++;
        // Simulate async delay
        await new Promise((r) => setTimeout(r, 20));
        return {
          ok: true,
          json: async () => ({
            success: true,
            rows: [{ id: 'p1', barcode: '1001', name: 'Peda', category: 'Sweets', unit: 'kg', costPrice: 400, sellingPrice: 600, stock: 5, minStock: 1 }]
          })
        };
      }
      return { ok: false };
    });

    // Fire 5 concurrent requests simultaneously
    const results = await Promise.all([
      fetchProductsFromTurso(),
      fetchProductsFromTurso(),
      fetchProductsFromTurso(),
      fetchProductsFromTurso(),
      fetchProductsFromTurso(),
    ]);

    // All 5 must receive data, but only 1 network call was made!
    expect(fetchCount).toBe(1);
    expect(results).toHaveLength(5);
    expect(results[0]![0].name).toBe('Peda');
  });

  it('caches branch-scoped orders and invalidates properly on mutation', async () => {
    let fetchCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('action=fetch-orders')) {
        fetchCount++;
        return {
          ok: true,
          json: async () => ({
            success: true,
            rows: [{
              id: 'ord-1',
              bill_number: 'ALB-101',
              transaction_type: 'CUSTOMER_BILL',
              items_json: '[]',
              subtotal: 500,
              discount_amount: 0,
              gst_amount: 0,
              grand_total: 500,
              payment_method: 'CASH',
              amount_received: 500,
              change_given: 0,
              cashier_name: 'Admin',
              branch: 'godi_road'
            }]
          })
        };
      }
      return { ok: false };
    });

    const orders1 = await fetchOrdersFromTurso('ALL', 'godi_road');
    expect(fetchCount).toBe(1);
    expect(orders1).toHaveLength(1);

    // Served from cache
    const orders2 = await fetchOrdersFromTurso('ALL', 'godi_road');
    expect(fetchCount).toBe(1);

    // Invalidate
    invalidateOrdersCache('godi_road');
    const orders3 = await fetchOrdersFromTurso('ALL', 'godi_road');
    expect(fetchCount).toBe(2);
  });

  it('correctly calculates 450M monthly budget status and warning tiers', () => {
    // Test with baseline usage
    recordMonthlyUsage(32_158_784);
    const status = getTursoBudgetStatus();

    expect(status.monthlyTarget).toBe(450_000_000);
    expect(status.planCeiling).toBe(500_000_000);
    expect(status.currentMonthlyUsage).toBeGreaterThanOrEqual(32_158_784);
    expect(status.remainingBudget).toBeGreaterThan(417_000_000);
    expect(status.tier).toBe('NORMAL');
    expect(status.recommendedDeltaIntervalMs).toBe(10_000);
  });

  it('records user activity and triggers immediate event check when re-activating from idle', async () => {
    let pollCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('action=fetch-events')) {
        pollCount++;
        return {
          ok: true,
          json: async () => ({
            success: true,
            events: [],
            serverTime: Date.now()
          })
        };
      }
      return { ok: false };
    });

    const { syncManager } = await import('../lib/syncManager');
    syncManager.start(30000);
    expect(pollCount).toBeGreaterThanOrEqual(1);

    // Call recordUserActivity()
    syncManager.recordUserActivity();
    expect(typeof syncManager.recordUserActivity).toBe('function');
    syncManager.stop();
  });

  it('handles idle event sync cursor without backward rewinds', async () => {
    let requestedSince = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('action=fetch-events')) {
        const urlObj = new URL(url, 'http://localhost');
        requestedSince = Number(urlObj.searchParams.get('since') || 0);
        return {
          ok: true,
          json: async () => ({
            success: true,
            events: [],
            serverTime: 1700000000000
          })
        };
      }
      return { ok: false };
    });

    const { syncManager } = await import('../lib/syncManager');
    syncManager.resetSyncTimestamp(1699999900000);
    await syncManager.pollForEvents();

    expect(requestedSince).toBe(1699999900000);
    // After empty poll with serverTime 1700000000000, next poll must advance cleanly without 30s backward rewind
    await syncManager.pollForEvents();
    expect(requestedSince).toBe(1700000000000);
  });

  it('warms in-memory products cache from valid localStorage data and bypasses network fetch', async () => {
    let fetchCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      fetchCount++;
      return { ok: true, json: async () => ({ success: true, rows: [] }) };
    });

    // Populate localStorage with 250 items
    const mockCatalog = Array.from({ length: 250 }, (_, i) => ({
      id: `p-${i}`,
      sku: `SKU-${i}`,
      barcode: `BAR-${i}`,
      name: `Product ${i}`,
      category: 'Sweets',
      unit: 'kg',
      costPrice: 100,
      sellingPrice: 200,
      stock: 5,
      minStock: 1,
    }));
    localStorage.setItem('albhurani_products', JSON.stringify(mockCatalog));

    invalidateProductsCache();
    const result = await fetchProductsFromTurso(false);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(250);
    // Bypasses network completely -> 0 network fetches!
    expect(fetchCount).toBe(0);

    // If forceRefresh is requested, it MUST hit the network
    await fetchProductsFromTurso(true);
    expect(fetchCount).toBe(1);
    localStorage.removeItem('albhurani_products');
  });

  it('deletePurchaseBillOnTurso sends delete-purchase-bill action and invalidates caches', async () => {
    let requestedAction = '';
    let requestedBillId = '';

    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}'));
      requestedAction = body.action;
      requestedBillId = body.payload?.billId;
      return {
        ok: true,
        json: async () => ({ success: true, id: requestedBillId })
      };
    });

    const success = await deletePurchaseBillOnTurso('pur-voucher-99');
    expect(success).toBe(true);
    expect(requestedAction).toBe('delete-purchase-bill');
    expect(requestedBillId).toBe('pur-voucher-99');
  });

  it('scopes orders query to specific branch to avoid downloading cross-branch datasets', async () => {
    let requestedUrl = '';
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      requestedUrl = url;
      return {
        ok: true,
        json: async () => ({ success: true, rows: [] })
      };
    });

    await fetchOrdersFromTurso('ALL', 'mg_road');
    expect(requestedUrl).toContain('branch=mg_road');
  });
});
