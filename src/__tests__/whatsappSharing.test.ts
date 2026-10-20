import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import {
  normalizeWhatsAppPhoneNumber,
  isValidWhatsAppPhoneNumber,
  formatPhoneNumberForDisplay,
  updateOrderCustomerPhone,
} from '../lib/phoneUtils';
import { shareReceiptPdfWhatsApp } from '../lib/pdfReceipt';
import { buildCartItem } from '../lib/pricing';
import { OrderBill, Product } from '../types';

const localStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => localStore[key] || null,
  setItem: (key: string, val: string) => { localStore[key] = String(val); },
  removeItem: (key: string) => { delete localStore[key]; },
  clear: () => { Object.keys(localStore).forEach((k) => delete localStore[k]); },
};

beforeAll(() => {
  (globalThis as any).localStorage = mockLocalStorage;

  if (typeof window !== 'undefined') {
    window.open = vi.fn();
    window.dispatchEvent = vi.fn();
  }
  if (typeof document !== 'undefined') {
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = vi.fn((tagName: string) => {
      if (tagName === 'a') {
        return {
          href: '',
          download: '',
          click: vi.fn(),
        } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tagName);
    });
    document.body.appendChild = vi.fn() as any;
    document.body.removeChild = vi.fn() as any;
  }
  if (typeof URL !== 'undefined') {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  }
});

describe('WhatsApp PDF Sharing & Phone Normalization', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('Indian Phone Number Normalization & Validation', () => {
    it('normalizes standard 10-digit Indian mobile numbers by prefixing 91', () => {
      expect(normalizeWhatsAppPhoneNumber('9876543210')).toBe('919876543210');
      expect(isValidWhatsAppPhoneNumber('9876543210')).toBe(true);
    });

    it('normalizes numbers with leading 0 (trunk STD prefix) to 91', () => {
      expect(normalizeWhatsAppPhoneNumber('09876543210')).toBe('919876543210');
      expect(isValidWhatsAppPhoneNumber('09876543210')).toBe(true);
    });

    it('handles +91 prefix and spaces without duplicating country code', () => {
      expect(normalizeWhatsAppPhoneNumber('+91 98765 43210')).toBe('919876543210');
      expect(normalizeWhatsAppPhoneNumber('+919876543210')).toBe('919876543210');
      expect(isValidWhatsAppPhoneNumber('+91 98765 43210')).toBe(true);
    });

    it('handles numbers already containing 91 prefix without adding duplicate 91', () => {
      expect(normalizeWhatsAppPhoneNumber('919876543210')).toBe('919876543210');
      expect(normalizeWhatsAppPhoneNumber('91 9876543210')).toBe('919876543210');
    });

    it('handles international double-zero prefix 0091', () => {
      expect(normalizeWhatsAppPhoneNumber('00919876543210')).toBe('919876543210');
      expect(normalizeWhatsAppPhoneNumber('0091 98765 43210')).toBe('919876543210');
    });

    it('handles hyphens, dots, and parentheses in numbers', () => {
      expect(normalizeWhatsAppPhoneNumber('+91-98765-43210')).toBe('919876543210');
      expect(normalizeWhatsAppPhoneNumber('(987) 654-3210')).toBe('919876543210');
    });

    it('supports valid international numbers (11 to 15 digits)', () => {
      expect(normalizeWhatsAppPhoneNumber('+1 (415) 555-2671')).toBe('14155552671');
      expect(isValidWhatsAppPhoneNumber('+1 (415) 555-2671')).toBe(true);
    });

    it('rejects invalid, incomplete, or empty phone numbers', () => {
      expect(normalizeWhatsAppPhoneNumber('')).toBeNull();
      expect(normalizeWhatsAppPhoneNumber(null)).toBeNull();
      expect(normalizeWhatsAppPhoneNumber(undefined)).toBeNull();
      expect(normalizeWhatsAppPhoneNumber('12345')).toBeNull();
      expect(normalizeWhatsAppPhoneNumber('987654321')).toBeNull(); // 9 digits
      expect(normalizeWhatsAppPhoneNumber('abcdefghij')).toBeNull();
      expect(normalizeWhatsAppPhoneNumber('0000000000')).toBeNull(); // all zeros
      expect(isValidWhatsAppPhoneNumber('12345')).toBe(false);
      expect(isValidWhatsAppPhoneNumber('')).toBe(false);
    });

    it('formats phone numbers nicely for customer display', () => {
      expect(formatPhoneNumberForDisplay('9876543210')).toBe('+91 98765 43210');
      expect(formatPhoneNumberForDisplay('+919876543210')).toBe('+91 98765 43210');
      expect(formatPhoneNumberForDisplay('+14155552671')).toBe('+14155552671');
    });
  });

  describe('Reusing Phone Number for WhatsApp PDF Sharing', () => {
    const sampleProduct: Product = {
      id: 'p-1',
      sku: '0001',
      barcode: '0001',
      name: 'KAJU KATLI',
      sellingPrice: 900,
      costPrice: 700,
      unit: 'KG',
      category: 'SWEETS',
      stock: 10,
      minStock: 2,
    };

    const mockOrder: OrderBill = {
      id: 'ord-test-1',
      billNumber: 'ALB-NB-1001',
      transactionType: 'NO_BILL',
      items: [buildCartItem(sampleProduct, 1)],
      subtotal: 900,
      discountAmount: 0,
      gstAmount: 0,
      grandTotal: 900,
      paymentMethod: 'CASH',
      amountReceived: 1000,
      changeGiven: 100,
      customerName: 'Shabbir Bhai',
      customerPhone: '9876543210',
      cashierName: 'Owner',
      createdAt: '20 Oct 2026, 01:00 PM',
      timestamp: Date.now(),
    };

    it('uses the saved bill customer phone number as the WhatsApp recipient', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      let capturedFeedback: string | undefined;
      const result = await shareReceiptPdfWhatsApp(mockOrder, (msg) => {
        capturedFeedback = msg;
      });

      expect(result.success).toBe(true);
      expect(openSpy).toHaveBeenCalled();
      const openedUrl = openSpy.mock.calls[0][0];

      // Must open WhatsApp targeting the customer's normalized phone number
      expect(openedUrl).toContain('https://wa.me/919876543210?text=');
      expect(openedUrl).toContain(encodeURIComponent('ALB-NB-1001'));
      expect(capturedFeedback).toContain('+91 98765 43210');
    });

    it('allows overriding target phone if provided explicitly', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      await shareReceiptPdfWhatsApp(mockOrder, '9825012345');

      expect(openSpy).toHaveBeenCalled();
      const openedUrl = openSpy.mock.calls[0][0];
      expect(openedUrl).toContain('https://wa.me/919825012345?text=');
    });
  });

  describe('Updating and Persisting Phone on Historical Bills', () => {
    it('persists phone number to localStorage and customer records when updated', () => {
      const initialOrder: OrderBill = {
        id: 'ord-hist-1',
        billNumber: 'ALB-NB-5001',
        transactionType: 'NO_BILL',
        items: [],
        subtotal: 500,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 500,
        paymentMethod: 'CASH',
        amountReceived: 500,
        changeGiven: 0,
        customerName: 'Murtaza Bhai',
        cashierName: 'Owner',
        createdAt: '20 Oct 2026, 01:15 PM',
        timestamp: Date.now(),
      };

      mockLocalStorage.setItem('albhurani_orders', JSON.stringify([initialOrder]));

      const updated = updateOrderCustomerPhone('ord-hist-1', '9825112233', 'ALB-NB-5001');

      expect(updated).not.toBeNull();
      expect(updated?.customerPhone).toBe('9825112233');

      // Verify persisted in localStorage
      const savedOrders = JSON.parse(mockLocalStorage.getItem('albhurani_orders') || '[]');
      expect(savedOrders[0].customerPhone).toBe('9825112233');

      // Verify customer directory was updated
      const savedCustomers = JSON.parse(mockLocalStorage.getItem('albhurani_customers') || '[]');
      const customer = savedCustomers.find((c: any) => c.phone === '9825112233');
      expect(customer).toBeDefined();
      expect(customer?.name).toBe('Murtaza Bhai');
    });
  });
});
