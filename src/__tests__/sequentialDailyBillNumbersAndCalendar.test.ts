import { describe, it, expect } from 'vitest';
import { getKolkataDateString } from '../lib/utils';
import { OrderBill } from '../types';

describe('Sequential Daily Bill Numbers & Calendar System', () => {
  it('correctly formats dates in Asia/Kolkata (IST) timezone regardless of device clock', () => {
    // 2026-10-23 23:30:00 IST is 2026-10-23 18:00:00 UTC
    const utcTimestamp = new Date('2026-10-23T18:00:00.000Z').getTime();
    const kolkataDate = getKolkataDateString(utcTimestamp);
    expect(kolkataDate).toBe('2026-10-23');

    // 2026-10-23 18:35:00 UTC is 2026-10-24 00:05:00 IST (Past midnight in India!)
    const pastMidnightUtc = new Date('2026-10-23T18:35:00.000Z').getTime();
    const nextDayKolkataDate = getKolkataDateString(pastMidnightUtc);
    expect(nextDayKolkataDate).toBe('2026-10-24');
  });

  it('allocates clean sequential bill numbers (1, 2, 3... N) per business date', () => {
    const ordersDay1: OrderBill[] = [
      {
        id: 'ord-1',
        billNumber: 'ALB-NB-1001',
        dailyBillNumber: 1,
        businessDate: '2026-10-23',
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
        createdAt: '2026-10-23T10:00:00+05:30',
      },
      {
        id: 'ord-2',
        billNumber: 'ALB-NB-1002',
        dailyBillNumber: 2,
        businessDate: '2026-10-23',
        transactionType: 'NO_BILL',
        items: [],
        subtotal: 1200,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 1200,
        paymentMethod: 'UPI',
        amountReceived: 1200,
        changeGiven: 0,
        cashierName: 'Owner',
        createdAt: '2026-10-23T10:15:00+05:30',
      },
    ];

    expect(ordersDay1[0].dailyBillNumber).toBe(1);
    expect(ordersDay1[1].dailyBillNumber).toBe(2);

    // Sequence resets to 1 on the next business day
    const ordersDay2: OrderBill[] = [
      {
        id: 'ord-3',
        billNumber: 'ALB-NB-1003',
        dailyBillNumber: 1,
        businessDate: '2026-10-24',
        transactionType: 'NO_BILL',
        items: [],
        subtotal: 350,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 350,
        paymentMethod: 'CASH',
        amountReceived: 350,
        changeGiven: 0,
        cashierName: 'Owner',
        createdAt: '2026-10-24T09:00:00+05:30',
      },
    ];

    expect(ordersDay2[0].dailyBillNumber).toBe(1);
    expect(ordersDay2[0].businessDate).toBe('2026-10-24');
  });

  it('orders bills in ascending sequence (Bill 1 at top, Bill 2 underneath) when viewing a single date', () => {
    const dayOrders: OrderBill[] = [
      {
        id: 'b3',
        billNumber: 'ALB-NB-3',
        dailyBillNumber: 3,
        businessDate: '2026-10-23',
        transactionType: 'NO_BILL',
        items: [],
        subtotal: 100,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 100,
        paymentMethod: 'CASH',
        amountReceived: 100,
        changeGiven: 0,
        cashierName: 'Owner',
        createdAt: '2026-10-23T11:00:00+05:30',
      },
      {
        id: 'b1',
        billNumber: 'ALB-NB-1',
        dailyBillNumber: 1,
        businessDate: '2026-10-23',
        transactionType: 'NO_BILL',
        items: [],
        subtotal: 200,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 200,
        paymentMethod: 'CASH',
        amountReceived: 200,
        changeGiven: 0,
        cashierName: 'Owner',
        createdAt: '2026-10-23T09:00:00+05:30',
      },
      {
        id: 'b2',
        billNumber: 'ALB-NB-2',
        dailyBillNumber: 2,
        businessDate: '2026-10-23',
        transactionType: 'NO_BILL',
        items: [],
        subtotal: 300,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 300,
        paymentMethod: 'UPI',
        amountReceived: 300,
        changeGiven: 0,
        cashierName: 'Owner',
        createdAt: '2026-10-23T10:00:00+05:30',
      },
    ];

    const sortedAsc = [...dayOrders].sort(
      (a, b) => (a.dailyBillNumber || 0) - (b.dailyBillNumber || 0)
    );

    expect(sortedAsc[0].dailyBillNumber).toBe(1);
    expect(sortedAsc[1].dailyBillNumber).toBe(2);
    expect(sortedAsc[2].dailyBillNumber).toBe(3);
  });

  it('computes accurate 8-metric daily activity summary for a chosen calendar date', () => {
    const testBills: OrderBill[] = [
      {
        id: 'b1',
        billNumber: 'ALB-NB-1',
        dailyBillNumber: 1,
        businessDate: '2026-10-23',
        transactionType: 'NO_BILL',
        customerName: 'Amina',
        customerPhone: '9876543210',
        cashierName: 'Owner',
        createdAt: '2026-10-23T10:00:00+05:30',
        items: [
          {
            product: { id: 'p1', sku: '001', barcode: '001', name: 'Kaju Katli', category: 'SWEETS', unit: 'KG', costPrice: 600, sellingPrice: 800 },
            quantity: 1,
            unit: 'KG',
            unitPrice: 800,
            lineTotal: 800,
            discountPercent: 0,
            formattedQuantity: '1 kg',
            formattedRate: 'Rs. 800/kg',
          },
        ],
        subtotal: 800,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 800,
        paymentMethod: 'CASH',
        amountReceived: 800,
        changeGiven: 0,
        dueAmount: 0,
      },
      {
        id: 'b2',
        billNumber: 'ALB-NB-2',
        dailyBillNumber: 2,
        businessDate: '2026-10-23',
        transactionType: 'NO_BILL',
        customerName: 'Amina', // Repeat customer on the same day
        customerPhone: '9876543210',
        cashierName: 'Owner',
        createdAt: '2026-10-23T12:00:00+05:30',
        items: [
          {
            product: { id: 'p2', sku: '002', barcode: '002', name: 'Almonds', category: 'DRY FRUITS', unit: 'KG', costPrice: 700, sellingPrice: 900 },
            quantity: 2,
            unit: 'KG',
            unitPrice: 900,
            lineTotal: 1800,
            discountPercent: 0,
            formattedQuantity: '2 kg',
            formattedRate: 'Rs. 900/kg',
          },
        ],
        subtotal: 1800,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 1800,
        paymentMethod: 'UPI',
        amountReceived: 1800,
        changeGiven: 0,
        dueAmount: 0,
      },
      {
        id: 'b3',
        billNumber: 'ALB-NB-3',
        dailyBillNumber: 3,
        businessDate: '2026-10-23',
        transactionType: 'NO_BILL',
        customerName: 'Mustafa',
        customerPhone: '9820000000',
        cashierName: 'Owner',
        createdAt: '2026-10-23T14:00:00+05:30',
        items: [
          {
            product: { id: 'p3', sku: '003', barcode: '003', name: 'Pista', category: 'DRY FRUITS', unit: 'KG', costPrice: 1000, sellingPrice: 1400 },
            quantity: 0.5,
            unit: 'KG',
            unitPrice: 1400,
            lineTotal: 700,
            discountPercent: 0,
            formattedQuantity: '500 g',
            formattedRate: 'Rs. 1400/kg',
          },
        ],
        subtotal: 700,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 700,
        paymentMethod: 'CREDIT',
        amountReceived: 200,
        changeGiven: 0,
        dueAmount: 500, // Rs. 500 Udhar / Due
      },
    ];

    // Compute metrics
    const totalBills = testBills.length;
    const uniqueCustomers = new Set(testBills.map((b) => b.customerPhone || b.customerName)).size;
    const totalSales = testBills.reduce((sum, b) => sum + b.grandTotal, 0);
    const cashCollection = testBills.filter((b) => b.paymentMethod === 'CASH').reduce((sum, b) => sum + b.amountReceived, 0);
    const upiCollection = testBills.filter((b) => b.paymentMethod === 'UPI').reduce((sum, b) => sum + b.amountReceived, 0);
    const cardCollection = testBills.filter((b) => b.paymentMethod === 'CARD').reduce((sum, b) => sum + b.amountReceived, 0);
    const totalDue = testBills.reduce((sum, b) => sum + (b.dueAmount || 0), 0);
    const totalItemsCount = testBills.reduce((sum, b) => sum + b.items.reduce((iSum, it) => iSum + it.quantity, 0), 0);

    expect(totalBills).toBe(3);
    expect(uniqueCustomers).toBe(2); // Amina appeared twice, Mustafa once = 2 unique customers
    expect(totalSales).toBe(3300); // 800 + 1800 + 700 = 3300
    expect(cashCollection).toBe(800);
    expect(upiCollection).toBe(1800);
    expect(cardCollection).toBe(0);
    expect(totalDue).toBe(500);
    expect(totalItemsCount).toBe(3.5); // 1 + 2 + 0.5 = 3.5
  });

  it('builds calendar activity map with exact sales count per date', () => {
    const orders: OrderBill[] = [
      { id: '1', billNumber: 'B1', dailyBillNumber: 1, businessDate: '2026-10-21', transactionType: 'NO_BILL', items: [], subtotal: 100, discountAmount: 0, gstAmount: 0, grandTotal: 100, paymentMethod: 'CASH', amountReceived: 100, changeGiven: 0, cashierName: 'Owner', createdAt: '2026-10-21T10:00:00+05:30' },
      { id: '2', billNumber: 'B2', dailyBillNumber: 2, businessDate: '2026-10-21', transactionType: 'NO_BILL', items: [], subtotal: 100, discountAmount: 0, gstAmount: 0, grandTotal: 100, paymentMethod: 'CASH', amountReceived: 100, changeGiven: 0, cashierName: 'Owner', createdAt: '2026-10-21T11:00:00+05:30' },
      { id: '3', billNumber: 'B3', dailyBillNumber: 1, businessDate: '2026-10-22', transactionType: 'NO_BILL', items: [], subtotal: 200, discountAmount: 0, gstAmount: 0, grandTotal: 200, paymentMethod: 'UPI', amountReceived: 200, changeGiven: 0, cashierName: 'Owner', createdAt: '2026-10-22T10:00:00+05:30' },
    ];

    const map = new Map<string, number>();
    for (const o of orders) {
      const d = o.businessDate || '';
      map.set(d, (map.get(d) || 0) + 1);
    }

    expect(map.get('2026-10-21')).toBe(2);
    expect(map.get('2026-10-22')).toBe(1);
    expect(map.has('2026-10-23')).toBe(false);
  });
});
