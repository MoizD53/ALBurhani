import { OrderBill } from '../types';

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  createdAt: string;
  totalVisits?: number;
  totalSpend?: number;
}

const STORAGE_KEY = 'albhurani_customers';

/**
 * Checks if a customer name / phone represents demo or test data rather than a real customer.
 * Examples of demo/test customers:
 * - Empty name and empty phone
 * - "Walk-in Customer", "Walk-in", "Walkin", "Cash Customer", "Guest"
 * - Names containing "test", "demo", "sample", "dummy", "temp"
 * - Dummy phones like "1234567890", "0000000000", "9999999999", etc.
 */
export function isDemoCustomer(name?: string, phone?: string): boolean {
  const cleanName = (name || '').trim().toLowerCase();
  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');

  // 1. Both empty or anonymous walk-in
  if (!cleanName && !cleanPhone) return true;
  if (['walk-in', 'walk in', 'walk-in customer', 'walkin', 'cash', 'guest', 'counter customer'].includes(cleanName)) {
    return true;
  }

  // 2. Demo / test keywords in name
  const demoKeywords = ['test', 'demo', 'sample', 'dummy', 'temp', 'fake', 'trial'];
  if (demoKeywords.some((kw) => cleanName.includes(kw))) {
    return true;
  }

  // 3. Dummy / test phone patterns
  const dummyPhones = [
    '0000000000',
    '1234567890',
    '9999999999',
    '8888888888',
    '7777777777',
    '1111111111',
    '9876543210',
    '12345',
    '00000',
  ];
  if (dummyPhones.includes(cleanPhone)) {
    return true;
  }

  // Incomplete short phone numbers
  if (cleanPhone.length > 0 && cleanPhone.length < 8) {
    return true;
  }

  // If it has a non-demo name or a plausible 10-digit phone, it's considered real
  return false;
}

/**
 * Retrieves saved real customers from localStorage
 */
export function getSavedCustomers(): CustomerRecord[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Failed to parse saved customers:', err);
  }
  return [];
}

/**
 * Saves real customers list to localStorage
 */
export function saveCustomers(customers: CustomerRecord[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
  } catch (err) {
    console.warn('Failed to save customers to localStorage:', err);
  }
}

/**
 * Extracts and preserves any genuine customer records from an array of orders,
 * ensuring no real customer contacts are lost when resetting demo/test sales.
 */
export function preserveRealCustomersFromOrders(orders: OrderBill[]): CustomerRecord[] {
  const existing = getSavedCustomers();
  const customerMap = new Map<string, CustomerRecord>();

  for (const c of existing) {
    const key = (c.phone || c.name).trim().toLowerCase();
    customerMap.set(key, c);
  }

  for (const o of orders) {
    const hasName = Boolean(o.customerName && o.customerName.trim());
    const hasPhone = Boolean(o.customerPhone && o.customerPhone.trim());

    if (!hasName && !hasPhone) continue;

    if (!isDemoCustomer(o.customerName, o.customerPhone)) {
      const phoneKey = o.customerPhone ? o.customerPhone.trim().toLowerCase() : '';
      const nameKey = o.customerName ? o.customerName.trim().toLowerCase() : '';
      const key = phoneKey || nameKey;

      const matched = customerMap.get(key);
      if (!matched) {
        customerMap.set(key, {
          id: `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: (o.customerName || 'Valued Customer').trim(),
          phone: o.customerPhone?.trim() || '',
          createdAt: o.createdAt || new Date().toLocaleString(),
          totalVisits: 1,
          totalSpend: o.grandTotal || 0,
        });
      } else {
        matched.totalVisits = (matched.totalVisits || 0) + 1;
        matched.totalSpend = (matched.totalSpend || 0) + (o.grandTotal || 0);
        if (o.customerName && (!matched.name || matched.name === 'Valued Customer')) {
          matched.name = o.customerName.trim();
        }
      }
    }
  }

  const result = Array.from(customerMap.values());
  saveCustomers(result);
  return result;
}

/**
 * Adds or updates a real customer during active POS checkout.
 * Returns the upserted CustomerRecord for cloud sync, or null if demo/invalid.
 */
export function upsertCustomerFromSale(name?: string, phone?: string, amount = 0): CustomerRecord | null {
  if (!name && !phone) return null;
  if (isDemoCustomer(name, phone)) return null;

  const existing = getSavedCustomers();
  const phoneKey = phone ? phone.trim().toLowerCase() : '';
  const nameKey = name ? name.trim().toLowerCase() : '';

  const index = existing.findIndex((c) => {
    if (phoneKey && c.phone && c.phone.trim().toLowerCase() === phoneKey) return true;
    if (nameKey && c.name && c.name.trim().toLowerCase() === nameKey) return true;
    return false;
  });

  let result: CustomerRecord;

  if (index >= 0) {
    existing[index].totalVisits = (existing[index].totalVisits || 0) + 1;
    existing[index].totalSpend = (existing[index].totalSpend || 0) + amount;
    if (name && (!existing[index].name || existing[index].name === 'Valued Customer')) {
      existing[index].name = name.trim();
    }
    if (phone && !existing[index].phone) {
      existing[index].phone = phone.trim();
    }
    result = existing[index];
  } else {
    result = {
      id: `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: (name || 'Valued Customer').trim(),
      phone: phone?.trim() || '',
      createdAt: new Date().toLocaleString(),
      totalVisits: 1,
      totalSpend: amount,
    };
    existing.push(result);
  }

  saveCustomers(existing);
  return result;
}
