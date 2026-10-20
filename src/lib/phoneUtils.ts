/**
 * Utility functions for validating, normalizing, and formatting phone numbers
 * for WhatsApp links and customer records in AL-BURHANI POS.
 */

import { OrderBill } from '../types';
import { upsertCustomerFromSale } from './customers';
import { saveOrderToTurso } from './turso';

/**
 * Normalizes a phone number for WhatsApp wa.me links.
 *
 * Rules:
 * 1. Strips non-digit characters (+, -, spaces, parentheses, etc.).
 * 2. Removes international double-zero prefix (00) if present.
 * 3. Removes single leading 0 (common Indian trunk prefix, e.g. 09876543210 -> 9876543210).
 * 4. Standard 10-digit Indian numbers: prepends country code 91 (e.g. 9876543210 -> 919876543210).
 * 5. 12-digit numbers starting with 91: preserved as 91XXXXXXXXXX (no duplicate 91).
 * 6. Valid international numbers (11-15 digits E.164): preserved as digits.
 * 7. Invalid numbers (empty, < 10 digits, > 15 digits, or all zeros): returns null.
 */
export function normalizeWhatsAppPhoneNumber(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  // Strip all non-digit characters
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  // Disallow all-zeros (e.g. 0000000000)
  if (/^0+$/.test(digits)) return null;

  // Handle leading international double zero (e.g. 0091...)
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Handle single leading 0 for Indian numbers (e.g. 09876543210 -> 9876543210)
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Standard 10-digit Indian mobile number -> prefix 91
  if (digits.length === 10) {
    return `91${digits}`;
  }

  // 12 digits starting with 91 -> valid Indian number with country code already present
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }

  // Other valid international numbers with country code (E.164 standard: 11 to 15 digits)
  if (digits.length >= 11 && digits.length <= 15) {
    return digits;
  }

  return null;
}

/**
 * Checks whether a raw phone number string is valid for WhatsApp sharing.
 */
export function isValidWhatsAppPhoneNumber(raw: string | undefined | null): boolean {
  return normalizeWhatsAppPhoneNumber(raw) !== null;
}

/**
 * Formats a phone number for human-friendly display (e.g. +91 98765 43210).
 */
export function formatPhoneNumberForDisplay(raw: string | undefined | null): string {
  const normalized = normalizeWhatsAppPhoneNumber(raw);
  if (!normalized) return raw ? String(raw).trim() : '';

  if (normalized.startsWith('91') && normalized.length === 12) {
    const mobile = normalized.slice(2);
    return `+91 ${mobile.slice(0, 5)} ${mobile.slice(5)}`;
  }

  return `+${normalized}`;
}

/**
 * Updates an order's customerPhone in localStorage, customer directory, and Turso,
 * and dispatches a window event so all active views update consistently.
 */
export function updateOrderCustomerPhone(
  orderId: string,
  newPhone: string,
  billNumber?: string
): OrderBill | null {
  try {
    const cleanPhone = newPhone.trim();
    if (!cleanPhone) return null;

    const saved = typeof window !== 'undefined' ? localStorage.getItem('albhurani_orders') : null;
    let updatedOrder: OrderBill | null = null;

    if (saved) {
      try {
        const orders: OrderBill[] = JSON.parse(saved);
        if (Array.isArray(orders)) {
          const idx = orders.findIndex(
            (o) => o && (o.id === orderId || (billNumber && o.billNumber === billNumber))
          );
          if (idx !== -1) {
            updatedOrder = {
              ...orders[idx],
              customerPhone: cleanPhone,
            };
            orders[idx] = updatedOrder;
            localStorage.setItem('albhurani_orders', JSON.stringify(orders));
          }
        }
      } catch (parseErr) {
        console.error('Failed to parse albhurani_orders:', parseErr);
      }
    }

    // Persist to customer directory
    if (updatedOrder) {
      if (updatedOrder.customerName || updatedOrder.customerPhone) {
        upsertCustomerFromSale(
          updatedOrder.customerName,
          updatedOrder.customerPhone,
          updatedOrder.grandTotal
        );
      }

      // Persist to Turso remote database in background
      try {
        saveOrderToTurso(updatedOrder).catch((err) =>
          console.warn('Failed to update phone on Turso:', err)
        );
      } catch {}

      // Dispatch event for UI reactivity
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('albhurani_orders_updated', { detail: updatedOrder })
        );
      }
    }

    return updatedOrder;
  } catch (err) {
    console.error('Failed to update order customer phone:', err);
    return null;
  }
}
