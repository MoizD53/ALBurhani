import { describe, it, expect } from 'vitest';
import { getOrderDue, calculateDueSummary } from '../lib/utils';
import { OrderBill } from '../types';

describe('Due and Udhar Management', () => {
  const baseOrder: OrderBill = {
    id: 'sale-1',
    billNumber: 'ALB-INV-1001',
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
    createdAt: '21 Oct 2026, 04:30 PM',
    timestamp: Date.now(),
  };

  it('calculates 0 due for fully paid orders', () => {
    expect(getOrderDue(baseOrder)).toBe(0);
  });

  it('calculates correct due for partial cash payment', () => {
    const partialOrder: OrderBill = {
      ...baseOrder,
      id: 'sale-2',
      billNumber: 'ALB-INV-1002',
      amountReceived: 200,
      dueAmount: 325,
    };
    expect(getOrderDue(partialOrder)).toBe(325);
  });

  it('calculates full grandTotal due for full CREDIT / Udhar orders', () => {
    const creditOrder: OrderBill = {
      ...baseOrder,
      id: 'sale-3',
      billNumber: 'ALB-INV-1003',
      paymentMethod: 'CREDIT',
      amountReceived: 0,
    };
    expect(getOrderDue(creditOrder)).toBe(525);
  });

  it('returns 0 due when an order is settled', () => {
    const settledOrder: OrderBill = {
      ...baseOrder,
      id: 'sale-4',
      billNumber: 'ALB-INV-1004',
      paymentMethod: 'CREDIT',
      amountReceived: 525,
      dueAmount: 0,
      isSettled: true,
      settledAt: '21 Oct 2026, 05:00 PM',
    };
    expect(getOrderDue(settledOrder)).toBe(0);
  });

  it('aggregates due summary correctly across mixed orders', () => {
    const orders: OrderBill[] = [
      baseOrder, // Due 0
      {
        ...baseOrder,
        id: 'sale-5',
        billNumber: 'ALB-INV-1005',
        grandTotal: 1000,
        amountReceived: 400,
        dueAmount: 600,
      }, // Due 600
      {
        ...baseOrder,
        id: 'sale-6',
        billNumber: 'ALB-INV-1006',
        grandTotal: 300,
        paymentMethod: 'CREDIT',
        amountReceived: 0,
        dueAmount: 300,
      }, // Due 300
    ];

    const summary = calculateDueSummary(orders);
    expect(summary.totalDue).toBe(900);
    expect(summary.dueOrdersCount).toBe(2);
    expect(summary.dueOrders.map((o) => o.billNumber)).toEqual(['ALB-INV-1005', 'ALB-INV-1006']);
  });
});
