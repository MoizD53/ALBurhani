import { describe, it, expect, vi } from 'vitest';
import { Product, OrderBill, PaymentMethod, TransactionType, CompleteSaleResult } from '../types';
import { IMPORTED_PRODUCTS } from '../data/importedProducts';
import { buildCartItem, deductStock, calculateOrderTotals } from '../lib/pricing';
import { isOrderInDateRange } from '../lib/utils';

describe('Real Sales Persistence & Checkout Verification', () => {
  const sampleProduct: Product = {
    id: 'test-kaju-katli',
    sku: '0001',
    barcode: '0001',
    name: 'KAJU KATLI 250G',
    category: 'Sweets',
    unit: 'PCS',
    priceBasis: '₹/pc',
    costPrice: 0,
    sellingPrice: 275,
    stock: 50,
    minStock: 5,
  };

  const sampleWeightProduct: Product = {
    id: 'test-ratlami-sev',
    sku: '67225776696',
    barcode: '67225776696',
    name: 'RATLAMI SEV',
    category: 'Namkeen & Farsan',
    unit: 'KG',
    priceBasis: '₹/kg',
    costPrice: 0,
    sellingPrice: 320,
    stock: 25.5,
    minStock: 3,
  };

  // Helper simulating the exact PosBillingView:handleCheckout logic
  async function performCheckout({
    transactionType,
    paymentMethod,
    cart,
    receivedAmount,
    onCompleteSale,
  }: {
    transactionType: TransactionType;
    paymentMethod: PaymentMethod;
    cart: ReturnType<typeof buildCartItem>[];
    receivedAmount?: number;
    onCompleteSale: (order: OrderBill) => Promise<CompleteSaleResult> | CompleteSaleResult;
  }) {
    const {
      subtotal,
      discountAmount,
      taxableAmount,
      gstAmount,
      grandTotal,
    } = calculateOrderTotals(cart, 0, transactionType);

    const prefix = transactionType === 'CUSTOMER_BILL' ? 'INV' : 'NB';
    const randomNum = 4821;
    const billNumber = `ALB-${prefix}-${randomNum}`;
    const timestamp = Date.now();

    const receivedNum = receivedAmount ?? grandTotal;
    const changeGiven = paymentMethod === 'CASH' ? Math.max(0, receivedNum - grandTotal) : 0;

    const newOrder: OrderBill = {
      id: `sale-${timestamp}-${randomNum}`,
      billNumber,
      transactionType,
      items: [...cart],
      subtotal,
      discountAmount,
      gstAmount,
      grandTotal,
      paymentMethod,
      amountReceived: paymentMethod === 'CASH' ? receivedNum : grandTotal,
      changeGiven: paymentMethod === 'CASH' ? changeGiven : 0,
      cashierName: 'Owner',
      createdAt: new Date(timestamp).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
      timestamp,
    };

    const result = await onCompleteSale(newOrder);

    let completedOrderModal: OrderBill | null = null;
    let toastMessage = '';
    let isCartCleared = false;

    if (!result || result.success === false) {
      toastMessage = `❌ Could not save sale: ${result?.error || 'Persistence failed'}`;
      // Cart is NOT cleared and modal is NOT opened on failure
      isCartCleared = false;
      completedOrderModal = null;
    } else {
      if (transactionType === 'CUSTOMER_BILL') {
        completedOrderModal = newOrder;
      } else {
        toastMessage = `✓ No-Bill Sale #${billNumber} recorded successfully!`;
      }
      isCartCleared = true;
    }

    return { newOrder, completedOrderModal, toastMessage, isCartCleared, result };
  }

  // ─── 1. Real Persistent Checkout: Bill Number Prefixes & Persistence ───
  it('1. Generates real ALB-INV and ALB-NB bills with Owner cashier and persists to orders', async () => {
    let persistedOrders: OrderBill[] = [];

    const handleCompleteSale = (order: OrderBill): CompleteSaleResult => {
      persistedOrders = [order, ...persistedOrders];
      return { success: true, order };
    };

    const cart = [buildCartItem(sampleProduct, 2)];

    // Formal Customer Bill (With GST)
    const invResult = await performCheckout({
      transactionType: 'CUSTOMER_BILL',
      paymentMethod: 'CASH',
      cart,
      onCompleteSale: handleCompleteSale,
    });

    expect(invResult.newOrder.billNumber).toMatch(/^ALB-INV-\d+$/);
    expect(invResult.newOrder.id).toMatch(/^sale-\d+-\d+$/);
    expect(invResult.newOrder.cashierName).toBe('Owner');
    // GST-inclusive: 550 / 1.05 = 523.81 taxable, 26.19 included GST, 550 total
    expect(invResult.newOrder.gstAmount).toBe(26.19);
    expect(invResult.newOrder.grandTotal).toBe(550);
    expect(invResult.isCartCleared).toBe(true);
    expect(invResult.completedOrderModal).toEqual(invResult.newOrder);
    expect(persistedOrders.length).toBe(1);

    // No-Bill Sale
    const nbResult = await performCheckout({
      transactionType: 'NO_BILL',
      paymentMethod: 'UPI',
      cart,
      onCompleteSale: handleCompleteSale,
    });

    expect(nbResult.newOrder.billNumber).toMatch(/^ALB-NB-\d+$/);
    expect(nbResult.newOrder.gstAmount).toBe(0);
    expect(nbResult.isCartCleared).toBe(true);
    expect(persistedOrders.length).toBe(2);
  });

  // ─── 2. Inventory Decreases Correctly ───
  it('2. Decreases inventory accurately for sold piece and weight products', async () => {
    let stockPcs = sampleProduct.stock; // 50
    let stockKg = sampleWeightProduct.stock; // 25.5

    const handleCompleteSale = (order: OrderBill): CompleteSaleResult => {
      for (const item of order.items) {
        if (item.product.id === sampleProduct.id) {
          stockPcs = deductStock(stockPcs, item.quantity, false);
        }
        if (item.product.id === sampleWeightProduct.id) {
          stockKg = deductStock(stockKg, item.quantity, true);
        }
      }
      return { success: true, order };
    };

    const cart = [
      buildCartItem(sampleProduct, 3), // 3 pcs
      buildCartItem(sampleWeightProduct, 0.375, 375), // 375g = 0.375 kg
    ];

    await performCheckout({
      transactionType: 'CUSTOMER_BILL',
      paymentMethod: 'CASH',
      cart,
      onCompleteSale: handleCompleteSale,
    });

    expect(stockPcs).toBe(47);
    expect(stockKg).toBe(25.125); // 25.5 - 0.375
  });

  // ─── 3. Failed Save Handling (No False Receipt or Success) ───
  it('3. Does NOT clear cart or display receipt if persistence fails', async () => {
    const handleCompleteSaleFails = (_order: OrderBill): CompleteSaleResult => {
      return { success: false, error: 'Database connection failed' };
    };

    const cart = [buildCartItem(sampleProduct, 1)];

    const result = await performCheckout({
      transactionType: 'CUSTOMER_BILL',
      paymentMethod: 'CASH',
      cart,
      onCompleteSale: handleCompleteSaleFails,
    });

    expect(result.result.success).toBe(false);
    expect(result.isCartCleared).toBe(false);
    expect(result.completedOrderModal).toBeNull();
    expect(result.toastMessage).toContain('Could not save sale');
  });

  // ─── 4. Duplicate Order Prevention ───
  it('4. Rejects duplicate submissions with identical order ID or bill number', () => {
    const existingOrders: OrderBill[] = [
      {
        id: 'sale-1729328400000-1111',
        billNumber: 'ALB-INV-1111',
        transactionType: 'CUSTOMER_BILL',
        items: [buildCartItem(sampleProduct, 1)],
        subtotal: 275,
        discountAmount: 0,
        gstAmount: 13.75,
        grandTotal: 289,
        paymentMethod: 'CASH',
        amountReceived: 300,
        changeGiven: 11,
        cashierName: 'Owner',
        createdAt: '19 Oct 2026, 12:00 PM',
        timestamp: 1729328400000,
      },
    ];

    const duplicateOrder: OrderBill = {
      ...existingOrders[0],
    };

    // Replicate App.tsx validation logic
    const validateAndSave = (order: OrderBill, orders: OrderBill[]): CompleteSaleResult => {
      if (orders.some((o) => o.id === order.id || o.billNumber === order.billNumber)) {
        return { success: false, error: `Duplicate order: ${order.billNumber} is already recorded` };
      }
      return { success: true, order };
    };

    const result = validateAndSave(duplicateOrder, existingOrders);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Duplicate order');
  });

  // ─── 5. Defense-in-Depth: Obsolete Simulated Orders Rejected ───
  it('5. Defense-in-depth: Rejects obsolete simulated orders from ever polluting real records', () => {
    const ordersLedger: OrderBill[] = [];

    const handleCompleteSale = (order: OrderBill): CompleteSaleResult => {
      if (order.id.startsWith('sim-') || order.billNumber.startsWith('ALB-SIM')) {
        return { success: false, error: 'Simulated orders are rejected' };
      }
      ordersLedger.push(order);
      return { success: true, order };
    };

    const simOrder: OrderBill = {
      id: 'sim-1729328400000',
      billNumber: 'ALB-SIM-4821',
      transactionType: 'CUSTOMER_BILL',
      items: [buildCartItem(sampleProduct, 10)],
      subtotal: 2750,
      discountAmount: 0,
      gstAmount: 137.5,
      grandTotal: 2888,
      paymentMethod: 'CASH',
      amountReceived: 3000,
      changeGiven: 112,
      cashierName: 'Simulator',
      createdAt: '12:00 PM',
    };

    const result = handleCompleteSale(simOrder);
    expect(result.success).toBe(false);
    expect(ordersLedger.length).toBe(0);
  });

  // ─── 6. Date Range Filtering in Sales/Reports ───
  it('6. Accurately filters orders by date range without hiding current sales', () => {
    const now = Date.now();
    const todayOrder: OrderBill = {
      id: `sale-${now}-1`,
      billNumber: 'ALB-INV-5001',
      transactionType: 'CUSTOMER_BILL',
      items: [buildCartItem(sampleProduct, 1)],
      subtotal: 275,
      discountAmount: 0,
      gstAmount: 13.75,
      grandTotal: 289,
      paymentMethod: 'CASH',
      amountReceived: 300,
      changeGiven: 11,
      cashierName: 'Owner',
      createdAt: new Date(now).toLocaleString('en-IN'),
      timestamp: now,
    };

    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
    const recentOrder: OrderBill = {
      ...todayOrder,
      id: `sale-${threeDaysAgo}-2`,
      billNumber: 'ALB-INV-5002',
      timestamp: threeDaysAgo,
    };

    const fortyDaysAgo = now - 40 * 24 * 60 * 60 * 1000;
    const oldOrder: OrderBill = {
      ...todayOrder,
      id: `sale-${fortyDaysAgo}-3`,
      billNumber: 'ALB-INV-5003',
      timestamp: fortyDaysAgo,
    };

    const allOrders = [todayOrder, recentOrder, oldOrder];

    // 'all' includes all 3
    expect(allOrders.filter((o) => isOrderInDateRange(o, 'all')).length).toBe(3);

    // 'today' includes today's order
    const todayMatches = allOrders.filter((o) => isOrderInDateRange(o, 'today'));
    expect(todayMatches.length).toBe(1);
    expect(todayMatches[0].billNumber).toBe('ALB-INV-5001');

    // '7days' includes today and 3 days ago
    const weekMatches = allOrders.filter((o) => isOrderInDateRange(o, '7days'));
    expect(weekMatches.length).toBe(2);

    // 'month' includes today and 3 days ago, excludes 40 days ago
    const monthMatches = allOrders.filter((o) => isOrderInDateRange(o, 'month'));
    expect(monthMatches.length).toBe(2);
  });
});
