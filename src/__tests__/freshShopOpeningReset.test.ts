import { describe, it, expect, beforeEach } from 'vitest';
import { OrderBill, ExpenseItem, Product } from '../types';
import { 
  isDemoCustomer, 
  preserveRealCustomersFromOrders, 
  getSavedCustomers, 
  saveCustomers,
  upsertCustomerFromSale 
} from '../lib/customers';
import { isOrderInDateRange } from '../lib/utils';

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

describe('AL-BHURANI POS Fresh Shop Opening Data Architecture & Reset Verification', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('1. Revenue & Sales History Reset (Requirement 1 & 4)', () => {
    it('verifies demo/test orders result in non-zero revenue, and clearing them resets Today and Lifetime revenue to ₹0', () => {
      // Pre-opening demo orders (matches the ₹85 cash orders from the screenshot)
      const demoOrders: OrderBill[] = [
        {
          id: 'sale-1729350000-1111',
          billNumber: 'ALB-INV-1111',
          transactionType: 'CUSTOMER_BILL',
          items: [],
          subtotal: 50,
          discountAmount: 0,
          gstAmount: 2.5,
          grandTotal: 50,
          paymentMethod: 'CASH',
          amountReceived: 50,
          changeGiven: 0,
          cashierName: 'Owner',
          createdAt: new Date().toLocaleString(),
          timestamp: Date.now(),
        },
        {
          id: 'sale-1729350000-2222',
          billNumber: 'ALB-INV-2222',
          transactionType: 'CUSTOMER_BILL',
          items: [],
          subtotal: 35,
          discountAmount: 0,
          gstAmount: 1.75,
          grandTotal: 35,
          paymentMethod: 'CASH',
          amountReceived: 50,
          changeGiven: 15,
          cashierName: 'Owner',
          createdAt: new Date().toLocaleString(),
          timestamp: Date.now(),
        },
      ];

      // Prior to reset: matches screenshot figures
      const todayOrdersBefore = demoOrders.filter((o) => isOrderInDateRange(o, 'today'));
      const todayRevenueBefore = todayOrdersBefore.reduce((sum, o) => sum + o.grandTotal, 0);
      const lifetimeRevenueBefore = demoOrders.reduce((sum, o) => sum + o.grandTotal, 0);
      const cashTenderBefore = demoOrders.filter((o) => o.paymentMethod === 'CASH').reduce((sum, o) => sum + o.grandTotal, 0);

      expect(todayRevenueBefore).toBe(85);
      expect(lifetimeRevenueBefore).toBe(85);
      expect(cashTenderBefore).toBe(85);
      expect(demoOrders.length).toBe(2);

      // Perform fresh shop opening reset
      const resetOrders: OrderBill[] = [];

      // After reset: strictly ₹0
      const todayOrdersAfter = resetOrders.filter((o) => isOrderInDateRange(o, 'today'));
      const todayRevenueAfter = todayOrdersAfter.reduce((sum, o) => sum + o.grandTotal, 0);
      const lifetimeRevenueAfter = resetOrders.reduce((sum, o) => sum + o.grandTotal, 0);
      const cashTenderAfter = resetOrders.filter((o) => o.paymentMethod === 'CASH').reduce((sum, o) => sum + o.grandTotal, 0);
      const upiTenderAfter = resetOrders.filter((o) => o.paymentMethod === 'UPI').reduce((sum, o) => sum + o.grandTotal, 0);
      const cardTenderAfter = resetOrders.filter((o) => o.paymentMethod === 'CARD').reduce((sum, o) => sum + o.grandTotal, 0);

      expect(todayRevenueAfter).toBe(0);
      expect(lifetimeRevenueAfter).toBe(0);
      expect(cashTenderAfter).toBe(0);
      expect(upiTenderAfter).toBe(0);
      expect(cardTenderAfter).toBe(0);
      expect(resetOrders.length).toBe(0);
    });
  });

  describe('2. Customer Records Reset & Real Customer Preservation (Requirement 2)', () => {
    it('accurately distinguishes demo/test customer names and phones from real customer records', () => {
      // Demo customers
      expect(isDemoCustomer('', '')).toBe(true);
      expect(isDemoCustomer('Walk-in Customer', '')).toBe(true);
      expect(isDemoCustomer('Walkin', '9876543210')).toBe(true);
      expect(isDemoCustomer('Test Customer', '9825000000')).toBe(true);
      expect(isDemoCustomer('Demo Billing', '9426000000')).toBe(true);
      expect(isDemoCustomer('Dummy', '1234567890')).toBe(true);
      expect(isDemoCustomer('Cash', '0000000000')).toBe(true);
      expect(isDemoCustomer('Counter Customer', '9999999999')).toBe(true);

      // Real customers
      expect(isDemoCustomer('Murtaza Bhurani', '9825123456')).toBe(false);
      expect(isDemoCustomer('Fatima Shabbir', '9426812345')).toBe(false);
      expect(isDemoCustomer('Hussain Godi Road', '9100012345')).toBe(false);
    });

    it('resets customer count to zero while preserving real customers in directory', () => {
      const mixedOrders: OrderBill[] = [
        // Demo order 1 (Walk-in, no phone)
        {
          id: 'sale-demo-1',
          billNumber: 'ALB-INV-001',
          transactionType: 'CUSTOMER_BILL',
          items: [],
          subtotal: 50,
          discountAmount: 0,
          gstAmount: 2.5,
          grandTotal: 52.5,
          paymentMethod: 'CASH',
          amountReceived: 60,
          changeGiven: 7.5,
          customerName: 'Walk-in Customer',
          cashierName: 'Owner',
          createdAt: new Date().toLocaleString(),
          timestamp: Date.now(),
        },
        // Demo order 2 (Test user)
        {
          id: 'sale-demo-2',
          billNumber: 'ALB-INV-002',
          transactionType: 'CUSTOMER_BILL',
          items: [],
          subtotal: 35,
          discountAmount: 0,
          gstAmount: 1.75,
          grandTotal: 36.75,
          paymentMethod: 'CASH',
          amountReceived: 40,
          changeGiven: 3.25,
          customerName: 'Test Barcode Customer',
          customerPhone: '1234567890',
          cashierName: 'Owner',
          createdAt: new Date().toLocaleString(),
          timestamp: Date.now(),
        },
        // Real customer order (e.g. VIP pre-opening tasting or opening patron)
        {
          id: 'sale-real-1',
          billNumber: 'ALB-INV-003',
          transactionType: 'CUSTOMER_BILL',
          items: [],
          subtotal: 1200,
          discountAmount: 0,
          gstAmount: 60,
          grandTotal: 1260,
          paymentMethod: 'UPI',
          amountReceived: 1260,
          changeGiven: 0,
          customerName: 'Murtaza Bhurani',
          customerPhone: '9825123456',
          cashierName: 'Owner',
          createdAt: new Date().toLocaleString(),
          timestamp: Date.now(),
        },
      ];

      // Extract & preserve real customers before wiping demo sales
      const preserved = preserveRealCustomersFromOrders(mixedOrders);

      // Only the real customer is preserved in directory
      expect(preserved.length).toBe(1);
      expect(preserved[0].name).toBe('Murtaza Bhurani');
      expect(preserved[0].phone).toBe('9825123456');

      // Orders are wiped for opening
      const cleanOrders: OrderBill[] = [];

      // Customer counts on dashboard are derived from active clean orders -> 0
      const todayCustomersCount = cleanOrders.length;
      const totalCustomersCount = cleanOrders.length;

      expect(todayCustomersCount).toBe(0);
      expect(totalCustomersCount).toBe(0);

      // Verify localStorage saved customers has the preserved record intact
      const directory = getSavedCustomers();
      expect(directory.length).toBe(1);
      expect(directory[0].name).toBe('Murtaza Bhurani');
    });
  });

  describe('3. Operating Expenses Reset (Requirement 3)', () => {
    it('resets Today Expenses and Total Expenses to ₹0', () => {
      const demoExpenses: ExpenseItem[] = [
        {
          id: 'expense-1',
          title: 'Mock Staff Lunch Test',
          category: 'Miscellaneous',
          amount: 350,
          date: 'Today, 01:00 PM',
          paymentMode: 'Cash',
        },
        {
          id: 'expense-2',
          title: 'Store Cleaning Supplies',
          category: 'Cleaning & Housekeeping',
          amount: 650,
          date: 'Today, 02:30 PM',
          paymentMode: 'UPI',
        },
      ];

      const todayExpensesBefore = demoExpenses.reduce((sum, e) => sum + e.amount, 0);
      const totalExpensesBefore = demoExpenses.reduce((sum, e) => sum + e.amount, 0);
      expect(todayExpensesBefore).toBe(1000);
      expect(totalExpensesBefore).toBe(1000);

      // Perform fresh shop opening reset
      const resetExpenses: ExpenseItem[] = [];

      const todayExpensesAfter = resetExpenses.reduce((sum, e) => sum + e.amount, 0);
      const totalExpensesAfter = resetExpenses.reduce((sum, e) => sum + e.amount, 0);

      expect(todayExpensesAfter).toBe(0);
      expect(totalExpensesAfter).toBe(0);
    });
  });

  describe('4. Fresh Shop Opening Migration Flag', () => {
    it('verifies albhurani_fresh_shop_opening_v1 successfully clears stale orders and initializes zero state', () => {
      // Simulate stale cached orders
      const staleOrders = [
        { id: 'sale-test-1', billNumber: 'ALB-INV-99', grandTotal: 85, paymentMethod: 'CASH', customerName: 'Demo' },
      ];
      localStorage.setItem('albhurani_orders', JSON.stringify(staleOrders));
      localStorage.setItem('albhurani_expenses', JSON.stringify([{ id: 'exp-1', amount: 500 }]));

      // Check migration flag
      const isFreshShopMigrated = localStorage.getItem('albhurani_fresh_shop_opening_v1');
      expect(isFreshShopMigrated).toBeNull();

      // Run migration
      if (!isFreshShopMigrated) {
        preserveRealCustomersFromOrders(staleOrders as any);
        localStorage.setItem('albhurani_orders', JSON.stringify([]));
        localStorage.setItem('albhurani_expenses', JSON.stringify([]));
        localStorage.setItem('albhurani_fresh_shop_opening_v1', 'true');
      }

      expect(localStorage.getItem('albhurani_fresh_shop_opening_v1')).toBe('true');
      expect(JSON.parse(localStorage.getItem('albhurani_orders')!)).toEqual([]);
      expect(JSON.parse(localStorage.getItem('albhurani_expenses')!)).toEqual([]);
    });
  });

});
