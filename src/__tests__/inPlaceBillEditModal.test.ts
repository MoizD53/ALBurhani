import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { EditBillModal } from '../components/bills/EditBillModal';
import { computeStockAdjustments } from '../lib/orders';
import { buildCartItem } from '../lib/pricing';
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
    dailyBillNumber: 1,
    businessDate: '2026-10-27',
    branch: 'godi_road',
    timestamp: Date.now(),
    createdAt: new Date().toISOString(),
    cashierName: 'Owner',
    items: [buildCartItem(sampleProducts[0], 2)],
    subtotal: 500,
    discountAmount: 0,
    gstAmount: 0,
    grandTotal: 500,
    paymentMethod: 'CASH',
    amountReceived: 500,
    changeGiven: 0,
    transactionType: 'NO_BILL',
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
      buildCartItem(sampleProducts[0], 2),
    ];

    // Customer increased KAJU KATLI from 2 to 3, and added 1 GATHIYA
    const updatedItems: CartItem[] = [
      buildCartItem(sampleProducts[0], 3),
      buildCartItem(sampleProducts[1], 1),
    ];

    const adjustments = computeStockAdjustments(originalItems, updatedItems);
    expect(adjustments).toEqual([
      { productId: 'prod-1', deltaQuantity: 1, isWeight: false },
      { productId: 'prod-2', deltaQuantity: 1, isWeight: false },
    ]);
  });

  it('calculates inventory restoration correctly when items are removed or reduced', () => {
    const originalItems: CartItem[] = [
      buildCartItem(sampleProducts[0], 3),
      buildCartItem(sampleProducts[1], 2),
    ];

    // Reduced KAJU KATLI to 1, completely removed GATHIYA
    const updatedItems: CartItem[] = [
      buildCartItem(sampleProducts[0], 1),
    ];

    const adjustments = computeStockAdjustments(originalItems, updatedItems);
    expect(adjustments).toEqual([
      { productId: 'prod-1', deltaQuantity: -2, isWeight: false },
      { productId: 'prod-2', deltaQuantity: -2, isWeight: false },
    ]);
  });
});
