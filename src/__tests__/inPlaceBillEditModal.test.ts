import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { EditBillModal } from '../components/bills/EditBillModal';
import { computeStockAdjustments } from '../lib/orders';
import { CartItem, OrderBill, Product } from '../types';

describe('AL-BURHANI POS — In-Place Bill Editing Modal & Non-Redirecting Flow', () => {
  const sampleProducts: Product[] = [
    {
      id: 'prod-1',
      sku: '001',
      barcode: '001',
      name: 'KAJU KATLI 250G',
      category: 'Sweets',
      unit: 'PCS',
      priceBasis: '₹/pc',
      costPrice: 200,
      sellingPrice: 250,
      stock: 50,
      minStock: 5,
    },
    {
      id: 'prod-2',
      sku: '002',
      barcode: '002',
      name: 'SPECIAL GATHIYA',
      category: 'Namkeen',
      unit: 'PCS',
      priceBasis: '₹/pc',
      costPrice: 60,
      sellingPrice: 80,
      stock: 40,
      minStock: 5,
    },
  ];

  const sampleOrder: OrderBill = {
    id: 'sale-1793071461459-5620',
    billNumber: 'Bill #1',
    daily_bill_number: 1,
    business_date: '2026-10-27',
    branch: 'godi_road',
    timestamp: '2026-10-27T08:54:00.000Z',
    items: [
      {
        product: sampleProducts[0],
        quantity: 2,
        unitPrice: 250,
        manualPriceApplied: false,
        lineTotal: 500,
      },
    ],
    subtotal: 500,
    discount: 0,
    tax: 0,
    total: 500,
    paymentMethod: 'CASH',
    amountReceived: 500,
    changeDue: 0,
  };

  it('exports EditBillModal component properly', () => {
    expect(typeof EditBillModal).toBe('function');
  });

  it('App.tsx does NOT switch activeTab to pos when editing an order', () => {
    const appSource = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf-8');
    
    // Check that handleStartModifyOrder sets editingBillModalOrder and does NOT call setActiveTab('pos')
    expect(appSource).toContain('setEditingBillModalOrder(order);');
    
    const handleStartIdx = appSource.indexOf('const handleStartModifyOrder =');
    const handleEndIdx = appSource.indexOf('const handleCancelModifyOrder =', handleStartIdx);
    const handleStartFn = appSource.substring(handleStartIdx, handleEndIdx);

    expect(handleStartFn).not.toContain("setActiveTab('pos')");
    expect(handleStartFn).toContain('setEditingBillModalOrder(order);');
  });

  it('App.tsx renders EditBillModal with isOpen, products, and handleSaveModifiedOrder', () => {
    const appSource = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf-8');
    expect(appSource).toContain('<EditBillModal');
    expect(appSource).toContain('isOpen={Boolean(editingBillModalOrder)}');
    expect(appSource).toContain('order={editingBillModalOrder}');
    expect(appSource).toContain('onSave={handleSaveModifiedOrder}');
  });

  it('calculates inventory delta correctly when editing items in the bill', () => {
    const originalItems: CartItem[] = [
      {
        product: sampleProducts[0],
        quantity: 2,
        unitPrice: 250,
        manualPriceApplied: false,
        lineTotal: 500,
      },
    ];

    // Customer increased KAJU KATLI from 2 to 3, and added 1 GATHIYA
    const updatedItems: CartItem[] = [
      {
        product: sampleProducts[0],
        quantity: 3,
        unitPrice: 250,
        manualPriceApplied: false,
        lineTotal: 750,
      },
      {
        product: sampleProducts[1],
        quantity: 1,
        unitPrice: 80,
        manualPriceApplied: false,
        lineTotal: 80,
      },
    ];

    const adjustments = computeStockAdjustments(originalItems, updatedItems);
    expect(adjustments).toEqual([
      { productId: 'prod-1', deltaQuantity: 1, isWeight: false },
      { productId: 'prod-2', deltaQuantity: 1, isWeight: false },
    ]);
  });

  it('calculates inventory restoration correctly when items are removed or reduced', () => {
    const originalItems: CartItem[] = [
      {
        product: sampleProducts[0],
        quantity: 3,
        unitPrice: 250,
        manualPriceApplied: false,
        lineTotal: 750,
      },
      {
        product: sampleProducts[1],
        quantity: 2,
        unitPrice: 80,
        manualPriceApplied: false,
        lineTotal: 160,
      },
    ];

    // Reduced KAJU KATLI to 1, completely removed GATHIYA
    const updatedItems: CartItem[] = [
      {
        product: sampleProducts[0],
        quantity: 1,
        unitPrice: 250,
        manualPriceApplied: false,
        lineTotal: 250,
      },
    ];

    const adjustments = computeStockAdjustments(originalItems, updatedItems);
    expect(adjustments).toEqual([
      { productId: 'prod-1', deltaQuantity: -2, isWeight: false },
      { productId: 'prod-2', deltaQuantity: -2, isWeight: false },
    ]);
  });
});
