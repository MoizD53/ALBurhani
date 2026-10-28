import { OrderBill, CartItem } from '../types';
import { isWeightBasedProduct } from './pricing';

export const DELETED_ORDERS_STORAGE_KEY = 'albhurani_deleted_order_ids';

/**
 * Checks whether a string is a daily sequential bill number (e.g., "Bill #15", "Bill #1", "Bill 18").
 * Daily bill numbers MUST NEVER be used as tombstones because they repeat every single day!
 */
export function isDailyBillNumberString(str?: string): boolean {
  if (!str) return false;
  return /^Bill\s*#?\s*\d+$/i.test(str.trim());
}

/**
 * Retrieves the set of deleted order IDs and bill numbers from localStorage tombstones.
 * Automatically sanitizes any daily bill numbers (e.g. "Bill #15") to protect historical sales.
 */
export function getDeletedOrderIds(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DELETED_ORDERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out any accidentally stored daily bill numbers (e.g. 'Bill #15', 'Bill #18', 'Bill #30')
        // to prevent cross-day bill wiping.
        const cleaned = parsed
          .map((item) => String(item).trim())
          .filter((item) => Boolean(item) && !isDailyBillNumberString(item));

        // If invalid daily bill strings were purged, update localStorage immediately
        if (cleaned.length !== parsed.length) {
          try {
            localStorage.setItem(DELETED_ORDERS_STORAGE_KEY, JSON.stringify(cleaned));
          } catch {}
        }
        return new Set(cleaned);
      }
    }
  } catch (err) {
    console.warn('Failed to parse deleted order IDs from localStorage:', err);
  }
  return new Set();
}

/**
 * Persistently records a deleted order ID and bill number into tombstones so that
 * remote Turso synchronization or offline-recovery cannot resurrect it.
 * Strictly ignores daily bill numbers (e.g. "Bill #15") to avoid wiping transactions across different days.
 */
export function recordDeletedOrder(id: string, billNumber?: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const set = getDeletedOrderIds();
    if (id && id.trim() && !isDailyBillNumberString(id)) {
      set.add(id.trim());
    }
    // Only record billNumber if it is a globally unique invoice number (e.g., ALB-INV-2726), never a daily sequential bill
    if (billNumber && billNumber.trim() && !isDailyBillNumberString(billNumber)) {
      set.add(billNumber.trim());
    }
    localStorage.setItem(DELETED_ORDERS_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.warn('Failed to record deleted order tombstone:', err);
  }
}

/**
 * Synchronizes remote deleted order tombstones from Turso cloud into local device storage.
 * Strictly guards against daily bill numbers.
 */
export function syncDeletedOrdersFromRemote(remoteDeleted: { id: string; billNumber?: string }[]): Set<string> {
  const localSet = getDeletedOrderIds();
  let modified = false;

  for (const item of remoteDeleted) {
    if (item.id && item.id.trim() && !isDailyBillNumberString(item.id) && !localSet.has(item.id.trim())) {
      localSet.add(item.id.trim());
      modified = true;
    }
    if (item.billNumber && item.billNumber.trim() && !isDailyBillNumberString(item.billNumber) && !localSet.has(item.billNumber.trim())) {
      localSet.add(item.billNumber.trim());
      modified = true;
    }
  }

  if (modified && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(DELETED_ORDERS_STORAGE_KEY, JSON.stringify(Array.from(localSet)));
    } catch (err) {
      console.warn('Failed to save merged tombstones:', err);
    }
  }

  return localSet;
}

/**
 * Checks whether an order ID or bill number has been deleted.
 * Safely ignores daily bill numbers so that deleting Bill #15 today never hides Bill #15 from yesterday.
 */
export function isOrderDeleted(id?: string, billNumber?: string): boolean {
  const set = getDeletedOrderIds();
  if (id && set.has(id.trim())) return true;
  if (billNumber && !isDailyBillNumberString(billNumber) && set.has(billNumber.trim())) return true;
  return false;
}

/**
 * Determines whether an order is a simulated, mock, or obsolete test order.
 */
export function isDemoOrTestOrder(order: Partial<OrderBill>): boolean {
  if (!order || !order.id) return true;
  const id = order.id.trim();
  const billNumber = (order.billNumber || '').trim();

  if (id.startsWith('bill-init-') || id.startsWith('sim-') || id.startsWith('mock-')) {
    return true;
  }
  if (billNumber.startsWith('ALB-SIM') || billNumber === 'ALB-INV-2726') {
    return true;
  }
  if (isOrderDeleted(id, billNumber)) {
    return true;
  }

  return false;
}

export interface StockAdjustment {
  productId: string;
  deltaQuantity: number;
  isWeight: boolean;
}

/**
 * Computes net stock adjustments between original bill items and modified bill items.
 * If delta > 0: additional stock was sold and must be deducted from inventory.
 * If delta < 0: items were returned/reduced and stock must be restored to inventory.
 * If delta === 0: no stock changes.
 */
export function computeStockAdjustments(
  originalItems: CartItem[],
  updatedItems: CartItem[]
): StockAdjustment[] {
  const origMap = new Map<string, { qty: number; isWeight: boolean }>();
  for (const it of originalItems) {
    origMap.set(it.product.id, {
      qty: it.quantity,
      isWeight: isWeightBasedProduct(it.product),
    });
  }

  const updatedMap = new Map<string, { qty: number; isWeight: boolean }>();
  for (const it of updatedItems) {
    updatedMap.set(it.product.id, {
      qty: it.quantity,
      isWeight: isWeightBasedProduct(it.product),
    });
  }

  const allProductIds = new Set([...origMap.keys(), ...updatedMap.keys()]);
  const adjustments: StockAdjustment[] = [];

  for (const id of allProductIds) {
    const orig = origMap.get(id);
    const updated = updatedMap.get(id);
    const origQty = orig ? orig.qty : 0;
    const updatedQty = updated ? updated.qty : 0;
    const delta = updatedQty - origQty;
    const isWeight = (updated?.isWeight ?? orig?.isWeight) || false;

    if (Math.abs(delta) > 0.0001) {
      adjustments.push({
        productId: id,
        deltaQuantity: isWeight ? Math.round(delta * 1000) / 1000 : Math.round(delta),
        isWeight,
      });
    }
  }

  return adjustments;
}
