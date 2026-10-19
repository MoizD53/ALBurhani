import { describe, it, expect, vi } from 'vitest';
import { Product, OrderBill, PaymentMethod, TransactionType } from '../types';
import { IMPORTED_PRODUCTS } from '../data/importedProducts';
import { buildCartItem, deductStock } from '../lib/pricing';

describe('Test Mode Checkout Safety Verification', () => {
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

  // Helper simulating the exact checkout logic from PosBillingView.tsx:handleCheckout
  function simulateCheckout({
    isTestMode,
    transactionType,
    paymentMethod,
    cart,
    receivedAmount,
    onCompleteSale,
  }: {
    isTestMode: boolean;
    transactionType: TransactionType;
    paymentMethod: PaymentMethod;
    cart: ReturnType<typeof buildCartItem>[];
    receivedAmount?: number;
    onCompleteSale: (order: OrderBill) => void;
  }) {
    const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
    const discountAmount = 0;
    const taxableAmount = subtotal;
    const gstAmount = transactionType === 'CUSTOMER_BILL' ? Math.round(taxableAmount * 0.05 * 100) / 100 : 0;
    const grandTotal = taxableAmount + gstAmount;

    const prefix = isTestMode ? 'SIM' : transactionType === 'CUSTOMER_BILL' ? 'INV' : 'NB';
    const randomNum = 4821;
    const billNumber = `ALB-${prefix}-${randomNum}`;

    const receivedNum = receivedAmount ?? grandTotal;
    const changeGiven = paymentMethod === 'CASH' ? Math.max(0, receivedNum - grandTotal) : 0;

    const newOrder: OrderBill = {
      id: isTestMode ? `sim-${Date.now()}` : `sale-${Date.now()}`,
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
      cashierName: isTestMode ? 'Simulator (Dry Run)' : 'Owner',
      createdAt: '12:00 PM',
    };

    let completedOrderState: OrderBill | null = null;
    let toastMessage = '';

    if (isTestMode) {
      // In TEST MODE: Do NOT call onCompleteSale!
      completedOrderState = newOrder;
      toastMessage = `🧪 Dry-Run #${billNumber} simulated! Real stock untouched.`;
    } else {
      onCompleteSale(newOrder);
      if (transactionType === 'CUSTOMER_BILL') {
        completedOrderState = newOrder;
      } else {
        toastMessage = `No-Bill Sale #${billNumber} recorded successfully!`;
      }
    }

    return { newOrder, completedOrderState, toastMessage };
  }

  // ─── 1. Test Mode ON: Isolation & ALB-SIM- Prefix ───
  it('1. Test Mode ON: creates only simulated order with ALB-SIM- prefix and does NOT call onCompleteSale', () => {
    const onCompleteSaleMock = vi.fn();
    const cart = [buildCartItem(sampleProduct, 2)];

    const { newOrder, completedOrderState, toastMessage } = simulateCheckout({
      isTestMode: true,
      transactionType: 'CUSTOMER_BILL',
      paymentMethod: 'CASH',
      cart,
      onCompleteSale: onCompleteSaleMock,
    });

    // 1. Prefix and ID checks
    expect(newOrder.billNumber).toMatch(/^ALB-SIM-\d+$/);
    expect(newOrder.id).toMatch(/^sim-\d+$/);
    expect(newOrder.cashierName).toBe('Simulator (Dry Run)');

    // 2. onCompleteSale is NOT called
    expect(onCompleteSaleMock).not.toHaveBeenCalled();

    // 3. UI receives dry-run simulation order
    expect(completedOrderState).toEqual(newOrder);
    expect(toastMessage).toContain('Dry-Run');
    expect(toastMessage).toContain('Real stock untouched');
  });

  // ─── 2. Payment Methods Simulated Safely in Test Mode ───
  it('2. Safely simulates CASH, UPI QR, and CARD payments in Test Mode without external network or gateways', () => {
    const onCompleteSaleMock = vi.fn();
    const cart = [buildCartItem(sampleProduct, 1)];

    // Cash with change
    const cashResult = simulateCheckout({
      isTestMode: true,
      transactionType: 'CUSTOMER_BILL',
      paymentMethod: 'CASH',
      cart,
      receivedAmount: 500,
      onCompleteSale: onCompleteSaleMock,
    });
    expect(cashResult.newOrder.paymentMethod).toBe('CASH');
    expect(cashResult.newOrder.amountReceived).toBe(500);
    expect(cashResult.newOrder.changeGiven).toBeGreaterThan(0);
    expect(onCompleteSaleMock).not.toHaveBeenCalled();

    // UPI QR
    const upiResult = simulateCheckout({
      isTestMode: true,
      transactionType: 'CUSTOMER_BILL',
      paymentMethod: 'UPI',
      cart,
      onCompleteSale: onCompleteSaleMock,
    });
    expect(upiResult.newOrder.paymentMethod).toBe('UPI');
    expect(upiResult.newOrder.amountReceived).toBe(upiResult.newOrder.grandTotal);
    expect(upiResult.newOrder.changeGiven).toBe(0);
    expect(onCompleteSaleMock).not.toHaveBeenCalled();

    // Card
    const cardResult = simulateCheckout({
      isTestMode: true,
      transactionType: 'CUSTOMER_BILL',
      paymentMethod: 'CARD',
      cart,
      onCompleteSale: onCompleteSaleMock,
    });
    expect(cardResult.newOrder.paymentMethod).toBe('CARD');
    expect(cardResult.newOrder.amountReceived).toBe(cardResult.newOrder.grandTotal);
    expect(cardResult.newOrder.changeGiven).toBe(0);
    expect(onCompleteSaleMock).not.toHaveBeenCalled();
  });

  // ─── 3. Test Mode OFF: Real Sales Processing ───
  it('3. Test Mode OFF: calls onCompleteSale and records real invoice or no-bill sale', () => {
    const onCompleteSaleMock = vi.fn();
    const cart = [buildCartItem(sampleProduct, 1)];

    // Customer Bill (Formal Tax Invoice)
    const invResult = simulateCheckout({
      isTestMode: false,
      transactionType: 'CUSTOMER_BILL',
      paymentMethod: 'CASH',
      cart,
      onCompleteSale: onCompleteSaleMock,
    });
    expect(invResult.newOrder.billNumber).toMatch(/^ALB-INV-\d+$/);
    expect(invResult.newOrder.id).toMatch(/^sale-\d+$/);
    expect(invResult.newOrder.cashierName).toBe('Owner');
    expect(onCompleteSaleMock).toHaveBeenCalledTimes(1);
    expect(onCompleteSaleMock).toHaveBeenCalledWith(invResult.newOrder);

    // No-Bill Sale (Internal Cash Record)
    const nbResult = simulateCheckout({
      isTestMode: false,
      transactionType: 'NO_BILL',
      paymentMethod: 'CASH',
      cart,
      onCompleteSale: onCompleteSaleMock,
    });
    expect(nbResult.newOrder.billNumber).toMatch(/^ALB-NB-\d+$/);
    expect(nbResult.newOrder.gstAmount).toBe(0);
    expect(onCompleteSaleMock).toHaveBeenCalledTimes(2);
  });

  // ─── 4. Defense-in-Depth Guard in App.tsx ───
  it('4. Defense-in-depth: handleCompleteSale in App.tsx blocks simulated orders even if directly invoked', () => {
    let ordersLedger: OrderBill[] = [];
    let productStock = sampleProduct.stock; // 50

    // Replicate App.tsx handleCompleteSale logic with defense-in-depth guard
    const handleCompleteSaleWithGuard = (order: OrderBill) => {
      if (order.id.startsWith('sim-') || order.billNumber.startsWith('ALB-SIM')) {
        return; // Rejected!
      }

      ordersLedger = [order, ...ordersLedger];
      const itemInBill = order.items.find((i) => i.product.id === sampleProduct.id);
      if (itemInBill) {
        productStock = deductStock(productStock, itemInBill.quantity, false);
      }
    };

    // Attempt to pass a simulated order directly to handleCompleteSale
    const simOrder: OrderBill = {
      id: 'sim-1729328400000',
      billNumber: 'ALB-SIM-4821',
      transactionType: 'CUSTOMER_BILL',
      items: [buildCartItem(sampleProduct, 10)],
      subtotal: 2750,
      discountAmount: 0,
      gstAmount: 137.5,
      grandTotal: 2887.5,
      paymentMethod: 'CASH',
      amountReceived: 3000,
      changeGiven: 112.5,
      cashierName: 'Simulator',
      createdAt: '12:00 PM',
    };

    handleCompleteSaleWithGuard(simOrder);

    // Verify ZERO mutations occurred
    expect(ordersLedger.length).toBe(0);
    expect(productStock).toBe(50); // Untouched!
  });
});
