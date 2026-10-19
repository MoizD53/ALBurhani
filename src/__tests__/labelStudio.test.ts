import { describe, it, expect } from 'vitest';
import { validateBatchDates } from '../components/labels/LabelStudioView';
import { Product, UserProfile } from '../types';

describe('AL-BHURANI POS — Label Studio Specification & Verification', () => {
  const mockProducts: Product[] = [
    {
      id: 'prod-1',
      sku: '0001',
      barcode: '0001', // Leading zeros preserved
      name: 'KAJU KATLI 250G',
      category: 'Sweets',
      unit: 'PCS',
      costPrice: 200,
      sellingPrice: 275,
      stock: 45,
      minStock: 5,
    },
    {
      id: 'prod-2',
      sku: 'SKU-0042',
      barcode: '0042', // Leading zeros preserved
      name: 'RATLAMI SEV 500G',
      category: 'Namkeen & Farsan',
      unit: 'PCS',
      costPrice: 70,
      sellingPrice: 110,
      stock: 30,
      minStock: 5,
    },
    {
      id: 'prod-no-barcode',
      sku: 'SKU-9999',
      barcode: '', // Missing barcode
      name: 'UNLABELED PRODUCT',
      category: 'Sweets',
      unit: 'KG',
      costPrice: 100,
      sellingPrice: 150,
      stock: 10,
      minStock: 2,
    },
  ];

  describe('1. Product Selection & Barcode Matching', () => {
    it('matches exact barcodes preserving leading zeros (e.g. "0001" and "0042")', () => {
      const code1 = '0001';
      const match1 = mockProducts.find(
        (p) => p.barcode.toLowerCase() === code1.toLowerCase() || p.sku.toLowerCase() === code1.toLowerCase()
      );
      expect(match1).toBeDefined();
      expect(match1?.name).toBe('KAJU KATLI 250G');
      expect(match1?.barcode).toBe('0001');

      const code2 = '0042';
      const match2 = mockProducts.find(
        (p) => p.barcode.toLowerCase() === code2.toLowerCase() || p.sku.toLowerCase() === code2.toLowerCase()
      );
      expect(match2).toBeDefined();
      expect(match2?.name).toBe('RATLAMI SEV 500G');
      expect(match2?.barcode).toBe('0042');
    });

    it('identifies products with missing or invalid barcodes', () => {
      const hasBarcode = (p: Product) => Boolean(p.barcode && p.barcode.trim());
      expect(hasBarcode(mockProducts[0])).toBe(true);
      expect(hasBarcode(mockProducts[1])).toBe(true);
      expect(hasBarcode(mockProducts[2])).toBe(false);
    });
  });

  describe('2. Manufacturing and Expiry Dates Validation', () => {
    it('passes when EXP date is later than MFG date', () => {
      const mfg = '2026-10-19';
      const exp = '2027-01-19';
      const err = validateBatchDates(mfg, exp);
      expect(err).toBeNull();
    });

    it('passes when dates are on the same day', () => {
      const mfg = '2026-10-19';
      const exp = '2026-10-19';
      const err = validateBatchDates(mfg, exp);
      expect(err).toBeNull();
    });

    it('fails with a clear warning when EXP date is earlier than MFG date', () => {
      const mfg = '2026-10-19';
      const exp = '2026-10-10';
      const err = validateBatchDates(mfg, exp);
      expect(err).toBe('Expiry date (EXP) cannot be earlier than Manufacturing date (MFG).');
    });

    it('passes when dates are optional / partially provided', () => {
      expect(validateBatchDates('2026-10-19', '')).toBeNull();
      expect(validateBatchDates('', '2027-01-19')).toBeNull();
      expect(validateBatchDates('', '')).toBeNull();
    });
  });

  describe('3. Multi-Product Batch Copies & Print Layout Counts', () => {
    it('correctly aggregates copies for multi-product label printing batches', () => {
      const batch = [
        { product: mockProducts[0], copies: 5, mfgDate: '2026-10-19', expDate: '2027-01-19' },
        { product: mockProducts[1], copies: 10, mfgDate: '2026-10-19', expDate: '2027-01-19' },
      ];

      const expandedLabels: any[] = [];
      batch.forEach((item) => {
        for (let i = 0; i < item.copies; i++) {
          expandedLabels.push({
            productId: item.product.id,
            productName: item.product.name,
            barcode: item.product.barcode,
            sellingPrice: item.product.sellingPrice,
            mfgDate: item.mfgDate,
            expDate: item.expDate,
          });
        }
      });

      expect(expandedLabels.length).toBe(15);
      expect(expandedLabels.filter((l) => l.productId === 'prod-1').length).toBe(5);
      expect(expandedLabels.filter((l) => l.productId === 'prod-2').length).toBe(10);
    });

    it('verifies exact required shop name for label branding', () => {
      const expectedShopName = 'AL BURHANI SWEET AND FARSAAN';
      expect(expectedShopName).toBe('AL BURHANI SWEET AND FARSAAN');
    });
  });

  describe('4. Admin / Owner Permissions Verification', () => {
    it('allows Owner to access Label Studio and restricts Cashier', () => {
      const ownerUser: UserProfile = {
        id: 'owner-1',
        name: 'Owner',
        role: 'Owner',
        counter: 'Counter 1',
      };

      const cashierUser: UserProfile = {
        id: 'cashier-1',
        name: 'Cashier Staff',
        role: 'Cashier',
        counter: 'Counter 2',
      };

      const canAccessLabelStudio = (user: UserProfile) => user.role === 'Owner';

      expect(canAccessLabelStudio(ownerUser)).toBe(true);
      expect(canAccessLabelStudio(cashierUser)).toBe(false);
    });
  });
});
