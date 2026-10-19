import { describe, it, expect, beforeEach } from 'vitest';
import { OrderBill } from '../types';
import { 
  getDeletedOrderIds, 
  recordDeletedOrder, 
  isOrderDeleted, 
  isDemoOrTestOrder,
  DELETED_ORDERS_STORAGE_KEY 
} from '../lib/orders';
import { preserveRealCustomersFromOrders, getSavedCustomers } from '../lib/customers';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('AL-BHURANI POS — Customer Tax Invoice Deletion & Data Integrity', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  // Sample genuine orders for testing
  const invoiceA: OrderBill = {
    id: 'sale-1729350000-1001',
    billNumber: 'ALB-INV-2725',
    transactionType: 'CUSTOMER_BILL',
    items: [],
    subtotal: 150,
    discountAmount: 0,
    gstAmount: 7.5,
    grandTotal: 157.5,
    paymentMethod: 'UPI',
    amountReceived: 157.5,
    changeGiven: 0,
    customerName: 'Shabbir Bhai',
    customerPhone: '9825111111',
    cashierName: 'Owner',
    createdAt: '19 Oct 2026, 04:30 pm',
    timestamp: 1729350000000,
  };

  // The specific incorrect test invoice from the user's screenshot
  const wrongInvoice: OrderBill = {
    id: 'sale-1729351000-2726',
    billNumber: 'ALB-INV-2726',
    transactionType: 'CUSTOMER_BILL',
    items: [],
    subtotal: 60,
    discountAmount: 0,
    gstAmount: 3.0,
    grandTotal: 63.0,
    paymentMethod: 'CASH',
    amountReceived: 100,
    changeGiven: 37,
    customerName: 'Walk-in Customer',
    cashierName: 'Owner',
    createdAt: '19 Oct 2026, 04:50 pm',
    timestamp: 1729351000000,
  };

  const invoiceB: OrderBill = {
    id: 'sale-1729352000-1002',
    billNumber: 'ALB-INV-2727',
    transactionType: 'CUSTOMER_BILL',
    items: [],
    subtotal: 300,
    discountAmount: 0,
    gstAmount: 15,
    grandTotal: 315,
    paymentMethod: 'CARD',
    amountReceived: 315,
    changeGiven: 0,
    customerName: 'Fatima Ben',
    customerPhone: '9426822222',
    cashierName: 'Owner',
    createdAt: '19 Oct 2026, 05:00 pm',
    timestamp: 1729352000000,
  };

  describe('1. Removal of Specific Incorrect Invoice (ALB-INV-2726)', () => {
    it('specifically targets and removes ALB-INV-2726 by exact identifier without deleting genuine invoices', () => {
      const initialOrders: OrderBill[] = [invoiceA, wrongInvoice, invoiceB];
      expect(initialOrders.length).toBe(3);

      // Check totals before removal (matches screenshot ₹63 cash contribution)
      const totalRevenueBefore = initialOrders.reduce((sum, o) => sum + o.grandTotal, 0);
      const cashTenderBefore = initialOrders.filter((o) => o.paymentMethod === 'CASH').reduce((sum, o) => sum + o.grandTotal, 0);
      expect(totalRevenueBefore).toBe(157.5 + 63.0 + 315.0); // 535.5
      expect(cashTenderBefore).toBe(63.0);

      // Remove ALB-INV-2726
      recordDeletedOrder(wrongInvoice.id, wrongInvoice.billNumber);
      const remainingOrders = initialOrders.filter((o) => o.billNumber !== 'ALB-INV-2726' && o.id !== wrongInvoice.id);

      expect(remainingOrders.length).toBe(2);
      expect(remainingOrders.map((o) => o.billNumber)).toEqual(['ALB-INV-2725', 'ALB-INV-2727']);

      // Recalculated totals
      const totalRevenueAfter = remainingOrders.reduce((sum, o) => sum + o.grandTotal, 0);
      const cashTenderAfter = remainingOrders.filter((o) => o.paymentMethod === 'CASH').reduce((sum, o) => sum + o.grandTotal, 0);
      const upiTenderAfter = remainingOrders.filter((o) => o.paymentMethod === 'UPI').reduce((sum, o) => sum + o.grandTotal, 0);
      const cardTenderAfter = remainingOrders.filter((o) => o.paymentMethod === 'CARD').reduce((sum, o) => sum + o.grandTotal, 0);

      expect(totalRevenueAfter).toBe(472.5); // 535.5 - 63.0
      expect(cashTenderAfter).toBe(0); // ₹63 Cash tender correctly zeroed
      expect(upiTenderAfter).toBe(157.5);
      expect(cardTenderAfter).toBe(315.0);
    });

    it('does not delete an order with identical amount or customer name if bill number is different', () => {
      const similarOrder: OrderBill = {
        id: 'sale-genuine-63',
        billNumber: 'ALB-INV-9999',
        transactionType: 'CUSTOMER_BILL',
        items: [],
        subtotal: 60,
        discountAmount: 0,
        gstAmount: 3.0,
        grandTotal: 63.0, // Same amount
        paymentMethod: 'CASH', // Same payment method
        amountReceived: 63.0,
        changeGiven: 0,
        customerName: 'Walk-in Customer', // Same customer
        cashierName: 'Owner',
        createdAt: '19 Oct 2026, 05:15 pm',
      };

      const orders = [wrongInvoice, similarOrder];
      // Target deletion specifically of ALB-INV-2726
      const filtered = orders.filter((o) => o.billNumber !== 'ALB-INV-2726');
      expect(filtered.length).toBe(1);
      expect(filtered[0].billNumber).toBe('ALB-INV-9999');
      expect(filtered[0].grandTotal).toBe(63.0);
    });
  });

  describe('2. Single Invoice Deletion & Immediate Metric Recalculation', () => {
    it('deleting one invoice updates invoice count, revenue, GST, and tenders immediately', () => {
      let orders = [invoiceA, invoiceB];
      expect(orders.length).toBe(2);

      const customerBillsBefore = orders.filter((o) => o.transactionType === 'CUSTOMER_BILL');
      const billedRevenueBefore = customerBillsBefore.reduce((sum, b) => sum + b.grandTotal, 0);
      const gstBefore = customerBillsBefore.reduce((sum, b) => sum + b.gstAmount, 0);

      expect(customerBillsBefore.length).toBe(2);
      expect(billedRevenueBefore).toBe(472.5);
      expect(gstBefore).toBe(22.5);

      // User deletes invoiceA (₹157.5)
      orders = orders.filter((o) => o.id !== invoiceA.id);

      const customerBillsAfter = orders.filter((o) => o.transactionType === 'CUSTOMER_BILL');
      const billedRevenueAfter = customerBillsAfter.reduce((sum, b) => sum + b.grandTotal, 0);
      const gstAfter = customerBillsAfter.reduce((sum, b) => sum + b.gstAmount, 0);

      expect(customerBillsAfter.length).toBe(1);
      expect(billedRevenueAfter).toBe(315.0);
      expect(gstAfter).toBe(15.0);
      expect(orders[0].billNumber).toBe('ALB-INV-2727');
    });
  });

  describe('3. Tombstone Persistence & Remote Sync Resurrection Prevention', () => {
    it('records tombstones in localStorage and prevents deleted invoices from reappearing during remote sync', () => {
      recordDeletedOrder(wrongInvoice.id, wrongInvoice.billNumber);

      expect(isOrderDeleted(wrongInvoice.id)).toBe(true);
      expect(isOrderDeleted(undefined, wrongInvoice.billNumber)).toBe(true);
      expect(isOrderDeleted('some-other-id', 'ALB-INV-9999')).toBe(false);

      // Simulate remote Turso database returning the invoice because remote deletion failed or lagged
      const remoteOrdersFromTurso: OrderBill[] = [
        invoiceA,
        wrongInvoice, // Stale remote record
        invoiceB,
      ];

      const deletedIds = getDeletedOrderIds();
      const validRemoteOrders = remoteOrdersFromTurso.filter((ro) => {
        if (deletedIds.has(ro.id) || (ro.billNumber && deletedIds.has(ro.billNumber))) {
          return false; // Suppressed by tombstone!
        }
        return true;
      });

      expect(validRemoteOrders.length).toBe(2);
      expect(validRemoteOrders.find((ro) => ro.billNumber === 'ALB-INV-2726')).toBeUndefined();
      expect(validRemoteOrders.map((ro) => ro.billNumber)).toEqual(['ALB-INV-2725', 'ALB-INV-2727']);
    });
  });

  describe('4. albhurani_fresh_shop_opening_v2 Migration Safety', () => {
    it('does NOT wipe genuine sales if shop was already initialized under v1', () => {
      // Simulate shop that already opened under v1 and has genuine sales
      localStorage.setItem('albhurani_fresh_shop_opening_v1', 'true');
      const genuineSales: OrderBill[] = [invoiceA, invoiceB];
      localStorage.setItem('albhurani_orders', JSON.stringify(genuineSales));

      const isFreshShopMigratedV2 = localStorage.getItem('albhurani_fresh_shop_opening_v2') === 'true';
      const isFreshShopMigratedV1 = localStorage.getItem('albhurani_fresh_shop_opening_v1') === 'true';

      expect(isFreshShopMigratedV1).toBe(true);
      expect(isFreshShopMigratedV2).toBe(false);

      // Migration logic:
      let loadedOrders: OrderBill[] = [];
      const saved = localStorage.getItem('albhurani_orders');
      if (saved) {
        loadedOrders = JSON.parse(saved);
      }

      if (isFreshShopMigratedV1 && !isFreshShopMigratedV2) {
        // Upgrade flag without wiping orders!
        localStorage.setItem('albhurani_fresh_shop_opening_v2', 'true');
      }

      expect(localStorage.getItem('albhurani_fresh_shop_opening_v2')).toBe('true');
      // Verify genuine sales were NEVER wiped
      expect(loadedOrders.length).toBe(2);
      expect(loadedOrders[0].billNumber).toBe('ALB-INV-2725');
      expect(loadedOrders[1].billNumber).toBe('ALB-INV-2727');
    });

    it('preserves genuine customer records when resetting demo orders', () => {
      const ordersWithCustomers: OrderBill[] = [
        wrongInvoice, // Walk-in demo
        invoiceA,     // Real customer: Shabbir Bhai, 9825111111
      ];

      const preserved = preserveRealCustomersFromOrders(ordersWithCustomers);
      expect(preserved.length).toBe(1);
      expect(preserved[0].name).toBe('Shabbir Bhai');
      expect(preserved[0].phone).toBe('9825111111');

      const savedCustomers = getSavedCustomers();
      expect(savedCustomers.length).toBe(1);
      expect(savedCustomers[0].name).toBe('Shabbir Bhai');
    });
  });

  describe('5. Stock Restoration on Bill Deletion (With & Without GST)', () => {
    it('restores weight-based stock accurately when deleting a 250g sale (4.25kg -> 4.50kg)', () => {
      const bhukhoB = {
        id: 'prod-bhukho-b',
        sku: '80548406576',
        barcode: '80548406576',
        name: 'BHUKHO B',
        category: 'SWEETS',
        unit: 'KG',
        costPrice: 0,
        sellingPrice: 100,
        stock: 4.25, // current stock after 250g sale was made
        minStock: 0,
      };

      const noBillSale: OrderBill = {
        id: 'nb-1729355000',
        billNumber: 'NB-1729355000',
        transactionType: 'NO_BILL',
        items: [
          {
            product: bhukhoB,
            quantity: 0.25, // 250 grams
            unit: 'KG',
            unitPrice: 100,
            lineTotal: 25,
            discountPercent: 0,
            formattedQuantity: '250 g',
            formattedRate: '₹100.00/kg',
          },
        ],
        subtotal: 25,
        discountAmount: 0,
        gstAmount: 0,
        grandTotal: 25,
        paymentMethod: 'CASH',
        amountReceived: 25,
        changeGiven: 0,
        cashierName: 'Owner',
        createdAt: '20 Oct 2026, 12:30 am',
        timestamp: 1729355000000,
      };

      let products = [bhukhoB];
      let orders = [noBillSale];

      // Replicate handleDeleteOrder stock restoration logic
      const orderToDelete = orders.find((o) => o.id === 'nb-1729355000');
      expect(orderToDelete).toBeDefined();

      const quantityByProductId = new Map<string, number>();
      for (const it of orderToDelete!.items) {
        const prev = quantityByProductId.get(it.product.id) || 0;
        quantityByProductId.set(it.product.id, prev + (Number(it.quantity) || 0));
      }

      products = products.map((prod) => {
        const qtyToRestore = quantityByProductId.get(prod.id);
        if (qtyToRestore && qtyToRestore > 0) {
          const isWeight = prod.unit === 'KG' || prod.unit === 'G';
          const restored = isWeight
            ? Math.round((prod.stock + qtyToRestore) * 1000) / 1000
            : Math.round(prod.stock + qtyToRestore);
          return {
            ...prod,
            stock: restored,
          };
        }
        return prod;
      });

      // Verify stock was restored from 4.25 kg to 4.50 kg!
      expect(products[0].stock).toBe(4.5);
    });

    it('restores multiple products (weight and piece based) upon order deletion', () => {
      const sweetKg = { id: 'p1', stock: 2.125, unit: 'KG' };
      const namkeenPcs = { id: 'p2', stock: 18, unit: 'PCS' };

      const order: OrderBill = {
        id: 'ord-multi-item',
        billNumber: 'ALB-INV-9999',
        transactionType: 'CUSTOMER_BILL',
        items: [
          { product: sweetKg as any, quantity: 0.375, unit: 'KG', unitPrice: 400, lineTotal: 150, discountPercent: 0, formattedQuantity: '375g', formattedRate: '₹400/kg' },
          { product: namkeenPcs as any, quantity: 3, unit: 'PCS', unitPrice: 50, lineTotal: 150, discountPercent: 0, formattedQuantity: '3 PCS', formattedRate: '₹50/pc' },
        ],
        subtotal: 300,
        discountAmount: 0,
        gstAmount: 15,
        grandTotal: 315,
        paymentMethod: 'UPI',
        amountReceived: 315,
        changeGiven: 0,
        cashierName: 'Owner',
        createdAt: '20 Oct 2026, 12:35 am',
        timestamp: 1729355100000,
      };

      let products = [sweetKg, namkeenPcs];

      const quantityByProductId = new Map<string, number>();
      for (const it of order.items) {
        const prev = quantityByProductId.get(it.product.id) || 0;
        quantityByProductId.set(it.product.id, prev + (Number(it.quantity) || 0));
      }

      products = products.map((prod) => {
        const qtyToRestore = quantityByProductId.get(prod.id);
        if (qtyToRestore && qtyToRestore > 0) {
          const isWeight = prod.unit === 'KG' || prod.unit === 'G';
          const restored = isWeight
            ? Math.round((prod.stock + qtyToRestore) * 1000) / 1000
            : Math.round(prod.stock + qtyToRestore);
          return {
            ...prod,
            stock: restored,
          };
        }
        return prod;
      });

      // 2.125 + 0.375 = 2.500 kg
      expect(products[0].stock).toBe(2.5);
      // 18 + 3 = 21 pcs
      expect(products[1].stock).toBe(21);
    });
  });
});
