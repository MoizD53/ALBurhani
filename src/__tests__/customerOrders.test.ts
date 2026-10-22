import { describe, it, expect } from 'vitest';
import {
  generateOrderNumber,
  calculateOrderAmounts,
  isOrderActive,
  getOrderTimingStatus,
  getNearestUpcomingDeliveryDate,
  formatOrderItemsSummary,
  generateWhatsAppOrderMessage,
  ORDER_STATUS_CONFIG
} from '../lib/customerOrders';
import { CustomerOrder, CustomerOrderItem } from '../types';

describe('Customer Orders Utility Tests', () => {
  describe('generateOrderNumber', () => {
    it('generates initial sequence 001 for empty orders list', () => {
      const orderNum = generateOrderNumber([]);
      expect(orderNum).toMatch(/^ORD-\d{8}-001$/);
    });

    it('increments sequence based on existing orders for today', () => {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const existing: CustomerOrder[] = [
        {
          id: 'ord-1',
          orderNumber: `ORD-${dateStr}-001`,
          customerName: 'Fatema',
          customerPhone: '9876543210',
          items: [],
          subtotal: 500,
          discountAmount: 0,
          gstAmount: 0,
          totalAmount: 500,
          advancePaid: 100,
          balanceDue: 400,
          orderDate: '2026-10-22',
          deliveryDate: '2026-10-24',
          status: 'Confirmed',
          createdAt: new Date().toISOString()
        },
        {
          id: 'ord-2',
          orderNumber: `ORD-${dateStr}-002`,
          customerName: 'Zainab',
          customerPhone: '9876543211',
          items: [],
          subtotal: 800,
          discountAmount: 0,
          gstAmount: 0,
          totalAmount: 800,
          advancePaid: 800,
          balanceDue: 0,
          orderDate: '2026-10-22',
          deliveryDate: '2026-10-25',
          status: 'Pending',
          createdAt: new Date().toISOString()
        }
      ];

      const nextOrderNum = generateOrderNumber(existing);
      expect(nextOrderNum).toBe(`ORD-${dateStr}-003`);
    });
  });

  describe('calculateOrderAmounts', () => {
    it('calculates totals, discount, GST, and balance due accurately', () => {
      const items: CustomerOrderItem[] = [
        {
          productId: 'p-1',
          productName: 'Kaju Katli',
          unit: 'KG',
          quantity: 2,
          unitPrice: 900,
          subtotal: 1800
        },
        {
          productId: 'p-2',
          productName: 'Motichoor Ladoo',
          unit: 'KG',
          quantity: 1,
          unitPrice: 400,
          subtotal: 400
        }
      ];

      // Total items subtotal = 2200
      // Discount = 200 -> taxable = 2000
      // GST = 100 -> totalAmount = 2100
      // Advance Paid = 1000 -> balanceDue = 1100
      const calc = calculateOrderAmounts(items, 200, 100, 1000);

      expect(calc.subtotal).toBe(2200);
      expect(calc.discountAmount).toBe(200);
      expect(calc.gstAmount).toBe(100);
      expect(calc.totalAmount).toBe(2100);
      expect(calc.advancePaid).toBe(1000);
      expect(calc.balanceDue).toBe(1100);
    });

    it('ensures balance due cannot be negative if advance exceeds total', () => {
      const items: CustomerOrderItem[] = [
        {
          productId: 'p-1',
          productName: 'Dry Fruit Halwa',
          unit: 'KG',
          quantity: 1,
          unitPrice: 500,
          subtotal: 500
        }
      ];

      const calc = calculateOrderAmounts(items, 0, 0, 600);
      expect(calc.totalAmount).toBe(500);
      expect(calc.advancePaid).toBe(600);
      expect(calc.balanceDue).toBe(0);
    });
  });

  describe('isOrderActive', () => {
    it('returns true for Pending, Confirmed, Preparing, and Ready for Delivery', () => {
      expect(isOrderActive('Pending')).toBe(true);
      expect(isOrderActive('Confirmed')).toBe(true);
      expect(isOrderActive('Preparing')).toBe(true);
      expect(isOrderActive('Ready for Delivery')).toBe(true);
    });

    it('returns false for Delivered and Cancelled orders', () => {
      expect(isOrderActive('Delivered')).toBe(false);
      expect(isOrderActive('Cancelled')).toBe(false);
    });

    it('works when passed a full CustomerOrder object', () => {
      const activeOrder: CustomerOrder = {
        id: '1',
        orderNumber: 'ORD-1',
        customerName: 'Ali',
        customerPhone: '9876543210',
        items: [],
        subtotal: 100,
        discountAmount: 0,
        gstAmount: 0,
        totalAmount: 100,
        advancePaid: 0,
        balanceDue: 100,
        orderDate: '2026-10-22',
        deliveryDate: '2026-10-23',
        status: 'Preparing',
        createdAt: '2026-10-22T00:00:00Z'
      };
      expect(isOrderActive(activeOrder)).toBe(true);

      const deliveredOrder: CustomerOrder = {
        ...activeOrder,
        status: 'Delivered'
      };
      expect(isOrderActive(deliveredOrder)).toBe(false);
    });
  });

  describe('getOrderTimingStatus', () => {
    const today = '2026-10-22';

    it('categorizes order timing correctly', () => {
      const overdueOrder: CustomerOrder = {
        id: '1',
        orderNumber: 'ORD-1',
        customerName: 'Hussain',
        customerPhone: '9876543210',
        items: [],
        subtotal: 100,
        discountAmount: 0,
        gstAmount: 0,
        totalAmount: 100,
        advancePaid: 0,
        balanceDue: 100,
        orderDate: '2026-10-20',
        deliveryDate: '2026-10-21',
        status: 'Confirmed',
        createdAt: '2026-10-20T00:00:00Z'
      };
      expect(getOrderTimingStatus(overdueOrder, today)).toBe('overdue');

      const dueTodayOrder: CustomerOrder = {
        ...overdueOrder,
        deliveryDate: '2026-10-22'
      };
      expect(getOrderTimingStatus(dueTodayOrder, today)).toBe('due_today');

      const upcomingOrder: CustomerOrder = {
        ...overdueOrder,
        deliveryDate: '2026-10-25'
      };
      expect(getOrderTimingStatus(upcomingOrder, today)).toBe('upcoming');

      const cancelledOrder: CustomerOrder = {
        ...upcomingOrder,
        status: 'Cancelled'
      };
      expect(getOrderTimingStatus(cancelledOrder, today)).toBe('cancelled');

      const deliveredOrder: CustomerOrder = {
        ...upcomingOrder,
        status: 'Delivered'
      };
      expect(getOrderTimingStatus(deliveredOrder, today)).toBe('delivered');
    });
  });

  describe('getNearestUpcomingDeliveryDate', () => {
    const today = '2026-10-22';

    it('finds nearest future delivery date excluding today, past, and completed orders', () => {
      const orders: CustomerOrder[] = [
        {
          id: '1',
          orderNumber: 'ORD-1',
          customerName: 'A',
          customerPhone: '987',
          items: [],
          subtotal: 100,
          discountAmount: 0,
          gstAmount: 0,
          totalAmount: 100,
          advancePaid: 0,
          balanceDue: 100,
          orderDate: '2026-10-20',
          deliveryDate: '2026-10-21', // overdue
          status: 'Confirmed',
          createdAt: ''
        },
        {
          id: '2',
          orderNumber: 'ORD-2',
          customerName: 'B',
          customerPhone: '987',
          items: [],
          subtotal: 100,
          discountAmount: 0,
          gstAmount: 0,
          totalAmount: 100,
          advancePaid: 0,
          balanceDue: 100,
          orderDate: '2026-10-22',
          deliveryDate: '2026-10-22', // today
          status: 'Confirmed',
          createdAt: ''
        },
        {
          id: '3',
          orderNumber: 'ORD-3',
          customerName: 'C',
          customerPhone: '987',
          items: [],
          subtotal: 100,
          discountAmount: 0,
          gstAmount: 0,
          totalAmount: 100,
          advancePaid: 0,
          balanceDue: 100,
          orderDate: '2026-10-22',
          deliveryDate: '2026-10-26', // future 26 Oct
          status: 'Confirmed',
          createdAt: ''
        },
        {
          id: '4',
          orderNumber: 'ORD-4',
          customerName: 'D',
          customerPhone: '987',
          items: [],
          subtotal: 100,
          discountAmount: 0,
          gstAmount: 0,
          totalAmount: 100,
          advancePaid: 0,
          balanceDue: 100,
          orderDate: '2026-10-22',
          deliveryDate: '2026-10-24', // nearest future 24 Oct
          status: 'Confirmed',
          createdAt: ''
        },
        {
          id: '5',
          orderNumber: 'ORD-5',
          customerName: 'E',
          customerPhone: '987',
          items: [],
          subtotal: 100,
          discountAmount: 0,
          gstAmount: 0,
          totalAmount: 100,
          advancePaid: 0,
          balanceDue: 100,
          orderDate: '2026-10-22',
          deliveryDate: '2026-10-23', // nearest future 23 Oct but cancelled
          status: 'Cancelled',
          createdAt: ''
        }
      ];

      const nearest = getNearestUpcomingDeliveryDate(orders, today);
      expect(nearest).toBe('24 Oct');
    });

    it('returns null when no future active deliveries exist', () => {
      const orders: CustomerOrder[] = [
        {
          id: '1',
          orderNumber: 'ORD-1',
          customerName: 'A',
          customerPhone: '987',
          items: [],
          subtotal: 100,
          discountAmount: 0,
          gstAmount: 0,
          totalAmount: 100,
          advancePaid: 0,
          balanceDue: 100,
          orderDate: '2026-10-22',
          deliveryDate: '2026-10-22',
          status: 'Confirmed',
          createdAt: ''
        }
      ];
      expect(getNearestUpcomingDeliveryDate(orders, today)).toBeNull();
    });
  });

  describe('formatOrderItemsSummary & WhatsApp Message', () => {
    it('summarizes items nicely', () => {
      const items: CustomerOrderItem[] = [
        { productId: '1', productName: 'Kaju Katli', unit: 'KG', quantity: 2, unitPrice: 900, subtotal: 1800 },
        { productId: '2', productName: 'Badam Puri', unit: 'PKT', quantity: 3, unitPrice: 150, subtotal: 450 }
      ];

      const summary = formatOrderItemsSummary(items);
      expect(summary).toBe('Kaju Katli (2 KG) +1 more');
    });

    it('generates complete WhatsApp booking confirmation message', () => {
      const order: CustomerOrder = {
        id: 'ord-test',
        orderNumber: 'ORD-20261022-005',
        customerName: 'Shabbir Bhai',
        customerPhone: '9898989898',
        items: [
          { productId: '1', productName: 'Kaju Katli Special', unit: 'KG', quantity: 2, unitPrice: 950, subtotal: 1900 }
        ],
        subtotal: 1900,
        discountAmount: 0,
        gstAmount: 0,
        totalAmount: 1900,
        advancePaid: 500,
        balanceDue: 1400,
        orderDate: '2026-10-22',
        deliveryDate: '2026-10-24',
        deliveryTime: '5:00 PM',
        deliveryAddress: 'Godi Road, Dahod',
        status: 'Confirmed',
        createdAt: new Date().toISOString()
      };

      const msg = generateWhatsAppOrderMessage(order);
      expect(msg).toContain('AL-BURHANI SWEETS & DRY ITEMS');
      expect(msg).toContain('ORD-20261022-005');
      expect(msg).toContain('Shabbir Bhai');
      expect(msg).toContain('Kaju Katli Special');
      expect(msg).toContain('2026-10-24');
      expect(msg).toContain('5:00 PM');
      expect(msg).toContain('Rs. 1900.00');
      expect(msg).toContain('Rs. 500.00');
      expect(msg).toContain('Rs. 1400.00');
    });
  });

  describe('ORDER_STATUS_CONFIG', () => {
    it('has all 6 supported customer order statuses configured', () => {
      const statuses = ['Pending', 'Confirmed', 'Preparing', 'Ready for Delivery', 'Delivered', 'Cancelled'] as const;
      statuses.forEach((s) => {
        expect(ORDER_STATUS_CONFIG[s]).toBeDefined();
        expect(ORDER_STATUS_CONFIG[s].label).toBe(s);
        expect(ORDER_STATUS_CONFIG[s].badgeClass).toBeTruthy();
      });
    });
  });
});
