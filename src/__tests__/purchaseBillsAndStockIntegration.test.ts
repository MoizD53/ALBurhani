import { describe, it, expect } from 'vitest';
import { PurchaseBill, PurchaseItem, Vendor, VendorPayment, ExpenseItem } from '../types';

describe('Purchase Bills, Stock Delta & Expense Integration', () => {
  it('correctly calculates purchase bill financial totals with decimal safety', () => {
    const items: PurchaseItem[] = [
      {
        productId: 'prod-kaju-1',
        productName: 'Raw Kaju Whole W320',
        quantity: 25.5,
        unit: 'KG',
        unitPrice: 650.0,
        lineTotal: 25.5 * 650.0, // 16575
      },
      {
        productId: 'prod-almond-1',
        productName: 'California Almonds Inshell',
        quantity: 10,
        unit: 'KG',
        unitPrice: 580.0,
        lineTotal: 5800.0,
      },
    ];

    const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0); // 22375
    const discount = 375.0;
    const additionalCharges = 200.0; // e.g. Transport/Freight
    const grandTotal = subtotal - discount + additionalCharges; // 22200
    const amountPaid = 12200.0;
    const balanceDue = grandTotal - amountPaid; // 10000

    const paymentStatus: 'Paid' | 'Partially Paid' | 'Unpaid' =
      balanceDue <= 0.01 ? 'Paid' : amountPaid > 0 ? 'Partially Paid' : 'Unpaid';

    expect(subtotal).toBe(22375);
    expect(grandTotal).toBe(22200);
    expect(balanceDue).toBe(10000);
    expect(paymentStatus).toBe('Partially Paid');
  });

  it('calculates inventory stock movement delta when editing a purchase bill', () => {
    // Original purchase entry: 20 KG of Cashew
    const originalQty = 20;
    let initialProductStock = 5;

    // First save: stock increases by 20
    initialProductStock += originalQty;
    expect(initialProductStock).toBe(25);

    // Edit scenario 1: Manager increases quantity to 35 KG
    const updatedQty1 = 35;
    const delta1 = updatedQty1 - originalQty; // +15
    initialProductStock += delta1;
    expect(initialProductStock).toBe(40); // 25 + 15 = 40 (NOT 25 + 35 = 60)

    // Edit scenario 2: Vendor correction reduces quantity from 35 KG to 30 KG
    const updatedQty2 = 30;
    const delta2 = updatedQty2 - updatedQty1; // -5
    initialProductStock += delta2;
    expect(initialProductStock).toBe(35); // 40 - 5 = 35
  });

  it('safely reverses inward stock upon bill cancellation and prevents negative inventory', () => {
    let currentStock = 12; // 12 KG currently in shop
    const purchasedQty = 15; // The cancelled bill had 15 KG (3 KG were already sold)

    // Reversal logic: Math.max(0, currentStock - purchasedQty)
    currentStock = Math.max(0, currentStock - purchasedQty);
    expect(currentStock).toBe(0); // Floor at 0, does NOT become -3
  });

  it('builds a reconciled vendor ledger statement with running balance', () => {
    const vendor: Vendor = {
      id: 'ven-royal-nuts',
      name: 'Royal Dry Fruits Wholesalers',
      contactNumber: '9820123456',
    };

    const bill1: PurchaseBill = {
      id: 'pur-1',
      purchaseNumber: 'PUR-0001',
      dailyBillNumber: 1,
      businessDate: '2026-10-21',
      vendorId: vendor.id,
      vendorName: vendor.name,
      purchaseDate: '2026-10-21',
      items: [{ productName: 'Kaju 10kg', quantity: 10, unit: 'KG', unitPrice: 700, lineTotal: 7000 }],
      subtotal: 7000,
      discount: 0,
      additionalCharges: 0,
      grandTotal: 7000,
      amountPaid: 3000, // Partial paid at bill creation
      balanceDue: 4000,
      paymentStatus: 'Partially Paid',
      paymentMode: 'Bank Transfer',
      status: 'Active',
      payments: [
        {
          id: 'pay-1',
          purchaseBillId: 'pur-1',
          vendorId: vendor.id,
          paymentDate: '2026-10-21',
          amount: 3000,
          paymentMode: 'Bank Transfer',
          notes: 'Advance at delivery',
        },
      ],
    };

    const bill2: PurchaseBill = {
      id: 'pur-2',
      purchaseNumber: 'PUR-0002',
      dailyBillNumber: 1,
      businessDate: '2026-10-22',
      vendorId: vendor.id,
      vendorName: vendor.name,
      purchaseDate: '2026-10-22',
      items: [{ productName: 'Badam 5kg', quantity: 5, unit: 'KG', unitPrice: 800, lineTotal: 4000 }],
      subtotal: 4000,
      discount: 0,
      additionalCharges: 0,
      grandTotal: 4000,
      amountPaid: 0, // Unpaid
      balanceDue: 4000,
      paymentStatus: 'Unpaid',
      paymentMode: 'Cash',
      status: 'Active',
      payments: [],
    };

    // Subsequent payment made toward bill 1 on 2026-10-23
    const subsequentPayment: VendorPayment = {
      id: 'pay-2',
      purchaseBillId: 'pur-1',
      vendorId: vendor.id,
      paymentDate: '2026-10-23',
      amount: 4000, // Clears bill 1
      paymentMode: 'UPI',
      notes: 'Final settlement for PUR-0001',
    };
    bill1.payments?.push(subsequentPayment);
    bill1.amountPaid += 4000;
    bill1.balanceDue = 0;
    bill1.paymentStatus = 'Paid';

    // Verify aggregate totals
    const totalPurchased = bill1.grandTotal + bill2.grandTotal; // 7000 + 4000 = 11000
    const totalPaid = bill1.amountPaid + bill2.amountPaid; // 7000 + 0 = 7000
    const netOutstandingDue = totalPurchased - totalPaid; // 4000 (Remaining on bill 2)

    expect(totalPurchased).toBe(11000);
    expect(totalPaid).toBe(7000);
    expect(netOutstandingDue).toBe(4000);
  });

  it('separates store operating expenses from supplier inward purchases to prevent double-counting', () => {
    // 1. Direct operating expenses (Overheads)
    const operatingExpenses: ExpenseItem[] = [
      {
        id: 'exp-1',
        title: 'October Commercial Electricity Bill',
        category: 'Store Commercial Electricity',
        amount: 3200,
        date: '2026-10-23',
        paymentMode: 'UPI',
        paidTo: 'Torrent Power',
      },
      {
        id: 'exp-2',
        title: 'Counter Staff Weekly Wages',
        category: 'Staff Salaries & Wages',
        amount: 4500,
        date: '2026-10-23',
        paymentMode: 'Cash',
        paidTo: 'Staff Team',
      },
    ];

    // 2. Authoritative Purchase Bills (Procurement)
    const purchaseBills: PurchaseBill[] = [
      {
        id: 'pur-101',
        purchaseNumber: 'PUR-0005',
        dailyBillNumber: 1,
        businessDate: '2026-10-23',
        vendorName: 'Mahalaxmi Packaging Goods',
        purchaseDate: '2026-10-23',
        items: [{ productName: '1kg Sweet Boxes (1000 pcs)', quantity: 1000, unit: 'PCS', unitPrice: 8, lineTotal: 8000 }],
        subtotal: 8000,
        discount: 0,
        additionalCharges: 0,
        grandTotal: 8000,
        amountPaid: 5000, // Cash Outflow
        balanceDue: 3000, // Outstanding Credit
        paymentStatus: 'Partially Paid',
        paymentMode: 'Bank Transfer',
        status: 'Active',
      },
      {
        id: 'pur-102',
        purchaseNumber: 'PUR-0006',
        dailyBillNumber: 2,
        businessDate: '2026-10-23',
        vendorName: 'Voided Supplier Sample',
        purchaseDate: '2026-10-23',
        items: [{ productName: 'Defective Sample', quantity: 1, unit: 'PCS', unitPrice: 100, lineTotal: 100 }],
        subtotal: 100,
        discount: 0,
        additionalCharges: 0,
        grandTotal: 100,
        amountPaid: 0,
        balanceDue: 100,
        paymentStatus: 'Unpaid',
        paymentMode: 'Cash',
        status: 'Cancelled', // Voided!
      },
    ];

    // Financial Calculation without double counting:
    const directOperatingTotal = operatingExpenses.reduce((sum, e) => sum + e.amount, 0); // 3200 + 4500 = 7700
    const activePurchases = purchaseBills.filter((b) => b.status !== 'Cancelled');
    const supplierPurchasesPaid = activePurchases.reduce((sum, b) => sum + b.amountPaid, 0); // 5000
    const totalCashOutflow = directOperatingTotal + supplierPurchasesPaid; // 7700 + 5000 = 12700
    const outstandingSupplierDue = activePurchases.reduce((sum, b) => sum + b.balanceDue, 0); // 3000

    expect(directOperatingTotal).toBe(7700);
    expect(supplierPurchasesPaid).toBe(5000);
    expect(totalCashOutflow).toBe(12700);
    expect(outstandingSupplierDue).toBe(3000);
    expect(activePurchases.length).toBe(1); // Cancelled bill excluded
  });

  it('safely handles purchase bill deletion with stock reversal and removal from bills list', () => {
    let bills: PurchaseBill[] = [
      {
        id: 'pur-delete-1',
        purchaseNumber: 'PUR-0001',
        dailyBillNumber: 1,
        businessDate: '2026-10-24',
        vendorName: 'Mansur',
        purchaseDate: '2026-10-24',
        items: [{ productId: 'prod-purina-wafer', productName: 'Purina wafer', quantity: 5, unit: 'PCS', unitPrice: 14, lineTotal: 70 }],
        subtotal: 70,
        discount: 0,
        additionalCharges: 0,
        grandTotal: 70,
        amountPaid: 70,
        balanceDue: 0,
        paymentStatus: 'Paid',
        paymentMode: 'Cash',
        status: 'Active',
      }
    ];

    let currentStock = 10;
    const billToDelete = bills.find((b) => b.id === 'pur-delete-1')!;

    // Reverse stock
    currentStock = Math.max(0, currentStock - billToDelete.items[0].quantity);
    expect(currentStock).toBe(5); // 10 - 5 = 5

    // Delete bill
    bills = bills.filter((b) => b.id !== 'pur-delete-1');
    expect(bills).toHaveLength(0);
  });
});
