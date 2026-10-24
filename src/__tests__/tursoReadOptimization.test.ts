import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetchProductsFromTurso,
  fetchOrdersFromTurso,
  invalidateProductsCache,
  invalidateOrdersCache,
} from '../lib/turso';
import { getTursoBudgetStatus, recordMonthlyUsage } from '../lib/tursoBudget';

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
    recordMonthlyUsage(28_866_605);
    const status = getTursoBudgetStatus();

    expect(status.monthlyTarget).toBe(450_000_000);
    expect(status.planCeiling).toBe(500_000_000);
    expect(status.currentMonthlyUsage).toBeGreaterThanOrEqual(28_866_605);
    expect(status.remainingBudget).toBeGreaterThan(400_000_000);
    expect(status.tier).toBe('NORMAL');
    expect(status.recommendedDeltaIntervalMs).toBe(10_000);
  });
});
