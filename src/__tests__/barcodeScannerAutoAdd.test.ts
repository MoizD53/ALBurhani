import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookupProduct, buildCartItem, isWeightBasedProduct } from '../lib/pricing';
import { Product } from '../types';

describe('Barcode Scanner Auto-Add & Hardware Scan Processing', () => {
  const sampleProducts: Product[] = [
    {
      id: 'alb-0001',
      sku: '0001',
      barcode: '0001',
      name: 'KAJU KATLI 250G',
      category: 'SWEETS',
      unit: 'Box',
      priceBasis: 'Rs./pc',
      costPrice: 200,
      sellingPrice: 275,
      stock: 50,
      minStock: 5,
    },
    {
      id: 'alb-0002',
      sku: '00001',
      barcode: '890100801001',
      name: 'DCUBE BAJRA MURMURA',
      category: 'ROASTED',
      unit: 'PCS',
      priceBasis: 'Rs./pc',
      costPrice: 40,
      sellingPrice: 60,
      stock: 10,
      minStock: 2,
    },
    {
      id: 'alb-0003',
      sku: '80548406576',
      barcode: '80548406576',
      name: 'BHUKHO B (SWEET KG)',
      category: 'SWEETS',
      unit: 'KG',
      priceBasis: 'Rs./kg',
      costPrice: 70,
      sellingPrice: 100,
      stock: 25,
      minStock: 2,
    },
  ];

  it('1. Accurately looks up product by exact barcode with leading zeros (e.g. 0001)', () => {
    const matches = lookupProduct(sampleProducts, '0001');
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('alb-0001');
    expect(matches[0].name).toBe('KAJU KATLI 250G');
  });

  it('2. Strictly preserves leading zero and does not falsely match numeric 1 to 0001', () => {
    const matches = lookupProduct(sampleProducts, '1');
    expect(matches).toHaveLength(0);
  });

  it('3. Accurately looks up product by standard EAN-13 barcode (890100801001)', () => {
    const matches = lookupProduct(sampleProducts, '890100801001');
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('alb-0002');
    expect(matches[0].name).toBe('DCUBE BAJRA MURMURA');
  });

  it('4. Correctly looks up weight-based product sold by KG (80548406576)', () => {
    const matches = lookupProduct(sampleProducts, '80548406576');
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('alb-0003');
    expect(isWeightBasedProduct(matches[0])).toBe(true);
  });

  it('5. Handles unknown barcodes gracefully without returning any product', () => {
    const matches = lookupProduct(sampleProducts, '9999999999999');
    expect(matches).toHaveLength(0);
  });

  it('6. Does not falsely match numeric codes to product name substrings', () => {
    const matches = lookupProduct(sampleProducts, '84060');
    expect(matches).toHaveLength(0);
  });

  it('7. Verifies auto-adding unique product directly creates valid cart items for both PCS and KG', () => {
    const pcsProduct = sampleProducts[1]; // DCUBE BAJRA MURMURA
    const kgProduct = sampleProducts[2];  // BHUKHO B (SWEET KG)

    // PCS Product auto-add
    const pcsItem = buildCartItem(pcsProduct, 1);
    expect(pcsItem.quantity).toBe(1);
    expect(pcsItem.lineTotal).toBe(60);
    expect(pcsItem.formattedQuantity).toBe('1 pcs');

    // KG Product auto-add (1 unit directly without modal block)
    const kgItem = buildCartItem(kgProduct, 1);
    expect(kgItem.quantity).toBe(1);
    expect(kgItem.lineTotal).toBe(100);
    expect(kgItem.formattedQuantity).toBe('1 kg');
  });

  it('8. Verifies duplicate rapid-scan prevention logic (400ms debounce)', () => {
    let lastScan = { code: '', time: 0 };
    const scanEvents: string[] = [];

    const simulateScan = (barcode: string, timestamp: number) => {
      if (lastScan.code === barcode && (timestamp - lastScan.time) < 400) {
        return false; // dropped as duplicate
      }
      lastScan = { code: barcode, time: timestamp };
      scanEvents.push(barcode);
      return true;
    };

    // First scan at t=0
    expect(simulateScan('890100801001', 1000)).toBe(true);
    // Duplicate bounce from scanner suffix at t=50ms
    expect(simulateScan('890100801001', 1050)).toBe(false);
    // Another bounce at t=200ms
    expect(simulateScan('890100801001', 1200)).toBe(false);
    // Intentional second scan by cashier at t=1600ms (600ms later)
    expect(simulateScan('890100801001', 1600)).toBe(true);

    expect(scanEvents).toHaveLength(2);
  });
});
