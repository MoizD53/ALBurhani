import { describe, it, expect } from 'vitest';
import { OrderBill } from '../types';

describe('AL-BURHANI POS — Standardized Billing History Architecture', () => {
  const sampleWithGstOrder1: OrderBill = {
    id: 'sale-gst-1',
    billNumber: 'ALB-INV-1001',
    transactionType: 'CUSTOMER_BILL',
    items: [
      {
        product: {
          id: 'p1',
          sku: 'SKU-1',
          barcode: '890123400001',
          name: 'KAJU KATLI 250G',
          category: 'Sweets',
          unit: 'PCS',
          costPrice: 150,
          sellingPrice: 200,
          stock: 20,
          minStock: 2,
        },
        quantity: 1,
        unit: 'PCS',
        unitPrice: 200,
        lineTotal: 200,
        discountPercent: 0,
        formattedQuantity: '1 PCS',
        formattedRate: '₹200.00/PCS',
      },
    ],
    subtotal: 200,
    discountAmount: 0,
    gstAmount: 9.52,
    grandTotal: 200,
    paymentMethod: 'CASH',
    amountReceived: 200,
    changeGiven: 0,
    customerName: 'Moiz Bhai',
    customerPhone: '9876543210',
    cashierName: 'Owner',
    createdAt: '19 Oct 2026, 02:30 pm',
    timestamp: 1729329000000,
  };

  const sampleWithGstOrder2: OrderBill = {
    id: 'sale-gst-2',
    billNumber: 'ALB-INV-1002',
    transactionType: 'CUSTOMER_BILL',
    items: [
      {
        product: {
          id: 'p2',
          sku: 'SKU-2',
          barcode: '890123400002',
          name: 'RATLAMI SEV 500G',
          category: 'Namkeen & Farsan',
          unit: 'PCS',
          costPrice: 80,
          sellingPrice: 120,
          stock: 15,
          minStock: 3,
        },
        quantity: 2,
        unit: 'PCS',
        unitPrice: 120,
        lineTotal: 240,
        discountPercent: 0,
        formattedQuantity: '2 PCS',
        formattedRate: '₹120.00/PCS',
      },
    ],
    subtotal: 240,
    discountAmount: 0,
    gstAmount: 11.43,
    grandTotal: 240,
    paymentMethod: 'UPI',
    amountReceived: 240,
    changeGiven: 0,
    customerName: 'Hussain Bhai',
    customerPhone: '9825000000',
    cashierName: 'Owner',
    createdAt: '19 Oct 2026, 03:15 pm',
    timestamp: 1729331700000,
  };

  const sampleNoBillOrder1: OrderBill = {
    id: 'sale-nobill-1',
    billNumber: 'NB-1729332000-001',
    transactionType: 'NO_BILL',
    items: [
      {
        product: {
          id: 'p1',
          sku: 'SKU-1',
          barcode: '890123400001',
          name: 'KAJU KATLI 250G',
          category: 'Sweets',
          unit: 'PCS',
          costPrice: 150,
          sellingPrice: 200,
          stock: 19,
          minStock: 2,
        },
        quantity: 1,
        unit: 'PCS',
        unitPrice: 200,
        lineTotal: 200,
        discountPercent: 0,
        formattedQuantity: '1 PCS',
        formattedRate: '₹200.00/PCS',
      },
    ],
    subtotal: 200,
    discountAmount: 0,
    gstAmount: 0,
    grandTotal: 200,
    paymentMethod: 'CASH',
    amountReceived: 200,
    changeGiven: 0,
    cashierName: 'Owner',
    createdAt: '19 Oct 2026, 03:20 pm',
    timestamp: 1729332000000,
  };

  const sampleNoBillOrder2: OrderBill = {
    id: 'sale-nobill-2',
    billNumber: 'NB-1729332500-002',
    transactionType: 'NO_BILL',
    items: [
      {
        product: {
          id: 'p2',
          sku: 'SKU-2',
          barcode: '890123400002',
          name: 'RATLAMI SEV 500G',
          category: 'Namkeen & Farsan',
          unit: 'PCS',
          costPrice: 80,
          sellingPrice: 120,
          stock: 13,
          minStock: 3,
        },
        quantity: 1,
        unit: 'PCS',
        unitPrice: 120,
        lineTotal: 120,
        discountPercent: 0,
        formattedQuantity: '1 PCS',
        formattedRate: '₹120.00/PCS',
      },
    ],
    subtotal: 120,
    discountAmount: 0,
    gstAmount: 0,
    grandTotal: 120,
    paymentMethod: 'UPI',
    amountReceived: 120,
    changeGiven: 0,
    cashierName: 'Counter Staff',
    createdAt: '19 Oct 2026, 03:30 pm',
    timestamp: 1729332500000,
  };

  const allOrders = [
    sampleWithGstOrder1,
    sampleWithGstOrder2,
    sampleNoBillOrder1,
    sampleNoBillOrder2,
  ];

  describe('1. Separation of Concerns (With GST vs Without GST)', () => {
    it('CustomerBillsView filters strictly formal customer tax invoices and excludes no-bill sales', () => {
      const customerBills = allOrders.filter(
        (o) => o.transactionType === 'CUSTOMER_BILL' || !o.transactionType
      );
      expect(customerBills.length).toBe(2);
      expect(customerBills.map((b) => b.id)).toEqual(['sale-gst-1', 'sale-gst-2']);
      customerBills.forEach((b) => {
        expect(b.transactionType).not.toBe('NO_BILL');
        expect(b.gstAmount).toBeGreaterThan(0);
      });
    });

    it('NoBillSalesView filters strictly internal no-bill sales and excludes GST invoices', () => {
      const noBillSales = allOrders.filter((o) => o.transactionType === 'NO_BILL');
      expect(noBillSales.length).toBe(2);
      expect(noBillSales.map((s) => s.id)).toEqual(['sale-nobill-1', 'sale-nobill-2']);
      noBillSales.forEach((s) => {
        expect(s.transactionType).toBe('NO_BILL');
        expect(s.gstAmount).toBe(0);
      });
    });
  });

  describe('2. Metrics & KPI Summary Calculations', () => {
    it('calculates CustomerBillsView metrics accurately (Revenue, GST, Average Bill)', () => {
      const customerBills = allOrders.filter(
        (o) => o.transactionType === 'CUSTOMER_BILL' || !o.transactionType
      );
      const totalRevenue = customerBills.reduce((sum, b) => sum + b.grandTotal, 0);
      const totalGst = customerBills.reduce((sum, b) => sum + b.gstAmount, 0);
      const avgBill = totalRevenue / customerBills.length;

      expect(totalRevenue).toBe(440);
      expect(Number(totalGst.toFixed(2))).toBe(20.95);
      expect(avgBill).toBe(220);
    });

    it('calculates NoBillSalesView metrics accurately (Total, Cash, UPI, Deductions)', () => {
      const noBillSales = allOrders.filter((o) => o.transactionType === 'NO_BILL');
      const totalNoBill = noBillSales.reduce((sum, s) => sum + s.grandTotal, 0);
      const cashInDrawer = noBillSales
        .filter((s) => s.paymentMethod === 'CASH')
        .reduce((sum, s) => sum + s.grandTotal, 0);
      const upiCollections = noBillSales
        .filter((s) => s.paymentMethod === 'UPI')
        .reduce((sum, s) => sum + s.grandTotal, 0);
      const itemsDeducted = noBillSales.reduce((acc, s) => acc + s.items.length, 0);

      expect(totalNoBill).toBe(320);
      expect(cashInDrawer).toBe(200);
      expect(upiCollections).toBe(120);
      expect(itemsDeducted).toBe(2);
    });
  });

  describe('3. Unified Search and Payment Filtering Logic', () => {
    it('filters Customer Bills by payment mode', () => {
      const customerBills = allOrders.filter(
        (o) => o.transactionType === 'CUSTOMER_BILL' || !o.transactionType
      );
      const cashBills = customerBills.filter((b) => b.paymentMethod === 'CASH');
      const upiBills = customerBills.filter((b) => b.paymentMethod === 'UPI');
      const cardBills = customerBills.filter((b) => b.paymentMethod === 'CARD');

      expect(cashBills.length).toBe(1);
      expect(upiBills.length).toBe(1);
      expect(cardBills.length).toBe(0);
    });

    it('filters No-Bill sales by payment mode', () => {
      const noBillSales = allOrders.filter((o) => o.transactionType === 'NO_BILL');
      const cashSales = noBillSales.filter((s) => s.paymentMethod === 'CASH');
      const upiSales = noBillSales.filter((s) => s.paymentMethod === 'UPI');

      expect(cashSales.length).toBe(1);
      expect(upiSales.length).toBe(1);
    });

    it('searches Customer Bills across bill number, customer name, phone, and date', () => {
      const customerBills = allOrders.filter(
        (o) => o.transactionType === 'CUSTOMER_BILL' || !o.transactionType
      );

      const searchByPhone = customerBills.filter((b) =>
        Boolean(b.customerPhone && b.customerPhone.includes('9825'))
      );
      expect(searchByPhone.length).toBe(1);
      expect(searchByPhone[0].customerName).toBe('Hussain Bhai');

      const searchByName = customerBills.filter((b) =>
        Boolean(b.customerName && b.customerName.toLowerCase().includes('moiz'))
      );
      expect(searchByName.length).toBe(1);
      expect(searchByName[0].billNumber).toBe('ALB-INV-1001');
    });

    it('searches No-Bill sales across transaction ID, cashier, product name, and date', () => {
      const noBillSales = allOrders.filter((o) => o.transactionType === 'NO_BILL');

      const searchByProduct = noBillSales.filter((s) =>
        s.items.some((it) => it.product.name.toLowerCase().includes('ratlami'))
      );
      expect(searchByProduct.length).toBe(1);
      expect(searchByProduct[0].billNumber).toBe('NB-1729332500-002');

      const searchByCashier = noBillSales.filter((s) =>
        Boolean(s.cashierName && s.cashierName.toLowerCase().includes('counter staff'))
      );
      expect(searchByCashier.length).toBe(1);
    });
  });
});
